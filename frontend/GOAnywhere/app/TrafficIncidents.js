import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import axios from 'axios';
import moment from 'moment';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';

const ICON_MAP = {
  'Accident': <MaterialIcons name="car-crash" size={20} color="#e74c3c" />,
  'Road Block': <Ionicons name="warning" size={20} color="#f39c12" />,
  'Vehicle breakdown': <FontAwesome5 name="car" size={20} color="#bdc3c7" />,
  'Obstacle': <MaterialIcons name="block" size={20} color="#c0392b" />,
  'Reverse Flow': <Ionicons name="sync" size={20} color="#3498db" />,
  'Default': <Ionicons name="alert-circle-outline" size={20} color="#7f8c8d" />,
};

const getIcon = (type) => ICON_MAP[type] || ICON_MAP['Default'];

const TrafficIncidents = () => {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchIncidents = async () => {
      try {
        const response = await axios.get('https://goanywhere-backend-541900038032.asia-southeast1.run.app'); // 👈 Change to your Cloud Run URL for production
        setIncidents(response.data.incidents);
      } catch (error) {
        console.error('Error fetching traffic incidents:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchIncidents();
  }, []);

  const categorizeByDate = () => {
    const today = moment().startOf('day');
    const yesterday = moment().subtract(1, 'days').startOf('day');

    const grouped = {
      Today: [],
      Yesterday: [],
      'Older': [],
    };

    incidents.forEach(incident => {
      const ts = moment(incident.parsed_timestamp);
      if (ts.isSame(today, 'day')) grouped.Today.push(incident);
      else if (ts.isSame(yesterday, 'day')) grouped.Yesterday.push(incident);
      else grouped['Older'].push(incident);
    });

    return grouped;
  };

  const grouped = categorizeByDate();

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#3498db" />
        <Text style={styles.loadingText}>Loading incidents...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {Object.entries(grouped).map(([label, items]) => (
        <View key={label}>
          <Text style={styles.sectionTitle}>{label}</Text>
          {items.map((incident) => (
            <View key={incident.id} style={styles.card}>
              <View style={styles.icon}>{getIcon(incident.Type)}</View>
              <View>
                <Text style={styles.cardTitle}>{incident.Type || 'Traffic Incident'}</Text>
                <Text style={styles.cardText}>{incident.Message}</Text>
              </View>
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { padding: 12, backgroundColor: '#121212' },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginVertical: 10 },
  card: {
    backgroundColor: '#1e1e1e',
    flexDirection: 'row',
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
    alignItems: 'center',
  },
  icon: { marginRight: 12 },
  cardTitle: { color: '#fff', fontSize: 14, fontWeight: '600' },
  cardText: { color: '#ccc', fontSize: 13 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
  loadingText: { marginTop: 8, color: '#999' },
});

export default TrafficIncidents;