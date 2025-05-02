import React, { useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";

// TomTom API Key (Replace with your actual API key)
const API_KEY = "YOUR_TOMTOM_API_KEY";

// TomTom API URLs
const TRAFFIC_FLOW_URL = `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?key=${API_KEY}&point=1.3521,103.8198`;
const TRAFFIC_INCIDENTS_URL = `https://api.tomtom.com/traffic/services/4/incidentDetails/s3/1.15/-90,-180,90,180/json?key=${API_KEY}&trafficModelID=1`;

/**
 * TrafficApp Component - Displays real-time traffic information
 */
const TrafficApp = () => {
  const [trafficData, setTrafficData] = useState(null);
  const [loading, setLoading] = useState(false);

  /**
   * Fetches real-time traffic data from TomTom
   */
  const fetchTrafficData = async () => {
    setLoading(true);
    try {
      // Fetch Traffic Flow Data (For Speed & Congestion Level)
      const flowResponse = await fetch(TRAFFIC_FLOW_URL);
      const flowData = await flowResponse.json();

      // Fetch Traffic Incident Data (For Total Jams & Length of Jams)
      const incidentsResponse = await fetch(TRAFFIC_INCIDENTS_URL);
      const incidentsData = await incidentsResponse.json();

      if (flowData.flowSegmentData && incidentsData.incidents) {
        // Calculate congestion level based on speed
        const avgSpeed = flowData.flowSegmentData.currentSpeed;
        const congestionLevel = avgSpeed < 10 ? "🚨 Severe" : 
                                avgSpeed < 25 ? "⚠️ Heavy" : 
                                avgSpeed < 40 ? "🔶 Moderate" : "✅ Light";

        // Extract total jams and total jam length
        const totalJams = incidentsData.incidents.length;
        const totalJamLength = incidentsData.incidents.reduce((sum, incident) => sum + (incident.length || 0), 0);

        // Calculate travel time per 10km
        const travelTimePer10km = avgSpeed > 0 ? (10 / avgSpeed) * 60 : "N/A";

        setTrafficData({
          congestionLevel,
          totalJams,
          totalJamLength,
          avgSpeed,
          travelTimePer10km,
        });
      } else {
        alert("Failed to fetch traffic data.");
      }
    } catch (error) {
      console.error("Error fetching traffic data:", error);
      alert("Failed to fetch traffic data.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🚦 Singapore Traffic Info</Text>

      {/* Fetch Traffic Data Button */}
      <TouchableOpacity style={styles.button} onPress={fetchTrafficData}>
        <Text style={styles.buttonText}>Get Traffic Updates</Text>
      </TouchableOpacity>

      {/* Loading Indicator */}
      {loading && <ActivityIndicator size="large" color="#007bff" />}

      {/* Display Traffic Data */}
      {trafficData && (
        <View style={styles.trafficContainer}>
          <Text style={styles.trafficText}>🛑 Congestion Level: {trafficData.congestionLevel}</Text>
          <Text style={styles.trafficText}>🚗 Total Jams: {trafficData.totalJams} incidents</Text>
          <Text style={styles.trafficText}>📏 Total Jam Length: {trafficData.totalJamLength.toFixed(2)} km</Text>
          <Text style={styles.trafficText}>📊 Avg Speed: {trafficData.avgSpeed} km/h</Text>
          <Text style={styles.trafficText}>⏳ Travel Time (10km): {trafficData.travelTimePer10km} min</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#f5f5f5", justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "bold", textAlign: "center", marginBottom: 20 },
  button: { backgroundColor: "#007bff", padding: 15, borderRadius: 8, alignItems: "center" },
  buttonText: { color: "white", fontWeight: "bold", fontSize: 16 },
  trafficContainer: { marginTop: 20, padding: 15, backgroundColor: "#fff", borderRadius: 8, borderWidth: 1, borderColor: "#ddd" },
  trafficText: { fontSize: 18, fontWeight: "bold", textAlign: "center", marginBottom: 5 },
});

export default TrafficApp;
