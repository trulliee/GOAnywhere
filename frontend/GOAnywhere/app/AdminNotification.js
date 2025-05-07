

import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Button, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const Notification = () => {
  const [notifications, setNotifications] = useState([]);
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    const exampleNotifications = [
      {
        id: 1,
        icon: 'car',
        iconColor: '#BC3535',
        title: 'Heavy Traffic Reported',
        message: 'Heavy traffic reported on PIE (Tuas bound)',
        timeCategory: 'today',
        type: 'driver',
        status: 'pending',
      },
      {
        id: 2,
        icon: 'car',
        iconColor: '#EEA039',
        title: 'Moderate Traffic Reported',
        message: 'Moderate traffic reported on PIE (Tuas bound)',
        timeCategory: 'today',
        type: 'public',
        status: 'accepted',
      },
      {
        id: 3,
        icon: 'rainy',
        iconColor: '#5C96E2',
        title: 'Bad Weather Reported',
        message: 'Flash Floods Reported along Upper Bukit Timah Road.',
        timeCategory: 'yesterday',
        type: 'public',
        status: 'flagged',
      },
      {
        id: 4,
        icon: 'alert-circle',
        iconColor: '#000000',
        title: 'Traffic Incident Reported',
        message: 'Accident reported along Upper Bukit Timah Road.',
        timeCategory: '2days',
        type: 'driver',
        status: 'pending',
      },
    ];
    setNotifications(exampleNotifications);
  }, []);

  const handleStatusChange = (id, newStatus) => {
    const updated = notifications.map((item) =>
      item.id === id ? { ...item, status: newStatus } : item
    );
    setNotifications(updated);
  };

  const renderCard = (item, index) => (
    <View key={index} style={styles.notificationCard}>
      <Ionicons name={item.icon} size={28} color={item.iconColor} style={{ marginRight: 12 }} />
      <View style={{ flex: 1 }}>
        <Text style={styles.notificationTitle}>{item.title}</Text>
        <Text style={styles.notificationMessage}>{item.message}</Text>
        <Text style={styles.notificationTime}>Type: {item.type} | Status: {item.status}</Text>
        <View style={styles.actionButtons}>
          <Button title="Accept" onPress={() => handleStatusChange(item.id, 'accepted')} />
          <Button title="Flag" onPress={() => handleStatusChange(item.id, 'flagged')} color="#D9534F" />
        </View>
      </View>
    </View>
  );

  const grouped = {
    today: [],
    yesterday: [],
    '2days': [],
  };

  notifications
    .filter((n) => (filterType === 'all' || n.type === filterType) && (filterStatus === 'all' || n.status === filterStatus))
    .forEach((notif) => {
      if (grouped[notif.timeCategory]) {
        grouped[notif.timeCategory].push(notif);
      }
    });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Traffic Incidents</Text>

      <View style={styles.filterContainer}>
        <Text>Filter Type:</Text>
        {['all', 'driver', 'public'].map((type) => (
          <TouchableOpacity key={type} onPress={() => setFilterType(type)} style={styles.filterBtn}>
            <Text style={{ color: filterType === type ? 'blue' : '#000' }}>{type}</Text>
          </TouchableOpacity>
        ))}
        <Text>Filter Status:</Text>
        {['all', 'pending', 'accepted', 'flagged'].map((status) => (
          <TouchableOpacity key={status} onPress={() => setFilterStatus(status)} style={styles.filterBtn}>
            <Text style={{ color: filterStatus === status ? 'blue' : '#000' }}>{status}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.notificationContainer}>
        {grouped.today.length > 0 && (
          <>
            <Text style={styles.sectionHeader}>Today</Text>
            {grouped.today.map((item, index) => renderCard(item, index))}
          </>
        )}
        {grouped.yesterday.length > 0 && (
          <>
            <Text style={styles.sectionHeader}>Yesterday</Text>
            {grouped.yesterday.map((item, index) => renderCard(item, index))}
          </>
        )}
        {grouped['2days'].length > 0 && (
          <>
            <Text style={styles.sectionHeader}>2 Days Ago</Text>
            {grouped['2days'].map((item, index) => renderCard(item, index))}
          </>
        )}
      </ScrollView>
    </View>
  );
};

export default Notification;

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
  sectionHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    marginTop: 20,
    color: '#555',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginTop: 10,
    gap: 10,
  },
});