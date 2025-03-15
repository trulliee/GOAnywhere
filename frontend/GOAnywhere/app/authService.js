// app/authService.js
import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Replace with your actual backend URL based on your IP address
const API_URL = 'http://192.168.1.14:8000';

// Keys for AsyncStorage
const AUTH_TOKEN_KEY = 'auth_token';
const USER_DATA_KEY = 'user_data';

class AuthService {
  // Save auth data to storage
  static async _saveAuthData(token, userData) {
    try {
      console.log('Saving auth token:', token);
      await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
      await AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(userData));
      return true;
    } catch (error) {
      console.error('Error saving auth data:', error);
      return false;
    }
  }

  // Get auth token from storage
  static async getToken() {
    try {
      return await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  }

  // Get user data from storage
  static async getUserData() {
    try {
      const userData = await AsyncStorage.getItem(USER_DATA_KEY);
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.error('Error getting user data:', error);
      return null;
    }
  }

  // Clear auth data from storage (logout)
  static async clearAuthData() {
    try {
      await AsyncStorage.multiRemove([AUTH_TOKEN_KEY, USER_DATA_KEY]);
      return true;
    } catch (error) {
      console.error('Error clearing auth data:', error);
      return false;
    }
  }

  // Sign up with email/password
  static async signUp(email, password, name = null, phoneNumber = null) {
    try {
      console.log(`Attempting to sign up at ${API_URL}/auth/signup`);
      
      const response = await fetch(`${API_URL}/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          name,
          phone_number: phoneNumber,
        }),
      });

      console.log('Sign up response status:', response.status);
      const data = await response.json();
      console.log('Sign up response data:', data);

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to sign up');
      }

      // Save auth data
      await this._saveAuthData(data.token, {
        uid: data.uid,
        email: data.email,
        name: data.name,
        isAnonymous: data.is_anonymous,
      });

      return data;
    } catch (error) {
      console.error('Sign up error:', error);
      Alert.alert('Sign Up Error', error.message);
      throw error;
    }
  }

  // Login with email/password
  static async login(email, password) {
    try {
      console.log(`Attempting to login at ${API_URL}/auth/login`);
      
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      console.log('Login response status:', response.status);
      const data = await response.json();
      console.log('Login response data:', data);

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to login');
      }

      // Save auth data
      await this._saveAuthData(data.token, {
        uid: data.uid,
        email: data.email,
        name: data.name,
        isAnonymous: data.is_anonymous,
      });

      return data;
    } catch (error) {
      console.error('Login error:', error);
      Alert.alert('Login Error', error.message);
      throw error;
    }
  }

  // Login anonymously
  static async loginAnonymously() {
    try {
      console.log(`Attempting anonymous login at ${API_URL}/auth/anonymous`);
      
      const response = await fetch(`${API_URL}/auth/anonymous`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('Anonymous login response status:', response.status);
      const data = await response.json();
      console.log('Anonymous login response data:', data);

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to login anonymously');
      }

      // Save auth data
      await this._saveAuthData(data.token, {
        uid: data.uid,
        isAnonymous: true,
      });

      return data;
    } catch (error) {
      console.error('Anonymous login error:', error);
      Alert.alert('Login Error', error.message);
      throw error;
    }
  }

  // Check if user is authenticated
  static async isAuthenticated() {
    const token = await this.getToken();
    return !!token;
  }

  // Get current user info
  static async getCurrentUser() {
    try {
      const token = await this.getToken();
      
      if (!token) {
        console.log('No auth token found');
        return null;
      }

      console.log('Using token for auth:', token.substring(0, 20) + '...');
      
      const response = await fetch(`${API_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        },
      });

      console.log('Get user response status:', response.status);

      if (!response.ok) {
        // Token may be invalid - try getting response content
        try {
          const errorData = await response.json();
          console.log('Auth error response:', errorData);
        } catch (e) {
          console.log('Could not parse error response');
        }
        
        if (response.status === 401) {
          await this.clearAuthData();
        }
        return null;
      }

      const userData = await response.json();
      console.log('User data received:', userData);
      return userData;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  // Logout
  static async logout() {
    return await this.clearAuthData();
  }
}

export default AuthService;