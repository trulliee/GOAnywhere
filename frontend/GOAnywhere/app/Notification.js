import React, { useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet } from "react-native";
import { getIncidentNotifications } from "./IncidentData";
import { getUserAccountNotifications, getReportNotifications } from "./NotificationData";

const Notification = () => {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const combinedNotifications = [
      ...getIncidentNotifications(),
      ...getUserAccountNotifications(),
      ...getReportNotifications(),
    ];

    console.log("Final Notifications:", combinedNotifications); // Debugging
    setNotifications(combinedNotifications);
  }, []);

  const renderNotificationItem = ({ item }) => (
    <View style={styles.notificationBox}>
      <Text style={styles.notificationText}>{item[2]}</Text>
      <Text style={styles.notificationTime}>⏰ {item[4]}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Notifications</Text>
      {notifications.length === 0 ? (
        <Text style={styles.noNotifications}>No notifications available</Text>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item[0]}
          renderItem={renderNotificationItem}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#fff" },
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 16, textAlign: "center" },
  noNotifications: { fontSize: 14, color: "#777", textAlign: "center", marginBottom: 10 },
  notificationBox: { backgroundColor: "#f8f8f8", padding: 12, marginBottom: 8, borderRadius: 6, elevation: 2 },
  notificationText: { fontSize: 14, fontWeight: "bold" },
  notificationTime: { fontSize: 12, color: "#777", marginTop: 4 },
});

export default Notification;
