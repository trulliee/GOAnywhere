import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { fetchAPI } from './utils/apiConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';

const Notification = () => {
  const router = useRouter();
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const userInfo = await AsyncStorage.getItem('user_info');
        const { uid } = JSON.parse(userInfo);  // ✅ gets correct UID
        const backendData = await fetchAPI(`/notifications/account/${uid}`);

        const mapped = backendData.map((item, index) => ({
          id: index + 1,
          icon: 'notifications',
          iconColor: '#4CD964',
          title: item.title,
          message: item.message,
          timeCategory: 'today',
        }));
        // pull our local weather-driven notifications:
        const localJson    = await AsyncStorage.getItem('local_notifications');
        const localNotifs  = localJson ? JSON.parse(localJson) : [];
        const fav = await AsyncStorage.getItem('favorite_location');
        const favoriteId = fav ? JSON.parse(fav) : null;
        const filteredLocal = favoriteId
          ? localNotifs.filter(n => n.areaId === favoriteId)
           : [];
        // combine newest first:
        const combined = [...filteredLocal, ...mapped];
        setNotifications(combined);
      } catch (error) {
        console.error("Error loading notifications:", error);
      }
    };

    loadNotifications();
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
        <Text style={styles.headerTitle}>Account Notifications</Text>
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