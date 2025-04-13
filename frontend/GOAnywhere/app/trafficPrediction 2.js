import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  ActivityIndicator, 
  Alert,
  Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import AuthService from './authService';
import apiConfig from './utils/apiConfig'; // Import as default

export default function TrafficPrediction() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Form inputs
  const [startLocation, setStartLocation] = useState('');
  const [destination, setDestination] = useState('');
  const [transportMode, setTransportMode] = useState('driving');
  
  // Prediction results
  const [prediction, setPrediction] = useState(null);

  // Fetch current user on component mount
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const currentUser = await AuthService.getCurrentUser();
        console.log("Current user:", currentUser);
        
        // Set user only if it's a registered (non-anonymous) user
        if (currentUser && !currentUser.isAnonymous) {
          console.log("Setting registered user");
          setUser(currentUser);
        } else {
          console.log("User is anonymous or not logged in");
          setUser(null); // Ensure user is null for anonymous users
        }
      } catch (err) {
        console.error("Error fetching user:", err);
        setUser(null);
      }
    };
    
    fetchUser();
  }, []);

  const formatDate = (date) => {
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
  };

  const handleSubmit = async () => {
    // Validate inputs
    if (!startLocation || !destination) {
      Alert.alert('Error', 'Please enter both start location and destination');
      return;
    }
    
    setLoading(true);
    setError(null);
    setPrediction(null);
    
    try {
      // Always use current date and time for prediction
      const currentTime = new Date();
      
      // Prepare request payload
      const requestPayload = {
        start_location: {
          name: startLocation
        },
        destination_location: {
          name: destination
        },
        mode_of_transport: transportMode === 'transit' ? 'public_transport' : transportMode,
        prediction_time: currentTime.toISOString()
      };
      
      console.log("Sending request payload:", requestPayload);
      
      // Set up base request options without auth header
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestPayload)
      };
      
      // Only add Authorization header if user is logged in and not anonymous
      if (user && !user.isAnonymous) {
        try {
          const token = await AuthService.getToken();
          if (token) {
            console.log("Adding auth token to request");
            requestOptions.headers['Authorization'] = `Bearer ${token}`;
          }
        } catch (tokenError) {
          console.error("Error getting token:", tokenError);
          // Continue without the token
        }
      } else {
        console.log("No authenticated user, proceeding without token");
      }
      
      // Use the apiConfig directly to get the API URL
      const apiUrl = apiConfig.getApiUrl();
      console.log("API URL:", `${apiUrl}/api/predict/traffic`);
      
      // Make API request to your backend endpoint
      const response = await fetch(`${apiUrl}/api/predict/traffic`, requestOptions);
      
      // Handle response
      if (!response.ok) {
        console.log("Response not OK. Status:", response.status);
        let errorDetail = "Server error: " + response.status;
        try {
          const errorText = await response.text();
          console.log("Error response text:", errorText);
          if (errorText) {
            try {
              const errorData = JSON.parse(errorText);
              errorDetail = errorData.detail || 'Failed to fetch prediction';
            } catch (parseError) {
              errorDetail = errorText;
            }
          }
        } catch (textError) {
          console.log("Error getting response text:", textError);
        }
        throw new Error(errorDetail);
      }
      
      // Get the response data
      const data = await response.json();
      console.log("RAW prediction response:", JSON.stringify(data, null, 2));
  
      // Set the prediction data
      setPrediction(data);
    } catch (err) {
      console.error('Prediction Error:', err);
      setError(err.message || 'Unable to fetch prediction');
    } finally {
      setLoading(false);
    }
  };

  // Render prediction for unregistered users
  const renderBasicPrediction = () => {
    if (!prediction) return null;
    
    return (
      <View style={styles.predictionContainer}>
        <Text style={styles.sectionTitle}>Traffic Prediction</Text>
        
        <View style={styles.predictionItem}>
          <Text style={styles.predictionLabel}>Road Conditions:</Text>
          <Text style={[
            styles.predictionValue,
            prediction.road_conditions === 'Congested' ? styles.redText :
            prediction.road_conditions === 'Moderate' ? styles.yellowText :
            styles.greenText
          ]}>
            {prediction.road_conditions || "Clear"}
          </Text>
        </View>
        
        <View style={styles.predictionItem}>
          <Text style={styles.predictionLabel}>Possible Delays:</Text>
          <Text style={[
            styles.predictionValue,
            prediction.possible_delays === 'Yes' ? styles.redText : styles.greenText
          ]}>
            {prediction.possible_delays || "No"}
          </Text>
        </View>
        
        <View style={styles.predictionItem}>
          <Text style={styles.predictionLabel}>Weather Conditions:</Text>
          <Text style={styles.predictionValue}>{prediction.weather_conditions || "Clear"}</Text>
        </View>
        
        {!user && (
          <TouchableOpacity 
            style={styles.registerButton}
            onPress={() => router.push('/login')}
          >
            <Text style={styles.registerButtonText}>Register for detailed predictions</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };
  
  // Render detailed prediction for registered users
  const renderDetailedPrediction = () => {
    if (!prediction || !user) return null;
    
    console.log("Rendering detailed prediction with:", prediction);
    return (
      <View style={styles.predictionContainer}>
        <Text style={styles.sectionTitle}>Detailed Traffic Prediction</Text>
        
        {/* Basic Info Summary at Top */}
        <View style={styles.basicInfoCard}>
          <View style={styles.basicInfoItem}>
            <Text style={styles.basicInfoLabel}>Road Conditions:</Text>
            <Text style={[
              styles.basicInfoValue,
              prediction.road_conditions === 'Congested' ? styles.redText :
              prediction.road_conditions === 'Moderate' ? styles.yellowText :
              styles.greenText
            ]}>
              {prediction.road_conditions}
            </Text>
          </View>
          
          <View style={styles.basicInfoItem}>
            <Text style={styles.basicInfoLabel}>Weather:</Text>
            <Text style={styles.basicInfoValue}>{prediction.weather_conditions}</Text>
          </View>
          
          <View style={styles.basicInfoItem}>
            <Text style={styles.basicInfoLabel}>Recommendation:</Text>
            <Text style={[
              styles.basicInfoValue,
              prediction.general_travel_recommendation === 'Ideal' ? styles.greenText : styles.redText
            ]}>
              {prediction.general_travel_recommendation || "Unavailable"}
            </Text>
          </View>
        </View>
        
        {/* Road Conditions Probability */}
        <View style={styles.detailSection}>
          <Text style={styles.detailTitle}>Road Conditions Probability</Text>
          
          {prediction.road_conditions_probability && Object.keys(prediction.road_conditions_probability).length > 0 ? (
            Object.entries(prediction.road_conditions_probability).map(([condition, probability]) => (
              <View key={condition} style={styles.probabilityItem}>
                <Text style={styles.conditionLabel}>{condition}:</Text>
                <View style={styles.probabilityBar}>
                  <View 
                    style={[
                      styles.probabilityFill, 
                      { width: `${probability}%` },
                      condition === 'Congested' ? styles.congested : 
                      condition === 'Moderate' ? styles.moderate : 
                      styles.clear
                    ]}
                  />
                </View>
                <Text style={styles.probabilityText}>{probability}%</Text>
              </View>
            ))
          ) : (
            <Text style={styles.noDataText}>No probability data available</Text>
          )}
        </View>
        
        {/* Estimated Travel Time */}
        <View style={styles.detailSection}>
          <Text style={styles.detailTitle}>Estimated Travel Time</Text>
          
          <View style={styles.timeItem}>
            <Text style={styles.timeLabel}>Estimated Time:</Text>
            <Text style={styles.timeValue}>
              {prediction.estimated_travel_time ? `${prediction.estimated_travel_time} min` : 'Not available'}
            </Text>
          </View>
        </View>
        
        {/* Alternative Routes */}
        {prediction.alternative_routes && prediction.alternative_routes.length > 0 && (
          <View style={styles.detailSection}>
            <Text style={styles.detailTitle}>Alternative Routes</Text>
            
            {prediction.alternative_routes.map((route, index) => (
              <View key={index} style={styles.routeItem}>
                <Text style={styles.routeName}>{route.name}</Text>
                <Text style={styles.routeTime}>Est. Time: {route.estimated_time_min} min</Text>
                {route.congestion_level && (
                  <Text style={[
                    styles.routeCongestion,
                    route.congestion_level === 'Low' ? styles.greenText :
                    route.congestion_level === 'Moderate' ? styles.yellowText :
                    styles.redText
                  ]}>
                    Congestion: {route.congestion_level}
                  </Text>
                )}
                {route.description && <Text style={styles.routeDescription}>{route.description}</Text>}
              </View>
            ))}
          </View>
        )}
        
        {/* Incident Alerts */}
        {prediction.incident_alerts && prediction.incident_alerts.length > 0 && (
          <View style={styles.detailSection}>
            <Text style={styles.detailTitle}>Incident Alerts</Text>
            
            {prediction.incident_alerts.map((incident, index) => (
              <View key={index} style={styles.incidentItem}>
                <Text style={styles.incidentType}>{incident.type}</Text>
                <Text style={styles.incidentMessage}>{incident.message}</Text>
                {incident.distance_from_start && (
                  <Text style={styles.incidentDistance}>
                    {incident.distance_from_start} km from start
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}
        
        {/* Weather Recommendations */}
        {prediction.weather_based_recommendations && prediction.weather_based_recommendations.length > 0 && (
          <View style={styles.detailSection}>
            <Text style={styles.detailTitle}>Weather Recommendations</Text>
            
            {prediction.weather_based_recommendations.map((recommendation, index) => (
              <Text key={index} style={styles.recommendationText}>• {recommendation}</Text>
            ))}
          </View>
        )}
        
        {/* General Travel Recommendation */}
        <View style={styles.detailSection}>
          <Text style={styles.detailTitle}>Travel Recommendation</Text>
          <Text style={[
            styles.recommendationValue,
            prediction.general_travel_recommendation === 'Ideal' ? styles.idealTravel : styles.notIdealTravel
          ]}>
            {prediction.general_travel_recommendation || "No recommendation available"}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.formContainer}>
        <Text style={styles.title}>Traffic Prediction</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Start Location</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter starting point"
            value={startLocation}
            onChangeText={setStartLocation}
          />
        </View>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Destination</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter destination"
            value={destination}
            onChangeText={setDestination}
          />
        </View>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Transport Mode</Text>
          <View style={styles.pickerContainer}>
            <TouchableOpacity 
              style={[styles.modeButton, transportMode === 'driving' && styles.modeButtonSelected]} 
              onPress={() => setTransportMode('driving')}
            >
              <Text style={[styles.modeButtonText, transportMode === 'driving' && styles.modeButtonTextSelected]}>
                Driving
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.modeButton, transportMode === 'transit' && styles.modeButtonSelected]} 
              onPress={() => setTransportMode('transit')}
            >
              <Text style={[styles.modeButtonText, transportMode === 'transit' && styles.modeButtonTextSelected]}>
                Public Transport
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Date & Time for Prediction</Text>
          <View style={styles.dateButton}>
            <Text style={styles.dateButtonText}>
              {formatDate(new Date())} (Current time)
            </Text>
          </View>
          <Text style={styles.dateHelpText}>
            Predictions are based on current conditions
          </Text>
        </View>
        
        <TouchableOpacity 
          style={[styles.submitButton, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          <Text style={styles.submitButtonText}>
            {loading ? 'Getting Prediction...' : 'Get Prediction'}
          </Text>
        </TouchableOpacity>
        
        {loading && <ActivityIndicator size="large" color="#3498db" style={styles.loader} />}
        
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </View>
      
      {prediction && (
        <>
          {/* Log what view we're showing for debugging */}
          {console.log("Showing prediction for user type:", user ? "registered" : "unregistered")}
          {user ? renderDetailedPrediction() : renderBasicPrediction()}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  formContainer: {
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 10,
    margin: 15,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 15,
  },
  label: {
    fontSize: 16,
    marginBottom: 5,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 12,
    fontSize: 16,
  },
  pickerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modeButton: {
    flex: 1,
    padding: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    marginHorizontal: 2,
    alignItems: 'center',
  },
  modeButtonSelected: {
    backgroundColor: '#3498db',
    borderColor: '#3498db',
  },
  modeButtonText: {
    color: '#333',
  },
  modeButtonTextSelected: {
    color: 'white',
    fontWeight: 'bold',
  },
  dateButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 12,
    backgroundColor: '#f5f5f5', // Light gray background to indicate non-interactive
  },
  dateButtonText: {
    fontSize: 16,
  },
  dateHelpText: {
    fontSize: 12,
    color: '#777',
    marginTop: 4,
    fontStyle: 'italic',
  },
  submitButton: {
    backgroundColor: '#3498db',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    backgroundColor: '#a0cff1',
  },
  submitButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  loader: {
    marginTop: 20,
  },
  errorContainer: {
    marginTop: 15,
    padding: 10,
    backgroundColor: '#ffebee',
    borderRadius: 5,
  },
  errorText: {
    color: '#d32f2f',
  },
  
  // Prediction Styling
  predictionContainer: {
    backgroundColor: 'white',
    borderRadius: 10,
    margin: 15,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  predictionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  predictionLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  predictionValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  registerButton: {
    backgroundColor: '#3498db',
    padding: 12,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 20,
  },
  registerButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  
  // Basic info card for registered users
  basicInfoCard: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 15,
    marginBottom: 20,
    flexDirection: 'column',
  },
  basicInfoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  basicInfoLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  basicInfoValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  
  // Detailed Prediction Styling
  detailSection: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  detailTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#2c3e50',
  },
  
  // Probability Items
  probabilityItem: {
    marginBottom: 8,
  },
  conditionLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  probabilityBar: {
    height: 15,
    backgroundColor: '#e0e0e0',
    borderRadius: 10,
    overflow: 'hidden',
  },
  probabilityFill: {
    height: '100%',
  },
  congested: {
    backgroundColor: '#e74c3c',
  },
  moderate: {
    backgroundColor: '#f39c12',
  },
  clear: {
    backgroundColor: '#2ecc71',
  },
  probabilityText: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: 2,
  },
  
  // Time Items
  timeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  timeLabel: {
    fontSize: 15,
  },
  timeValue: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  
  // Route Items
  routeItem: {
    marginBottom: 10,
    padding: 10,
    backgroundColor: 'white',
    borderRadius: 5,
    borderLeftWidth: 3,
    borderLeftColor: '#3498db',
  },
  routeName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  routeTime: {
    fontSize: 14,
    color: '#555',
    marginTop: 2,
  },
  routeCongestion: {
    fontSize: 14, 
    marginTop: 2,
  },
  routeDescription: {
    fontSize: 14,
    marginTop: 5,
    fontStyle: 'italic',
  },
  
  // Incident Items
  incidentItem: {
    marginBottom: 10,
    padding: 10,
    backgroundColor: 'white',
    borderRadius: 5,
    borderLeftWidth: 3,
    borderLeftColor: '#e74c3c',
  },
  incidentType: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#e74c3c',
  },
  incidentMessage: {
    fontSize: 14,
    marginTop: 2,
  },
  incidentDistance: {
    fontSize: 12,
    marginTop: 4,
    color: '#777',
    fontStyle: 'italic',
  },
  
  // Weather Recommendations
  recommendationText: {
    fontSize: 14,
    marginBottom: 5,
    lineHeight: 20,
  },
  
  // General Travel Recommendation
  recommendationValue: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    paddingVertical: 8,
    borderRadius: 5,
  },
  idealTravel: {
    color: '#2ecc71',
    backgroundColor: 'rgba(46, 204, 113, 0.1)',
  },
  notIdealTravel: {
    color: '#e74c3c',
    backgroundColor: 'rgba(231, 76, 60, 0.1)',
  },
  
  // Text colors
  redText: {
    color: '#e74c3c',
  },
  yellowText: {
    color: '#f39c12',
  },
  greenText: {
    color: '#2ecc71',
  },
  
  // No data text
  noDataText: {
    fontStyle: 'italic',
    color: '#999',
    textAlign: 'center',
    padding: 10
  }
});