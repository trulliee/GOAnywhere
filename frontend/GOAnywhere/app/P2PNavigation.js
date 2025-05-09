import React, { useState, useEffect, useRef } from 'react';
import {
  View, 
  Text, 
  TextInput, 
  TouchableOpacity,
  StyleSheet, 
  Dimensions, 
  TouchableWithoutFeedback,
  Keyboard, 
  ScrollView, 
  BackHandler, 
  Alert,
  Image,
  Platform,
  Animated,
  StatusBar
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons, MaterialIcons, MaterialCommunityIcons, FontAwesome5, FontAwesome } from '@expo/vector-icons';
import P2PPublicTrans from './P2PPublicTrans';
import P2PDriver from './P2PDriver';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');
const GOOGLE_MAPS_API_KEY = "AIzaSyDzdl-AzKqD_NeAdrz934cQM6LxWEHYF1g";

function P2PNavigation() {
  const navigation = useNavigation();
  const mapRef = useRef(null);
  const [startLocation, setStartLocation] = useState('');
  const [endLocation, setEndLocation] = useState('');
  const [currentRegion, setCurrentRegion] = useState(null);
  const [routes, setRoutes] = useState({ driver: [], public: [] });
  const [activeTab, setActiveTab] = useState('driver');
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [bottomSheetVisible, setBottomSheetVisible] = useState(false);
  const [publicFilter, setPublicFilter] = useState('Any');
  const [searchMode, setSearchMode] = useState(true);
  const [showControls, setShowControls] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [showRoutePreview, setShowRoutePreview] = useState(false);
  const [userName, setUserName] = useState('USER');
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const locationSubscription = useRef(null);
  const bottomSheetAnimation = useRef(new Animated.Value(0)).current;
  
  // Crowdsourced reporting states
  const [showCrowdsourcedPanel, setShowCrowdsourcedPanel] = useState(false);
  const [isCrowdModalVisible, setIsCrowdModalVisible] = useState(false);
  const [reportMode, setReportMode] = useState(null); // 'driver' or 'public'
  const slideAnim = useRef(new Animated.Value(height)).current;

  // Categories for reports - updated to match the images
  const driverCategories = [
    "Accident", "Road Works", "Police",
    "Weather", "Hazard", "Map Issue"
  ];
  const publicCategories = [
    "Accident", "Transit Works", "High Crowd",
    "Weather", "Hazard", "Police",
    "Delays", "Map Issue"
  ];
  const categoryIcons = {
    "Accident": { name: "car-crash", library: "FontAwesome5" },              
    "Road Works": { name: "hard-hat", library: "FontAwesome5" },               
    "Transit Works": { name: "train", library: "FontAwesome5" },             
    "High Crowd": { name: "people", library: "MaterialIcons" },                  
    "Weather": { name: "cloud", library: "FontAwesome5" },                      
    "Hazard": { name: "exclamation-triangle", library: "FontAwesome5" },     
    "Police": { name: "user-secret", library: "FontAwesome5" },    
    "Delays": { name: "hand-paper", library: "FontAwesome5" },                        
    "Map Issue": { name: "map-marked", library: "FontAwesome5" }                    
  };
  
  // Modified: Function to show crowd reporting selection modal
  // Now directly uses the current activeTab value and shows the categories modal
  const showCrowdModal = () => {
    // Set report mode based on current tab
    setReportMode(activeTab);
  };

  // Function to hide crowd reporting selection modal
  const hideCrowdModal = () => {
    Animated.timing(slideAnim, {
      toValue: height,
      duration: 300,
      useNativeDriver: true,
    }).start(() => setIsCrowdModalVisible(false));
  };

  // Function to handle report mode selection (keeping for backward compatibility)
  const handleReportModeSelect = (mode) => {
    Animated.timing(slideAnim, {
      toValue: height,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setIsCrowdModalVisible(false);
      setReportMode(mode);
    });
  };

  useEffect(() => {
    requestLocationPermission();
    loadUserName();
    
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (reportMode) {
        setReportMode(null);
        return true;
      }
      if (isCrowdModalVisible) {
        hideCrowdModal();
        return true;
      }
      if (showCrowdsourcedPanel) {
        setShowCrowdsourcedPanel(false);
        return true;
      }
      if (showRoutePreview) {
        setShowRoutePreview(false);
        return true;
      }
      if (isNavigating) {
        Alert.alert(
          "End Navigation",
          "Are you sure you want to end the current navigation?",
          [
            { text: "No", style: "cancel" },
            { 
              text: "Yes", 
              onPress: () => {
                stopLocationTracking();
                setIsNavigating(false);
                setSearchMode(true);
                setSelectedRoute(null);
                setExpanded(false);
              }
            }
          ]
        );
        return true;
      }
      if (selectedRoute) {
        setSelectedRoute(null);
        setExpanded(false);
        return true;
      }
      return false;
    });
    
    return () => {
      backHandler.remove();
      stopLocationTracking();
    };
  }, [selectedRoute, isNavigating, showRoutePreview, showCrowdsourcedPanel, isCrowdModalVisible, reportMode]);

  // Load username from AsyncStorage
  const loadUserName = async () => {
    try {
      const storedName = await AsyncStorage.getItem('userName');
      if (storedName) {
        setUserName(storedName.toUpperCase());
      }
    } catch (error) {
      console.error('Error loading username:', error);
    }
  };

  useEffect(() => {
    if (showCrowdsourcedPanel) {
      // Animate bottom sheet up
      Animated.timing(bottomSheetAnimation, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false
      }).start();
    } else {
      // Animate bottom sheet down
      Animated.timing(bottomSheetAnimation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false
      }).start();
    }
  }, [showCrowdsourcedPanel]);

  const getAddressFromCoordinates = async (latitude, longitude) => {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_MAPS_API_KEY}`
      );
      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        // Get the formatted address
        return data.results[0].formatted_address;
      }
      return 'Current Location'; // Default fallback
    } catch (error) {
      console.error('Error getting address:', error);
      return 'Current Location'; // Default fallback
    }
  };

  const requestLocationPermission = async () => {
    setIsLoadingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setIsLoadingLocation(false);
        return;
      }
      
      const { latitude, longitude } = (await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation
      })).coords;
      
      setCurrentRegion({
        latitude,
        longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
      
      // Get address from coordinates and set as start location
      const address = await getAddressFromCoordinates(latitude, longitude);
      setStartLocation(address);
    } catch (error) {
      console.error('Error requesting location:', error);
      setStartLocation('Current Location'); // Default fallback
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const startLocationTracking = async () => {
    try {
      // Request permissions if not already granted
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert("Permission Required", "Location permission is needed for navigation.");
        return;
      }
      
      // Get current location accuracy
      await Location.getBackgroundPermissionsAsync();
      
      // Start watching position with high accuracy
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          distanceInterval: 10, // Update every 10 meters
          timeInterval: 1000, // Update every second
        },
        (location) => {
          // Update current region
          const { latitude, longitude, speed } = location.coords;
          
          // Convert speed from m/s to km/h
          const speedKmh = speed !== null ? Math.round(speed * 3.6) : 0;
          
          setCurrentSpeed(speedKmh);
          
          // Update map position
          if (mapRef.current && isNavigating) {
            setCurrentRegion({
              latitude,
              longitude,
              latitudeDelta: 0.005,
              longitudeDelta: 0.005,
            });
          }
          
          // Check if we've reached next waypoint
          if (selectedRoute && isNavigating) {
            checkWaypoint(latitude, longitude);
          }
        }
      );
    } catch (error) {
      console.error("Error starting location tracking:", error);
    }
  };

  const stopLocationTracking = () => {
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
  };

  const checkWaypoint = (latitude, longitude) => {
    if (!selectedRoute || currentStep >= selectedRoute.steps.length) return;
    
    const currentStepObj = selectedRoute.steps[currentStep];
    if (!currentStepObj.endLocation) return;
    
    // Check if we're within 50 meters of the waypoint
    const distance = calculateDistance(
      latitude,
      longitude,
      currentStepObj.endLocation.latitude,
      currentStepObj.endLocation.longitude
    );
    
    if (distance < 0.05) { // 50 meters threshold
      // Move to next step
      if (currentStep < selectedRoute.steps.length - 1) {
        setCurrentStep(currentStep + 1);
      }
    }
  };

  // Calculate distance between two points in km using Haversine formula
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2)
    ; 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    const d = R * c; // Distance in km
    return d;
  };

  const deg2rad = (deg) => {
    return deg * (Math.PI/180);
  };

  const toMinutes = txt => {
    let h = 0, m = 0;
    const hh = txt.match(/(\d+)\s*h/i);
    const mm = txt.match(/(\d+)\s*m/i);
    if (hh) h = +hh[1];
    if (mm) m = +mm[1];
    if (!hh && !mm) return parseFloat(txt) || Infinity;
    return h * 60 + m;
  };

  const handleSearchPaths = async () => {
    Keyboard.dismiss();
  
    if (!startLocation || !endLocation) {
      return Alert.alert(
        'Missing Info',
        'Please enter both origin and destination.'
      );
    }
  
    if (startLocation.trim().toLowerCase() === endLocation.trim().toLowerCase()) {
      return Alert.alert(
        'Invalid Route',
        'Origin and destination cannot be the same.'
      );
    }
  
    try {
      const driverRoutes = await P2PDriver(startLocation, endLocation);
      const publicRoutes = await P2PPublicTrans(startLocation, endLocation);
  
      driverRoutes.sort((a, b) => toMinutes(a.duration) - toMinutes(b.duration));
      publicRoutes.sort((a, b) => toMinutes(a.duration) - toMinutes(b.duration));
  
      setRoutes({
        driver: driverRoutes,
        public: publicRoutes
      });
      setBottomSheetVisible(true);
      setSelectedRoute(null);
      setExpanded(false);
    } catch (error) {
      console.error('Error fetching paths:', error);
      Alert.alert(
        'Routing Error',
        error.message || 'Could not fetch routes. Please check your locations.'
      );
    }
  };

  const showNavigationPreview = () => {
    if (!selectedRoute) return;
    
    // Fit the map to the route
    if (mapRef.current && selectedRoute.polyline) {
      const coordinates = selectedRoute.polyline;
      mapRef.current.fitToCoordinates(coordinates, {
        edgePadding: { top: 100, right: 50, bottom: 200, left: 50 },
        animated: true
      });
    }
    
    // Show the route preview
    setShowRoutePreview(true);
  };

  const toggleCrowdsourcedPanel = () => {
    setShowCrowdsourcedPanel(!showCrowdsourcedPanel);
  };

  // Get user's current location for the crowdsourced report
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

  // Submit a crowdsourced report
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
        userId: 'anonymous', // Use user ID if available from auth service
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
      
      // Show a success message
      Alert.alert("Report Submitted", `You reported: ${reportType} at your current location`);
      setReportMode(null);
    } catch (error) {
      console.error("Error submitting report: ", error);
      Alert.alert("Submission Failed", "Please try again.");
    }
  };

  const startNavigation = () => {
    if (!selectedRoute) return;
    setShowRoutePreview(false);
    setIsNavigating(true);
    setExpanded(false);
    setCurrentStep(0);
    setCurrentSpeed(0);
    
    // Start location tracking for speed updates
    startLocationTracking();
    
    // Fit the map to the route
    if (mapRef.current && selectedRoute.polyline) {
      const coordinates = selectedRoute.polyline;
      mapRef.current.fitToCoordinates(coordinates, {
        edgePadding: { top: 100, right: 50, bottom: 200, left: 50 },
        animated: true
      });
    }
  };

  const chooseAnotherRoute = () => {
    setShowRoutePreview(false);
    setBottomSheetVisible(true);
  };

  const renderRoutePreview = () => {
    if (!selectedRoute || !showRoutePreview) return null;
    
    return (
      <View style={styles.routePreviewContainer}>
        <View style={styles.previewHeader}>
          <TouchableOpacity 
            style={styles.backButtonPreview} 
            onPress={() => setShowRoutePreview(false)}
          >
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.previewTitle}>Route Overview</Text>
          <View style={{ width: 24 }} /> {/* For balance */}
        </View>
        
        <View style={styles.routeSummaryBox}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryIconContainer}>
              {activeTab === 'driver' ? (
                <MaterialIcons name="directions-car" size={24} color="#fff" />
              ) : (
                <MaterialIcons 
                  name={selectedRoute.type === 'Bus Only' ? "directions-bus" : 
                        selectedRoute.type === 'MRT Only' ? "train" : "multiple-stop"} 
                  size={24} 
                  color="#fff" 
                />
              )}
            </View>
            <View style={styles.summaryDetails}>
              <Text style={styles.summaryTitle}>
                <Text>{shortenText(startLocation)}</Text> to <Text>{shortenText(endLocation)}</Text>
              </Text>
              <View style={styles.summaryMetrics}>
                <Text style={styles.summaryMetric}><Text>{selectedRoute.duration}</Text></Text>
                <Text style={styles.summaryMetric}><Text>{selectedRoute.distance}</Text></Text>
                
                {selectedRoute.issues && selectedRoute.issues.length > 0 && (
                  <Text style={styles.issuesText}>
                    ⚠️ <Text>{selectedRoute.issues.join(', ')}</Text>
                  </Text>
                )}
              </View>
            </View>
          </View>
        </View>
        
        <ScrollView style={styles.instructionsScroll}>
          <View style={styles.instructionsContainer}>
            <Text style={styles.instructionsTitle}>Navigation Instructions</Text>
            
            {selectedRoute.steps.map((step, idx) => {
              const isTransit = step.transitInfo;
              
              return (
                <View key={idx} style={styles.instructionItem}>
                  <View style={styles.instructionNumberCircle}>
                    <Text style={styles.instructionNumber}>{idx + 1}</Text>
                  </View>
                  
                  <View style={styles.instructionContent}>
                    {isTransit ? (
                      <>
                        <View style={styles.instructionHeader}>
                          <MaterialIcons 
                            name={isTransit.vehicleType === 'SUBWAY' ? "train" : "directions-bus"} 
                            size={20} 
                            color={isTransit.vehicleType === 'SUBWAY' ? 
                              getLineColor(isTransit.lineName) : "#e51a1e"} 
                          />
                          <Text style={styles.instructionTitle}>
                            {isTransit.vehicleType === 'SUBWAY' ? 
                              `Take ${isTransit.lineName} Line` : 
                              `Take Bus ${isTransit.lineName}`}
                          </Text>
                        </View>
                        <Text style={styles.instructionDetail}>
                          From: <Text>{isTransit.departureStop}</Text>
                        </Text>
                        <Text style={styles.instructionDetail}>
                          To: <Text>{isTransit.arrivalStop}</Text>
                        </Text>
                        <Text style={styles.instructionDetail}>
                          <Text>{isTransit.numStops}</Text> stops
                        </Text>
                      </>
                    ) : (
                      <>
                        <View style={styles.instructionHeader}>
                          {step.maneuver ? (
                            <MaterialIcons 
                              name={getManeuverIcon(step.maneuver)} 
                              size={20} 
                              color="#fff" 
                            />
                          ) : (
                            <MaterialIcons 
                              name={step.travelMode === "WALKING" ? "directions-walk" : "arrow-forward"} 
                              size={20} 
                              color="#fff" 
                            />
                          )}
                          <Text style={styles.instructionTitle}>
                            {cleanInstruction(step.instruction)}
                          </Text>
                        </View>
                        {step.distance && (
                          <Text style={styles.instructionDetail}>
                            Distance: <Text>{step.distance}</Text>
                          </Text>
                        )}
                      </>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
        
        <View style={styles.previewActions}>
          <TouchableOpacity 
            style={styles.chooseAnotherButton} 
            onPress={chooseAnotherRoute}
          >
            <Text style={styles.chooseAnotherText}>Choose Another</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.startNavigationButton} 
            onPress={startNavigation}
          >
            <Text style={styles.startNavigationText}>Start Navigation</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Get an icon name based on the maneuver type
  const getManeuverIcon = (maneuver) => {
    switch (maneuver) {
      case 'turn-right': return 'turn-right';
      case 'turn-left': return 'turn-left';
      case 'uturn-right': return 'uturn-right';
      case 'uturn-left': return 'uturn-left';
      case 'keep-right': return 'turn-slight-right';
      case 'keep-left': return 'turn-slight-left';
      case 'merge': return 'merge';
      case 'roundabout-right': return 'roundabout-right';
      case 'roundabout-left': return 'roundabout-left';
      case 'straight': return 'arrow-upward';
      case 'fork-right': return 'turn-slight-right';
      case 'fork-left': return 'turn-slight-left';
      case 'ferry': return 'directions-boat';
      default: return 'arrow-forward';
    }
  };

  const renderNavigationView = () => {
    if (!selectedRoute || !isNavigating) return null;
    
    const currentInstruction = selectedRoute.steps[currentStep];
    const nextInstruction = currentStep < selectedRoute.steps.length - 1 
      ? selectedRoute.steps[currentStep + 1] 
      : null;
      
    const isTransit = currentInstruction.transitInfo;
    
    return (
      <View style={styles.navigationView}>
        {/* Modified navigation header to show mode */}
        <View style={styles.navigationHeader}>
          <TouchableOpacity 
            style={styles.backButtonNav} 
            onPress={() => {
              Alert.alert(
                "End Navigation",
                "Are you sure you want to end the current navigation?",
                [
                  { text: "No", style: "cancel" },
                  { 
                    text: "Yes", 
                    onPress: () => {
                      stopLocationTracking();
                      setIsNavigating(false);
                      setSearchMode(true);
                      setSelectedRoute(null);
                    }
                  }
                ]
              );
            }}
          >
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          
          {/* Added mode indicator */}
          <View style={styles.modeIndicator}>
            <MaterialIcons 
              name={activeTab === 'driver' ? "directions-car" : "directions-transit"} 
              size={20} 
              color="#fff" 
            />
            <Text style={styles.navModeText}>
              {activeTab === 'driver' ? "Driver Mode" : "Public Transit"}
            </Text>
          </View>
          
          <TouchableOpacity style={styles.homeButton}>
            <Text style={styles.homeButtonText}>Destination</Text>
          </TouchableOpacity>
        </View>
        
        {/* New Top Navigation Bar with Instructions and Speed */}
        {activeTab === 'driver' && nextInstruction && (
          <View style={styles.topNavigationBar}>
            <View style={styles.directionContainer}>
              <MaterialIcons 
                name={getManeuverIcon(nextInstruction.maneuver || 'straight')} 
                size={28} 
                color="#fff" 
              />
              <View style={styles.directionTextContainer}>
                <Text style={styles.directionMainText}>
                  <Text>{getDirectionText(nextInstruction.maneuver || 'straight')}</Text>
                </Text>
                <Text style={styles.directionDistanceText}>
                  IN <Text>{nextInstruction.distance || "1.0 km"}</Text>
                </Text>
              </View>
            </View>
            <View style={styles.speedContainer}>
              <Text style={styles.speedText}>{currentSpeed}</Text>
              <Text style={styles.speedUnit}>km/h</Text>
            </View>
          </View>
        )}
        
        {activeTab === 'public' ? (
          <View style={styles.publicTransitContainer}>
            <View style={styles.transitInfoRow}>
              <View style={styles.transitTypeIcon}>
                <MaterialIcons name="directions-bus" size={24} color="#fff" />
              </View>
              <Text style={styles.transitLineText}>
                <Text>{isTransit ? isTransit.lineName : ''}</Text> Bus Stops
              </Text>
              <View style={styles.stopsCircle}>
                <Text style={styles.stopsNumber}>
                  <Text>{isTransit ? isTransit.numStops : '?'}</Text>
                </Text>
              </View>
            </View>
            
            <View style={styles.transitInfoRow}>
              <View style={styles.transitTypeIcon}>
                <MaterialIcons name="train" size={24} color="#fff" />
              </View>
              <Text style={styles.transitLineText}>
                <Text>{isTransit && isTransit.vehicleType === 'SUBWAY' ? isTransit.lineName : ''}</Text> Stations
              </Text>
              <View style={styles.stopsCircle}>
                <Text style={styles.stopsNumber}>
                  <Text>{isTransit && isTransit.vehicleType === 'SUBWAY' ? isTransit.numStops : '0'}</Text>
                </Text>
              </View>
            </View>
            
            <View style={styles.walkingInfoRow}>
              <View style={styles.walkingIcon}>
                <MaterialIcons name="directions-walk" size={24} color="#fff" />
              </View>
              <Text style={styles.walkingText}>30 Minutes of Walking</Text>
            </View>
            
            {expanded && (
              <ScrollView style={styles.transitDetailScroll}>
                <View style={styles.timelineContainer}>
                  {selectedRoute.steps.map((step, idx) => {
                    const ti = step.transitInfo;
                    const isActive = idx === currentStep;
                    
                    return (
                      <View key={idx} style={styles.timelineItem}>
                        <View style={[
                          styles.timelineDot, 
                          isActive && styles.activeTimelineDot
                        ]} />
                        <View style={styles.timelineContent}>
                          <Text style={[
                            styles.timelineLocation, 
                            isActive && styles.activeTimelineText
                          ]}>
                            <Text>{ti ? ti.departureStop : cleanInstruction(step.instruction)}</Text>
                          </Text>
                          {ti && (
                            <View style={[styles.transitLineIndicator, { backgroundColor: getLineColor(ti.lineName) }]}>
                              <Text style={styles.transitLineName}>{ti.lineName}</Text>
                            </View>
                          )}
                          <Text style={styles.timelineTime}>{step.distance}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            )}
          </View>
        ) : null}
        
        {/* Bottom up arrow button for crowdsourced reports */}
        <TouchableOpacity 
          style={styles.upArrowButton} 
          onPress={toggleCrowdsourcedPanel}
        >
          <Ionicons 
            name={showCrowdsourcedPanel ? "chevron-down" : "chevron-up"}
            size={24} 
            color="#fff" 
          />
        </TouchableOpacity>
        
        {/* Animated Crowdsourced Panel */}
        <Animated.View 
          style={[
            styles.crowdsourcedPanel,
            {
              transform: [
                {
                  translateY: bottomSheetAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [height, height - 200]
                  })
                }
              ]
            }
          ]}
        >
          <View style={styles.reportButtonsRow}>
            <TouchableOpacity style={styles.reportButton} onPress={() => submitCrowdsourcedReport("Accident")}>
              <View style={styles.reportIconCircle}>
                <MaterialCommunityIcons name="car-brake-alert" size={28} color="#fff" />
              </View>
              <Text style={styles.reportButtonText}>Accident</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.reportButton} onPress={() => submitCrowdsourcedReport("Road Works")}>
              <View style={styles.reportIconCircle}>
                <FontAwesome5 name="hard-hat" size={28} color="#fff" />
              </View>
              <Text style={styles.reportButtonText}>Road Works</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.reportButton} onPress={() => submitCrowdsourcedReport("High Crowd")}>
              <View style={styles.reportIconCircle}>
                <MaterialIcons name="people" size={28} color="#fff" />
              </View>
              <Text style={styles.reportButtonText}>High Crowd</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.reportsScrollView}>
            <View style={styles.recentReportsContainer}>
              <Text style={styles.reportsTitle}>Recent Reports</Text>
              
              <View style={styles.reportItem}>
                <View style={styles.reportItemIcon}>
                  <MaterialCommunityIcons name="car-brake-alert" size={20} color="#fff" />
                </View>
                <View style={styles.reportItemContent}>
                  <Text style={styles.reportItemTitle}>Accident</Text>
                  <Text style={styles.reportItemDetails}>Reported 5 min ago • 1.2km ahead</Text>
                </View>
              </View>
              
              <View style={styles.reportItem}>
                <View style={[styles.reportItemIcon, { backgroundColor: '#ff9800' }]}>
                  <FontAwesome5 name="hard-hat" size={20} color="#fff" />
                </View>
                <View style={styles.reportItemContent}>
                  <Text style={styles.reportItemTitle}>Road Works</Text>
                  <Text style={styles.reportItemDetails}>Reported 30 min ago • 3.5km ahead</Text>
                </View>
              </View>
              
              <View style={styles.reportItem}>
                <View style={[styles.reportItemIcon, { backgroundColor: '#2196f3' }]}>
                  <MaterialIcons name="people" size={20} color="#fff" />
                </View>
                <View style={styles.reportItemContent}>
                  <Text style={styles.reportItemTitle}>High Crowd</Text>
                  <Text style={styles.reportItemDetails}>Reported 15 min ago • 2.8km ahead</Text>
                </View>
              </View>
            </View>
          </ScrollView>
        </Animated.View>
        
          {/* Fixed Navigation Controls at Bottom - Modified to match image styles */}
          <View style={styles.navigationControls}>
            {/* These buttons now use the icons matching the images */}
            <TouchableOpacity style={styles.controlButton} onPress={() => submitCrowdsourcedReport("Accident")}>
              <View style={styles.controlIconContainer}>
                <FontAwesome5 name="car-crash" size={24} color="#fff" />
              </View>
              <Text style={styles.controlText}>Accident</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.controlButton} onPress={() => submitCrowdsourcedReport(activeTab === 'driver' ? "Road Works" : "Transit Works")}>
              <View style={styles.controlIconContainer}>
                {activeTab === 'driver' ? (
                  <FontAwesome5 name="hard-hat" size={24} color="#fff" />
                ) : (
                  <FontAwesome5 name="train" size={24} color="#fff" />
                )}
              </View>
              <Text style={styles.controlText}>{activeTab === 'driver' ? "Road Works" : "Transit Works"}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.controlButton} onPress={() => submitCrowdsourcedReport(activeTab === 'driver' ? "Police" : "High Crowd")}>
              <View style={styles.controlIconContainer}>
                {activeTab === 'driver' ? (
                  <FontAwesome5 name="user-secret" size={24} color="#fff" />
                ) : (
                  <MaterialIcons name="people" size={24} color="#fff" />
                )}
              </View>
              <Text style={styles.controlText}>{activeTab === 'driver' ? "Police" : "High Crowd"}</Text>
            </TouchableOpacity>
          </View>
      </View>
    );
  };

  // Convert maneuver to human-readable text
  const getDirectionText = (maneuver) => {
    switch (maneuver) {
      case 'turn-right': return 'TURN RIGHT';
      case 'turn-left': return 'TURN LEFT';
      case 'uturn-right': return 'MAKE U-TURN';
      case 'uturn-left': return 'MAKE U-TURN';
      case 'keep-right': return 'KEEP RIGHT';
      case 'keep-left': return 'KEEP LEFT';
      case 'merge': return 'MERGE';
      case 'roundabout-right': return 'ENTER ROUNDABOUT';
      case 'roundabout-left': return 'ENTER ROUNDABOUT';
      case 'straight': return 'CONTINUE STRAIGHT';
      case 'fork-right': return 'TAKE RIGHT FORK';
      case 'fork-left': return 'TAKE LEFT FORK';
      case 'ferry': return 'BOARD FERRY';
      default: return 'CONTINUE';
    }
  };
  
  const shortenText = (text) => {
    if (!text) return '';
    return text.length > 30 ? text.slice(0, 27) + '...' : text;
  };

  const cleanInstruction = (text) => {
    if (!text) return '';
    let cleaned = text.replace(/<[^>]+>/g, '');
    cleaned = cleaned.replace(/([a-z])([A-Z])/g, '$1, $2');
    return cleaned;
  };

  const getLineColor = (lineName) => {
    if (!lineName) return '#666';
    
    // Singapore MRT line colors
    if (lineName.includes('NS') || lineName.includes('North-South')) return '#e51a1e';
    if (lineName.includes('EW') || lineName.includes('East-West')) return '#009645';
    if (lineName.includes('CG') || lineName.includes('Circle')) return '#fa9e0d';
    if (lineName.includes('DT') || lineName.includes('Downtown')) return '#0070bb';
    if (lineName.includes('NE') || lineName.includes('North East')) return '#9e3f7c';
    if (lineName.includes('BP') || lineName.includes('Bukit Panjang')) return '#84520f';
    if (lineName.includes('SE') || lineName.includes('Sengkang')) return '#78c0e9';
    if (lineName.includes('PE') || lineName.includes('Punggol')) return '#78c0e9';
    if (lineName.includes('TE') || lineName.includes('Thomson-East Coast')) return '#9d5822';
    
    // Bus is usually red
    return '#e51a1e';
  };

  const renderRouteOption = (route, index) => {
    const warn = (route.issues && route.issues.length)
      ? `(⚠️ May be affected by ${route.issues.join(', ')})`
      : '';
  
    return (
      <TouchableOpacity
        key={index}
        style={styles.routeCard}
        onPress={() => {
          setSelectedRoute(route);
          setBottomSheetVisible(false);
        }}
      >
        <View style={styles.routeHeader}>
          <Text style={styles.routeDuration}>{route.duration}</Text>
          <Text style={styles.routeDistance}>{route.distance}</Text>
        </View>
        
        {activeTab === 'driver' ? (
          <View style={styles.driverRouteSummary}>
            <MaterialIcons name="directions-car" size={18} color="#333" />
            <Text style={styles.driverRouteText}>{route.summary}</Text>
          </View>
        ) : (
          <View style={styles.transitRouteSummary}>
            {route.steps.filter(s => s.transitInfo).map((step, idx) => {
              const ti = step.transitInfo;
              return (
                <View key={idx} style={styles.transitItem}>
                  <View style={[
                    styles.transitIcon, 
                    { backgroundColor: ti.vehicleType === 'SUBWAY' ? getLineColor(ti.lineName) : '#e51a1e' }
                  ]}>
                    <MaterialIcons 
                      name={ti.vehicleType === 'SUBWAY' ? "train" : "directions-bus"} 
                      size={16} 
                      color="#fff" 
                    />
                  </View>
                  <Text style={styles.transitText}>
                    {ti.vehicleType === 'SUBWAY' ? ti.lineName : `Bus ${ti.lineName}`}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
        
        {warn ? <Text style={styles.warningText}>{warn}</Text> : null}
      </TouchableOpacity>
    );
  };

  const renderCrowdsourcedModals = () => {
    return (
      <>
        {/* Report Categories Modal - Styled to match the provided images */}
        {reportMode && (
          <TouchableWithoutFeedback onPress={() => setReportMode(null)}>
            <View style={styles.modalOverlay}>
              <TouchableWithoutFeedback>
                <View style={styles.bottomSheet}>
                  <Text style={styles.sheetTitle}>
                    {reportMode === 'driver' ? "Driver Report" : "Public Transport Report"}
                  </Text>

                  <View style={styles.reportCategoryGrid}>
                    {(reportMode === 'driver' ? driverCategories : publicCategories).map((category, index) => {
                      const iconInfo = categoryIcons[category] || {};
                      return (
                        <TouchableOpacity
                          key={index}
                          style={styles.reportCategoryButton}
                          onPress={() => submitCrowdsourcedReport(category)}
                        >
                          <View style={styles.categoryIconContainer}>
                            {(() => {
                              if (iconInfo.library === "FontAwesome5") {
                                return <FontAwesome5 name={iconInfo.name || "question"} size={24} color="#fff" />;
                              } else if (iconInfo.library === "FontAwesome") {
                                return <FontAwesome name={iconInfo.name || "question"} size={24} color="#fff" />;
                              } else if (iconInfo.library === "MaterialCommunityIcons") {
                                return <MaterialCommunityIcons name={iconInfo.name || "help-circle"} size={24} color="#fff" />;
                              } else {
                                return <MaterialIcons name={iconInfo.name || "help"} size={24} color="#fff" />;
                              }
                            })()}
                          </View>
                          <Text style={styles.reportCategoryText}>{category}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        )}
      </>
    );
  };

  // Render a route card for the bottom of the page
  const renderRouteCard = () => {
    if (!selectedRoute && routes.driver.length > 0) {
      // Display the first route suggestion when no route is selected
      const route = routes.driver[0];
      
      return (
        <TouchableOpacity 
          style={styles.floatingRouteCard}
          onPress={() => {
            setSelectedRoute(route);
            setBottomSheetVisible(false);
          }}
        >
          <View style={styles.floatingCardTop}>
            <Text style={styles.routeDuration}>{route.duration}</Text>
            <Text style={styles.routeDistance}>{route.distance}</Text>
          </View>
          <View style={styles.floatingCardRoute}>
            <MaterialIcons name="directions-car" size={18} color="#333" />
            <Text style={styles.driverRouteText}>{route.summary}</Text>
          </View>
        </TouchableOpacity>
      );
    }
    return null;
  };

  // Updated return with a more structured layout
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />
      
      {/* Main Map View */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        region={currentRegion || {
          latitude: 1.3521,
          longitude: 103.8198,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        showsUserLocation={true}
        followsUserLocation={isNavigating}
      >
        {selectedRoute?.polyline && (
          <Polyline 
            coordinates={selectedRoute.polyline} 
            strokeWidth={5} 
            strokeColor={activeTab === 'driver' ? "#0066ff" : "#e51a1e"} 
          />
        )}
        
        {selectedRoute?.markers?.map((marker, i) => (
          <Marker 
            key={i} 
            coordinate={marker} 
            title={marker.title}
            pinColor={i === 0 ? "green" : i === selectedRoute.markers.length - 1 ? "red" : "blue"}
          />
        ))}
      </MapView>
      
      {/* Modified: Header Navigation Bar - Only displayed when not navigating */}
      {!isNavigating && !showRoutePreview && (
        <View style={styles.headerNavBar}>
          {/* Removed back button and title */}
          <View style={{width: 24}} />
          <View style={{width: 24}} />
          <View style={{width: 24}} />
        </View>
      )}

      {/* Search Input Fields - Positioned at the top but with proper spacing from header */}
      {searchMode && !isNavigating && !showRoutePreview && !selectedRoute && (
        <View style={styles.inputArea}>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder={isLoadingLocation ? "Getting current location..." : "Current Location"}
              placeholderTextColor="#888"
              value={startLocation}
              onChangeText={setStartLocation}
            />
            <TextInput
              style={[styles.input, styles.lastInput]}
              placeholder="Destination"
              placeholderTextColor="#888"
              value={endLocation}
              onChangeText={setEndLocation}
            />
          </View>
          
          <TouchableOpacity 
            style={[styles.searchButton, (isLoadingLocation) && styles.disabledButton]}
            onPress={handleSearchPaths}
            disabled={isLoadingLocation}
          >
            <Text style={styles.searchButtonText}>Find Routes</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {/* Selected Route Info */}
      {selectedRoute && searchMode && !isNavigating && !showRoutePreview && (
        <View style={styles.routeInfoBar}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => {
              setSelectedRoute(null);
              setExpanded(false);
            }}
          >
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          
          <View style={styles.routeDetails}>
            <Text style={styles.routeInfoText}>
              {shortenText(startLocation)} to {shortenText(endLocation)}
            </Text>
            <View style={styles.routeInfoDetails}>
              <Text style={styles.routeDurationText}>{selectedRoute.duration}</Text>
              <Text style={styles.routeDistanceText}>{selectedRoute.distance}</Text>
            </View>
          </View>
          
          <TouchableOpacity style={styles.startNavButton} onPress={showNavigationPreview}>
            <Text style={styles.startNavText}>Preview</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Bottom Route Card */}
      {(!selectedRoute && routes.driver.length > 0 && !bottomSheetVisible) && renderRouteCard()}
     
      {/* Route Selection Bottom Sheet */}
      {bottomSheetVisible && (
        <View style={styles.bottomSheet}>
          {/* Enhanced tab row with more prominent styling */}
          <View style={styles.tabRowContainer}>
            <TouchableOpacity
              onPress={() => setActiveTab('driver')}
              style={[styles.tab, activeTab === 'driver' && styles.activeTab]}
            >
              <MaterialIcons name="directions-car" size={20} color={activeTab === 'driver' ? "#fff" : "#aaa"} />
              <Text style={[styles.tabText, activeTab === 'driver' && styles.activeTabText]}>Driver</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setActiveTab('public')}
              style={[styles.tab, activeTab === 'public' && styles.activeTab]}
            >
              <MaterialIcons name="directions-transit" size={20} color={activeTab === 'public' ? "#fff" : "#aaa"} />
              <Text style={[styles.tabText, activeTab === 'public' && styles.activeTabText]}>Public Transport</Text>
            </TouchableOpacity>
          </View>

          {activeTab === 'public' && (
            <View style={styles.filterRow}>
              {['Any', 'Bus Only', 'MRT Only'].map(f => (
                <TouchableOpacity
                  key={f}
                  style={[styles.filterButton, publicFilter === f && styles.activeFilter]}
                  onPress={() => setPublicFilter(f)}
                >
                  <Text style={[styles.filterText, publicFilter === f && styles.activeFilterText]}>{f}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <ScrollView>
            {(
              activeTab === 'driver'
                ? routes.driver
                    .slice()
                    .sort((a, b) => toMinutes(a.duration) - toMinutes(b.duration))
                : routes.public
                    .filter(r => {
                      if (publicFilter === 'Bus Only') return r.type === 'Bus Only';
                      if (publicFilter === 'MRT Only') return r.type === 'MRT Only';
                      return true;
                    })
                    .slice()
                    .sort((a, b) => toMinutes(a.duration) - toMinutes(b.duration))
            ).map(renderRouteOption)}
          </ScrollView>
        </View>
      )}
      
      {showRoutePreview && renderRoutePreview()}
      {isNavigating && renderNavigationView()}
      
      {/* Crowdsourced reporting modals */}
      {renderCrowdsourcedModals()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#fff' 
  },
  map: { 
    position: 'absolute', 
    width: '100%', 
    height: '100%' 
  },
  headerNavBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: 'transparent',
    zIndex: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  inputArea: {
    backgroundColor: 'transparent',
    paddingHorizontal: 16,
    paddingVertical: 8,
    zIndex: 10,
  },
  inputContainer: { 
    backgroundColor: '#fff', 
    borderRadius: 8, 
    padding: 12, 
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 12,
  },
  input: { 
    backgroundColor: '#fff', 
    borderBottomWidth: 1, 
    borderBottomColor: '#ddd', 
    color: '#000', 
    paddingVertical: 12, 
    fontSize: 16 
  },
  lastInput: {
    borderBottomWidth: 0,
  },
  searchButton: { 
    backgroundColor: '#444', 
    padding: 16, 
    borderRadius: 8, 
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  disabledButton: {
    backgroundColor: '#666',
    opacity: 0.7
  },
  searchButtonText: { 
    color: 'white', 
    fontWeight: 'bold', 
    fontSize: 16,
  },
  // Floating route card at bottom
  floatingRouteCard: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  floatingCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  floatingCardRoute: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Top Navigation Bar with Turn Instructions and Speed
  topNavigationBar: {
    position: 'absolute',
    top: 60, // Just below the header
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderRadius: 8,
    padding: 12,
    zIndex: 10,
  },
  directionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  directionTextContainer: {
    marginLeft: 10,
  },
  directionMainText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  directionDistanceText: {
    color: '#ccc',
    fontSize: 14,
  },
  speedContainer: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  speedText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  speedUnit: {
    fontSize: 12,
    color: '#666',
  },
  // Crowdsourced Panel Styles
  upArrowButton: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    backgroundColor: '#333',
    width: 60,
    height: 30,
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 15,
  },
  crowdsourcedPanel: {
    position: 'absolute',
    height: 200,
    left: 0,
    right: 0,
    backgroundColor: '#333',
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    padding: 12,
    zIndex: 12,
  },
  reportButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  reportButton: {
    alignItems: 'center',
  },
  reportIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#444',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  reportButtonText: {
    color: 'white',
    fontSize: 12,
  },
  reportsScrollView: {
    flex: 1,
  },
  recentReportsContainer: {
    paddingHorizontal: 8,
  },
  reportsTitle: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  reportItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#444',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  reportItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e53935', // Red for accident
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  reportItemContent: {
    flex: 1,
  },
  reportItemTitle: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  reportItemDetails: {
    color: '#ccc',
    fontSize: 12,
  },
  bottomSheet: { 
    position: 'absolute', 
    bottom: 0, 
    width: '100%', 
    backgroundColor: '#393939', 
    borderTopLeftRadius: 15, 
    borderTopRightRadius: 15, 
    padding: 16, 
    maxHeight: height * 0.5 
  },
  tabRowContainer: {
    marginVertical: 10,
    backgroundColor: '#4a4a4a',
    borderRadius: 10,
    flexDirection: 'row',
    marginBottom: 16,
    padding: 5,
  },
  tab: { 
    flexDirection: 'row',
    padding: 10,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  activeTab: { 
    backgroundColor: '#666',
  },
  tabText: { 
    color: '#aaa', 
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 6,
  },
  activeTabText: {
    color: 'white',
  },
  routeCard: { 
    backgroundColor: 'white', 
    borderRadius: 10, 
    padding: 16, 
    marginBottom: 12, 
    elevation: 2,
  },
  routeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  routeDuration: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 16,
  },
  routeDistance: {
    color: '#555',
    fontSize: 14,
  },
  driverRouteSummary: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverRouteText: {
    color: '#333',
    marginLeft: 8,
    fontSize: 14,
  },
  transitRouteSummary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  transitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
    marginBottom: 4,
  },
  transitIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
  transitText: {
    color: '#333',
    fontSize: 13,
  },
  warningText: {
    color: '#ff6600',
    fontSize: 12,
    marginTop: 8,
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  filterButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#555',
  },
  activeFilter: {
    backgroundColor: 'white',
  },
  filterText: {
    color: 'white',
    fontWeight: '500',
    fontSize: 13,
  },
  activeFilterText: {
    color: '#333',
  },
  routeInfoBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 90,
    left: 16, 
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#393939',
    padding: 12,
    borderRadius: 8,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  backButton: {
    padding: 8,
  },
  routeDetails: {
    flex: 1,
    paddingHorizontal: 12,
  },
  routeInfoText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  routeInfoDetails: {
    flexDirection: 'row',
    marginTop: 4,
  },
  routeDurationText: {
    color: '#ccc',
    fontSize: 12,
    marginRight: 12,
  },
  routeDistanceText: {
    color: '#ccc',
    fontSize: 12,
  },
  startNavButton: {
    backgroundColor: '#666',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  startNavText: {
    color: 'white',
    fontWeight: 'bold',
  },
  // Route Preview Styles
  routePreviewContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#333',
    zIndex: 15,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#222',
  },
  backButtonPreview: {
    padding: 8,
  },
  previewTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  routeSummaryBox: {
    margin: 16,
    backgroundColor: '#444',
    borderRadius: 12,
    padding: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#666',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  summaryDetails: {
    flex: 1,
  },
  summaryTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  summaryMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  summaryMetric: {
    color: '#ccc',
    fontSize: 14,
    marginRight: 12,
  },
  issuesText: {
    color: '#ffcc00',
    fontSize: 14,
    marginTop: 4,
  },
  instructionsScroll: {
    flex: 1,
  },
  instructionsContainer: {
    padding: 16,
  },
  instructionsTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  instructionItem: {
    flexDirection: 'row',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#555',
  },
  instructionNumberCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#666',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  instructionNumber: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  instructionContent: {
    flex: 1,
  },
  instructionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  instructionTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
    flex: 1,
  },
  instructionDetail: {
    color: '#ccc',
    fontSize: 14,
    marginTop: 2,
  },
  previewActions: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#222',
    justifyContent: 'space-between',
  },
  chooseAnotherButton: {
    backgroundColor: '#555',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flex: 1,
    marginRight: 8,
    alignItems: 'center',
  },
  chooseAnotherText: {
    color: 'white',
    fontWeight: 'bold',
  },
  startNavigationButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flex: 1,
    marginLeft: 8,
    alignItems: 'center',
  },
  startNavigationText: {
    color: 'white',
    fontWeight: 'bold',
  },
  // Navigation View Styles
  navigationView: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 5,
  },
  navigationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#333',
    paddingVertical: 12,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
  },
  backButtonNav: {
    padding: 4,
  },
  navLocationText: {
    color: 'white',
    fontWeight: '500',
    fontSize: 16,
  },
  homeButton: {
    backgroundColor: '#555',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  homeButtonText: {
    color: 'white',
    fontSize: 12,
  },
  // New styles for navigation mode indicator
  modeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#555',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  navModeText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  publicTransitContainer: {
    backgroundColor: '#333',
    marginTop: 60,
    borderRadius: 12,
    padding: 16,
    width: '90%',
    alignSelf: 'center',
  },
  transitInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    backgroundColor: '#444',
    padding: 12,
    borderRadius: 8,
  },
  transitTypeIcon: {
    backgroundColor: '#666',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  transitLineText: {
    color: 'white',
    fontSize: 14,
    flex: 1,
    marginLeft: 12,
  },
  stopsCircle: {
    backgroundColor: '#e51a1e',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopsNumber: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  walkingInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#444',
    padding: 12,
    borderRadius: 8,
  },
  walkingIcon: {
    backgroundColor: '#666',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  walkingText: {
    color: 'white',
    fontSize: 14,
    marginLeft: 12,
  },
  transitDetailScroll: {
    marginTop: 16,
    maxHeight: 300,
  },
  timelineContainer: {
    paddingLeft: 8,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 24,
    position: 'relative',
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'white',
    marginRight: 12,
    marginTop: 4,
  },
  activeTimelineDot: {
    backgroundColor: '#4CAF50',
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 8,
    marginTop: 2,
  },
  timelineContent: {
    flex: 1,
  },
  timelineLocation: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  activeTimelineText: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  transitLineIndicator: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  transitLineName: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  timelineTime: {
    color: '#ccc',
    fontSize: 12,
    marginTop: 2,
  },
  navigationControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#333',
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
  },
  controlButton: {
    alignItems: 'center',
  },
  controlIconContainer: {
    backgroundColor: '#555',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  controlText: {
    color: 'white',
    fontSize: 12,
  },
  // Fixed navigation controls at bottom to use the proper icons
  navigationControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#333',
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
  },
  controlButton: {
    alignItems: 'center',
  },
  controlIconContainer: {
    backgroundColor: '#555',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  controlText: {
    color: 'white',
    fontSize: 12,
  },
  
  // Crowdsourced report modals - updated to match the images
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
    zIndex: 15,
  },
  bottomSheet: {
    backgroundColor: '#333',
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#fff'
  },
  reportCategoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  reportCategoryButton: {
    width: '32%',
    marginBottom: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#555',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  reportCategoryText: {
    fontSize: 12,
    color: '#fff',
    textAlign: 'center',
  },
});

// Use a separate export default statement 
export default P2PNavigation;