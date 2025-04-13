
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const Notification = () => {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const exampleNotifications = [
      {
        id: 1,
        icon: 'car',
        iconColor: '#BC3535',
        title: 'Heavy Traffic Reported',
        message: 'Heavy traffic reported on PIE (Tuas bound)',
        timeCategory: 'today',
      },
      {
        id: 2,
        icon: 'car',
        iconColor: '#EEA039',
        title: 'Moderate Traffic Reported',
        message: 'Moderate traffic reported on PIE (Tuas bound)',
        timeCategory: 'today',
      },
      {
        id: 3,
        icon: 'rainy',
        iconColor: '#5C96E2',
        title: 'Bad Weather Reported',
        message: 'Flash Floods Reported along Upper Bukit Timah Road.',
        timeCategory: 'yesterday',
      },
      {
        id: 4,
        icon: 'alert-circle',
        iconColor: '#000000',
        title: 'Traffic Incident Reported',
        message: 'Accident reported along Upper Bukit Timah Road.',
        timeCategory: '2days',
      },
      {
        id: 5,
        icon: 'alert-circle',
        iconColor: '#000000',
        title: 'Traffic Incident Reported',
        message: 'Accident reported along Upper Bukit Timah Road.',
        timeCategory: '2days',
      },
      {
        id: 6,
        icon: 'alert-circle',
        iconColor: '#000000',
        title: 'Traffic Incident Reported',
        message: 'Accident reported along Upper Bukit Timah Road.',
        timeCategory: '2days',
      },
      {
        id: 7,
        icon: 'alert-circle',
        iconColor: '#000000',
        title: 'Traffic Incident Reported',
        message: 'Accident reported along Upper Bukit Timah Road.',
        timeCategory: '2days',
      },
    ];
    setNotifications(exampleNotifications);
  }, []);

  const renderCard = (item, index) => (
    <View key={index} style={styles.notificationCard}>
      <Ionicons name={item.icon} size={28} color={item.iconColor} style={{ marginRight: 12 }} />
      <View style={{ flex: 1 }}>
        <Text style={styles.notificationTitle}>{item.title}</Text>
        <Text style={styles.notificationMessage}>{item.message}</Text>
      </View>
    </View>
  );

  const grouped = {
    today: [],
    yesterday: [],
    '2days': [],
  };

  notifications.forEach((notif) => {
    if (grouped[notif.timeCategory]) {
      grouped[notif.timeCategory].push(notif);
    }
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Notifications</Text>
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
    marginBottom: 20,
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
  sectionHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    marginTop: 20,
    color: '#555',
  },
});