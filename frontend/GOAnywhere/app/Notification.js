import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const Notification = () => {
  const router = useRouter();
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
        iconColor: '#9de3d2',
        title: 'Traffic Incident Reported',
        message: 'Accident reported along Upper Bukit Timah Road.',
        timeCategory: '2days',
      },
      {
        id: 5,
        icon: 'alert-circle',
        iconColor: '#9de3d2',
        title: 'Traffic Incident Reported',
        message: 'Accident reported along Upper Bukit Timah Road.',
        timeCategory: '2days',
      },
      {
        id: 6,
        icon: 'alert-circle',
        iconColor: '#9de3d2',
        title: 'Traffic Incident Reported',
        message: 'Accident reported along Upper Bukit Timah Road.',
        timeCategory: '2days',
      },
      {
        id: 7,
        icon: 'alert-circle',
        iconColor: '#9de3d2',
        title: 'Traffic Incident Reported',
        message: 'Accident reported along Upper Bukit Timah Road.',
        timeCategory: '2days',
      },
    ];
    setNotifications(exampleNotifications);
  }, []);

  const handleGoBack = () => {
    router.back();
  };

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
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView 
        style={styles.scrollContainer}
        contentContainerStyle={styles.notificationContainer}
      >
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
    </SafeAreaView>
  );
};

export default Notification;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#333',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    paddingBottom: 15,
    paddingHorizontal: 20,
    backgroundColor: '#333',
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerRight: {
    width: 30,
  },
  scrollContainer: {
    flex: 1,
    backgroundColor: '#333',
  },
  notificationContainer: {
    padding: 15,
    paddingBottom: 30,
  },
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: '#444',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    alignItems: 'center',
  },
  notificationTitle: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 3,
    color: '#fff',
  },
  notificationMessage: {
    fontSize: 14,
    color: '#ccc',
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 10,
    marginTop: 20,
    color: '#888',
  },
});