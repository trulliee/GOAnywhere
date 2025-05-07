import React, { useState } from 'react';
import { 
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  const handleLogin = async () => {
    setLoading(true);
    try {
      const userData = await AuthService.login(email, password);
      console.log('Logged in:', userData);
      
      if (userData.user_type == 'admin') {
        router.replace('./homeScreen');
      }
      else {
        router.replace('./homeScreen');
      }

    } catch (error) {
      console.error('Login failed:', error.message);
      // Show toast or alert here
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
              value={email}
              onChangeText={setEmail}
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
  signupText: {
    textAlign: 'center',
    color: '#3498db',
    textDecorationLine: 'underline',
  }
});