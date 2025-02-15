import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Dimensions, TouchableWithoutFeedback, Keyboard, PermissionsAndroid, Platform } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import Geolocation from 'react-native-geolocation-service';
import P2PPublicTrans from '/P2PPublicTrans';

const { height, width } = Dimensions.get('window');

const P2PNavigation = () => {
  const [startLocation, setStartLocation] = useState('');
  const [endLocation, setEndLocation] = useState('');
  const [driverTravelTime, setDriverTravelTime] = useState(null);
  const [publicTravelTime, setPublicTravelTime] = useState(null);
  const [route, setRoute] = useState([]);
  const [markers, setMarkers] = useState([]);
  const [currentRegion, setCurrentRegion] = useState(null);

  useEffect(() => {
    requestLocationPermission();
  }, []);

  const requestLocationPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
  
        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          console.log("Location permission granted");
          getCurrentLocation();
        } else {
          console.log("Location permission denied");
        }
      } catch (err) {
        console.warn(err);
      }
    } else {
      getCurrentLocation(); // iOS automatically asks for permission
    }
  };
  

  const getCurrentLocation = () => {
    Geolocation.getCurrentPosition(
      (position) => {
        if (position && position.coords) {
          const { latitude, longitude } = position.coords;
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
      },
      (error) => {
        console.log("Error fetching location:", error.message);
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 }
    );
  };
  
  
  
  const driverTravelTimePlaceholder = () => {
    const randomTime = Math.floor(Math.random() * (30 - 10 + 1)) + 10;
    setDriverTravelTime(`${randomTime}`);
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
          <MapView
            style={styles.map}
            region={
              currentRegion || { 
                latitude: 1.3521, //this is singapore
                longitude: 103.8198,
                latitudeDelta: 5, 
                longitudeDelta: 5
              }
            }
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

          <TextInput style={styles.input} placeholder="Current Location" value={startLocation} onChangeText={setStartLocation} />
          <TextInput style={styles.input} placeholder="Destination" value={endLocation} onChangeText={setEndLocation} />

          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.button} onPress={driverTravelTimePlaceholder}>
              <Text style={styles.buttonText}>Driver</Text>
              <Text style={styles.timeText}>{driverTravelTime || '--'} Mins</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={() => P2PPublicTrans(startLocation, endLocation, setRoute, setMarkers, setPublicTravelTime)}>
              <Text style={styles.buttonText}>Public</Text>
              <Text style={styles.timeText}>{publicTravelTime || '--'} Mins</Text>
            </TouchableOpacity>
          </View>
        </View>
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
});

export default P2PNavigation;
