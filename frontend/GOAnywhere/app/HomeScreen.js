
// app/HomeScreen.js
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
  PanResponder,
  Dimensions
} from 'react-native';
import { useRouter } from 'expo-router';
import MapView, { Marker } from 'react-native-maps';
import Collapsible from 'react-native-collapsible';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TextInput } from 'react-native';
import AuthService from './authService';
import WarningIcon from '../assets/images/triangle-exclamation-solid.svg';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
// Commented out Firebase imports until configured
// import { db } from './firebaseConfig';
// import { collection, addDoc } from 'firebase/firestore';
import { MaterialIcons, MaterialCommunityIcons, Ionicons, FontAwesome, FontAwesome5  } from '@expo/vector-icons';

import ENV from './env';
import { API_URL } from './utils/apiConfig';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';

const GOOGLE_MAPS_API_KEY = "AIzaSyDHIQoHjcVR0RsyKG-U5myMIpdPqK6n-m0";

// Get screen dimensions
const SCREEN_WIDTH = Dimensions.get('window').width;
const SIDEBAR_WIDTH = SCREEN_WIDTH * 0.8; // 80% of screen width

export default function HomeScreen() {
  const navigation = useNavigation();
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
  const [isDraggingSidebar, setIsDraggingSidebar] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);

  
  // Crowdsourced Menu
  const [reportOpen, setReportOpen]       = useState(false);
  const reportAnim                        = useRef(new Animated.Value(Dimensions.get('window').height * 0.45)).current;
  const [reportMode, setReportMode]       = useState(null); // 'driver' | 'public'
  const driverCategories                  = ["Accident","Road Works","Police","Weather","Hazard","Map Issue"];
  const publicCategories                  = ["Accident","Transit Works","High Crowd","Weather","Hazard","Delays","Map Issue"];
  const categoryIcons = {
    Accident:      { name: "car-crash",             lib: "FontAwesome5" },
    "Road Works":  { name: "hard-hat",              lib: "FontAwesome5" },
    Police:        { name: "user-secret",           lib: "FontAwesome5" },
    Weather:       { name: "cloud",                 lib: "FontAwesome5" },
    Hazard:        { name: "exclamation-triangle",  lib: "FontAwesome5" },
    "Map Issue":   { name: "map-marked",            lib: "FontAwesome5" },
    "Transit Works":{ name: "train",                lib: "FontAwesome5" },
    "High Crowd":  { name: "people",                lib: "MaterialIcons" },
    Delays:        { name: "hand-paper",            lib: "FontAwesome5" }
  };


  // start empty; we'll load (or init) from AsyncStorage in useEffect
  const [savedLocations, setSavedLocations] = useState([]);

  const getNextSavedName = () => {
    const others = savedLocations.slice(2).map(l => l.name);
    const nums = others
      .map(n => parseInt(n.replace('Saved ', ''), 10))
      .filter(n => !isNaN(n))
      .sort((a, b) => a - b);
    let i = 1;
    for (const n of nums) {
      if (n === i) i++;
      else break;
    }
    return `Saved ${i}`;
  };


  useEffect(() => {
    AsyncStorage.getItem('mySavedLocations')
      .then(json => {
        let list = json ? JSON.parse(json) : [];

        // ensure Home exists at index 0
        if (!list.find(l => l.name === 'Home')) {
          list.unshift({ name: 'Home', address: '' });
        }
        // ensure Work exists at index 1
        if (!list.find(l => l.name === 'Work')) {
          // if Home is at 0, insert Work at 1
          list.splice(1, 0, { name: 'Work', address: '' });
        }

        // save back (so next time it's already there)
        AsyncStorage.setItem('mySavedLocations', JSON.stringify(list));
        setSavedLocations(list);
      })
      .catch(console.warn);
  }, []);
  


  const persistSaved = fullList => {
    // always keep Home & Work
    const fixed = fullList.slice(0, 2)

    // drop any extra where name _or_ address is blank
    const others = fullList
      .slice(2)
      .filter(loc =>
        loc.name.trim()    !== '' &&
        loc.address.trim() !== ''
      )

    const newList = [ ...fixed, ...others ]
    setSavedLocations(newList)
    AsyncStorage.setItem('mySavedLocations', JSON.stringify(others))
  }
  const toggleReport = () => {
    Animated.timing(reportAnim, {
      toValue: reportOpen
        ? Dimensions.get('window').height - 25
        : Dimensions.get('window').height * 0.45,
      duration: 300,
      useNativeDriver: false,
    }).start();
    setReportOpen(o => {
      const opening = !o;
      if (opening) setReportMode('driver');   // default to Driver when opening
      return opening;
    });
  };
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
      const reportData = {
        reportType,
        username: userName,
        userId:   user?.uid || 'anonymous',
        timestamp: Date.now(),
        latitude:  location.latitude,
        longitude: location.longitude
      };

      console.log('Sending report to backend:', reportData);
      console.log("Using URL:", `${API_URL}/crowd/submit-crowd-data`);

      await fetch(`${API_URL}/crowd/submit-crowd-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reportData),   
      });

      Alert.alert("Report Submitted", `You reported: ${reportType}`);
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
    const q = location.address;
    setSearchInput(q);
    setIsModalVisible(false);
    navigation.navigate('P2PNavigation', { endLocation: q });
  };
  
  const handleHistoryPress = (entry) => {
    const q = entry.name;
    setSearchInput(q);
    setIsModalVisible(false);
    handleSearch(q);
  };
  
  const handleSearch = async (query) => {
    const toSearch = (query !== undefined ? query : searchInput).trim();
    if (!toSearch) {
      alert('Please enter a location.');
      return;
    }

    try {
      // 1) Geocode
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(toSearch)}&key=${GOOGLE_MAPS_API_KEY}`
      );
      setIsModalVisible(false);
      const data = await response.json();

      if (data.results.length === 0) {
        alert('Location not found.');
        return;
      }

      const result = data.results[0];
      const detailedAddress = result.formatted_address;

      // 2) Persist to your history
      const newEntry = { name: toSearch, address: detailedAddress };
      const updatedHistory = [
        newEntry,
        ...locationHistory.filter(e => e.address !== detailedAddress)
      ];
      const trimmed = updatedHistory.slice(0, 20);
      setLocationHistory(trimmed);
      await AsyncStorage.setItem('locationHistory', JSON.stringify(trimmed));

      // 3) Hand off to your Navigation screen instead of dropping a marker
      navigation.navigate('P2PNavigation', {
        endLocation: detailedAddress
      });

    } catch (error) {
      console.error('Error fetching location:', error);
      alert('Could not fetch location.');
    }
  };

  // Handle logout
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
              router.replace("./");
            } catch (error) {
              console.error('Error logging out:', error);
              Alert.alert("Error", "Failed to logout. Please try again.");
            }
          } 
        }
      ]
    );
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
          setIsDraggingSidebar(true);
          sidebarPosition.setValue(Math.max(-SIDEBAR_WIDTH, -SIDEBAR_WIDTH + gestureState.dx));
          newPosition = Math.min(0, -SIDEBAR_WIDTH + gestureState.dx);

        } else if (gestureState.dx < 0 && isSidebarVisible) {
          // Swiping left when sidebar is visible
          setIsDraggingSidebar(true);
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
        setIsDraggingSidebar(false);

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
      setIsSidebarVisible(false);
    });
  };

  const [locationHistory, setLocationHistory] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const json = await AsyncStorage.getItem('locationHistory');
        if (json) setLocationHistory(JSON.parse(json));
      } catch (e) {
        console.error('Failed to load history', e);
      }
    })();
  }, []);

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

  useFocusEffect(
    useCallback(() => {
      const refreshUserName = async () => {
        try {
          const userData = await AuthService.getCurrentUser();
          if (userData && userData.name) {
            setUserName(userData.name.toUpperCase());
          }
        } catch (error) {
          console.error("Error refreshing user name on focus:", error);
        }
      };

      refreshUserName();
    }, [])
  );

  const toggleTraffic = () => {
    setTrafficExpanded(!trafficExpanded);
  };

  const navigateTo = (screen) => {
    router.push(`./${screen}`);
    hideSidebar(); 
  };

  const overlayOpacity = sidebarPosition.interpolate({
    inputRange: [-SIDEBAR_WIDTH, 0],
    outputRange: [0, 0.5],
    extrapolate: 'clamp',
  });

  return (
    <SafeAreaView style={styles.container} {...panResponder.panHandlers}>
      {/* Google Maps (Centered) */}      
      <MapView 
        style={styles.smallMap} 
        region={mapRegion}
        scrollEnabled={!isSidebarVisible && !isDraggingSidebar}
        zoomEnabled={!isSidebarVisible && !isDraggingSidebar}
      >
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
              <View style={styles.modalContainer}>
                <ScrollView style={{ flex: 1 }}>
                  {/* Search Input */}
                  <View style={styles.modalSearchRow}>
                    <TextInput
                      style={styles.modalSearchInput}
                      placeholder="Enter location"
                      value={searchInput}
                      onChangeText={setSearchInput}
                    />
                    <TouchableOpacity onPress={() => handleSearch()}>
                      <Ionicons name="search" size={24} color="#333" />
                    </TouchableOpacity>
                  </View>

                  {/* Saved Locations */}
                  <ScrollView
                    horizontal
                    style={styles.savedLocationRow}
                    showsHorizontalScrollIndicator={false}
                  >
                  {savedLocations.map((loc, index) => {
                    // pick icon: home/work stay fixed, others get a star
                    const iconName =
                      loc.name === 'Home'
                        ? 'home'
                        : loc.name === 'Work'
                          ? 'briefcase'
                          : 'star';
                    return (
                      <TouchableOpacity
                        key={index}
                        style={styles.savedLocationButton}
                        onPress={() => handleSavedPress(loc)}
                      >
                        <Ionicons name={iconName} size={24} />
                        <Text>{loc.name}</Text>
                        {loc.address ? (
                          <Text style={styles.savedAddressText} numberOfLines={1}>
                            {loc.address}
                          </Text>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                    <TouchableOpacity
                      style={[styles.savedLocationButton, styles.editSavedButton]}
                      onPress={() => setEditModalVisible(true)}
                    >
                      <FontAwesome name="edit" size={24} />
                      <Text>Edit</Text>
                    </TouchableOpacity>
                  </ScrollView>

                  {/* Location History */}
                  <View style={styles.locationHistoryScroll}>
                    {locationHistory.map((entry, index) => (
                      <TouchableOpacity
                        key={index}
                        onPress={() => handleHistoryPress(entry)}
                        style={styles.historyEntry}
                      >
                        <Ionicons name="time-outline" size={28} style={{ marginRight: 5 }} />
                        <View style={styles.historyTextContainer}>
                          <Text style={styles.historyTitle}>{entry.name}</Text>
                          <Text style={styles.historySubtitle}>{entry.address}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {!isSidebarVisible && !reportOpen && (
        <TouchableOpacity 
          style={styles.hamburgerButton}
          onPress={() => { if (!reportOpen) showSidebar() }}
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

      {/* Unified Crowdsourced Button & Bottom Sheet */}
      {reportOpen && (
        <Animated.View style={[styles.reportSheet, { top: reportAnim }]}>
          <TouchableOpacity
            style={[styles.closeButton, { top: 10, bottom: 15 }]}
            onPress={toggleReport}
          >
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>

          <View style={styles.headerRow}>
            {/* Driver / Public Transport pills */}
            <View style={styles.modeSelector}>
              <TouchableOpacity
                style={[styles.modeButton, reportMode === 'driver' && styles.modeButtonActive]}
                onPress={() => setReportMode('driver')}
              >
                <Text style={[styles.modeText, reportMode === 'driver' && styles.modeTextActive]}>Driver</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeButton, reportMode === 'public' && styles.modeButtonActive]}
                onPress={() => setReportMode('public')}
              >
                <Text style={[styles.modeText, reportMode === 'public' && styles.modeTextActive]}>Public Transport</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* category grid */}
          <ScrollView
            style={styles.reportScroll}                     
            contentContainerStyle={styles.reportContent}    
            showsVerticalScrollIndicator={false}
          >
            {(reportMode === 'driver' ? driverCategories : publicCategories).map(cat => {
              const { name, lib } = categoryIcons[cat];
              const Icon = lib === 'MaterialIcons' ? MaterialIcons : FontAwesome5;
              return (
                <View key={cat} style={styles.reportButtonWrapper}>
                  <TouchableOpacity
                    style={styles.reportButton}
                    onPress={() => submitCrowdsourcedReport(cat)}
                  >
                    <Icon name={name} size={30} color="#fff" />
                  </TouchableOpacity>
                  <Text style={styles.reportLabel}>{cat}</Text>
                </View>
              );
            })}
          </ScrollView>
        </Animated.View>
      )}


      {!reportOpen && !isSidebarVisible && (
        <TouchableOpacity style={styles.crowdsourceButton} onPress={toggleReport}>
          <WarningIcon width={36} height={36} />
        </TouchableOpacity>
      )}
      
    
      
      {editModalVisible && (
        <Modal
          transparent
          animationType="slide"
          onRequestClose={() => setEditModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.editModalContainer}>
              <Text style={styles.sheetTitle}>Manage Saved Locations</Text>
              <ScrollView>
                {savedLocations.map((loc, i) => (
                  <View key={i} style={styles.editRow}>
                    {i < 2 ? (
                      // Home/Work: only address
                      <TextInput
                        style={[styles.editInput, { flex: 7 }]}
                        placeholder={`Enter ${loc.name} Address`}
                        value={loc.address}
                        onChangeText={addr => {
                          const copy = [...savedLocations];
                          copy[i].address = addr;
                          setSavedLocations(copy);
                        }}
                      />
                    ) : (
                      // Extras: name (3) + address (7) + trash
                      <>
                        <TextInput
                          style={[styles.editInput, { flex: 3 }]}
                          placeholder="Name"
                          value={loc.name}
                          onChangeText={name => {
                            const copy = [...savedLocations];
                            copy[i].name = name;
                            setSavedLocations(copy);
                          }}
                        />
                        <TextInput
                          style={[styles.editInput, { flex: 7, marginLeft: 8 }]}
                          placeholder="Address"
                          value={loc.address}
                          onChangeText={addr => {
                            const copy = [...savedLocations];
                            copy[i].address = addr;
                            setSavedLocations(copy);
                          }}
                        />
                        <TouchableOpacity
                          onPress={() => {
                            const copy = savedLocations.filter((_, idx) => idx !== i);
                            setSavedLocations(copy);
                          }}
                          style={{ marginLeft: 8 }}
                        >
                          <Ionicons name="trash" size={24} color="red" />
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                ))}
              </ScrollView>

              <TouchableOpacity
                style={styles.editButton}
                onPress={() => {
                  const nextName = getNextSavedName();
                  const copy = [
                    ...savedLocations,
                    { name: nextName, address: '' }
                  ];
                  setSavedLocations(copy);
                }}
              >
                <Text style={styles.editButtonText}>Add New</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.editButton}
                onPress={() => {
                  // on Done: drop any extras with empty name OR address
                  const filtered = savedLocations.filter((loc, i) => {
                    if (i < 2) return true;
                    return loc.name.trim() !== '' && loc.address.trim() !== '';
                  });
                  persistSaved(filtered);
                  setEditModalVisible(false);
                }}
              >
                <Text style={styles.editButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
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
          <TouchableOpacity
            onPress={() => navigateTo('EditProfile')}
          >
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
              <Text style={styles.menuText}>Predictions</Text>
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
              onPress={() => navigateTo('PredictCongestion')}
            >
              <Text style={styles.submenuText}>Traffic Congestions</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.submenuItem} 
              onPress={() => navigateTo('PredictTravel')}
            >
              <Text style={styles.submenuText}>Travel Times</Text>
            </TouchableOpacity>
          </Collapsible>

          {/* Navigation Section */}
          <TouchableOpacity 
            style={styles.menuItem} 
            onPress={() => navigateTo('P2PNavigation')}
          >
            <View style={styles.menuItemRow}>
              <MaterialIcons name="navigation" size={24} color="#fff" style={styles.menuIcon} />
              <Text style={styles.menuText}>Navigation</Text>
            </View>
          </TouchableOpacity>

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

          {/* Weather Section */}
          <TouchableOpacity 
            style={styles.menuItem} 
            onPress={() => navigateTo('WeatherPull')}
          >
            <View style={styles.menuItemRow}>
              <Ionicons name="rainy" size={24} color="#fff" style={styles.menuIcon} />
              <Text style={styles.menuText}>Weather</Text>
            </View>
          </TouchableOpacity>

          {/* Logout Button */}
          <TouchableOpacity 
            style={styles.logoutMenuItem} 
            onPress={handleLogout}
          >
            <View style={styles.menuItemRow}>
              <Ionicons name="exit-outline" size={24} color="#fff" style={styles.menuIcon} />
              <Text style={styles.menuText}>Logout</Text>
            </View>
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>
      
      {!reportOpen && !isSidebarVisible && (
        <TouchableOpacity 
          style={styles.crowdsourceButton}
          onPress={toggleReport}
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
  logoutMenuItem: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#555',
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
    height: 250, 
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#e0e0e0",
    elevation: 5,
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
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  historyTextContainer: {
    flex: 1,                    // take up remaining width
  },
  historyTitle: {
    fontWeight: 'bold',
    fontSize: 20,
  },
  historySubtitle: {
    fontSize: 16,
    color: '#888',
    flexWrap: 'wrap',           // allow wrapping
    flexShrink: 1,
  },
  overlayTouchable: {
    flex: 1, 
    width: "100%", 
    height: "100%"
  },
  crowdsourceButton: {
    position: 'absolute',
    bottom: 130, 
    right: 20,
    width: 60,
    height: 60,
    backgroundColor: '#4A4A4A', 
    borderRadius: 15, 
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    zIndex: 99,
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

  buttonText: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 5,
  },
  hamburgerButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 100,
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 10,
    elevation: 3,
  },
  savedAddressText: {
    fontSize: 12,
    color: '#666',
    width: 70,
    textAlign: 'center'
  },
  editInput: {
    backgroundColor: '#fff',
    borderRadius: 10,      
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#ccc',
    flex: 1,
    marginVertical: 0,
  },
  editModalContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  editLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
    alignSelf: 'center',
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 12,
  },
  editButton: {
    backgroundColor: '#ccc',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginVertical: 8,
  },
  editButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  editSavedButton: {
    backgroundColor: '#ddd',
    borderColor: '#999',
  },
  modeSelector: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 8,
    marginHorizontal: 5,
    borderRadius: 8,
    backgroundColor:'rgba(255, 255, 255, 0.72)',
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor:'rgba(255,255,255,0.27)',
  },
  modeText: {
    fontSize: 14,
    color: '#333',
  },
  modeTextActive: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#eee',
  },
  reportCategoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 10,
  },
  closeButton: {
    position: 'absolute',
    top: 5,
    bottom: 5,
    right: 20,
    zIndex: 100,
  },
  closeText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  reportSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: Dimensions.get('window').height * 0.55,
    backgroundColor: '#333',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    zIndex: 50,
    paddingTop: 40,  // space for the close button
  },

  reportButton: {
    width: 60,
    height: 60,
    backgroundColor:'rgba(255,255,255,0.27)',
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },

  reportContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',   // pack tightly
    paddingHorizontal: 20,
    paddingTop: 8,                 // leave room under the pill
    paddingBottom: 20,
  },

  reportButtonWrapper: {
    width: '33%',                   // three per row
    alignItems: 'center',
    marginVertical: 4,
  },

  reportLabel: {
    color:'#fff', 
    fontSize:12,
    marginTop: 4,
    textAlign: 'center',
  },

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reportScroll: {
  flex: 1,
  }
});
