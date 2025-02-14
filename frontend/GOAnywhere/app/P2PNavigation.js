import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Dimensions, TouchableWithoutFeedback, Keyboard } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

const { height, width } = Dimensions.get('window');

const P2PNavigation = () => {
  const [startLocation, setStartLocation] = useState('');
  const [endLocation, setEndLocation] = useState('');
  const [travelTime, setTravelTime] = useState(null);

  const handleDriverRoute = () => {
    const randomTime = Math.floor(Math.random() * (30 - 10 + 1)) + 10;
    setTravelTime(`${randomTime}`);
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        <MapView
          style={styles.map}
          initialRegion={{
            latitude: 37.7749, // San Francisco, Example
            longitude: -122.4194,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          }}
        >
          <Marker coordinate={{ latitude: 37.7749, longitude: -122.4194 }} title="San Francisco" />
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
            <TouchableOpacity style={styles.button} onPress={handleDriverRoute}>
              <Text style={styles.buttonText}>Driver</Text>
              <Text style={styles.timeText}>{travelTime || '--'} Mins</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.button}>
              <Text style={styles.buttonText}>Public</Text>
              <Text style={styles.timeText}>30 Mins</Text>
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
    borderTopLeftRadius: 35,
    borderTopRightRadius: 35,
    borderBottomLeftRadius: 35,
    borderBottomRightRadius: 35,
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
