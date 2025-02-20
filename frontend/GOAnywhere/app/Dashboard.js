import React, { useState } from 'react';
import { 
  View, Text, TouchableOpacity, StyleSheet, TextInput, Modal, 
  Dimensions, Pressable 
} from 'react-native';
import { Slider } from '@react-native-assets/slider';
import DateTimePickerModal from 'react-native-modal-datetime-picker';

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

  // Handles time selection
  const handleConfirmTime = (selectedTime) => {
    setTime(selectedTime);
    setTimeModalVisible(false);
  };

  return (
    <View style={styles.container}>
      {/* Title */}
      <Text style={styles.title}>Dashboard</Text>

      {/* Filter Buttons */}
      <View style={styles.filterContainer}>
        <TouchableOpacity style={styles.filterButton} onPress={() => setDistanceModalVisible(true)}>
          <Text style={styles.filterText}>Distance ▼</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.filterButton} onPress={() => setDateModalVisible(true)}>
          <Text style={styles.filterText}>Date ▼</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.filterButton} onPress={() => setTimeModalVisible(true)}>
          <Text style={styles.filterText}>Time ▼</Text>
        </TouchableOpacity>
      </View>

      {/* Distance Picker Modal */}
      <Modal visible={isDistanceModalVisible} transparent animationType="fade" onRequestClose={() => setDistanceModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setDistanceModalVisible(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Distance</Text>
            <View style={styles.sliderContainer}>
              <Text style={styles.labelText}>0km</Text>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={10}
                step={0.1}
                value={distance}
                onValueChange={(value) => setDistance(parseFloat(value.toFixed(1)))}
                minimumTrackTintColor="#B8F1CC"
                maximumTrackTintColor="#ccc"
                thumbTintColor="#FFF"
              />
              <Text style={styles.labelText}>10km</Text>
            </View>
            <Text style={styles.selectedValue}>{distance} km</Text>
            <TouchableOpacity style={styles.applyButton} onPress={() => setDistanceModalVisible(false)}>
              <Text style={styles.applyButtonText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Date Picker Modal */}
      <DateTimePickerModal
        isVisible={isDateModalVisible}
        mode="date"
        onConfirm={(selectedDate) => {
          setDate(selectedDate);
          setDateModalVisible(false);
        }}
        onCancel={() => setDateModalVisible(false)}
      />

      {/* Time Picker Modal */}
      <DateTimePickerModal
        isVisible={isTimeModalVisible}
        mode="time"
        onConfirm={handleConfirmTime}
        onCancel={() => setTimeModalVisible(false)}
      />

      {/* Statistics Grid */}
      <View style={styles.gridContainer}>
        {["Travel Time Per 10km", "Congestion Level", "Average Speed", "Total Jam"].map((title, index) => (
          <View key={index} style={styles.statBox}>
            <Text style={styles.statTitle}>{title}</Text>
            <View style={styles.circle}><Text style={styles.statValue}>--</Text></View>
            <Text style={styles.statDescription}>Placeholder text</Text>
          </View>
        ))}
      </View>

      {/* Search Bar */}
      <TextInput style={styles.searchBar} placeholder="Search..." placeholderTextColor="#999" />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#2B2B2B', padding: 10 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff', textAlign: 'center', marginBottom: 10 },
  filterContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  filterButton: { backgroundColor: '#B8F1CC', padding: 10, borderRadius: 8, width: '30%', alignItems: 'center' },
  filterText: { color: '#000', fontSize: 16 },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 20 },
  statBox: { width: '48%', backgroundColor: '#D9D9D9', padding: 15, borderRadius: 10, alignItems: 'center', marginBottom: 10 },
  sliderContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '90%', paddingHorizontal: 10 },
  slider: { width: '80%', height: 40 },
  statTitle: { fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 5 },
  circle: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#F00', justifyContent: 'center', alignItems: 'center', marginBottom: 5 },
  statValue: { fontSize: 18, fontWeight: 'bold', color: '#FFF' },
  statDescription: { fontSize: 12, color: '#666', textAlign: 'center' },
  searchBar: { position: 'absolute', bottom: 10, left: 10, right: 10, backgroundColor: '#3D3D3D', padding: 10, borderRadius: 8, color: '#FFF' },
  applyButton: { backgroundColor: '#B8F1CC', padding: 10, borderRadius: 8, marginTop: 10, alignItems: 'center', width: '100%' },
  applyButtonText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { backgroundColor: '#fff', padding: 20, borderRadius: 10, alignItems: 'center' },
});

export default Dashboard;