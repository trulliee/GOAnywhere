import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  Keyboard
} from 'react-native';
import { useRouter } from 'expo-router';
import AuthService from './authService';
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
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  
  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleSignUp = async () => {
    if (!name || !email || !phoneNumber || !password || !confirmPassword) {
      alert('Please fill in all fields');
      return;
    }
    if (password !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    if (!/^\d{8}$/.test(phoneNumber.trim())) {
      alert('Phone number must be 8 digits');
      return;
    }

    console.log("Sending payload:", {
      email,
      password,
      name,
      phone_number: phoneNumber,
    });

    setLoading(true);
    try {
      // You may need to adjust your AuthService to handle separate email and phone
      // For now, we'll pass both values
      const userData = await AuthService.signUp(email, password, name, phoneNumber.trim());
      console.log('Signup successful:', userData);
      alert('Account created successfully!');
      router.replace('./loginUser');  // Navigate to login page after successful signup
    } catch (error) {
      console.error('Signup error:', error.message);
      alert('Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>

        {/* Top curved shape */}
        <View style={[styles.topCurve, keyboardVisible && { opacity: 0 }]} />        
        
        <View style={styles.contentContainer}>
          {/* Logo */}
          <View style={styles.logoContainer}>
            <TrafficLightIcon />
            <Text style={styles.logoText}>GOANYWHERE</Text>
            <Text style={styles.tagline}>The only traffic forecasting website.</Text>
          </View>
          
          {/* Signup Form */}
          <View style={styles.formContainer}>
            <TextInput
              style={styles.input}
              placeholder="Name"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              editable={!loading}
              placeholderTextColor="#555"
            />
            
            <TextInput
              style={styles.input}
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
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
            onPress={() => router.replace('./loginUser')}
          >
            <Text style={styles.loginText}>Already have an account? Login</Text>
          </TouchableOpacity>
        </View>
        
        {/* Sign up button */}
          <View style={[styles.bottomSection, keyboardVisible && { opacity: 0 }]}>
            <View style={styles.signUpContainer}>
            <Text style={styles.signUpText}>Create Account</Text>
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
    marginBottom: 30,
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
  },
  loginText: {
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