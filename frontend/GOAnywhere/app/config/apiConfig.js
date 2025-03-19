// app/config/apiConfig.js
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Get the local IP from Expo if available
const getApiBaseUrl = () => {
  // For development
  if (__DEV__) {
    // If running on a physical device through Expo
    const hostUri = Constants.expoConfig?.hostUri;
    if (hostUri) {
      // Extract IP address from hostUri (format: "192.168.x.x:port")
      const localIp = hostUri.split(':')[0];
      return `http://${localIp}:8000`;
    }
    
    // Fallback for when hostUri isn't available
    // Android emulator: Special IP that redirects to host machine
    if (Platform.OS === 'android') {
      return 'http://10.0.2.2:8000';
    }
    // iOS simulator: localhost works to reach the host machine
    if (Platform.OS === 'ios') {
      return 'http://localhost:8000';
    }
  }

  // Production fallback - you'd replace this with your actual API URL
  return 'https://192.168.1.7:8000';
};

// Export the API configuration
export const API_CONFIG = {
  baseUrl: getApiBaseUrl(),
};

// Export a function to get a full endpoint URL
export const getApiUrl = (endpoint) => {
  // Ensure endpoint starts with a slash if not already
  const formattedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_CONFIG.baseUrl}${formattedEndpoint}`;
};