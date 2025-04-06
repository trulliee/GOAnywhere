//This file display the data from the two dimensional array incidents, from IncidentData.js
//TrafficIncident.js use this code to display the data. 

import React, { useState } from "react";
import { View, Text, TouchableOpacity, Modal, Button, StyleSheet } from "react-native";
import { SEVERITY_LEVELS, SEVERITY_COLORS } from "./IncidentData";

const IncidentDisplay = ({ id, type, detail, location, time, severity, source, confirmRate, onUpdateConfirmRate }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [voted, setVoted] = useState(null); // Track if user has voted (null = not voted, 1 = approved, -1 = rejected)

  return (
    <View>
      {/* Clickable Incident Row */}
      <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.incidentContainer}>
        <View style={[styles.severityIndicator, { backgroundColor: SEVERITY_COLORS[severity] }]} />
        <View style={styles.incidentInfo}>
          <Text style={styles.incidentType}>{type} - {detail}</Text>
          <Text style={styles.incidentLocation}>📍 {location}</Text>
          <Text style={styles.incidentTime}>⏰ {time}</Text>
          <Text style={styles.incidentSource}>📝 Source: {source}</Text>
          <Text style={styles.incidentSeverity}>
            🔴 Severity: {SEVERITY_LEVELS[severity]}
          </Text>
          <Text style={styles.incidentConfirmRate}>🔄 Confirm Rate: {confirmRate}</Text>
        </View>
      </TouchableOpacity>

      {/* Popup Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Confirm Incident</Text>
            <Text>{type} - {detail}</Text>
            <Text>📍 {location}</Text>
            <Text>🔴 Severity: {SEVERITY_LEVELS[severity]}</Text>
            <Text>🔄 Confirm Rate: {confirmRate}</Text>

            {/* Approve & Reject Buttons or Vote Message */}
            <View style={styles.buttonContainer}>
              {voted === null ? (
                <>
                  <Button 
                    title="Approve ✅" 
                    onPress={() => {
                      onUpdateConfirmRate(id, 1); // +1 confirmRate
                      setVoted(1); // Mark as approved
                    }} 
                  />
                  <Button 
                    title="Reject ❌" 
                    onPress={() => {
                      onUpdateConfirmRate(id, -1); // -1 confirmRate
                      setVoted(-1); // Mark as rejected
                    }} 
                  />
                </>
              ) : (
                <Text style={styles.voteMessage}>
                  {voted === 1 ? "✅ You've approved this incident" : "❌ You've rejected this incident"}
                </Text>
              )}
            </View>

            {/* Close Button with Spacing */}
            <View style={styles.closeButtonContainer}>
              <Button title="Close" onPress={() => setModalVisible(false)} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  incidentContainer: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  severityIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 12,
  },
  incidentInfo: { flex: 1 },
  incidentType: { fontSize: 16, fontWeight: "bold" },
  incidentLocation: { fontSize: 14, color: "#555", marginTop: 4 },
  incidentTime: { fontSize: 14, color: "#777", marginTop: 2 },
  incidentSource: { fontSize: 14, color: "#888", marginTop: 2 },
  incidentSeverity: { fontSize: 14, fontWeight: "bold", marginTop: 4, color: "#333" },
  incidentConfirmRate: { fontSize: 14, fontWeight: "bold", marginTop: 4, color: "#333" },
  modalContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.5)" },
  modalContent: { backgroundColor: "#fff", padding: 20, borderRadius: 8, width: 300, alignItems: "center" },
  modalTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 10 },
  buttonContainer: { flexDirection: "row", justifyContent: "space-around", width: "100%", marginTop: 10 },
  voteMessage: { fontSize: 16, fontWeight: "bold", marginTop: 10, textAlign: "center" },
  closeButtonContainer: { marginTop: 15 }, // Space for close button
});

export default IncidentDisplay;
