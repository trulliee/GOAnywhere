// IncidentVotingComponent.js
import React, { useState, useEffect } from "react";
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet,
  Modal,
  ActivityIndicator,
  Alert
} from "react-native";
import AuthService from "./authService";
import { getApiUrl } from "./utils/apiConfig";

const IncidentVotingComponent = ({ incident, onVoteComplete }) => {
  const [loading, setLoading] = useState(false);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [voteType, setVoteType] = useState(null);
  const [votingInfo, setVotingInfo] = useState({
    approves: incident?.approves || 0,
    rejects: incident?.rejects || 0,
    status: incident?.status || 'pending',
    timeRemaining: 0,
    approvesNeeded: 0,
    rejectsNeeded: 0
  });

  useEffect(() => {
    if (incident?.id) {
      fetchVotingStatus();
    }
  }, [incident]);

  const fetchVotingStatus = async () => {
    try {
      const endpoint = getApiUrl(`/api/traffic/incidents/${incident.id}/status`);
      const response = await fetch(endpoint);
      
      if (!response.ok) {
        throw new Error('Failed to fetch incident status');
      }
      
      const data = await response.json();
      setVotingInfo({
        approves: data.approves,
        rejects: data.rejects,
        status: data.status,
        timeRemaining: data.time_remaining_seconds,
        approvesNeeded: data.approves_needed,
        rejectsNeeded: data.rejects_needed
      });
    } catch (error) {
      console.error("Error fetching incident status:", error);
    }
  };

  const submitVote = async () => {
    try {
      setLoading(true);
      setConfirmModalVisible(false);
      
      // Get the user ID
      const userData = await AuthService.getUserData();
      const userId = userData?.uid || 'anonymous';
      
      // Submit the vote
      const endpoint = getApiUrl(`/api/traffic/incidents/${incident.id}/vote`);
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
      
      // Update voting info
      await fetchVotingStatus();
      
      Alert.alert(
        "Vote Submitted", 
        `You have ${voteType}d this incident report.`
      );
      
      // Notify parent component that vote was completed
      if (onVoteComplete) {
        onVoteComplete();
      }
      
    } catch (error) {
      console.error("Error submitting vote:", error);
      Alert.alert("Error", "Failed to submit your vote. Please try again.");
    } finally {
      setLoading(false);
      setVoteType(null);
    }
  };

  const formatTimeRemaining = (seconds) => {
    if (seconds <= 0) return "Validation period ended";
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    return `${minutes}m ${remainingSeconds}s remaining for validation`;
  };

  const renderConfirmModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={confirmModalVisible}
      onRequestClose={() => setConfirmModalVisible(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Confirm Your Vote</Text>
          
          <Text style={styles.modalText}>
            Are you sure you want to <Text style={{fontWeight: 'bold'}}>{voteType}</Text> this incident report?
          </Text>
          
          <View style={styles.modalButtons}>
            <TouchableOpacity 
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => setConfirmModalVisible(false)}
            >
              <Text style={styles.modalButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.modalButton, styles.confirmButton]}
              onPress={submitVote}
            >
              <Text style={styles.modalButtonText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  if (!incident) return null;

  // Format percentage for progress bars
  const approvePercentage = Math.min(100, (votingInfo.approves / 10) * 100);
  const rejectPercentage = Math.min(100, (votingInfo.rejects / 10) * 100);

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#0066cc" />
          <Text style={styles.loadingText}>Processing...</Text>
        </View>
      ) : (
        <>
          <Text style={styles.title}>Validate This Report</Text>
          
          <Text style={styles.timeRemaining}>
            {formatTimeRemaining(votingInfo.timeRemaining)}
          </Text>
          
          <View style={styles.progressContainer}>
            <View style={styles.progressSection}>
              <View style={styles.progressLabelContainer}>
                <Text style={styles.progressLabel}>Approves</Text>
                <Text style={styles.countText}>{votingInfo.approves}/10</Text>
              </View>
              <View style={styles.progressBarBg}>
                <View 
                  style={[
                    styles.progressBarFill, 
                    styles.approveBar,
                    { width: `${approvePercentage}%` }
                  ]} 
                />
              </View>
            </View>
            
            <View style={styles.progressSection}>
              <View style={styles.progressLabelContainer}>
                <Text style={styles.progressLabel}>Rejects</Text>
                <Text style={styles.countText}>{votingInfo.rejects}/10</Text>
              </View>
              <View style={styles.progressBarBg}>
                <View 
                  style={[
                    styles.progressBarFill, 
                    styles.rejectBar,
                    { width: `${rejectPercentage}%` }
                  ]} 
                />
              </View>
            </View>
          </View>
          
          <View style={styles.votingPrompt}>
            <Text style={styles.promptText}>Is this report accurate?</Text>
          </View>
          
          <View style={styles.voteButtonsContainer}>
            <TouchableOpacity 
              style={[styles.voteButton, styles.approveButton]}
              onPress={() => {
                setVoteType("approve");
                setConfirmModalVisible(true);
              }}
              disabled={votingInfo.status !== 'pending'}
            >
              <Text style={styles.voteButtonText}>✓ Approve</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.voteButton, styles.rejectButton]}
              onPress={() => {
                setVoteType("reject");
                setConfirmModalVisible(true);
              }}
              disabled={votingInfo.status !== 'pending'}
            >
              <Text style={styles.voteButtonText}>✗ Reject</Text>
            </TouchableOpacity>
          </View>
          
          {/* Show status message if already verified or rejected */}
          {votingInfo.status !== 'pending' && (
            <View style={styles.statusMessageContainer}>
              <Text style={styles.statusMessage}>
                This report has been marked as{' '}
                <Text style={{fontWeight: 'bold'}}>{votingInfo.status}</Text>
              </Text>
            </View>
          )}
        </>
      )}
      
      {renderConfirmModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
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
  loadingContainer: {
    alignItems: "center",
    padding: 16,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: "#666",
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
    textAlign: "center",
    color: "#333",
  },
  timeRemaining: {
    fontSize: 14,
    color: "#666",
    marginBottom: 16,
    textAlign: "center",
    fontStyle: "italic",
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressSection: {
    marginBottom: 12,
  },
  progressLabelContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
  },
  countText: {
    fontSize: 14,
    color: "#666",
  },
  progressBarBg: {
    height: 12,
    backgroundColor: "#f1f3f5",
    borderRadius: 6,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 6,
  },
  approveBar: {
    backgroundColor: "#28a745",
  },
  rejectBar: {
    backgroundColor: "#dc3545",
  },
  votingPrompt: {
    marginBottom: 16,
  },
  promptText: {
    fontSize: 16,
    fontWeight: "500",
    textAlign: "center",
    color: "#333",
  },
  voteButtonsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
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
  statusMessageContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: "#f8f9fa",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#dee2e6",
  },
  statusMessage: {
    fontSize: 14,
    textAlign: "center",
    color: "#555",
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
    width: "80%",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
    color: "#333",
  },
  modalText: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
    color: "#555",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  modalButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    flex: 1,
    alignItems: "center",
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: "#6c757d",
  },
  confirmButton: {
    backgroundColor: "#28a745",
  },
  modalButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "500",
  },
});

export default IncidentVotingComponent;