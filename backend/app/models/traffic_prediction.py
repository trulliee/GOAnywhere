import os
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import joblib
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.model_selection import train_test_split
from app.database.firestore_utils import fetch_firestore_data
import logging
import random
import hashlib
import math
import json

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Path to store trained models
MODEL_DIR = os.path.dirname(os.path.abspath(__file__))

# Define model filenames
ROAD_CONDITIONS_MODEL = os.path.join(MODEL_DIR, 'road_conditions_model.joblib')
DELAY_MODEL = os.path.join(MODEL_DIR, 'delay_model.joblib')
WEATHER_CONDITIONS_MODEL = os.path.join(MODEL_DIR, 'weather_conditions_model.joblib')
TRAVEL_TIME_MODEL = os.path.join(MODEL_DIR, 'travel_time_model.joblib')
INCIDENTS_MODEL = os.path.join(MODEL_DIR, 'incidents_model.joblib')

# Flag to control whether to use ML models or fallback to rule-based logic
USE_ML_MODELS = True

# Singapore road names for generating realistic route-specific data
SINGAPORE_ROADS = ["PIE", "CTE", "KPE", "AYE", "BKE", "SLE", "TPE", "ECP", 
                   "Orchard Road", "Bukit Timah Road", "Victoria Street", "Serangoon Road",
                   "Nicoll Highway", "Alexandra Road", "Clementi Road", "Jalan Bukit Merah"]

def get_traffic_weather_prediction(user_type="unregistered", time=None, day=None, location=None, route=None):
    """Get traffic and weather prediction based on user type."""
    predictor = TrafficWeatherPredictor()
    
    # Add explicit logging about the inputs
    logger.info(f"get_traffic_weather_prediction called with: user_type={user_type}, time={time}, day={day}")
    logger.info(f"Location: {location}")
    logger.info(f"Route info: {route}")
    
    # Use current time and day if not provided
    now = datetime.now()
    hour = time if time is not None else now.hour
    day_of_week = day if day is not None else now.weekday()
    
    # Get basic prediction
    basic_pred = predictor.get_basic_prediction(hour, day_of_week, location)
    
    if user_type == "registered":
        logger.info("Generating detailed prediction for registered user")
        
        # Extract route details
        start_location = route.get("start") if route and "start" in route else "Central"
        end_location = route.get("end") if route and "end" in route else location or "Central"
        transport_mode = route.get("transport_mode", "driving") if route else "driving"
        
        logger.info(f"Processing route: {start_location} → {end_location} ({transport_mode})")
        
        # Calculate travel times
        driving_time, public_transport_time = predictor.calculate_route_specific_travel_time(
            start_location, end_location, hour, day_of_week, transport_mode
        )
        
        # Log travel times for debugging
        logger.info(f"Calculated travel times: driving={driving_time}, public_transport={public_transport_time}")

        # Generate road condition probabilities
        road_probs = predictor.calculate_road_conditions_probability(
            start_location, end_location, hour, day_of_week
        )
        
        # Generate alternative routes
        alternatives = predictor.generate_alternative_routes(
            start_location, end_location, driving_time
        )
        logger.info(f"Generated {len(alternatives)} alternative routes")

        # Find relevant incidents
        incident_alerts = []
        incident = predictor.find_route_specific_incident(start_location, end_location)
        if incident:
            incident_alerts.append({
                "type": incident["type"],
                "message": incident["message"],
                "location": {
                    "latitude": incident["latitude"],
                    "longitude": incident["longitude"]
                }
            })
        
        # Generate weather recommendations
        weather_recs = predictor.generate_weather_recommendations(
            basic_pred["weather_condition"], 
            basic_pred["road_condition"]
        )
        logger.info(f"Generated {len(weather_recs)} weather recommendations")

        # Determine general recommendation
        ideal_conditions = (basic_pred["road_condition"] == "Clear" and 
                           basic_pred["possible_delay"] == "No significant delays")
        general_recommendation = "Ideal" if ideal_conditions else "Not Ideal"
        
        # Build the complete prediction response
        prediction = {
            "road_conditions_probability": road_probs,
            "estimated_travel_time": {
                "driving": driving_time,
                "public_transport": public_transport_time
            },
            "alternative_routes": alternatives,
            "incident_alerts": incident_alerts,
            "weather_recommendations": weather_recs,
            "general_travel_recommendation": general_recommendation,
            "road_condition": basic_pred["road_condition"],
            "possible_delay": basic_pred["possible_delay"],
            "weather_condition": basic_pred["weather_condition"]
        }
        
        # Debug the prediction data right before returning
        logger.info(f"FINAL PREDICTION KEYS: {list(prediction.keys())}")
        logger.info(f"Travel times in final prediction: driving={prediction['estimated_travel_time']['driving']}, public={prediction['estimated_travel_time']['public_transport']}")
        logger.info(f"Alternative routes count: {len(prediction['alternative_routes'])}")
        logger.info(f"Weather recommendations count: {len(prediction['weather_recommendations'])}")
        logger.info(f"Road condition probabilities: {json.dumps(prediction['road_conditions_probability'])}")
        
        return prediction
    else:
        # For unregistered users, just return the basic prediction
        logger.info("Returning basic prediction for unregistered user")
        return basic_pred

class TrafficWeatherPredictor:
    def __init__(self):
        """Initialize the predictor with trained models."""
        self.road_conditions_model = None
        self.delay_model = None
        self.weather_conditions_model = None
        self.travel_time_model = None
        self.incidents_model = None
        self.models_loaded = False
        self.load_models()
        
    def load_models(self):
        """Load trained models if they exist, otherwise train new ones."""
        try:
            all_models_exist = all(os.path.exists(model_path) for model_path in [
                ROAD_CONDITIONS_MODEL, DELAY_MODEL, WEATHER_CONDITIONS_MODEL, 
                TRAVEL_TIME_MODEL, INCIDENTS_MODEL
            ])
            
            if all_models_exist:
                self.road_conditions_model = joblib.load(ROAD_CONDITIONS_MODEL)
                self.delay_model = joblib.load(DELAY_MODEL)
                self.weather_conditions_model = joblib.load(WEATHER_CONDITIONS_MODEL)
                self.travel_time_model = joblib.load(TRAVEL_TIME_MODEL)
                self.incidents_model = joblib.load(INCIDENTS_MODEL)
                self.models_loaded = True
                logger.info("All prediction models loaded successfully")
            else:
                logger.warning("Some models are missing. Falling back to rule-based predictions.")
                self.models_loaded = False
                
        except Exception as e:
            logger.error(f"Error loading models: {e}")
            logger.warning("Falling back to rule-based predictions")
            self.models_loaded = False
    
    def fetch_data(self):
        """Fetch data from Firestore."""
        try:
            data = {
                'traffic_speed_bands': fetch_firestore_data('traffic_speed_bands', limit=1000),
                'traffic_incidents': fetch_firestore_data('traffic_incidents', limit=1000),
                'estimated_travel_times': fetch_firestore_data('estimated_travel_times', limit=1000),
                'vms_messages': fetch_firestore_data('vms_messages', limit=1000),
                'weather_data': fetch_firestore_data('weather_data', limit=100),
                'weather_forecast_24hr': fetch_firestore_data('weather_forecast_24hr', limit=100),
                'peak_traffic_conditions': fetch_firestore_data('peak_traffic_conditions', limit=100)
            }
            
            # Check if we have enough data for predictions
            for key, value in data.items():
                logger.info(f"Fetched {len(value)} records for {key}")
                
            return data
        except Exception as e:
            logger.error(f"Error fetching data: {e}")
            return {}
    
    def preprocess_input_for_model(self, time, day, location, start_location=None, end_location=None, transport_mode=None):
        """
        Preprocess input data for model predictions.
        
        Returns:
            pd.DataFrame: Prepared input data for model prediction
        """
        # Current hour and minute
        now = datetime.now()
        hour = time if time is not None else now.hour
        minute = now.minute
        day_of_week = day if day is not None else now.weekday()
        
        # Create a feature dictionary
        features = {
            'hour': hour,
            'minute': minute,
            'day_of_week': day_of_week,
            'is_weekend': 1 if day_of_week >= 5 else 0,
            'is_peak_hour': 1 if ((hour >= 7 and hour <= 9) or (hour >= 17 and hour <= 19)) else 0,
        }
        
        # Add location features if available
        if location:
            # Extract location features - check for high traffic areas
            high_traffic_indicators = ['orchard', 'marina', 'cbd', 'downtown', 'raffles', 'chinatown', 'central']
            medium_traffic_indicators = ['jurong', 'tampines', 'woodlands', 'novena', 'bugis', 'airport']
            
            features['is_high_traffic_area'] = 1 if any(area in location.lower() for area in high_traffic_indicators) else 0
            features['is_medium_traffic_area'] = 1 if any(area in location.lower() for area in medium_traffic_indicators) else 0
        
        # Add route-specific features if available
        if start_location and end_location:
            features['has_route'] = 1
            
            # Create a unique hash for this route
            route_key = f"{start_location.lower()}-{end_location.lower()}"
            route_hash = int(hashlib.md5(route_key.encode()).hexdigest(), 16) % 100
            features['route_hash'] = route_hash
            
            # Check start and end locations for traffic indicators
            features['start_is_high_traffic'] = 1 if any(area in start_location.lower() for area in high_traffic_indicators) else 0
            features['end_is_high_traffic'] = 1 if any(area in end_location.lower() for area in high_traffic_indicators) else 0
            features['start_is_medium_traffic'] = 1 if any(area in start_location.lower() for area in medium_traffic_indicators) else 0
            features['end_is_medium_traffic'] = 1 if any(area in end_location.lower() for area in medium_traffic_indicators) else 0
            
            # Transport mode
            features['is_driving'] = 1 if transport_mode == 'driving' else 0
            features['is_transit'] = 1 if transport_mode == 'transit' else 0
        else:
            features['has_route'] = 0
            features['route_hash'] = 0
            features['start_is_high_traffic'] = 0
            features['end_is_high_traffic'] = 0
            features['start_is_medium_traffic'] = 0
            features['end_is_medium_traffic'] = 0
            features['is_driving'] = 1  # Default to driving
            features['is_transit'] = 0
        
        # Add weather-related features
        try:
            latest_weather = fetch_firestore_data('weather_data', limit=1)
            if latest_weather:
                weather_desc = latest_weather[0].get('weather', '').lower()
                temperature = latest_weather[0].get('temperature', 28)
                humidity = latest_weather[0].get('humidity', 80)
                
                features['temperature'] = temperature
                features['humidity'] = humidity
                features['is_raining'] = 1 if 'rain' in weather_desc or 'drizzle' in weather_desc else 0
                features['is_foggy'] = 1 if 'fog' in weather_desc or 'mist' in weather_desc else 0
                features['is_cloudy'] = 1 if 'cloud' in weather_desc else 0
                features['is_thunderstorm'] = 1 if 'thunder' in weather_desc or 'storm' in weather_desc else 0
            else:
                # Default values if no weather data
                features['temperature'] = 28
                features['humidity'] = 80
                features['is_raining'] = 0
                features['is_foggy'] = 0
                features['is_cloudy'] = 0
                features['is_thunderstorm'] = 0
        except Exception as e:
            logger.error(f"Error fetching weather data: {e}")
            # Default values on error
            features['temperature'] = 28
            features['humidity'] = 80
            features['is_raining'] = 0
            features['is_foggy'] = 0
            features['is_cloudy'] = 0
            features['is_thunderstorm'] = 0
        
        # Convert to DataFrame for model input
        return pd.DataFrame([features])
    
    def get_basic_prediction(self, time=None, day=None, location=None):
        """
        Generate basic prediction for unregistered users.
        
        Args:
            time (int, optional): Hour of the day (0-23)
            day (int, optional): Day of the week (0=Monday, 6=Sunday)
            location (str, optional): Destination location name or coordinates
            
        Returns:
            dict: Prediction results including road conditions, possible delays, and weather conditions
        """
        # Use current time and day if not provided
        now = datetime.now()
        hour = time if time is not None else now.hour
        day_of_week = day if day is not None else now.weekday()
        is_weekend = 1 if day_of_week >= 5 else 0
        
        logger.info(f"Basic prediction requested: time={hour}, day={day_of_week}, location='{location}'")
        
        # Check if we should use ML models
        if USE_ML_MODELS and self.models_loaded:
            try:
                # Prepare input data for models
                input_data = self.preprocess_input_for_model(hour, day_of_week, location)
                
                # Predict road conditions using model
                road_condition_pred = self.road_conditions_model.predict(input_data)[0]
                
                # Predict possible delays using model
                delay_pred = self.delay_model.predict(input_data)[0]
                possible_delay = "Possible delays" if delay_pred == 1 else "No significant delays"
                
                # Predict weather conditions using model
                weather_condition_pred = self.weather_conditions_model.predict(input_data)[0]
                
                logger.info(f"Used ML models for basic prediction - Road: {road_condition_pred}, Delay: {delay_pred}, Weather: {weather_condition_pred}")
                
                return {
                    "road_condition": road_condition_pred,
                    "possible_delay": possible_delay,
                    "weather_condition": weather_condition_pred
                }
            except Exception as e:
                logger.error(f"Error using ML models for basic prediction: {e}")
                logger.info("Falling back to rule-based prediction")
                # Fall back to rule-based prediction on error
        
        # Default values for rule-based prediction
        road_condition = "Clear"
        possible_delay = "No significant delays"
        weather_condition = "Partly Cloudy"
        
        # Fetch latest data from Firestore
        latest_incidents = fetch_firestore_data('traffic_incidents', limit=5)
        latest_weather = fetch_firestore_data('weather_data', limit=1)
        
        # Determine road condition based on time and location
        if (hour >= 7 and hour <= 9) or (hour >= 17 and hour <= 19):
            if not is_weekend:
                road_condition = "Moderate"
                # Check for high-traffic areas
                high_traffic_areas = ['orchard', 'marina', 'cbd', 'downtown', 'raffles']
                if location and any(area in location.lower() for area in high_traffic_areas):
                    road_condition = "Congested"
                    possible_delay = "Possible delays"
        
        # Determine weather condition from actual data if available
        if latest_weather:
            weather_desc = latest_weather[0].get('weather', '').lower()
            if 'rain' in weather_desc or 'drizzle' in weather_desc:
                weather_condition = "Rain"
            elif 'fog' in weather_desc or 'mist' in weather_desc:
                weather_condition = "Fog"
            elif 'cloud' in weather_desc:
                weather_condition = "Cloudy"
            elif 'thunder' in weather_desc or 'storm' in weather_desc:
                weather_condition = "Thunderstorm"
            else:
                weather_condition = "Clear"
        
        logger.info(f"Rule-based basic prediction - Road: {road_condition}, Delay: {possible_delay}, Weather: {weather_condition}")
        
        # Return basic prediction
        return {
            "road_condition": road_condition,
            "possible_delay": possible_delay,
            "weather_condition": weather_condition
        }

    def calculate_route_specific_travel_time(self, start_location, end_location, hour, day_of_week, transport_mode="driving"):
        """
        Calculate route-specific travel time based on locations and time.
        
        Args:
            start_location (str): Starting location
            end_location (str): Ending location
            hour (int): Hour of the day (0-23)
            day_of_week (int): Day of the week (0=Monday, 6=Sunday)
            transport_mode (str): 'driving' or 'transit'
            
        Returns:
            tuple: (driving_time, public_transport_time)
        """
        logger.info(f"Starting travel time calculation for route: {start_location} → {end_location}")
        
        # Check if we should use ML model for travel time prediction
        if USE_ML_MODELS and self.models_loaded and self.travel_time_model is not None:
            try:
                # Prepare input features for model
                input_data = self.preprocess_input_for_model(
                    hour, day_of_week, None, 
                    start_location=start_location, 
                    end_location=end_location, 
                    transport_mode=transport_mode
                )
                
                # Predict driving time using model
                driving_time = max(10, round(self.travel_time_model.predict(input_data)[0]))
                
                # Calculate public transport time based on driving time
                # (We could have a separate model for this in the future)
                if transport_mode == 'transit':
                    public_transport_time = max(15, round(driving_time * 1.3 + 10))
                else:
                    public_transport_time = max(15, round(driving_time * 1.3 + 10))
                
                logger.info(f"ML model predicted travel times - Driving: {driving_time} min, Public: {public_transport_time} min")
                
                return driving_time, public_transport_time
            except Exception as e:
                logger.error(f"Error using travel time model: {e}")
                logger.info("Falling back to rule-based travel time calculation")
        
        # Fallback to rule-based calculation
        # Create a unique identifier for this route combination
        route_key = f"{start_location.lower()}-{end_location.lower()}"
        
        # Base travel time calculation (approximately 15-25 minutes for average routes)
        base_time = 15  # Default base time in minutes
        
        # Add variation based on location names
        start_len = len(start_location) if start_location else 0
        end_len = len(end_location) if end_location else 0
        base_time += (start_len + end_len) / 4
        
        # Create a deterministic but unique time for each route
        route_hash = int(hashlib.md5(route_key.encode()).hexdigest(), 16) % 100
        base_time = base_time * (0.9 + (route_hash % 20) / 100)
        
        # Apply location-specific factors
        traffic_factor = 1.0
        
        # High traffic keywords that might appear in location names
        high_traffic_indicators = ['orchard', 'marina', 'cbd', 'downtown', 'raffles', 'chinatown', 'central']
        medium_traffic_indicators = ['jurong', 'tampines', 'woodlands', 'novena', 'bugis', 'airport']
        
        # Check if locations contain high traffic keywords
        for keyword in high_traffic_indicators:
            if (start_location and keyword in start_location.lower()) or (end_location and keyword in end_location.lower()):
                traffic_factor = 1.3
                break
                
        # If not high traffic, check for medium traffic
        if traffic_factor == 1.0:
            for keyword in medium_traffic_indicators:
                if (start_location and keyword in start_location.lower()) or (end_location and keyword in end_location.lower()):
                    traffic_factor = 1.15
                    break
        
        # Time-based factors - common traffic patterns
        time_factor = 1.0
        
        # Peak hours (7-9 AM, 5-7 PM on weekdays)
        if day_of_week < 5:  # Weekdays
            if (hour >= 7 and hour <= 9) or (hour >= 17 and hour <= 19):
                time_factor = 1.5  # 50% slower during peak hours
        
        # Weekend factor
        weekend_factor = 0.85 if day_of_week >= 5 else 1.0  # 15% faster on weekends
        
        # Late night factor (11 PM - 6 AM)
        if hour >= 23 or hour <= 6:
            time_factor = 0.7  # 30% faster during late night
        
        # Calculate final driving time
        driving_time = base_time * traffic_factor * time_factor * weekend_factor
        
        # Ensure minimum driving time and round to integer
        driving_time = max(10, round(driving_time))
        
        logger.info(f"Calculated base driving time: {driving_time} min")
        
        # Calculate public transport time
        if transport_mode == 'transit':
            # Public transport is generally slower but less affected by traffic
            public_transport_time = driving_time * 1.4
            
            # Add fixed time for waiting and transfers
            public_transport_time += 10
        else:
            # Calculate anyway for the prediction
            public_transport_time = driving_time * 1.4 + 10
        
        # Ensure minimum public transport time
        public_transport_time = max(15, round(public_transport_time))

        logger.info(f"Rule-based travel times - Driving: {driving_time} min, Public: {public_transport_time} min")
        
        return driving_time, public_transport_time

    def generate_alternative_routes(self, start, end, primary_time):
        """
        Generate alternative routes based on the primary route's travel time.
        
        Args:
            start (str): Starting location
            end (str): Ending location
            primary_time (float): Primary route travel time in minutes
            
        Returns:
            list: Alternative routes with estimated times
        """
        logger.info(f"Generating alternative routes from {start} to {end} (primary time: {primary_time} min)")

        if not start or not end or primary_time <= 0:
            logger.warning(f"Invalid inputs for alternative routes: start={start}, end={end}, primary_time={primary_time}")
            # Default safe alternatives
            return [
                {
                    "name": "Recommended Route",
                    "estimated_time": 15,
                    "description": "Optimal standard route"
                },
                {
                    "name": "Backup Route",
                    "estimated_time": 18,
                    "description": "Secondary route with steady traffic flow"
                }
            ]

        # Create a unique hash for this route to ensure consistent recommendations
        route_key = f"{start.lower()}-{end.lower()}"
        route_hash = int(hashlib.md5(route_key.encode()).hexdigest(), 16) % 100
        
        # Different time saving factors for different routes
        time_factor1 = 0.85 + (route_hash % 10) / 100  # 0.85-0.95
        time_factor2 = 0.95 + (route_hash % 15) / 100  # 0.95-1.10
        
        # Pick two unique road names for the alternatives
        road_index1 = route_hash % len(SINGAPORE_ROADS)
        road_index2 = (route_hash + 3) % len(SINGAPORE_ROADS)
        
        # Create alternative routes with proper time calculations
        alternatives = [
            {
                "name": f"Alternative Route via {SINGAPORE_ROADS[road_index1]}", 
                "estimated_time": round(primary_time * time_factor1),
                "description": "Via less congested roads"
            },
            {
                "name": f"Scenic Route via {SINGAPORE_ROADS[road_index2]}", 
                "estimated_time": round(primary_time * time_factor2),
                "description": "Slightly longer but steadier traffic flow"
            }
        ]
        
        logger.info(f"Generated alternative routes: {alternatives}")
        return alternatives

    def find_route_specific_incident(self, start_location, end_location):
        """Find incidents relevant to the specific route."""
        # Check if we should use ML model for incident prediction
        if USE_ML_MODELS and self.models_loaded and self.incidents_model is not None:
            try:
                # Prepare input data for model
                input_data = self.preprocess_input_for_model(
                    None, None, None, 
                    start_location=start_location, 
                    end_location=end_location
                )
                
                # Predict if there's an incident using model
                incident_probability = self.incidents_model.predict_proba(input_data)[0][1]
                
                if incident_probability < 0.3:
                    # Low probability of incident
                    logger.info(f"ML model predicts low incident probability ({incident_probability:.2f}), no incidents to report")
                    return None
                
                # If we predict an incident, still use Firestore data or generate one
                logger.info(f"ML model predicts incident probability: {incident_probability:.2f}")
            
            except Exception as e:
                logger.error(f"Error using incidents model: {e}")
        
        # Fetch incidents from Firestore
        incidents = fetch_firestore_data('traffic_incidents', limit=5)
        
        # If real incidents exist, use those
        if incidents:
            # Sort incidents by relevance (for now randomly pick one)
            import random
            incident = random.choice(incidents)
            return {
                "type": incident.get("Type", "Incident"),
                "message": incident.get("Message", ""),
                "latitude": incident.get("Latitude", 1.3521),
                "longitude": incident.get("Longitude", 103.8198)
            }
        
        # If no incidents available, create a route-specific fictitious incident
        # Create a hash of the route to ensure consistent but different incidents
        route_key = f"{start_location.lower()}-{end_location.lower()}"
        route_hash = int(hashlib.md5(route_key.encode()).hexdigest(), 16)
            
        # Different incident types based on route hash
        incident_types = ["Accident", "Roadwork", "Heavy Traffic", "Vehicle Breakdown"]
        incident_type = incident_types[route_hash % len(incident_types)]
            
        # Different locations based on the route
        if route_hash % 2 == 0:
            location_ref = start_location
            # Singapore coordinates range approximately
            lat = 1.3 + (route_hash % 100) / 1000
            lng = 103.8 + (route_hash % 100) / 1000
        else:
            location_ref = end_location
            lat = 1.3 + ((route_hash + 50) % 100) / 1000
            lng = 103.8 + ((route_hash + 50) % 100) / 1000
            
        # Create a message that's specific to the route
        messages = [
            f"({datetime.now().strftime('%d/%m')}) {incident_type} reported near {location_ref}.",
            f"({datetime.now().strftime('%d/%m')}) {incident_type} on roads leading to {location_ref}.",
            f"({datetime.now().strftime('%d/%m')}) Expect delays due to {incident_type.lower()} near {location_ref}."
        ]
        message = messages[route_hash % len(messages)]
            
        return {
            "type": incident_type,
            "message": message,
            "latitude": lat,
            "longitude": lng
        }

    def generate_weather_recommendations(self, weather_condition, road_condition):
        """Generate weather-based recommendations for drivers."""
        logger.info(f"Generating weather recommendations for: weather={weather_condition}, road={road_condition}")
        recommendations = []

        # Handle unknown or missing weather conditions upfront
        if not weather_condition or weather_condition == "Unknown":
            recommendations.append("Regular driving conditions apply.")
            recommendations.append("Stay hydrated and use sun protection if driving for long periods.")
        else:
            # Weather-specific recommendations
            if "Rain" in weather_condition:
                recommendations.append("Expect slower traffic due to rain. Allow extra travel time.")
                if road_condition == "Congested":
                    recommendations.append("Consider postponing non-essential travel due to rain and congestion.")
                recommendations.append("Drive slower than usual and leave more distance between vehicles.")
            elif "Fog" in weather_condition:
                recommendations.append("Reduced visibility due to fog. Drive with caution and use low-beam headlights.")
                recommendations.append("Avoid sudden lane changes and maintain a safe following distance.")
            elif "Thunder" in weather_condition or "Storm" in weather_condition:
                recommendations.append("Severe weather conditions. Consider postponing travel if possible.")
                recommendations.append("If you must travel, avoid flood-prone areas and stay clear of trees and power lines.")
            elif "Cloud" in weather_condition or "Partly" in weather_condition:
                recommendations.append("Weather is cloudy but visibility is good. No special precautions needed.")
            else:
                # Default recommendations for clear or other conditions
                recommendations.append("Regular driving conditions apply.")
                recommendations.append("Stay hydrated and use sun protection if driving for long periods.")

        # Road condition-based additions
        if road_condition == "Congested":
            recommendations.append("Expect significant delays due to congestion. Consider alternative routes.")
        elif road_condition == "Moderate":
            recommendations.append("Moderate traffic expected. Allow extra time for your journey.")

        # Return recommendations (limit to 3 to avoid overwhelming the user)
        if len(recommendations) > 3:
            return recommendations[:3]
        return recommendations

    def calculate_road_conditions_probability(self, start_location, end_location, hour, day_of_week):
        """
        Calculate the probabilities of different road conditions.
        
        Args:
            start_location (str): Starting location
            end_location (str): Ending location
            hour (int): Hour of the day (0-23)
            day_of_week (int): Day of the week (0=Monday, 6=Sunday)
            
        Returns:
            dict: Probabilities for Congested, Moderate, and Clear road conditions
        """
        # Check if we should use ML model for road condition probability prediction
        if USE_ML_MODELS and self.models_loaded and self.road_conditions_model is not None:
            try:
                # Prepare input data for model
                input_data = self.preprocess_input_for_model(
                    hour, day_of_week, None, 
                    start_location=start_location, 
                    end_location=end_location
                )
                
                # If the model can predict probabilities, use them
                if hasattr(self.road_conditions_model, 'predict_proba'):
                    proba = self.road_conditions_model.predict_proba(input_data)[0]
                    
                    # Map probabilities to road conditions
                    # Assuming the model has 3 classes: [Clear, Moderate, Congested]
                    road_conditions = ["Clear", "Moderate", "Congested"]
                    probabilities = {cond: round(prob * 100) for cond, prob in zip(road_conditions, proba)}
                    
                    logger.info(f"ML model predicted road condition probabilities: {probabilities}")
                    return probabilities
                
            except Exception as e:
                logger.error(f"Error using road conditions model for probabilities: {e}")
                logger.info("Falling back to rule-based probability calculation")
        
        # Fallback to rule-based calculation
        # Create a deterministic hash for this route combination
        route_key = f"{start_location.lower()}-{end_location.lower()}"
        route_hash = int(hashlib.md5(route_key.encode()).hexdigest(), 16) % 100
        
        # Base congestion varies by route (5-25%)
        base_congestion = 5 + (route_hash % 20)
        
        # Adjust for peak hours
        is_peak_hour = (hour >= 7 and hour <= 9) or (hour >= 17 and hour <= 19)
        if is_peak_hour and day_of_week < 5:  # Weekday peak
            base_congestion += 20
        
        # Adjust for location keywords
        high_traffic_areas = ['orchard', 'marina', 'cbd', 'downtown', 'raffles']
        for area in high_traffic_areas:
            if (start_location and area in start_location.lower()) or (end_location and area in end_location.lower()):
                base_congestion += 15
                break
        
        # Cap at 75%
        base_congestion = min(base_congestion, 75)
        
        # Calculate remaining percentages
        remaining = 100 - base_congestion
        moderate = min(remaining * 2 // 3, 50)  # Allocate about 2/3 of remaining to moderate
        clear = 100 - base_congestion - moderate
        
        return {
            "Congested": base_congestion,
            "Moderate": moderate,
            "Clear": clear
        }