import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Modal } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import P2PDriver from './P2PDriver';

const P2PDriverNavi = ({ startLocation, endLocation }) => {
  const navigation = useNavigation();
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  const searchDriverPaths = async () => {
    const foundRoutes = await P2PDriver(startLocation, endLocation);
    setRoutes(foundRoutes || []);
  };

  return (
    <View>
      <TouchableOpacity style={styles.searchButton} onPress={searchDriverPaths}>
        <Text style={styles.searchButtonText}>Search Driver Paths</Text>
      </TouchableOpacity>

      <ScrollView>
        {routes.map((route, index) => (
          <TouchableOpacity
            key={index}
            style={styles.routeOption}
            onPress={() => {
              setSelectedRoute(route);
              setModalVisible(true);
            }}
          >
            <Text>Driver Path {index + 1}: {route?.summary || 'Unnamed'} ({route?.duration})</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modal}>
          <ScrollView>
            {selectedRoute?.steps?.map((step, idx) => (
              <Text key={idx}>• {step.instruction} ({step.distance})</Text>
            ))}
          </ScrollView>
          <TouchableOpacity
            style={styles.startButton}
            onPress={() => {
              setModalVisible(false);
              navigation.navigate('DriverNavigator', {
                polyline: selectedRoute.polyline,
                steps: selectedRoute.steps,
                markers: selectedRoute.markers,
              });
            }}
          >
            <Text style={{ color: '#fff' }}>Start Navigation</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setModalVisible(false)}>
            <Text style={{ marginTop: 10, textAlign: 'center' }}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  searchButton: { backgroundColor: '#000', padding: 10, borderRadius: 5, marginVertical: 5 },
  searchButtonText: { color: '#fff', textAlign: 'center' },
  routeOption: { padding: 10, borderBottomWidth: 1, borderColor: '#ccc' },
  modal: { flex: 1, backgroundColor: 'white', margin: 30, padding: 20, borderRadius: 10 },
  startButton: { marginTop: 10, backgroundColor: '#007bff', padding: 10, borderRadius: 5, alignItems: 'center' },
});

export default P2PDriverNavi;
