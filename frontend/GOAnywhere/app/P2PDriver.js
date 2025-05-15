import axios from 'axios';
import polyline from '@mapbox/polyline';
import { isNear } from './P2PHelper';

const GOOGLE_MAPS_API_KEY = 'AIzaSyDHIQoHjcVR0RsyKG-U5myMIpdPqK6n-m0';
const LTA_ACCOUNT_KEY = 'CetOCVT4SmqDrAHkHLrf5g==';
const GOOGLE_GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
const GOOGLE_DIRECTIONS_URL = 'https://maps.googleapis.com/maps/api/directions/json';
const TRAFFIC_INCIDENTS_URL = 'https://datamall2.mytransport.sg/ltaodataservice/TrafficIncidents';
const ROAD_WORKS_URL = 'https://datamall2.mytransport.sg/ltaodataservice/RoadWorks';

async function getCoordinates(address) {
  if (/^-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?$/.test(address)) {
    const [lat, lng] = address.split(',').map(Number);
    return { lat, lng };
  }
  const formatted = address.toLowerCase().includes('singapore')
    ? address
    : `${address}, Singapore`;
  const { data } = await axios.get(
    `${GOOGLE_GEOCODE_URL}?address=${encodeURIComponent(formatted)}&key=${GOOGLE_MAPS_API_KEY}`
  );
  if (data.status !== 'OK' || !data.results.length) {
    throw new Error(`Could not find location: ${address}`);
  }
  const result = data.results[0];
  if (result.partial_match) {
    const types = result.types || [];
    if (!types.includes('transit_station') && !types.includes('route') && !types.includes('establishment')) {
      throw new Error(`Uncertain match for: ${address}`);
    }
  }
  return result.geometry.location;
}

async function fetchTrafficIncidents() {
  try {
    const { data } = await axios.get(`${TRAFFIC_INCIDENTS_URL}?$top=100`, {
      headers: { AccountKey: LTA_ACCOUNT_KEY }
    });
    return data.value || [];
  } catch {
    return [];
  }
}

async function fetchRoadWorks() {
  try {
    const { data } = await axios.get(`${ROAD_WORKS_URL}?$top=100`, {
      headers: { AccountKey: LTA_ACCOUNT_KEY }
    });
    return data.value || [];
  } catch {
    return [];
  }
}

const P2PDriver = async (startLocation, endLocation) => {
  const origin = await getCoordinates(startLocation);
  const destination = await getCoordinates(endLocation);
  if (origin.lat === destination.lat && origin.lng === destination.lng) {
    throw new Error('Origin and destination cannot be the same.');
  }

  const url =
    `${GOOGLE_DIRECTIONS_URL}?origin=${origin.lat},${origin.lng}` +
    `&destination=${destination.lat},${destination.lng}` +
    `&mode=driving&alternatives=true&departure_time=now&traffic_model=best_guess` +
    `&key=${GOOGLE_MAPS_API_KEY}`;

  const response = await axios.get(url);
  if (response.data.status !== 'OK' || !response.data.routes.length) {
    throw new Error('No driving routes found.');
  }

  const routes = response.data.routes.map(route => {
    const coords = polyline
      .decode(route.overview_polyline.points)
      .map(([lat, lng]) => ({ latitude: lat, longitude: lng }));

    const steps = route.legs[0].steps.map(step => ({
      instruction: step.html_instructions.replace(/<[^>]+>/g, ''),
      distance: step.distance.text,
      duration: step.duration.text,
      maneuver: step.maneuver,
      startLocation: step.start_location,
      endLocation: step.end_location
    }));

    return {
      summary: route.summary || 'Unnamed',
      distance: route.legs[0].distance.text,
      duration: route.legs[0].duration_in_traffic?.text || route.legs[0].duration.text,
      durationValue: route.legs[0].duration_in_traffic?.value || route.legs[0].duration.value,
      steps,
      polyline: coords,
      markers: [
        { latitude: origin.lat, longitude: origin.lng, title: 'Start' },
        { latitude: destination.lat, longitude: destination.lng, title: 'Destination' }
      ],
      warnings: route.warnings || [],
      overview: route.bounds
    };
  });

  const [incidents, works] = await Promise.all([
    fetchTrafficIncidents(),
    fetchRoadWorks()
  ]);

  routes.forEach(r => {
    const issues = [];
    if (incidents.some(i => r.polyline.some(pt => isNear(pt, i)))) {
      issues.push('traffic incident');
    }
    if (works.some(w => r.polyline.some(pt => isNear(pt, w)))) {
      issues.push('road works');
    }
    r.issues = issues;
    r.reliabilityScore = 100 - issues.length * 20;
  });

  return routes.sort((a, b) => a.durationValue - b.durationValue);
};

export default P2PDriver;
