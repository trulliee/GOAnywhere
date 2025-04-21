// app/Settings.js
import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Switch,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Linking,
  Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AuthService from './authService';

export default function Settings() {
  const router = useRouter();
  const [pushNotifications, setPushNotifications] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Load user data on component mount
    async function loadUserData() {
      try {
        const userData = await AuthService.getCurrentUser();
        setUser(userData);
      } catch (error) {
        console.error('Error loading user data:', error);
      }
    }
    
    loadUserData();
  }, []);

  const handleGoBack = () => {
    router.back();
  };

  const navigateTo = (screen) => {
    router.push(`./${screen}`);
  };

  const openWebLink = async (url) => {
    // Check if the link can be opened
    const canOpen = await Linking.canOpenURL(url);
    
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      Alert.alert("Error", "Cannot open this URL");
    }
  };

  const togglePushNotifications = () => {
    setPushNotifications(previousState => !previousState);
    // need to change for backend stuff!!
  };

  const SettingsItem = ({ title, onPress, hasToggle, toggleValue, onToggleChange }) => {
    return (
      <TouchableOpacity 
        style={styles.settingsItem} 
        onPress={onPress}
        disabled={hasToggle}
      >
        <Text style={styles.settingsText}>{title}</Text>
        {hasToggle ? (
          <Switch
            trackColor={{ false: "#767577", true: "#4CD964" }}
            thumbColor="#f4f3f4"
            ios_backgroundColor="#3e3e3e"
            onValueChange={onToggleChange}
            value={toggleValue}
          />
        ) : (
          <Ionicons name="chevron-forward" size={20} color="#888" />
        )}
      </TouchableOpacity>
    );
  };

  const SectionHeader = ({ title }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  );

  const Divider = () => <View style={styles.divider} />;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerRight} />
      </View>
      
      <ScrollView 
        style={styles.settingsContainer}
        contentContainerStyle={styles.contentContainer}
      >
        {/* Account Settings Section */}
        <SectionHeader title="Account Settings" />
        
        <SettingsItem 
          title="Edit profile" 
          onPress={() => navigateTo('EditProfile')} 
        />
        
        <SettingsItem 
          title="Push notifications" 
          hasToggle={true}
          toggleValue={pushNotifications}
          onToggleChange={togglePushNotifications}
        />
        
        <Divider />
        
        {/* Traffic Updates Section */}
        <SectionHeader title="Traffic Updates" />
        
        <SettingsItem 
          title="Forecast Updates" 
          onPress={() => navigateTo('ForecastUpdates')} 
        />
        
        <SettingsItem 
          title="Location Sharing" 
          onPress={() => navigateTo('LocationSharing')} 
        />
        
        <Divider />
        
        {/* More Section */}
        <SectionHeader title="More" />
        
        <SettingsItem 
          title="About us" 
          onPress={() => openWebLink('https://www.youtube.com/watch?v=f_WuRfuMXQw')}
        />
        
        <SettingsItem 
          title="Privacy policy" 
          onPress={() => openWebLink('https://www.youtube.com/watch?v=f_WuRfuMXQw')}
        />
        
        <SettingsItem 
          title="Terms and conditions" 
          onPress={() => openWebLink('https://www.youtube.com/watch?v=f_WuRfuMXQw')}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#333',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    paddingBottom: 15,
    paddingHorizontal: 20,
    backgroundColor: '#333',
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerRight: {
    width: 30, 
  },
  settingsContainer: {
    flex: 1,
    backgroundColor: '#333',
  },
  contentContainer: {
    paddingBottom: 30, 
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  sectionHeaderText: {
    fontSize: 14,
    color: '#888',
    fontWeight: '500',
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    paddingHorizontal: 20,
    backgroundColor: '#333',
  },
  settingsText: {
    fontSize: 16,
    color: '#fff',
  },
  divider: {
    height: 1,
    backgroundColor: '#444',
    marginHorizontal: 20,
    marginVertical: 10,
  }
});