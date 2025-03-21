// app/index.tsx
import React, { useEffect, useState } from 'react';
import { Text, View, StyleSheet, Button, ActivityIndicator } from 'react-native';
import { useRouter } from "expo-router";
import { useNavigation } from '@react-navigation/native';
import AuthService from './authService';

export default function Index() {
  const navigation = useNavigation();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
    
    // Check if user is already authenticated
    async function checkAuth() {
      try {
        const userData = await AuthService.getCurrentUser();
        setUser(userData);
        setLoading(false);
      } catch (error) {
        console.error('Auth check error:', error);
        setLoading(false);
      }
    }
    
    checkAuth();
  }, [navigation]);

  const handleLogout = async () => {
    await AuthService.logout();
    setUser(null);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#3498db" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Welcome to GoAnywhere</Text>
      <Button title="Login" onPress={() => router.push("./loginUser")} />
      <Button title="Go to New Home Screen" onPress={() => router.push("./home")} />
      <Button title="Go to P2P Navigation" onPress={() => router.push("./P2PNavigation")} />
      <Button title="Go to Dashboard" onPress={() => router.push("./dashboard")} />
      <Button title="Go to Traffic Incidents" onPress={() => router.push("./TrafficIncidentsNav")} />
      <Button title="Go to Traffic Prediction" onPress={() => router.push("./TrafficPrediction")} />
      <Button title="Go to Notification" onPress={() => router.push("./Notification")} />

      
      {/* Optional: Show a different view if user is logged in */}
      {user && (
        <View style={styles.userInfo}>
          <Text style={styles.userText}>Logged in as: {user.email || 'Anonymous'}</Text>
          <Button 
            title="Logout" 
            onPress={handleLogout} 
            color="#ff6347"
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#25292e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: '#fff',
    fontSize: 18,
    marginBottom: 10,
  },
  userInfo: {
    marginTop: 20,
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 5,
    alignItems: 'center',
  },
  userText: {
    color: '#fff',
    marginBottom: 10,
  }
});