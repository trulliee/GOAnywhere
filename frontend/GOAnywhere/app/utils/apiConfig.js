// utils/apiConfig.js
import AsyncStorage from '@react-native-async-storage/async-storage';

// Production backend URL (hosted on Google Cloud Run)
//export const API_URL = 'https://goanywhere-backend-541900038032.asia-southeast1.run.app';
export const API_URL = 'https://3a46-103-252-200-172.ngrok-free.app';

// Helper for making API requests
export const fetchAPI = async (endpoint, options = {}) => {
  const url = `${API_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // Attach auth token if available
  try {
    const userInfo = await AsyncStorage.getItem('user_info');
    if (userInfo) {
      const { token } = JSON.parse(userInfo);
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }
  } catch (error) {
    console.error('Error getting token for request:', error);
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const contentType = response.headers.get('content-type');
    const isJson = contentType && contentType.includes('application/json');

    const data = isJson ? await response.json() : await response.text();

    if (!response.ok) {
      throw new Error(data.detail || 'API request failed');
    }

    return data;
  } catch (error) {
    console.error(`API Error (${endpoint}):`, error);
    throw error;
  }
};

// Optional default export for convenience
export default {
  API_URL,
  fetchAPI,
};