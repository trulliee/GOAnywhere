
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
  Modal,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
  PanResponder,
  Dimensions
} from 'react-native';
import { useRouter } from 'expo-router';
import MapView, { Marker } from 'react-native-maps';
import Collapsible from 'react-native-collapsible';
import { MaterialIcons } from '@expo/vector-icons';
import { TextInput, Button } from 'react-native';
import AuthService from './authService';
import WarningIcon from '../assets/images/triangle-exclamation-solid.svg';
import * as Location from 'expo-location';
// Commented out Firebase imports until configured
// import { db } from './firebaseConfig';
// import { collection, addDoc } from 'firebase/firestore';
import { Ionicons, FontAwesome } from '@expo/vector-icons';

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

  // Crowdsourced Menu
  const [isCrowdModalVisible, setIsCrowdModalVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(Dimensions.get('window').height)).current;
  const driverCategories = [
    "Accident", "Road Works", "Traffic Police",
    "Weather", "Hazard", "Map Issue"
  ];
  const publicCategories = [
    "Accident", "Transit Works", "High Crowd",
    "Weather", "Hazard", "Traffic Police",
    "Delays", "Map Issue"
  ];
  const categoryIcons = {
    "Accident": { name: "skull-outline", library: "Ionicons" },              
    "Road Works": { name: "construct", library: "Ionicons" },               
    "Transit Works": { name: "train", library: "FontAwesome" },             
    "High Crowd": { name: "people", library: "Ionicons" },                  
    "Weather": { name: "rainy", library: "Ionicons" },                      
    "Hazard": { name: "exclamation-triangle", library: "FontAwesome" },     
    "Traffic Police": { name: "shield-checkmark", library: "Ionicons" },    
    "Delays": { name: "time", library: "Ionicons" },                        
    "Map Issue": { name: "map", library: "FontAwesome" }                    
  };
  const savedLocations = [
    { name: 'Home', icon: 'home' },
    { name: 'Work', icon: 'briefcase' },
    { name: 'Add', icon: 'add' },
    { name: 'Saved 1', icon: 'star'},
    { name: 'Saved 2', icon: 'star'},
  ];
  const locationHistory = [
    { name: '168790', address: '2 Spooner Rd' },
    { name: '168790', address: '2 Spooner Rd' },
    { name: '168790', address: '2 Spooner Rd' },
    { name: '168790', address: '2 Spooner Rd' },
    { name: '168790', address: '2 Spooner Rd' },
    { name: '168790', address: '2 Spooner Rd' },
    { name: '168790', address: '2 Spooner Rd' },
    { name: '168790', address: '2 Spooner Rd' },
    { name: '168790', address: '2 Spooner Rd' },
    { name: '168790', address: '2 Spooner Rd' },
    { name: '168790', address: '2 Spooner Rd' },
    { name: '168790', address: '2 Spooner Rd' },
    { name: '168790', address: '2 Spooner Rd' },
    { name: '168790', address: '2 Spooner Rd' },
    { name: '168790', address: '2 Spooner Rd' },
    { name: '168790', address: '2 Spooner Rd' },
    { name: '168790', address: '2 Spooner Rd' },
    { name: '168790', address: '2 Spooner Rd' },
    { name: '168790', address: '2 Spooner Rd' }
  ];
  const showCrowdModal = () => {
    setReportMode(null);
    setIsCrowdModalVisible(true);
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }

  const hideCrowdModal = () => {
    Animated.timing(slideAnim, {
      toValue: Dimensions.get('window').height, // Slide off-screen
      duration: 300,
      useNativeDriver: true,
    }).start(() => setIsCrowdModalVisible(false));
  };

  const handleReportModeSelect = (mode) => {
    Animated.timing(slideAnim, {
      toValue: Dimensions.get('window').height, // Slide modal down
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setIsCrowdModalVisible(false); // hide modal
      setReportMode(mode);           // then set the mode after hiding
    });
  };
  const [reportMode, setReportMode] = useState(null); // 'driver' or 'public'

  // Get user's location for the crowdsourced report
  const getCurrentLocation = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      alert('Permission to access location was denied');
      return null;
    }
  
    let location = await Location.getCurrentPositionAsync({});
    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      timestamp: Date.now()
    };
  };

  const submitCrowdsourcedReport = async (reportType) => {
    const location = await getCurrentLocation();
    if (!location) return;
  
    try {
      // Prepare the data to send to the backend
      const reportData = {
        latitude: location.latitude,
        longitude: location.longitude,
        reportType: reportType,
        username: userName,
        userId: user?.id || 'anonymous', // Use user ID if available, otherwise default to anonymous
        timestamp: Date.now()
      };
      
      console.log('Sending report to backend:', reportData);
      
      // When you connect to backend, you'll send the data something like this:
      // await fetch('your-api-endpoint', {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify(reportData),
      // });
      
      // For now, just show a success message
      Alert.alert("Report Submitted", `You reported: ${reportType} at coordinates (${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)})`);
    } catch (error) {
      console.error("Error submitting report: ", error);
      Alert.alert("Submission Failed", "Please try again.");
    }
  };

  //Search Bar
  const [isModalVisible, setIsModalVisible] = useState(false);

  // Animated value for sidebar position
  const sidebarPosition = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  
  // Add missing handler functions
  const handleSavedPress = (location) => {
    // Implement functionality for saved location press
    console.log("Saved location pressed:", location);
    setIsModalVisible(false);
  };
  
  const handleHistoryPress = (entry) => {
    // Implement functionality for history press
    console.log("History entry pressed:", entry);
    setSearchInput(entry.address);
    setIsModalVisible(false);
  };
  
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
          newPosition = Math.max(-SIDEBAR_WIDTH, -SIDEBAR_WIDTH + gestureState.dx);
        } else if (gestureState.dx < 0 && isSidebarVisible) {
          // Swiping left when sidebar is visible
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
          // Hide sidebar if swiped left more than 50px
          finalPosition = -SIDEBAR_WIDTH;
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
          bounciness: 0, 
          speed: 15, 
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
    // Ensure animation updates properly
    Animated.timing(sidebarPosition, {
      toValue: -SIDEBAR_WIDTH,
      duration: 200, 
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

      {/* Searchbar stuff */}
      <TouchableOpacity 
        style={styles.persistentSearchBar} 
        onPress={() => setIsModalVisible(true)}
      >
        <Text style={styles.persistentSearchText}>Directions To?</Text>
        <Ionicons name="search" size={20} color="#888" />
      </TouchableOpacity>

      <Modal
        animationType="slide"
        transparent={true}
        visible={isModalVisible}
        onRequestClose={() => setIsModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setIsModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.modalContainer}
              >
                <ScrollView style={{ flex: 1 }}>
                  {/* Search Input */}
                  <View style={styles.modalSearchRow}>
                    <TextInput
                      style={styles.modalSearchInput}
                      placeholder="Enter location"
                      value={searchInput}
                      onChangeText={setSearchInput}
                    />
                    <TouchableOpacity onPress={handleSearch}>
                      <Ionicons name="search" size={24} color="#333" />
                    </TouchableOpacity>
                  </View>

                  {/* Saved Locations */}
                  <ScrollView
                    horizontal
                    style={styles.savedLocationRow}
                    showsHorizontalScrollIndicator={false}
                  >
                    {savedLocations.map((loc, index) => (
                      <TouchableOpacity
                        key={index}
                        style={styles.savedLocationButton}
                        onPress={() => handleSavedPress(loc)}
                      >
                        <Ionicons name={loc.icon} size={24} />
                        <Text>{loc.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  {/* Location History */}
                  <View style={styles.locationHistoryScroll}>
                    {locationHistory.map((entry, index) => (
                      <TouchableOpacity
                        key={index}
                        onPress={() => handleHistoryPress(entry)}
                        style={styles.historyEntry}
                      >
                        <Ionicons name="time-outline" size={28} style={{ marginRight: 5 }}/>
                        <View style={{ marginLeft: 5 }}>
                          <Text style={styles.historyTitle}>{entry.name}</Text>
                          <Text style={styles.historySubtitle}>{entry.address}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </KeyboardAvoidingView>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {!isSidebarVisible && (
        <TouchableOpacity 
          style={styles.hamburgerButton}
          onPress={showSidebar}
        >
          <Ionicons name="menu" size={28} color="#000" />
        </TouchableOpacity>
      )}

      {/* Dark overlay when sidebar is visible */}
      {isSidebarVisible ? (
        <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
          <TouchableOpacity style={styles.overlayTouchable} activeOpacity={1} onPress={hideSidebar} />
        </Animated.View>
      ) : null}

      {/* Crowdsourced Button */}
      {isCrowdModalVisible && (
        <TouchableOpacity style={styles.modalOverlay} onPress={hideCrowdModal} activeOpacity={1}>
          <Animated.View style={[
            styles.bottomSheet,
            { 
              transform: [{ translateY: slideAnim }],
              alignSelf: 'stretch'
            }
          ]}>
            <Text style={styles.sheetTitle}>Report As</Text>
            <TouchableOpacity style={styles.sheetButton} onPress={() => {
              handleReportModeSelect('driver');
              hideCrowdModal();
            }}>
              <Text style={styles.sheetButtonText}>Driver</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sheetButton} onPress={() => {
              handleReportModeSelect('public');
              hideCrowdModal();
            }}>
              <Text style={styles.sheetButtonText}>Public Transport</Text>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      )}
      
      {/* Fixed syntax error here - removed erroneous '8' */}
      {reportMode && (
        <TouchableWithoutFeedback onPress={() => setReportMode(null)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <Animated.View style={[styles.bottomSheet, { transform: [{ translateY: slideAnim }] }]}>
                <Text style={styles.sheetTitle}>
                  {reportMode === 'driver' ? "Driver Report" : "Public Transport Report"}
                </Text>

                {reportMode === 'driver' && (
                  <View style={styles.reportCategoryContainer}>
                    {driverCategories.map((category, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.reportButton}
                      onPress={() => submitCrowdsourcedReport(category)}
                    >
                      {(() => {
                        const iconInfo = categoryIcons[category] || {};
                        const IconComponent = iconInfo.library === "FontAwesome" ? FontAwesome : Ionicons;
                        return (
                          <IconComponent
                            name={iconInfo.name || "help-circle"}
                            size={28}
                            style={{ marginBottom: 5 }}
                          />
                        );
                      })()}
                      <Text style={styles.buttonText}>{category}</Text>
                    </TouchableOpacity>
                  ))}
                  </View>
                )}

                {reportMode === 'public' && (
                  <View style={styles.reportCategoryContainer}>
                    {publicCategories.map((category, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.reportButton}
                      onPress={() => submitCrowdsourcedReport(category)}
                    >
                      {(() => {
                        const iconInfo = categoryIcons[category] || {};
                        const IconComponent = iconInfo.library === "FontAwesome" ? FontAwesome : Ionicons;
                        return (
                          <IconComponent
                            name={iconInfo.name || "help-circle"}
                            size={28}
                            style={{ marginBottom: 5 }}
                          />
                        );
                      })()}
                      <Text style={styles.buttonText}>{category}</Text>
                    </TouchableOpacity>
                  ))}
                  </View>
                )}
              </Animated.View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
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
              onPress={() => navigateTo('TrafficIncidentsNav')}
            >
              <Text style={styles.submenuText}>Incidents</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.submenuItem} 
              onPress={() => navigateTo('TrafficPrediction')}
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
            onPress={() => navigateTo('Settings')}
          >
            <View style={styles.menuItemRow}>
              <MaterialIcons name="settings" size={24} color="#fff" style={styles.menuIcon} />
              <Text style={styles.menuText}>Settings</Text>
            </View>
          </TouchableOpacity>

          {/* User Management Section (Admin only) */}
          <TouchableOpacity 
            style={styles.menuItem} 
            onPress={() => navigateTo('UserManagement')}
          >
            <View style={styles.menuItemRow}>
              <MaterialIcons name="people" size={24} color="#fff" style={styles.menuIcon} />
              <Text style={styles.menuText}>User Management</Text>
            </View>
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>
      
      {!isCrowdModalVisible && !reportMode && (
        <TouchableOpacity 
          style={styles.crowdsourceButton}
          onPress={showCrowdModal}
        >
          <WarningIcon width={36} height={36} />
        </TouchableOpacity>
      )}
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
  persistentSearchBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 15,
    padding: 10,
    margin: 15,
    borderRadius: 10,
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    position: 'absolute',
    bottom: 50, 
    left: 0,
    right: 0,
    zIndex: 10,
  },
  persistentSearchText: {
    flex: 1,
    fontSize: 16,
    color: '#666',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalContainer: {
    height: '50%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  modalSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    paddingHorizontal: 10,
    marginBottom: 15,
  },
  modalSearchInput: {
    flex: 1,
    height: 40,
  },
  savedLocationRow: {
    marginBottom: 15,
  },
  savedLocationButton: {
    alignItems: 'center',
    marginRight: 15,
    padding: 10,             
    borderRadius: 10,
    backgroundColor: '#f0f0f0',
    borderWidth: 2,
    borderColor: '#333333',        
    backgroundColor: '#f0f0f0', 
    width: 80,               
    height: 80,              
    justifyContent: 'center' 
  },
  locationHistoryScroll: {
    flex: 1,
  },
  historyEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  historyTitle: {
    fontWeight: 'bold',
    fontSize: 20,
  },
  historySubtitle: {
    fontSize: 16,
    color: '#888',
  },
  overlayTouchable: {
    flex: 1, 
    width: "100%", 
    height: "100%"
  },

  crowdsourceButton: {
    position: 'absolute',
    bottom: 130, // 
    right: 20,
    width: 60,
    height: 60,
    backgroundColor: '#4A4A4A', 
    borderRadius: 15, 
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5, // for Android shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    zIndex: 99, // stays on top
  },
  
  modalOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
    zIndex: 30,
  },
  
  bottomSheet: {
    backgroundColor: '#fff',
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  
  sheetTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  
  sheetButton: {
    backgroundColor: '#f2f2f2',
    paddingVertical: 12,
    borderRadius: 10,
    marginVertical: 6,
    alignItems: 'center',
  },
  
  sheetButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },

  reportCategoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 10,
  },
  
  reportButton: {
    width: '30%',
    marginVertical: 10,
    backgroundColor: '#eee',
    paddingVertical: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  
  hamburgerButton: {
    position: 'absolute',
    top: 50,  // adjust depending on status bar
    left: 20,
    zIndex: 100,
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 10,
    elevation: 3,
  }
});