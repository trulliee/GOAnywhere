import axios from 'axios';
import { Alert } from 'react-native';
import polyline from '@mapbox/polyline';

const GOOGLE_MAPS_API_KEY    = "AIzaSyDzdl-AzKqD_NeAdrz934cQM6LxWEHYF1g";
const LTA_ACCOUNT_KEY        = "CetOCVT4SmqDrAHkHLrf5g==";

const TRAFFIC_INCIDENTS_URL  = "https://datamall2.mytransport.sg/ltaodataservice/TrafficIncidents";
const ROAD_WORKS_URL         = "https://datamall2.mytransport.sg/ltaodataservice/RoadWorks";

/**
 * Convert an address into latitude and longitude coordinates
 * @param {string} address - The address to geocode
 * @returns {Promise<{lat: number, lng: number}>} - The coordinates
 */
const getCoordinates = async (address) => {
  // Handle if address is already a lat,lng pair
  if (/^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(address)) {
    const [lat, lng] = address.split(',').map(Number);
    return { lat, lng };
  }
  
  // Format the address to include Singapore if not already included
  const formatted = address.toLowerCase().includes("singapore")
    ? address
    : `${address}, Singapore`;
    
  const url = `https://maps.googleapis.com/maps/api/geocode/json`
            + `?address=${encodeURIComponent(formatted)}`
            + `&key=${GOOGLE_MAPS_API_KEY}`;
            
  try {
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
  } catch (error) {
    console.error("Geocoding error:", error);
    throw new Error(`Could not find location: ${address}`);
  }
};

/**
 * Fetch traffic incidents from LTA API
 * @returns {Promise<Array>} - Array of traffic incidents
 */
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

/**
 * Fetch road works from LTA API
 * @returns {Promise<Array>} - Array of road works
 */
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

/**
 * Check if a point is near an incident
 * @param {Object} pt - Point with latitude and longitude
 * @param {Object} inc - Incident with Latitude and Longitude
 * @param {number} threshold - Distance threshold (roughly ~100m)
 * @returns {boolean} - True if the point is near the incident
 */
const isNear = (pt, inc, threshold = 0.001) =>
  Math.abs(pt.latitude  - inc.Latitude)  < threshold &&
  Math.abs(pt.longitude - inc.Longitude) < threshold;

/**
 * Get driving routes between two locations
 * @param {string} startLocation - Starting address
 * @param {string} endLocation - Ending address
 * @returns {Promise<Array>} - Array of route objects
 */
const P2PDriver = async (startLocation, endLocation) => {
  try {
    // Convert addresses to coordinates
    const originCoords      = await getCoordinates(startLocation);
    const destinationCoords = await getCoordinates(endLocation);

    // Validate that origin and destination are different
    if (
      originCoords.lat === destinationCoords.lat &&
      originCoords.lng === destinationCoords.lng
    ) {
      throw new Error('Origin and destination cannot be the same.');
    }

    // Build Google Directions API URL
    const directionsUrl =
      `https://maps.googleapis.com/maps/api/directions/json`
      + `?origin=${originCoords.lat},${originCoords.lng}`
      + `&destination=${destinationCoords.lat},${destinationCoords.lng}`
      + `&mode=driving`
      + `&alternatives=true`
      + `&departure_time=now`
      + `&traffic_model=best_guess`
      + `&key=${GOOGLE_MAPS_API_KEY}`;

    // Fetch directions
    const response = await axios.get(directionsUrl);

    if (response.data.status !== "OK" || !response.data.routes.length) {
      throw new Error("No driving routes found between these locations.");
    }

    // Process routes
    const routes = response.data.routes.map(route => {
      // Decode the polyline
      const decodedPolyline = polyline
        .decode(route.overview_polyline.points)
        .map(([lat, lng]) => ({ latitude: lat, longitude: lng }));

      // Format step instructions
      const steps = route.legs[0].steps.map(step => ({
        instruction: step.html_instructions.replace(/<[^>]+>/g, ''),
        distance:    step.distance.text,
        duration:    step.duration.text,
        maneuver:    step.maneuver,
        startLocation: {
          latitude: step.start_location.lat,
          longitude: step.start_location.lng
        },
        endLocation: {
          latitude: step.end_location.lat,
          longitude: step.end_location.lng
        }
      }));

      return {
        summary:  route.summary || 'Unnamed Route',
        distance: route.legs[0].distance.text,
        duration: route.legs[0].duration_in_traffic?.text || route.legs[0].duration.text,
        durationValue: route.legs[0].duration_in_traffic?.value || route.legs[0].duration.value,
        steps,
        polyline: decodedPolyline,
        markers: [
          { latitude: originCoords.lat,      longitude: originCoords.lng,      title: 'Start' },
          { latitude: destinationCoords.lat, longitude: destinationCoords.lng, title: 'Destination' }
        ],
        waypointOrder: route.waypoint_order || [],
        warnings: route.warnings || [],
        overview: {
          northeast: {
            latitude: route.bounds.northeast.lat,
            longitude: route.bounds.northeast.lng
          },
          southwest: {
            latitude: route.bounds.southwest.lat,
            longitude: route.bounds.southwest.lng
          }
        }
      };
    });

    // Fetch traffic data
    const [trafficIncidents, roadWorks] = await Promise.all([
      fetchTrafficIncidents(),
      fetchRoadWorks()
    ]);

    // Add traffic issues to routes
    routes.forEach(route => {
      const issues = [];

      // Check for traffic incidents along the route
      const hasTrafficIncident = trafficIncidents.some(inc =>
        route.polyline.some(pt => isNear(pt, inc))
      );
      if (hasTrafficIncident) issues.push("traffic incident");
    
      // Check for road works along the route
      const hasRoadWorks = roadWorks.some(w =>
        route.polyline.some(pt => isNear(pt, w))
      );
      if (hasRoadWorks) issues.push("road works");
    
      // Add issues to the route
      route.issues = issues;
      
      // Calculate a reliability score
      route.reliabilityScore = 100 - (issues.length * 20); // Simple scoring
    });

    // Sort routes by duration
    return routes.sort((a, b) => a.durationValue - b.durationValue);
  } catch (error) {
    console.error('Error fetching driving route:', error);
    throw new Error('Driving routes failed: ' + error.message);
  }
};

export default P2PDriver;