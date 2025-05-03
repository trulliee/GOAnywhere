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
  Platform,
  ScrollView
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

export default function SignUp() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  const handleSignUp = async () => {
    // Basic validation
    if (!username || !email || !phoneNumber || !password || !confirmPassword) {
      alert('Please fill in all fields');
      return;
    }
    
    if (password !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }
    
    setLoading(true);
    
    try {
      // When your backend is connected, you would call your signup service
      // const userData = await AuthService.signUp(username, email, phoneNumber, password);
      
      // For testing, we'll just show a success message and navigate
      setTimeout(() => {
        console.log('Signed up with:', { username, email, phoneNumber });
        alert('Account created successfully!');
        router.replace('./loginUser');
        setLoading(false);
      }, 1000);
    } catch (error) {
      console.error('Signup failed:', error.message);
      alert('Signup failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidView}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          {/* Top curved shape */}
          <View style={styles.topCurve} />
          
          <View style={styles.contentContainer}>
            {/* Logo section */}
            <View style={styles.logoContainer}>
              <TrafficLightIcon />
              <Text style={styles.logoText}>GOANYWHERE</Text>
              <Text style={styles.tagline}>The only traffic forecasting website.</Text>
            </View>
            
            {/* Signup Form */}
            <View style={styles.formContainer}>
              <TextInput
                style={styles.input}
                placeholder="Username"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                editable={!loading}
                placeholderTextColor="#555"
              />
              
              <TextInput
                style={styles.input}
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!loading}
                placeholderTextColor="#555"
              />
              
              <TextInput
                style={styles.input}
                placeholder="Phone Number"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                keyboardType="phone-pad"
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
              
              <TextInput
                style={styles.input}
                placeholder="Confirm Password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                editable={!loading}
                placeholderTextColor="#555"
              />
            </View>
            
            {/* Login Link */}
            <TouchableOpacity 
              style={styles.loginLink}
              onPress={() => router.push('./loginUser')}
            >
              <Text style={styles.loginText}>Already have an account? Login</Text>
            </TouchableOpacity>
          </View>
          
          {/* Sign up button section */}
          <View style={styles.bottomSection}>
            <View style={styles.signUpContainer}>
              <Text style={styles.signUpText}>Sign Up</Text>
              <TouchableOpacity
                style={[styles.arrowButton, loading && styles.buttonDisabled]}
                onPress={handleSignUp}
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
        </ScrollView>
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
  scrollContainer: {
    flexGrow: 1,
  },
  topCurve: {
    height: 150,
    backgroundColor: '#9de3d2', // Mint green
    borderBottomRightRadius: 150,
    position: 'absolute',
    top: 0,
    left: 0,
    width: '50%',
    zIndex: 1,
  },
  contentContainer: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    paddingTop: 100, // Add more padding to account for the scrollview
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
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
  loginLink: {
    alignSelf: 'center',
    marginBottom: 20,
  },
  loginText: {
    color: '#3498db',
    fontSize: 14,
  },
  bottomSection: {
    height: 180,
    backgroundColor: '#9de3d2',
    borderTopLeftRadius: 150,
    justifyContent: 'center',
    paddingLeft: 50,
  },
  signUpContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  signUpText: {
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