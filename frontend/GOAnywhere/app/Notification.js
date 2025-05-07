import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const Notification = () => {
  const router = useRouter();
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const accountNotifications = [
      {
        id: 1,
        icon: 'person-circle',
        iconColor: '#4CD964', // Green
        title: 'Username Updated',
        message: 'Your username has been successfully updated.',
        timeCategory: 'today',
      },
      {
        id: 2,
        icon: 'mail',
        iconColor: '#4CD964', // Green
        title: 'Email Updated',
        message: 'Your email address has been successfully changed.',
        timeCategory: 'today',
      },
      {
        id: 3,
        icon: 'lock-closed',
        iconColor: '#4CD964', // Green
        title: 'Password Changed',
        message: 'Your password has been successfully updated.',
        timeCategory: 'yesterday',
      },
      {
        id: 4,
        icon: 'call',
        iconColor: '#4CD964', // Green
        title: 'Mobile Number Updated',
        message: 'Your mobile number has been successfully updated.',
        timeCategory: 'yesterday',
      },
      {
        id: 5,
        icon: 'warning',
        iconColor: '#FF3B30', // Red
        title: 'Account Warning',
        message: 'Your account has received a warning for violating our terms of service.',
        timeCategory: '2days',
      },
      {
        id: 6,
        icon: 'notifications',
        iconColor: '#FF9500', // Orange
        title: 'Notification Settings Updated',
        message: 'Your notification preferences have been updated.',
        timeCategory: '2days',
      },
    ];
    setNotifications(accountNotifications);
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