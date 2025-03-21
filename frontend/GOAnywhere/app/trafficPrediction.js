import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import AuthService from './authService';
import { useRouter } from 'expo-router';
import { getApiUrl } from './utils/apiConfig';
const API_URL = getApiUrl('');

export default function TrafficPredictionScreen() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Form inputs
  const [startLocation, setStartLocation] = useState('');
  const [destination, setDestination] = useState('');
  const [transportMode, setTransportMode] = useState('driving');
  const [predictionDate, setPredictionDate] = useState(new Date());
  
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
      // Prepare request payload
      const requestPayload = {
        start_location: startLocation,
        destination_location: destination,
        transport_mode: transportMode,
        prediction_datetime: predictionDate.toISOString()
      };
      
      console.log("Sending request payload:", requestPayload);
      
      // Get authentication token if user is logged in
      const token = await AuthService.getToken();
      console.log("User token:", token ? "Present" : "None");
      
      // Prepare headers with proper auth format
      const headers = {
        'Content-Type': 'application/json'
      };
      
      // Only add Authorization header if token exists
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      // Make API request with properly formatted headers
      const response = await fetch(getApiUrl('traffic-forecast'), {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(requestPayload)
      });
      
      // Handle response
      if (!response.ok) {
        const errorText = await response.text();
        let errorDetail;
        try {
          const errorData = JSON.parse(errorText);
          errorDetail = errorData.detail || 'Failed to fetch prediction';
        } catch {
          errorDetail = errorText || 'Failed to fetch prediction';
        }
        throw new Error(errorDetail);
      }
      
      // Get the response data
      const data = await response.json();
      console.log("RAW prediction response:", JSON.stringify(data, null, 2));

      // Ensure data consistency - check if data has all required fields for registered users
      if (user) {
        // These are fallbacks that should ideally not be needed anymore with the updated backend
        if (!data.estimated_travel_time || !data.estimated_travel_time.driving) {
          console.log("Adding fallback travel times");
          const baseTime = 15 + (startLocation.length + destination.length) / 4;
          data.estimated_travel_time = {
            driving: Math.round(baseTime),
            public_transport: Math.round(baseTime * 1.4 + 10)
          };
        }

        if (!data.alternative_routes || data.alternative_routes.length === 0) {
          console.log("Adding fallback alternative routes");
          data.alternative_routes = [
            {
              name: "Alternative Route via CTE",
              estimated_time: Math.round(data.estimated_travel_time.driving * 0.9),
              description: "Via less congested roads"
            },
            {
              name: "Scenic Route via PIE",
              estimated_time: Math.round(data.estimated_travel_time.driving * 1.1),
              description: "Slightly longer but steadier traffic flow"
            }
          ];
        }

        if (!data.weather_recommendations || data.weather_recommendations.length === 0) {
          console.log("Adding fallback weather recommendations");
          data.weather_recommendations = [
            "Weather is typical for the season. No special precautions needed.",
            data.road_condition === "Congested" ? 
              "Allow extra time due to road congestion." : 
              "Regular driving conditions apply."
          ];
        }
      }

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
          <Text style={styles.predictionValue}>{prediction.road_condition || "Clear"}</Text>
        </View>
        
        <View style={styles.predictionItem}>
          <Text style={styles.predictionLabel}>Possible Delays:</Text>
          <Text style={styles.predictionValue}>{prediction.possible_delay || "No"}</Text>
        </View>
        
        <View style={styles.predictionItem}>
          <Text style={styles.predictionLabel}>Weather Conditions:</Text>
          <Text style={styles.predictionValue}>{prediction.weather_condition || "Clear"}</Text>
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
        
        {/* Road Conditions Probability */}
        <View style={styles.detailSection}>
          <Text style={styles.detailTitle}>Road Conditions Probability</Text>
          
          {prediction.road_conditions_probability && Object.entries(prediction.road_conditions_probability).length > 0 ? (
            Object.entries(prediction.road_conditions_probability).map(([condition, probability]) => (
              <View key={condition} style={styles.probabilityItem}>
                <Text style={styles.conditionLabel}>{condition}:</Text>
                <View style={styles.probabilityBar}>
                  <View 
                    style={[
                      styles.probabilityFill, 
                      { width: `${probability}%` },
                      condition === 'Congested' ? styles.congested : (condition === 'Moderate' ? styles.moderate : styles.clear)
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
          
          {prediction.estimated_travel_time && 
           (prediction.estimated_travel_time.driving != null || prediction.estimated_travel_time.public_transport != null) ? (
            <>
              {prediction.estimated_travel_time.driving ? (
                <View style={styles.timeItem}>
                  <Text style={styles.timeLabel}>Driving:</Text>
                  <Text style={styles.timeValue}>{prediction.estimated_travel_time.driving} min</Text>
                </View>
              ) : null}
              
              {prediction.estimated_travel_time.public_transport ? (
                <View style={styles.timeItem}>
                  <Text style={styles.timeLabel}>Public Transport:</Text>
                  <Text style={styles.timeValue}>{prediction.estimated_travel_time.public_transport} min</Text>
                </View>
              ) : null}
            </>
          ) : (
            <Text style={styles.noDataText}>No travel time data available</Text>
          )}
        </View>
        
        {/* Alternative Routes */}
        {prediction.alternative_routes && prediction.alternative_routes.length > 0 && (
          <View style={styles.detailSection}>
            <Text style={styles.detailTitle}>Alternative Routes</Text>
            
            {prediction.alternative_routes.map((route, index) => (
              <View key={index} style={styles.routeItem}>
                <Text style={styles.routeName}>{route.name}</Text>
                <Text style={styles.routeTime}>Est. Time: {route.estimated_time} min</Text>
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
              </View>
            ))}
          </View>
        )}
        
        {/* Weather Recommendations */}
        {prediction.weather_recommendations && prediction.weather_recommendations.length > 0 && (
          <View style={styles.detailSection}>
            <Text style={styles.detailTitle}>Weather Recommendations</Text>
            
            {prediction.weather_recommendations.map((recommendation, index) => (
              <Text key={index} style={styles.recommendationText}>• {recommendation}</Text>
            ))}
          </View>
        )}
        
        {/* General Travel Recommendation */}
        <View style={styles.detailSection}>
          <Text style={styles.detailTitle}>Travel Recommendation</Text>
          {prediction.general_travel_recommendation ? (
            <Text style={[
              styles.recommendationValue,
              prediction.general_travel_recommendation === 'Ideal' ? styles.idealTravel : styles.notIdealTravel
            ]}>
              {prediction.general_travel_recommendation}
            </Text>
          ) : (
            <Text style={styles.noDataText}>No recommendation available</Text>
          )}
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
          <Text style={styles.label}>Current Date & Time (Using System Time)</Text>
          <View style={styles.dateButton}>
            <Text style={styles.dateButtonText}>
              {predictionDate.toLocaleString()}
            </Text>
          </View>
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
  },
  dateButtonText: {
    fontSize: 16,
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
  
  // No data text
  noDataText: {
    fontStyle: 'italic',
    color: '#999',
    textAlign: 'center',
    padding: 10
  }
})