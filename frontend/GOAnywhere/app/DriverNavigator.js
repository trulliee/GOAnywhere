import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Modal,
  ScrollView,
  Animated,
  Easing
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import axios from 'axios';
import WarningIcon from '../assets/images/triangle-exclamation-solid.svg';
import haversine from 'haversine-distance';
import { useRoute } from '@react-navigation/native';

const { width, height } = Dimensions.get('window');
const GOOGLE_MAPS_API_KEY = "AIzaSyDzdl-AzKqD_NeAdrz934cQM6LxWEHYF1g";
const REPORT_CATEGORIES = [
  'Accident',
  'Road Works',
  'Traffic Police',
  'Weather',
  'Hazard',
  'Map Issue'
];

export default function DriverNavigator() {
  const route = useRoute();
  const { polyline, steps, markers } = route.params || {};

  const mapRef = useRef(null);
  const [location, setLocation] = useState(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [instructionText, setInstructionText] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [instructionSheetVisible, setInstructionSheetVisible] = useState(false);
  const sheetAnim = useRef(new Animated.Value(height)).current;

  const stepProximityThreshold = 50; // meters

  useEffect(() => {
    let sub;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 1 },
        loc => setLocation(loc.coords)
      );
    })();
    return () => sub && sub.remove();
  }, []);

  useEffect(() => {
    if (!location || !steps?.length) return;
    const nextStep = steps[currentStepIndex];
    const nextCoords = polyline && polyline[currentStepIndex + 1];
    if (nextCoords) {
      const dist = Math.round(haversine(location, nextCoords));
      if (dist < stepProximityThreshold && currentStepIndex < steps.length - 1) {
        setCurrentStepIndex(i => i + 1);
      }
      const raw = `${nextStep.instruction} in ${dist} m`;
      setInstructionText(raw.replace(/([a-z])([A-Z])/g, '$1, $2'));
    }
    const finalCoords = polyline?.[polyline.length - 1];
    if (finalCoords) {
      const distToEnd = Math.round(haversine(location, finalCoords));
      const arrivalThreshold = 30; // meters
      if (distToEnd < arrivalThreshold) {
        Alert.alert('Arrived!', 'You have reached your destination.');
        navigation.goBack();
      }
    }
  }, [location, currentStepIndex]);


  
  const submitReport = async category => {
    setModalVisible(false);
    if (!location) return;
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${location.latitude},${location.longitude}&key=${GOOGLE_MAPS_API_KEY}`;
    try {
      const res = await axios.get(url);
      const comps = res.data.results[0]?.address_components || [];
      const street = comps.find(c => c.types.includes('route'))?.long_name || 'Unknown Road';
      console.log(`${category} in ${street}`); //CHANGE THIS FOR THE REPORT
    } catch (e) {
      console.warn('Reverse geocode failed', e);
    }
  };

  const openInstructionSheet = () => {
    setInstructionSheetVisible(true);
    Animated.timing(sheetAnim, {
      toValue: 0,
      duration: 300,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true
    }).start();
  };

  const closeInstructionSheet = () => {
    Animated.timing(sheetAnim, {
      toValue: height,
      duration: 300,
      easing: Easing.in(Easing.ease),
      useNativeDriver: true
    }).start(() => setInstructionSheetVisible(false));
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

      {/* Instruction Box */}
      <TouchableOpacity style={styles.instructionBox} onPress={openInstructionSheet} activeOpacity={0.8}>
        <Text style={styles.currentInstruction}>{instructionText || 'Loading Driver Navigation...'}</Text>
        {steps[currentStepIndex + 1] && (
          <Text style={styles.nextInstruction}>
            {steps[currentStepIndex + 1].instruction.replace(/([a-z])([A-Z])/g, '$1, $2')}
          </Text>
        )}
      </TouchableOpacity>

      {/* Incident Report Button */}
      <TouchableOpacity style={styles.incidentButton} onPress={() => setModalVisible(true)}>
        <WarningIcon width={32} height={32} />
      </TouchableOpacity>

      {/* Report Sheet */}
      <Modal transparent animationType="slide" visible={modalVisible}>
        <View style={styles.modalOverlay}>
          <View style={styles.reportSheet}>
            <View style={styles.reportGrid}>
              {REPORT_CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={styles.reportCell}
                  onPress={() => submitReport(cat)}
                >
                  <Text style={styles.sheetText}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.cancelButton}>
              <Text style={[styles.sheetText, { color: 'red' }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Instruction Sheet */}
      {instructionSheetVisible && (
        <Animated.View style={[styles.instructionSheet, { transform: [{ translateY: sheetAnim }] }]}>
          <TouchableOpacity style={styles.closeButton} onPress={closeInstructionSheet}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
          <ScrollView>
            {steps.slice(currentStepIndex).map((step, idx) => (
              <Text
                key={idx}
                style={[
                  styles.sheetInstruction,
                  idx === 0 && styles.boldInstruction
                ]}
              >
                - {step.instruction.replace(/([a-z])([A-Z])/g, '$1, $2')}
              </Text>
            ))}
          </ScrollView>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: Dimensions.get('window').width, height: Dimensions.get('window').height },
  instructionBox: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(22, 22, 22, 0.9)',
    padding: 15,
    borderRadius: 10,
  },
  currentInstruction: { color: '#fff', fontSize: 17, fontWeight: 'bold', textAlign: 'center' },
  nextInstruction: { color: '#aaa', fontSize: 12, textAlign: 'center', marginTop: 4 },
  incidentButton: { position: 'absolute', top: 20, left: 20, backgroundColor: '#4A4A4A', padding: 10, borderRadius: 20, elevation: 5 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  reportSheet: { backgroundColor: '#fff', padding: 20, borderTopLeftRadius: 15, borderTopRightRadius: 15 },
  reportGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  reportCell: { width: '30%', padding: 10, marginVertical: 6, backgroundColor: '#eee', alignItems: 'center', borderRadius: 8 },
  sheetText: { fontSize: 14 },
  cancelButton: { marginTop: 10, alignItems: 'center' },
  instructionSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '50%',
    backgroundColor: '#000',
    padding: 20,
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
  },
  closeButton: { alignSelf: 'flex-end', padding: 8 },
  closeText: { color: '#fff', fontSize: 16 },
  sheetInstruction: { color: '#fff', fontSize: 16, marginVertical: 4 },
  boldInstruction: { fontWeight: 'bold' },
});
