import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import AuthService from './authService';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

//update with actual logo stuff
const TrafficLightIcon = () => (
  <View style={styles.trafficLightContainer}>
    <View style={styles.trafficLightBody}>
      <View style={styles.trafficLightLight} />
      <View style={styles.trafficLightLight} />
      <View style={styles.trafficLightLight} />
    </View>
    <View style={styles.trafficLightBase} />
  </View>
);

export default function LoginUser() {
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  const handleLogin = async () => {
    if (!emailOrPhone || !password) {
      alert('Please fill in all fields');
      return;
    }
    
    // Test account for quick login
    if (emailOrPhone === 'ben@gmail.com' && password === '1234') {
      console.log('Logged in with test account');
      // Navigate to your main/home screen
      router.replace('./homeScreen');
      return;
    }
    
    setLoading(true);
    try {
      const userData = await AuthService.login(emailOrPhone, password);
      console.log('Logged in:', userData);
      
      if (userData.user_type === 'admin') {
        router.replace('./homeScreen');
      }
      else {
        router.replace('./homeScreen');
      }

    } catch (error) {
      console.error('Login failed:', error.message);
      alert('Login failed. Please check your credentials and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidView}
      >
        {/* Top curved shape */}
        <View style={styles.topCurve} />
        
        <View style={styles.contentContainer}>
          {/* udpate this with the logo */}
          <View style={styles.logoContainer}>
            <TrafficLightIcon />
            <Text style={styles.logoText}>GOANYWHERE</Text>
            <Text style={styles.tagline}>The only traffic forecasting website.</Text>
          </View>
          
          {/* Login Form */}
          <View style={styles.formContainer}>
            <TextInput
              style={styles.input}
              placeholder="Email / Phone Number"
              value={emailOrPhone}
              onChangeText={setEmailOrPhone}
              autoCapitalize="none"
              editable={!loading}
              placeholderTextColor="#555"
            />
            
            <TextInput
              style={styles.input}
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!loading}
              placeholderTextColor="#555"
            />
          </View>
          
          {/* Sign Up Link */}
          <TouchableOpacity 
            style={styles.signupLink}
            onPress={() => router.push('./SignUp')}
          >
            <Text style={styles.signupText}>Don't have an account? Sign up</Text>
          </TouchableOpacity>
        </View>
        
        {/* Sign in button */}
        <View style={styles.bottomSection}>
          <View style={styles.signInContainer}>
            <Text style={styles.signInText}>Sign In</Text>
            <TouchableOpacity
              style={[styles.arrowButton, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons name="arrow-forward" size={24} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  keyboardAvoidView: {
    flex: 1,
  },
  topCurve: {
    height: 150,
    backgroundColor: '#9de3d2', 
    borderBottomRightRadius: 150,
    position: 'absolute',
    top: 0,
    left: 0,
    width: '50%',
  },
  contentContainer: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 50,
  },
  trafficLightContainer: {
    alignItems: 'center',
    marginBottom: 10,
  },
  trafficLightBody: {
    width: 40,
    height: 70,
    backgroundColor: '#9de3d2',
    borderRadius: 10,
    justifyContent: 'space-evenly',
    alignItems: 'center',
  },
  trafficLightLight: {
    width: 15,
    height: 15,
    backgroundColor: 'white',
    borderRadius: 10,
  },
  trafficLightBase: {
    width: 10,
    height: 20,
    backgroundColor: '#9de3d2',
  },
  logoText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#9de3d2',
    marginTop: 10,
  },
  tagline: {
    fontSize: 12,
    color: '#9de3d2',
    marginTop: 5,
  },
  formContainer: {
    width: '100%',
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 15,
    borderRadius: 30,
    marginBottom: 15,
    fontSize: 16,
  },
  signupLink: {
    alignSelf: 'center',
  },
  signupText: {
    color: '#3498db',
    fontSize: 14,
  },
  bottomSection: {
    height: 180,
    backgroundColor: '#9de3d2',
    borderTopLeftRadius: 150,
    position: 'relative',
    justifyContent: 'center',
    paddingLeft: 50,
  },
  signInContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  signInText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginRight: 15,
  },
  arrowButton: {
    backgroundColor: 'black',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#888',
  },
});