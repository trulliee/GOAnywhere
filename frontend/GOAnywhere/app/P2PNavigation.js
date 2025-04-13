// Modified P2PNavigation.js with working 'Start Navigation' logic
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Dimensions, TouchableWithoutFeedback,
  Keyboard, ScrollView, Modal
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import P2PPublicTrans from './P2PPublicTrans';
import P2PDriver from './P2PDriver';
import { useNavigation } from '@react-navigation/native';

const { height, width } = Dimensions.get('window');

const P2PNavigation = () => {
  const navigation = useNavigation();

  const [startLocation, setStartLocation] = useState('');
  const [endLocation, setEndLocation] = useState('');
  const [currentRegion, setCurrentRegion] = useState(null);
  const [routes, setRoutes] = useState({ driver: [], public: [] });
  const [activeTab, setActiveTab] = useState('driver');
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [bottomSheetVisible, setBottomSheetVisible] = useState(false);

  useEffect(() => {
    requestLocationPermission();
  }, []);

  const requestLocationPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    const location = await Location.getCurrentPositionAsync({});
    const { latitude, longitude } = location.coords;
    setCurrentRegion({
      latitude,
      longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
  };

  const handleSearchPaths = async () => {
    try {
      const driverRoutes = await P2PDriver(startLocation, endLocation);
      const publicRoutes = await P2PPublicTrans(startLocation, endLocation);
      setRoutes({ driver: driverRoutes || [], public: publicRoutes || [] });
      setBottomSheetVisible(true);
    } catch (error) {
      console.error('Error fetching paths:', error);
    }
  };

  const renderRouteOption = (route, index) => (
    <TouchableOpacity
      key={index}
      style={styles.routeOption}
      onPress={() => {
        setSelectedRoute(route);
        setModalVisible(true);
      }}>
      <Text style={styles.routeText}>Path {index + 1}: {route?.summary || 'Unnamed'} ({route?.duration}, {route?.distance})</Text>
    </TouchableOpacity>
  );

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        <MapView
          style={styles.map}
          region={currentRegion || {
            latitude: 1.3521,
            longitude: 103.8198,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}>
          {selectedRoute && selectedRoute.polyline && (
            <Polyline coordinates={selectedRoute.polyline} strokeWidth={4} strokeColor="blue" />
          )}
          {selectedRoute && selectedRoute.markers && selectedRoute.markers.map((marker, index) => (
            <Marker key={index} coordinate={marker} title={marker.title} />
          ))}
        </MapView>

        <View style={styles.topSection}>
          <TextInput
            style={styles.input}
            placeholder="Start Location"
            value={startLocation}
            onChangeText={setStartLocation}
          />
          <TextInput
            style={styles.input}
            placeholder="End Location"
            value={endLocation}
            onChangeText={setEndLocation}
          />
          <TouchableOpacity style={styles.searchButton} onPress={handleSearchPaths}>
            <Text style={styles.searchButtonText}>Search Path</Text>
          </TouchableOpacity>
        </View>

        {bottomSheetVisible && (
          <View style={styles.bottomSheet}>
            <View style={styles.tabRow}>
              <TouchableOpacity onPress={() => setActiveTab('driver')} style={[styles.tab, activeTab === 'driver' && styles.activeTab]}>
                <Text>Driver</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setActiveTab('public')} style={[styles.tab, activeTab === 'public' && styles.activeTab]}>
                <Text>Public Transport</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              {(routes[activeTab] || []).map((route, index) => renderRouteOption(route, index))}
            </ScrollView>
          </View>
        )}

        <Modal visible={modalVisible} transparent={true} animationType="slide">
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Route Details</Text>
              <ScrollView>
                <Text>Distance: {selectedRoute?.distance}</Text>
                <Text>Duration: {selectedRoute?.duration}</Text>
                {selectedRoute?.steps?.map((step, index) => (
                  <Text key={index}>
                    • {step.instruction.replace(/([a-z])([A-Z])/g, '$1\n$2')} ({step.distance})
                  </Text>
                ))}
              </ScrollView>
              <TouchableOpacity
                style={styles.startButton}
                onPress={() => {
                  setModalVisible(false);
                  if (activeTab === 'driver') {
                    navigation.navigate('DriverNavigator', {
                      polyline: selectedRoute.polyline,
                      steps: selectedRoute.steps,
                      markers: selectedRoute.markers,
                    });
                  } else {
                    navigation.navigate('PublicNavigator', {
                      polyline: selectedRoute.polyline,
                      steps: selectedRoute.steps,
                      markers: selectedRoute.markers,
                    });
                  }
                }}
              >
                <Text style={styles.startButtonText}>Start Navigation</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={{ marginTop: 10 }}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

      </View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { position: 'absolute', width: '100%', height: '100%' },
  topSection: {
    position: 'absolute', top: 10, alignSelf: 'center', width: '95%', backgroundColor: '#fff', padding: 10, borderRadius: 10
  },
  input: { backgroundColor: '#eee', padding: 10, marginBottom: 10, borderRadius: 5 },
  searchButton: { backgroundColor: '#000', padding: 12, borderRadius: 5 },
  searchButtonText: { color: '#fff', textAlign: 'center' },
  bottomSheet: {
    position: 'absolute', bottom: 0, width: '100%', backgroundColor: '#fff', borderTopLeftRadius: 15, borderTopRightRadius: 15, padding: 10, maxHeight: height * 0.4
  },
  tabRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 10 },
  tab: { padding: 10 },
  activeTab: { borderBottomWidth: 2 },
  routeOption: { padding: 10, borderBottomWidth: 1, borderColor: '#ccc' },
  routeText: { fontSize: 14 },
  modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', padding: 20, borderRadius: 10, width: '90%', maxHeight: '80%' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  startButton: { marginTop: 10, backgroundColor: '#007bff', padding: 10, borderRadius: 5 },
  startButtonText: { color: '#fff', textAlign: 'center' }
});

export default P2PNavigation;
