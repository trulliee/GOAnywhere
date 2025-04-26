// New P2PPublicTrans.js using LTA API + Google for Maps
import axios from 'axios';
import { Alert } from 'react-native';

const GOOGLE_MAPS_API_KEY = "AIzaSyDzdl-AzKqD_NeAdrz934cQM6LxWEHYF1g";
const LTA_ACCOUNT_KEY = 'CetOCVT4SmqDrAHkHLrf5g==';
const BASE_URL = 'https://datamall.lta.gov.sg/ltaodataservice/';

const P2PPublicTrans = async (startLocation, endLocation) => {
  if (!startLocation || !endLocation) {
    Alert.alert('Missing Info', 'Please enter both origin and destination.');
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

  const fetchMRTStations = async () => {
    const response = await axios.get(`${LTA_BASE_URL}MRTStations`, {
      headers: { AccountKey: LTA_ACCOUNT_KEY },
    });
    return response.data.value;
  };

  const findNearestStation = (coords, stations) => {
    let minDist = Infinity;
    let nearest = null;

    stations.forEach((station) => {
      const dist = Math.sqrt(
        Math.pow(coords.lat - station.Latitude, 2) +
        Math.pow(coords.lng - station.Longitude, 2)
      );
      if (dist < minDist) {
        minDist = dist;
        nearest = station;
      }
    });

    return nearest;
  };

  try {
    const [originCoords, destinationCoords, stations] = await Promise.all([
      getCoordinates(startLocation),
      getCoordinates(endLocation),
      fetchMRTStations()
    ]);

    const originStation = findNearestStation(originCoords, stations);
    const destinationStation = findNearestStation(destinationCoords, stations);

    if (!originStation || !destinationStation) {
      Alert.alert("Error", "Could not find nearby MRT stations.");
      return [];
    }

    // Build basic route steps manually
    const steps = [
      {
        instruction: `Walk to ${originStation.StationName} MRT Station`,
        distance: 'Approx. 100-300m',
        travelMode: 'WALKING',
      },
      {
        instruction: `Board MRT at ${originStation.StationName} on ${originStation.Line}`,
        distance: '1 stop (estimated)',
        travelMode: 'TRANSIT',
        transitInfo: {
          lineName: originStation.Line,
          departureStop: originStation.StationName,
          arrivalStop: destinationStation.StationName,
          vehicleType: 'SUBWAY',
          headsign: 'Destination Direction',
          numStops: 1, // Placeholder unless full line data available
        },
      },
      {
        instruction: `Walk to destination from ${destinationStation.StationName} MRT`,
        distance: 'Approx. 100-300m',
        travelMode: 'WALKING',
      }
    ];

    const markers = [
      { latitude: originCoords.lat, longitude: originCoords.lng, title: 'Start' },
      { latitude: originStation.Latitude, longitude: originStation.Longitude, title: originStation.StationName },
      { latitude: destinationStation.Latitude, longitude: destinationStation.Longitude, title: destinationStation.StationName },
      { latitude: destinationCoords.lat, longitude: destinationCoords.lng, title: 'Destination' },
    ];

    return [{
      summary: 'MRT Route',
      distance: 'Approximate',
      duration: 'Estimated',
      steps,
      polyline: [], // optional for now
      markers,
    }];
  } catch (error) {
    console.error('Error fetching MRT public transport route:', error);
    Alert.alert('Error', 'Failed to fetch MRT public route.');
    return [];
  }
};

export default P2PPublicTrans;
