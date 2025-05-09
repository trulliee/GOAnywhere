import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ActivityIndicator, 
  ScrollView, TextInput, TouchableOpacity, 
  SafeAreaView, Alert, Platform
} from 'react-native';
import axios from 'axios';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import Icon from 'react-native-vector-icons/MaterialIcons';
import P2PDriver from './P2PDriver';

// Backend API URL
const API_URL = 'https://goanywhere-backend-541900038032.asia-southeast1.run.app';

export default function TrafficPrediction() {
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState(null);
  
  // State for location inputs
  const [locationInputs, setLocationInputs] = useState({
    startLocation: '',
    endLocation: ''
  });
  
  // State for routes from P2PDriver
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(0);
  
  // State for prediction results
  const [predictions, setPredictions] = useState({
    trafficCongestion: null,
    travelTime: null
  });
  
  // State to track if prediction has been made
  const [predictionsMade, setPredictionsMade] = useState({
    trafficCongestion: false,
    travelTime: false
  });
  
  // State for model input data
  const [modelInputs, setModelInputs] = useState({
    traffic: {
      RoadName: "PIE",
      RoadCategory: "Expressway",
      hour: new Date().getHours(),
      day_of_week: new Date().getDay(),
      month: new Date().getMonth() + 1,
      is_holiday: 0,
      event_count: 0,
      incident_count: 0,
      temperature: 27.0,
      humidity: 75.0,
      peak_hour_flag: isPeakHour(),
      day_type: isWeekday() ? 'weekday' : 'weekend',
      road_type: "expressway",
      recent_incident_flag: 0,
      speed_band_previous_hour: 2,
      rain_flag: 0,
      max_event_severity: 0,
      sum_event_severity: 0
    },
    travelTime: {
      Expressway: "PIE",
      Direction: "East",
      Startpoint: "",
      Endpoint: "",
      hour: new Date().getHours(),
      day_of_week: new Date().getDay(),
      month: new Date().getMonth() + 1,
      is_holiday: 0,
      event_count: 0,
      incident_count: 0,
      temperature: 27.0,
      humidity: 75.0,
      peak_hour_flag: isPeakHour(),
      day_type: isWeekday() ? 'weekday' : 'weekend',
      road_type: "major",
      recent_incident_flag: 0,
      speed_band_previous_hour: 2,
      rain_flag: 0,
      max_event_severity: 0,
      sum_event_severity: 0,
      mean_incident_severity: 0,
      max_incident_severity: 0,
      sum_incident_severity: 0,
      distance_km: 5.0
    }
  });

  // Helper functions to determine peak hours and weekday status
  function isPeakHour() {
    const hour = new Date().getHours();
    return (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 20) ? 1 : 0;
  }

  function isWeekday() {
    const day = new Date().getDay();
    return day >= 1 && day <= 5; // Monday to Friday
  }

  // Get user's current location on component mount
  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission to access location was denied');
        return;
      }

      try {
        let currentLocation = await Location.getCurrentPositionAsync({});
        setLocation(currentLocation);
        
        // Update model inputs with current time values
        updateModelInputsWithCurrentTime();
      } catch (error) {
        console.error("Error getting location:", error);
        Alert.alert("Could not get current location. Please enter locations manually.");
      }
    })();
  }, []);

  // Function to update model inputs with current time
  const updateModelInputsWithCurrentTime = () => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentDayOfWeek = now.getDay();
    const currentMonth = now.getMonth() + 1;
    const currentPeakHourFlag = isPeakHour();
    const currentDayType = isWeekday() ? 'weekday' : 'weekend';
    
    setModelInputs(prev => ({
      ...prev,
      traffic: {
        ...prev.traffic,
        hour: currentHour,
        day_of_week: currentDayOfWeek,
        month: currentMonth,
        peak_hour_flag: currentPeakHourFlag,
        day_type: currentDayType
      },
      travelTime: {
        ...prev.travelTime,
        hour: currentHour,
        day_of_week: currentDayOfWeek,
        month: currentMonth,
        peak_hour_flag: currentPeakHourFlag,
        day_type: currentDayType
      }
    }));
  };

  // Function to handle route search using P2PDriver
  const handleRouteSearch = async () => {
    if (!locationInputs.startLocation || !locationInputs.endLocation) {
      Alert.alert("Missing locations", "Please enter both start and destination locations");
      return;
    }

    setLoading(true);
    try {
      // Get routes using P2PDriver
      const routeResults = await P2PDriver(locationInputs.startLocation, locationInputs.endLocation);
      
      if (routeResults.length > 0) {
        setRoutes(routeResults);
        // Select the first route by default
        setSelectedRoute(0);
        
        // Extract route details for predictions
        extractRouteDetailsForPrediction(routeResults[0]);

        Alert.alert(
          "Route Found", 
          `Route from ${locationInputs.startLocation} to ${locationInputs.endLocation} found.\n\nDistance: ${routeResults[0].distance}\nEstimated Time of Travel: ${routeResults[0].duration}`
        );
      } else {
        Alert.alert("No routes found", "Could not find any routes between the specified locations.");
      }
    } catch (error) {
      console.error('Error in route search:', error);
      Alert.alert('Error', 'Failed to get route information');
    } finally {
      setLoading(false);
    }
  };

  // Function to extract road details from route for prediction
  const extractRouteDetailsForPrediction = (route) => {
    // Extract road names from the route steps
    const roadNames = route.steps
      .map(step => step.instruction)
      .join(' ');
    
    // Get the main expressway if mentioned in summary or steps
    const expressways = ['PIE', 'CTE', 'AYE', 'ECP', 'KPE', 'SLE', 'TPE', 'BKE'];
    let mainExpressway = 'PIE'; // Default
    
    // Try to find expressway in the route summary
    for (const exp of expressways) {
      if (route.summary && route.summary.includes(exp)) {
        mainExpressway = exp;
        break;
      }
    }
    
    // If no expressway in summary, check steps
    if (mainExpressway === 'PIE') {
      for (const step of route.steps) {
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
    const distanceText = route.distance;
    const distanceKm = parseFloat(distanceText.replace(/[^0-9.]/g, ''));
    
    // Determine direction based on coordinates
    const startMarker = route.markers[0];
    const endMarker = route.markers[1];
    let direction = 'East';
    
    if (endMarker.longitude < startMarker.longitude) {
      direction = 'West';
    } else if (endMarker.latitude > startMarker.latitude) {
      direction = 'North';
    } else if (endMarker.latitude < startMarker.latitude) {
      direction = 'South';
    }
    
    // Update model inputs with route data
    setModelInputs(prev => ({
      ...prev,
      traffic: {
        ...prev.traffic,
        RoadName: mainExpressway,
        RoadCategory: 'Expressway'
      },
      travelTime: {
        ...prev.travelTime,
        Expressway: mainExpressway,
        Direction: direction,
        Startpoint: locationInputs.startLocation,
        Endpoint: locationInputs.endLocation,
        distance_km: distanceKm || 5.0
      }
    }));
  };
  
  // Function to predict traffic congestion
  const predictTrafficCongestion = async () => {
    if (routes.length === 0) {
      Alert.alert("No route selected", "Please find a route first");
      return;
    }

    setLoading(true);
    try {
      // Make sure model inputs have latest time data
      updateModelInputsWithCurrentTime();
      
      // Log the request data for debugging
      console.log('Making traffic congestion prediction request with:', modelInputs.traffic);
      
      // Send the prediction request to the backend API
      const response = await axios.post(`${API_URL}/prediction/traffic`, modelInputs.traffic);
      
      // Log the response for debugging
      console.log('Traffic congestion prediction response:', response.data);
      
      // Store the prediction result
      setPredictions(prev => ({ 
        ...prev, 
        trafficCongestion: response.data 
      }));
      
      // Set flag to indicate prediction has been made
      setPredictionsMade(prev => ({
        ...prev,
        trafficCongestion: true
      }));
      
    } catch (error) {
      console.error('Traffic congestion prediction error:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Traffic congestion prediction failed');
    } finally {
      setLoading(false);
    }
  };

  // Function to predict travel time
  const predictTravelTime = async () => {
    if (routes.length === 0) {
      Alert.alert("No route selected", "Please find a route first");
      return;
    }

    setLoading(true);
    try {
      // Make sure model inputs have latest time data
      updateModelInputsWithCurrentTime();
      
      // Log the request data for debugging
      console.log('Making travel time prediction request with:', modelInputs.travelTime);
      
      // Send the prediction request to the backend API
      const response = await axios.post(`${API_URL}/prediction/travel_time`, modelInputs.travelTime);
      
      // Log the response for debugging
      console.log('Travel time prediction response:', response.data);
      
      // Store the prediction result
      setPredictions(prev => ({ 
        ...prev, 
        travelTime: response.data 
      }));
      
      // Set flag to indicate prediction has been made
      setPredictionsMade(prev => ({
        ...prev,
        travelTime: true
      }));
      
    } catch (error) {
      console.error('Travel time prediction error:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Travel time prediction failed');
    } finally {
      setLoading(false);
    }
  };

  // Function to reset prediction and unlock route selection
  const resetPredictions = () => {
    setPredictions({ 
      trafficCongestion: null,
      travelTime: null
    });
    setPredictionsMade({
      trafficCongestion: false,
      travelTime: false
    });
  };

  // Helper function to interpret traffic congestion prediction
  const interpretTrafficCongestion = (prediction) => {
    if (!prediction) return null;
    
    console.log("Traffic prediction response:", prediction);
    
    const predictions = prediction.predictions;
    const probabilities = prediction.probabilities;
    
    console.log("Predictions:", predictions);
    console.log("Probabilities:", probabilities);
    
    if (!predictions || predictions.length === 0) return null;
    
    const congestionValue = predictions[0];
    let congestionProbabilities = null;
    
    if (probabilities && probabilities.length > 0) {
      congestionProbabilities = probabilities[0];
    }
    
    console.log("Congestion Value:", congestionValue);
    console.log("Congestion Probabilities:", congestionProbabilities);
    
    // Check if the congestion probabilities exist and have the expected structure
    // Different handling based on the data structure
    let congestionProb = null;
    let freeFlowProb = null;
    
    // Handling for different response structures
    if (congestionProbabilities) {
      if (Array.isArray(congestionProbabilities) && congestionProbabilities.length >= 2) {
        // If probabilities is an array with at least 2 values
        freeFlowProb = congestionProbabilities[0] * 100;
        congestionProb = congestionProbabilities[1] * 100;
      } else if (typeof congestionProbabilities === 'object') {
        // If probabilities is an object with named keys
        freeFlowProb = (congestionProbabilities[0] || congestionProbabilities['0'] || 0) * 100;
        congestionProb = (congestionProbabilities[1] || congestionProbabilities['1'] || 0) * 100;
      } else if (typeof congestionProbabilities === 'number') {
        // If only one number is provided (confidence score)
        congestionProb = congestionValue === 1 ? congestionProbabilities * 100 : 0;
        freeFlowProb = congestionValue === 0 ? congestionProbabilities * 100 : 0;
      }
    } else {
      // Fallback values if no probabilities are available
      congestionProb = congestionValue === 1 ? 95 : 5;
      freeFlowProb = congestionValue === 0 ? 95 : 5;
    }
    
    console.log("Calculated congestionProb:", congestionProb);
    console.log("Calculated freeFlowProb:", freeFlowProb);
    
    // Format the status text with proper percentage value
    const statusText = congestionValue === 1 
      ? `Congested (${congestionProb !== null ? congestionProb.toFixed(1) : "N/A"}%)` 
      : `Free Flow (${freeFlowProb !== null ? freeFlowProb.toFixed(1) : "N/A"}%)`;
    
    // Determine severity level based on probability
    let severityLevel = 'low';
    let warningMessage = '';
    
    if (congestionProb !== null) {
      if (congestionProb >= 80) {
        severityLevel = 'high';
        warningMessage = '⚠️ High likelihood of severe delays. Consider an alternative route.';
      } else if (congestionProb >= 50) {
        severityLevel = 'medium';
        warningMessage = '⚠️ Moderate traffic expected. Plan for possible delays.';
      } else {
        severityLevel = 'low';
        warningMessage = '✓ Traffic should be flowing smoothly.';
      }
    }
    
    return {
      isCongested: congestionValue === 1,
      confidence: congestionProbabilities ? 
        (Array.isArray(congestionProbabilities) ? 
          Math.max(...congestionProbabilities) * 100 : 
          (typeof congestionProbabilities === 'number' ? congestionProbabilities * 100 : null)
        ) : null,
      congestionProb: congestionProb,
      freeFlowProb: freeFlowProb,
      status: statusText,
      color: congestionValue === 1 ? '#e74c3c' : '#2ecc71',
      severityLevel,
      warningMessage
    };
  };

  // Helper function to interpret travel time prediction
  const interpretTravelTime = (prediction) => {
    if (!prediction) return null;
    
    console.log("Travel time prediction response:", prediction);
    
    const predictions = prediction.predictions;
    const probabilities = prediction.probabilities;
    
    if (!predictions || predictions.length === 0) return null;
    
    // Estimated travel time in minutes
    const predictedMinutes = Math.round(predictions[0]);
    
    // Format as minutes or hours and minutes
    let formattedTime = '';
    if (predictedMinutes < 60) {
      formattedTime = `${predictedMinutes} min`;
    } else {
      const hours = Math.floor(predictedMinutes / 60);
      const minutes = predictedMinutes % 60;
      formattedTime = `${hours} hr ${minutes} min`;
    }
    
    // Confidence interval if provided in probabilities
    let confidenceRange = null;
    
    if (probabilities && probabilities.length > 0) {
      const probArray = probabilities[0];
      if (Array.isArray(probArray) && probArray.length >= 2) {
        // Extract low and high values from confidence interval
        const lowValue = Math.round(probArray[0]);
        const highValue = Math.round(probArray[probArray.length - 1]);
        
        confidenceRange = {
          low: lowValue,
          high: highValue,
          formattedLow: lowValue < 60 ? `${lowValue} min` : `${Math.floor(lowValue / 60)} hr ${lowValue % 60} min`,
          formattedHigh: highValue < 60 ? `${highValue} min` : `${Math.floor(highValue / 60)} hr ${highValue % 60} min`
        };
      }
    }
    
    // Determine if travel time is within Google's estimate
    const routeDuration = routes[selectedRoute].duration;
    const googleEstimateMinutes = parseFloat(routeDuration.replace(/[^0-9.]/g, ''));
    
    // If Google estimate contains "hr", multiply by 60
    const hasHour = routeDuration.includes('hr') || routeDuration.includes('hour');
    let adjustedGoogleEstimate = googleEstimateMinutes;
    
    if (hasHour) {
      // Extract hours and minutes
      const hourMatch = routeDuration.match(/(\d+)\s*hr/);
      const minuteMatch = routeDuration.match(/(\d+)\s*min/);
      
      const hours = hourMatch ? parseInt(hourMatch[1]) : 0;
      const minutes = minuteMatch ? parseInt(minuteMatch[1]) : 0;
      
      adjustedGoogleEstimate = hours * 60 + minutes;
    }
    
    // Calculate difference from Google estimate
    const diffFromGoogle = predictedMinutes - adjustedGoogleEstimate;
    const percentDiff = (diffFromGoogle / adjustedGoogleEstimate) * 100;
    
    let comparisonText = '';
    let severityLevel = 'low';
    
    if (Math.abs(percentDiff) < 10) {
      comparisonText = "Matches navigation app estimate";
      severityLevel = 'low';
    } else if (percentDiff > 0) {
      comparisonText = `${Math.abs(diffFromGoogle).toFixed(0)} min slower than navigation estimate`;
      severityLevel = percentDiff > 30 ? 'high' : 'medium';
    } else {
      comparisonText = `${Math.abs(diffFromGoogle).toFixed(0)} min faster than navigation estimate`;
      severityLevel = 'low';
    }
    
    return {
      predictedMinutes,
      formattedTime,
      confidenceRange,
      comparisonText,
      severityLevel,
      color: 
        severityLevel === 'high' ? '#e74c3c' : 
        severityLevel === 'medium' ? '#f39c12' : 
        '#2ecc71'
    };
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollContainer}>
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
        
        {/* Location Search Section */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Enter Your Route</Text>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Start Location</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Jurong East"
              value={locationInputs.startLocation}
              onChangeText={(text) => setLocationInputs({...locationInputs, startLocation: text})}
              placeholderTextColor="#777"
            />
          </View>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>Destination</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Changi Airport"
              value={locationInputs.endLocation}
              onChangeText={(text) => setLocationInputs({...locationInputs, endLocation: text})}
              placeholderTextColor="#777"
            />
          </View>
          
          <TouchableOpacity 
            style={styles.searchButton} 
            onPress={handleRouteSearch}
            disabled={loading}
          >
            <Text style={styles.buttonText}>Find Route</Text>
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
                        selectedRoute === index && styles.selectedRouteButton,
                        (predictionsMade.trafficCongestion || predictionsMade.travelTime) && 
                        index !== selectedRoute && styles.disabledRouteButton
                      ]}
                      onPress={() => {
                        if (!predictionsMade.trafficCongestion && !predictionsMade.travelTime) {
                          setSelectedRoute(index);
                          extractRouteDetailsForPrediction(route);
                        }
                      }}
                      disabled={(predictionsMade.trafficCongestion || predictionsMade.travelTime) && 
                               index !== selectedRoute}
                    >
                      <Text style={[
                        styles.routeButtonText,
                        selectedRoute === index && styles.selectedRouteButtonText,
                        (predictionsMade.trafficCongestion || predictionsMade.travelTime) && 
                        index !== selectedRoute && styles.disabledRouteButtonText
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
        
        {/* Prediction Action Buttons */}
        {routes.length > 0 && (
          <View style={styles.actionButtonsContainer}>
            {!predictionsMade.trafficCongestion && !predictionsMade.travelTime ? (
              <>
                <TouchableOpacity 
                  style={styles.predictionButton} 
                  onPress={predictTrafficCongestion}
                  disabled={loading}
                >
                  <Icon name="traffic" size={24} color="#fff" />
                  <Text style={styles.buttonText}>Predict Traffic Congestion</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.predictionButton} 
                  onPress={predictTravelTime}
                  disabled={loading}
                >
                  <Icon name="timer" size={24} color="#fff" />
                  <Text style={styles.buttonText}>Predict Travel Time</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity 
                style={styles.resetButton} 
                onPress={resetPredictions}
              >
                <Icon name="refresh" size={24} color="#fff" />
                <Text style={styles.buttonText}>Reset Predictions</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        
        {/* Loading Indicator */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3498db" />
            <Text style={styles.loadingText}>Processing request...</Text>
          </View>
        )}
        
        {/* Results Section */}
        <View style={styles.resultsContainer}>
          {/* Traffic Congestion Result */}
          {predictions.trafficCongestion && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Traffic Congestion Prediction</Text>
              
              {(() => {
                const trafficResult = interpretTrafficCongestion(predictions.trafficCongestion);
                if (!trafficResult) return null;
                
                return (
                  <View style={[
                    styles.resultBox, 
                    { backgroundColor: trafficResult.color + '20' },
                    trafficResult.severityLevel === 'high' && styles.highSeverityBox,
                    trafficResult.severityLevel === 'medium' && styles.mediumSeverityBox,
                    trafficResult.severityLevel === 'low' && styles.lowSeverityBox
                  ]}>
                    <View style={styles.resultHeader}>
                      <Icon 
                        name={trafficResult.isCongested ? 'traffic' : 'directions-car'} 
                        size={32} 
                        color={trafficResult.color} 
                      />
                      <Text style={[styles.resultTitle, { color: trafficResult.color }]}>
                        {trafficResult.status || "Status Unavailable"}
                      </Text>
                    </View>
                    
                    {/* Warning Message */}
                    <View style={styles.warningContainer}>
                      <Text style={[
                        styles.warningText,
                        trafficResult.severityLevel === 'high' && styles.highSeverityText,
                        trafficResult.severityLevel === 'medium' && styles.mediumSeverityText,
                        trafficResult.severityLevel === 'low' && styles.lowSeverityText
                      ]}>
                        {trafficResult.warningMessage || "No traffic information available."}
                      </Text>
                    </View>
                    
                    {/* Show probabilities */}
                    {trafficResult.congestionProb !== null && (
                      <View style={styles.probabilityContainer}>
                        <Text style={styles.probabilityTitle}>Prediction Probabilities:</Text>
                        <View style={styles.probabilityBar}>
                          <View 
                            style={[
                              styles.probabilityFill, 
                              { 
                                width: `${trafficResult.congestionProb}%`,
                                backgroundColor: '#e74c3c' 
                              }
                            ]} 
                          />
                          <Text style={styles.probabilityLabel}>
                            Congested: {trafficResult.congestionProb.toFixed(1)}%
                          </Text>
                        </View>
                        <View style={styles.probabilityBar}>
                          <View 
                            style={[
                              styles.probabilityFill, 
                              { 
                                width: `${trafficResult.freeFlowProb}%`,
                                backgroundColor: '#2ecc71' 
                              }
                            ]} 
                          />
                          <Text style={styles.probabilityLabel}>
                            Free Flow: {trafficResult.freeFlowProb.toFixed(1)}%
                          </Text>
                        </View>
                      </View>
                    )}
                    
                    <Text style={styles.resultDetail}>
                      Road: {modelInputs.traffic.RoadName} ({modelInputs.traffic.RoadCategory})
                    </Text>
                  </View>
                );
              })()}
            </View>
          )}
          
          {/* Travel Time Prediction Result */}
          {predictions.travelTime && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Travel Time Prediction</Text>
              
              {(() => {
                const travelTimeResult = interpretTravelTime(predictions.travelTime);
                if (!travelTimeResult) return null;
                
                return (
                  <View style={[
                    styles.resultBox, 
                    { backgroundColor: travelTimeResult.color + '20' },
                    travelTimeResult.severityLevel === 'high' && styles.highSeverityBox,
                    travelTimeResult.severityLevel === 'medium' && styles.mediumSeverityBox,
                    travelTimeResult.severityLevel === 'low' && styles.lowSeverityBox
                  ]}>
                    <View style={styles.resultHeader}>
                      <Icon 
                        name="timer" 
                        size={32} 
                        color={travelTimeResult.color} 
                      />
                      <Text style={[styles.resultTitle, { color: travelTimeResult.color }]}>
                        {travelTimeResult.formattedTime}
                      </Text>
                    </View>
                    
                    {/* Comparison Message */}
                    <View style={styles.warningContainer}>
                      <Text style={[
                        styles.warningText,
                        travelTimeResult.severityLevel === 'high' && styles.highSeverityText,
                        travelTimeResult.severityLevel === 'medium' && styles.mediumSeverityText,
                        travelTimeResult.severityLevel === 'low' && styles.lowSeverityText
                      ]}>
                        {travelTimeResult.comparisonText || "No travel time comparison available."}
                      </Text>
                    </View>
                    
                    {/* Confidence range if available */}
                    {travelTimeResult.confidenceRange && (
                      <View style={styles.probabilityContainer}>
                        <Text style={styles.probabilityTitle}>Prediction Range:</Text>
                        <View style={styles.rangeContainer}>
                          <Text style={styles.rangeText}>
                            <Icon name="arrow-downward" size={16} color="#3498db" /> {travelTimeResult.confidenceRange.formattedLow}
                          </Text>
                          <Text style={styles.rangeSeparator}>to</Text>
                          <Text style={styles.rangeText}>
                            <Icon name="arrow-upward" size={16} color="#e74c3c" /> {travelTimeResult.confidenceRange.formattedHigh}
                          </Text>
                        </View>
                      </View>
                    )}
                    
                    <Text style={styles.resultDetail}>
                      Route: {modelInputs.travelTime.Startpoint} to {modelInputs.travelTime.Endpoint}
                    </Text>
                    <Text style={styles.resultDetail}>
                      Road: {modelInputs.travelTime.Expressway} ({modelInputs.travelTime.Direction})
                    </Text>
                    <Text style={styles.resultDetail}>
                      Distance: {modelInputs.travelTime.distance_km.toFixed(1)} km
                    </Text>
                  </View>
                );
              })()}
            </View>
          )}
          
          {/* Route Map Display */}
          {routes.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Route Map</Text>
              
              {location && (
                <MapView
                  style={styles.map}
                  initialRegion={{
                    latitude: routes[selectedRoute].markers[0].latitude,
                    longitude: routes[selectedRoute].markers[0].longitude,
                    latitudeDelta: 0.05,
                    longitudeDelta: 0.05,
                  }}
                >
                  {/* Origin marker */}
                  <Marker
                    coordinate={{
                      latitude: routes[selectedRoute].markers[0].latitude,
                      longitude: routes[selectedRoute].markers[0].longitude
                    }}
                    pinColor="green"
                    title="Start"
                    description={locationInputs.startLocation}
                  />
                  
                  {/* Destination marker */}
                  <Marker
                    coordinate={{
                      latitude: routes[selectedRoute].markers[1].latitude,
                      longitude: routes[selectedRoute].markers[1].longitude
                    }}
                    pinColor="red"
                    title="Destination"
                    description={locationInputs.endLocation}
                  />
                  
                  {/* Route polyline */}
                  <Polyline
                    coordinates={routes[selectedRoute].polyline}
                    strokeWidth={4}
                    strokeColor={predictions.trafficCongestion ? 
                      (interpretTrafficCongestion(predictions.trafficCongestion).color) : 
                      "#3498db"}
                  />
                </MapView>
              )}
              
              <View style={styles.routeDetails}>
                <Text style={styles.routeDetail}>
                  Distance: {routes[selectedRoute].distance}
                </Text>
                <Text style={styles.routeDetail}>
                  Estimated Time of Travel: {routes[selectedRoute].duration}
                </Text>
                <Text style={styles.routeDetail}>
                  Via: {modelInputs.traffic.RoadName}
                </Text>
              </View>
            </View>
          )}
        </View>
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
    backgroundColor: '#000', // Black background
  },
  scrollContainer: {
    flex: 1,
    backgroundColor: '#000', // Black background for ScrollView
  },
  headerContainer: {
    padding: 20,
    backgroundColor: '#111', // Dark background for header
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  header: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff', // White text for dark background
  },
  subheader: {
    fontSize: 16,
    color: '#aaa', // Light gray text for dark background
    marginTop: 5,
  },
  card: {
    backgroundColor: '#111', // Dark card background
    borderRadius: 10,
    padding: 16,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#222', // Subtle border for cards
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#fff', // White text for card titles
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    color: '#ccc', // Light gray labels
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#333', // Darker border for inputs
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    backgroundColor: '#222', // Dark input background
    color: '#fff', // White text in inputs
  },
  searchButton: {
    backgroundColor: '#16a085', // Teal button
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
  routeSelectionContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#222', // Dark background for route selection
    borderRadius: 8,
  },
  routeSelectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#fff', // White text for route title
  },
  routeButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  routeButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: '#333', // Dark button background
  },
  selectedRouteButton: {
    backgroundColor: '#3498db', // Blue for selected route
  },
  disabledRouteButton: {
    backgroundColor: '#333',
    opacity: 0.6,
  },
  routeButtonText: {
    fontSize: 14,
    color: '#ccc', // Light gray text
  },
  selectedRouteButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  disabledRouteButtonText: {
    color: '#555', // Dark gray for disabled
  },
  actionButtonsContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 12,
  },
  predictionButton: {
    backgroundColor: '#3498db', // Same blue color for both prediction buttons
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    width: '90%',
  },
  resetButton: {
    backgroundColor: '#7f8c8d', // Gray reset button
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    width: '90%',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#ccc', // Light gray loading text
    fontSize: 16,
  },
  resultsContainer: {
    marginBottom: 20,
  },
  resultBox: {
    marginTop: 16,
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#222', // Dark background for result boxes
    borderLeftWidth: 4,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  resultTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginLeft: 12,
  },
  resultDetail: {
    fontSize: 16,
    color: '#ccc', // Light gray for details
    marginTop: 6,
  },
  probabilityContainer: {
    marginVertical: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#333', // Darker border
  },
  probabilityTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#fff', // White title text
  },
  probabilityBar: {
    height: 30,
    backgroundColor: '#333', // Dark background for bars
    borderRadius: 4,
    marginBottom: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  probabilityFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    opacity: 0.7,
  },
  probabilityLabel: {
    position: 'absolute',
    top: 0,
    left: 8,
    right: 0,
    bottom: 0,
    textAlignVertical: 'center',
    color: '#fff', // White text for probability labels
    fontWeight: 'bold',
  },
  rangeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#333', // Dark background for range container
    borderRadius: 8,
    marginTop: 8,
  },
  rangeText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff', // White text for range
  },
  rangeSeparator: {
    fontSize: 14,
    color: '#777', // Gray separator text
  },
  map: {
    height: 220,
    borderRadius: 8,
    marginBottom: 16,
  },
  routeDetails: {
    backgroundColor: '#222', // Dark background for route details
    padding: 12,
    borderRadius: 8,
  },
  routeDetail: {
    fontSize: 16,
    color: '#ccc', // Light gray text for route details
    marginBottom: 6,
  },
  footer: {
    padding: 16,
    backgroundColor: '#111', // Dark background for footer
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  footerText: {
    fontSize: 12,
    color: '#777', // Gray text for footer
  },
  
  // Styles for severity indicators
  highSeverityBox: {
    borderLeftWidth: 4,
    borderLeftColor: '#e74c3c', // Red for high severity
  },
  mediumSeverityBox: {
    borderLeftWidth: 4,
    borderLeftColor: '#f39c12', // Orange for medium severity
  },
  lowSeverityBox: {
    borderLeftWidth: 4,
    borderLeftColor: '#2ecc71', // Green for low severity
  },
  
  // Warning container and text
  warningContainer: {
    backgroundColor: 'rgba(40, 40, 40, 0.7)', // Dark semi-transparent
    padding: 12,
    borderRadius: 6,
    marginVertical: 10,
  },
  warningText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#ccc', // Light gray text
  },
  highSeverityText: {
    color: '#e74c3c', // Red for high severity
  },
  mediumSeverityText: {
    color: '#f39c12', // Orange for medium severity
  },
  lowSeverityText: {
    color: '#2ecc71', // Green for low severity
  },
});