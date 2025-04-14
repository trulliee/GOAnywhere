import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";

// OpenWeatherMap API Key
const API_KEY = "1c6a0489337511175419c64f0fbba7d1";

// Base API URLs
const CURRENT_WEATHER_URL = "https://api.openweathermap.org/data/2.5/weather";
const FORECAST_URL = "https://api.openweathermap.org/data/2.5/forecast";

const WeatherApp = () => {
  const [location, setLocation] = useState("");
  const [weatherData, setWeatherData] = useState(null);
  const [loading, setLoading] = useState(false);

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
        if (rainVolume > 0 && rainVolume <= 2.5) rainCondition = "🌧️ Light Rain";
        else if (rainVolume > 2.5 && rainVolume <= 7.5) rainCondition = "🌧️ Moderate Rain";
        else if (rainVolume > 7.5) rainCondition = "⛈️ Heavy Rain";

        // Extract upcoming rain forecast (next 3 hours)
        const nextRain = forecastData.list.slice(0, 3).map(entry => entry.rain ? entry.rain["3h"] || 0 : 0);
        const trend = analyzeRainTrend(rainVolume, nextRain);

        setWeatherData({
          city: currentData.name,
          rainCondition,
          rainVolume,
          trend,
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

    if (avgFutureRain > current) return "📈 Increasing Rain";
    if (avgFutureRain < current) return "📉 Decreasing Rain";
    return "➖ Stable Rain Conditions";
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Rain-Focused Weather App</Text>

      {/* User Input for Location */}
      <TextInput
        style={styles.input}
        placeholder="Enter location (e.g., Marina Bay)"
        value={location}
        onChangeText={setLocation}
      />

      {/* Fetch Weather Button */}
      <TouchableOpacity style={styles.button} onPress={() => fetchWeather(location || "Singapore")}>
        <Text style={styles.buttonText}>Check Rain Conditions</Text>
      </TouchableOpacity>

      {/* Loading Indicator */}
      {loading && <ActivityIndicator size="large" color="#007bff" />}

      {/* Display Rain Condition & Trend */}
      {weatherData && (
        <View style={styles.weatherContainer}>
          <Text style={styles.weatherText}>📍 {weatherData.city}</Text>
          <Text style={styles.weatherText}>{weatherData.rainCondition}</Text>
          <Text style={styles.weatherText}>💧 Current Rain: {weatherData.rainVolume} mm</Text>
          <Text style={styles.weatherText}>{weatherData.trend}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#f5f5f5", justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "bold", textAlign: "center", marginBottom: 20 },
  input: { backgroundColor: "white", padding: 10, borderRadius: 8, borderWidth: 1, borderColor: "#ccc", marginBottom: 15 },
  button: { backgroundColor: "#007bff", padding: 15, borderRadius: 8, alignItems: "center" },
  buttonText: { color: "white", fontWeight: "bold", fontSize: 16 },
  weatherContainer: { marginTop: 20, padding: 15, backgroundColor: "#fff", borderRadius: 8, borderWidth: 1, borderColor: "#ddd" },
  weatherText: { fontSize: 18, fontWeight: "bold", textAlign: "center", marginBottom: 5 },
});

export default WeatherApp;
