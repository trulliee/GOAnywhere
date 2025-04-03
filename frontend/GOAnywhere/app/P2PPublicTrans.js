import axios from 'axios';
import polyline from '@mapbox/polyline'; // Ensure this package is installed

const GOOGLE_MAPS_API_KEY = "AIzaSyDzdl-AzKqD_NeAdrz934cQM6LxWEHYF1g";

const P2PPublicTrans = async (startLocation, endLocation, setRoute, setMarkers, setPublicTravelTime, setPublicDetails) => {
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
    const routePolyline = response.data.routes[0].overview_polyline.points;
    const decodedPolyline = polyline.decode(routePolyline).map(([lat, lng]) => ({ latitude: lat, longitude: lng }));

    // Only set start and end markers
    const markers = [
      { latitude: originCoords.lat, longitude: originCoords.lng, title: "Start" },
      { latitude: destinationCoords.lat, longitude: destinationCoords.lng, title: "Destination" }
    ];

    setRoute(decodedPolyline);
    setMarkers(markers);
    setPublicTravelTime(response.data.routes[0].legs[0].duration.text);
    const steps = response.data.routes[0].legs[0].steps.map((step, index) => ({
      instruction: step.html_instructions.replace(/<[^>]+>/g, ''),
      distance: step.distance.text,
      travelMode: step.travel_mode,
      transitInfo: step.transit_details ? {
        lineName: step.transit_details.line.short_name || step.transit_details.line.name,
        departureStop: step.transit_details.departure_stop.name,
        arrivalStop: step.transit_details.arrival_stop.name,
        headsign: step.transit_details.headsign,
        numStops: step.transit_details.num_stops,
        vehicleType: step.transit_details.line.vehicle.type, // e.g., BUS or SUBWAY
      } : null,
    }));
    
    
    setPublicDetails({
      distance: response.data.routes[0].legs[0].distance.text,
      duration: response.data.routes[0].legs[0].duration.text,
      steps,
    });
    
  } catch (error) {
    console.error('Error fetching public transport route:', error);
    alert('Could not fetch public transport route.');
  }
};

export default P2PPublicTrans;
