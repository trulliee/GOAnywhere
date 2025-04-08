<<<<<<< HEAD
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
=======
import React, { useState } from 'react';
import { 
  View, Text, TouchableOpacity, StyleSheet, TextInput, Modal, 
  Dimensions, Pressable 
} from 'react-native';

const { width, height } = Dimensions.get('window');

const Dashboard = () => {
  // State for filters
  const [distance, setDistance] = useState(5);
  const [date, setDate] = useState(new Date());
  const [time, setTime] = useState(new Date());
  
  // Modal visibility states
  const [isDistanceModalVisible, setDistanceModalVisible] = useState(false);
  const [isDateModalVisible, setDateModalVisible] = useState(false);
  const [isTimeModalVisible, setTimeModalVisible] = useState(false);

  // Format date for display
  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Format time for display
  const formatTime = (time) => {
    return time.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
>>>>>>> 7c3b9d078f6c48c4a496c3d52fe85af49ad6547c
  };

  return (
    <View style={styles.container}>
<<<<<<< HEAD
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
=======
      {/* Title */}
      <Text style={styles.title}>Dashboard</Text>

      {/* Filter Buttons */}
      <View style={styles.filterContainer}>
        <TouchableOpacity style={styles.filterButton} onPress={() => setDistanceModalVisible(true)}>
          <Text style={styles.filterText}>Distance: {distance}km ▼</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.filterButton} onPress={() => setDateModalVisible(true)}>
          <Text style={styles.filterText}>Date: {formatDate(date)} ▼</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.filterButton} onPress={() => setTimeModalVisible(true)}>
          <Text style={styles.filterText}>Time: {formatTime(time)} ▼</Text>
        </TouchableOpacity>
      </View>

      {/* Distance Picker Modal */}
      <Modal visible={isDistanceModalVisible} transparent animationType="fade" onRequestClose={() => setDistanceModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setDistanceModalVisible(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Distance</Text>
            
            {/* Simple distance selector with + and - buttons */}
            <View style={styles.distanceSelector}>
              <TouchableOpacity 
                style={styles.distanceButton}
                onPress={() => setDistance(Math.max(0, distance - 0.5))}
              >
                <Text style={styles.distanceButtonText}>-</Text>
              </TouchableOpacity>
              
              <Text style={styles.selectedValue}>{distance} km</Text>
              
              <TouchableOpacity 
                style={styles.distanceButton}
                onPress={() => setDistance(Math.min(10, distance + 0.5))}
              >
                <Text style={styles.distanceButtonText}>+</Text>
              </TouchableOpacity>
            </View>
            
            {/* Distance range display */}
            <View style={styles.rangeContainer}>
              <Text style={styles.rangeText}>0km</Text>
              <View style={styles.rangeBar}>
                <View style={[styles.rangeFill, { width: `${(distance/10)*100}%` }]} />
              </View>
              <Text style={styles.rangeText}>10km</Text>
            </View>
            
            <TouchableOpacity style={styles.applyButton} onPress={() => setDistanceModalVisible(false)}>
              <Text style={styles.applyButtonText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Date Picker Modal */}
      <Modal visible={isDateModalVisible} transparent animationType="fade" onRequestClose={() => setDateModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setDateModalVisible(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Date</Text>
            
            {/* Simple date selector */}
            <View style={styles.dateSelector}>
              <TouchableOpacity 
                style={styles.dateButton}
                onPress={() => {
                  const newDate = new Date(date);
                  newDate.setDate(newDate.getDate() - 1);
                  setDate(newDate);
                }}
              >
                <Text style={styles.dateButtonText}>Previous Day</Text>
              </TouchableOpacity>
              
              <Text style={styles.selectedDate}>{formatDate(date)}</Text>
              
              <TouchableOpacity 
                style={styles.dateButton}
                onPress={() => {
                  const newDate = new Date(date);
                  newDate.setDate(newDate.getDate() + 1);
                  setDate(newDate);
                }}
              >
                <Text style={styles.dateButtonText}>Next Day</Text>
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity style={styles.applyButton} onPress={() => setDateModalVisible(false)}>
              <Text style={styles.applyButtonText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Time Picker Modal */}
      <Modal visible={isTimeModalVisible} transparent animationType="fade" onRequestClose={() => setTimeModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setTimeModalVisible(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Time</Text>
            
            {/* Simple time selector with hour and minute selection */}
            <View style={styles.timeSelector}>
              <View style={styles.timeColumn}>
                <TouchableOpacity 
                  style={styles.timeButton}
                  onPress={() => {
                    const newTime = new Date(time);
                    newTime.setHours(newTime.getHours() + 1);
                    setTime(newTime);
                  }}
                >
                  <Text style={styles.timeButtonText}>▲</Text>
                </TouchableOpacity>
                
                <Text style={styles.timeValue}>{time.getHours().toString().padStart(2, '0')}</Text>
                
                <TouchableOpacity 
                  style={styles.timeButton}
                  onPress={() => {
                    const newTime = new Date(time);
                    newTime.setHours(newTime.getHours() - 1);
                    setTime(newTime);
                  }}
                >
                  <Text style={styles.timeButtonText}>▼</Text>
                </TouchableOpacity>
              </View>
              
              <Text style={styles.timeSeparator}>:</Text>
              
              <View style={styles.timeColumn}>
                <TouchableOpacity 
                  style={styles.timeButton}
                  onPress={() => {
                    const newTime = new Date(time);
                    newTime.setMinutes(newTime.getMinutes() + 15);
                    setTime(newTime);
                  }}
                >
                  <Text style={styles.timeButtonText}>▲</Text>
                </TouchableOpacity>
                
                <Text style={styles.timeValue}>{time.getMinutes().toString().padStart(2, '0')}</Text>
                
                <TouchableOpacity 
                  style={styles.timeButton}
                  onPress={() => {
                    const newTime = new Date(time);
                    newTime.setMinutes(newTime.getMinutes() - 15);
                    setTime(newTime);
                  }}
                >
                  <Text style={styles.timeButtonText}>▼</Text>
                </TouchableOpacity>
              </View>
            </View>
            
            <TouchableOpacity style={styles.applyButton} onPress={() => setTimeModalVisible(false)}>
              <Text style={styles.applyButtonText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Statistics Grid */}
      <View style={styles.gridContainer}>
        {[
          {title: "Travel Time Per 10km", value: "25", unit: "min", color: "#FF7F7F"}, 
          {title: "Congestion Level", value: "Med", unit: "", color: "#FFC47F"}, 
          {title: "Average Speed", value: "40", unit: "km/h", color: "#7FAAFF"}, 
          {title: "Total Jam", value: "3", unit: "km", color: "#7FFF8E"}
        ].map((stat, index) => (
          <View key={index} style={styles.statBox}>
            <Text style={styles.statTitle}>{stat.title}</Text>
            <View style={[styles.circle, {backgroundColor: stat.color}]}>
              <Text style={styles.statValue}>{stat.value}</Text>
            </View>
            <Text style={styles.statUnit}>{stat.unit}</Text>
            <Text style={styles.statDescription}>Based on current data</Text>
          </View>
        ))}
      </View>

      {/* Search Bar */}
      <TextInput style={styles.searchBar} placeholder="Search..." placeholderTextColor="#999" />
>>>>>>> 7c3b9d078f6c48c4a496c3d52fe85af49ad6547c
    </View>
  );
};

const styles = StyleSheet.create({
<<<<<<< HEAD
  container: { flex: 1, padding: 20, backgroundColor: "#f5f5f5", justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "bold", textAlign: "center", marginBottom: 20 },
  button: { backgroundColor: "#007bff", padding: 15, borderRadius: 8, alignItems: "center" },
  buttonText: { color: "white", fontWeight: "bold", fontSize: 16 },
  trafficContainer: { marginTop: 20, padding: 15, backgroundColor: "#fff", borderRadius: 8, borderWidth: 1, borderColor: "#ddd" },
  trafficText: { fontSize: 18, fontWeight: "bold", textAlign: "center", marginBottom: 5 },
});

export default TrafficApp;
=======
  container: { 
    flex: 1, 
    backgroundColor: '#2B2B2B', 
    padding: 10 
  },
  title: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    color: '#fff', 
    textAlign: 'center', 
    marginBottom: 15,
    marginTop: 10
  },
  filterContainer: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginBottom: 15 
  },
  filterButton: { 
    backgroundColor: '#B8F1CC', 
    padding: 10, 
    borderRadius: 8, 
    width: '32%', 
    alignItems: 'center' 
  },
  filterText: { 
    color: '#000', 
    fontSize: 12,
    fontWeight: '500'
  },
  gridContainer: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    justifyContent: 'space-between', 
    marginBottom: 20 
  },
  statBox: { 
    width: '48%', 
    backgroundColor: '#D9D9D9', 
    padding: 15, 
    borderRadius: 10, 
    alignItems: 'center', 
    marginBottom: 10 
  },
  statTitle: { 
    fontSize: 14, 
    fontWeight: 'bold', 
    color: '#333', 
    marginBottom: 5 
  },
  circle: { 
    width: 60, 
    height: 60, 
    borderRadius: 30, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 5 
  },
  statValue: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    color: '#FFF' 
  },
  statUnit: {
    fontSize: 14,
    color: '#444',
    fontWeight: '500'
  },
  statDescription: { 
    fontSize: 12, 
    color: '#666', 
    textAlign: 'center',
    marginTop: 3
  },
  searchBar: { 
    position: 'absolute', 
    bottom: 10, 
    left: 10, 
    right: 10, 
    backgroundColor: '#3D3D3D', 
    padding: 10, 
    borderRadius: 8, 
    color: '#FFF' 
  },
  modalOverlay: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: 'rgba(0,0,0,0.5)' 
  },
  modalContent: { 
    backgroundColor: '#fff', 
    padding: 20, 
    borderRadius: 10, 
    alignItems: 'center',
    width: '80%'
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333'
  },
  distanceSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 20
  },
  distanceButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#B8F1CC',
    justifyContent: 'center',
    alignItems: 'center'
  },
  distanceButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333'
  },
  selectedValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333'
  },
  rangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 20
  },
  rangeText: {
    fontSize: 14,
    color: '#666'
  },
  rangeBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    marginHorizontal: 10
  },
  rangeFill: {
    height: '100%',
    backgroundColor: '#B8F1CC',
    borderRadius: 4
  },
  applyButton: { 
    backgroundColor: '#B8F1CC', 
    padding: 10, 
    borderRadius: 8, 
    marginTop: 10, 
    alignItems: 'center', 
    width: '100%' 
  },
  applyButtonText: { 
    color: '#000', 
    fontWeight: 'bold', 
    fontSize: 16 
  },
  dateSelector: {
    width: '100%',
    marginBottom: 20
  },
  dateButton: {
    backgroundColor: '#B8F1CC',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 5
  },
  dateButtonText: {
    color: '#333',
    fontWeight: '500'
  },
  selectedDate: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginVertical: 10
  },
  timeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20
  },
  timeColumn: {
    alignItems: 'center'
  },
  timeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center'
  },
  timeButtonText: {
    fontSize: 20,
    color: '#B8F1CC',
    fontWeight: 'bold'
  },
  timeValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginVertical: 10
  },
  timeSeparator: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginHorizontal: 10
  }
});

export default Dashboard;
>>>>>>> 7c3b9d078f6c48c4a496c3d52fe85af49ad6547c
