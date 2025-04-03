import React, { useState, useEffect, useRef  } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, 
  StyleSheet, Dimensions, TouchableWithoutFeedback, 
  Keyboard, ScrollView
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import P2PPublicTrans from './P2PPublicTrans';
import P2PDriver from './P2PDriver';
import BottomSheet from 'react-native-gesture-bottom-sheet';




const { height, width } = Dimensions.get('window');

const P2PNavigation = () => {
  const [startLocation, setStartLocation] = useState('');
  const [endLocation, setEndLocation] = useState('');
  const [driverTravelTime, setDriverTravelTime] = useState(null);
  const [publicTravelTime, setPublicTravelTime] = useState(null);
  const [route, setRoute] = useState([]);
  const [markers, setMarkers] = useState([]);
  const [currentRegion, setCurrentRegion] = useState(null);
  const [locationHistory, setLocationHistory] = useState([]);
  const [isHistoryVisible, setIsHistoryVisible] = useState(false);
  const [driverDetails, setDriverDetails] = useState(null);
  const [publicDetails, setPublicDetails] = useState(null);
  const bottomSheetRef = useRef(null);



  useEffect(() => {
    requestLocationPermission();
  }, []);

  const requestLocationPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.log('Permission to access location was denied');
      return;
    }
    getCurrentLocation();
  };

  const addToHistory = (start, end) => {
    setLocationHistory(prev => {
      const newHistory = [{ start, end }, ...prev];
      return newHistory.slice(0, 20); // Keep only last 20
    });
  };
  

  const getCurrentLocation = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({});
      if (location && location.coords) {
        const { latitude, longitude } = location.coords;
        console.log("User Location:", latitude, longitude);

        setCurrentRegion({
          latitude,
          longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });

        setStartLocation(`${latitude}, ${longitude}`);
      } else {
        console.log("GPS returned invalid data.");
      }
    } catch (error) {
      console.log("Error fetching location:", error.message);
    }
  };

  // Function to fetch route data from backend
  const getRouteFromBackend = async (start, end) => {
    try {
      const response = await fetch(`http://192.168.68.50:8000/p2pnavigation/get_route?start=${start}&end=${end}`);
      const data = await response.json();

      if (response.ok) {
        setRoute(decodePolyline(data.polyline));  // Decode the polyline to show the route
        setMarkers([
          { latitude: data.start_coords.lat, longitude: data.start_coords.lng, title: 'Start' },
          { latitude: data.end_coords.lat, longitude: data.end_coords.lng, title: 'End' },
        ]);
        setDriverTravelTime(data.duration);  // Set travel time
      } else {
        console.log('Error fetching route:', data.detail);
      }
    } catch (error) {
      console.error('Error calling API:', error);
    }
  };

  // Polyline decoding function to display route correctly
  const decodePolyline = (encoded) => {
    let index = 0, lat = 0, lng = 0;
    const path = [];
    while (index < encoded.length) {
      let byte, result = 0, shift = 0;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      const dLat = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lat += dLat;

      shift = 0;
      result = 0;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      const dLng = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lng += dLng;

      path.push({ latitude: lat / 1E5, longitude: lng / 1E5 });
    }
    return path;
  };

  // Dynamically calculate map region based on markers (start and end points)
  const getMapRegion = () => {
    if (markers.length === 2) {
      const latitudes = markers.map(m => m.latitude);
      const longitudes = markers.map(m => m.longitude);
      const latDelta = Math.max(...latitudes) - Math.min(...latitudes);
      const lngDelta = Math.max(...longitudes) - Math.min(...longitudes);

      return {
        latitude: (Math.max(...latitudes) + Math.min(...latitudes)) / 2,
        longitude: (Math.max(...longitudes) + Math.min(...longitudes)) / 2,
        latitudeDelta: latDelta * 1.2, // Adjust zoom level
        longitudeDelta: lngDelta * 1.2, // Adjust zoom level
      };
    }
    return {
      latitude: 1.3521,
      longitude: 103.8198,
      latitudeDelta: 5,
      longitudeDelta: 5,
    };
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        <MapView
          style={styles.map}
          region={getMapRegion()}
          showsUserLocation={true}
          showsMyLocationButton={true}
        >
          {route.length > 0 && <Polyline coordinates={route} strokeWidth={4} strokeColor="blue" />}
          {markers.map((marker, index) => (
            <Marker key={index} coordinate={marker} title={marker.title} />
          ))}
        </MapView>
  
        <View style={styles.topSection}>
          <Text style={styles.title}>P2P Navigation</Text>
  
          <TextInput 
            style={styles.input} 
            placeholder="Current Location" 
            value={startLocation} 
            onChangeText={setStartLocation} 
          />
          <TextInput 
            style={styles.input} 
            placeholder="Destination" 
            value={endLocation} 
            onChangeText={setEndLocation} 
          />
  
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={styles.button} 
              onPress={() => {
                addToHistory(startLocation, endLocation);
                P2PDriver(
                  startLocation,
                  endLocation,
                  setRoute,
                  setMarkers,
                  setDriverTravelTime,
                  setDriverDetails
                );
              }}
              
            >
              <Text style={styles.buttonText}>Driver</Text>
              <Text style={styles.timeText}>{driverTravelTime || '--'}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.button} 
              onPress={() => {
                addToHistory(startLocation, endLocation);
                P2PPublicTrans(
                  startLocation,
                  endLocation,
                  setRoute,
                  setMarkers,
                  setPublicTravelTime,
                  setPublicDetails
                );
              }}
              
            >
              <Text style={styles.buttonText}>Public</Text>
              <Text style={styles.timeText}>{publicTravelTime || '--'}</Text>
            </TouchableOpacity>
          </View>
        </View>
  
        {driverDetails && (
          <View style={styles.detailsBox}>
            <Text style={styles.detailsTitle}>Driving Details</Text>
            <Text>Total Distance: {driverDetails.distance}</Text>
            <Text>Estimated Time: {driverDetails.duration}</Text>
            {driverDetails.steps.map((step, idx) => (
              <Text key={idx}>• {step.instruction} ({step.distance})</Text>
            ))}
          </View>
        )}
  
        {publicDetails && (
          <View style={styles.detailsBox}>
            <Text style={styles.detailsTitle}>Public Transit Details</Text>
            <Text>Total Distance: {publicDetails.distance}</Text>
            <Text>Estimated Time: {publicDetails.duration}</Text>
            {publicDetails.steps.map((step, idx) => (
              <Text key={idx}>
                • {step.instruction} ({step.distance})
                {step.transitInfo && 
                  ` via ${step.transitInfo.vehicleType} ${step.transitInfo.lineName}, toward ${step.transitInfo.headsign}, board at ${step.transitInfo.departureStop}, drop off at ${step.transitInfo.arrivalStop}, ${step.transitInfo.numStops} stops`
                }
              </Text>
            ))}
          </View>
        )}
  
        <TouchableOpacity
          style={styles.historyBar}
          onPress={() => bottomSheetRef.current?.show()}
        >
          <Text style={styles.historyBarText}>Swipe up for Location History ▲</Text>
        </TouchableOpacity>

        <BottomSheet
          hasDraggableIcon
          ref={bottomSheetRef}
          height={height * 0.4}
          draggable
        >
          <View style={styles.historySheet}>
            <Text style={styles.historyTitle}>Location History</Text>
            <ScrollView showsVerticalScrollIndicator={true}>
              {locationHistory.map((item, index) => (
                <Text key={index} style={styles.historyItem}>
                  {index + 1}. {item.start} ➜ {item.end}
                </Text>
              ))}
            </ScrollView>
          </View>
        </BottomSheet>

      </View>
    </TouchableWithoutFeedback>
  );  
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    width: width,
    height: height,
  },
  topSection: {
    position: 'center',
    height: height * 0.27,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
    borderRadius: 35,
    width: '95%',
    alignSelf: 'center',
  },
  map: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  title: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  input: {
    width: '90%',
    padding: 12,
    marginBottom: 10,
    borderWidth: 0.5,
    borderColor: '#ccc',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 5,
    width: '90%',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0E0E0',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    width: '48%',
    justifyContent: 'space-between',
  },
  buttonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  timeText: {
    color: '#000',
    fontSize: 14,
  },
  historyPanel: {
    position: 'absolute',
    bottom: 80,
    left: 10,
    right: 10,
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    maxHeight: height * 0.3,
  },
  historyTitle: {
    fontWeight: 'bold',
    marginBottom: 10,
  },
  historyItem: {
    fontSize: 13,
    paddingVertical: 2,
  },
  historyToggle: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    backgroundColor: '#000',
    padding: 8,
    borderRadius: 20,
  },
  detailsBox: {
    position: 'absolute',
    bottom: 150,
    left: 10,
    right: 10,
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
  },
  detailsTitle: {
    fontWeight: 'bold',
    marginBottom: 10,
  }  
});

export default P2PNavigation;
