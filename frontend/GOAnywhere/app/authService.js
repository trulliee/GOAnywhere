// app/authService.js
import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiUrl } from './utils/apiConfig';

// Keys for AsyncStorage
const AUTH_TOKEN_KEY = 'auth_token';
const USER_DATA_KEY = 'user_data';
const USER_NAME_KEY = 'user_name';

class AuthService {
  // Save auth data to storage
  static async _saveAuthData(token, userData) {
    try {
      console.log('Saving auth token:', token);
      await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
      await AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(userData));
      
      // Save user name separately for easy access
      if (userData.name) {
        await AsyncStorage.setItem(USER_NAME_KEY, userData.name);
      }
      
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

  // Get user name from storage
  static async getUserName() {
    try {
      const name = await AsyncStorage.getItem(USER_NAME_KEY);
      return name || 'User';
    } catch (error) {
      console.error('Error getting user name:', error);
      return 'User';
    }
  }

  // Clear auth data from storage (logout)
  static async clearAuthData() {
    try {
      await AsyncStorage.multiRemove([AUTH_TOKEN_KEY, USER_DATA_KEY, USER_NAME_KEY]);
      return true;
    } catch (error) {
      console.error('Error clearing auth data:', error);
      return false;
    }
  }

  // Sign up with email/password
  static async signUp(email, password, name = null, phoneNumber = null) {
    try {
      const endpoint = getApiUrl('/auth/signup');
      console.log(`Attempting to sign up at ${endpoint}`);
      
      const response = await fetch(endpoint, {
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
      const endpoint = getApiUrl('/auth/login');
      console.log(`Attempting to login at ${endpoint}`);
      
      const response = await fetch(endpoint, {
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
      const endpoint = getApiUrl('/auth/anonymous');
      console.log(`Attempting anonymous login at ${endpoint}`);
      
      const response = await fetch(endpoint, {
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

  // Get current user (with up-to-date info from server)
  static async getCurrentUser() {
    try {
      const token = await this.getToken();
      if (!token) {
        return null;
      }

      // First try to get cached user data
      const cachedUserData = await this.getUserData();
      
      // Try to fetch fresh user data from the server
      const response = await fetch(getApiUrl('/auth/me'), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const userData = await response.json();
        
        // Update stored user data
        await this._saveAuthData(token, userData);
        
        return userData;
      }
      
      // If server request fails, return cached data
      return cachedUserData;
    } catch (error) {
      console.error('Error fetching current user:', error);
      // Return cached data on error
      return await this.getUserData();
    }
  }

  // Fetch user info from server
  static async getUserInfo() {
    try {
      const token = await this.getToken();
      if (!token) {
        return { error: 'No authentication token found' };
      }

      const response = await fetch(getApiUrl('/auth/user-info'), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        return { error: errorData.detail || 'Failed to fetch user information' };
      }

      const userData = await response.json();
      
      // Update stored user info
      if (userData && !userData.error) {
        await this._saveAuthData(token, userData);
      }
      
      return userData;
    } catch (error) {
      console.error('Error fetching user info:', error);
      return { error: 'An error occurred while fetching user information' };
    }
  }

  // Logout
  static async logout() {
    return await this.clearAuthData();
  }
}

export default AuthService;