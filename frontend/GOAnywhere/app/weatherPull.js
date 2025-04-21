import React, { useState, useEffect } from "react";
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator, 
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView
} from "react-native";
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

// OpenWeatherMap API Key
const API_KEY = "1c6a0489337511175419c64f0fbba7d1";

// Base API URLs
const CURRENT_WEATHER_URL = "https://api.openweathermap.org/data/2.5/weather";
const FORECAST_URL = "https://api.openweathermap.org/data/2.5/forecast";

const WeatherApp = () => {
  const router = useRouter();
  const [location, setLocation] = useState("");
  const [weatherData, setWeatherData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Load default Singapore weather on component mount
  useEffect(() => {
    fetchWeather("Singapore");
  }, []);

  // Function to fetch current rain data & rain trend predictions
  const fetchWeather = async (city = "Singapore") => {
    setLoading(true);
    try {
      // Fetch current weather
      const currentResponse = await fetch(`${CURRENT_WEATHER_URL}?q=${city},SG&appid=${API_KEY}&units=metric`);
      const currentData = await currentResponse.json();

      // Fetch forecast data
      const forecastResponse = await fetch(`${FORECAST_URL}?q=${city},SG&appid=${API_KEY}&units=metric`);
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
      } else {
        alert("Location not found. Please enter a valid Singapore location.");
      }
    } catch (error) {
      console.error("Error fetching weather data:", error);
      alert("Failed to fetch weather data.");
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
        {/* Search Bar */}
        <View style={styles.searchBar}>
          <TextInput
            style={styles.input}
            placeholder="Enter location (e.g., Marina Bay)"
            placeholderTextColor="#888"
            value={location}
            onChangeText={setLocation}
          />
          <TouchableOpacity 
            style={styles.searchButton} 
            onPress={() => fetchWeather(location || "Singapore")}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="search" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>

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
        {loading && !weatherData && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#9de3d2" />
            <Text style={styles.loadingText}>Fetching weather data...</Text>
          </View>
        )}
      </ScrollView>
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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  input: {
    flex: 1,
    backgroundColor: '#444',
    color: '#fff',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    marginRight: 10,
  },
  searchButton: {
    backgroundColor: '#9de3d2',
    borderRadius: 10,
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
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
  }
});

export default WeatherApp;