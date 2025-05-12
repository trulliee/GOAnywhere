// app/EditProfile.js
import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  TextInput,
  SafeAreaView,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AuthService from './authService';

export default function EditProfile() {
  const router = useRouter();
  const [username, setUsername] = useState('Bentley');
  const [email, setEmail] = useState('heheheha@gmail.com');
  const [phone, setPhone] = useState('91234567');
  const [password, setPassword] = useState('hehesecretduntellu'); // This would normally be loaded from user data
  const [maskedPassword, setMaskedPassword] = useState('••••••••••••••••');
  const [showPassword, setShowPassword] = useState(false);
  
  useEffect(() => {
    // Load user data
    async function loadUserData() {
      try {
        const userData = await AuthService.getCurrentUser();
        if (userData) {
          setUsername(userData.name || 'Bentley');
          setEmail(userData.email || 'heheheha@gmail.com');
          setPhone(userData.phone || '91234567');
          // In a real app, you would not store or set the actual password here
          // This is just for demonstration purposes
          if (userData.password) {
            setPassword(userData.password);
          }
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      }
    }
    
    loadUserData();
  }, []);

  const handleGoBack = () => {
    router.back();
  };

  const handleSave = async () => {
  try {
    const userInfo = await AuthService.getCurrentUser();
    const { uid, token } = userInfo;

    const payload = {
      user_id: uid,
      name: username,
      email: email,
      phone_number: phone,
      password: password
    };

    await AuthService.updateProfile(payload, token);
    Alert.alert("Success", "Profile updated successfully.");
    router.back();
  } catch (error) {
    console.error('Error updating profile:', error);
    Alert.alert("Error", "Failed to update profile. Please try again.");
  }
};


  const handleLogout = async () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        { 
          text: "Logout", 
          onPress: async () => {
            try {
              await AuthService.logout();
              // Navigate to the login screen
              router.replace("./loginUser");
            } catch (error) {
              console.error('Error logging out:', error);
              Alert.alert("Error", "Failed to logout. Please try again.");
            }
          } 
        }
      ]
    );
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
    // For better user experience, automatically hide the password again after a few seconds
    if (!showPassword) {
      setTimeout(() => {
        setShowPassword(false);
      }, 3000); // Hide after 3 seconds
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidView}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <View style={styles.headerRight} />
        </View>
        
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Profile Picture */}
          <View style={styles.profilePictureContainer}>
            <View style={styles.profilePicture}>
              <Text style={styles.profileInitial}>{username.charAt(0).toUpperCase()}</Text>
            </View>
            <TouchableOpacity>
              <Text style={styles.changePhotoText}>Change Picture</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.divider} />
          
          {/* Form Fields */}
          <View style={styles.formSection}>
            <Text style={styles.fieldLabel}>Username</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="Enter username"
              placeholderTextColor="#888"
            />
            
            <Text style={styles.fieldLabel}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Enter email"
              placeholderTextColor="#888"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            
            <Text style={styles.fieldLabel}>Phone Number</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="Enter phone number"
              placeholderTextColor="#888"
              keyboardType="phone-pad"
            />
            
            <Text style={styles.fieldLabel}>Password</Text>
            <View style={styles.passwordInputContainer}>
              <TextInput
                style={styles.passwordInput}
                value={showPassword ? password : maskedPassword}
                secureTextEntry={false}
                editable={false}
              />
              <TouchableOpacity onPress={togglePasswordVisibility} style={styles.eyeIcon}>
                <Ionicons 
                  name={showPassword ? "eye-off-outline" : "eye-outline"} 
                  size={24} 
                  color="#555" 
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={[styles.logoutButton, { backgroundColor: '#4CAF50', marginBottom: 10 }]}
              onPress={handleSave}
            >
              <Ionicons name="save-outline" size={20} color="#fff" style={styles.logoutIcon} />
              <Text style={[styles.logoutButtonText, { color: '#fff' }]}>Save Changes</Text>
            </TouchableOpacity>

            
            {/* Logout Button */}
            <TouchableOpacity 
              style={styles.logoutButton}
              onPress={handleLogout}
            >
              <Ionicons name="exit-outline" size={20} color="#333" style={styles.logoutIcon} />
              <Text style={styles.logoutButtonText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#333',
  },
  keyboardAvoidView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    paddingBottom: 15,
    paddingHorizontal: 20,
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ccc',
  },
  headerRight: {
    width: 30, // For balanced header
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 30,
    alignItems: 'center',
  },
  profilePictureContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  profilePicture: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#ffcdb2', // Salmon color as in the image
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  profileInitial: {
    fontSize: 50,
    color: '#333',
    fontWeight: 'bold',
  },
  changePhotoText: {
    color: '#ccc',
    fontSize: 14,
    marginTop: 5,
  },
  divider: {
    height: 1,
    backgroundColor: '#555',
    width: '90%',
    marginBottom: 20,
  },
  formSection: {
    width: '85%',
  },
  fieldLabel: {
    color: '#aaa',
    fontSize: 14,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    color: '#333',
    marginBottom: 20,
    width: '100%',
  },
  passwordInputContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 30,
    alignItems: 'center',
    width: '100%',
  },
  passwordInput: {
    flex: 1,
    padding: 15,
    fontSize: 16,
    color: '#333',
  },
  eyeIcon: {
    padding: 10,
  },
  logoutButton: {
    backgroundColor: '#aaa',
    borderRadius: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    width: '60%',
    alignSelf: 'center',
    marginTop: 10,
  },
  logoutIcon: {
    marginRight: 8,
  },
  logoutButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
});