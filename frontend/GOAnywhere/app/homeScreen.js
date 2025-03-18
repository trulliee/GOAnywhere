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
import MapView, { Marker } from 'react-native-maps';
import Collapsible from 'react-native-collapsible';
import { MaterialIcons } from 'react-native-vector-icons';
import { TextInput, Button } from 'react-native';
import AuthService from './authService';

import ENV from './env';

const GOOGLE_MAPS_API_KEY = "AIzaSyDzdl-AzKqD_NeAdrz934cQM6LxWEHYF1g";


// Get screen dimensions
const SCREEN_WIDTH = Dimensions.get('window').width;
const SIDEBAR_WIDTH = SCREEN_WIDTH * 0.8; // 80% of screen width




export default function HomeScreen() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [userName, setUserName] = useState('USER');
  const [isLoading, setIsLoading] = useState(true);
  const [mapRegion, setMapRegion] = useState({
    latitude: 1.290270, // Default to Singapore
    longitude: 103.851959,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });
  const [searchInput, setSearchInput] = useState("");
  const [marker, setMarker] = useState(null);
  // State for collapsible menu sections
  const [trafficExpanded, setTrafficExpanded] = useState(false);
  const [navigationExpanded, setNavigationExpanded] = useState(false);
  const [isDraggingSidebar, setIsDraggingSidebar] = useState(false);


  // Animated value for sidebar position
  const sidebarPosition = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const handleSearch = async () => {
    if (!searchInput.trim()) {
      alert('Please enter a location.');
      return;
    }
  
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(searchInput)}&key=${GOOGLE_MAPS_API_KEY}`
      );
      const data = await response.json();
  
      if (data.results.length > 0) {
        const { lat, lng } = data.results[0].geometry.location;
        setMapRegion({ latitude: lat, longitude: lng, latitudeDelta: 0.05, longitudeDelta: 0.05 });
        setMarker({ latitude: lat, longitude: lng });
      } else {
        alert('Location not found.');
      }
    } catch (error) {
      console.error('Error fetching location:', error);
      alert('Could not fetch location.');
    }
  };
  



  // Create pan responder for swipe gesture
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (event, gestureState) => {
        // Allow swipe if the touch starts within 50 pixels from the left edge
        return gestureState.x0 <= 50;
      },

      onPanResponderMove: (event, gestureState) => {
        let newPosition = sidebarPosition._value;

        if (gestureState.dx > 0 && !isSidebarVisible && gestureState.x0 <= 50) {
          // Swiping right when sidebar is hidden and started from the left edge
          sidebarPosition.setValue(Math.max(-SIDEBAR_WIDTH, -SIDEBAR_WIDTH + gestureState.dx));
          newPosition = Math.min(0, -SIDEBAR_WIDTH + gestureState.dx);

        } else if (gestureState.dx < 0 && isSidebarVisible) {
          // Swiping left when sidebar is visible
          sidebarPosition.setValue(Math.min(0, gestureState.dx));
          newPosition = Math.max(-SIDEBAR_WIDTH, gestureState.dx);

        }
        sidebarPosition.setValue(newPosition);

      },

      onPanResponderRelease: (event, gestureState) => {
        let finalPosition = isSidebarVisible ? 0 : -SIDEBAR_WIDTH;

        if (!isSidebarVisible && gestureState.dx > 50 && gestureState.x0 <= 50) {
          // Show sidebar if swiped right more than 50px and started from the left edge
          finalPosition = 0;
          showSidebar();
        } else if (isSidebarVisible && gestureState.dx < -50) {
          finalPosition = -SIDEBAR_WIDTH;
          // Hide sidebar if swiped left more than 50px
          hideSidebar();
        } else {
          // Reset position if swipe wasn't enough
          Animated.spring(sidebarPosition, {
            toValue: isSidebarVisible ? 0 : -SIDEBAR_WIDTH,
            useNativeDriver: false,
          }).start();
        }
        Animated.spring(sidebarPosition, {
          toValue: finalPosition,
          bounciness: 0, // Remove extra bounce effect
          speed: 15, // Faster return speed to prevent detachment
          useNativeDriver: false,
        }).start();
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
    
    // Ensure animation updates properly
    Animated.timing(sidebarPosition, {
      toValue: -SIDEBAR_WIDTH,
      duration: 200, // Smooth transition
      useNativeDriver: false,
    }).start(() => {
      // This forces re-render to remove the overlay
      setIsSidebarVisible(false);
    });
  };

  useEffect(() => {
    // Load user data
    async function loadUser() {
      setIsLoading(true);
      try {
        // First check if we have the name in AsyncStorage
        const storedName = await AuthService.getUserName();
        if (storedName && storedName !== 'User') {
          setUserName(storedName.toUpperCase());
        }
        
        // Then try to get full user data from current session
        const userData = await AuthService.getCurrentUser();
        setUser(userData);
        
        if (userData) {
          const displayName = userData.name || userData.display_name || 
                              userData.email?.split('@')[0] || 'USER';
          setUserName(displayName.toUpperCase());
        }
        
        // Also try to fetch fresh user info from the server
        const freshUserInfo = await AuthService.getUserInfo();
        if (freshUserInfo && !freshUserInfo.error) {
          const freshName = freshUserInfo.name || 
                           freshUserInfo.display_name || 
                           freshUserInfo.email?.split('@')[0] || 'USER';
          setUserName(freshName.toUpperCase());
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      } finally {
        setIsLoading(false);
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
      {/* Google Maps (Centered) */}
      <MapView style={styles.smallMap} region={mapRegion}>
      {marker && <Marker coordinate={marker} title="Searched Location" />}
      </MapView>


      {/* Search Input */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Enter location"
          value={searchInput}
          onChangeText={setSearchInput}
        />
        <Button title="Search" onPress={handleSearch} />
      </View>

      {/* Dark overlay when sidebar is visible */}
      {isSidebarVisible ? (
        <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
          <TouchableOpacity style={styles.overlayTouchable} activeOpacity={1} onPress={hideSidebar} />
        </Animated.View>
      ) : null}

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
  mapWrapper: {
    flex: 1,
    justifyContent: "center", 
    alignItems: "center", 
  },
  mapContainer: {
    width: "90%",
    height: 250, // Adjust height as needed
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#e0e0e0",
    elevation: 5, // Adds shadow for a floating effect
  },
  smallMap: {
    height: "100%", 
    width: "100%",
  },
  searchContainer: {
    position: "absolute",
    bottom: 5,
    left: 5,
    right: 5,
    flexDirection: "row",
    backgroundColor: "white",
    padding: 6,
    borderRadius: 5,
    alignItems: "center",
  },
  searchInput: {
    flex: 1,
    height: 40,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 5,
    marginRight: 6,
  },
  overlayTouchable: {
    flex: 1, 
    width: "100%", 
    height: "100%"
  }
});
