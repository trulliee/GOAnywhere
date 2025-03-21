// app/authService.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Platform } from 'react-native';
import Constants from 'expo-constants';

// Get the API base URL dynamically
const getApiBaseUrl = () => {
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
  return 'http://192.168.1.2:8000';
};

// Export the API URL
const API_URL = getApiBaseUrl();

class AuthService {
  // Login with email and password
  static async login(email, password) {
    try {
      console.log(`Attempting to login with email: ${email}`);
      console.log(`API URL: ${API_URL}`);
      
      // Call the backend login API
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.error('Login response not OK:', data);
        throw new Error(data.detail || 'Login failed');
      }
      
      console.log('Backend login successful, token received');
      
      // Store user info in AsyncStorage
      const userData = {
        uid: data.uid,
        email: data.email,
        name: data.name || email.split('@')[0],
        token: data.token
      };
      
      await AsyncStorage.setItem('user_info', JSON.stringify(userData));
      
      return userData;
    } catch (error) {
      console.error("Error signing in:", error);
      Alert.alert('Login Error', error.message || 'Failed to login. Please try again.');
      throw error;
    }
  }

  // Sign up with email, password and optional info
  static async signUp(email, password, name = '', phoneNumber = '') {
    try {
      console.log(`Attempting to sign up with email: ${email}`);
      
      // Call the backend signup API
      const response = await fetch(`${API_URL}/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          email, 
          password,
          name,
          phone_number: phoneNumber
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.error('Signup response not OK:', data);
        throw new Error(data.detail || 'Signup failed');
      }
      
      console.log('Backend signup successful, token received');
      
      // Store user info in AsyncStorage
      const userData = {
        uid: data.uid,
        email: data.email,
        name: data.name || name || email.split('@')[0],
        token: data.token
      };
      
      await AsyncStorage.setItem('user_info', JSON.stringify(userData));
      
      return userData;
    } catch (error) {
      console.error("Error signing up:", error);
      Alert.alert('Signup Error', error.message || 'Failed to create account. Please try again.');
      throw error;
    }
  }

  // Login anonymously
  static async loginAnonymously() {
    try {
      console.log('Attempting anonymous login');
      
      // Call the backend anonymous login API
      const response = await fetch(`${API_URL}/auth/anonymous`, {
        method: 'POST',
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.error('Anonymous login response not OK:', data);
        throw new Error(data.detail || 'Anonymous login failed');
      }
      
      console.log('Backend anonymous login successful, token received');
      
      // Store user info in AsyncStorage
      const userData = {
        uid: data.uid,
        is_anonymous: true,
        token: data.token
      };
      
      await AsyncStorage.setItem('user_info', JSON.stringify(userData));
      
      return userData;
    } catch (error) {
      console.error("Error signing in anonymously:", error);
      Alert.alert('Login Error', error.message || 'Anonymous login failed. Please try again.');
      throw error;
    }
  }

  // Sign out
  static async logout() {
    try {
      // Clear user info from AsyncStorage
      await AsyncStorage.removeItem('user_info');
      return true;
    } catch (error) {
      console.error("Error signing out:", error);
      throw error;
    }
  }

  // Get current user from AsyncStorage
  static async getCurrentUser() {
    try {
      const userInfo = await AsyncStorage.getItem('user_info');
      return userInfo ? JSON.parse(userInfo) : null;
    } catch (error) {
      console.error("Error getting current user:", error);
      return null;
    }
  }

  // Get user info from the backend
  static async getUserInfo() {
    try {
      // Get user info from AsyncStorage
      const userInfo = await AsyncStorage.getItem('user_info');
      
      if (!userInfo) {
        return null;
      }
      
      const parsedUserInfo = JSON.parse(userInfo);
      
      // If we have a token, try to get fresh user info from backend
      if (parsedUserInfo.token) {
        try {
          const response = await fetch(`${API_URL}/auth/me`, {
            headers: {
              'Authorization': `Bearer ${parsedUserInfo.token}`,
            },
          });
          
          if (response.ok) {
            const data = await response.json();
            // Update AsyncStorage with fresh data
            const updatedUserInfo = {
              ...parsedUserInfo,
              ...data
            };
            await AsyncStorage.setItem('user_info', JSON.stringify(updatedUserInfo));
            return updatedUserInfo;
          }
        } catch (e) {
          console.warn("Error fetching fresh user info:", e);
          // Return cached user info if backend request fails
          return parsedUserInfo;
        }
      }
      
      return parsedUserInfo;
    } catch (error) {
      console.error("Error getting user info:", error);
      return null;
    }
  }

  // Get user name (convenience method)
  static async getUserName() {
    try {
      const userInfo = await this.getUserInfo();
      return userInfo?.name || 'User';
    } catch (error) {
      console.error("Error getting user name:", error);
      return 'User';
    }
  }

  // Get token for authenticated user
  static async getToken() {
    try {
      const userInfo = await AsyncStorage.getItem('user_info');
      if (!userInfo) return null;
      
      const { token } = JSON.parse(userInfo);
      return token || null;
    } catch (error) {
      console.error("Error getting token:", error);
      return null;
    }
  }

  // Check if user is logged in
  static async isLoggedIn() {
    const user = await this.getCurrentUser();
    return !!user;
  }

  // Verify token with backend
  static async verifyToken(token) {
    try {
      const response = await fetch(`${API_URL}/auth/verify-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id_token: token }),
      });
      
      if (!response.ok) {
        throw new Error('Token verification failed');
      }
      
      return await response.json();
    } catch (error) {
      console.error("Error verifying token:", error);
      throw error;
    }
  }
}

export default AuthService;