import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity
} from 'react-native';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { API_URL } from './utils/apiConfig';
// Google API key for reverse geocoding
const GOOGLE_MAPS_API_KEY = 'AIzaSyDHIQoHjcVR0RsyKG-U5myMIpdPqK6n-m0';

// helper to reverse‐geocode coordinates to a road name
async function fetchStreetName(lat, lng) {
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`
    );
    const json = await res.json();
    const comps = json.results?.[0]?.address_components || [];
    return (
      comps.find(c => c.types.includes('route'))?.long_name ||
      'Unknown Road'
    );
  } catch {
    return 'Unknown Road';
  }
}


const iconMap = {
  Accident:       { lib: FontAwesome5, name: 'car-crash',       color: '#e53935' }, // red
  'Road Works':   { lib: FontAwesome5, name: 'hard-hat',        color: '#e53935' }, // red
  'Traffic Police':         { lib: FontAwesome5, name: 'user-secret',     color: '#4caf50' }, // green
  Weather:        { lib: FontAwesome5, name: 'cloud',           color: '#4caf50' }, // green
  Hazard:         { lib: FontAwesome5, name: 'exclamation-triangle', color: '#e53935' }, // red
  'Map Issue':    { lib: FontAwesome5, name: 'map-marked',      color: '#ffeb3b' }, // yellow
  'Transit Works':{ lib: FontAwesome5, name: 'train',           color: '#e53935' }, // red
  'High Crowd':   { lib: MaterialIcons, name: 'people',         color: '#ffeb3b' }, // yellow
  Delays:         { lib: FontAwesome5, name: 'hand-paper',      color: '#4caf50' }, // green
};

export default function CrowdReportList() {
  const navigation = useNavigation();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res      = await fetch(`${API_URL}/crowd/get-crowd-data`);
        const data     = await res.json();
        const reports  = data.reports || [];

        const enriched = await Promise.all(
          reports.map(async item => {
            const { latitude: lat, longitude: lng } = item;
            let roadName = 'Unknown Road';

            // reverse-geocode
            if (lat != null && lng != null) {
              roadName = await fetchStreetName(lat, lng);
            }

            return {
              ...item,
              // compose same style message
              message: `${item.type} reported by ${item.username} at ${roadName}`
            };
          })
        );

        enriched.sort(
          (a, b) => parseInt(b.timestamp, 10) - parseInt(a.timestamp, 10)
        );

        setReports(enriched);
      } catch (err) {
        console.error('Failed to load reports:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);


  const renderItem = ({ item }) => {
    const IconData = iconMap[item.type] || { lib: Ionicons, name: 'alert-circle' };
    const IconComponent = IconData.lib;

    return (
      <View style={styles.card}>
        <IconComponent
          name={IconData.name}
          size={24}
          color={IconData.color}
          style={styles.icon}
        />
        <View style={styles.textContainer}>
          <Text style={styles.type}>{item.type}</Text>
          <Text style={styles.metaText}>{item.message}</Text>
          <Text style={styles.time}>
            {new Date(parseInt(item.timestamp, 10)).toLocaleString()}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerText}>Crowdsourced Reports</Text>
        <View style={{ width: 24 }} />
      </View>
      {loading ? (
        <ActivityIndicator size="large" color="#000" style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(item, index) => index.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    backgroundColor: '#393939',
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 16,
    justifyContent: 'space-between'
  },
  backBtn: { padding: 4 },
  headerText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  listContainer: { padding: 16 },
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 12,
    marginBottom: 12,
    borderRadius: 10,
    elevation: 2,
    alignItems: 'center'
  },
  icon: { marginRight: 12 },
  textContainer: { flex: 1 },
  type: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  metaText: { color: '#777', fontSize: 13, marginTop: 2 },
  time: {
    fontSize: 12,
    color: '#555',
    marginTop: 4,
  },
});