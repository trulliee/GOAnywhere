import axios from 'axios';
import { Alert } from 'react-native';
import polyline from '@mapbox/polyline';

const GOOGLE_MAPS_API_KEY = "AIzaSyDzdl-AzKqD_NeAdrz934cQM6LxWEHYF1g";

const P2PDriver = async (startLocation, endLocation) => {
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

    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${originCoords.lat},${originCoords.lng}&destination=${destinationCoords.lat},${destinationCoords.lng}&mode=driving&alternatives=true&key=${GOOGLE_MAPS_API_KEY}`;
    const response = await axios.get(url);

    const routes = response.data.routes.map((route) => {
      const decodedPolyline = polyline.decode(route.overview_polyline.points).map(([lat, lng]) => ({
        latitude: lat,
        longitude: lng,
      }));

      const steps = route.legs[0].steps.map((step) => ({
        instruction: step.html_instructions.replace(/<[^>]+>/g, ''),
        distance: step.distance.text,
        road: step.maneuver || 'Follow road'
      }));

      return {
        summary: route.summary || 'Unnamed Route',
        distance: route.legs[0].distance.text,
        duration: route.legs[0].duration.text,
        steps,
        polyline: decodedPolyline,
        markers: [
          { latitude: originCoords.lat, longitude: originCoords.lng, title: 'Start' },
          { latitude: destinationCoords.lat, longitude: destinationCoords.lng, title: 'Destination' }
        ]
      };
    });

    return routes;
  } catch (error) {
    console.error('Error fetching driving route:', error);
    alert('Could not fetch driving routes.');
    return [];
  }
};

export default P2PDriver;