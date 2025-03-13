import React, { useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { web } from "expo-web-browser"; // For fetching from OneMotoring LTA

const ViewIncidents = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchValidatedReports();
  }, []);

  const fetchValidatedReports = async () => {
    try {
      // Fetch user-submitted reports from backend (Firebase/API)
      const response = await fetch(""); // Replace with actual API
      const allReports = await response.json();

      // Fetch official traffic data from LTA OneMotoring
      const officialReports = await fetchOneMotoringUpdates();

      // Filter reports that are either:
      // - Reported by multiple users (e.g., same location & category)
      // - Confirmed by LTA OneMotoring
      const validatedReports = allReports.filter((report) =>
        report.count >= 2 || officialReports.some((official) => official.location === report.location)
      );

      setReports(validatedReports);
    } catch (error) {
      console.error("Error fetching reports:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOneMotoringUpdates = async () => {
    try {
      // Fetch live traffic updates from OneMotoring LTA (Scraping or API method)
      const response = await web.openBrowserAsync(
        "https://onemotoring.lta.gov.sg/content/onemotoring/home/driving/traffic_information/traffic_updates_and_road_closures.html?type=tc"
      );
      return response; // Extract relevant traffic updates (Implementation depends on API availability)
    } catch (error) {
      console.error("Error fetching LTA updates:", error);
      return [];
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Validated Traffic Incidents</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#007bff" />
      ) : reports.length === 0 ? (
        <Text style={styles.noReports}>No validated reports available.</Text>
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.reportCard}>
              <Text style={styles.reportCategory}>{item.category}</Text>
              <Text style={styles.reportDetails}>{item.subcategory || "General Report"}</Text>
              <Text style={styles.reportLocation}>📍 {item.location}</Text>
              <Text style={styles.reportTime}>🕒 {new Date(item.timestamp).toLocaleTimeString()}</Text>
            </View>
          )}
        />
      )}

      <TouchableOpacity style={styles.refreshButton} onPress={fetchValidatedReports}>
        <Text style={styles.refreshText}>Refresh Reports</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#f5f5f5" },
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 15, textAlign: "center" },
  noReports: { textAlign: "center", fontSize: 16, marginTop: 20, color: "#888" },
  reportCard: { backgroundColor: "white", padding: 15, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: "#ddd" },
  reportCategory: { fontSize: 18, fontWeight: "bold", color: "#007bff" },
  reportDetails: { fontSize: 16, color: "#333" },
  reportLocation: { fontSize: 14, color: "#666", marginTop: 5 },
  reportTime: { fontSize: 12, color: "#999", marginTop: 5 },
  refreshButton: { backgroundColor: "#28a745", padding: 15, borderRadius: 8, alignItems: "center", marginTop: 20 },
  refreshText: { color: "white", fontWeight: "bold", fontSize: 16 },
});

export default ViewIncidents;
