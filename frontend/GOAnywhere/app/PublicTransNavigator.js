import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import haversine from 'haversine-distance';
import { useRoute } from '@react-navigation/native';

const { width, height } = Dimensions.get('window');

const PublicTransNavigator = () => {
  const route = useRoute();
  const { polyline, steps, markers } = route.params || {};

  const mapRef = useRef(null);
  const [location, setLocation] = useState(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [instructionText, setInstructionText] = useState('');

  const stepProximityThreshold = 50; // meters

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        alert('Permission to access location was denied');
        return;
      }

      Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 1 },
        loc => setLocation(loc.coords)
      );
    })();
  }, []);

  useEffect(() => {
    if (!location || !steps?.length) return;

    const nextStep = steps[currentStepIndex];
    const nextCoords = getNextStepCoords(currentStepIndex);

    if (nextCoords) {
      const distance = Math.round(haversine(location, nextCoords));
      if (distance < stepProximityThreshold && currentStepIndex < steps.length - 1) {
        setCurrentStepIndex(i => i + 1);
      }
      setInstructionText(`${nextStep.instruction} in ${distance} m`);
    }
  }, [location, currentStepIndex]);

  const getNextStepCoords = (index) => {
    // Use polyline points to guide through transit path
    if (polyline && polyline.length > index + 1) {
      return polyline[index + 1];
    }
    return null;
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        showsUserLocation
        followsUserLocation
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
          <Polyline coordinates={polyline} strokeWidth={4} strokeColor="#0066CC" />
        )}
        {markers?.map((m, i) => (
          <Marker key={i} coordinate={m} title={m.title} />
        ))}
      </MapView>

      <View style={styles.instructionBox}>
        <Text style={styles.instructionText}>
          {instructionText || 'Loading transit navigation...'}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width, height },
  instructionBox: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 12,
    borderRadius: 8,
  },
  instructionText: { color: '#fff', fontSize: 16, textAlign: 'center' },
});

export default PublicTransNavigator;
