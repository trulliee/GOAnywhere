import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons, FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import { API_URL } from './utils/apiConfig';

const GOOGLE_MAPS_API_KEY = 'AIzaSyDHIQoHjcVR0RsyKG-U5myMIpdPqK6n-m0';

const iconMap = {
  Accident:        { lib: FontAwesome5,  name: 'car-crash',            color: '#e53935' },
  'Road Works':    { lib: FontAwesome5,  name: 'hard-hat',             color: '#e53935' },
  'Traffic Police':          { lib: FontAwesome5,  name: 'user-secret',          color: '#4caf50' },
  Weather:         { lib: FontAwesome5,  name: 'cloud',                color: '#4caf50' },
  Hazard:          { lib: FontAwesome5,  name: 'exclamation-triangle', color: '#e53935' },
  'Map Issue':     { lib: FontAwesome5,  name: 'map-marked',           color: '#ffeb3b' },
  'Transit Works': { lib: FontAwesome5,  name: 'train',                color: '#e53935' },
  'High Crowd':    { lib: MaterialIcons, name: 'people',               color: '#ffeb3b' },
  Delays:          { lib: FontAwesome5,  name: 'hand-paper',           color: '#4caf50' },
};

async function fetchStreetName(lat, lng) {
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`
    );
    const json  = await res.json();
    const comps = json.results?.[0]?.address_components || [];
    return (
      comps.find(c => c.types.includes('route'))?.long_name ||
      'Unknown Road'
    );
  } catch {
    return 'Unknown Road';
  }
}

function formatRelativeTime(timestamp) {
  const time = new Date(Number(timestamp));
  const now  = new Date();
  const diff = now - time; // ms
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return time.toLocaleDateString() + ' ' + time.toLocaleTimeString();
}

export default function Notification() {
  const [notifications, setNotifications] = useState([]);
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    (async () => {
      try {
        const res    = await fetch(`${API_URL}/crowd/get-crowd-data`);
        const data   = await res.json();
        const notifs = data.reports || [];

        const enriched = await Promise.all(
          notifs.map(async (item) => {
            const lat  = item.latitude;
            const lng  = item.longitude;
            let road   = 'Unknown Road';
            if (lat != null && lng != null) {
              road = await fetchStreetName(lat, lng);
            }

            return {
              id:           item.id,
              userName:     item.username,
              userId:       item.user_id,
              reportType:   item.type,
              locationName: road,
              coordinate:   `(${lat}, ${lng})`,

              IconComponent: iconMap[item.type]?.lib   || Ionicons,
              iconName:      iconMap[item.type]?.name  || 'alert-circle',
              iconColor:     iconMap[item.type]?.color || '#000',

              timestamp:    item.timestamp,
              type:         'public',
            };
          })
        );

        enriched.sort((a, b) => Number(b.timestamp) - Number(a.timestamp));
        setNotifications(enriched);
      } catch (err) {
        console.error('Failed to load reports:', err);
      }
    })();
  }, []);



  const renderCard = (item) => (
    <View key={item.id} style={styles.notificationCard}>
      <item.IconComponent
        name={item.iconName}
        size={28}
        color={item.iconColor}
        style={{ marginRight: 12 }}
      />
      <View style={{ flex: 1 }}>
        {/* 1️⃣ USER - (User ID) */}
        <Text style={styles.notificationTitle}>
          Username: {item.userName}
        </Text>
        <Text style={styles.notificationMessage}>
          UID: {item.userId}
        </Text>
        {/* 2️⃣ Report Type */}
        <Text style={styles.notificationMessage}>
          Report Type: {item.reportType}
        </Text>
        {/* 3️⃣ Location */}
        <Text style={styles.notificationMessage}>
          Location: {item.locationName},
        </Text>
        {/* 4️⃣ Coordinate */}
        <Text style={styles.notificationMessage}>
          Coordinate: {item.coordinate}
        </Text>
        {/* timestamp */}
        <Text style={styles.notificationTime}>
          {formatRelativeTime(item.timestamp)}
        </Text>
      </View>
    </View>
  );

  const filtered = notifications.filter(n => {
    if (filterType === 'all') {
      return true;
    }
    if (filterType === 'driver') {
      // driver mode: exclude Transit Works, High Crowd, Delays
      return !['Transit Works', 'High Crowd', 'Delays'].includes(n.reportType);
    }
    if (filterType === 'public') {
      // public mode: exclude Road Works, Traffic Police
      return !['Road Works', 'Traffic Police'].includes(n.reportType);
    }
    return true;
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Traffic Incidents</Text>

      <View style={styles.filterContainer}>
        <Text>Filter Type:</Text>
        {['all', 'driver', 'public'].map((type) => (
          <TouchableOpacity
            key={type}
            onPress={() => setFilterType(type)}
            style={styles.filterBtn}
          >
            <Text style={{ color: filterType === type ? 'blue' : '#000' }}>{type}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.notificationContainer}>
        {filtered.map((item) => renderCard(item))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    paddingTop: 50,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  filterContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
    gap: 10,
  },
  filterBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderRadius: 6,
    marginRight: 5,
  },
  notificationContainer: {
    paddingBottom: 20,
  },
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: '#f6f6f6',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    alignItems: 'center',
  },
  notificationTitle: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 3,
  },
  notificationMessage: {
    fontSize: 14,
    color: '#333',
  },
  notificationTime: {
    fontSize: 12,
    color: '#777',
    marginTop: 5,
  },
});
