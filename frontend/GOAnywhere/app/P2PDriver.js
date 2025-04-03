import axios from 'axios';
import polyline from '@mapbox/polyline'; // Ensure this package is installed

const GOOGLE_MAPS_API_KEY = "AIzaSyDzdl-AzKqD_NeAdrz934cQM6LxWEHYF1g";

const P2PDriver = async (startLocation, endLocation, setRoute, setMarkers, setDriverTravelTime, setDriverDetails) => {
  if (!startLocation || !endLocation) {
    alert('Please enter both origin and destination.');
    return;
  }

  const getCoordinates = async (address) => {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_API_KEY}`;
    const response = await axios.get(url);
    return response.data.results[0].geometry.location;
  };

  try {
    const originCoords = await getCoordinates(startLocation);
    const destinationCoords = await getCoordinates(endLocation);

    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${originCoords.lat},${originCoords.lng}&destination=${destinationCoords.lat},${destinationCoords.lng}&mode=driving&key=${GOOGLE_MAPS_API_KEY}`;

    const response = await axios.get(url);
    const routePolyline = response.data.routes[0].overview_polyline.points;
    const decodedPolyline = polyline.decode(routePolyline).map(([lat, lng]) => ({ latitude: lat, longitude: lng }));

    // Only set start and end markers
    const markers = [
      { latitude: originCoords.lat, longitude: originCoords.lng, title: "Start" },
      { latitude: destinationCoords.lat, longitude: destinationCoords.lng, title: "Destination" }
    ];

    setRoute(decodedPolyline);
    setMarkers(markers);
    setDriverTravelTime(response.data.routes[0].legs[0].duration.text);
    const steps = response.data.routes[0].legs[0].steps.map((step, index) => ({
      instruction: step.html_instructions.replace(/<[^>]+>/g, ''),
      distance: step.distance.text,
      road: step.maneuver || "Follow route"
    }));
    
    setDriverDetails({
      distance: response.data.routes[0].legs[0].distance.text,
      duration: response.data.routes[0].legs[0].duration.text,
      steps,
    });
    
  } catch (error) {
    console.error('Error fetching driving route:', error);
    alert('Could not fetch driving route.');
  }
};

export default P2PDriver;
