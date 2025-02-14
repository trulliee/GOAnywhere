import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';

const P2PNavigation = () => {
  const [startLocation, setStartLocation] = useState('');
  const [endLocation, setEndLocation] = useState('');
  const [travelTime, setTravelTime] = useState(null);

  const handleDriverRoute = () => {
    const randomTime = Math.floor(Math.random() * (30 - 10 + 1)) + 10; // Random time between 10-30 mins
    setTravelTime(`${randomTime} Mins`);
  };

  return (
    <View style={styles.container}>
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
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8f8f8',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  input: {
    width: '100%',
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
    width: '100%',
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
    color: '#333',
  },
});

export default P2PNavigation;  // ✅ Ensure it has default export
