import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Switch } from 'react-native';
import AuthService from './authService';
import { useRouter } from 'expo-router';
import { API_URL, fetchAPI } from './utils/apiConfig';

export default function TrafficPredictionScreen() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Form inputs
  const [startLocation, setStartLocation] = useState('');
  const [destination, setDestination] = useState('');
  const [transportMode, setTransportMode] = useState('driving');
  const [useCurrentTime, setUseCurrentTime] = useState(true);
  
  // User preferences
  const [avoidCongestion, setAvoidCongestion] = useState(false);
  const [preferFastest, setPreferFastest] = useState(true);
  
  // Prediction results
  const [prediction, setPrediction] = useState(null);

  // Fetch current user on component mount
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const currentUser = await AuthService.getCurrentUser();
        console.log("Current user:", currentUser);
        
        // Since all users are expected to be registered, we'll set the user state
        setUser(currentUser);
      } catch (err) {
        console.error("Error fetching user:", err);
        setUser(null);
      }
    };
    
    fetchUser();
  }, []);
  
  const formatLocationForGeocoding = (location) => {
    // Add "Singapore" to the location if it's not already there
    if (location && !location.toLowerCase().includes('singapore')) {
      // Check if it's likely a postal code (6 digits in Singapore)
      if (/^\d{6}$/.test(location)) {
        return `${location}, Singapore`;
      }
      // Otherwise, append Singapore to the location name
      return `${location}, Singapore`;
    }
    return location;
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
      // Format locations for better geocoding results
      const formattedStartLocation = formatLocationForGeocoding(startLocation);
      const formattedDestLocation = formatLocationForGeocoding(destination);
      
      // Prepare request payload
      const requestPayload = {
        start_location: formattedStartLocation,
        destination_location: formattedDestLocation,
        transport_mode: transportMode,
        departure_time: useCurrentTime ? null : new Date().toISOString(),
        preferences: {
          avoid_congestion: avoidCongestion,
          prefer_fastest: preferFastest,
          avoid_incidents: true
        }
      };
      
      console.log("Sending request payload:", requestPayload);
      
      // Make direct fetch instead of using fetchAPI helper to debug
      const response = await fetch(`${API_URL}/api/predict/prediction/route`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await AuthService.getToken()}`
        },
        body: JSON.stringify(requestPayload)
      });
      
      const data = await response.json();
      console.log("RAW prediction response:", JSON.stringify(data, null, 2));
      
      if (data.error) {
        // If there's an error field in the response
        throw new Error(data.error);
      }
      
      setPrediction(data);

    } catch (err) {
      console.error('Prediction Error:', err);
      
      if (err.message.includes('geocode')) {
        // Show more helpful error for geocoding problems
        setError('Could not find the location. Please try entering a more specific address or postal code in Singapore.');
      } else {
        setError(err.message || 'Unable to fetch prediction');
      }
    } finally {
      setLoading(false);
    }
  };
  
  // Render detailed prediction
  const renderPrediction = () => {
    if (!prediction) return null;
    
    const routes = prediction.routes || [];
    const mainRoute = routes.length > 0 ? routes[0] : null;
    const alternativeRoutes = routes.slice(1);
    
    return (
      <View style={styles.predictionContainer}>
        <Text style={styles.sectionTitle}>Traffic Prediction</Text>
        
        {/* Traffic Condition */}
        <View style={styles.detailSection}>
          <Text style={styles.detailTitle}>Traffic Condition</Text>
          
          {mainRoute ? (
            <View style={styles.trafficLevelContainer}>
              <Text style={[
                styles.trafficLevel,
                mainRoute.traffic_level === 'Heavy' || mainRoute.traffic_level === 'Severe' ? styles.congested :
                mainRoute.traffic_level === 'Moderate' ? styles.moderate : styles.clear
              ]}>
                {mainRoute.traffic_level || "Unknown"}
              </Text>
            </View>
          ) : (
            <Text style={styles.noDataText}>No traffic data available</Text>
          )}
        </View>
        
        {/* Estimated Travel Time */}
        <View style={styles.detailSection}>
          <Text style={styles.detailTitle}>Estimated Travel Time</Text>
          
          {mainRoute ? (
            <>
              <View style={styles.timeItem}>
                <Text style={styles.timeLabel}>Normal Travel Time:</Text>
                <Text style={styles.timeValue}>{mainRoute.normal_travel_time_minutes} min</Text>
              </View>
              
              <View style={styles.timeItem}>
                <Text style={styles.timeLabel}>Estimated Travel Time:</Text>
                <Text style={styles.timeValue}>{mainRoute.estimated_travel_time_minutes} min</Text>
              </View>
              
              {mainRoute.estimated_travel_time_minutes > mainRoute.normal_travel_time_minutes && (
                <View style={styles.timeItem}>
                  <Text style={styles.timeLabel}>Expected Delay:</Text>
                  <Text style={[styles.timeValue, styles.delayText]}>
                    +{mainRoute.estimated_travel_time_minutes - mainRoute.normal_travel_time_minutes} min
                  </Text>
                </View>
              )}
              
              <View style={styles.timeItem}>
                <Text style={styles.timeLabel}>Distance:</Text>
                <Text style={styles.timeValue}>{mainRoute.distance_km} km</Text>
              </View>
            </>
          ) : (
            <Text style={styles.noDataText}>No travel time data available</Text>
          )}
        </View>
        
        {/* Main Route Segments */}
        {mainRoute && mainRoute.segments && mainRoute.segments.length > 0 && (
          <View style={styles.detailSection}>
            <Text style={styles.detailTitle}>Main Route Segments</Text>
            
            {mainRoute.segments.map((segment, index) => (
              <View key={index} style={styles.segmentItem}>
                <Text style={styles.segmentName}>{segment.name}</Text>
                <View style={styles.segmentDetails}>
                  <Text style={styles.segmentDistance}>{segment.distance_km} km</Text>
                  <Text style={[
                    styles.segmentTraffic,
                    segment.traffic_level === 'Heavy' ? styles.congested :
                    segment.traffic_level === 'Moderate' ? styles.moderate : styles.clear
                  ]}>
                    {segment.traffic_level}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
        
        {/* Alternative Routes */}
        {alternativeRoutes.length > 0 && (
          <View style={styles.detailSection}>
            <Text style={styles.detailTitle}>Alternative Routes</Text>
            
            {alternativeRoutes.map((route, index) => (
              <View key={index} style={styles.routeItem}>
                <Text style={styles.routeName}>{route.name}</Text>
                <Text style={styles.routeTime}>Est. Time: {route.estimated_travel_time_minutes} min</Text>
                <Text style={styles.routeDistance}>Distance: {route.distance_km} km</Text>
                <Text style={[
                  styles.routeTraffic,
                  route.traffic_level === 'Heavy' || route.traffic_level === 'Severe' ? styles.heavyTraffic :
                  route.traffic_level === 'Moderate' ? styles.moderateTraffic : styles.lightTraffic
                ]}>
                  Traffic: {route.traffic_level}
                </Text>
                {route.description && <Text style={styles.routeDescription}>{route.description}</Text>}
              </View>
            ))}
          </View>
        )}
        
        {/* Incident Alerts */}
        {prediction.incident_summary && prediction.incident_summary.count > 0 && (
          <View style={styles.detailSection}>
            <Text style={styles.detailTitle}>Incident Alerts</Text>
            
            <Text style={styles.incidentSummary}>{prediction.incident_summary.summary}</Text>
            
            {prediction.incident_summary.incidents && prediction.incident_summary.incidents.map((incident, index) => (
              <View key={index} style={styles.incidentItem}>
                <Text style={styles.incidentType}>{incident.type || 'Incident'}</Text>
                <Text style={styles.incidentMessage}>{incident.message || incident.location?.road_name}</Text>
                <Text style={styles.incidentSeverity}>Severity: {incident.severity || 'Unknown'}</Text>
              </View>
            ))}
          </View>
        )}
        
        {/* Weather Impact */}
        {prediction.weather_summary && (
          <View style={styles.detailSection}>
            <Text style={styles.detailTitle}>Weather Impact</Text>
            
            <View style={styles.weatherItem}>
              <Text style={styles.weatherCondition}>{prediction.weather_summary.condition}</Text>
              {prediction.weather_summary.temperature && (
                <Text style={styles.weatherTemp}>{prediction.weather_summary.temperature}°C</Text>
              )}
              <Text style={styles.weatherImpact}>{prediction.weather_summary.impact}</Text>
            </View>
          </View>
        )}
        
        {/* Natural Language Recommendation */}
        <View style={styles.recommendationSection}>
          <Text style={styles.recommendationTitle}>Recommendation</Text>
          <Text style={styles.recommendationText}>
            {prediction.recommendation || 
             "Based on current conditions, follow the main route and allow extra time for potential delays."}
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
            placeholder="Enter starting point (e.g., Blk 162 Mei Ling Street Singapore 140162)"
            value={startLocation}
            onChangeText={setStartLocation}
          />
        </View>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Destination</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter destination (e.g., Orchard MRT Station Singapore)"
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
              style={[styles.modeButton, transportMode === 'public_transport' && styles.modeButtonSelected]} 
              onPress={() => setTransportMode('public_transport')}
            >
              <Text style={[styles.modeButtonText, transportMode === 'public_transport' && styles.modeButtonTextSelected]}>
                Public Transport
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={styles.inputGroup}>
          <View style={styles.timeSelectHeader}>
            <Text style={styles.label}>Departure Time</Text>
            <View style={styles.switchContainer}>
              <Text style={styles.switchLabel}>Use current time</Text>
              <Switch
                value={useCurrentTime}
                onValueChange={setUseCurrentTime}
                trackColor={{ false: "#767577", true: "#81b0ff" }}
                thumbColor={useCurrentTime ? "#3498db" : "#f4f3f4"}
              />
            </View>
          </View>
          
          <View style={styles.dateButton}>
            <Text style={[styles.dateButtonText, useCurrentTime && styles.disabledText]}>
              {useCurrentTime ? "Current Time" : "Future departure is not available yet"}
            </Text>
          </View>
        </View>
        
        {/* User Preferences Section */}
        <View style={styles.preferencesContainer}>
          <Text style={styles.preferencesTitle}>Route Preferences</Text>
          
          <View style={styles.preferenceItem}>
            <Text style={styles.preferenceLabel}>Avoid congested roads</Text>
            <Switch
              value={avoidCongestion}
              onValueChange={setAvoidCongestion}
              trackColor={{ false: "#767577", true: "#81b0ff" }}
              thumbColor={avoidCongestion ? "#3498db" : "#f4f3f4"}
            />
          </View>
          
          <View style={styles.preferenceItem}>
            <Text style={styles.preferenceLabel}>Prefer fastest routes</Text>
            <Switch
              value={preferFastest}
              onValueChange={setPreferFastest}
              trackColor={{ false: "#767577", true: "#81b0ff" }}
              thumbColor={preferFastest ? "#3498db" : "#f4f3f4"}
            />
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
      
      {prediction && renderPrediction()}
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
  timeSelectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  switchLabel: {
    marginRight: 10,
    fontSize: 14,
  },
  dateButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 12,
    backgroundColor: '#f5f5f5',
  },
  dateButtonText: {
    fontSize: 16,
  },
  disabledText: {
    color: '#888',
  },
  // Preferences styles
  preferencesContainer: {
    marginTop: 10,
    marginBottom: 15,
    padding: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  preferencesTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  preferenceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  preferenceLabel: {
    fontSize: 15,
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
  
  // Traffic Condition
  trafficLevelContainer: {
    alignItems: 'center',
    padding: 10,
  },
  trafficLevel: {
    fontSize: 24,
    fontWeight: 'bold',
    padding: 15,
    borderRadius: 10,
    overflow: 'hidden',
    textAlign: 'center',
    width: '80%',
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
  delayText: {
    color: '#e74c3c',
  },
  
  // Route Segments
  segmentItem: {
    marginBottom: 8,
    padding: 8,
    backgroundColor: 'white',
    borderRadius: 5,
  },
  segmentName: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  segmentDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  segmentDistance: {
    fontSize: 14,
  },
  segmentTraffic: {
    fontSize: 14,
    fontWeight: '500',
    paddingHorizontal: 8,
    borderRadius: 10,
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
    marginTop: 2,
  },
  routeDistance: {
    fontSize: 14,
    marginTop: 2,
    color: '#555',
  },
  routeTraffic: {
    fontSize: 14,
    marginTop: 2,
    fontWeight: '500',
  },
  heavyTraffic: {
    color: '#e74c3c',
  },
  moderateTraffic: {
    color: '#f39c12',
  },
  lightTraffic: {
    color: '#2ecc71',
  },
  routeDescription: {
    fontSize: 14,
    marginTop: 5,
    fontStyle: 'italic',
  },
  
  // Incident Items
  incidentSummary: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 10,
    padding: 8,
    backgroundColor: 'rgba(231, 76, 60, 0.1)',
    borderRadius: 5,
  },
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
  incidentSeverity: {
    fontSize: 13,
    marginTop: 4,
    fontStyle: 'italic',
  },
  
  // Weather Items
  weatherItem: {
    padding: 10,
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 5,
  },
  weatherCondition: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  weatherTemp: {
    fontSize: 15,
    marginBottom: 5,
  },
  weatherImpact: {
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  
  // Recommendation
  recommendationSection: {
    backgroundColor: '#e8f4fd',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  recommendationTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#2c3e50',
    textAlign: 'center',
  },
  recommendationText: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  
  // Common styles
  congested: {
    backgroundColor: 'rgba(231, 76, 60, 0.2)',
    color: '#e74c3c',
  },
  moderate: {
    backgroundColor: 'rgba(243, 156, 18, 0.2)',
    color: '#f39c12',
  },
  clear: {
    backgroundColor: 'rgba(46, 204, 113, 0.2)',
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