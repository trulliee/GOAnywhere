import React, { useState, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import moment from 'moment';
import axios from 'axios';

// Import P2P routing 
import P2PDriver from './P2PDriver';

// Import components for rendering
import PredictionFeedback from './PredictionFeedback';
import PredictionRendering from './PredictionRendering';

const API_BASE_URL = 'https://goanywhere-backend-541900038032.asia-southeast1.run.app';

// Singapore public holidays for 2025 (add more as needed)
const PUBLIC_HOLIDAYS_2025 = [
  '2025-01-01', // New Year's Day
  '2025-01-25', // Chinese New Year
  '2025-01-26', // Chinese New Year
  '2025-04-18', // Good Friday
  '2025-05-01', // Labor Day
  '2025-05-12', // Vesak Day
  '2025-08-09', // National Day
  '2025-11-04', // Deepavali
  '2025-12-25', // Christmas Day
];

const PredictCongestion = () => {
  const navigation = useNavigation();
  const [startLocation, setStartLocation] = useState('');
  const [endLocation, setEndLocation] = useState('');
  const [currentTemperature, setCurrentTemperature] = useState(null);
  const [currentHumidity, setCurrentHumidity] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [routes, setRoutes] = useState([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(null);
  const [congestionPrediction, setCongestionPrediction] = useState(null);
  const [modelInputs, setModelInputs] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [predictionLock, setPredictionLock] = useState(false);
  const [routeFound, setRouteFound] = useState(false);
  const [routeDistance, setRouteDistance] = useState(null);
  const [routeTime, setRouteTime] = useState(null);
  const [routeCount, setRouteCount] = useState(0);
  const [editingCongestion, setEditingCongestion] = useState(false);
  const [customCongestionInput, setCustomCongestionInput] = useState(null);
  const [prevCongestionPrediction, setPrevCongestionPrediction] = useState(null);
  const [showSimilarityWarningFlag, setShowSimilarityWarningFlag] = useState(false);
  const [applyTriggered, setApplyTriggered] = useState(false);


  // Ref to keep track of mounted state
  const isMounted = useRef(true);

  useEffect(() => {
    requestLocationPermission();
    fetchWeatherFromAPI();
    return () => { isMounted.current = false; };
  }, []);


  // Check if a date is a holiday
  const isHoliday = (date) => {
    const formattedDate = moment(date).format('YYYY-MM-DD');
    return PUBLIC_HOLIDAYS_2025.includes(formattedDate);
  };

  // Get day type (weekday or weekend)
  const getDayType = (date) => {
    const day = moment(date).day();
    return (day === 0 || day === 6) ? 'weekend' : 'weekday';
  };

  // Convert decimal hours to HH:MM format
  const formatDecimalHours = (decimalHours) => {
    const hours = Math.floor(decimalHours);
    const minutes = Math.round((decimalHours - hours) * 60);
    return `${hours} hr ${minutes} min`;
  };

  // Convert minutes to a readable format
  const formatMinutes = (minutes) => {
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = Math.round(minutes % 60);
    return `${hours} hr${remainingMinutes > 0 ? ` ${remainingMinutes} min` : ''}`;
  };

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('Location permission denied');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const address = await reverseGeocode(
        location.coords.latitude,
        location.coords.longitude
      );
      
      if (isMounted.current) {
        setStartLocation(address);
      }
    } catch (err) {
      console.error('Error getting location:', err);
    }
  };

  const reverseGeocode = async (latitude, longitude) => {
    try {
      const response = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });

      if (response && response.length > 0) {
        const address = response[0];
        const formattedAddress = [
          address.name,
          address.street,
          address.district,
          address.city,
          address.region,
          address.country
        ]
          .filter(Boolean)
          .join(', ');
          
        return formattedAddress;
      }
      return 'Current Location';
    } catch (error) {
      console.error('Error reverse geocoding:', error);
      return 'Current Location';
    }
  };
  
  const fetchWeatherFromAPI = async () => {
    try {
      const response = await fetch("https://api.openweathermap.org/data/2.5/weather?lat=1.290270&lon=103.851959&appid=1c6a0489337511175419c64f0fbba7d1&units=metric");
      const data = await response.json();
      if (data && data.main) {
        setCurrentTemperature(data.main.temp ?? 28.0);
        setCurrentHumidity(data.main.humidity ?? 75.0);
      }
    } catch (err) {
      console.error("Weather fetch error:", err);
      // fallback
      setCurrentTemperature(28.0);
      setCurrentHumidity(75.0);
    }
  };


  const findRoute = async () => {
    if (!startLocation || !endLocation) {
      Alert.alert('Missing Info', 'Please enter both start location and destination.');
      return;
    }

    setIsLoading(true);
    setRoutes([]);
    setCongestionPrediction(null);
    setSelectedRouteIndex(null);
    setPredictionLock(false);
    setCustomCongestionInput(null);
    
    try {
      // Use P2PDriver to get routes
      const driverRoutes = await P2PDriver(startLocation, endLocation);
      
      if (driverRoutes.length === 0) {
        throw new Error('No routes found');
      }
      
      // Set routes and select the first one by default
      setRoutes(driverRoutes);
      setRouteCount(driverRoutes.length);
      setSelectedRouteIndex(0); // Automatically select the first route
      setRouteFound(true);
      
      // Extract distance and time for display in the alert
      const distance = driverRoutes[0].distance;
      const time = driverRoutes[0].duration;
      
      setRouteDistance(distance);
      setRouteTime(time);
      
    } catch (error) {
      console.error('Error finding route:', error);
      Alert.alert('Error', error.message || 'Failed to find route. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const resetPredictions = () => {
    setCongestionPrediction(null);
    setPredictionLock(false);
    setEditingCongestion(false);
    setCustomCongestionInput(null);
    setApplyTriggered(false);
    setShowSimilarityWarningFlag(false);
  };

  const selectRoute = (index) => {
    if (predictionLock && selectedRouteIndex !== index) {
      Alert.alert(
        'Route Locked',
        'Please reset predictions before selecting a different route.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    setSelectedRouteIndex(index);
    setEditingCongestion(false);
    
    // Reset predictions when changing routes
    if (predictionLock) {
      resetPredictions();
    }
  };

  const handleDateChange = (event, date) => {
    setDatePickerVisible(false);
    if (date) {
      setSelectedDate(date);
      // Reset predictions when date changes
      if (predictionLock) {
        resetPredictions();
      }
    }
  };

  const toggleDatePicker = () => {
    setDatePickerVisible(!datePickerVisible);
  };

  const toggleEditCongestion = () => {
    if (!editingCongestion && !customCongestionInput && congestionPrediction) {
      // Initialize the custom input with current prediction values
      const route = routes[selectedRouteIndex];
      const inputs = generateModelInputs(route);
      setCustomCongestionInput(inputs.congestionInput);
    }
    setEditingCongestion(!editingCongestion);
  };

  const updateCustomCongestionInput = (field, value) => {
    setCustomCongestionInput(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const applyCustomCongestionInput = async () => {
    setIsLoading(true);
    setEditingCongestion(false);
    setApplyTriggered(true);

    try {
      // Send custom model input to the API for prediction
      const response = await axios.post(
        `${API_BASE_URL}/prediction/congestion`,
        customCongestionInput
      );
      
      if (response.data && response.data.status === 'success') {
        setPrevCongestionPrediction(congestionPrediction);
        setCongestionPrediction(response.data);
        setPredictionLock(true);
      } else {
        throw new Error('Invalid prediction response');
      }
    } catch (error) {
      console.error('Error predicting congestion:', error);
      
      // For demo purposes, generate mock prediction
      setCongestionPrediction({
        status: 'success',
        predictions: [{
          prediction: 1,
          probabilities: [0.21954939753900793, 0.7804506024609921],
          classes: [0, 1]
        }]
      });
      setPredictionLock(true);
      
      Alert.alert(
        'Prediction Error',
        'Could not get congestion prediction with custom inputs. Using fallback data.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const generateModelInputs = (route) => {
    if (!route) return null;
    
    // Get date/time info from selected date
    const selectedDateMoment = moment(selectedDate);
    const hour = selectedDateMoment.hour();
    const dayOfWeek = selectedDateMoment.day(); // 0-6, 0 is Sunday
    const month = selectedDateMoment.month() + 1; // 1-12
    
    // Check if it's a holiday
    const isHolidayFlag = isHoliday(selectedDate) ? 1 : 0;
    
    // Determine if it's peak hour
    const morningPeakHours = [7, 8, 9];
    const eveningPeakHours = [17, 18, 19, 20];
    const isPeakHour = morningPeakHours.includes(hour) || eveningPeakHours.includes(hour) ? 1 : 0;
    
    // Determine day type
    const dayType = getDayType(selectedDate);
    
    // Get road information from the route
    const roadInfo = extractRoadInfo(route);
    
    // Check if there are any incidents reported in the route
    const hasIncidents = route.issues && route.issues.includes('traffic incident') ? 1 : 0;
    const incidentCount = hasIncidents ? 1 : 0;
    
    // Environmental conditions - could get from weather API in a real app
    // Using realistic values for Singapore
    const temperature = currentTemperature ?? 28.0;
    const humidity = currentHumidity ?? 75.0;
    const rainFlag = 0; // Default to no rain
    
    // Event info from route data
    const eventCount = route.issues && route.issues.includes('road works') ? 1 : 0;
    const eventSeverity = eventCount ? 1 : 0;
    
    // Create model inputs
    const congestionInput = {
      RoadName: roadInfo.roadName,
      RoadCategory: roadInfo.roadCategory,
      hour,
      day_of_week: dayOfWeek,
      month,
      is_holiday: isHolidayFlag,
      event_count: eventCount,
      incident_count: incidentCount,
      temperature,
      humidity,
      peak_hour_flag: isPeakHour,
      day_type: dayType,
      road_type: roadInfo.roadType,
      recent_incident_flag: hasIncidents,
      speed_band_previous_hour: hasIncidents ? 1 : 2,
      rain_flag: rainFlag,
      max_event_severity: eventSeverity,
      sum_event_severity: eventSeverity
    };
    
    return {
      congestionInput
    };
  };

  const extractRoadInfo = (route) => {
    let expressway = '';
    let direction = '';
    let roadName = '';
    let roadCategory = '';
    let roadType = 'normal';
    
    // Singapore expressways
    const expressways = {
      'PIE': 'Pan Island Expressway',
      'ECP': 'East Coast Parkway',
      'CTE': 'Central Expressway',
      'AYE': 'Ayer Rajah Expressway',
      'KPE': 'Kallang-Paya Lebar Expressway',
      'SLE': 'Seletar Expressway',
      'TPE': 'Tampines Expressway',
      'BKE': 'Bukit Timah Expressway',
      'KJE': 'Kranji Expressway',
      'MCE': 'Marina Coastal Expressway'
    };
    
    // Try to extract expressway from route summary
    if (route.summary) {
      Object.keys(expressways).forEach(key => {
        if (route.summary.includes(key)) {
          expressway = key;
          roadName = expressways[key];
          roadCategory = 'Expressway';
          roadType = 'major';
        }
      });
    }
    
    // If we couldn't extract from summary, check in steps
    if (!expressway && route.steps) {
      for (const step of route.steps) {
        if (step.instruction) {
          for (const key of Object.keys(expressways)) {
            if (step.instruction.includes(key)) {
              expressway = key;
              roadName = expressways[key];
              roadCategory = 'Expressway';
              roadType = 'major';
              break;
            }
          }
          if (expressway) break;
        }
      }
    }
    
    // Default values if we couldn't extract
    if (!expressway) {
      if (route.summary && route.summary.includes('Expressway')) {
        expressway = 'ECP'; // Default
        roadName = 'East Coast Parkway';
        roadCategory = 'Expressway';
        roadType = 'major';
      } else {
        expressway = 'ECP'; // Default
        roadName = route.summary || 'Major Road';
        roadCategory = 'Major Arterial';
        roadType = 'normal';
      }
    }
    
    // Determine direction based on start and end locations
    // This is a simplification - in a real app, this would be more sophisticated
    const startWords = startLocation.toLowerCase().split(' ');
    const endWords = endLocation.toLowerCase().split(' ');
    
    if (endWords.some(word => ['east', 'changi', 'tampines', 'bedok'].includes(word))) {
      direction = 'East';
    } else if (endWords.some(word => ['west', 'jurong', 'tuas', 'boon lay'].includes(word))) {
      direction = 'West';
    } else if (endWords.some(word => ['north', 'woodlands', 'yishun', 'sembawang'].includes(word))) {
      direction = 'North';
    } else if (endWords.some(word => ['south', 'sentosa', 'harbourfront', 'central'].includes(word))) {
      direction = 'South';
    } else {
      // Default direction based on comparison
      const directionMapping = {
        'east': 'East',
        'west': 'West',
        'north': 'North',
        'south': 'South',
        'central': 'Central'
      };
      
      for (const word in directionMapping) {
        if (endWords.includes(word)) {
          direction = directionMapping[word];
          break;
        }
      }
      
      if (!direction) {
        direction = 'East'; // Default
      }
    }
    
    return {
      expressway,
      direction,
      roadName,
      roadCategory,
      roadType
    };
  };

  const parseDistance = (distanceStr) => {
    if (!distanceStr) return 5.0; // Default
    
    // Extract numeric value from distance string (e.g., "10 km" -> 10)
    const match = distanceStr.match(/(\d+(\.\d+)?)/);
    if (match) {
      const value = parseFloat(match[1]);
      // Check if it's in meters or kilometers
      if (distanceStr.includes('m') && !distanceStr.includes('km')) {
        return value / 1000; // Convert meters to kilometers
      }
      return value; // Already in kilometers
    }
    
    return 5.0; // Default
  };

  const predictCongestion = async () => {
    if (selectedRouteIndex === null) {
      Alert.alert('Route Required', 'Please select a route first.');
      return;
    }
    
    setIsLoading(true);
    
    try {
      const route = routes[selectedRouteIndex];
      const inputs = generateModelInputs(route);
      setModelInputs(inputs);
      
      // Send model input to the API for prediction
      const response = await axios.post(
        `${API_BASE_URL}/prediction/congestion`,
        inputs.congestionInput
      );
      
      if (response.data && response.data.status === 'success') {
        setCongestionPrediction(response.data);
        setPredictionLock(true);
      } else {
        throw new Error('Invalid prediction response');
      }
    } catch (error) {
      console.error('Error predicting congestion:', error);
      
      // For demo purposes, generate mock prediction to show UI
      setCongestionPrediction({
        status: 'success',
        predictions: [{
          prediction: 1,
          probabilities: [0.21954939753900793, 0.7804506024609921],
          classes: [0, 1]
        }]
      });
      
      Alert.alert(
        'Prediction Error',
        'Could not get congestion prediction. Using fallback data.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const startJourney = () => {
    // Navigate to P2PNavigation with the selected route
    if (selectedRouteIndex !== null) {
      const selectedRoute = routes[selectedRouteIndex];
      navigation.navigate('P2PNavigation', { 
        startLocation,
        endLocation,
        selectedRoute,
        driverActive: true
      });
    } else {
      Alert.alert('Route Selection', 'Please select a route first.');
    }
  };

  const goToFeedback = () => {
    navigation.navigate('PredictionFeedback', { predictionType: 'congestion' });
  };

  // Props to pass to the rendering component
  const renderProps = {
    startLocation,
    setStartLocation,
    endLocation,
    setEndLocation,
    currentTemperature,
    currentHumidity,
    isLoading,
    routes,
    selectedRouteIndex,
    congestionPrediction,
    selectedDate,
    datePickerVisible,
    predictionLock,
    routeFound,
    routeDistance,
    routeTime,
    routeCount,
    editingCongestion,
    customCongestionInput,
    applyTriggered,
    findRoute,
    resetPredictions,
    selectRoute,
    handleDateChange,
    toggleDatePicker,
    toggleEditCongestion,
    updateCustomCongestionInput,
    applyCustomCongestionInput,
    predictCongestion,
    startJourney,
    goToFeedback,
    formatMinutes,
    isHoliday,
    getDayType
  };
  

  return <PredictionRendering {...renderProps} 
  prevCongestionPrediction={prevCongestionPrediction}
  showSimilarityWarningFlag={showSimilarityWarningFlag}
  setShowSimilarityWarningFlag={setShowSimilarityWarningFlag}
  mode="congestion" />;
};

export default PredictCongestion;