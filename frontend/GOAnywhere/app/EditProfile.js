import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  SafeAreaView, 
  Alert,
  Image,
  ScrollView,
  Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from 'react-native-vector-icons';
import AuthService from './authService';

const EditProfileScreen = () => {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  useEffect(() => {
    // Load user data when the screen loads
    const loadUserData = async () => {
      try {
        const userData = await AuthService.getCurrentUser();
        if (userData) {
          setUser(userData);
          setUsername(userData.username || '');
          setEmail(userData.email || '');
          setPhoneNumber(userData.phone_number || '');
        }
      } catch (error) {
        console.error('Error loading user data:', error);
        Alert.alert('Error', 'Could not load user data');
      }
    };

    loadUserData();
  }, []);

  const handleUpdateProfile = async () => {
    // Validate inputs
    if (!username.trim()) {
      Alert.alert('Validation Error', 'Username cannot be empty');
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      Alert.alert('Validation Error', 'Please enter a valid email');
      return;
    }

    try {
      // Prepare update payload
      const updatePayload = {
        username,
        email,
        phone_number: phoneNumber
      };

      // Only include password if it's been changed
      if (password.trim()) {
        updatePayload.password = password;
      }

      // Call AuthService to update profile
      const response = await AuthService.updateUserProfile(updatePayload);

      if (response && !response.error) {
        Alert.alert('Success', 'Profile updated successfully');
        // Optionally navigate back or refresh user data
        router.back();
      } else {
        Alert.alert('Update Failed', response.message || 'Could not update profile');
      }
    } catch (error) {
      console.error('Profile update error:', error);
      Alert.alert('Error', 'An error occurred while updating profile');
    }
  };

  const handleLogout = async () => {
    try {
      await AuthService.logout();
      // Navigate to login screen
      router.replace('/login');
    } catch (error) {
      console.error('Logout error:', error);
      Alert.alert('Logout Error', 'Could not log out');
    }
  };

  const togglePasswordVisibility = () => {
    setIsPasswordVisible(!isPasswordVisible);
  };

  const handleChangeProfilePicture = () => {
    // TODO: Implement profile picture change
    Alert.alert('Coming Soon', 'Profile picture upload feature will be available in future updates');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Back Button */}
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.back()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>

        {/* Profile Picture */}
        <View style={styles.profileImageContainer}>
          <TouchableOpacity onPress={handleChangeProfilePicture}>
            <View style={styles.profileImage}>
              {user?.profile_picture ? (
                <Image 
                  source={{ uri: user.profile_picture }} 
                  style={styles.profileImageActual} 
                />
              ) : (
                <Text style={styles.profileInitial}>
                  {username.charAt(0).toUpperCase()}
                </Text>
              )}
              <View style={styles.cameraIconOverlay}>
                <MaterialIcons name="camera-alt" size={20} color="#fff" />
              </View>
            </View>
          </TouchableOpacity>
          <Text style={styles.changeProfileText}>Change Picture</Text>
        </View>

        {/* Edit Profile Form */}
        <View style={styles.formContainer}>
          <Text style={styles.formTitle}>Edit Profile</Text>
          
          {/* Username Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Username</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="Enter username"
              autoCapitalize="none"
            />
          </View>

          {/* Email Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Enter email"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          {/* Phone Number Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Phone Number</Text>
            <TextInput
              style={styles.input}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              placeholder="Enter phone number"
              keyboardType="phone-pad"
            />
          </View>

          {/* Password Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                value={password}
                onChangeText={setPassword}
                placeholder="Leave blank if no change"
                secureTextEntry={!isPasswordVisible}
                autoCapitalize="none"
              />
              <TouchableOpacity 
                style={styles.eyeIconContainer}
                onPress={togglePasswordVisibility}
              >
                <MaterialIcons 
                  name={isPasswordVisible ? "visibility-off" : "visibility"} 
                  size={20} 
                  color="#666" 
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Update Profile Button */}
          <TouchableOpacity 
            style={styles.updateButton} 
            onPress={handleUpdateProfile}
          >
            <Text style={styles.updateButtonText}>Update Profile</Text>
          </TouchableOpacity>

          {/* Logout Button */}
          <TouchableOpacity 
            style={styles.logoutButton} 
            onPress={handleLogout}
          >
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 40 : 20,
  },
  backButton: {
    marginBottom: 20,
  },
  profileImageContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  profileImageActual: {
    width: '100%',
    height: '100%',
    borderRadius: 60,
  },
  profileInitial: {
    fontSize: 48,
    color: '#666',
  },
  cameraIconOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 15,
    padding: 5,
  },
  changeProfileText: {
    marginTop: 10,
    color: '#666',
    fontSize: 14,
  },
  formContainer: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 15,
  },
  inputLabel: {
    marginBottom: 5,
    color: '#666',
    fontSize: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 10,
    fontSize: 16,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
  },
  passwordInput: {
    flex: 1,
    padding: 10,
    fontSize: 16,
  },
  eyeIconContainer: {
    padding: 10,
  },
  updateButton: {
    backgroundColor: '#007bff',
    borderRadius: 5,
    padding: 15,
    alignItems: 'center',
    marginTop: 20,
  },
  updateButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  logoutButton: {
    backgroundColor: '#dc3545',
    borderRadius: 5,
    padding: 15,
    alignItems: 'center',
    marginTop: 15,
  },
  logoutButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default EditProfileScreen;