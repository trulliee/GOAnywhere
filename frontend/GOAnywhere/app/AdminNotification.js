import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from './utils/apiConfig';

const GOOGLE_MAPS_API_KEY = 'AIzaSyDHIQoHjcVR0RsyKG-U5myMIpdPqK6n-m0';

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
        const res    = await fetch(`${API_URL}/admin/alert-notifications`);
        const data   = await res.json();
        const notifs = data.notifications || [];

        const enriched = await Promise.all(
          notifs.map(async (item) => {
            // parse coords and reverse-geocode
            const match = item.message.match(/\(\s*([^,]+),\s*([^)]+)\s*\)/);
            let roadName = 'Unknown Road';
            if (match) {
              const lat = parseFloat(match[1]);
              const lng = parseFloat(match[2]);
              roadName = await fetchStreetName(lat, lng);
            }
            return {
              id:        item.id,
              icon:      item.type === 'High Crowd' ? 'people' : 'alert-circle',
              iconColor: item.type === 'High Crowd' ? '#BC3535' : '#EEA039',
              title:     item.type,
              message:   `${item.username} reported ${item.type} on ${roadName}`,
              timestamp: item.timestamp,
              type:      'public',
            };
          })
        );
        setNotifications(enriched);
      } catch (err) {
        console.error('Failed to load reports:', err);
      }
    })();
  }, []);

  const renderCard = (item) => (
    <View key={item.id} style={styles.notificationCard}>
      <Ionicons name={item.icon} size={28} color={item.iconColor} style={{ marginRight: 12 }} />
      <View style={{ flex: 1 }}>
        <Text style={styles.notificationTitle}>{item.title}</Text>
        <Text style={styles.notificationMessage}>{item.message}</Text>
        <Text style={styles.notificationTime}>{formatRelativeTime(item.timestamp)}</Text>
      </View>
    </View>
  );

  const filtered = notifications.filter(
    (n) => filterType === 'all' || n.type === filterType
  );

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
