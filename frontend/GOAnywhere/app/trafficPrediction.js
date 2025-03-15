import React, { useState } from "react";
import { useRouter } from "expo-router";
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, Button, Switch, Platform, ScrollView } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";

// For iOS simulator
const API_BASE_URL_IOS = "http://127.0.0.1:8000";

// For Android emulator
const API_BASE_URL_ANDROID = "http://10.0.2.2:8000";

const TrafficPrediction = () => {
  const router = useRouter();
  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [startLocation, setStartLocation] = useState("");
  const [destinationLocation, setDestinationLocation] = useState("");
  const [prediction, setPrediction] = useState(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [loading, setLoading] = useState(false);
  const [transportMode, setTransportMode] = useState("driving"); // "driving" or "public"
  const [error, setError] = useState(null);

// Modify your fetchPrediction function
const fetchPrediction = async () => {
  if (!startLocation || !destinationLocation) {
    Alert.alert("Error", "Please enter both start and destination locations.");
    return;
  }

  setLoading(true);
  setError(null);

  try {
    // Get the hour and day from the selected date
    const hour = date.getHours();
    const day = date.getDay() === 0 ? 6 : date.getDay() - 1;

    // Choose API base URL based on platform
    const API_BASE_URL = Platform.OS === 'ios' ? API_BASE_URL_IOS : API_BASE_URL_ANDROID;
    
    // Choose endpoint based on user type
    const endpoint = isRegistered 
      ? `${API_BASE_URL}/prediction/registered` 
      : `${API_BASE_URL}/prediction/unregistered`;
    
    // Build query parameters
    const params = new URLSearchParams({
      time: hour,
      day: day
    });

    // Add location parameter in the format expected by backend
    if (isRegistered) {
      // For registered users, we should include route info
      params.append('location', `${startLocation}`);
      
      // Add a valid expressway name to match what the model expects
      // You might want to extract this from the location or have a dropdown
      const expressway = "PIE"; // Example: Pan Island Expressway
      params.append('route', `${expressway},${startLocation},${destinationLocation}`);
    } else {
      // For unregistered users, simple location is enough
      params.append('location', startLocation);
    }
    
    console.log("Requesting URL:", `${endpoint}?${params.toString()}`);

    const response = await fetch(`${endpoint}?${params.toString()}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" }
    });

    console.log("Response status:", response.status);

    if (!response.ok) {
      let errorMessage = `Server error: ${response.status}`;
      try {
        const errorData = await response.json();
        console.log("Error data:", errorData);
        if (errorData && errorData.detail) {
          errorMessage = errorData.detail;
        }
      } catch (e) {
        console.log("Error parsing error response:", e);
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log("Received data:", data);
    setPrediction(data);
  } catch (error) {
    console.error("Error fetching prediction:", error);
    setError(error.message);
    Alert.alert(
      "Error", 
      "Could not fetch traffic prediction. " + error.message,
      [
        { text: "OK" },
        isRegistered ? 
          { text: "Try Basic Prediction", onPress: () => setIsRegistered(false) } : 
          null
      ].filter(Boolean)
    );
  } finally {
    setLoading(false);
  }
};

  // Render prediction result based on user type
  const renderPredictionResult = () => {
    if (!prediction) return null;

    if (isRegistered) {
      // Detailed prediction display for registered users
      return (
        <View style={styles.resultContainer}>
          <Text style={styles.resultTitle}>Traffic Prediction</Text>
          
          <Text style={styles.resultSubtitle}>Road Conditions:</Text>
          {Object.entries(prediction.road_conditions_probability || {}).map(([condition, probability]) => (
            <Text key={condition} style={styles.resultText}>
              {condition}: {typeof probability === 'number' ? probability.toFixed(1) : probability}%
            </Text>
          ))}
          
          <Text style={styles.resultSubtitle}>Estimated Travel Time:</Text>
          {prediction.estimated_travel_time?.driving !== undefined && transportMode === "driving" && (
            <Text style={styles.resultText}>
              Driving: {prediction.estimated_travel_time.driving} minutes
            </Text>
          )}
          {prediction.estimated_travel_time?.public_transport !== undefined && transportMode === "public" && (
            <Text style={styles.resultText}>
              Public Transit: {prediction.estimated_travel_time.public_transport} minutes
            </Text>
          )}
          
          {prediction.alternative_routes?.length > 0 && (
            <>
              <Text style={styles.resultSubtitle}>Alternative Routes:</Text>
              {prediction.alternative_routes.map((route, index) => (
                <Text key={index} style={styles.resultText}>
                  {route.name}: {route.estimated_time} minutes
                  {route.description && <Text> - {route.description}</Text>}
                </Text>
              ))}
            </>
          )}
          
          {prediction.incident_alerts?.length > 0 && (
            <>
              <Text style={styles.resultSubtitle}>Incidents:</Text>
              {prediction.incident_alerts.map((alert, index) => (
                <Text key={index} style={styles.resultText}>
                  {alert.type}: {alert.message}
                </Text>
              ))}
            </>
          )}
          
          {prediction.weather_recommendations?.length > 0 && (
            <>
              <Text style={styles.resultSubtitle}>Weather Recommendations:</Text>
              {prediction.weather_recommendations.map((rec, index) => (
                <Text key={index} style={styles.resultText}>• {rec}</Text>
              ))}
            </>
          )}

          {prediction.general_travel_recommendation && (
            <>
              <Text style={styles.resultSubtitle}>Travel Recommendation:</Text>
              <Text style={[
                styles.resultText, 
                styles.recommendationText,
                prediction.general_travel_recommendation === "Ideal" ? 
                  styles.recommendationIdeal : 
                  styles.recommendationNotIdeal
              ]}>
                {prediction.general_travel_recommendation}
              </Text>
            </>
          )}
        </View>
      );
    } else {
      // Basic prediction display for unregistered users
      return (
        <View style={styles.resultContainer}>
          <Text style={styles.resultTitle}>Traffic Prediction</Text>
          
          <View style={styles.basicResultRow}>
            <Text style={styles.basicResultLabel}>Road Condition:</Text>
            <Text style={[
              styles.basicResultValue,
              prediction.road_condition === "Clear" ? styles.resultGood : 
              prediction.road_condition === "Moderate" ? styles.resultModerate :
              styles.resultBad
            ]}>
              {prediction.road_condition}
            </Text>
          </View>

          <View style={styles.basicResultRow}>
            <Text style={styles.basicResultLabel}>Possible Delay:</Text>
            <Text style={[
              styles.basicResultValue,
              prediction.possible_delay === "No" ? styles.resultGood : styles.resultBad
            ]}>
              {prediction.possible_delay}
            </Text>
          </View>

          <View style={styles.basicResultRow}>
            <Text style={styles.basicResultLabel}>Weather:</Text>
            <Text style={[
              styles.basicResultValue,
              prediction.weather_condition === "Clear" ? styles.resultGood :
              prediction.weather_condition === "Cloudy" ? styles.resultModerate :
              styles.resultWarning
            ]}>
              {prediction.weather_condition}
            </Text>
          </View>

          <View style={styles.upgradeContainer}>
            <Text style={styles.upgradeText}>
              Get detailed predictions including travel recommendations, alternative routes, and incident alerts by upgrading to a registered user account.
            </Text>
          </View>
        </View>
      );
    }
  };

  return (
    <ScrollView style={styles.scrollView}>
      <View style={styles.container}>
        <Text style={styles.title}>Traffic Prediction</Text>

        {/* User Type Toggle */}
        <View style={styles.toggleContainer}>
          <Text>Basic</Text>
          <Switch
            value={isRegistered}
            onValueChange={setIsRegistered}
            style={styles.toggle}
          />
          <Text>Detailed</Text>
        </View>

        {/* Start Location Input */}
        <Text style={styles.label}>Start Location</Text>
        <TextInput 
          style={styles.input} 
          placeholder="E.g., Orchard Road" 
          value={startLocation} 
          onChangeText={setStartLocation} 
        />

        {/* Destination Location Input */}
        <Text style={styles.label}>Destination</Text>
        <TextInput 
          style={styles.input} 
          placeholder="E.g., Marina Bay Sands" 
          value={destinationLocation} 
          onChangeText={setDestinationLocation} 
        />

        {/* Transport Mode Selection */}
        <Text style={styles.label}>Mode of Transport</Text>
        <View style={styles.transportToggleContainer}>
          <TouchableOpacity 
            style={[
              styles.transportButton, 
              transportMode === "driving" && styles.transportButtonActive
            ]}
            onPress={() => setTransportMode("driving")}
          >
            <Text style={[
              styles.transportButtonText,
              transportMode === "driving" && styles.transportButtonTextActive
            ]}>Driving</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.transportButton, 
              transportMode === "public" && styles.transportButtonActive
            ]}
            onPress={() => setTransportMode("public")}
          >
            <Text style={[
              styles.transportButtonText,
              transportMode === "public" && styles.transportButtonTextActive
            ]}>Public Transport</Text>
          </TouchableOpacity>
        </View>

        {/* Date & Time Picker */}
        <Text style={styles.label}>Select Date & Time</Text>
        <TouchableOpacity style={styles.pickerButton} onPress={() => setShowPicker(true)}>
          <Text style={styles.pickerText}>{date.toLocaleString()}</Text>
        </TouchableOpacity>
        {showPicker && (
          <DateTimePicker 
            value={date} 
            mode="datetime" 
            display="default" 
            onChange={(event, selectedDate) => {
              setShowPicker(false);
              if (selectedDate) setDate(selectedDate);
            }} 
          />
        )}

        {/* Fetch Prediction Button */}
        <TouchableOpacity 
          style={[styles.submitButton, loading && styles.disabledButton]} 
          onPress={fetchPrediction}
          disabled={loading}
        >
          <Text style={styles.submitText}>
            {loading ? "Loading..." : "Get Prediction"}
          </Text>
        </TouchableOpacity>

        {/* Error Display */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Error: {error}</Text>
          </View>
        )}

        {/* Display Prediction Result */}
        {renderPredictionResult()}
        
        {/* Back Button */}
        <View style={styles.backButtonContainer}>
          <Button title="Back" onPress={() => router.back()} />
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollView: { 
    flex: 1, 
    backgroundColor: "#f5f5f5" 
  },
  container: { 
    flex: 1, 
    padding: 20, 
    backgroundColor: "#f5f5f5" 
  },
  title: { 
    fontSize: 22, 
    fontWeight: "bold", 
    marginBottom: 15, 
    textAlign: "center" 
  },
  label: { 
    fontSize: 16, 
    marginBottom: 5 
  },
  pickerButton: { 
    padding: 10, 
    backgroundColor: "#ddd", 
    borderRadius: 8, 
    marginBottom: 15, 
    alignItems: "center" 
  },
  pickerText: { 
    fontSize: 16, 
    color: "#333" 
  },
  input: { 
    backgroundColor: "white", 
    padding: 10, 
    borderRadius: 8, 
    borderWidth: 1, 
    borderColor: "#ccc", 
    marginBottom: 15 
  },
  submitButton: { 
    backgroundColor: "#007bff", 
    padding: 15, 
    borderRadius: 8, 
    alignItems: "center" 
  },
  disabledButton: { 
    backgroundColor: "#cccccc" 
  },
  submitText: { 
    color: "white", 
    fontWeight: "bold", 
    fontSize: 16 
  },
  toggleContainer: { 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "center", 
    marginBottom: 15 
  },
  toggle: { 
    marginHorizontal: 10 
  },
  transportToggleContainer: { 
    flexDirection: "row", 
    marginBottom: 15,
    justifyContent: "space-between" 
  },
  transportButton: {
    flex: 1,
    padding: 10,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    alignItems: "center",
    marginHorizontal: 5,
    backgroundColor: "#f8f8f8"
  },
  transportButtonActive: {
    backgroundColor: "#007bff",
    borderColor: "#007bff"
  },
  transportButtonText: {
    color: "#333"
  },
  transportButtonTextActive: {
    color: "white",
    fontWeight: "bold"
  },
  resultContainer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    marginBottom: 15,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
    textAlign: "center",
  },
  resultSubtitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 10,
    marginBottom: 5,
  },
  resultText: {
    fontSize: 15,
    marginBottom: 5,
    lineHeight: 22,
  },
  basicResultRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  basicResultLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: "#555",
  },
  basicResultValue: {
    fontSize: 16,
    fontWeight: "bold",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
  },
  resultGood: {
    backgroundColor: "#e8f5e9",
    color: "#2e7d32",
  },
  resultModerate: {
    backgroundColor: "#fff8e1",
    color: "#ff8f00",
  },
  resultBad: {
    backgroundColor: "#ffebee",
    color: "#c62828",
  },
  resultWarning: {
    backgroundColor: "#e3f2fd",
    color: "#1565c0",
  },
  recommendationText: {
    fontWeight: "bold",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
    overflow: "hidden",
    textAlign: "center",
  },
  recommendationIdeal: {
    backgroundColor: "#e8f5e9",
    color: "#2e7d32",
  },
  recommendationNotIdeal: {
    backgroundColor: "#ffebee",
    color: "#c62828",
  },
  upgradeContainer: {
    marginTop: 15,
    padding: 10,
    backgroundColor: "#e3f2fd",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#bbdefb",
  },
  upgradeText: {
    color: "#0d47a1",
    fontSize: 14,
    lineHeight: 20,
  },
  errorContainer: { 
    marginTop: 10, 
    padding: 10, 
    backgroundColor: "#ffebee", 
    borderRadius: 8, 
    borderWidth: 1, 
    borderColor: "#ffcdd2" 
  },
  errorText: { 
    color: "#c62828", 
    fontSize: 14 
  },
  backButtonContainer: { 
    marginTop: 20, 
    marginBottom: 40 
  }
});

export default TrafficPrediction;