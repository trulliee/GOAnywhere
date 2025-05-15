import React, { useState, useEffect } from 'react';
import { 
  View, Text, Button, StyleSheet, ActivityIndicator, 
  ScrollView, TextInput, TouchableOpacity, 
  SafeAreaView, Alert, Platform, Switch
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { API_URL } from './utils/apiConfig';
import axios from 'axios';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { LineChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import P2PDriver from './P2PDriver';

const { width } = Dimensions.get('window');

export default function TrafficPrediction() {
  const [activeTab, setActiveTab] = useState('unified'); // unified, traffic, travel, route, feedback
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState(null);
  const [predictionResults, setPredictionResults] = useState({
    trafficCongestion: null,
    travelTime: null,
    route: null,
    feedback: null
  });
  
  // Traffic congestion prediction inputs
  const [trafficInputs, setTrafficInputs] = useState({
    RoadName: 'PIE',
    RoadCategory: 'Expressway',
    hour: new Date().getHours(),
    day_of_week: new Date().getDay(),
    month: new Date().getMonth() + 1,
    is_holiday: 0,
    event_count: 0,
    incident_count: 0,
    temperature: 27.0,
    humidity: 75.0,
    peak_hour_flag: new Date().getHours() >= 7 && new Date().getHours() <= 9 ? 1 : 
                   (new Date().getHours() >= 17 && new Date().getHours() <= 20 ? 1 : 0),
    day_type: new Date().getDay() >= 5 ? 'weekend' : 'weekday',
    road_type: 'expressway',
    recent_incident_flag: 0,
    speed_band_previous_hour: 2,
    rain_flag: 0,
    max_event_severity: 0,
    sum_event_severity: 0,
  });

  // Travel time prediction inputs
  const [travelTimeInputs, setTravelTimeInputs] = useState({
    Expressway: 'PIE',
    Direction: 'East',
    Startpoint: 'Jurong',
    Endpoint: 'Changi',
    hour: new Date().getHours(),
    day_of_week: new Date().getDay(),
    month: new Date().getMonth() + 1,
    is_holiday: 0,
    event_count: 0,
    incident_count: 0,
    temperature: 27.0,
    humidity: 75.0,
    peak_hour_flag: new Date().getHours() >= 7 && new Date().getHours() <= 9 ? 1 : 
                   (new Date().getHours() >= 17 && new Date().getHours() <= 20 ? 1 : 0),
    day_type: new Date().getDay() >= 5 ? 'weekend' : 'weekday',
    road_type: 'minor',
    recent_incident_flag: 0,
    speed_band_previous_hour: 2,
    rain_flag: 0,
    max_event_severity: 0,
    sum_event_severity: 0,
    mean_incident_severity: 0,
    max_incident_severity: 0,
    sum_incident_severity: 0,
    distance_km: 20.0
  });

  // Route recommendation inputs
  const [routeInputs, setRouteInputs] = useState({
    origin: {
      lat: 1.3521,
      lon: 103.8198
    },
    destination: {
      lat: 1.3644,
      lon: 103.9915
    },
    preferences: {
      avoid_toll: false,
      avoid_expressway: false,
      priority: 'fastest'
    }
  });

  // Feedback inputs
  const [feedbackInputs, setFeedbackInputs] = useState({
    prediction_type: 'travel_time',
    prediction_id: '',
    actual_value: 0,
    predicted_value: 0,
    user_id: 'user123',
    timestamp: new Date().toISOString()
  });

  // Get user's current location on component mount
  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission to access location was denied');
        return;
      }

      let currentLocation = await Location.getCurrentPositionAsync({});
      setLocation(currentLocation);
      
      // Update route origin with current location
      setRouteInputs(prev => ({
        ...prev,
        origin: {
          lat: currentLocation.coords.latitude,
          lon: currentLocation.coords.longitude
        }
      }));
    })();
  }, []);

  // Run all predictions together
  const handleUnifiedPrediction = async () => {
    setLoading(true);
    try {
      // Run all predictions in parallel
      const [trafficResponse, travelTimeResponse, routeResponse] = await Promise.all([
        axios.post(`${API_URL}/api/prediction/traffic`, trafficInputs),
        axios.post(`${API_URL}/api/prediction/travel_time`, travelTimeInputs),
        axios.post(`${API_URL}/api/prediction/route`, routeInputs)
      ]);

      // Update prediction results
      setPredictionResults({
        trafficCongestion: trafficResponse.data,
        travelTime: travelTimeResponse.data,
        route: routeResponse.data,
        feedback: null
      });

      // Automatically prepare feedback data from predictions
      if (travelTimeResponse.data?.predictions?.[0] !== undefined) {
        setFeedbackInputs(prev => ({
          ...prev,
          prediction_id: Date.now().toString(),
          predicted_value: travelTimeResponse.data.predictions[0],
          timestamp: new Date().toISOString()
        }));
      }

    } catch (error) {
      Alert.alert('Error', error.response?.data?.detail || 'Prediction failed');
    }
    setLoading(false);
  };

  // Individual prediction handlers
  const predictTrafficCongestion = async () => {
    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/api/prediction/traffic`, trafficInputs);
      setPredictionResults(prev => ({ ...prev, trafficCongestion: response.data }));
    } catch (error) {
      Alert.alert('Error', error.response?.data?.detail || 'Traffic prediction failed');
    }
    setLoading(false);
  };

  const predictTravelTime = async () => {
    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/api/prediction/travel_time`, travelTimeInputs);
      setPredictionResults(prev => ({ ...prev, travelTime: response.data }));
      
      // Prepare feedback with predicted value
      if (response.data?.predictions?.[0] !== undefined) {
        setFeedbackInputs(prev => ({
          ...prev,
          prediction_id: Date.now().toString(),
          predicted_value: response.data.predictions[0],
          timestamp: new Date().toISOString()
        }));
      }
    } catch (error) {
      Alert.alert('Error', error.response?.data?.detail || 'Travel time prediction failed');
    }
    setLoading(false);
  };

  const getRouteRecommendation = async () => {
    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/api/prediction/route`, routeInputs);
      setPredictionResults(prev => ({ ...prev, route: response.data }));
    } catch (error) {
      Alert.alert('Error', error.response?.data?.detail || 'Route recommendation failed');
    }
    setLoading(false);
  };

  const submitFeedback = async () => {
    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/api/prediction/feedback`, feedbackInputs);
      setPredictionResults(prev => ({ ...prev, feedback: response.data }));
      Alert.alert('Success', 'Feedback submitted successfully!');
    } catch (error) {
      Alert.alert('Error', error.response?.data?.detail || 'Feedback submission failed');
    }
    setLoading(false);
  };

  // Helper function to interpret traffic congestion prediction
  const interpretTrafficCongestion = (prediction) => {
    if (!prediction) return null;
    
    const congestionValue = prediction.predictions?.[0];
    const probabilities = prediction.probabilities?.[0];
    
    if (congestionValue === undefined) return null;
    
    return {
      isCongested: congestionValue === 1,
      confidence: probabilities ? Math.max(...probabilities) * 100 : null,
      status: congestionValue === 1 ? 'Congested' : 'Free Flow',
      color: congestionValue === 1 ? '#e74c3c' : '#2ecc71'
    };
  };

  // Helper function to format travel time prediction
  const formatTravelTime = (prediction) => {
    if (!prediction || prediction.predictions === undefined || prediction.predictions.length === 0) {
      return null;
    }
    
    const minutes = Math.round(prediction.predictions[0]);
    
    // Convert to hours and minutes format
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    return {
      minutes: minutes,
      formatted: hours > 0 
        ? `${hours} hour${hours !== 1 ? 's' : ''} ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}` 
        : `${minutes} minute${minutes !== 1 ? 's' : ''}`,
      color: minutes > 45 ? '#e74c3c' : minutes > 25 ? '#f39c12' : '#2ecc71'
    };
  };

  // Render traffic congestion prediction section
  const renderTrafficCongestionSection = () => {
    const trafficResult = interpretTrafficCongestion(predictionResults.trafficCongestion);
    
    return (
      <View style={styles.predictionCard}>
        <Text style={styles.cardTitle}>Traffic Congestion</Text>
        <View style={styles.row}>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Road</Text>
            <Picker
              selectedValue={trafficInputs.RoadName}
              onValueChange={(value) => setTrafficInputs({...trafficInputs, RoadName: value})}
              style={styles.picker}
            >
              <Picker.Item label="PIE" value="PIE" />
              <Picker.Item label="CTE" value="CTE" />
              <Picker.Item label="AYE" value="AYE" />
              <Picker.Item label="ECP" value="ECP" />
              <Picker.Item label="KPE" value="KPE" />
              <Picker.Item label="SLE" value="SLE" />
              <Picker.Item label="TPE" value="TPE" />
            </Picker>
          </View>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>Category</Text>
            <Picker
              selectedValue={trafficInputs.RoadCategory}
              onValueChange={(value) => setTrafficInputs({...trafficInputs, RoadCategory: value})}
              style={styles.picker}
            >
              <Picker.Item label="Expressway" value="Expressway" />
              <Picker.Item label="Major Road" value="Major Road" />
              <Picker.Item label="Minor Road" value="Minor Road" />
            </Picker>
          </View>
        </View>
        
        {activeTab === 'traffic' && (
          <View style={styles.row}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Hour of Day</Text>
              <TextInput
                style={styles.input}
                value={trafficInputs.hour.toString()}
                onChangeText={(value) => setTrafficInputs({...trafficInputs, hour: parseInt(value) || 0})}
                keyboardType="numeric"
              />
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.label}>Recent Incident?</Text>
              <Switch
                value={trafficInputs.recent_incident_flag === 1}
                onValueChange={(value) => setTrafficInputs({
                  ...trafficInputs, 
                  recent_incident_flag: value ? 1 : 0
                })}
              />
            </View>
          </View>
        )}
        
        {activeTab === 'traffic' && (
          <TouchableOpacity 
            style={styles.predictButton} 
            onPress={predictTrafficCongestion}
            disabled={loading}
          >
            <Text style={styles.buttonText}>Predict Traffic Congestion</Text>
          </TouchableOpacity>
        )}
        
        {trafficResult && (
          <View style={[styles.resultCard, { backgroundColor: trafficResult.color + '20' }]}>
            <View style={styles.resultHeader}>
              <Icon 
                name={trafficResult.isCongested ? 'traffic' : 'directions-car'} 
                size={24} 
                color={trafficResult.color} 
              />
              <Text style={[styles.resultTitle, { color: trafficResult.color }]}>
                {trafficResult.status}
              </Text>
            </View>
            
            {trafficResult.confidence !== null && (
              <Text style={styles.confidence}>
                Confidence: {trafficResult.confidence.toFixed(1)}%
              </Text>
            )}
          </View>
        )}
      </View>
    );
  };

  // Render travel time prediction section
  const renderTravelTimeSection = () => {
    const travelTimeResult = formatTravelTime(predictionResults.travelTime);
    
    return (
      <View style={styles.predictionCard}>
        <Text style={styles.cardTitle}>Travel Time</Text>
        <View style={styles.row}>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Expressway</Text>
            <Picker
              selectedValue={travelTimeInputs.Expressway}
              onValueChange={(value) => setTravelTimeInputs({...travelTimeInputs, Expressway: value})}
              style={styles.picker}
            >
              <Picker.Item label="PIE" value="PIE" />
              <Picker.Item label="CTE" value="CTE" />
              <Picker.Item label="AYE" value="AYE" />
              <Picker.Item label="ECP" value="ECP" />
              <Picker.Item label="KPE" value="KPE" />
              <Picker.Item label="SLE" value="SLE" />
              <Picker.Item label="TPE" value="TPE" />
            </Picker>
          </View>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>Direction</Text>
            <Picker
              selectedValue={travelTimeInputs.Direction}
              onValueChange={(value) => setTravelTimeInputs({...travelTimeInputs, Direction: value})}
              style={styles.picker}
            >
              <Picker.Item label="East" value="East" />
              <Picker.Item label="West" value="West" />
              <Picker.Item label="North" value="North" />
              <Picker.Item label="South" value="South" />
            </Picker>
          </View>
        </View>
        
        <View style={styles.row}>
          <View style={styles.formGroup}>
            <Text style={styles.label}>From</Text>
            <Picker
              selectedValue={travelTimeInputs.Startpoint}
              onValueChange={(value) => setTravelTimeInputs({...travelTimeInputs, Startpoint: value})}
              style={styles.picker}
            >
              <Picker.Item label="Jurong" value="Jurong" />
              <Picker.Item label="Woodlands" value="Woodlands" />
              <Picker.Item label="Changi" value="Changi" />
              <Picker.Item label="City" value="City" />
              <Picker.Item label="Tampines" value="Tampines" />
            </Picker>
          </View>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>To</Text>
            <Picker
              selectedValue={travelTimeInputs.Endpoint}
              onValueChange={(value) => setTravelTimeInputs({...travelTimeInputs, Endpoint: value})}
              style={styles.picker}
            >
              <Picker.Item label="Changi" value="Changi" />
              <Picker.Item label="Jurong" value="Jurong" />
              <Picker.Item label="Woodlands" value="Woodlands" />
              <Picker.Item label="City" value="City" />
              <Picker.Item label="Tampines" value="Tampines" />
            </Picker>
          </View>
        </View>
        
        {activeTab === 'travel' && (
          <View style={styles.row}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Distance (km)</Text>
              <TextInput
                style={styles.input}
                value={travelTimeInputs.distance_km.toString()}
                onChangeText={(value) => setTravelTimeInputs({
                  ...travelTimeInputs, 
                  distance_km: parseFloat(value) || 0
                })}
                keyboardType="numeric"
              />
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.label}>Recent Incident?</Text>
              <Switch
                value={travelTimeInputs.recent_incident_flag === 1}
                onValueChange={(value) => setTravelTimeInputs({
                  ...travelTimeInputs, 
                  recent_incident_flag: value ? 1 : 0
                })}
              />
            </View>
          </View>
        )}
        
        {activeTab === 'travel' && (
          <TouchableOpacity 
            style={styles.predictButton} 
            onPress={predictTravelTime}
            disabled={loading}
          >
            <Text style={styles.buttonText}>Predict Travel Time</Text>
          </TouchableOpacity>
        )}
        
        {travelTimeResult && (
          <View style={[styles.resultCard, { backgroundColor: travelTimeResult.color + '20' }]}>
            <View style={styles.resultHeader}>
              <Icon 
                name="access-time" 
                size={24} 
                color={travelTimeResult.color} 
              />
              <Text style={[styles.resultTitle, { color: travelTimeResult.color }]}>
                {travelTimeResult.formatted}
              </Text>
            </View>
            
            <View style={styles.feedback}>
              <Text style={styles.feedbackLabel}>Was this accurate?</Text>
              <TextInput
                style={styles.feedbackInput}
                placeholder="Enter actual travel time (mins)"
                keyboardType="numeric"
                value={feedbackInputs.actual_value.toString()}
                onChangeText={(value) => setFeedbackInputs({
                  ...feedbackInputs,
                  actual_value: parseInt(value) || 0
                })}
              />
              <TouchableOpacity 
                style={styles.feedbackButton}
                onPress={submitFeedback}
                disabled={loading}
              >
                <Text style={styles.feedbackButtonText}>Submit Feedback</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  };

  // Render route recommendation section
  const   renderRouteSection = () => {
    const routeResult = predictionResults.route;
    
    return (
      <View style={styles.predictionCard}>
        <Text style={styles.cardTitle}>Route Recommendation</Text>
        
        {location && (
          <MapView
            style={styles.map}
            initialRegion={{
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              latitudeDelta: 0.1,
              longitudeDelta: 0.1,
            }}
          >
            {/* Origin marker */}
            <Marker
              coordinate={{
                latitude: routeInputs.origin.lat,
                longitude: routeInputs.origin.lon
              }}
              pinColor="green"
              title="Start"
            />
            
            {/* Destination marker */}
            <Marker
              coordinate={{
                latitude: routeInputs.destination.lat,
                longitude: routeInputs.destination.lon
              }}
              pinColor="red"
              title="Destination"
            />
            
            {/* Show either API route coordinates or P2PDriver polyline */}
            {routeResult?.route_coordinates ? (
              <Polyline
                coordinates={routeResult.route_coordinates.map(coord => ({
                  latitude: coord.lat,
                  longitude: coord.lon
                }))}
                strokeWidth={4}
                strokeColor="#3498db"
              />
            ) : routes.length > 0 && (
              <Polyline
                coordinates={routes[selectedRoute].polyline}
                strokeWidth={4}
                strokeColor="#3498db"
              />
            )}
          </MapView>
        )}
        
        <View style={styles.row}>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Avoid Tolls</Text>
            <Switch
              value={routeInputs.preferences.avoid_toll}
              onValueChange={(value) => setRouteInputs({
                ...routeInputs, 
                preferences: {
                  ...routeInputs.preferences,
                  avoid_toll: value
                }
              })}
            />
          </View>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>Avoid Expressways</Text>
            <Switch
              value={routeInputs.preferences.avoid_expressway}
              onValueChange={(value) => setRouteInputs({
                ...routeInputs, 
                preferences: {
                  ...routeInputs.preferences,
                  avoid_expressway: value
                }
              })}
            />
          </View>
        </View>
        
        <View style={styles.row}>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Route Priority</Text>
            <Picker
              selectedValue={routeInputs.preferences.priority}
              onValueChange={(value) => setRouteInputs({
                ...routeInputs, 
                preferences: {
                  ...routeInputs.preferences,
                  priority: value
                }
              })}
              style={styles.picker}
            >
              <Picker.Item label="Fastest" value="fastest" />
              <Picker.Item label="Shortest" value="shortest" />
            </Picker>
          </View>
        </View>
        
        {activeTab === 'route' && (
          <TouchableOpacity 
            style={styles.predictButton} 
            onPress={getRouteRecommendation}
            disabled={loading}
          >
            <Text style={styles.buttonText}>Get Route</Text>
          </TouchableOpacity>
        )}
        
        {routeResult && (
          <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <Icon name="directions" size={24} color="#3498db" />
              <Text style={[styles.resultTitle, { color: '#3498db' }]}>
                {routeResult.total_time ? `${Math.round(routeResult.total_time)} mins` : 'Route Found'}
              </Text>
            </View>
            
            <Text style={styles.routeInfo}>
              Distance: {routeResult.total_distance ? `${routeResult.total_distance.toFixed(1)} km` : 'N/A'}
            </Text>
            
            {routeResult.incidents && routeResult.incidents.length > 0 && (
              <View style={styles.incidentsContainer}>
                <Text style={styles.incidentsTitle}>
                  {routeResult.incidents.length} incident(s) on route
                </Text>
                {routeResult.incidents.map((incident, index) => (
                  <Text key={index} style={styles.incidentItem}>
                    {incident.type}: {incident.message}
                  </Text>
                ))}
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  // Render feedback section
  const renderFeedbackSection = () => {
    return (
      <View style={styles.predictionCard}>
        <Text style={styles.cardTitle}>Submit Feedback</Text>
        
        <View style={styles.row}>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Prediction Type</Text>
            <Picker
              selectedValue={feedbackInputs.prediction_type}
              onValueChange={(value) => setFeedbackInputs({...feedbackInputs, prediction_type: value})}
              style={styles.picker}
            >
              <Picker.Item label="Travel Time" value="travel_time" />
              <Picker.Item label="Traffic Condition" value="traffic_condition" />
            </Picker>
          </View>
        </View>
        
        <View style={styles.row}>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Predicted Value</Text>
            <TextInput
              style={styles.input}
              value={feedbackInputs.predicted_value.toString()}
              onChangeText={(value) => setFeedbackInputs({
                ...feedbackInputs, 
                predicted_value: parseFloat(value) || 0
              })}
              keyboardType="numeric"
            />
          </View>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>Actual Value</Text>
            <TextInput
              style={styles.input}
              value={feedbackInputs.actual_value.toString()}
              onChangeText={(value) => setFeedbackInputs({
                ...feedbackInputs, 
                actual_value: parseFloat(value) || 0
              })}
              keyboardType="numeric"
            />
          </View>
        </View>
        
        <TouchableOpacity 
          style={styles.predictButton} 
          onPress={submitFeedback}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Submit Feedback</Text>
        </TouchableOpacity>
        
        {predictionResults.feedback && (
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Feedback submitted successfully!</Text>
            <Text>Feedback ID: {predictionResults.feedback.feedback_id}</Text>
          </View>
        )}
      </View>
    );
  };

  // Add state for location inputs
  const [locationInputs, setLocationInputs] = useState({
    startLocation: '',
    endLocation: ''
  });
  
  // Add state for routes from P2PDriver
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(0);
  
  // Function to handle P2PDriver integration
  const handleRouteSearch = async () => {
    setLoading(true);
    try {
      // Get routes using P2PDriver
      const routeResults = await P2PDriver(locationInputs.startLocation, locationInputs.endLocation);
      setRoutes(routeResults);
      
      if (routeResults.length > 0) {
        // Select the first route by default
        setSelectedRoute(0);
        const selectedRouteData = routeResults[0];
        
        // Extract road names from the route steps
        const roadNames = selectedRouteData.steps
          .map(step => step.road)
          .filter(road => road !== 'Follow road');
        
        // Get the main expressway if mentioned in summary or steps
        const expressways = ['PIE', 'CTE', 'AYE', 'ECP', 'KPE', 'SLE', 'TPE', 'BKE'];
        let mainExpressway = 'PIE'; // Default
        
        // Try to find expressway in the route summary
        for (const exp of expressways) {
          if (selectedRouteData.summary.includes(exp)) {
            mainExpressway = exp;
            break;
          }
        }
        
        // If no expressway in summary, check steps
        if (mainExpressway === 'PIE') {
          for (const step of selectedRouteData.steps) {
            for (const exp of expressways) {
              if (step.instruction.includes(exp)) {
                mainExpressway = exp;
                break;
              }
            }
            if (mainExpressway !== 'PIE') break;
          }
        }
        
        // Extract distance in km from the text (e.g., "5.2 km" → 5.2)
        const distanceText = selectedRouteData.distance;
        const distanceKm = parseFloat(distanceText.replace(/[^0-9.]/g, ''));
        
        // Determine direction (very simplified approach)
        const startMarker = selectedRouteData.markers[0];
        const endMarker = selectedRouteData.markers[1];
        let direction = 'East';
        
        if (endMarker.longitude < startMarker.longitude) {
          direction = 'West';
        } else if (endMarker.latitude > startMarker.latitude) {
          direction = 'North';
        } else if (endMarker.latitude < startMarker.latitude) {
          direction = 'South';
        }
        
        // Update traffic congestion inputs
        setTrafficInputs(prev => ({
          ...prev,
          RoadName: mainExpressway,
          RoadCategory: 'Expressway',
        }));
        
        // Update travel time inputs
        setTravelTimeInputs(prev => ({
          ...prev,
          Expressway: mainExpressway,
          Direction: direction,
          Startpoint: locationInputs.startLocation.split(',')[0],
          Endpoint: locationInputs.endLocation.split(',')[0],
          distance_km: distanceKm || 5.0
        }));
        
        // Update route inputs with the exact coordinates
        setRouteInputs(prev => ({
          ...prev,
          origin: {
            lat: selectedRouteData.markers[0].latitude,
            lon: selectedRouteData.markers[0].longitude
          },
          destination: {
            lat: selectedRouteData.markers[1].latitude,
            lon: selectedRouteData.markers[1].longitude
          }
        }));
      }
    } catch (error) {
      console.error('Error in route search:', error);
      Alert.alert('Error', 'Failed to get route information');
    }
    setLoading(false);
  };
  
  // Main render
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.tabBar}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'unified' && styles.activeTab]} 
          onPress={() => setActiveTab('unified')}
        >
          <Text style={[styles.tabText, activeTab === 'unified' && styles.activeTabText]}>All</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'traffic' && styles.activeTab]} 
          onPress={() => setActiveTab('traffic')}
        >
          <Text style={[styles.tabText, activeTab === 'traffic' && styles.activeTabText]}>Traffic</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'travel' && styles.activeTab]} 
          onPress={() => setActiveTab('travel')}
        >
          <Text style={[styles.tabText, activeTab === 'travel' && styles.activeTabText]}>Travel Time</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'route' && styles.activeTab]} 
          onPress={() => setActiveTab('route')}
        >
          <Text style={[styles.tabText, activeTab === 'route' && styles.activeTabText]}>Route</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'feedback' && styles.activeTab]} 
          onPress={() => setActiveTab('feedback')}
        >
          <Text style={[styles.tabText, activeTab === 'feedback' && styles.activeTabText]}>Feedback</Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView>
        <View style={styles.headerContainer}>
          <Text style={styles.header}>Traffic Prediction</Text>
          <Text style={styles.subheader}>
            {new Date().toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </Text>
        </View>
        
        {/* Add location search section at the top */}
        <View style={styles.locationSearchCard}>
          <Text style={styles.cardTitle}>Enter Your Route</Text>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Start Location</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Jurong East, Singapore"
              value={locationInputs.startLocation}
              onChangeText={(text) => setLocationInputs({...locationInputs, startLocation: text})}
            />
          </View>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>Destination</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Changi Airport, Singapore"
              value={locationInputs.endLocation}
              onChangeText={(text) => setLocationInputs({...locationInputs, endLocation: text})}
            />
          </View>
          
          <TouchableOpacity 
            style={styles.searchButton} 
            onPress={handleRouteSearch}
            disabled={loading}
          >
            <Text style={styles.buttonText}>Find Route & Prefill Inputs</Text>
          </TouchableOpacity>
          
          {routes.length > 0 && (
            <View style={styles.routeSelectionContainer}>
              <Text style={styles.routeSelectionTitle}>
                {routes.length} route{routes.length !== 1 ? 's' : ''} found ({routes[selectedRoute].distance}, {routes[selectedRoute].duration})
              </Text>
              
              {routes.length > 1 && (
                <View style={styles.routeButtonsContainer}>
                  {routes.map((route, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.routeButton,
                        selectedRoute === index && styles.selectedRouteButton
                      ]}
                      onPress={() => setSelectedRoute(index)}
                    >
                      <Text style={[
                        styles.routeButtonText,
                        selectedRoute === index && styles.selectedRouteButtonText
                      ]}>
                        Route {index + 1}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>
        
        {/* Show loading indicator during API calls */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0000ff" />
            <Text style={styles.loadingText}>Processing prediction...</Text>
          </View>
        )}
        
        {/* Unified View (All Models) */}
        {activeTab === 'unified' && (
          <>
            {renderTrafficCongestionSection()}
            {renderTravelTimeSection()}
            {renderRouteSection()}
            
            <TouchableOpacity 
              style={styles.unifiedPredictButton} 
              onPress={handleUnifiedPrediction}
              disabled={loading}
            >
              <Text style={styles.buttonText}>Run All Predictions</Text>
            </TouchableOpacity>
          </>
        )}
        
        {/* Traffic Model View */}
        {activeTab === 'traffic' && renderTrafficCongestionSection()}
        
        {/* Travel Time Model View */}
        {activeTab === 'travel' && renderTravelTimeSection()}
        
        {/* Route Model View */}
        {activeTab === 'route' && renderRouteSection()}
        
        {/* Feedback Model View */}
        {activeTab === 'feedback' && renderFeedbackSection()}
      </ScrollView>
      
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          GOAnywhere • Powered by ML Models on Vertex AI
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  headerContainer: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eaeaea',
  },
  header: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  subheader: {
    fontSize: 16,
    color: '#666',
    marginTop: 5,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eaeaea',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 3,
    borderBottomColor: '#3498db',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
  },
  activeTabText: {
    color: '#3498db',
    fontWeight: 'bold',
  },
  predictionCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  formGroup: {
    flex: 1,
    marginRight: 8,
  },
  label: {
    fontSize: 14,
    marginBottom: 4,
    color: '#666',
  },
  picker: {
    height: 40,
    backgroundColor: '#f5f5f5',
    borderRadius: 5,
  },
  input: {
    height: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    paddingHorizontal: 10,
    backgroundColor: '#f5f5f5',
  },
  predictButton: {
    backgroundColor: '#3498db',
    padding: 12,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 8,
  },
  unifiedPredictButton: {
    backgroundColor: '#2c3e50',
    padding: 16,
    borderRadius: 5,
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 20,
  },
  searchButton: {
    backgroundColor: '#16a085',
    padding: 12,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 8,
  },
  locationSearchCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  routeSelectionContainer: {
    marginTop: 12,
    padding: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  routeSelectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  routeButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  routeButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#e0e0e0',
  },
  selectedRouteButton: {
    backgroundColor: '#3498db',
  },
  routeButtonText: {
    fontSize: 12,
    color: '#333',
  },
  selectedRouteButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  resultCard: {
    marginTop: 16,
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    borderLeftWidth: 4,
    borderLeftColor: '#3498db',
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  confidence: {
    fontSize: 14,
    color: '#666',
  },
  map: {
    height: 200,
    marginBottom: 16,
    borderRadius: 8,
  },
  routeInfo: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  incidentsContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eaeaea',
  },
  incidentsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#e74c3c',
    marginBottom: 8,
  },
  incidentItem: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  feedback: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#eaeaea',
  },
  feedbackLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  feedbackInput: {
    height: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  feedbackButton: {
    backgroundColor: '#27ae60',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
  },
  feedbackButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  footer: {
    padding: 16,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#eaeaea',
  },
  footerText: {
    fontSize: 12,
    color: '#999',
  },
});