// app/authService.js
/*import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { API_URL } from './utils/apiConfig';

class AuthService {
  // Login with email and password
  static async login(email, password) {
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Login failed');

      const userData = {
        uid: data.uid,
        email: data.email,
        name: data.name || email.split('@')[0],
        token: data.token,
      };
      await AsyncStorage.setItem('user_info', JSON.stringify(userData));
      return userData;
    } catch (error) {
      console.error("Login error:", error);
      Alert.alert('Login Error', error.message || 'Please try again.');
      throw error;
    }
  }

  // Sign up with email and password
  static async signUp(email, password, name = '', phoneNumber = '') {
    try {
      const response = await fetch(`${API_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name, phone_number: phoneNumber }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Signup failed');

      const userData = {
        uid: data.uid,
        email: data.email,
        name: data.name || name || email.split('@')[0],
        token: data.token,
      };
      await AsyncStorage.setItem('user_info', JSON.stringify(userData));
      return userData;
    } catch (error) {
      console.error("Signup error:", error);
      Alert.alert('Signup Error', error.message || 'Please try again.');
      throw error;
    }
  }

  // Anonymous login
  static async loginAnonymously() {
    try {
      const response = await fetch(`${API_URL}/auth/anonymous`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Anonymous login failed');

      const userData = { uid: data.uid, is_anonymous: true, token: data.token };
      await AsyncStorage.setItem('user_info', JSON.stringify(userData));
      return userData;
    } catch (error) {
      console.error("Anonymous login error:", error);
      Alert.alert('Login Error', error.message || 'Please try again.');
      throw error;
    }
  }

  static async logout() {
    try {
      await AsyncStorage.removeItem('user_info');
      return true;
    } catch (error) {
      console.error("Logout error:", error);
      throw error;
    }
  }

  static async getCurrentUser() {
    try {
      const userInfo = await AsyncStorage.getItem('user_info');
      return userInfo ? JSON.parse(userInfo) : null;
    } catch (error) {
      console.error("Get current user error:", error);
      return null;
    }
  }

  static async getUserInfo() {
    try {
      const userInfo = await AsyncStorage.getItem('user_info');
      if (!userInfo) return null;

      const parsed = JSON.parse(userInfo);

      if (parsed.token) {
        try {
          const response = await fetch(`${API_URL}/auth/me`, {
            headers: { 'Authorization': `Bearer ${parsed.token}` },
          });

          if (response.ok) {
            const data = await response.json();
            const updatedUser = { ...parsed, ...data };
            await AsyncStorage.setItem('user_info', JSON.stringify(updatedUser));
            return updatedUser;
          }
        } catch (e) {
          console.warn("Error refreshing user info:", e);
          return parsed;
        }
      }

      return parsed;
    } catch (error) {
      console.error("Get user info error:", error);
      return null;
    }
  }

  static async getUserName() {
    try {
      const user = await this.getUserInfo();
      return user?.name || 'User';
    } catch {
      return 'User';
    }
  }

  static async getToken() {
    try {
      const userInfo = await AsyncStorage.getItem('user_info');
      return userInfo ? JSON.parse(userInfo).token || null : null;
    } catch (error) {
      console.error("Get token error:", error);
      return null;
    }
  }

  static async isLoggedIn() {
    const user = await this.getCurrentUser();
    return !!user;
  }

  static async verifyToken(token) {
    try {
      const response = await fetch(`${API_URL}/auth/verify-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_token: token }),
      });

      if (!response.ok) throw new Error('Token verification failed');
      return await response.json();
    } catch (error) {
      console.error("Verify token error:", error);
      throw error;
    }
  }
}

export default AuthService;
*/

// app/authService.js

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { API_URL } from './utils/apiConfig';

class AuthService {
  // Sign up a new user
  static async signUp(email, password, name = '', phoneNumber = '') {
    try {
      const response = await fetch(`${API_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          name,
          phone_number: phoneNumber,
        }),
      });

      const text = await response.text();
      if (!response.ok) {
        console.error('Signup raw error:', text);
        throw new Error('Signup failed. Server error or invalid response.');
      }

      const data = JSON.parse(text); // Now safe to parse
      const userData = {
        uid: data.uid,
        email: data.email,
        name: data.name || name || (email ? email.split('@')[0] : ''),
        token: data.token,
      };

      await AsyncStorage.setItem('user_info', JSON.stringify(userData));
      return userData;

    } catch (error) {
      console.error('Signup error:', error);
      Alert.alert('Signup Error', error.message || 'Please try again.');
      throw error;
    }
  }

  // Login existing user
  static async login(email, password) {
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const text = await response.text(); // get raw response first
      if (!response.ok) {
        console.error('Login raw error:', text);
        throw new Error('Login failed. Server error or invalid credentials.');
      }

      const data = JSON.parse(text); // safely parse now

      const userData = {
        uid: data.uid,
        email: data.email,
        name: data.name || (email ? email.split('@')[0] : ''),
        token: data.token,
        user_type: data.user_type,
      };

      await AsyncStorage.setItem('user_info', JSON.stringify(userData));
      return userData;

    } catch (error) {
      console.error('Login error:', error);
      Alert.alert('Login Error', error.message || 'Please try again.');
      throw error;
    }
  }

  // Logout user
  static async logout() {
    try {
      await AsyncStorage.removeItem('user_info');
      return true;
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  }

  // Get current user from local storage
  static async getCurrentUser() {
    try {
      const userInfo = await AsyncStorage.getItem('user_info');
      return userInfo ? JSON.parse(userInfo) : null;
    } catch (error) {
      console.error('Get current user error:', error);
      return null;
    }
  }

  // Get token from current user
  static async getToken() {
    try {
      const userInfo = await AsyncStorage.getItem('user_info');
      return userInfo ? JSON.parse(userInfo).token || null : null;
    } catch (error) {
      console.error('Get token error:', error);
      return null;
    }
  }

  // Verify token with backend
  static async verifyToken(token) {
    try {
      const response = await fetch(`${API_URL}/auth/verify-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_token: token }),
      });

      if (!response.ok) {
        throw new Error('Token verification failed.');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Verify token error:', error);
      throw error;
    }
  }
  
  static async getUserInfo() {
    try {
      const userInfo = await AsyncStorage.getItem('user_info');
      return userInfo ? JSON.parse(userInfo) : null;
    } catch (error) {
      console.error("Get user info error:", error);
      return null;
    }
  }

  static async getUserName() {
    try {
      const user = await this.getUserInfo();
      return user?.name || 'User';
    } catch {
      return 'User';
    }
  }
}

export default AuthService;
