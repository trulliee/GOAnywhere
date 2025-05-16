import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { API_URL } from './utils/apiConfig';

class AuthService {
  // Sign up a new user
  static async signUp(email, password, name = '', phoneNumber = '') {
    try {
      console.log('📦 Sending payload:', {
        email,
        password,
        name,
        phoneNumber: phoneNumber,
      });
      
      const response = await fetch(`${API_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          name,
          phoneNumber: phoneNumber,
        }),
      });
      
      const data = await response.json();
      console.log('📩 Signup response data:', data);
      console.log('📡 Response status:', response.status);
      
      if (!response.ok) {
        throw new Error(data.detail || 'Signup failed. Please check your input.');
      }
      
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
  static async login(identifier, password) {
    try {
      const isPhone = /^\+?\d{8,15}$/.test(identifier);
      const endpoint = isPhone 
        ? `${API_URL}/auth/login-with-phone` 
        : `${API_URL}/auth/login`;

      const payload = isPhone 
        ? { phone: identifier, password } 
        : { email: identifier, password };

      console.log("Sending login to:", endpoint, "Payload:", payload);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const text = await response.text();
      if (!response.ok) {
        const data = JSON.parse(text);
        console.error('Login raw error:', text);
        throw new Error(data.detail || 'Login failed. Server error or invalid credentials.');
      }


      const data = JSON.parse(text);

      const userData = {
        uid: data.uid,
        email: data.email || '',
        name: data.name || data.email?.split('@')[0] || '',
        phone: data.phone || '',
        token: data.token,
        user_type: data.user_type || 'registered',
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
      const token = await this.getToken();
      if (!token) return null;

      const response = await fetch(`${API_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user profile');
      }

      const data = await response.json();
      return { ...data, token};
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

  static async updateProfile(payload, token) {
    try {
      const response = await fetch(`${API_URL}/auth/update_profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Profile update failed.');
      }

      return data;
    } catch (error) {
      console.error('Update profile error:', error);
      throw error;
    }
  }
    static async setUserName(newName) {
      try {
        const userInfo = await AsyncStorage.getItem('user_info');
        if (!userInfo) return;

        const parsed = JSON.parse(userInfo);
        parsed.name = newName;

        await AsyncStorage.setItem('user_info', JSON.stringify(parsed));
      } catch (error) {
        console.error('Set user name error:', error);
      }
  }



}

export default AuthService;
