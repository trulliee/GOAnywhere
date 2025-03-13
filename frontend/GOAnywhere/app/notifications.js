import React, { useEffect, useState, useRef } from "react";
import { View, Text, Button, FlatList, StyleSheet } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";

export default function App() {
  const [notifications, setNotifications] = useState([]);
  const notificationListener = useRef();

  // Request Notification Permissions
  useEffect(() => {
    async function registerForPushNotifications() {
      if (Device.isDevice) {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== "granted") {
          alert("Permission for notifications was denied!");
          return;
        }
      } else {
        alert("Push notifications are only available on real devices.");
      }
    }

    registerForPushNotifications();

    // Listen for incoming notifications
    notificationListener.current =
      Notifications.addNotificationReceivedListener((notification) => {
        setNotifications((prev) => [
          { id: Date.now().toString(), ...notification.request.content },
          ...prev,
        ]);
      });

    return () => {
      Notifications.removeNotificationSubscription(notificationListener.current);
    };
  }, []);

  // Simulate a Notification (For Testing)
  const sendTestNotification = async () => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "New Notification! 🚀",
        body: "This is a test notification.",
        data: { extra: "Some additional data" },
      },
      trigger: null, // Instant notification
    });
  };

  return (
    <View style={styles.container}>
      <Button title="Send Test Notification" onPress={sendTestNotification} />

      <Text style={styles.header}>Notifications</Text>
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.notification}>
            <Text style={styles.title}>{item.title}</Text>
            <Text>{item.body}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#fff" },
  header: { fontSize: 18, fontWeight: "bold", marginVertical: 10 },
  notification: { padding: 15, borderBottomWidth: 1, borderBottomColor: "#ddd" },
  title: { fontSize: 16, fontWeight: "bold" },
});
