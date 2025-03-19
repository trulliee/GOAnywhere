// app/utils/apiConfig.js
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Get the local IP from Expo if available
const getApiBaseUrl = () => {
  // Default backend port (Uvicorn uses 8000 by default)
  const DEFAULT_BACKEND_PORT = 8000;
  
  // For development
  if (__DEV__) {
    // If running on a physical device through Expo
    const hostUri = Constants.expoConfig?.hostUri;
    if (hostUri) {
      // Extract IP address from hostUri (format: "192.168.x.x:port")
      const localIp = hostUri.split(':')[0];
      return `http://${localIp}:${DEFAULT_BACKEND_PORT}`;
    }
    
    // Fallback for when hostUri isn't available
    // Android emulator: Special IP that redirects to host machine
    if (Platform.OS === 'android') {
      return `http://10.0.2.2:${DEFAULT_BACKEND_PORT}`;
    }
    // iOS simulator: localhost works to reach the host machine
    if (Platform.OS === 'ios') {
      return `http://localhost:${DEFAULT_BACKEND_PORT}`;
    }
  }

  // Production fallback - using HTTP not HTTPS for local development
  return 'http://192.168.1.7:8000';
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

// Add a dummy component as default export to satisfy Expo Router
// This is not used in your app logic but prevents the route error
export default function ApiConfigComponent() {
  return null;
}