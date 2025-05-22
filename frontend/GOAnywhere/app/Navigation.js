import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ScrollView,
  Animated,
  Easing,
  Alert
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  MaterialIcons,
  MaterialCommunityIcons,
  FontAwesome5,
  Ionicons
} from '@expo/vector-icons';
import { useRoute } from '@react-navigation/native';
import {
  calculateDistance,
  cleanInstruction,
  calculateWalkingMinutes
} from './P2PHelper';
import { API_URL } from './utils/apiConfig';

const GOOGLE_MAPS_API_KEY = 'AIzaSyDHIQoHjcVR0RsyKG-U5myMIpdPqK6n-m0';

const { width, height } = Dimensions.get('window');

export default function Navigation() {
  const { mode = 'driver', polyline, steps = [], markers } = useRoute().params || {};
  const mapRef = useRef(null);

  const [location, setLocation]                 = useState(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [instructionMain, setInstructionMain]   = useState('');
  const [instructionSub, setInstructionSub]     = useState('');
  const [currentSpeed, setCurrentSpeed]         = useState(0);
  const [userName, setUserName] = useState('USER');
  const [arrived, setArrived] = useState(false);


  const [showDetail, setShowDetail] = useState(false);
  const detailAnim                  = useRef(new Animated.Value(height)).current;

  const [reportOpen, setReportOpen] = useState(false);
  const reportAnim                  = useRef(new Animated.Value(height - 25)).current;

  // Watch user location + speed
  useEffect(() => {
		loadUserName();
    let sub;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 1, timeInterval: 1000 },
        loc => {
          setLocation(loc.coords);
          setCurrentSpeed(
            loc.coords.speed != null ? Math.round(loc.coords.speed * 3.6) : 0
          );
        }
      );
    })();
    return () => sub && sub.remove();
  }, []);

  // Update navigation instruction
useEffect(() => {
  if (!location || !steps.length || arrived) return;
  const step = steps[currentStepIndex];

  // 1) pull the true end-point of this step
  const { lat: nextLat, lng: nextLng } = step.endLocation;

  // 2) compute remaining distance in meters
  const distKm = calculateDistance(
    location.latitude, location.longitude,
    nextLat, nextLng
  );
  const dist = Math.round(distKm * 1000);

  // 3) parse the step’s nominal length from its text (e.g. "350 m" or "1.2 km")
  let stepDist = 0;
  const m = step.distance.match(/(\d+(?:\.\d+)?)\s*(km|m)/i);
  if (m) {
    stepDist = parseFloat(m[1]) * (m[2].toLowerCase() === 'km' ? 1000 : 1);
  }

  // 4) set a small, dynamic threshold (5% of the step length, at least 5 m)
  const minThreshold = 15; // you can tweak this
  const threshold = stepDist
    ? Math.max(stepDist * 0.05, minThreshold)
    : minThreshold * 2;

  // 5) only advance when truly within that threshold
  if (dist < threshold) {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(i => i + 1);
    } else {
      setArrived(true);
      Alert.alert('You have reached your destination');
    }
  }

  // 6) update the on-screen instructions
  setInstructionMain(cleanInstruction(step.instruction).toUpperCase());
  setInstructionSub(`IN ${dist} M`);
}, [location, currentStepIndex, arrived]);


  // Toggle route detail sheet
  const toggleDetail = () => {
    if (reportOpen) return; // block if crowd-source open
    Animated.timing(detailAnim, {
      toValue: showDetail ? height : height * 0.25,
      duration: 300,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false
    }).start();
    setShowDetail(d => !d);
  };

  // Toggle crowd-source panel
  const toggleReport = () => {
    if (showDetail) return; // block if route detail open
    Animated.timing(reportAnim, {
      toValue: reportOpen
        ? height - 25
        : height * 0.45,
      duration: 300,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false
    }).start();
    setReportOpen(o => !o);
  };

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


	// 1) helper to reverse-geocode
	async function fetchStreetName(lat, lng) {
		try {
			const res = await fetch(
				`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`
			);
			const json = await res.json();
			const comps = json.results[0]?.address_components || [];
			return (
				comps.find(c => c.types.includes('route'))?.long_name ||
				'Unknown Road'
			);
		} catch (e) {
			console.warn('Geocode error', e);
			return 'Unknown Road';
		}
	}

	// 2) your unified submitCrowdsourcedReport
  const submitCrowdsourcedReport = async (reportType) => {
    const loc = await getCurrentLocation();
    if (!loc) return;

    const reportData = {
      reportType,
      username: userName,
      userId: 'anonymous',
      timestamp: Date.now(),
      latitude: loc.latitude,
      longitude: loc.longitude
    };

    try {
      await fetch(`${API_URL}/crowd/submit-crowd-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reportData)
      });
      Alert.alert("Report Submitted", `You reported: ${reportType}`);
    } catch (error) {
      console.error('Error submitting report:', error);
      Alert.alert("Submission Failed", "Please try again.");
    }
    setReportOpen(false);
  };

  // Public transport totals
  const totalBusStops = steps
    .filter(s => s.transitInfo?.vehicleType === 'BUS')
    .reduce((sum, s) => sum + (s.transitInfo.numStops || 0), 0);
  const totalMrtStops = steps
    .filter(s => s.transitInfo?.vehicleType === 'SUBWAY')
    .reduce((sum, s) => sum + (s.transitInfo.numStops || 0), 0);
  const walkMins = calculateWalkingMinutes(steps);

  const busText  = location ? `${totalBusStops} bus stops` : 'Loading...';
  const mrtText  = location ? `${totalMrtStops} MRT stops`  : 'Loading...';
  const walkText = location ? `${walkMins} min walk`         : 'Loading...';

  // Crowd-source categories
  const driverCategories = ["Accident","Road Works","Police","Weather","Hazard","Map Issue"];
  const publicCategories = ["Accident","Transit Works","High Crowd","Weather","Hazard","Delays","Map Issue"];
  const categories = mode === 'driver' ? driverCategories : publicCategories;
  const rows = [];
  for (let i = 0; i < categories.length; i += 3) {
    rows.push(categories.slice(i, i + 3));
  }
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

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        showsUserLocation
        followsUserLocation={mode==='driver'}
        region={location ? {
          latitude:      location.latitude,
          longitude:     location.longitude,
          latitudeDelta:  0.005,
          longitudeDelta: 0.005
        } : undefined}
      >
        {polyline?.length > 0 && (
          <Polyline
            coordinates={polyline}
            strokeWidth={5}
            strokeColor={mode==='driver' ? '#0066CC' : '#E51A1E'}
          />
        )}
        {markers?.map((m,i)=>(
          <Marker key={i} 
            coordinate={m} 
            title={m.title}
            pinColor={i === 0 ? 'green' : 'red'}
          />
        ))}
      </MapView>

      {/* Route instruction panel */}
      <TouchableOpacity
        style={styles.instructionPanel}
        onPress={toggleDetail}
        activeOpacity={0.8}
      >
        {mode==='driver' ? (
          <View style={styles.driverRow}>
            <MaterialIcons
              name={steps[currentStepIndex]?.maneuver||'straight'}
              size={28} color="#fff"
            />
            <View style={styles.instrTextWrapper}>
              <Text style={styles.instrMain}>
                {instructionMain||'CALCULATING...'}
              </Text>
              <Text style={styles.instrSub}>{instructionSub}</Text>
            </View>
            <View style={styles.speedBadge}>
              <Text style={styles.speedText}>{currentSpeed}</Text>
              <Text style={styles.speedUnit}>km/h</Text>
            </View>
          </View>
        ) : (
          <View style={styles.publicRow}>
            <View style={styles.metric}>
              <MaterialIcons name="directions-bus" size={24} color="#fff"/>
              <Text style={styles.metricText}>{busText}</Text>
            </View>
            <View style={styles.metric}>
              <MaterialIcons name="train" size={24} color="#fff"/>
              <Text style={styles.metricText}>{mrtText}</Text>
            </View>
            <View style={styles.metric}>
              <MaterialIcons name="directions-walk" size={24} color="#fff"/>
              <Text style={styles.metricText}>{walkText}</Text>
            </View>
          </View>
        )}
      </TouchableOpacity>

      {/* Route detail sheet (now above ) */}
      <Animated.View style={[styles.detailSheet, { top: detailAnim }]}>
        <View style={styles.detailHeader}>
          <TouchableOpacity onPress={toggleDetail} style={styles.closeButton}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.detailContent}>
          {steps.map((s,i)=>(
            <View key={i} style={styles.detailItem}>
              <View style={styles.numberCircle}>
                <Text style={styles.numberText}>{i+1}</Text>
              </View>
              <View style={styles.detailText}>
                <Text style={[
                  styles.stepInstruction,
                  i===currentStepIndex && styles.currentInstruction
                ]}>
                  {cleanInstruction(s.instruction)}
                </Text>
                {s.distance && (
                  <Text style={styles.stepDistance}>Distance: {s.distance}</Text>
                )}
              </View>
            </View>
          ))}
        </ScrollView>
      </Animated.View>

      {/* Crowd-source menu */}
      <Animated.View style={[styles.reportSheet, { top: reportAnim }]}>
        <ScrollView contentContainerStyle={styles.reportContent}>
          {rows.map((row,idx)=>(
            <View key={idx} style={styles.reportRow}>
              {row.map(cat=>{
                const { name, lib } = categoryIcons[cat];
                const IconComp = lib==='FontAwesome5'
                  ? FontAwesome5
                  : lib==='MaterialIcons'
                    ? MaterialIcons
                    : MaterialCommunityIcons;
                return (
                  <View key={cat} style={styles.reportButtonWrapper}>
                    <TouchableOpacity
                        style={styles.reportButton}
                        onPress={() => submitCrowdsourcedReport(cat)}
                    >                      
                    <IconComp name={name} size={30} color="#fff"/>
                    </TouchableOpacity>
                    <Text style={styles.reportLabel}>{cat}</Text>
                  </View>
                );
              })}
            </View>
          ))}
        </ScrollView>
      </Animated.View>

      {/* Toggle handle for crowd-source */}
      <TouchableOpacity
        style={styles.reportToggle}
        onPress={toggleReport}
      >
        <Ionicons
          name={reportOpen ? 'chevron-down' : 'chevron-up'}
          size={20}
          color="#fff"
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex:1 },
  map:          { width, height },

  // Instruction panel
  instructionPanel:{
    position:'absolute',
    top:20, left:20, right:20,
    backgroundColor:'rgba(0,0,0,0.8)',
    padding:15, borderRadius:12,
    zIndex:13
  },
  driverRow:    { flexDirection:'row', alignItems:'center' },
  instrTextWrapper:{ flex:1, marginHorizontal:10 },
  instrMain:    { color:'#fff', fontSize:17, fontWeight:'bold' },
  instrSub:     { color:'#ccc', fontSize:14, marginTop:2 },
  speedBadge:   {
    backgroundColor:'rgba(255,255,255,0.2)',
    paddingHorizontal:8, paddingVertical:4,
    borderRadius:8, alignItems:'center'
  },
  speedText:    { color:'#fff', fontSize:16, fontWeight:'bold' },
  speedUnit:    { color:'#ddd', fontSize:12 },
  publicRow:    { flexDirection:'row', justifyContent:'space-between' },
  metric:       { flex:1, alignItems:'center' },
  metricText:   { color:'#fff', fontSize:14, marginTop:4 },

  // Route detail sheet
  detailSheet:      {
    position:'absolute', left:0, right:0,
    height:height*0.75,
    backgroundColor:'#000',
    borderTopLeftRadius:12,
    borderTopRightRadius:12,
    zIndex:12
  },
  detailHeader:     {
    height:45, flexDirection:'row',
    justifyContent:'flex-end', alignItems:'center',
    paddingHorizontal:13
  },
  closeButton:      { padding:10 },
  closeText:        { color:'#fff', fontSize:16, fontWeight:'bold' },
  detailContent:    { padding:20 },
  detailItem:       {
    flexDirection:'row', alignItems:'flex-start',
    marginBottom:16,
    borderBottomWidth:1, borderBottomColor:'#222',
    paddingBottom:12
  },
  numberCircle:     {
    width:28, height:28, borderRadius:14,
    backgroundColor:'#444',
    alignItems:'center', justifyContent:'center',
    marginRight:12
  },
  numberText:       { color:'#fff', fontWeight:'bold' },
  detailText:       { flex:1 },
  stepInstruction:  { color:'#fff', fontSize:16, marginBottom:4 },
  currentInstruction:{ fontWeight:'bold', color:'#80CE00' },
  stepDistance:     { color:'#aaa', fontSize:14 },

  // Crowd-source menu
  reportSheet:  {
    position:'absolute', left:0, right:0,
    height:height,
    backgroundColor:'#333',
    borderTopLeftRadius:12,
    borderTopRightRadius:12,
    zIndex:10
  },
  reportContent:{ paddingTop:20, paddingHorizontal:16 },
  reportRow:    { flexDirection:'row', justifyContent:'space-around', marginBottom:15 },
  reportButtonWrapper:{ width:60, alignItems:'center' },
  reportButton:{ 
    width:60, height:60, borderRadius:30,
    backgroundColor:'rgba(255,255,255,0.27)',
    alignItems:'center', justifyContent:'center'
  },
  reportLabel:  { color:'#fff', fontSize:12, marginTop:4, textAlign:'center' },

  // Handle to toggle crowd-source
  reportToggle:{
    position:'absolute',
    bottom:0,
    alignSelf:'center',
    width:60, height:25,
    backgroundColor:'#333',
    borderTopLeftRadius:12,
    borderTopRightRadius:12,
    alignItems:'center',
    justifyContent:'center',
    zIndex:11
  }
});
