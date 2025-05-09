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
  Platform
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons, MaterialIcons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import P2PPublicTrans from './P2PPublicTrans';
import P2PDriver from './P2PDriver';
import { useNavigation } from '@react-navigation/native';

const { width, height } = Dimensions.get('window');

const P2PNavigation = () => {
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
  const [showReportPanel, setShowReportPanel] = useState(false);

  useEffect(() => {
    requestLocationPermission();
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showReportPanel) {
        setShowReportPanel(false);
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
    return () => backHandler.remove();
  }, [selectedRoute, isNavigating, showReportPanel]);

  const requestLocationPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    const { latitude, longitude } = (await Location.getCurrentPositionAsync()).coords;
    setCurrentRegion({
      latitude,
      longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
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

  const startNavigation = () => {
    if (!selectedRoute) return;
    setIsNavigating(true);
    setExpanded(false);
    setCurrentStep(0);
    
    // Fit the map to the route
    if (mapRef.current && selectedRoute.polyline) {
      const coordinates = selectedRoute.polyline;
      mapRef.current.fitToCoordinates(coordinates, {
        edgePadding: { top: 100, right: 50, bottom: 200, left: 50 },
        animated: true
      });
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
          <Text style={styles.navLocationText}>Current Location</Text>
          <TouchableOpacity style={styles.homeButton}>
            <Text style={styles.homeButtonText}>Home</Text>
          </TouchableOpacity>
        </View>
        
        {activeTab === 'driver' ? (
          <View style={styles.drivingInfoContainer}>
            <View style={styles.speedLimitCircle}>
              <Text style={styles.speedLimitText}>100</Text>
            </View>
            
            {nextInstruction && (
              <View style={styles.nextInstructionBox}>
                <View style={styles.navigationIconContainer}>
                  <MaterialIcons name="turn-right" size={40} color="#fff" />
                </View>
                <View style={styles.instructionTextContainer}>
                  <Text style={styles.turnDirectionText}>TURN RIGHT</Text>
                  <Text style={styles.distanceText}>IN 500M</Text>
                </View>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.publicTransitContainer}>
            <View style={styles.transitInfoRow}>
              <View style={styles.transitTypeIcon}>
                <MaterialIcons name="directions-bus" size={24} color="#fff" />
              </View>
              <Text style={styles.transitLineText}>
                {isTransit ? isTransit.lineName : ''} Bus Stops
              </Text>
              <View style={styles.stopsCircle}>
                <Text style={styles.stopsNumber}>
                  {isTransit ? isTransit.numStops : '?'}
                </Text>
              </View>
            </View>
            
            <View style={styles.transitInfoRow}>
              <View style={styles.transitTypeIcon}>
                <MaterialIcons name="train" size={24} color="#fff" />
              </View>
              <Text style={styles.transitLineText}>
                {isTransit && isTransit.vehicleType === 'SUBWAY' ? isTransit.lineName : ''} Stations
              </Text>
              <View style={styles.stopsCircle}>
                <Text style={styles.stopsNumber}>
                  {isTransit && isTransit.vehicleType === 'SUBWAY' ? isTransit.numStops : '0'}
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
                        <View style={styles.timelineDot} />
                        <View style={styles.timelineContent}>
                          <Text style={styles.timelineLocation}>
                            {ti ? ti.departureStop : cleanInstruction(step.instruction)}
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
        )}
        
        <TouchableOpacity 
          style={styles.expandButton} 
          onPress={() => setExpanded(!expanded)}>
          <Ionicons name={expanded ? "chevron-down" : "chevron-up"} size={24} color="#fff" />
        </TouchableOpacity>
        
        {/* Bottom controls for navigation */}
        <View style={styles.navigationControls}>
          <TouchableOpacity style={styles.controlButton} onPress={() => setShowReportPanel(true)}>
            <View style={styles.controlIconContainer}>
              <MaterialCommunityIcons name="car-brake-alert" size={28} color="#fff" />
            </View>
            <Text style={styles.controlText}>Accident</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.controlButton}>
            <View style={styles.controlIconContainer}>
              <FontAwesome5 name="hard-hat" size={28} color="#fff" />
            </View>
            <Text style={styles.controlText}>Road Works</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.controlButton}>
            <View style={styles.controlIconContainer}>
              <MaterialIcons name="people" size={28} color="#fff" />
            </View>
            <Text style={styles.controlText}>High Crowd</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };
  
  const renderReportPanel = () => {
    if (!showReportPanel) return null;
    
    return (
      <View style={styles.reportPanel}>
        <View style={styles.reportHeader}>
          <TouchableOpacity onPress={() => setShowReportPanel(false)}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.reportTitle}>Report Issue</Text>
          <View style={{ width: 24 }} /> {/* Empty view for balance */}
        </View>
        
        <View style={styles.reportOptionsContainer}>
          <View style={styles.reportOptionsRow}>
            <TouchableOpacity style={styles.reportOption}>
              <View style={styles.reportIconContainer}>
                <MaterialCommunityIcons name="car-brake-alert" size={32} color="#fff" />
              </View>
              <Text style={styles.reportOptionText}>Accident</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.reportOption}>
              <View style={styles.reportIconContainer}>
                <FontAwesome5 name="hard-hat" size={32} color="#fff" />
              </View>
              <Text style={styles.reportOptionText}>Road Works</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.reportOption}>
              <View style={styles.reportIconContainer}>
                <MaterialIcons name="people" size={32} color="#fff" />
              </View>
              <Text style={styles.reportOptionText}>High Crowd</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.reportOptionsRow}>
            <TouchableOpacity style={styles.reportOption}>
              <View style={styles.reportIconContainer}>
                <MaterialCommunityIcons name="weather-cloudy" size={32} color="#fff" />
              </View>
              <Text style={styles.reportOptionText}>Weather</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.reportOption}>
              <View style={styles.reportIconContainer}>
                <MaterialIcons name="warning" size={32} color="#fff" />
              </View>
              <Text style={styles.reportOptionText}>Hazard</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.reportOption}>
              <View style={styles.reportIconContainer}>
                <MaterialIcons name="local-police" size={32} color="#fff" />
              </View>
              <Text style={styles.reportOptionText}>Police</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.reportOptionsRow}>
            <TouchableOpacity style={styles.reportOption}>
              <View style={styles.reportIconContainer}>
                <MaterialIcons name="pan-tool" size={32} color="#fff" />
              </View>
              <Text style={styles.reportOptionText}>Details</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.reportOption}>
              <View style={styles.reportIconContainer}>
                <MaterialIcons name="map" size={32} color="#fff" />
              </View>
              <Text style={styles.reportOptionText}>Mark on Map</Text>
            </TouchableOpacity>
            
            <View style={styles.reportOption}>
              {/* Empty for balance */}
            </View>
          </View>
        </View>
      </View>
    );
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

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          region={
            currentRegion || {
              latitude: 1.3521,
              longitude: 103.8198,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }
          }
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

        {searchMode && !isNavigating && (
          <View style={styles.topSection}>
            {!selectedRoute ? (
              <>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="Current Location"
                    placeholderTextColor="#888"
                    value={startLocation}
                    onChangeText={setStartLocation}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Home"
                    placeholderTextColor="#888"
                    value={endLocation}
                    onChangeText={setEndLocation}
                  />
                </View>
                
                {/* Removed public transport and driver timing buttons */}
                
                <TouchableOpacity style={styles.searchButton} onPress={handleSearchPaths}>
                  <Text style={styles.searchButtonText}>Find Routes</Text>
                </TouchableOpacity>
              </>
            ) : (
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
                
                <TouchableOpacity style={styles.startNavButton} onPress={startNavigation}>
                  <Text style={styles.startNavText}>Start</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {bottomSheetVisible && (
          <View style={styles.bottomSheet}>
            <View style={styles.tabRow}>
              <TouchableOpacity
                onPress={() => setActiveTab('driver')}
                style={[styles.tab, activeTab === 'driver' && styles.activeTab]}
              >
                <Text style={styles.tabText}>Driver</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setActiveTab('public')}
                style={[styles.tab, activeTab === 'public' && styles.activeTab]}
              >
                <Text style={styles.tabText}>Public Transport</Text>
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
        
        {isNavigating && renderNavigationView()}
        {showReportPanel && renderReportPanel()}
      </View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#393939' 
  },
  map: { 
    position: 'absolute', 
    width: '100%', 
    height: '100%' 
  },
  topSection: { 
    position: 'absolute', 
    top: 0, 
    left: 0, 
    right: 0, 
    backgroundColor: '#393939', 
    padding: 12, 
    zIndex: 10,
    borderBottomLeftRadius: 15,
    borderBottomRightRadius: 15,
  },
  inputContainer: { 
    backgroundColor: '#555', 
    borderRadius: 8, 
    padding: 8, 
    overflow: 'hidden',
    marginBottom: 10, // Added margin for spacing
  },
  input: { 
    backgroundColor: '#555', 
    borderBottomWidth: 1, 
    borderBottomColor: '#777', 
    color: 'white', 
    marginBottom: 8, 
    paddingHorizontal: 8, 
    paddingVertical: 8, 
    fontSize: 14 
  },
  searchButton: { 
    backgroundColor: '#555', 
    padding: 12, 
    borderRadius: 8, 
  },
  searchButtonText: { 
    color: 'white', 
    fontWeight: 'bold', 
    textAlign: 'center' 
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
  tabRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-around', 
    marginBottom: 16 
  },
  tab: { 
    padding: 10,
    width: '45%',
    alignItems: 'center',
  },
  activeTab: { 
    borderBottomWidth: 2, 
    borderBottomColor: 'white' 
  },
  tabText: { 
    color: 'white', 
    fontWeight: 'bold',
    fontSize: 16,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#393939',
    padding: 12,
    borderRadius: 8,
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
  drivingInfoContainer: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  speedLimitCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'white',
    borderWidth: 3,
    borderColor: 'black',
    justifyContent: 'center',
    alignItems: 'center',
    margin: 16,
  },
  speedLimitText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'black',
  },
  nextInstructionBox: {
    position: 'absolute',
    bottom: -240,
    backgroundColor: '#333',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    width: '80%',
    justifyContent: 'center',
  },
  navigationIconContainer: {
    marginRight: 16,
  },
  instructionTextContainer: {
    alignItems: 'center',
  },
  turnDirectionText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 18,
  },
  distanceText: {
    color: 'white',
    fontSize: 14,
    marginTop: 4,
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
  expandButton: {
    position: 'absolute',
    bottom: 200,
    alignSelf: 'center',
    backgroundColor: '#333',
    width: 50,
    height: 30,
    borderBottomLeftRadius: 15,
    borderBottomRightRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
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
  timelineContent: {
    flex: 1,
  },
  timelineLocation: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
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
  reportPanel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '90%',
    marginBottom: 24,
  },
  reportTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  reportOptionsContainer: {
    width: '90%',
    backgroundColor: '#333',
    borderRadius: 16,
    padding: 20,
  },
  reportOptionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  reportOption: {
    width: '30%',
    alignItems: 'center',
  },
  reportIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#555',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  reportOptionText: {
    color: 'white',
    fontSize: 12,
    textAlign: 'center',
  },
});

export default P2PNavigation;