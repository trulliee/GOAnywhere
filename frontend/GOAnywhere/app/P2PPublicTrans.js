import axios from 'axios';

const GOOGLE_MAPS_API_KEY = "AIzaSyDzdl-AzKqD_NeAdrz934cQM6LxWEHYF1g";

const P2PPublicTrans = async (startLocation, endLocation, setRoute, setMarkers, setPublicTravelTime) => {
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

    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${originCoords.lat},${originCoords.lng}&destination=${destinationCoords.lat},${destinationCoords.lng}&mode=transit&transit_mode=bus&key=${GOOGLE_MAPS_API_KEY}`;

    const response = await axios.get(url);
    const steps = response.data.routes[0].legs[0].steps;
    let polylineCoords = [];
    let busStops = [];

    steps.forEach((step) => {
      if (step.travel_mode === 'TRANSIT') {
        busStops.push({ latitude: step.start_location.lat, longitude: step.start_location.lng, title: `Bus Stop: ${step.transit_details.headsign}` });
      }
      polylineCoords.push({ latitude: step.start_location.lat, longitude: step.start_location.lng });
      polylineCoords.push({ latitude: step.end_location.lat, longitude: step.end_location.lng });
    });

    setRoute(polylineCoords);
    setMarkers(busStops);
    setPublicTravelTime('30');
  } catch (error) {
    console.error('Error fetching public transport route:', error);
    alert('Could not fetch public transport route.');
  }
};

export default P2PPublicTrans;
