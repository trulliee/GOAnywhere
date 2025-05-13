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
  StatusBar,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import P2PDriver from './P2PDriver';
import P2PPublicTrans from './P2PPublicTrans';
import { cleanInstruction, shortenText, getManeuverIcon, getLineColor } from './P2PHelper';
import { useNavigation, useRoute } from '@react-navigation/native';

const { width, height } = Dimensions.get('window');
const DEFAULT_REGION = {
  latitude: 1.3521, longitude: 103.8198,
  latitudeDelta: 0.05, longitudeDelta: 0.05
};

export default function P2PNavigation() {
  const { params } = useRoute();
  const paramDest = params?.endLocation; 
  const navigation = useNavigation();
  const mapRef = useRef(null);

  const [region, setRegion] = useState(DEFAULT_REGION);
  const [startLocation, setStartLocation] = useState('');
  const [endLocation, setEndLocation] = useState('');
  const [originLoading, setOriginLoading] = useState(true);
  const autoSearched = useRef(false);

  const [routes, setRoutes] = useState({ driver: [], public: [] });
  const [activeTab, setActiveTab] = useState('driver');
  const [publicFilter, setPublicFilter] = useState('Any');
  const [bottomVisible, setBottomVisible] = useState(false);
  const [loadingRoutes, setLoadingRoutes] = useState(false);

  const [selectedRoute, setSelectedRoute] = useState(null);
  const [showRoutePreview, setShowRoutePreview] = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.BestForNavigation });
      setRegion(r => ({ ...r, latitude: loc.coords.latitude, longitude: loc.coords.longitude }));
      try {
        const res = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?latlng=${loc.coords.latitude},${loc.coords.longitude}&key=AIzaSyDzdl-AzKqD_NeAdrz934cQM6LxWEHYF1g`
        );
        const json = await res.json();
        const addr = json.results?.[0]?.formatted_address;
        setStartLocation(addr || '');
      } catch {
        setStartLocation('');
      }
      setOriginLoading(false);
    })();
  }, []);

    // once origin loaded, copy over the incoming home‐screen destination
    useEffect(() => {
      if (!originLoading && paramDest) {
        setEndLocation(paramDest);
      }
    }, [originLoading, paramDest]);


    useEffect(() => {
      if (
        !originLoading           && 
        paramDest                && 
        endLocation === paramDest &&
        !autoSearched.current
      ) {
        autoSearched.current = true;
        handleSearch();
      }
    }, [originLoading, endLocation, paramDest]);

  useEffect(() => {
  const showSub = Keyboard.addListener('keyboardDidShow', () => {
    setBottomVisible(false);
  });
  return () => showSub.remove();
  }, []);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showRoutePreview) { setShowRoutePreview(false); return true; }
      if (selectedRoute)   { setSelectedRoute(null);    return true; }
      if (bottomVisible)   { setBottomVisible(false);   return true; }
      return false;
    });
    return () => sub.remove();
  }, [showRoutePreview, selectedRoute, bottomVisible]);

  
  const handleSearch = async () => {
    Keyboard.dismiss();
    if (!startLocation || !endLocation) {
      return Alert.alert('Missing Info', 'Please fill both fields.');
    }
    if (startLocation.trim().toLowerCase() === endLocation.trim().toLowerCase()) {
      return Alert.alert('Invalid', 'Origin and destination must differ.');
    }

    setLoadingRoutes(true);
    try {
      const [d, p] = await Promise.all([
        P2PDriver(startLocation, endLocation),
        P2PPublicTrans(startLocation, endLocation)
      ]);
      d.sort((a, b) => a.durationValue - b.durationValue);
      p.sort((a, b) => a.durationValue - b.durationValue);
      setRoutes({ driver: d, public: p });
      setSelectedRoute(null);
      setBottomVisible(true);
    } catch (e) {
      Alert.alert('Routing Error', e.message);
    } finally {
      setLoadingRoutes(false);
    }
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
          setSelectedRoute(route);     // You’ve picked this path
          setBottomVisible(false);// Hide the sheet
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
                      { backgroundColor: ti.vehicleType === 'SUBWAY' ? getLineColor(ti.lineName) : '#75beff' }
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


  const RouteOverview = () => {
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
          <View style={{ width: 24 }} />
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
                <Text style={styles.summaryTitle}>
                  <Text>{shortenText(startLocation)}</Text>
                  <Text> to </Text>
                  <Text>{shortenText(endLocation)}</Text>
                </Text>
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
                              getLineColor(isTransit.lineName) : "#75beff"} 
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
                          To:{' '}
                          <Text>
                            {isTransit.arrivalStop}
                            {isTransit.exitNumber ? ` ${isTransit.exitNumber}` : ''}
                          </Text>
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
            onPress={() => {
              setShowRoutePreview(false);
              setSelectedRoute(null);
              setBottomVisible(true);
            }}
          >
            <Text style={styles.chooseAnotherText}>Choose Another</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.startNavigationButton} 
            onPress={() => {
              navigation.navigate('Navigation', {
                mode: activeTab,
                polyline: selectedRoute.polyline,
                steps:     selectedRoute.steps,
                markers:   selectedRoute.markers
              });
              setShowRoutePreview(false);
            }}
          >
            <Text style={styles.startNavigationText}>Start Navigation</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
      <View style={styles.container}>

        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          region={region}
          showsUserLocation
        >
          {selectedRoute && !showRoutePreview && (
            <Polyline
              coordinates={selectedRoute.polyline}
              strokeWidth={5}
              strokeColor={activeTab==='driver'? '#0066CC':'#E51A1E'}
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

        {/* Search Bar */}
        {!selectedRoute && !showRoutePreview &&  (

          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.inputArea}>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder={originLoading ? "Getting current location..." : "Current Location"}
                  placeholderTextColor="#888"
                  value={startLocation}
                  onChangeText={setStartLocation}
                  editable={!originLoading}   
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
                style={[styles.searchButton, (originLoading || loadingRoutes) && styles.disabledButton]}
                onPress={handleSearch}
                disabled={originLoading || loadingRoutes}
              >
                <Text style={styles.searchButtonText}>
                  {(originLoading || loadingRoutes) ? 'Loading…' : 'Find Routes'}
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        )}

        {/* Route List */}
        {bottomVisible && !selectedRoute && !showRoutePreview && (
          <View style={styles.bottomSheet}>
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

            {/* Public filter */}
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
              {(activeTab === 'driver'
                ? routes.driver
                : routes.public.filter(r => {
                    if (publicFilter === 'Bus Only') return r.type === 'Bus Only';
                    if (publicFilter === 'MRT Only') return r.type === 'MRT Only';
                    return true;
                  })
              ).map(renderRouteOption)}
            </ScrollView>
          </View>
        )}

        {/* Selected Route Action */}
        {selectedRoute && !showRoutePreview && (
          <View style={styles.routeInfoBar}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => {
                setSelectedRoute(null);
                setBottomVisible(true);
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

        {showRoutePreview && selectedRoute && <RouteOverview/>}

      </View>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { position: 'absolute', width: '100%', height: '100%' },
  inputArea: { backgroundColor: 'transparent', paddingHorizontal: 16, paddingVertical: 8, zIndex: 10 },
  inputContainer: { backgroundColor: '#fff', borderRadius: 8, padding: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3, marginBottom: 12 },
  input: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#ddd', color: '#000', paddingVertical: 12, fontSize: 16 },
  lastInput: { borderBottomWidth: 0 },
  searchButton: { backgroundColor: '#444', padding: 16, borderRadius: 8, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  disabledButton: { backgroundColor: '#666', opacity: 0.7 },
  searchButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  filter: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#eee' },
  warningText: { color: '#ff6600', fontSize: 12, marginTop: 8 },
  routeCard: { backgroundColor: 'white', borderRadius: 10, padding: 16, marginBottom: 12, elevation: 2 },
  routeHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  routeDuration: { color: '#000', fontWeight: 'bold', fontSize: 16 },
  routeDistance: { color: '#555', fontSize: 14 },
  driverRouteSummary: { flexDirection: 'row', alignItems: 'center' },
  routeInfoBar: { position: 'absolute', top: StatusBar.currentHeight || 0, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#393939', padding: 12, borderRadius: 8, zIndex: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3 },
  backButton: { padding: 8 },
  routeDetails: { flex: 1, paddingHorizontal: 12 },
  routeInfoText: { color: 'white', fontSize: 14, fontWeight: '500' },
  routeInfoDetails: { flexDirection: 'row', marginTop: 4 },
  routeDurationText: { color: '#ccc', fontSize: 12, marginRight: 12 },
  routeDistanceText: { color: '#ccc', fontSize: 12 },
  startNavButton: { backgroundColor: '#666', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
  startNavText: { color: 'white', fontWeight: 'bold' },
  driverRouteText: { color: '#333', marginLeft: 8, fontSize: 14 },
  transitRouteSummary: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  transitItem: { flexDirection: 'row', alignItems: 'center', marginRight: 12, marginBottom: 4 },
  transitIcon: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 4 },
  transitText: { color: '#333', fontSize: 13 },
  bottomSheet: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: '#393939', borderTopLeftRadius: 15, borderTopRightRadius: 15, padding: 16, maxHeight: height * 0.5 },
  tabRowContainer: { marginVertical: 10, backgroundColor: '#4a4a4a', borderRadius: 10, flexDirection: 'row', marginBottom: 16, padding: 5 },
  tab: { flexDirection: 'row', flex: 1, padding: 10, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  activeTab: { backgroundColor: '#666' },
  tabText: { color: '#aaa', fontWeight: 'bold', fontSize: 16, marginLeft: 6 },
  activeTabText: { color: '#fff' },
  filterRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  filterButton: { paddingVertical: 8, paddingHorizontal: 15, borderRadius: 8, backgroundColor: '#555' },
  activeFilter: { backgroundColor: 'white' },
  filterText: { color: 'white', fontSize: 15, fontWeight: 'bold' },
  activeFilterText: { color: '#333' },
  routePreviewContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 15 },
  previewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, backgroundColor: '#222' },
  backButtonPreview: { padding: 8 },
  previewTitle: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  routeSummaryBox: { marginTop: 16, marginHorizontal: 10, backgroundColor: '#444', borderRadius: 12, padding: 16 },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryIconContainer: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#666', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  summaryDetails: { flex: 1 },
  summaryTitle: { color: 'white', fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  summaryMetrics: { flexDirection: 'row', flexWrap: 'wrap' },
  summaryMetric: { color: '#ccc', fontSize: 14, marginRight: 12 },
  issuesText: { color: '#ffcc00', fontSize: 14, marginTop: 4 },
  instructionsScroll: { flex: 1 },
  instructionsContainer: { padding: 16 },
  instructionsTitle: { color: 'white', fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  instructionItem: { flexDirection: 'row', marginBottom: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#555' },
  instructionNumberCircle: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#666', justifyContent: 'center', alignItems: 'center', marginRight: 12, marginTop: 2 },
  instructionNumber: { color: 'white', fontSize: 14, fontWeight: 'bold' },
  instructionContent: { flex: 1 },
  instructionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  instructionTitle: { color: 'white', fontSize: 16, fontWeight: '500', marginLeft: 8, flex: 1 },
  instructionDetail: { color: '#ccc', fontSize: 14, marginTop: 2 },
  previewActions: { flexDirection: 'row', padding: 16, backgroundColor: '#222', justifyContent: 'space-between' },
  chooseAnotherButton: { backgroundColor: '#555', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 16, flex: 1, marginRight: 8, alignItems: 'center' },
  chooseAnotherText: { color: 'white', fontWeight: 'bold' },
  startNavigationButton: { backgroundColor: '#4CAF50', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 16, flex: 1, marginLeft: 8, alignItems: 'center' },
  startNavigationText: { color: 'white', fontWeight: 'bold' },
  infoText: { color: '#fff', marginHorizontal: 8 },
});
