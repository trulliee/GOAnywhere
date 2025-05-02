// app/index.tsx
import React, { useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from "expo-router";

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    // Simple redirection to the signup page
    const timer = setTimeout(() => {
      router.replace('./loginUser');
    }, 300);
    
    return () => clearTimeout(timer);
  }, [router]);

  // Only show loading screen while preparing to redirect
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#9de3d2" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  }
});