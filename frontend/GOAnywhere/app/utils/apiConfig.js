// utils/apiConfig.js
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Get the API base URL dynamically
export const getApiUrl = () => {
  // Default backend port
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

  // Production fallback
  return 'http://192.168.1.14:8000';
};

// Export the API URL
export const API_URL = getApiUrl();

// For simplifying API calls
export const fetchAPI = async (endpoint, options = {}) => {
  const url = `${API_URL}${endpoint}`;
  
  // Default headers
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  // Get auth token if available
  try {
    const userInfo = await AsyncStorage.getItem('user_info');
    if (userInfo) {
      const { token } = JSON.parse(userInfo);
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        console.log('Adding auth token to request');
      }
    }
  } catch (error) {
    console.error('Error getting token for request:', error);
  }
  
  // Prepare the request
  const requestOptions = {
    ...options,
    headers,
  };
  
  try {
    const response = await fetch(url, requestOptions);
    
    // Check if response is JSON
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'API request failed');
      }
      
      return data;
    }
    
    // Handle non-JSON responses
    if (!response.ok) {
      throw new Error('API request failed');
    }
    
    return await response.text();
  } catch (error) {
    console.error(`API Error (${endpoint}):`, error);
    throw error;
  }
};

// Export a default object with all functions
const apiConfig = {
  API_URL,
  getApiUrl,
  fetchAPI
};

export default apiConfig;