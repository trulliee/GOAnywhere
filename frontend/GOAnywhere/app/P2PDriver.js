import axios from 'axios';
import { Alert } from 'react-native';
import polyline from '@mapbox/polyline';

const GOOGLE_MAPS_API_KEY    = "AIzaSyDzdl-AzKqD_NeAdrz934cQM6LxWEHYF1g";
const LTA_ACCOUNT_KEY        = "CetOCVT4SmqDrAHkHLrf5g==";

const TRAFFIC_INCIDENTS_URL  = "https://datamall2.mytransport.sg/ltaodataservice/TrafficIncidents";
const ROAD_WORKS_URL         = "https://datamall2.mytransport.sg/ltaodataservice/RoadWorks";

const getCoordinates = async (address) => {
  if (/^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(address)) {
    const [lat, lng] = address.split(',').map(Number);
    return { lat, lng };
  }
  const formatted = address.toLowerCase().includes("singapore")
    ? address
    : `${address}, Singapore`;
  const url = `https://maps.googleapis.com/maps/api/geocode/json`
            + `?address=${encodeURIComponent(formatted)}`
            + `&key=${GOOGLE_MAPS_API_KEY}`;
  const response = await axios.get(url);
  if (response.data.status !== "OK" || !response.data.results.length) {
    throw new Error(`Invalid location: "${address}"`);
  }
  if (response.data.results[0].partial_match) {
    const types = response.data.results[0].types || [];
    // allow if Google still recognized it as a station, route, or establishment
    if (
      !types.includes('transit_station') &&
      !types.includes('route') &&
      !types.includes('establishment')
    ) {
      throw new Error(`Uncertain match for: "${address}"`);
    }
  }
  const { lat, lng } = response.data.results[0].geometry.location;
  return { lat, lng };
};

async function fetchTrafficIncidents() {
  try {
    const { data } = await axios.get(`${TRAFFIC_INCIDENTS_URL}?$top=100`, {
      headers: { AccountKey: LTA_ACCOUNT_KEY }
    });
    return Array.isArray(data.value) ? data.value : [];
  } catch (e) {
    console.warn("⚠️ Could not fetch traffic incidents:", e.message);
    return [];
  }
}

async function fetchRoadWorks() {
  try {
    const { data } = await axios.get(`${ROAD_WORKS_URL}?$top=100`, {
      headers: { AccountKey: LTA_ACCOUNT_KEY }
    });
    return Array.isArray(data.value) ? data.value : [];
  } catch (e) {
    console.warn("⚠️ Could not fetch road works:", e.message);
    return [];
  }
}

// roughly ~100m threshold (0.001° ≈111m)
const isNear = (pt, inc, threshold = 0.001) =>
  Math.abs(pt.latitude  - inc.Latitude)  < threshold &&
  Math.abs(pt.longitude - inc.Longitude) < threshold;

const P2PDriver = async (startLocation, endLocation) => {
  try {
    const originCoords      = await getCoordinates(startLocation);
    const destinationCoords = await getCoordinates(endLocation);

    if (
      originCoords.lat === destinationCoords.lat &&
      originCoords.lng === destinationCoords.lng
    ) {
      throw new Error('Origin and destination cannot be the same.');
    }

    const directionsUrl =
      `https://maps.googleapis.com/maps/api/directions/json`
      + `?origin=${originCoords.lat},${originCoords.lng}`
      + `&destination=${destinationCoords.lat},${destinationCoords.lng}`
      + `&mode=driving`
      + `&alternatives=true`
      + `&departure_time=now`
      + `&traffic_model=best_guess`
      + `&key=${GOOGLE_MAPS_API_KEY}`;

    const response = await axios.get(directionsUrl);

    if (response.data.status !== "OK" || !response.data.routes.length) {
      throw new Error("No driving routes found between these locations.");
    }

    // build your basic routes array
    const routes = response.data.routes.map(route => {
      const decodedPolyline = polyline
        .decode(route.overview_polyline.points)
        .map(([lat, lng]) => ({ latitude: lat, longitude: lng }));

      const steps = route.legs[0].steps.map(step => ({
        instruction: step.html_instructions.replace(/<[^>]+>/g, ''),
        distance:    step.distance.text,
        road:        step.maneuver || 'Follow road'
      }));

      return {
        summary:  route.summary || 'Unnamed Route',
        distance: route.legs[0].distance.text,
        duration: route.legs[0].duration.text,
        steps,
        polyline: decodedPolyline,
        markers: [
          { latitude: originCoords.lat,      longitude: originCoords.lng,      title: 'Start' },
          { latitude: destinationCoords.lat, longitude: destinationCoords.lng, title: 'Destination' }
        ]
      };
    });

    const isNear = (pt, inc, threshold = 0.0001) => {
      return (
        Math.abs(pt.latitude  - inc.Latitude)  < threshold &&
        Math.abs(pt.longitude - inc.Longitude) < threshold
      );
    };

    // fetch only the incident feeds
    const [trafficIncidents, roadWorks] = await Promise.all([
      fetchTrafficIncidents(),
      fetchRoadWorks()
    ]);

    // attach an `issues` array based on proximity
    routes.forEach(route => {
      const issues = [];

      const nearbyInc = trafficIncidents.some(inc =>
        route.polyline.some(pt => isNear(pt, inc))
      );
      if (nearbyInc) issues.push("traffic incident");
    
      // 2) filter road works similarly (assuming each work has .Latitude/.Longitude)
      const nearbyWork = roadWorks.some(w =>
        route.polyline.some(pt => isNear(pt, w))
      );
      if (nearbyWork) issues.push("road works");
    
      route.issues = issues;  

      if (roadWorks.some(w =>
        route.polyline.some(pt => isNear(pt, w))
      )) {
        issues.push("road works");
      }

      route.issues = issues;
    });

    return routes;
  } catch (error) {
    console.error('Error fetching driving route:', error);
    throw new Error('Driving routes failed: ' + error.message);
  }
};

export default P2PDriver;
