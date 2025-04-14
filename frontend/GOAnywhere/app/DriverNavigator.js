// DriverNavigator.js
import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { Magnetometer } from 'expo-sensors';
import haversine from 'haversine-distance';
import { useRoute } from '@react-navigation/native';

const { width, height } = Dimensions.get('window');

const DriverNavigator = () => {
  const route = useRoute();
  const { polyline, steps, markers } = route.params || {};

  const mapRef = useRef(null);
  const [location, setLocation] = useState(null);
  const [heading, setHeading] = useState(0);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [instructionText, setInstructionText] = useState('');

  const stepProximityThreshold = 60; // meters

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        alert('Permission to access location was denied');
        return;
      }

      Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 1,
        },
        (loc) => setLocation(loc.coords)
      );
    })();

    const subscription = Magnetometer.addListener((data) => {
      let angle = Math.atan2(data.y, data.x) * (180 / Math.PI);
      setHeading(angle >= 0 ? angle : angle + 360);
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!location || !steps?.length) return;

    const nextStep = steps[currentStepIndex];
    const nextCoords = getNextStepCoords(nextStep);

    if (nextCoords) {
      const distance = haversine(location, nextCoords);
      if (distance < stepProximityThreshold && currentStepIndex < steps.length - 1) {
        setCurrentStepIndex((i) => i + 1);
      }
    }

    if (nextStep && nextCoords) {
      const dist = Math.round(haversine(location, nextCoords));
      setInstructionText(`${nextStep.instruction} in ${dist}m`);
    }
  }, [location, currentStepIndex]);

  const getNextStepCoords = (step) => {
    if (step?.transitInfo?.arrivalStopLat && step?.transitInfo?.arrivalStopLng) {
      return {
        latitude: step.transitInfo.arrivalStopLat,
        longitude: step.transitInfo.arrivalStopLng,
      };
    }
    // Fallback: find next point in polyline
    return polyline?.[currentStepIndex + 1];
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        showsUserLocation={true}
        followsUserLocation={true}
        region={
          location
            ? {
                latitude: location.latitude,
                longitude: location.longitude,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
              }
            : undefined
        }
      >
        {polyline?.length > 0 && (
          <Polyline coordinates={polyline} strokeWidth={5} strokeColor="blue" />
        )}
        {markers?.map((marker, index) => (
          <Marker key={index} coordinate={marker} title={marker.title} />
        ))}
      </MapView>

      <View style={styles.instructionBox}>
        <Text style={styles.instructionText}>{instructionText || 'Loading navigation...'}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width,
    height,
  },
  instructionBox: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: '#000',
    padding: 15,
    borderRadius: 10,
    opacity: 0.9,
  },
  instructionText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
  },
});

export default DriverNavigator;
