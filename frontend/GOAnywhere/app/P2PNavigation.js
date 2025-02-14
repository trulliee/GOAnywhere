import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';

const { height, width } = Dimensions.get('window');

const P2PNavigation = () => {
  const [startLocation, setStartLocation] = useState('');
  const [endLocation, setEndLocation] = useState('');
  const [travelTime, setTravelTime] = useState(null);

  const handleDriverRoute = () => {
    const randomTime = Math.floor(Math.random() * (30 - 10 + 1)) + 10;
    setTravelTime(`${randomTime} Mins`);
  };

  return (
    <View style={styles.container}>
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
        
        <TouchableOpacity style={styles.button} onPress={handleDriverRoute}>
          <Text style={styles.buttonText}>Driver</Text>
        </TouchableOpacity>
        
        {travelTime && <Text style={styles.result}>Estimated Time: {travelTime}</Text>}
      </View>
      
      <View style={styles.bottomSection}>
        {/* Leave this section blank for future map integration */}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#25292e',
    width: width,
    height: height,
  },
  topSection: {
    height: height * 0.33,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#25292e',
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
    width: '100%',
  },
  bottomSection: {
    flex: 1,
    backgroundColor: '#000',
    width: '100%',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
  input: {
    width: '90%',
    padding: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  button: {
    backgroundColor: '#007bff',
    padding: 15,
    borderRadius: 8,
    width: '90%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  result: {
    marginTop: 15,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
});

export default P2PNavigation;
