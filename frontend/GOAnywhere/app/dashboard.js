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
  };

  return (
    <View style={styles.container}>
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
    </View>
  );
};

const styles = StyleSheet.create({
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
