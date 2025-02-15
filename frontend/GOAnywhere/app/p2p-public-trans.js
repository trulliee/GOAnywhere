import React, { useState } from "react";
import { View, TextInput, Button, StyleSheet } from "react-native";
import MapView, { Polyline, Marker } from "react-native-maps";
import axios from "axios";

const GOOGLE_MAPS_API_KEY = "AIzaSyDzdl-AzKqD_NeAdrz934cQM6LxWEHYF1g"; 

export default function TransportMap() {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [route, setRoute] = useState([]);
  const [markers, setMarkers] = useState([]);

  const fetchDirections = async () => {
    if (!origin || !destination) {
      alert("Please enter both origin and destination.");
      return;
    }

    // Convert locations into coordinates using Google Geocoding API
    const getCoordinates = async (address) => {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_API_KEY}`;
      const response = await axios.get(url);
      return response.data.results[0].geometry.location;
    };

    try {
      const originCoords = await getCoordinates(origin);
      const destinationCoords = await getCoordinates(destination);

      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${originCoords.lat},${originCoords.lng}&destination=${destinationCoords.lat},${destinationCoords.lng}&mode=transit&transit_mode=bus&key=${GOOGLE_MAPS_API_KEY}`;

      const response = await axios.get(url);
      const steps = response.data.routes[0].legs[0].steps;
      let polylineCoords = [];
      let busStops = [];

      steps.forEach((step) => {
        if (step.travel_mode === "TRANSIT") {
          busStops.push({
            latitude: step.start_location.lat,
            longitude: step.start_location.lng,
            title: `Bus Stop: ${step.transit_details.headsign}`,
          });
        }
        polylineCoords.push({
          latitude: step.start_location.lat,
          longitude: step.start_location.lng,
        });
        polylineCoords.push({
          latitude: step.end_location.lat,
          longitude: step.end_location.lng,
        });
      });

      setRoute(polylineCoords);
      setMarkers(busStops);
    } catch (error) {
      console.error("Error fetching directions:", error);
    }
  };

  return (
    <View style={styles.container}>
      {/* Input Fields for User to Enter Locations */}
      <TextInput
        style={styles.input}
        placeholder="Enter starting location"
        value={origin}
        onChangeText={setOrigin}
      />
      <TextInput
        style={styles.input}
        placeholder="Enter destination"
        value={destination}
        onChangeText={setDestination}
      />
      <Button title="Get Directions" onPress={fetchDirections} />

      {/* Map View */}
      <MapView
        provider="google"
        style={styles.map}
        initialRegion={{
          latitude: 37.7749, // Default to San Francisco
          longitude: -122.4194,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        {/* Draw the route */}
        <Polyline coordinates={route} strokeWidth={4} strokeColor="blue" />

        {/* Add bus stop markers */}
        {markers.map((marker, index) => (
          <Marker key={index} coordinate={marker} title={marker.title} />
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
    backgroundColor: "#fff",
  },
  input: {
    height: 40,
    borderColor: "gray",
    borderWidth: 1,
    marginBottom: 10,
    paddingHorizontal: 8,
    borderRadius: 5,
  },
  map: {
    flex: 1,
    width: "100%",
  },
});
