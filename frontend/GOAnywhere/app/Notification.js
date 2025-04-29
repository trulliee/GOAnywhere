import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { getReportNotifications, markAllReportNotificationsRead } from './NotificationData';

const Notification = () => {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const reportNotifications = getReportNotifications(); 
    setNotifications(reportNotifications); 
  }, []);

  useFocusEffect(
    React.useCallback(() => {
  
      return () => {
        markAllReportNotificationsRead();
  
        setNotifications((prevNotifications) =>
          prevNotifications.map((n) => ({ ...n, read: true }))
        );
      };
    }, [])
  );

  const renderCard = (item, index) => (
    <View key={index} style={styles.notificationCard}>
      {!item.read && <View style={styles.unreadDot} />}
      <Ionicons name={item.icon} size={28} color={item.iconColor} style={{ marginRight: 12 }} />
      <View style={{ flex: 1 }}>
        <Text style={styles.notificationTitle}>{item.title}</Text>
        <Text style={styles.notificationMessage}>{item.message}</Text>
      </View>
    </View>
  );

  const grouped = { today: [], yesterday: [], '2days': [] };
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
  unreadDot: {
    position: 'absolute',
    top: 2,
    left: 2,
    width: 12,
    height: 12,
    borderRadius: 8,
    backgroundColor: 'red',
    zIndex: 10,
  },
});


export default Notification;
