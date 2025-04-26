import axios from 'axios';
import { Alert } from 'react-native';

const LTA_ACCOUNT_KEY = "CetOCVT4SmqDrAHkHLrf5g==";
const LTA_RAIL_NETWORK_API = "https://datamall2.mytransport.sg/ltaodataservice/RailNetwork";
const GOOGLE_GEOCODE_API = "https://maps.googleapis.com/maps/api/geocode/json";
const GOOGLE_MAPS_API_KEY = "AIzaSyDzdl-AzKqD_NeAdrz934cQM6LxWEHYF1g";

const getAllTrainStations = async () => {
  const response = await axios.get(LTA_RAIL_NETWORK_API, {
    headers: { AccountKey: LTA_ACCOUNT_KEY },
  });

  // Parse features array
  const features = response.data.features || [];

  // Extract MRT station points
  const stations = features
    .filter(feature => feature.geometry?.type === "Point")
    .map(feature => ({
      name: feature.properties?.Name || "Unknown Station",
      line: feature.properties?.Line || "Unknown Line",
      latitude: feature.geometry.coordinates[1],
      longitude: feature.geometry.coordinates[0],
    }));

  return stations;
};

const getCoordinates = async (address) => {
  if (/^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(address)) {
    const [lat, lng] = address.split(',').map(Number);
    return { lat, lng };
  }
  const url = `${GOOGLE_GEOCODE_API}?address=${encodeURIComponent(address)}, Singapore&key=${GOOGLE_MAPS_API_KEY}`;
  const response = await axios.get(url);
  const coords = response.data.results[0]?.geometry?.location;
  if (!coords) throw new Error("Geocoding failed.");
  return { lat: coords.lat, lng: coords.lng };
};

const findNearestStation = (lat, lng, stations) => {
  let nearest = null;
  let minDist = Infinity;
  for (const station of stations) {
    const d = Math.sqrt(Math.pow(station.latitude - lat, 2) + Math.pow(station.longitude - lng, 2));
    if (d < minDist) {
      nearest = station;
      minDist = d;
    }
  }
  return nearest;
};

const P2PPublicTrans = async (startLocation, endLocation) => {
  if (!startLocation || !endLocation) {
    Alert.alert('Missing Info', 'Please enter both origin and destination.');
    return [];
  }

  try {
    const stations = await getAllTrainStations();
    const startCoords = await getCoordinates(startLocation);
    const endCoords = await getCoordinates(endLocation);

    const startMRT = findNearestStation(startCoords.lat, startCoords.lng, stations);
    const endMRT = findNearestStation(endCoords.lat, endCoords.lng, stations);

    if (!startMRT || !endMRT) {
      Alert.alert("Error", "Could not find nearby MRT stations.");
      return [];
    }

    const steps = [
      {
        instruction: `Walk to ${startMRT.name} MRT Station`,
        distance: "Approx 200m",
        travelMode: "WALKING",
      },
      {
        instruction: `Board train on ${startMRT.line} Line at ${startMRT.name}`,
        distance: "Estimate",
        travelMode: "TRANSIT",
        transitInfo: {
          lineName: startMRT.line,
          departureStop: startMRT.name,
          arrivalStop: endMRT.name,
          headsign: "Unknown",
          numStops: "Estimate",
          vehicleType: "SUBWAY",
        }
      },
      {
        instruction: `Exit at ${endMRT.name} MRT Station and walk to your destination`,
        distance: "Approx 200m",
        travelMode: "WALKING",
      }
    ];

    const markers = [
      { latitude: startCoords.lat, longitude: startCoords.lng, title: "Start" },
      { latitude: startMRT.latitude, longitude: startMRT.longitude, title: startMRT.name },
      { latitude: endMRT.latitude, longitude: endMRT.longitude, title: endMRT.name },
      { latitude: endCoords.lat, longitude: endCoords.lng, title: "Destination" },
    ];

    return [{
      summary: "Public Transport (MRT)",
      distance: "Approximate",
      duration: "Estimate",
      steps,
      polyline: [], // Optional to add route line later
      markers,
    }];
  } catch (error) {
    console.error('Error fetching public transport route:', error);
    Alert.alert("Error", "Could not compute public transport route.");
    return [];
  }
};

export default P2PPublicTrans;
