# models/traffic_prediction.py
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional, Union, Any
import pickle
import os
import logging
from geopy.distance import geodesic
import joblib
from sklearn.ensemble import RandomForestClassifier, GradientBoostingRegressor, RandomForestRegressor
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, mean_absolute_error

# Import TensorFlow for deep learning models
import tensorflow as tf
from tensorflow.keras.models import Sequential, load_model, save_model
from tensorflow.keras.layers import Dense, Dropout, BatchNormalization
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.callbacks import EarlyStopping

# Optional XGBoost for comparison
import xgboost as xgb
from firebase_admin import firestore

# Set up logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Model paths
MODEL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "trained_models")
os.makedirs(MODEL_DIR, exist_ok=True)

# Define paths for different model types
# TensorFlow models
TF_ROAD_CONDITION_MODEL_PATH = os.path.join(MODEL_DIR, "tf_road_condition_model")
TF_DELAY_MODEL_PATH = os.path.join(MODEL_DIR, "tf_delay_model")
TF_TRAVEL_TIME_MODEL_PATH = os.path.join(MODEL_DIR, "tf_travel_time_model")

# Traditional ML models (backup/comparison)
ROAD_CONDITION_MODEL_PATH = os.path.join(MODEL_DIR, "road_condition_model.pkl")
DELAY_MODEL_PATH = os.path.join(MODEL_DIR, "delay_model.pkl")
TRAVEL_TIME_MODEL_PATH = os.path.join(MODEL_DIR, "travel_time_model.pkl")
TRANSFORMER_PATH = os.path.join(MODEL_DIR, "feature_transformer.pkl")

# Firestore client
db = firestore.client()

class TrafficPredictionModel:
    """
    Traffic prediction model that handles data processing, model training,
    and generating predictions for both registered and unregistered users.
    Uses TensorFlow for primary models and traditional ML as backup.
    """
    
    def __init__(self):
        # TensorFlow models
        self.tf_road_condition_model = None
        self.tf_delay_model = None
        self.tf_travel_time_model = None
        
        # Traditional ML models (backup)
        self.road_condition_model = None  # Classifier for road conditions
        self.delay_model = None  # Binary classifier for possible delays
        self.travel_time_model = None  # Regressor for estimated travel time
        
        self.feature_transformer = None  # For preprocessing features
        
        # Weather mapping for responses
        self.weather_mapping = {
            "clear sky": "Clear",
            "few clouds": "Clear",
            "scattered clouds": "Clear",
            "broken clouds": "Clear",
            "overcast clouds": "Clear",
            "light rain": "Rain",
            "moderate rain": "Rain", 
            "heavy rain": "Rain",
            "thunderstorm": "Rain",
            "mist": "Fog",
            "fog": "Fog",
            "haze": "Fog"
        }
        
        # Road condition classes for model output
        self.road_conditions = ['Clear', 'Moderate', 'Congested']
        
        # Load models on initialization
        self.load_models()
    
    def load_models(self):
        """Load trained models if they exist, prioritizing TensorFlow models"""
        try:
            # Try to load TensorFlow models first
            if os.path.exists(TF_ROAD_CONDITION_MODEL_PATH):
                self.tf_road_condition_model = tf.keras.models.load_model(TF_ROAD_CONDITION_MODEL_PATH)
                logger.info("TensorFlow road condition model loaded successfully")
            
            if os.path.exists(TF_DELAY_MODEL_PATH):
                self.tf_delay_model = tf.keras.models.load_model(TF_DELAY_MODEL_PATH)
                logger.info("TensorFlow delay model loaded successfully")
            
            if os.path.exists(TF_TRAVEL_TIME_MODEL_PATH):
                self.tf_travel_time_model = tf.keras.models.load_model(TF_TRAVEL_TIME_MODEL_PATH)
                logger.info("TensorFlow travel time model loaded successfully")
            
            # Load traditional ML models as backup
            if os.path.exists(ROAD_CONDITION_MODEL_PATH):
                self.road_condition_model = joblib.load(ROAD_CONDITION_MODEL_PATH)
                logger.info("Traditional road condition model loaded as backup")
            
            if os.path.exists(DELAY_MODEL_PATH):
                self.delay_model = joblib.load(DELAY_MODEL_PATH)
                logger.info("Traditional delay model loaded as backup")
            
            if os.path.exists(TRAVEL_TIME_MODEL_PATH):
                self.travel_time_model = joblib.load(TRAVEL_TIME_MODEL_PATH)
                logger.info("Traditional travel time model loaded as backup")
            
            # Load feature transformer
            if os.path.exists(TRANSFORMER_PATH):
                self.feature_transformer = joblib.load(TRANSFORMER_PATH)
                logger.info("Feature transformer loaded successfully")
                
        except Exception as e:
            logger.error(f"Error loading models: {e}")
    
    async def get_prediction(self, 
                      start_location: Dict[str, float], 
                      destination_location: Dict[str, float], 
                      mode_of_transport: str, 
                      travel_time: Optional[datetime] = None,
                      user_type: str = "unregistered") -> Dict[str, Any]:
        """
        Generate traffic prediction based on user inputs
        
        Args:
            start_location: Dictionary with lat/long of starting point
            destination_location: Dictionary with lat/long of destination
            mode_of_transport: 'driving' or 'public_transport'
            travel_time: Datetime for future prediction (default: current time)
            user_type: 'registered' or 'unregistered'
            
        Returns:
            Dictionary with prediction results
        """
        if travel_time is None:
            travel_time = datetime.now()
            
        # Gather all relevant data for prediction
        features = await self._prepare_features(
            start_location, 
            destination_location, 
            mode_of_transport, 
            travel_time
        )
        
        # Make prediction based on user type
        if user_type == "unregistered":
            return await self._basic_prediction(features)
        else:
            return await self._detailed_prediction(features, start_location, destination_location, mode_of_transport)
    
    async def _prepare_features(self, 
                        start_location: Dict[str, float], 
                        destination_location: Dict[str, float], 
                        mode_of_transport: str, 
                        travel_time: datetime) -> pd.DataFrame:
        """Prepare features for model input"""
        # Calculate direct distance
        start_coords = (start_location.get('latitude', 0), start_location.get('longitude', 0))
        dest_coords = (destination_location.get('latitude', 0), destination_location.get('longitude', 0))
        distance_km = geodesic(start_coords, dest_coords).kilometers
        
        # Extract time features
        hour_of_day = travel_time.hour
        day_of_week = travel_time.weekday()
        is_weekend = 1 if day_of_week >= 5 else 0
        is_peak_morning = 1 if 7 <= hour_of_day <= 9 else 0
        is_peak_evening = 1 if 17 <= hour_of_day <= 19 else 0
        
        # Check if travel date is public holiday
        is_public_holiday = await self._check_if_public_holiday(travel_time.date())
        
        # Get weather forecast for travel time
        weather_data = await self._get_weather_forecast(travel_time)
        rain_forecast = 1 if weather_data.get('weather', '').lower() in ['rain', 'light rain', 'heavy rain', 'thunderstorm'] else 0
        fog_forecast = 1 if weather_data.get('weather', '').lower() in ['fog', 'mist', 'haze'] else 0
        
        # Get traffic incidents along route
        incidents_count = await self._count_incidents_on_route(start_coords, dest_coords)
        
        # Get average speed band for current time and route
        avg_speed_band = await self._get_average_speed_band(start_coords, dest_coords)
        
        # Create feature dictionary
        feature_dict = {
            'distance_km': distance_km,
            'hour_of_day': hour_of_day,
            'day_of_week': day_of_week,
            'is_weekend': is_weekend,
            'is_peak_morning': is_peak_morning,
            'is_peak_evening': is_peak_evening,
            'is_public_holiday': is_public_holiday,
            'rain_forecast': rain_forecast,
            'fog_forecast': fog_forecast,
            'incidents_count': incidents_count,
            'avg_speed_band': avg_speed_band,
            'mode_of_transport': mode_of_transport
        }
        
        # Convert to DataFrame
        features = pd.DataFrame([feature_dict])
        
        # If transformer exists, apply it
        if self.feature_transformer:
            try:
                # Apply only to features that exist in the transformer
                features_transformed = self.feature_transformer.transform(features)
                return features_transformed
            except Exception as e:
                logger.error(f"Error transforming features: {e}")
        
        return features
    
    async def _basic_prediction(self, features: pd.DataFrame) -> Dict[str, Any]:
        """Generate basic prediction for unregistered users"""
        result = {
            "road_conditions": "Moderate",  # Default if model not loaded
            "possible_delays": "No",
            "weather_conditions": "Clear"
        }
        
        try:
            # First try using TensorFlow models if available
            if self.tf_road_condition_model:
                # For TensorFlow model, we need to prepare the input differently
                if isinstance(features, pd.DataFrame):
                    # Get numeric features for TF model
                    # For simplicity, we'll just use the numeric features for TF prediction
                    numeric_features = features[['distance_km', 'hour_of_day', 'day_of_week', 
                                                'is_weekend', 'is_peak_morning', 'is_peak_evening', 
                                                'is_public_holiday', 'rain_forecast', 'fog_forecast',
                                                'incidents_count', 'avg_speed_band']].values
                    mode_feature = 1 if features['mode_of_transport'].iloc[0] == 'driving' else 0
                    tf_input = np.column_stack([numeric_features, np.array([[mode_feature]])])
                else:
                    # If already transformed, need to reshape for TF model
                    tf_input = features
                
                # Get road condition prediction from TF model
                road_probs = self.tf_road_condition_model.predict(tf_input)[0]
                road_index = np.argmax(road_probs)
                result["road_conditions"] = self.road_conditions[road_index]
                
                # Get delay prediction from TF model if available
                if self.tf_delay_model:
                    delay_prob = self.tf_delay_model.predict(tf_input)[0][0]
                    result["possible_delays"] = "Yes" if delay_prob > 0.5 else "No"
            
            # Fall back to traditional ML models if TF models aren't available
            elif self.road_condition_model:
                road_condition_pred = self.road_condition_model.predict(features)[0]
                result["road_conditions"] = road_condition_pred
                
                # Predict possible delays if model is loaded
                if self.delay_model:
                    delay_prob = self.delay_model.predict_proba(features)[0][1]  # Probability of delay
                    result["possible_delays"] = "Yes" if delay_prob > 0.5 else "No"
            
            # Get weather from features (same for both model types)
            if features[0]['rain_forecast'] == 1:
                result["weather_conditions"] = "Rain"
            elif features[0]['fog_forecast'] == 1:
                result["weather_conditions"] = "Fog"
                
        except Exception as e:
            logger.error(f"Error making basic prediction: {e}")
            
        return result
    
    async def _detailed_prediction(self, 
                           features: pd.DataFrame, 
                           start_location: Dict[str, float], 
                           destination_location: Dict[str, float],
                           mode_of_transport: str) -> Dict[str, Any]:
        """Generate detailed prediction for registered users"""
        # Start with the basic prediction
        basic_result = await self._basic_prediction(features)
        
        result = {
            "road_conditions": basic_result["road_conditions"],
            "weather_conditions": basic_result["weather_conditions"],
            "road_conditions_probability": {
                "Clear": 0.1,
                "Moderate": 0.2,
                "Congested": 0.7
            },
            "estimated_travel_time": 25,  # Default in minutes
            "possible_delays": basic_result["possible_delays"],
            "general_travel_recommendation": "Not Ideal",
            "incident_alerts": [],
            "weather_based_recommendations": [],
            "alternative_routes": []
        }
        
        try:
            # Prepare input for TF models if needed
            if isinstance(features, pd.DataFrame):
                # Get numeric features for TF model
                numeric_features = features[['distance_km', 'hour_of_day', 'day_of_week', 
                                           'is_weekend', 'is_peak_morning', 'is_peak_evening', 
                                           'is_public_holiday', 'rain_forecast', 'fog_forecast',
                                           'incidents_count', 'avg_speed_band']].values
                mode_feature = 1 if features['mode_of_transport'].iloc[0] == 'driving' else 0
                tf_input = np.column_stack([numeric_features, np.array([[mode_feature]])])
            else:
                # If already transformed, use as is for TF model
                tf_input = features
            
            # Get probabilities for road conditions
            if self.tf_road_condition_model:
                # For TensorFlow multiclass model
                probs = self.tf_road_condition_model.predict(tf_input)[0]
                result["road_conditions_probability"] = {
                    cond: round(prob * 100, 1) for cond, prob in zip(self.road_conditions, probs)
                }
            elif self.road_condition_model:
                # For traditional ML model
                probs = self.road_condition_model.predict_proba(features)[0]
                classes = self.road_condition_model.classes_
                
                result["road_conditions_probability"] = {
                    cls: round(prob * 100, 1) for cls, prob in zip(classes, probs)
                }
            
            # Predict travel time
            if self.tf_travel_time_model:
                # For TensorFlow regression model
                predicted_time = self.tf_travel_time_model.predict(tf_input)[0][0]
                result["estimated_travel_time"] = round(predicted_time, 1)
            elif self.travel_time_model:
                # For traditional ML model
                predicted_time = self.travel_time_model.predict(features)[0]
                result["estimated_travel_time"] = round(predicted_time, 1)
            else:
                # Fallback calculation based on distance and assumed speed
                distance_km = features[0]['distance_km']
                avg_speed = 40 if features[0]['avg_speed_band'] <= 2 else 25 if features[0]['avg_speed_band'] <= 3 else 15
                result["estimated_travel_time"] = round((distance_km / avg_speed) * 60, 1)  # Convert to minutes
            
            # Get incident alerts
            incident_alerts = await self._get_incidents_on_route(
                (start_location.get('latitude', 0), start_location.get('longitude', 0)),
                (destination_location.get('latitude', 0), destination_location.get('longitude', 0))
            )
            result["incident_alerts"] = incident_alerts
            
            # Generate weather-based recommendations
            weather_recommendations = await self._generate_weather_recommendations(
                basic_result["weather_conditions"],
                mode_of_transport
            )
            result["weather_based_recommendations"] = weather_recommendations
            
            # Generate travel recommendation
            result["general_travel_recommendation"] = "Not Ideal" if (
                result["road_conditions"] == "Congested" or
                result["possible_delays"] == "Yes" or
                len(incident_alerts) > 0 or
                basic_result["weather_conditions"] in ["Rain", "Fog"]
            ) else "Ideal"
            
            # Generate alternative routes (simplified version)
            result["alternative_routes"] = await self._generate_alternative_routes(
                start_location,
                destination_location,
                mode_of_transport
            )
            
        except Exception as e:
            logger.error(f"Error making detailed prediction: {e}")
            
        return result
    
    async def _check_if_public_holiday(self, date: datetime.date) -> int:
        """Check if a date is a public holiday"""
        try:
            # Query Firestore for public holidays
            public_holidays_ref = db.collection('public_holidays_2025')
            query = public_holidays_ref.where('date', '==', date.strftime('%Y-%m-%d')).limit(1)
            docs = query.stream()
            
            # If any document exists, it's a holiday
            return 1 if any(docs) else 0
            
        except Exception as e:
            logger.error(f"Error checking public holiday: {e}")
            return 0
    
    async def _get_weather_forecast(self, prediction_time: datetime) -> Dict[str, Any]:
        """Get weather forecast for prediction time"""
        try:
            # Get current weather data if prediction time is within 24 hours
            time_diff = prediction_time - datetime.now()
            
            if time_diff.total_seconds() < 24 * 60 * 60:
                # Query the most recent weather forecast
                forecast_ref = db.collection('weather_forecast_24hr')
                query = forecast_ref.order_by('stored_at', direction=firestore.Query.DESCENDING).limit(1)
                docs = query.stream()
                
                for doc in docs:
                    forecast = doc.to_dict()
                    
                    # Find the relevant forecast period
                    if 'regions' in forecast:
                        # Simplification: just return the central region forecast
                        central_forecast = forecast.get('regions', {}).get('central', '')
                        return {
                            "temperature": forecast.get('temperature', {}).get('high', 30),
                            "humidity": forecast.get('relative_humidity', {}).get('high', 85),
                            "weather": central_forecast
                        }
            
            # Fallback to historical averages for the time of year
            return {
                "temperature": 30,
                "humidity": 80,
                "weather": "clear sky"
            }
            
        except Exception as e:
            logger.error(f"Error getting weather forecast: {e}")
            return {"temperature": 30, "humidity": 80, "weather": "clear sky"}
    
    async def _count_incidents_on_route(self, start_coords: Tuple[float, float], 
                                dest_coords: Tuple[float, float]) -> int:
        """Count traffic incidents along the route"""
        try:
            # Query recent traffic incidents
            incidents_ref = db.collection('traffic_incidents')
            query = incidents_ref.order_by('Timestamp', direction=firestore.Query.DESCENDING).limit(50)
            docs = query.stream()
            
            incidents_count = 0
            
            # Calculate midpoint and max distance
            mid_lat = (start_coords[0] + dest_coords[0]) / 2
            mid_lon = (start_coords[1] + dest_coords[1]) / 2
            route_distance = geodesic(start_coords, dest_coords).kilometers
            
            # Buffer around the route (in km)
            buffer_distance = max(1.0, route_distance * 0.2)  # At least 1km or 20% of route distance
            
            for doc in docs:
                incident = doc.to_dict()
                
                # Check if incident is near the route
                incident_coords = (incident.get('Latitude', 0), incident.get('Longitude', 0))
                
                # Simple check - is the incident within buffer distance of the midpoint?
                distance_to_mid = geodesic((mid_lat, mid_lon), incident_coords).kilometers
                
                if distance_to_mid <= buffer_distance:
                    incidents_count += 1
            
            return incidents_count
            
        except Exception as e:
            logger.error(f"Error counting incidents on route: {e}")
            return 0
    
    async def _get_average_speed_band(self, start_coords: Tuple[float, float], 
                              dest_coords: Tuple[float, float]) -> float:
        """Get average speed band for the route"""
        try:
            # Query recent speed bands
            speed_bands_ref = db.collection('traffic_speed_bands')
            query = speed_bands_ref.order_by('Timestamp', direction=firestore.Query.DESCENDING).limit(100)
            docs = query.stream()
            
            relevant_bands = []
            
            # Calculate midpoint and max distance
            mid_lat = (start_coords[0] + dest_coords[0]) / 2
            mid_lon = (start_coords[1] + dest_coords[1]) / 2
            route_distance = geodesic(start_coords, dest_coords).kilometers
            
            # Buffer around the route (in km)
            buffer_distance = max(2.0, route_distance * 0.3)  # At least 2km or 30% of route distance
            
            for doc in docs:
                speed_band = doc.to_dict()
                
                # Check if road segment is near the route
                start_segment = (speed_band.get('StartLatitude', 0), speed_band.get('StartLongitude', 0))
                end_segment = (speed_band.get('EndLatitude', 0), speed_band.get('EndLongitude', 0))
                
                # Check if either end of the road segment is within buffer distance of the midpoint
                start_distance = geodesic((mid_lat, mid_lon), start_segment).kilometers
                end_distance = geodesic((mid_lat, mid_lon), end_segment).kilometers
                
                if start_distance <= buffer_distance or end_distance <= buffer_distance:
                    relevant_bands.append(speed_band.get('SpeedBand', 2))
            
            # Return average speed band, default to 2 if no relevant bands found
            return sum(relevant_bands) / len(relevant_bands) if relevant_bands else 2
            
        except Exception as e:
            logger.error(f"Error getting average speed band: {e}")
            return 2  # Default to moderate speed
    
    async def _get_incidents_on_route(self, start_coords: Tuple[float, float], 
                              dest_coords: Tuple[float, float]) -> List[Dict[str, Any]]:
        """Get details of incidents along the route"""
        try:
            # Get all incidents (official and user-reported)
            from app.database.firestore_utils import get_all_incidents
            
            all_incidents = get_all_incidents(limit=100)
            nearby_incidents = []
            
            # Calculate route parameters
            route_distance = geodesic(start_coords, dest_coords).kilometers
            buffer_distance = max(1.0, route_distance * 0.2)  # At least 1km or 20% of route distance
            
            for incident in all_incidents:
                # Get coordinates - different structure for official vs user-reported
                if incident.get('source') == 'official':
                    incident_coords = (incident.get('Latitude', 0), incident.get('Longitude', 0))
                    incident_type = incident.get('Type', 'Unknown')
                    incident_message = incident.get('Message', '')
                else:
                    location = incident.get('location', {})
                    incident_coords = (location.get('latitude', 0), location.get('longitude', 0))
                    incident_type = incident.get('type', 'Unknown')
                    incident_message = incident.get('description', '')
                
                # Check if on route (simplified)
                # In a real implementation, we'd check if the incident is actually on the driving route
                is_on_route = False
                
                # Check distance to start
                distance_to_start = geodesic(start_coords, incident_coords).kilometers
                if distance_to_start <= buffer_distance:
                    is_on_route = True
                
                # Check distance to destination
                distance_to_dest = geodesic(dest_coords, incident_coords).kilometers
                if distance_to_dest <= buffer_distance:
                    is_on_route = True
                
                # Calculate midpoint
                mid_lat = (start_coords[0] + dest_coords[0]) / 2
                mid_lon = (start_coords[1] + dest_coords[1]) / 2
                distance_to_mid = geodesic((mid_lat, mid_lon), incident_coords).kilometers
                
                if distance_to_mid <= buffer_distance:
                    is_on_route = True
                
                if is_on_route:
                    nearby_incidents.append({
                        "type": incident_type,
                        "message": incident_message,
                        "distance_from_start": round(distance_to_start, 1),
                        "latitude": incident_coords[0],
                        "longitude": incident_coords[1],
                        "source": incident.get('source', 'unknown')
                    })
            
            # Sort by distance from start
            return sorted(nearby_incidents, key=lambda x: x['distance_from_start'])
            
        except Exception as e:
            logger.error(f"Error getting incidents on route: {e}")
            return []
    
    async def _generate_weather_recommendations(self, weather: str, mode: str) -> List[str]:
        """Generate weather-based recommendations"""
        recommendations = []
        
        if weather == "Rain":
            if mode == "driving":
                recommendations = [
                    "Reduce speed due to wet roads",
                    "Leave extra space between vehicles",
                    "Use headlights for better visibility",
                    "Avoid areas prone to flooding"
                ]
            else:
                recommendations = [
                    "Bring an umbrella",
                    "Allow extra travel time for potential public transport delays",
                    "Consider sheltered walking routes",
                    "Be aware that bus services may be running slower than usual"
                ]
        elif weather == "Fog":
            if mode == "driving":
                recommendations = [
                    "Use fog lights but not high beams",
                    "Reduce speed significantly",
                    "Maintain extra distance from other vehicles",
                    "Avoid expressways if possible"
                ]
            else:
                recommendations = [
                    "Allow extra travel time for potential public transport delays",
                    "Be aware of reduced visibility at crossings"
                ]
                
        return recommendations
    
    async def _generate_alternative_routes(self, 
                                   start_location: Dict[str, float], 
                                   destination_location: Dict[str, float],
                                   mode_of_transport: str) -> List[Dict[str, Any]]:
        """Generate alternative routes - simplified version"""
        # In a real implementation, this would call a routing API
        # Here we provide a simplified version with dummy data
        
        # Calculate direct distance
        start_coords = (start_location.get('latitude', 0), start_location.get('longitude', 0))
        dest_coords = (destination_location.get('latitude', 0), destination_location.get('longitude', 0))
        direct_distance_km = geodesic(start_coords, dest_coords).kilometers
        
        # Generate alternatives
        alternatives = []
        
        # 1. Slightly longer but potentially faster route
        alt_1_distance = direct_distance_km * 1.1  # 10% longer
        alt_1_time = (alt_1_distance / 50) * 60  # Assuming 50 km/h average speed
        
        alternatives.append({
            "name": "Alternative Route 1", 
            "distance_km": round(alt_1_distance, 1),
            "estimated_time_min": round(alt_1_time, 1),
            "congestion_level": "Low",
            "description": "Longer route via major roads with less congestion"
        })
        
        # 2. Shorter but potentially slower route
        alt_2_distance = direct_distance_km * 0.95  # 5% shorter
        alt_2_time = (alt_2_distance / 30) * 60  # Assuming 30 km/h average speed
        
        alternatives.append({
            "name": "Alternative Route 2", 
            "distance_km": round(alt_2_distance, 1),
            "estimated_time_min": round(alt_2_time, 1),
            "congestion_level": "Moderate",
            "description": "Shorter route through local roads with more traffic lights"
        })
        
        return alternatives
    
    async def _get_historical_travel_times(self) -> List[Dict[str, Any]]:
        """Get historical estimated travel times from Firestore"""
        try:
            times_ref = db.collection('estimated_travel_times')
            query = times_ref.limit(1000)  # Get at most 1000 records
            docs = query.stream()
            
            return [doc.to_dict() for doc in docs]
            
        except Exception as e:
            logger.error(f"Error getting historical travel times: {e}")
            return []
    
    async def _get_historical_speed_bands(self) -> List[Dict[str, Any]]:
        """Get historical speed bands from Firestore"""
        try:
            bands_ref = db.collection('traffic_speed_bands')
            query = bands_ref.limit(1000)  # Get at most 1000 records
            docs = query.stream()
            
            return [doc.to_dict() for doc in docs]
            
        except Exception as e:
            logger.error(f"Error getting historical speed bands: {e}")
            return []
    
    def _generate_synthetic_training_data(self, num_samples: int = 5000) -> pd.DataFrame:
        """Generate synthetic data for model training when historical data is insufficient"""
        np.random.seed(42)  # For reproducibility
        
        # Generate features
        data = {
            'distance_km': np.random.uniform(1, 30, num_samples),  # Distance in km
            'hour_of_day': np.random.randint(0, 24, num_samples),
            'day_of_week': np.random.randint(0, 7, num_samples),
            'is_weekend': np.random.randint(0, 2, num_samples),
            'is_peak_morning': np.random.randint(0, 2, num_samples),
            'is_peak_evening': np.random.randint(0, 2, num_samples),
            'is_public_holiday': np.random.randint(0, 2, num_samples),
            'rain_forecast': np.random.randint(0, 2, num_samples),
            'fog_forecast': np.random.randint(0, 2, num_samples),
            'incidents_count': np.random.randint(0, 5, num_samples),
            'avg_speed_band': np.random.randint(1, 5, num_samples),
            'mode_of_transport': np.random.choice(['driving', 'public_transport'], num_samples)
        }
        
        # Create DataFrame
        df = pd.DataFrame(data)
        
        # Generate target variables based on features
        
        # 1. Road condition (Clear, Moderate, Congested)
        # Logic: More incidents, higher speed band, peak hours lead to congestion
        congestion_score = (
            df['incidents_count'] * 0.5 + 
            df['avg_speed_band'] * 0.3 + 
            df['is_peak_morning'] * 2 + 
            df['is_peak_evening'] * 2.5 +
            df['rain_forecast'] * 1.5 +
            df['fog_forecast'] * 1 +
            df['is_public_holiday'] * -1  # Holidays typically have less congestion
        )
        
        # Normalize to 0-10 scale
        congestion_score = 10 * (congestion_score - congestion_score.min()) / (congestion_score.max() - congestion_score.min())
        
        # Map to road conditions
        road_conditions = ['Clear', 'Moderate', 'Congested']
        df['road_condition'] = pd.cut(
            congestion_score, 
            bins=[0, 3.33, 6.67, 10], 
            labels=road_conditions, 
            include_lowest=True
        )
        
        # 2. Delay (Yes/No)
        # Logic: Delays are more likely with incidents, congestion, bad weather
        delay_prob = (
            df['incidents_count'] * 0.15 + 
            (df['avg_speed_band'] / 4) * 0.3 + 
            df['is_peak_morning'] * 0.1 + 
            df['is_peak_evening'] * 0.15 +
            df['rain_forecast'] * 0.15 +
            df['fog_forecast'] * 0.2
        )
        
        # Normalize to 0-1 probability
        delay_prob = (delay_prob - delay_prob.min()) / (delay_prob.max() - delay_prob.min())
        
        # Convert to binary
        df['had_delay'] = (delay_prob > 0.5).astype(int)
        
        # 3. Travel time in minutes
        # Logic: Base travel time on distance, then add factors for mode, congestion, etc.
        
        # Base speed in km/h - 40 km/h for driving, 25 km/h for public transport
        base_speed = np.where(df['mode_of_transport'] == 'driving', 40, 25)
        
        # Adjust for congestion (speed band)
        speed_factor = np.select(
            [df['avg_speed_band'] == 1, df['avg_speed_band'] == 2, df['avg_speed_band'] == 3, df['avg_speed_band'] == 4],
            [1.2, 1.0, 0.8, 0.6],
            default=1.0
        )
        
        # Adjust for weather
        weather_factor = np.select(
            [df['rain_forecast'] == 1, df['fog_forecast'] == 1, (df['rain_forecast'] == 1) & (df['fog_forecast'] == 1)],
            [0.9, 0.8, 0.7],
            default=1.0
        )
        
        # Adjust for time of day
        time_factor = np.select(
            [df['is_peak_morning'] == 1, df['is_peak_evening'] == 1, df['is_weekend'] == 1],
            [0.8, 0.7, 1.1],
            default=1.0
        )
        
        # Calculate travel time (distance / adjusted speed) in minutes
        adjusted_speed = base_speed * speed_factor * weather_factor * time_factor
        df['travel_time_minutes'] = (df['distance_km'] / adjusted_speed) * 60
        
        # Add some random noise (±10%)
        df['travel_time_minutes'] *= np.random.uniform(0.9, 1.1, num_samples)
        
        return df
    
    async def _collect_training_data(self) -> pd.DataFrame:
        """Collect and prepare historical data for training"""
        try:
            # This function would normally gather historical data from multiple sources
            # For simplicity, we'll create a synthetic dataset here
            
            # Check if we can get some real data from Firestore
            estimated_times = await self._get_historical_travel_times()
            speed_bands = await self._get_historical_speed_bands()
            
            # If we have no real data, generate synthetic data
            if not estimated_times and not speed_bands:
                return self._generate_synthetic_training_data()
            
            # Otherwise, compile real data with synthetic supplements
            # (real implementation would do proper feature engineering here)
            return self._generate_synthetic_training_data(1000)  # Generate 1000 synthetic records
            
        except Exception as e:
            logger.error(f"Error collecting training data: {e}")
            return pd.DataFrame()
    
    async def train_models(self, force_retrain: bool = False):
        """
        Train prediction models using historical data
        
        Args:
            force_retrain (bool): If True, retrain models even if they already exist
        """
        if not force_retrain and all([
            self.tf_road_condition_model, 
            self.tf_delay_model, 
            self.tf_travel_time_model
        ]):
            logger.info("TensorFlow models already trained. Use force_retrain=True to retrain")
            return
            
        try:
            # Collect training data
            training_data = await self._collect_training_data()
            
            if training_data.empty:
                logger.error("No training data available")
                return
                
            logger.info(f"Collected {len(training_data)} records for training")
            
            # Prepare features and targets
            X = training_data.drop(['road_condition', 'had_delay', 'travel_time_minutes'], axis=1)
            y_road = pd.get_dummies(training_data['road_condition'])  # One-hot encode for TF
            y_delay = training_data['had_delay']
            y_time = training_data['travel_time_minutes']
            
            # Create preprocessing pipeline
            categorical_features = ['mode_of_transport']
            numeric_features = ['distance_km', 'hour_of_day', 'day_of_week', 
                                'is_weekend', 'is_peak_morning', 'is_peak_evening', 
                                'is_public_holiday', 'rain_forecast', 'fog_forecast',
                                'incidents_count', 'avg_speed_band']
            
            preprocessor = ColumnTransformer(
                transformers=[
                    ('num', StandardScaler(), numeric_features),
                    ('cat', OneHotEncoder(handle_unknown='ignore'), categorical_features)
                ])
            
            # Split data
            X_train, X_test, y_road_train, y_road_test = train_test_split(X, y_road, test_size=0.2, random_state=42)
            _, _, y_delay_train, y_delay_test = train_test_split(X, y_delay, test_size=0.2, random_state=42)
            _, _, y_time_train, y_time_test = train_test_split(X, y_time, test_size=0.2, random_state=42)
            
            # Fit preprocessing pipeline
            self.feature_transformer = preprocessor.fit(X_train)
            
            # Save preprocessor
            joblib.dump(self.feature_transformer, TRANSFORMER_PATH)
            
            # Transform data
            X_train_transformed = self.feature_transformer.transform(X_train)
            X_test_transformed = self.feature_transformer.transform(X_test)
            
            # Get the number of features after transformation
            if isinstance(X_train_transformed, np.ndarray):
                n_features = X_train_transformed.shape[1]
            else:
                n_features = X_train_transformed.toarray().shape[1]
            
            # Convert sparse matrices to dense if needed
            if not isinstance(X_train_transformed, np.ndarray):
                X_train_transformed = X_train_transformed.toarray()
                X_test_transformed = X_test_transformed.toarray()
            
            # 1. Train TensorFlow Road Condition Model (multiclass classification)
            tf_road_model = Sequential([
                Dense(64, activation='relu', input_shape=(n_features,)),
                BatchNormalization(),
                Dropout(0.3),
                Dense(32, activation='relu'),
                Dropout(0.2),
                Dense(3, activation='softmax')  # 3 classes: Clear, Moderate, Congested
            ])
            
            tf_road_model.compile(
                optimizer=Adam(learning_rate=0.001),
                loss='categorical_crossentropy',
                metrics=['accuracy']
            )
            
            early_stopping = EarlyStopping(
                monitor='val_loss',
                patience=10,
                restore_best_weights=True
            )
            
            tf_road_model.fit(
                X_train_transformed, 
                y_road_train,
                epochs=50,
                batch_size=32,
                validation_split=0.2,
                callbacks=[early_stopping],
                verbose=1
            )
            
            # Evaluate road condition model
            road_eval = tf_road_model.evaluate(X_test_transformed, y_road_test)
            logger.info(f"TensorFlow road condition model accuracy: {road_eval[1]:.4f}")
            
            # Save TensorFlow road condition model
            tf_road_model.save(TF_ROAD_CONDITION_MODEL_PATH)
            self.tf_road_condition_model = tf_road_model
            
            # 2. Train TensorFlow Delay Model (binary classification)
            tf_delay_model = Sequential([
                Dense(32, activation='relu', input_shape=(n_features,)),
                BatchNormalization(),
                Dropout(0.2),
                Dense(16, activation='relu'),
                Dense(1, activation='sigmoid')  # Binary output
            ])
            
            tf_delay_model.compile(
                optimizer=Adam(learning_rate=0.001),
                loss='binary_crossentropy',
                metrics=['accuracy']
            )
            
            tf_delay_model.fit(
                X_train_transformed, 
                y_delay_train,
                epochs=50,
                batch_size=32,
                validation_split=0.2,
                callbacks=[early_stopping],
                verbose=1
            )
            
            # Evaluate delay model
            delay_eval = tf_delay_model.evaluate(X_test_transformed, y_delay_test)
            logger.info(f"TensorFlow delay model accuracy: {delay_eval[1]:.4f}")
            
            # Save TensorFlow delay model
            tf_delay_model.save(TF_DELAY_MODEL_PATH)
            self.tf_delay_model = tf_delay_model
            
            # 3. Train TensorFlow Travel Time Model (regression)
            tf_time_model = Sequential([
                Dense(64, activation='relu', input_shape=(n_features,)),
                BatchNormalization(),
                Dropout(0.3),
                Dense(32, activation='relu'),
                Dropout(0.2),
                Dense(16, activation='relu'),
                Dense(1)  # Regression output (no activation)
            ])
            
            tf_time_model.compile(
                optimizer=Adam(learning_rate=0.001),
                loss='mse',
                metrics=['mae']
            )
            
            tf_time_model.fit(
                X_train_transformed, 
                y_time_train,
                epochs=50,
                batch_size=32,
                validation_split=0.2,
                callbacks=[early_stopping],
                verbose=1
            )
            
            # Evaluate travel time model
            y_time_pred = tf_time_model.predict(X_test_transformed).flatten()
            time_mae = mean_absolute_error(y_time_test, y_time_pred)
            logger.info(f"TensorFlow travel time model MAE: {time_mae:.2f} minutes")
            
            # Save TensorFlow travel time model
            tf_time_model.save(TF_TRAVEL_TIME_MODEL_PATH)
            self.tf_travel_time_model = tf_time_model
            
            # Also train traditional ML models as backup
            # Train road condition model
            self.road_condition_model = RandomForestClassifier(n_estimators=100, random_state=42)
            self.road_condition_model.fit(X_train_transformed, y_road_train.idxmax(axis=1))
            
            road_pred = self.road_condition_model.predict(X_test_transformed)
            road_accuracy = accuracy_score(y_road_test.idxmax(axis=1), road_pred)
            logger.info(f"Traditional road condition model accuracy: {road_accuracy:.4f}")
            
            # Save road condition model
            joblib.dump(self.road_condition_model, ROAD_CONDITION_MODEL_PATH)
            
            # Train delay model
            self.delay_model = xgb.XGBClassifier(n_estimators=100, random_state=42)
            self.delay_model.fit(X_train_transformed, y_delay_train)
            
            delay_pred = self.delay_model.predict(X_test_transformed)
            delay_accuracy = accuracy_score(y_delay_test, delay_pred)
            logger.info(f"Traditional delay model accuracy: {delay_accuracy:.4f}")
            
            # Save delay model
            joblib.dump(self.delay_model, DELAY_MODEL_PATH)
            
            # Train travel time model
            self.travel_time_model = GradientBoostingRegressor(n_estimators=100, random_state=42)
            self.travel_time_model.fit(X_train_transformed, y_time_train)
            
            time_pred = self.travel_time_model.predict(X_test_transformed)
            time_mae = mean_absolute_error(y_time_test, time_pred)
            logger.info(f"Traditional travel time model MAE: {time_mae:.2f} minutes")
            
            # Save travel time model
            joblib.dump(self.travel_time_model, TRAVEL_TIME_MODEL_PATH)
            
            logger.info("All models trained and saved successfully")
            
        except Exception as e:
            logger.error(f"Error training models: {e}")

# Prediction models singleton instance
traffic_model = TrafficPredictionModel()

async def initialize_models():
    """Initialize prediction models - call on startup"""
    traffic_model.load_models()
    
    # Train models if they don't exist
    if (not os.path.exists(TF_ROAD_CONDITION_MODEL_PATH) or 
        not os.path.exists(TF_DELAY_MODEL_PATH) or 
        not os.path.exists(TF_TRAVEL_TIME_MODEL_PATH)):
        logger.info("Training models for the first time...")
        await traffic_model.train_models()

async def get_traffic_prediction(
    start_location: Dict[str, float], 
    destination_location: Dict[str, float], 
    mode_of_transport: str, 
    prediction_time: Optional[datetime] = None,
    user_type: str = "unregistered") -> Dict[str, Any]:
    """
    Public API function to get traffic prediction
    
    Args:
        start_location: Dictionary with lat/long of starting point
        destination_location: Dictionary with lat/long of destination
        mode_of_transport: 'driving' or 'public_transport'
        prediction_time: Datetime for future prediction (default: current time)
        user_type: 'registered' or 'unregistered'
        
    Returns:
        Dictionary with prediction results
    """
    return await traffic_model.get_prediction(
        start_location,
        destination_location,
        mode_of_transport,
        prediction_time,
        user_type
    )

async def retrain_models():
    """Function to retrain models with latest data - call regularly via cron/Airflow"""
    logger.info("Retraining prediction models with latest data...")
    await traffic_model.train_models(force_retrain=True)
    logger.info("Model retraining complete")