import React, { useState, useEffect } from 'react';
import { 
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Keyboard
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
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleLogin = async () => {
    if (!emailOrPhone || !password) {
      alert('Please fill in all fields');
      return;
    }

    // Quick test logins
    if (emailOrPhone === 'ben@gmail.com' && password === '1234') {
      router.replace('./HomeScreen');
      return;
    }
    if (emailOrPhone === 'admin@gmail.com' && password === '1234') {
      router.replace('./AdminHomeScreen');
      return;
    }

    setLoading(true);
    try {
      const userData = await AuthService.login(emailOrPhone, password);
      console.log('Logged in:', userData);
      console.log('Logging in as:', emailOrPhone, "with password:", password);

      if (userData.user_type === 'admin') {
        router.replace('./AdminHomeScreen');
      } else {
        router.replace('./HomeScreen');
      }

    } catch (error) {
      console.error('Login failed:', error.message);
      alert(`Login failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };


  return (
    <SafeAreaView style={styles.container}>
        {/* Top curved shape */}
        <View style={[styles.topCurve, keyboardVisible && { opacity: 0 }]} />
        
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

          <View style={{ height: 10 }} />

          <Text style={[styles.signupText, { textAlign: 'center', marginBottom: 5 }]}>
            — OR —
          </Text>

          <TouchableOpacity 
            style={styles.signupLink}
            onPress={() => router.push('./AdminSignUp')}
          >
            <Text style={styles.signupText}>System Admin? Register here</Text>
          </TouchableOpacity>

          {/* Quick login buttons - Only visible in development */}
          {/* <View style={styles.devLoginContainer}>
            <TouchableOpacity 
              style={styles.devLoginButton}
              onPress={() => {
                setEmailOrPhone('ben@gmail.com');
                setPassword('1234');
              }}
            >
              <Text style={styles.devLoginText}>Quick User Login</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.devLoginButton, styles.adminLoginButton]}
              onPress={() => {
                setEmailOrPhone('admin@gmail.com');
                setPassword('1234');
              }}
            >
              <Text style={styles.devLoginText}>Quick Admin Login</Text>
            </TouchableOpacity>
          </View> */}
        </View>
        
        {/* Sign in button */}
        <View style={[styles.bottomSection, keyboardVisible && { opacity: 0 }]}>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
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
  signInContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 20,
  },
  signInText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginRight: 15,
    color: '#000',
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
  // Development quick login buttons
  devLoginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  devLoginButton: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginHorizontal: 5,
  },
  adminLoginButton: {
    backgroundColor: '#ffe0e0',
  },
  devLoginText: {
    fontSize: 12,
    color: '#666',
  },
});