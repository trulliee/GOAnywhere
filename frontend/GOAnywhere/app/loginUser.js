// app/loginUser.js
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import AuthService from './authService';

export default function LoginUser() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Handle form submission (login or signup)
  const handleSubmit = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Email and password are required');
      return;
    }

    setLoading(true);
    try {
      let userData;
      
      if (isLogin) {
        // Handle login
        userData = await AuthService.login(email, password);
      } else {
        // Handle signup
        userData = await AuthService.signUp(email, password, name, phoneNumber);
      }
      
      // Fetch additional user info after successful authentication
      try {
        await AuthService.getUserInfo();
      } catch (infoError) {
        console.log('Non-critical error fetching user info:', infoError);
        // Continue with navigation even if this fails
      }
      
      router.replace('/home');
    } catch (error) {
      console.error(isLogin ? 'Login error:' : 'Signup error:', error);
      // AuthService already shows an alert on error
    } finally {
      setLoading(false);
    }
  };

  // Handle anonymous login
  const handleAnonymousLogin = async () => {
    setLoading(true);
    try {
      await AuthService.loginAnonymously();
      router.replace('/home');
    } catch (error) {
      console.error('Anonymous login error:', error);
      // AuthService already shows an alert on error
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{isLogin ? 'Login' : 'Sign Up'}</Text>
      
      {/* Name input (signup only) */}
      {!isLogin && (
        <TextInput
          style={styles.input}
          placeholder="Name (optional)"
          value={name}
          onChangeText={setName}
          editable={!loading}
        />
      )}
      
      {/* Email input */}
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        editable={!loading}
      />
      
      {/* Phone number input (signup only) */}
      {!isLogin && (
        <TextInput
          style={styles.input}
          placeholder="Phone Number (optional)"
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          keyboardType="phone-pad"
          editable={!loading}
        />
      )}
      
      {/* Password input */}
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        editable={!loading}
      />
      
      {/* Login/Signup button */}
      <TouchableOpacity 
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.buttonText}>{isLogin ? 'Login' : 'Sign Up'}</Text>
        )}
      </TouchableOpacity>
      
      {/* Toggle login/signup */}
      <TouchableOpacity onPress={() => setIsLogin(!isLogin)} disabled={loading}>
        <Text style={styles.toggleText}>
          {isLogin ? 'New user? Sign up' : 'Already have an account? Login'}
        </Text>
      </TouchableOpacity>
      
      {/* Anonymous login */}
      <TouchableOpacity 
        style={[styles.anonymousButton, loading && styles.buttonDisabled]}
        onPress={handleAnonymousLogin}
        disabled={loading}
      >
        <Text style={styles.anonymousButtonText}>Continue without an account</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 15,
    borderRadius: 5,
    marginBottom: 15,
  },
  button: {
    backgroundColor: '#3498db',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    marginBottom: 15,
  },
  buttonDisabled: {
    backgroundColor: '#a0cff1',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  toggleText: {
    textAlign: 'center',
    color: '#3498db',
    marginBottom: 20,
  },
  anonymousButton: {
    padding: 15,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  anonymousButtonText: {
    color: '#777',
  },
});