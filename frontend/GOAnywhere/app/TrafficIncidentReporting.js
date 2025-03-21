// TrafficIncidentReporting.js
import React, { useState, useEffect } from "react";
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  Alert,
  Modal,
  ActivityIndicator,
  Image
} from "react-native";
import { useRouter, Link } from "expo-router";
import * as Location from 'expo-location';
import AuthService from "./authService";
import { getApiUrl } from "./utils/apiConfig";

const TrafficIncidentReporting = () => {
  const router = useRouter();
  const [modeOfTransport, setModeOfTransport] = useState("driving");
  const [incidentType, setIncidentType] = useState(null);
  const [incidentSubType, setIncidentSubType] = useState(null);
  const [categories, setCategories] = useState({ driving: [], public_transport: [] });
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState(null);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [successModalVisible, setSuccessModalVisible] = useState(false);

  // Fetch incident categories on component load
  useEffect(() => {
    fetchIncidentCategories();
    requestLocationPermission();
  }, []);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const currentLocation = await Location.getCurrentPositionAsync({});
        setLocation({
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
          name: "Current Location"
        });
      } else {
        Alert.alert(
          "Location Permission Denied",
          "We need location permission to report incidents accurately. You can still report but will need to enter location manually."
        );
      }
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  const fetchIncidentCategories = async () => {
    try {
      setLoading(true);
      const response = await fetch(getApiUrl("/api/traffic/incidents/categories"));
      const data = await response.json();
      
      if (data) {
        setCategories(data);
      }
    } catch (error) {
      console.error("Error fetching incident categories:", error);
      Alert.alert("Error", "Failed to load incident categories. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const renderTransportModeSelection = () => (
    <View style={styles.selectionContainer}>
      <Text style={styles.sectionTitle}>Select Mode of Transport</Text>
      <View style={styles.modeContainer}>
        <TouchableOpacity
          style={[styles.modeButton, modeOfTransport === "driving" && styles.selectedButton]}
          onPress={() => {
            setModeOfTransport("driving");
            setIncidentType(null);
            setIncidentSubType(null);
          }}
        >
          <Image 
            source={require('./assets/car-icon.png')} 
            style={styles.modeIcon}
            defaultSource={require('./assets/car-icon.png')}
          />
          <Text style={styles.modeText}>Driver</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.modeButton, modeOfTransport === "public_transport" && styles.selectedButton]}
          onPress={() => {
            setModeOfTransport("public_transport");
            setIncidentType(null);
            setIncidentSubType(null);
          }}
        >
          <Image 
            source={require('./assets/bus-icon.png')} 
            style={styles.modeIcon}
            defaultSource={require('./assets/bus-icon.png')}
          />
          <Text style={styles.modeText}>Public Transport</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderIncidentTypeSelection = () => {
    const currentCategories = categories[modeOfTransport] || [];
    
    // Transform the categories data into a format suitable for our grid
    let categoryData = [];
    if (currentCategories.categories) {
      categoryData = currentCategories.categories.map(cat => ({
        name: cat.name,
        subcategories: cat.subcategories
      }));
    }

    return (
      <View style={styles.selectionContainer}>
        <Text style={styles.sectionTitle}>Select Incident Type</Text>
        <View style={styles.gridContainer}>
          {categoryData.map((category, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.categoryButton,
                incidentType === category.name && styles.selectedButton
              ]}
              onPress={() => {
                setIncidentType(category.name);
                setIncidentSubType(null);
                setCurrentStep(3);
              }}
            >
              <Text style={styles.categoryText}>{category.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const renderSubcategorySelection = () => {
    if (!incidentType) return null;

    // Find the selected category to get its subcategories
    const currentCategories = categories[modeOfTransport] || {};
    const category = currentCategories.categories?.find(cat => cat.name === incidentType);
    
    if (!category) return null;

    return (
      <View style={styles.selectionContainer}>
        <Text style={styles.sectionTitle}>{incidentType} Subcategory</Text>
        <View style={styles.gridContainer}>
          {category.subcategories.map((subcat, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.categoryButton,
                incidentSubType === subcat && styles.selectedButton
              ]}
              onPress={() => {
                setIncidentSubType(subcat);
                setCurrentStep(4);
              }}
            >
              <Text style={styles.categoryText}>{subcat}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const renderLocationConfirmation = () => (
    <View style={styles.selectionContainer}>
      <Text style={styles.sectionTitle}>Confirm Location and Details</Text>
      
      <View style={styles.summaryBox}>
        <Text style={styles.summaryLabel}>Incident Type:</Text>
        <Text style={styles.summaryValue}>{incidentType}</Text>
        
        <Text style={styles.summaryLabel}>Subcategory:</Text>
        <Text style={styles.summaryValue}>{incidentSubType}</Text>
        
        <Text style={styles.summaryLabel}>Location:</Text>
        <Text style={styles.summaryValue}>
          {location ? `${location.name || 'Current location'}` : 'Location not available'}
        </Text>
        
        <Text style={styles.summaryLabel}>Date & Time:</Text>
        <Text style={styles.summaryValue}>{new Date().toLocaleString()}</Text>
      </View>

      <TouchableOpacity
        style={styles.submitButton}
        onPress={() => setConfirmModalVisible(true)}
      >
        <Text style={styles.submitButtonText}>Submit Report</Text>
      </TouchableOpacity>
    </View>
  );

  const renderStepNavigation = () => (
    <View style={styles.navigationContainer}>
      {currentStep > 1 && (
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setCurrentStep(currentStep - 1)}
        >
          <Text style={styles.navigationButtonText}>Back</Text>
        </TouchableOpacity>
      )}
      
      {currentStep < 4 && incidentType && (
        <TouchableOpacity
          style={styles.nextButton}
          onPress={() => {
            // Only advance if we have the required data for the current step
            if (
              (currentStep === 1 && modeOfTransport) ||
              (currentStep === 2 && incidentType) ||
              (currentStep === 3 && incidentSubType)
            ) {
              setCurrentStep(currentStep + 1);
            }
          }}
        >
          <Text style={styles.navigationButtonText}>Next</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderConfirmationModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={confirmModalVisible}
      onRequestClose={() => setConfirmModalVisible(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Confirm Report Submission</Text>
          
          <Text style={styles.modalText}>
            Are you sure you want to submit this traffic incident report?
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
              onPress={handleSubmitReport}
            >
              <Text style={styles.modalButtonText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderSuccessModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={successModalVisible}
      onRequestClose={() => {
        setSuccessModalVisible(false);
        router.navigate('dashboard');
      }}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Report Successfully Submitted</Text>
          
          <Text style={styles.modalText}>
            Thank you for your contribution! Your incident report has been submitted and will be validated by other users.
          </Text>
          
          <TouchableOpacity
            style={[styles.modalButton, styles.confirmButton, styles.fullWidthButton]}
            onPress={() => {
              setSuccessModalVisible(false);
              router.navigate('dashboard');
            }}
          >
            <Text style={styles.modalButtonText}>Return to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const handleSubmitReport = async () => {
    try {
      setLoading(true);
      setConfirmModalVisible(false);
      
      // Get the user ID from authentication service
      const userData = await AuthService.getUserData();
      const userId = userData?.uid || 'anonymous';
      
      // Prepare the report data
      const reportData = {
        user_id: userId,
        mode_of_transport: modeOfTransport,
        type: incidentType,
        sub_type: incidentSubType,
        location: location,
        time_reported: new Date().toISOString(),
      };
      
      // Submit the report to the backend API
      const response = await fetch(getApiUrl("/api/traffic/incidents/report"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(reportData),
      });
      
      if (!response.ok) {
        throw new Error("Failed to submit report");
      }
      
      // Show success message
      setSuccessModalVisible(true);
      
      // Reset the form
      setIncidentType(null);
      setIncidentSubType(null);
      setCurrentStep(1);
      
    } catch (error) {
      console.error("Error submitting report:", error);
      Alert.alert("Error", "Failed to submit report. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Render the appropriate step based on current progress
  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return renderTransportModeSelection();
      case 2:
        return renderIncidentTypeSelection();
      case 3:
        return renderSubcategorySelection();
      case 4:
        return renderLocationConfirmation();
      default:
        return null;
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 30 }}>
      <Text style={styles.pageTitle}>Report Traffic Incident</Text>
      
      {/* Step indicators */}
      <View style={styles.stepsContainer}>
        <View style={[styles.stepIndicator, currentStep >= 1 && styles.activeStep]}>
          <Text style={styles.stepText}>1</Text>
        </View>
        <View style={styles.stepLine} />
        <View style={[styles.stepIndicator, currentStep >= 2 && styles.activeStep]}>
          <Text style={styles.stepText}>2</Text>
        </View>
        <View style={styles.stepLine} />
        <View style={[styles.stepIndicator, currentStep >= 3 && styles.activeStep]}>
          <Text style={styles.stepText}>3</Text>
        </View>
        <View style={styles.stepLine} />
        <View style={[styles.stepIndicator, currentStep >= 4 && styles.activeStep]}>
          <Text style={styles.stepText}>4</Text>
        </View>
      </View>
      
      {/* Current step content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0066cc" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : (
        renderCurrentStep()
      )}
      
      {/* Navigation buttons */}
      {!loading && renderStepNavigation()}
      
      {/* Confirmation Modal */}
      {renderConfirmationModal()}
      
      {/* Success Modal */}
      {renderSuccessModal()}
    </ScrollView>
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
  stepsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  stepIndicator: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#ccc",
    justifyContent: "center",
    alignItems: "center",
  },
  activeStep: {
    backgroundColor: "#0066cc",
  },
  stepText: {
    color: "white",
    fontWeight: "bold",
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: "#ccc",
    marginHorizontal: 5,
  },
  selectionContainer: {
    backgroundColor: "white",
    borderRadius: 10,
    padding: 16,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
    color: "#333",
  },
  modeContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  modeButton: {
    flex: 1,
    alignItems: "center",
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    marginHorizontal: 8,
  },
  modeIcon: {
    width: 40,
    height: 40,
    marginBottom: 8,
  },
  modeText: {
    fontSize: 16,
    fontWeight: "500",
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  categoryButton: {
    width: "48%",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
    backgroundColor: "#f1f3f5",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  selectedButton: {
    backgroundColor: "#0066cc",
    borderColor: "#0066cc",
  },
  categoryText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
  },
  summaryBox: {
    backgroundColor: "#f1f3f5",
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#555",
    marginTop: 8,
  },
  summaryValue: {
    fontSize: 16,
    color: "#333",
    marginBottom: 8,
  },
  submitButton: {
    backgroundColor: "#28a745",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  submitButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  navigationContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },
  backButton: {
    backgroundColor: "#6c757d",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    flex: 1,
    marginRight: 8,
    alignItems: "center",
  },
  nextButton: {
    backgroundColor: "#0066cc",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    flex: 1,
    marginLeft: 8,
    alignItems: "center",
  },
  navigationButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "500",
  },
  loadingContainer: {
    padding: 20,
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#666",
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
    marginBottom: 15,
    color: "#333",
  },
  modalText: {
    fontSize: 16,
    color: "#555",
    textAlign: "center",
    marginBottom: 20,
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
  fullWidthButton: {
    marginHorizontal: 0,
  },
  modalButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "500",
  },
});

export default TrafficIncidentReporting;