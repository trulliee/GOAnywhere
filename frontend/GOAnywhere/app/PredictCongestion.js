// // PredictCongestion.js
// import React, { useState, useEffect, useRef } from 'react';
// import { Alert } from 'react-native';
// import { useNavigation } from '@react-navigation/native';
// import * as Location from 'expo-location';
// import moment from 'moment';
// import axios from 'axios';

// import TrafficPredictionRendering from './PredictionRendering';

// const API_BASE_URL = 'https://goanywhere-backend-541900038032.asia-southeast1.run.app';

// const PUBLIC_HOLIDAYS_2025 = [
//   '2025-01-01', '2025-01-25', '2025-01-26', '2025-04-18',
//   '2025-05-01', '2025-05-12', '2025-08-09', '2025-11-04', '2025-12-25',
// ];

// const PredictCongestion = () => {
//   const navigation = useNavigation();
//   const [startLocation, setStartLocation] = useState('');
//   const [endLocation, setEndLocation] = useState('');
//   const [currentTemperature, setCurrentTemperature] = useState(null);
//   const [currentHumidity, setCurrentHumidity] = useState(null);
//   const [isLoading, setIsLoading] = useState(false);
//   const [routes, setRoutes] = useState([]);
//   const [selectedRouteIndex, setSelectedRouteIndex] = useState(null);
//   const [congestionPrediction, setCongestionPrediction] = useState(null);
//   const [selectedDate, setSelectedDate] = useState(new Date());
//   const [datePickerVisible, setDatePickerVisible] = useState(false);
//   const [predictionLock, setPredictionLock] = useState(false);
//   const [editingCongestion, setEditingCongestion] = useState(false);
//   const [customCongestionInput, setCustomCongestionInput] = useState(null);
//   const [bothPredicted, setBothPredicted] = useState(false);
//   const isMounted = useRef(true);

//   useEffect(() => {
//     requestLocationPermission();
//     fetchWeather();
//     return () => { isMounted.current = false; };
//   }, []);

//   const requestLocationPermission = async () => {
//     try {
//       const { status } = await Location.requestForegroundPermissionsAsync();
//       if (status !== 'granted') return;
//       const location = await Location.getCurrentPositionAsync({});
//       const address = await reverseGeocode(location.coords.latitude, location.coords.longitude);
//       if (isMounted.current) setStartLocation(address);
//     } catch (err) {
//       console.error('Location error:', err);
//     }
//   };

//   const isHoliday = (date) => {
//     return PUBLIC_HOLIDAYS_2025.includes(moment(date).format('YYYY-MM-DD'));
//   };

//   const getDayType = (date) => {
//     const day = moment(date).day();
//     return day === 0 || day === 6 ? 'weekend' : 'weekday';
//   };


//   const reverseGeocode = async (lat, lng) => {
//     try {
//       const resp = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
//       if (resp.length) {
//         return [resp[0].name, resp[0].street, resp[0].district].filter(Boolean).join(', ');
//       }
//       return 'Current Location';
//     } catch {
//       return 'Current Location';
//     }
//   };

//   const fetchWeather = async () => {
//     try {
//       const response = await fetch("https://api.openweathermap.org/data/2.5/weather?lat=1.29&lon=103.85&appid=1c6a0489337511175419c64f0fbba7d1&units=metric");
//       const data = await response.json();
//       setCurrentTemperature(data.main.temp ?? 28);
//       setCurrentHumidity(data.main.humidity ?? 75);
//     } catch {
//       setCurrentTemperature(28);
//       setCurrentHumidity(75);
//     }
//   };

//   const predictCongestion = async () => {
//     if (selectedRouteIndex === null) return Alert.alert('Route Required', 'Select a route first.');
//     setIsLoading(true);
//     try {
//       const inputs = generateModelInputs(routes[selectedRouteIndex]);
//       const response = await axios.post(`${API_BASE_URL}/prediction/congestion`, inputs);
//       setCongestionPrediction(response.data);
//       setPredictionLock(true);
//     } catch (err) {
//       setCongestionPrediction({
//         status: 'success',
//         predictions: [{ prediction: 1, probabilities: [0.2, 0.8], classes: [0, 1] }]
//       });
//       setPredictionLock(true);
//       Alert.alert('Fallback', 'Using fallback data.');
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const resetPredictions = () => {
//     setCongestionPrediction(null);
//     setPredictionLock(false);
//     setEditingCongestion(false);
//     setCustomCongestionInput(null);
//   };

//   const goToFeedback = () => navigation.navigate('TrafficPredictionFeedback');

//   const startJourney = () => {
//     if (selectedRouteIndex !== null) {
//       const selectedRoute = routes[selectedRouteIndex];
//       navigation.navigate('P2PNavigation', { startLocation, endLocation, selectedRoute, driverActive: true });
//     } else {
//       Alert.alert('Route Required', 'Select a route to begin navigation.');
//     }
//   };

//   const generateModelInputs = (route) => {
//     const hour = moment(selectedDate).hour();
//     const dayOfWeek = moment(selectedDate).day();
//     const month = moment(selectedDate).month() + 1;
//     const isHolidayFlag = PUBLIC_HOLIDAYS_2025.includes(moment(selectedDate).format('YYYY-MM-DD')) ? 1 : 0;
//     return {
//       RoadName: route.summary || 'Major Road',
//       RoadCategory: 'Expressway',
//       hour,
//       day_of_week: dayOfWeek,
//       month,
//       is_holiday: isHolidayFlag,
//       event_count: 0,
//       incident_count: 0,
//       temperature: currentTemperature,
//       humidity: currentHumidity,
//       peak_hour_flag: [7,8,9,17,18,19].includes(hour) ? 1 : 0,
//       day_type: (dayOfWeek === 0 || dayOfWeek === 6) ? 'weekend' : 'weekday',
//       road_type: 'major',
//       recent_incident_flag: 0,
//       speed_band_previous_hour: 2,
//       rain_flag: 0,
//       max_event_severity: 0,
//       sum_event_severity: 0
//     };
//   };

//   return (
//     <TrafficPredictionRendering
//       startLocation={startLocation}
//       setStartLocation={setStartLocation}
//       isHoliday={isHoliday}
//       getDayType={getDayType}
//       endLocation={endLocation}
//       setEndLocation={setEndLocation}
//       isLoading={isLoading}
//       routes={routes}
//       selectedRouteIndex={selectedRouteIndex}
//       congestionPrediction={congestionPrediction}
//       selectedDate={selectedDate}
//       datePickerVisible={datePickerVisible}
//       predictionLock={predictionLock}
//       editingCongestion={editingCongestion}
//       bothPredicted={bothPredicted}
//       customCongestionInput={customCongestionInput}
//       predictCongestion={predictCongestion}
//       resetPredictions={resetPredictions}
//       startJourney={startJourney}
//       goToFeedback={goToFeedback}
//       setRoutes={setRoutes}
//       setSelectedRouteIndex={setSelectedRouteIndex}
//       setDatePickerVisible={setDatePickerVisible}
//     />
//   );
// };

// export default PredictCongestion;