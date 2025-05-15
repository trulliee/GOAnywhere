import React, { useState, useEffect } from "react";
import { 
  View, 
  Text, 
  TouchableOpacity, 
  ActivityIndicator, 
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  FlatList,
  Modal
} from "react-native";
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

// OpenWeatherMap API Key
const API_KEY = "1c6a0489337511175419c64f0fbba7d1";

// Base API URLs
const CURRENT_WEATHER_URL = "https://api.openweathermap.org/data/2.5/weather";
const FORECAST_URL = "https://api.openweathermap.org/data/2.5/forecast";

// List of available Singapore areas with coordinates
// Using coordinates ensures more accurate results
const SINGAPORE_AREAS = [
  { id: '1', name: 'Singapore (Central)', lat: 1.290270, lon: 103.851959 },
  { id: '2', name: 'Ang Mo Kio', lat: 1.3691, lon: 103.8454 },
  { id: '3', name: 'Bedok', lat: 1.3236, lon: 103.9273 },
  { id: '4', name: 'Bishan', lat: 1.3526, lon: 103.8352 },
  { id: '5', name: 'Bukit Batok', lat: 1.3590, lon: 103.7637 },
  { id: '6', name: 'Bukit Merah', lat: 1.2819, lon: 103.8239 },
  { id: '7', name: 'Bukit Panjang', lat: 1.3774, lon: 103.7719 },
  { id: '8', name: 'Bukit Timah', lat: 1.3294, lon: 103.8021 },
  { id: '9', name: 'Changi', lat: 1.3644, lon: 103.9915 },
  { id: '10', name: 'Choa Chu Kang', lat: 1.3840, lon: 103.7470 },
  { id: '11', name: 'Clementi', lat: 1.3162, lon: 103.7649 },
  { id: '12', name: 'Geylang', lat: 1.3201, lon: 103.8918 },
  { id: '13', name: 'Hougang', lat: 1.3612, lon: 103.8863 },
  { id: '14', name: 'Jurong East', lat: 1.3329, lon: 103.7436 },
  { id: '15', name: 'Jurong West', lat: 1.3404, lon: 103.7090 },
  { id: '16', name: 'Kallang', lat: 1.3100, lon: 103.8714 },
  { id: '17', name: 'Marine Parade', lat: 1.3016, lon: 103.8997 },
  { id: '18', name: 'Novena', lat: 1.3203, lon: 103.8439 },
  { id: '19', name: 'Pasir Ris', lat: 1.3721, lon: 103.9474 },
  { id: '20', name: 'Punggol', lat: 1.3984, lon: 103.9072 },
  { id: '21', name: 'Queenstown', lat: 1.2942, lon: 103.7861 },
  { id: '22', name: 'Sembawang', lat: 1.4491, lon: 103.8185 },
  { id: '23', name: 'Sengkang', lat: 1.3868, lon: 103.8914 },
  { id: '24', name: 'Serangoon', lat: 1.3554, lon: 103.8679 },
  { id: '25', name: 'Tampines', lat: 1.3496, lon: 103.9568 },
  { id: '26', name: 'Tanglin', lat: 1.3077, lon: 103.8197 },
  { id: '27', name: 'Toa Payoh', lat: 1.3343, lon: 103.8563 },
  { id: '28', name: 'Woodlands', lat: 1.4382, lon: 103.7890 },
  { id: '29', name: 'Yishun', lat: 1.4304, lon: 103.8354 },
];

const WeatherApp = () => {
  const router = useRouter();
  const [selectedArea, setSelectedArea] = useState(SINGAPORE_AREAS[0]); // Default to Singapore Central
  const [weatherData, setWeatherData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showAreaSelector, setShowAreaSelector] = useState(false);

  // Load default Singapore weather on component mount
  useEffect(() => {
    fetchWeatherByCoords(selectedArea.lat, selectedArea.lon);
  }, []);

  // Function to fetch weather using coordinates instead of area name
  const fetchWeatherByCoords = async (lat, lon) => {
    setLoading(true);
    try {
      // Fetch current weather using coordinates
      const currentResponse = await fetch(
        `${CURRENT_WEATHER_URL}?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`
      );
      const currentData = await currentResponse.json();

      // Fetch forecast data using coordinates
      const forecastResponse = await fetch(
        `${FORECAST_URL}?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`
      );
      const forecastData = await forecastResponse.json();

      if (currentData.cod === 200 && forecastData.cod === "200") {
        // Extract current rain data
        const rainVolume = currentData.rain ? currentData.rain["1h"] || 0 : 0;
        let rainCondition = "No Rain";
        let rainIcon = "sunny-outline";
        
        if (rainVolume > 0 && rainVolume <= 2.5) {
          rainCondition = "Light Rain";
          rainIcon = "rainy-outline";
        }
        else if (rainVolume > 2.5 && rainVolume <= 7.5) {
          rainCondition = "Moderate Rain";
          rainIcon = "rainy";
        }
        else if (rainVolume > 7.5) {
          rainCondition = "Heavy Rain";
          rainIcon = "thunderstorm";
        }

        // Extract upcoming rain forecast (next 3 hours)
        const nextRain = forecastData.list.slice(0, 3).map(entry => entry.rain ? entry.rain["3h"] || 0 : 0);
        const trend = analyzeRainTrend(rainVolume, nextRain);
        const trendIcon = getTrendIcon(trend);

        // Extract additional weather data
        const temperature = currentData.main.temp;
        const humidity = currentData.main.humidity;
        const windSpeed = currentData.wind.speed;

        setWeatherData({
          city: currentData.name,
          rainCondition,
          rainIcon,
          rainVolume,
          trend,
          trendIcon,
          temperature,
          humidity,
          windSpeed
        });
        await addLocalNotification({
         id: Date.now().toString(),
         icon: rainIcon,
         iconColor: '#9de3d2',
         title: `Weather Update: ${currentData.name}`,
         message: `${rainCondition}, ${rainVolume} mm`,
         timeCategory: 'today',
       });
      } else {
        console.error("API Error:", currentData.message || "Unknown error");
        alert("Failed to fetch weather data. Please try again later.");
      }
    } catch (error) {
      console.error("Error fetching weather data:", error);
      alert("Network error: Could not connect to weather service.");
    } finally {
      setLoading(false);
    }
  };

  // Function to analyze rain trend based on upcoming data
  const analyzeRainTrend = (current, nextRain) => {
    const avgFutureRain = nextRain.reduce((a, b) => a + b, 0) / nextRain.length;

    if (avgFutureRain > current) return "Increasing Rain";
    if (avgFutureRain < current) return "Decreasing Rain";
    return "Stable Rain Conditions";
  };

  // Function to get icon for trend
  const getTrendIcon = (trend) => {
    if (trend.includes("Increasing")) return "arrow-up-outline";
    if (trend.includes("Decreasing")) return "arrow-down-outline";
    return "remove-outline";
  };

  const handleGoBack = () => {
    router.back();
  };

  const handleAreaSelect = (area) => {
    setSelectedArea(area);
    setShowAreaSelector(false);
    fetchWeatherByCoords(area.lat, area.lon);
  };

  const renderAreaItem = ({ item }) => (
    <TouchableOpacity
      style={styles.areaItem}
      onPress={() => handleAreaSelect(item)}
    >
      <Text style={styles.areaItemText}>{item.name}</Text>
    </TouchableOpacity>
  );

  const addLocalNotification = async (notification) => {
    try {
      const stored = await AsyncStorage.getItem('local_notifications');
      const list = stored ? JSON.parse(stored) : [];
      list.unshift(notification);
      await AsyncStorage.setItem('local_notifications', JSON.stringify(list));
    } catch (e) {
      console.error("Error saving local notification", e);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Weather Forecast</Text>
        <View style={styles.headerRight} />
      </View>
      
      <ScrollView style={styles.contentContainer}>
        {/* Area Selector Button */}
        <TouchableOpacity 
          style={styles.areaSelector}
          onPress={() => setShowAreaSelector(true)}
        >
          <Text style={styles.selectedAreaText}>{selectedArea.name}</Text>
          <Ionicons name="chevron-down" size={20} color="#9de3d2" />
        </TouchableOpacity>

        {/* Weather Data Display */}
        {weatherData && (
          <View style={styles.weatherContainer}>
            {/* Location */}
            <View style={styles.locationContainer}>
              <Ionicons name="location" size={24} color="#9de3d2" />
              <Text style={styles.locationText}>{weatherData.city}</Text>
            </View>
            
            {/* Main Weather Card */}
            <View style={styles.weatherCard}>
              <View style={styles.weatherIconContainer}>
                <Ionicons name={weatherData.rainIcon} size={64} color="#9de3d2" />
              </View>
              <Text style={styles.conditionText}>{weatherData.rainCondition}</Text>
              <Text style={styles.rainVolumeText}>{weatherData.rainVolume} mm</Text>
            </View>
            
            {/* Trend Card */}
            <View style={styles.trendCard}>
              <View style={styles.trendHeader}>
                <Ionicons name={weatherData.trendIcon} size={24} color="#9de3d2" />
                <Text style={styles.trendTitle}>{weatherData.trend}</Text>
              </View>
              <Text style={styles.trendDescription}>
                Rain forecast for the next 3 hours
              </Text>
            </View>
            
            {/* Additional Weather Details */}
            <View style={styles.detailsContainer}>
              <View style={styles.detailCard}>
                <Ionicons name="thermometer-outline" size={24} color="#9de3d2" />
                <Text style={styles.detailTitle}>Temperature</Text>
                <Text style={styles.detailValue}>{weatherData.temperature}°C</Text>
              </View>
              
              <View style={styles.detailCard}>
                <Ionicons name="water-outline" size={24} color="#9de3d2" />
                <Text style={styles.detailTitle}>Humidity</Text>
                <Text style={styles.detailValue}>{weatherData.humidity}%</Text>
              </View>
              
              <View style={styles.detailCard}>
                <Ionicons name="speedometer-outline" size={24} color="#9de3d2" />
                <Text style={styles.detailTitle}>Wind</Text>
                <Text style={styles.detailValue}>{weatherData.windSpeed} m/s</Text>
              </View>
            </View>
          </View>
        )}
        
        {/* Loading State (when no data is available yet) */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#9de3d2" />
            <Text style={styles.loadingText}>Fetching weather data...</Text>
          </View>
        )}
      </ScrollView>

      {/* Area Selection Modal */}
      <Modal
        visible={showAreaSelector}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAreaSelector(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Area</Text>
              <TouchableOpacity onPress={() => setShowAreaSelector(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={SINGAPORE_AREAS}
              renderItem={renderAreaItem}
              keyExtractor={item => item.id}
              style={styles.areaList}
              initialNumToRender={10}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#333',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    paddingBottom: 15,
    paddingHorizontal: 20,
    backgroundColor: '#333',
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerRight: {
    width: 30,
  },
  contentContainer: {
    flex: 1,
    padding: 15,
  },
  areaSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#444',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  selectedAreaText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  weatherContainer: {
    paddingVertical: 10,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  locationText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  weatherCard: {
    backgroundColor: '#444',
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  weatherIconContainer: {
    marginBottom: 15,
  },
  conditionText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  rainVolumeText: {
    color: '#ccc',
    fontSize: 18,
  },
  trendCard: {
    backgroundColor: '#444',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
  },
  trendHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  trendTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  trendDescription: {
    color: '#ccc',
    fontSize: 14,
  },
  detailsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailCard: {
    backgroundColor: '#444',
    borderRadius: 15,
    padding: 15,
    alignItems: 'center',
    width: '30%',
  },
  detailTitle: {
    color: '#ccc',
    fontSize: 12,
    marginTop: 5,
  },
  detailValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 5,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
  },
  loadingText: {
    color: '#ccc',
    fontSize: 16,
    marginTop: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#333',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '70%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  areaList: {
    flex: 1,
  },
  areaItem: {
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  areaItemText: {
    color: '#fff',
    fontSize: 16,
  }
});

export default WeatherApp;