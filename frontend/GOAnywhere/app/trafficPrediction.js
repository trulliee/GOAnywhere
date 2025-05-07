import React, { useState } from 'react';
import { View, Text, Button, StyleSheet, ActivityIndicator } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { API_URL } from './utils/apiConfig';
import axios from 'axios';

export default function TrafficPrediction() {
  const [inputs, setInputs] = useState({
    RoadName: 'PIE',
    RoadCategory: 'Expressway',
    hour: 8,
    day_of_week: 2,
    month: 5,
    is_holiday: 0,
    event_count: 0,
    incident_count: 0,
    temperature: 27.0,
    humidity: 75.0,
    peak_hour_flag: 1,
    day_type: 'weekday',
    road_type: 'expressway',
    recent_incident_flag: 0,
    speed_band_previous_hour: 2,
    rain_flag: 0,
    max_event_severity: 0,
    sum_event_severity: 0,
  });

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handlePredict = async () => {
    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/api/prediction/traffic`, {
        ...inputs,
      });
      setResult(response.data);
    } catch (error) {
      setResult({ error: error.response?.data?.detail || 'Prediction failed' });
    }
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Traffic Prediction</Text>

      {/* Example input (add more Pickers or Sliders as needed) */}
      <Text>Road Name</Text>
      <Picker
        selectedValue={inputs.RoadName}
        onValueChange={(itemValue) => setInputs({ ...inputs, RoadName: itemValue })}
        style={styles.picker}
      >
        <Picker.Item label="PIE" value="PIE" />
        <Picker.Item label="CTE" value="CTE" />
        <Picker.Item label="AYE" value="AYE" />
        {/* Add more roads as needed */}
      </Picker>

      <Button title="Predict Traffic" onPress={handlePredict} />

      {loading && <ActivityIndicator size="large" color="#0000ff" />}

      {result && (
        <View style={styles.result}>
          <Text>Prediction: {JSON.stringify(result.predictions)}</Text>
          <Text>Probability: {JSON.stringify(result.probabilities)}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, flex: 1, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  picker: { height: 50, width: '100%' },
  result: { marginTop: 20 },
});
