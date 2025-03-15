// app/homeScreen.js
import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  SafeAreaView, 
  Alert,
  Animated,
  PanResponder,
  Dimensions
} from 'react-native';
import { useRouter } from 'expo-router';
import Collapsible from 'react-native-collapsible';
import { MaterialIcons } from 'react-native-vector-icons';
import AuthService from './authService';

import ENV from './env';
const mapboxToken = ENV.MAPBOX_ACCESS_TOKEN;

// Get screen dimensions
const SCREEN_WIDTH = Dimensions.get('window').width;
const SIDEBAR_WIDTH = SCREEN_WIDTH * 0.8; // 80% of screen width

export default function HomeScreen() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [userName, setUserName] = useState('User');
  
  // State for collapsible menu sections
  const [trafficExpanded, setTrafficExpanded] = useState(false);
  const [navigationExpanded, setNavigationExpanded] = useState(false);

  // Animated value for sidebar position
  const sidebarPosition = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);

  // Create pan responder for swipe gesture
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (event, gesture) => {
        if (gesture.dx > 0 && !isSidebarVisible) {
          // Swiping right when sidebar is hidden
          sidebarPosition.setValue(Math.max(-SIDEBAR_WIDTH, -SIDEBAR_WIDTH + gesture.dx));
        } else if (gesture.dx < 0 && isSidebarVisible) {
          // Swiping left when sidebar is visible
          sidebarPosition.setValue(Math.min(0, gesture.dx));
        }
      },
      onPanResponderRelease: (event, gesture) => {
        if (!isSidebarVisible && gesture.dx > 50) {
          // Show sidebar if swiped right more than 50px
          showSidebar();
        } else if (isSidebarVisible && gesture.dx < -50) {
          // Hide sidebar if swiped left more than 50px
          hideSidebar();
        } else {
          // Return to previous state if swipe wasn't enough
          Animated.spring(sidebarPosition, {
            toValue: isSidebarVisible ? 0 : -SIDEBAR_WIDTH,
            useNativeDriver: false,
          }).start();
        }
      },
    })
  ).current;

  // Functions to show/hide the sidebar
  const showSidebar = () => {
    setIsSidebarVisible(true);
    Animated.spring(sidebarPosition, {
      toValue: 0,
      useNativeDriver: false,
    }).start();
  };

  const hideSidebar = () => {
    setIsSidebarVisible(false);
    Animated.spring(sidebarPosition, {
      toValue: -SIDEBAR_WIDTH,
      useNativeDriver: false,
    }).start();
  };

  useEffect(() => {
    // Load user data
    async function loadUser() {
      try {
        const userData = await AuthService.getCurrentUser();
        setUser(userData);
        
        if (userData) {
          const displayName = userData.display_name || userData.name || 
                            userData.email?.split('@')[0] || 'User';
          setUserName(displayName.toUpperCase());
        } else {
          setUserName('USER');
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      }
    }
    
    loadUser();
  }, []);

  const toggleTraffic = () => {
    setTrafficExpanded(!trafficExpanded);
  };

  const toggleNavigation = () => {
    setNavigationExpanded(!navigationExpanded);
  };

  const navigateTo = (screen) => {
    router.push(`./${screen}`);
    hideSidebar(); // Hide the sidebar after navigation
  };

  // Create a semi-transparent overlay when sidebar is open
  const overlayOpacity = sidebarPosition.interpolate({
    inputRange: [-SIDEBAR_WIDTH, 0],
    outputRange: [0, 0.5],
    extrapolate: 'clamp',
  });

  return (
    <SafeAreaView style={styles.container} {...panResponder.panHandlers}>
      {/* Map View */}
      <View style={styles.mapContainer}>
        <View style={styles.mapPlaceholder}>
          <Text style={styles.mapPlaceholderText}>
            Interactive map coming soon!
          </Text>
          <Text style={styles.mapPlaceholderSubtext}>
            This is a placeholder for demonstration purposes.
          </Text>
          {/* Mock map UI */}
          <View style={styles.mockMap}>
            <View style={styles.mockRoad} />
            <View style={styles.mockRoad2} />
            <View style={styles.mockPoint} />
          </View>
        </View>
      </View>

      {/* Dark overlay when sidebar is visible */}
      {isSidebarVisible && (
        <TouchableOpacity
          style={[styles.overlay, { opacity: overlayOpacity }]}
          activeOpacity={1}
          onPress={hideSidebar}
        />
      )}

      {/* Sidebar */}
      <Animated.View style={[styles.sidebar, { transform: [{ translateX: sidebarPosition }] }]}>
        {/* User Profile Section */}
        <View style={styles.profileSection}>
          <View style={styles.profileImageContainer}>
            <View style={styles.profileImagePlaceholder}>
              <Text style={styles.profileInitial}>{userName.charAt(0)}</Text>
            </View>
          </View>
          <Text style={styles.welcomeText}>WELCOME {userName}!</Text>
          <TouchableOpacity>
            <Text style={styles.editProfileText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {/* App Title */}
        <Text style={styles.appTitle}>GOANYWHERE</Text>

        {/* Menu Items */}
        <ScrollView style={styles.menuContainer}>
          {/* Traffic Section */}
          <TouchableOpacity style={styles.menuItem} onPress={toggleTraffic}>
            <View style={styles.menuItemRow}>
              <MaterialIcons name="traffic" size={24} color="#fff" style={styles.menuIcon} />
              <Text style={styles.menuText}>Traffic</Text>
              <MaterialIcons 
                name={trafficExpanded ? "keyboard-arrow-up" : "keyboard-arrow-down"} 
                size={24} 
                color="#fff" 
                style={styles.expandIcon} 
              />
            </View>
          </TouchableOpacity>
          
          <Collapsible collapsed={!trafficExpanded}>
            <TouchableOpacity 
              style={styles.submenuItem} 
              onPress={() => navigateTo('TrafficIncident')}
            >
              <Text style={styles.submenuText}>Incidents</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.submenuItem} 
              onPress={() => navigateTo('trafficPrediction')}
            >
              <Text style={styles.submenuText}>Forecast</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.submenuItem} 
              onPress={() => navigateTo('dashboard')}
            >
              <Text style={styles.submenuText}>Dashboard</Text>
            </TouchableOpacity>
          </Collapsible>

          {/* Navigation Section */}
          <TouchableOpacity style={styles.menuItem} onPress={toggleNavigation}>
            <View style={styles.menuItemRow}>
              <MaterialIcons name="navigation" size={24} color="#fff" style={styles.menuIcon} />
              <Text style={styles.menuText}>Navigation</Text>
              <MaterialIcons 
                name={navigationExpanded ? "keyboard-arrow-up" : "keyboard-arrow-down"} 
                size={24} 
                color="#fff" 
                style={styles.expandIcon} 
              />
            </View>
          </TouchableOpacity>
          
          <Collapsible collapsed={!navigationExpanded}>
            <TouchableOpacity 
              style={styles.submenuItem} 
              onPress={() => navigateTo('P2PDriver')}
            >
              <Text style={styles.submenuText}>Driver</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.submenuItem} 
              onPress={() => navigateTo('P2PPublicTrans')}
            >
              <Text style={styles.submenuText}>Public Transport</Text>
            </TouchableOpacity>
          </Collapsible>

          {/* Notification Section */}
          <TouchableOpacity 
            style={styles.menuItem} 
            onPress={() => navigateTo('Notification')}
          >
            <View style={styles.menuItemRow}>
              <MaterialIcons name="notifications" size={24} color="#fff" style={styles.menuIcon} />
              <Text style={styles.menuText}>Notification</Text>
            </View>
          </TouchableOpacity>

          {/* Settings Section */}
          <TouchableOpacity 
            style={styles.menuItem} 
            onPress={() => navigateTo('settings')}
          >
            <View style={styles.menuItemRow}>
              <MaterialIcons name="settings" size={24} color="#fff" style={styles.menuIcon} />
              <Text style={styles.menuText}>Settings</Text>
            </View>
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  sidebar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    backgroundColor: '#393939',
    paddingTop: 40,
    zIndex: 10,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'black',
    zIndex: 5,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 15,
  },
  profileImageContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
    marginBottom: 5,
  },
  profileImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#666',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInitial: {
    fontSize: 24,
    color: '#fff',
    fontWeight: 'bold',
  },
  welcomeText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  editProfileText: {
    color: '#CCCCCC',
    fontSize: 12,
    marginTop: 2,
  },
  appTitle: {
    color: '#AAAAAA',
    fontSize: 14,
    fontWeight: 'bold',
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 10,
  },
  menuContainer: {
    flex: 1,
  },
  menuItem: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  menuItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIcon: {
    marginRight: 15,
  },
  menuText: {
    color: '#FFFFFF',
    fontSize: 16,
    flex: 1,
  },
  expandIcon: {
    marginLeft: 'auto',
  },
  submenuItem: {
    paddingVertical: 8,
    paddingLeft: 60,
  },
  submenuText: {
    color: '#CCCCCC',
    fontSize: 14,
  },
  mapContainer: {
    flex: 1,
  },
  mapPlaceholder: {
    flex: 1,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  mapPlaceholderText: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  mapPlaceholderSubtext: {
    fontSize: 14,
    textAlign: 'center',
    color: '#666',
    marginBottom: 20,
  },
  mockMap: {
    width: '100%',
    height: 300,
    backgroundColor: '#f0f0f0',
    marginTop: 20,
    position: 'relative',
  },
  mockRoad: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: 10,
    backgroundColor: '#ccc',
  },
  mockRoad2: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '30%',
    width: 10,
    backgroundColor: '#ccc',
  },
  mockPoint: {
    position: 'absolute',
    top: '50%',
    left: '30%',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'red',
    marginTop: -10,
    marginLeft: -10,
  },
});