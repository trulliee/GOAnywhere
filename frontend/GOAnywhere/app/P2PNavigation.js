import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Dimensions, TouchableWithoutFeedback,
  Keyboard, ScrollView, BackHandler
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import P2PPublicTrans from './P2PPublicTrans';
import P2PDriver from './P2PDriver';
import { useNavigation } from '@react-navigation/native';


const { height, width } = Dimensions.get('window');

const P2PNavigation = () => {
  const navigation = useNavigation();
  const [startLocation, setStartLocation] = useState('');
  const [endLocation, setEndLocation] = useState('');
  const [currentRegion, setCurrentRegion] = useState(null);
  const [routes, setRoutes] = useState({ driver: [], public: [] });
  const [activeTab, setActiveTab] = useState('driver');
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [bottomSheetVisible, setBottomSheetVisible] = useState(false);
  const [publicFilter, setPublicFilter] = useState('Any');


  useEffect(() => {
    requestLocationPermission();
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (selectedRoute) {
        setSelectedRoute(null);
        setExpanded(false);
        return true;
      }
      return false;
    });
    return () => backHandler.remove();
  }, [selectedRoute]);

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
    try {
        const driverRoutes = await P2PDriver(startLocation, endLocation);
        const publicRoutes = await P2PPublicTrans(startLocation, endLocation);
      
        driverRoutes.sort((a, b) => parseFloat(a.duration) - parseFloat(b.duration));
        publicRoutes.sort((a, b) => parseFloat(a.duration) - parseFloat(b.duration));
      
        setRoutes({ driver: driverRoutes || [], public: publicRoutes || [] });
        setBottomSheetVisible(true);
        setSelectedRoute(null);
        setExpanded(false);
    } catch (error) {
      console.error('Error fetching paths:', error);
    }
  };

  const shortenText = (text) => {
    if (!text) return '';
    return text.length > 60 ? text.slice(0, 57) + '...' : text;
  };

  const cleanInstruction = (text) => {
    if (!text) return '';
    let cleaned = text.replace(/<[^>]+>/g, '');
    cleaned = cleaned.replace(/([a-z])([A-Z])/g, '$1 $2');
    return cleaned;
  };

  const capitalizeWords = (text) => {
    if (!text) return '';
    return text.split(' ').map(word => word.length > 2 ? word.charAt(0).toUpperCase() + word.slice(1) : word.toUpperCase()).join(' ');
  };

  const getDriverStepSummary = (steps) => {
    if (!steps) return '';
    const importantSteps = steps.map(step => {
      const cleanInstr = cleanInstruction(step.instruction).toLowerCase();
      if (cleanInstr.includes('onto')) {
        const match = cleanInstr.match(/onto (.+?)$/);
        return match ? capitalizeWords(match[1]) : null;
      } else if (cleanInstr.includes('toward')) {
        const match = cleanInstr.match(/toward (.+?)$/);
        return match ? capitalizeWords(match[1]) : null;
      } else {
        return null;
      }
    }).filter((road, index, self) => road && self.indexOf(road) === index);
    return importantSteps.join(' > ');
  };

  const getPublicStepSummary = (steps) => {
    if (!steps) return '';
    return steps.map(step => {
      if (step.transitInfo) {
        if (step.transitInfo.vehicleType === 'SUBWAY') {
          return `${step.transitInfo.lineName} Line toward ${step.transitInfo.headsign} (${step.transitInfo.numStops} stops)`;
        } else {
          const lines = Array.isArray(step.transitInfo.lineNames)
            ? step.transitInfo.lineNames.join(' / ')
            : step.transitInfo.lineName;
          return `Bus ${lines}`;
        }
      } else {
        return `Walk ${step.distance}`;
      }
    }).join(' \n');
  };
  

  const countTransfers = (steps) => {
    if (!steps) return 0;
    return steps.filter(step => step.transitInfo).length - 1;
  };

  const countStations = (steps) => {
    if (!steps) return 0;
    return steps.reduce((acc, step) => {
      if (step.transitInfo) acc += step.transitInfo.numStops;
      return acc;
    }, 0);
  };

  const renderRouteOption = (route, index) => (
    <TouchableOpacity
      key={index}
      style={styles.routeCard}
      onPress={() => {
        setSelectedRoute(route);
        setBottomSheetVisible(false);
      }}
    >
      <Text style={styles.routeTitle}>
        Path {index + 1}: 
      </Text>
      <Text style={styles.routeSummary}>
        {activeTab === 'driver'
          ? getDriverStepSummary(route.steps)
          : getPublicStepSummary(route.steps)}
      </Text>
      <Text style={styles.routeSubSummary}>
        {route.duration} ({route.distance})
        {activeTab === 'public' && ` • ${countStations(route.steps)} station${countStations(route.steps) > 1 ? 's' : ''}, ${countTransfers(route.steps)} transfer${countTransfers(route.steps) !== 1 ? 's' : ''}`}
      </Text>

    </TouchableOpacity>
  );

return (
  <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
  <View style={styles.container}>
    <MapView
      style={styles.map}
      region={
        currentRegion || {
          latitude: 1.3521,
          longitude: 103.8198,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }
      }
    >
      {selectedRoute?.polyline && (
        <Polyline coordinates={selectedRoute.polyline} strokeWidth={4} strokeColor="blue" />
      )}
      {selectedRoute?.markers?.map((marker, i) => (
        <Marker key={i} coordinate={marker} title={marker.title} />
      ))}
    </MapView>

    {!selectedRoute && (
      <View style={styles.topSection}>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Start Location"
            placeholderTextColor="#aaa"
            value={startLocation}
            onChangeText={setStartLocation}
          />
          <TextInput
            style={styles.input}
            placeholder="End Location"
            placeholderTextColor="#aaa"
            value={endLocation}
            onChangeText={setEndLocation}
          />
        </View>
        <TouchableOpacity style={styles.searchButton} onPress={handleSearchPaths}>
          <Text style={styles.searchButtonText}>Search Path</Text>
        </TouchableOpacity>
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
            {['Any', 'Bus', 'MRT'].map(f => (
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
              // 1) take a shallow copy, 2) sort by duration, 3) render
              ? routes.driver
                  .slice()
                  .sort((a, b) => toMinutes(a.duration) - toMinutes(b.duration))
              : routes.public
                  .filter(r => {
                    if (publicFilter === 'Bus') return r.type === 'Bus Only';
                    if (publicFilter === 'MRT') return r.type === 'MRT Only';
                    return true;
                  })
                  .slice()
                  .sort((a, b) => toMinutes(a.duration) - toMinutes(b.duration))
          ).map(renderRouteOption)}
        </ScrollView>
      </View>
    )}
        {/* Selected route details */}
        {selectedRoute && (
          <View style={styles.selectedTopBar}>
            <View style={styles.topDarkBox}>
              <TouchableOpacity
                onPress={() => {
                  setSelectedRoute(null);
                  setExpanded(false);
                }}
                style={styles.backButtonWrapper}
              >
                <Text style={styles.backButton}>{'<'}</Text>
              </TouchableOpacity>
              <Text style={styles.routeName}>
                {shortenText(startLocation)} ➔ {shortenText(endLocation)}
              </Text>
              <View style={styles.quickInfoRow}>
                <View style={styles.infoBox}>
                  <Text style={styles.quickInfoText}>🕒 {selectedRoute.duration}</Text>
                </View>
                <View style={styles.infoBox}>
                  <Text style={styles.quickInfoText}>📏 {selectedRoute.distance}</Text>
                </View>
              </View>
            </View>
  
            <TouchableOpacity onPress={() => setExpanded(!expanded)}>
              <Text style={styles.arrowButton}>{expanded ? '▲' : '▼'}</Text>
            </TouchableOpacity>
  
            {expanded && (
              <ScrollView style={styles.expandedPanel}>
                {selectedRoute.steps.map((step, idx) => {
                  const ti = step.transitInfo;
                  return (
                    <View
                      key={idx}
                      style={{
                        flexDirection: 'row',
                        paddingVertical: 6,
                        borderBottomColor: '#555',
                        borderBottomWidth: 1,
                        marginHorizontal: 10,
                      }}
                    >
                      <Text style={{ flex: 2, color: 'white', fontSize: 12 }}>
                        {ti
                          ? `${ti.vehicleType === 'SUBWAY' ? 'MRT' : 'Bus'} ${ti.lineName} Line` +
                            (ti.headsign ? ` toward ${ti.headsign}` : '') +
                            ` — board at ${ti.departureStop}, alight at ${ti.arrivalStop}` +
                            ` (${ti.numStops} stops)`
                          : shortenText(cleanInstruction(step.instruction))}
                      </Text>
                      <Text
                        style={{
                          flex: 1,
                          color: 'white',
                          fontSize: 12,
                          textAlign: 'right',
                        }}
                      >
                        {step.distance}
                      </Text>
                    </View>
                  );
                })}
  
                <TouchableOpacity
                  style={{
                    marginTop: 20,
                    backgroundColor: 'white',
                    padding: 12,
                    borderRadius: 10,
                    alignSelf: 'center',
                    width: '60%',
                  }}
                  onPress={() => {
                    setSelectedRoute(null);
                    setExpanded(false);
  
                    if (activeTab === 'driver') {
                      navigation.navigate('DriverNavigator', {
                        polyline: selectedRoute.polyline,
                        steps: selectedRoute.steps,
                        markers: selectedRoute.markers,
                      });
                    } else {
                      navigation.navigate('PublicTransNavigator', {
                        polyline: selectedRoute.polyline,
                        steps: selectedRoute.steps,
                        markers: selectedRoute.markers,
                      });
                    }
                  }}
                >
                  <Text style={{ color: 'black', fontWeight: 'bold', textAlign: 'center' }}>
                    Start Navigation
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        )}
      </View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#393939' },
  map: { position: 'absolute', width: '100%', height: '100%' },
  topSection: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: '#393939', padding: 8 },
  inputContainer: { backgroundColor: 'white', borderRadius: 15, padding: 8, overflow: 'hidden' },
  input: { backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#ccc', color: 'black', marginBottom: 5, paddingHorizontal: 8, paddingVertical: 6, fontSize: 14 },
  searchButton: { backgroundColor: 'white', padding: 12, borderRadius: 10, marginTop: 8 },
  searchButtonText: { color: 'black', fontWeight: 'bold', textAlign: 'center' },
  bottomSheet: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: '#393939', borderTopLeftRadius: 15, borderTopRightRadius: 15, padding: 10, maxHeight: height * 0.5 },
  tabRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 10 },
  tab: { padding: 10 },
  activeTab: { borderBottomWidth: 2, borderBottomColor: 'white' },
  tabText: { color: 'white', fontWeight: 'bold' },
  routeCard: { backgroundColor: 'white', borderRadius: 10, padding: 10, marginBottom: 10, elevation: 2 },
  routeTitle: { color: 'black', fontWeight: 'bold', fontSize: 16 },
  routeSummary: { color: 'black', fontSize: 14, marginVertical: 4 },
  routeSubSummary: { color: 'black', fontSize: 12 },
  selectedTopBar: { position: 'absolute', width: '100%', alignItems: 'center', backgroundColor: '#393939', borderBottomLeftRadius: 15, borderBottomRightRadius: 15 },  topDarkBox: { backgroundColor: '#393939', borderTopLeftRadius: 15, borderTopRightRadius: 15, borderBottomLeftRadius: 15, borderBottomRightRadius: 15, width: '95%', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 15 },
  backButtonWrapper: { position: 'absolute', left: 10, top: 10 },
  backButton: { fontSize: 22, color: 'white' },
  routeName: { fontSize: 16, fontWeight: 'bold', color: 'white', textAlign: 'center', marginTop: 0 },
  quickInfoRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 8 },
  infoBox: { backgroundColor: '#4D4D4D', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 10, marginHorizontal: 10 },
  quickInfoText: { color: 'white', fontSize: 12, textAlign: 'center' },
  arrowButton: { fontSize: 22, color: 'white', marginBottom: 2 },
  expandedPanel: { marginTop: 0, backgroundColor: '#393939', width: '100%', height: height },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  filterButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#4D4D4D',
  },
  activeFilter: {
    backgroundColor: 'white',
  },
  filterText: {
    color: 'white',
    fontWeight: 'bold',
  },
  activeFilterText: {
    color: 'black',
  }
});

export default P2PNavigation;
