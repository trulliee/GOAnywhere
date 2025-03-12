import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";

const TrafficPrediction = () => {
  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [location, setLocation] = useState("");
  const [prediction, setPrediction] = useState(null);

  const fetchPrediction = async () => {
    if (!location) {
      Alert.alert("Error", "Please enter a location.");
      return;
    }

    try {
      const response = await fetch("", { // Replace with actual API
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, location }),
      });

      const data = await response.json();
      setPrediction(data.prediction);
    } catch (error) {
      console.error("Error fetching prediction:", error);
      Alert.alert("Error", "Could not fetch traffic prediction.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Traffic Prediction</Text>

      {/* Date & Time Picker */}
      <Text style={styles.label}>Select Date & Time</Text>
      <TouchableOpacity style={styles.pickerButton} onPress={() => setShowPicker(true)}>
        <Text style={styles.pickerText}>{date.toLocaleString()}</Text>
      </TouchableOpacity>
      {showPicker && (
        <DateTimePicker value={date} mode="datetime" display="default" onChange={(event, selectedDate) => {
          setShowPicker(false);
          if (selectedDate) setDate(selectedDate);
        }} />
      )}

      {/* Location Input */}
      <Text style={styles.label}>Enter Location</Text>
      <TextInput style={styles.input} placeholder="E.g., Orchard Road" value={location} onChangeText={setLocation} />

      {/* Fetch Prediction Button */}
      <TouchableOpacity style={styles.submitButton} onPress={fetchPrediction}>
        <Text style={styles.submitText}>Get Prediction</Text>
      </TouchableOpacity>

      {/* Display Prediction Result */}
      {prediction && (
        <View style={styles.resultContainer}>
          <Text style={styles.resultText}>Predicted Traffic: {prediction}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#f5f5f5" },
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 15, textAlign: "center" },
  label: { fontSize: 16, marginBottom: 5 },
  pickerButton: { padding: 10, backgroundColor: "#ddd", borderRadius: 8, marginBottom: 10, alignItems: "center" },
  pickerText: { fontSize: 16, color: "#333" },
  input: { backgroundColor: "white", padding: 10, borderRadius: 8, borderWidth: 1, borderColor: "#ccc", marginBottom: 15 },
  submitButton: { backgroundColor: "#007bff", padding: 15, borderRadius: 8, alignItems: "center" },
  submitText: { color: "white", fontWeight: "bold", fontSize: 16 },
  resultContainer: { marginTop: 20, padding: 15, backgroundColor: "#fff", borderRadius: 8, borderWidth: 1, borderColor: "#ddd" },
  resultText: { fontSize: 18, fontWeight: "bold", textAlign: "center" },
});

export default TrafficPrediction;
