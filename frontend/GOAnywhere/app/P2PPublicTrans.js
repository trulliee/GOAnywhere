import axios from 'axios';
import { Alert } from 'react-native';
import polyline from '@mapbox/polyline';

const GOOGLE_MAPS_API_KEY = "AIzaSyDzdl-AzKqD_NeAdrz934cQM6LxWEHYF1g";

const transitModes = [
  {
    label: 'Fastest',
    options: '',
  },
  {
    label: 'Minimum Transfer',
    options: 'transit_routing_preference=less_walking',
  },
  {
    label: 'Bus Only',
    options: 'transit_mode=bus',
  },
  {
    label: 'MRT Only',
    options: 'transit_mode=subway',
  },
];


const P2PPublicTrans = async (startLocation, endLocation) => {
  if (!startLocation || !endLocation) {
    alert('Please enter both origin and destination.');
    return [];
  }

  const getCoordinates = async (address) => {
    if (/^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(address)) {
      const [lat, lng] = address.split(',').map(Number);
      return { lat, lng };
    }
  
    const formattedAddress = address.toLowerCase().includes("singapore")
      ? address
      : `${address}, Singapore`;
  
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(formattedAddress)}&key=${GOOGLE_MAPS_API_KEY}`;
    const response = await axios.get(url);
  
    if (!response.data.results || response.data.results.length === 0) {
      Alert.alert("Invalid Location", `Could not find location for: "${address}"`);
      throw new Error(`No geocoding result for address: ${address}`);
    }
  
    return response.data.results[0].geometry.location;
  };
  
  
  

  try {
    const originCoords = await getCoordinates(startLocation);
    const destinationCoords = await getCoordinates(endLocation);

    const results = await Promise.all(transitModes.map(async ({ label, options }) => {
      const baseUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${originCoords.lat},${originCoords.lng}&destination=${destinationCoords.lat},${destinationCoords.lng}&mode=transit&departure_time=now&key=${GOOGLE_MAPS_API_KEY}`;
      const fullUrl = options ? `${baseUrl}&${options}` : baseUrl;      
      const response = await axios.get(fullUrl);
      const route = response.data.routes[0];

      if (!route || !route.legs || !route.legs[0]?.steps) return null;
      
      const hasTransit = route.legs[0].steps.some(
        step => step.travel_mode === 'TRANSIT'
      );
      if (!hasTransit) return null;
      

      const decodedPolyline = polyline.decode(route.overview_polyline.points)
        .map(([lat, lng]) => ({ latitude: lat, longitude: lng }));

      const steps = route.legs[0].steps.map((step) => ({
        instruction: step.html_instructions.replace(/<[^>]+>/g, ''),
        distance: step.distance.text,
        travelMode: step.travel_mode,
        transitInfo: step.transit_details ? {
          lineName: step.transit_details.line.short_name || step.transit_details.line.name,
          departureStop: step.transit_details.departure_stop.name,
          arrivalStop: step.transit_details.arrival_stop.name,
          headsign: step.transit_details.headsign,
          numStops: step.transit_details.num_stops,
          vehicleType: step.transit_details.line.vehicle.type,
        } : null,
      }));

      return {
        summary: label,
        distance: route.legs[0].distance.text,
        duration: route.legs[0].duration.text,
        steps,
        polyline: decodedPolyline,
        markers: [
          { latitude: originCoords.lat, longitude: originCoords.lng, title: 'Start' },
          { latitude: destinationCoords.lat, longitude: destinationCoords.lng, title: 'Destination' },
        ]
      };
    }));
    

    const validRoutes = results.filter(route => route !== null);

    if (validRoutes.length === 0) {
      Alert.alert("No Transit Route Found", "Could not find any path involving MRT or Bus.");
    }

    return validRoutes;
  } catch (error) {
    console.error('Error fetching public transport route:', error);
    alert('Could not fetch public transport routes.');
    return [];
  }
};

export default P2PPublicTrans;
