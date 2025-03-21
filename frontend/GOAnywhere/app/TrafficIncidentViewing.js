// TrafficIncidentViewing.js
import React, { useState, useEffect } from "react";
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  StyleSheet, 
  Modal, 
  ActivityIndicator,
  Alert,
  Image
} from "react-native";
import AuthService from "./authService";
import { getApiUrl } from "./utils/apiConfig";

const TrafficIncidentViewing = () => {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [voteModalVisible, setVoteModalVisible] = useState(false);
  const [voteConfirmModalVisible, setVoteConfirmModalVisible] = useState(false);
  const [voteType, setVoteType] = useState(null);
  const [modeOfTransport, setModeOfTransport] = useState("driving");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchIncidents();
  }, [modeOfTransport, statusFilter]);

  const fetchIncidents = async () => {
    try {
      setLoading(true);
      const endpoint = getApiUrl(`/api/traffic/incidents?mode=${modeOfTransport}&status=${statusFilter}`);
      const response = await fetch(endpoint);
      
      if (!response.ok) {
        throw new Error('Failed to fetch incidents');
      }
      
      const data = await response.json();
      setIncidents(data);
    } catch (error) {
      console.error("Error fetching incidents:", error);
      Alert.alert("Error", "Failed to load traffic incidents. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchIncidents();
  };

  const handleVote = async () => {
    try {
      if (!selectedIncident || !voteType) return;
      
      setVoteConfirmModalVisible(false);
      setVoteModalVisible(false);
      setLoading(true);
      
      // Get the user ID
      const userData = await AuthService.getUserData();
      const userId = userData?.uid || 'anonymous';
      
      // Submit the vote
      const endpoint = getApiUrl(`/api/traffic/incidents/${selectedIncident.id}/vote`);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          vote_type: voteType
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to submit vote');
      }
      
      // Update the incident list
      await fetchIncidents();
      
      Alert.alert(
        "Vote Submitted", 
        `You have ${voteType}d this incident report.`
      );
      
    } catch (error) {
      console.error("Error submitting vote:", error);
      Alert.alert("Error", "Failed to submit your vote. Please try again.");
    } finally {
      setLoading(false);
      setSelectedIncident(null);
      setVoteType(null);
    }
  };

  const renderIncidentItem = ({ item }) => {
    // Determine incident status color
    let statusColor = "#6c757d"; // Default gray
    if (item.status === "verified") {
      statusColor = "#28a745"; // Green for verified
    } else if (item.status === "false_report") {
      statusColor = "#dc3545"; // Red for false reports
    } else if (item.status === "pending") {
      statusColor = "#ffc107"; // Yellow for pending
    }
    
    // Format incident timestamp
    const timestamp = new Date(item.time_reported).toLocaleString();
    
    return (
      <TouchableOpacity 
        style={styles.incidentCard}
        onPress={() => {
          setSelectedIncident(item);
          setVoteModalVisible(true);
        }}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.incidentType}>{item.type}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusText}>{item.status}</Text>
          </View>
        </View>
        
        <Text style={styles.incidentSubType}>{item.sub_type}</Text>
        
        <View style={styles.locationContainer}>
          <Image 
            source={require('./assets/location-pin.png')} 
            style={styles.locationIcon}
            defaultSource={require('./assets/location-pin.png')}
          />
          <Text style={styles.locationText}>
            {item.location?.name || `${item.location?.latitude.toFixed(4)}, ${item.location?.longitude.toFixed(4)}`}
          </Text>
        </View>
        
        <Text style={styles.timestamp}>{timestamp}</Text>
        
        <View style={styles.voteContainer}>
          <View style={styles.voteCount}>
            <Text style={styles.voteCountText}>✓ {item.approves || 0}</Text>
          </View>
          <View style={styles.voteCount}>
            <Text style={styles.voteCountText}>✗ {item.rejects || 0}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderVoteModal = () => {
    if (!selectedIncident) return null;
    
    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={voteModalVisible}
        onRequestClose={() => setVoteModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Verify This Report</Text>
            
            <View style={styles.incidentDetails}>
              <Text style={styles.detailsLabel}>Type:</Text>
              <Text style={styles.detailsValue}>{selectedIncident.type}</Text>
              
              <Text style={styles.detailsLabel}>Subtype:</Text>
              <Text style={styles.detailsValue}>{selectedIncident.sub_type}</Text>
              
              <Text style={styles.detailsLabel}>Location:</Text>
              <Text style={styles.detailsValue}>
                {selectedIncident.location?.name || `${selectedIncident.location?.latitude.toFixed(4)}, ${selectedIncident.location?.longitude.toFixed(4)}`}
              </Text>
              
              <Text style={styles.detailsLabel}>Reported At:</Text>
              <Text style={styles.detailsValue}>
                {new Date(selectedIncident.time_reported).toLocaleString()}
              </Text>
              
              <Text style={styles.detailsLabel}>Current Votes:</Text>
              <View style={styles.voteStatsContainer}>
                <Text style={styles.voteStats}>Approves: {selectedIncident.approves || 0}</Text>
                <Text style={styles.voteStats}>Rejects: {selectedIncident.rejects || 0}</Text>
              </View>
            </View>
            
            <Text style={styles.votePrompt}>Is this report accurate?</Text>
            
            <View style={styles.voteButtonsContainer}>
              <TouchableOpacity 
                style={[styles.voteButton, styles.approveButton]}
                onPress={() => {
                  setVoteType("approve");
                  setVoteConfirmModalVisible(true);
                }}
              >
                <Text style={styles.voteButtonText}>✓ Approve</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.voteButton, styles.rejectButton]}
                onPress={() => {
                  setVoteType("reject");
                  setVoteConfirmModalVisible(true);
                }}
              >
                <Text style={styles.voteButtonText}>✗ Reject</Text>
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={() => setVoteModalVisible(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  const renderVoteConfirmModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={voteConfirmModalVisible}
      onRequestClose={() => setVoteConfirmModalVisible(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.confirmModalContent}>
          <Text style={styles.confirmModalTitle}>
            Confirm Your Vote
          </Text>
          
          <Text style={styles.confirmModalText}>
            Are you sure you want to <Text style={{fontWeight: 'bold'}}>{voteType}</Text> this incident report?
          </Text>
          
          <View style={styles.confirmButtonsContainer}>
            <TouchableOpacity 
              style={[styles.confirmButton, styles.cancelConfirmButton]}
              onPress={() => setVoteConfirmModalVisible(false)}
            >
              <Text style={styles.confirmButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.confirmButton, styles.submitConfirmButton]}
              onPress={handleVote}
            >
              <Text style={styles.confirmButtonText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.pageTitle}>Traffic Incidents</Text>
      
      {/* Filter Controls */}
      <View style={styles.filterContainer}>
        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>Mode:</Text>
          <View style={styles.buttonGroup}>
            <TouchableOpacity
              style={[
                styles.filterButton,
                modeOfTransport === "driving" && styles.activeFilter
              ]}
              onPress={() => setModeOfTransport("driving")}
            >
              <Text style={styles.filterButtonText}>Driver</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.filterButton,
                modeOfTransport === "public_transport" && styles.activeFilter
              ]}
              onPress={() => setModeOfTransport("public_transport")}
            >
              <Text style={styles.filterButtonText}>Public Transport</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>Status:</Text>
          <View style={styles.buttonGroup}>
            <TouchableOpacity
              style={[
                styles.filterButton,
                statusFilter === "pending" && styles.activeFilter
              ]}
              onPress={() => setStatusFilter("pending")}
            >
              <Text style={styles.filterButtonText}>Pending</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.filterButton,
                statusFilter === "verified" && styles.activeFilter
              ]}
              onPress={() => setStatusFilter("verified")}
            >
              <Text style={styles.filterButtonText}>Verified</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.filterButton,
                statusFilter === "false_report" && styles.activeFilter
              ]}
              onPress={() => setStatusFilter("false_report")}
            >
              <Text style={styles.filterButtonText}>False</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
      
      {/* Incident List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0066cc" />
          <Text style={styles.loadingText}>Loading incidents...</Text>
        </View>
      ) : (
        <FlatList
          data={incidents}
          renderItem={renderIncidentItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          ListEmptyComponent={
            <View style={styles.emptyListContainer}>
              <Text style={styles.emptyListText}>No incidents found.</Text>
              <TouchableOpacity 
                style={styles.refreshButton}
                onPress={handleRefresh}
              >
                <Text style={styles.refreshButtonText}>Refresh</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
      
      {/* Verification modal */}
      {renderVoteModal()}
      
      {/* Confirmation modal */}
      {renderVoteConfirmModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
    padding: 16,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginVertical: 16,
    textAlign: "center",
    color: "#333",
  },
  filterContainer: {
    backgroundColor: "white",
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  filterSection: {
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 8,
    color: "#333",
  },
  buttonGroup: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  filterButton: {
    backgroundColor: "#f1f3f5",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  activeFilter: {
    backgroundColor: "#0066cc",
  },
  filterButtonText: {
    color: "#333",
    fontWeight: "500",
    fontSize: 14,
  },
  incidentCard: {
    backgroundColor: "white",
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  incidentType: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  statusText: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
  },
  incidentSubType: {
    fontSize: 16,
    color: "#555",
    marginBottom: 8,
  },
  locationContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  locationIcon: {
    width: 16,
    height: 16,
    marginRight: 6,
  },
  locationText: {
    fontSize: 14,
    color: "#666",
  },
  timestamp: {
    fontSize: 12,
    color: "#888",
    marginBottom: 8,
  },
  voteContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  voteCount: {
    backgroundColor: "#f1f3f5",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
  voteCountText: {
    fontSize: 12,
    color: "#555",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#666",
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: 16,
  },
  emptyListContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 30,
  },
  emptyListText: {
    fontSize: 16,
    color: "#666",
    marginBottom: 16,
  },
  refreshButton: {
    backgroundColor: "#0066cc",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  refreshButtonText: {
    color: "white",
    fontWeight: "500",
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 10,
    padding: 20,
    width: "85%",
    maxHeight: "80%",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
    color: "#333",
  },
  incidentDetails: {
    backgroundColor: "#f1f3f5",
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  detailsLabel: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#555",
    marginTop: 6,
  },
  detailsValue: {
    fontSize: 16,
    color: "#333",
    marginBottom: 6,
  },
  voteStatsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  voteStats: {
    fontSize: 14,
    color: "#555",
  },
  votePrompt: {
    fontSize: 16,
    fontWeight: "500",
    textAlign: "center",
    marginBottom: 16,
    color: "#333",
  },
  voteButtonsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  voteButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginHorizontal: 8,
  },
  approveButton: {
    backgroundColor: "#28a745",
  },
  rejectButton: {
    backgroundColor: "#dc3545",
  },
  voteButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "500",
  },
  cancelButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: "#6c757d",
  },
  cancelButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "500",
  },
  confirmModalContent: {
    backgroundColor: "white",
    borderRadius: 10,
    padding: 20,
    width: "70%",
  },
  confirmModalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
    textAlign: "center",
    color: "#333",
  },
  confirmModalText: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
    color: "#555",
  },
  confirmButtonsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    marginHorizontal: 6,
  },
  cancelConfirmButton: {
    backgroundColor: "#6c757d",
  },
  submitConfirmButton: {
    backgroundColor: "#28a745",
  },
  confirmButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "500",
  },
});

export default TrafficIncidentViewing;