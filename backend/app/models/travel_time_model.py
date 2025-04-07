# app/models/travel_time_model.py

import pandas as pd
import numpy as np
import joblib
import os
from datetime import datetime, timedelta
import logging
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.model_selection import train_test_split, TimeSeriesSplit
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class TravelTimeModel:
    """
    Model to predict travel times for routes in Singapore based on traffic conditions,
    weather, incidents, and events.
    """
    
    def __init__(self, model_path=None):
        """
        Initialize the travel time prediction model.
        
        Args:
            model_path (str, optional): Path to saved model file. If None, a new model is created.
        """
        self.model = None
        self.preprocessor = None
        self.model_path = model_path
        
        if model_path and os.path.exists(model_path):
            self.load_model()
        else:
            self._initialize_model()
    
    def _initialize_model(self):
        """Initialize a new Gradient Boosting Regressor for travel time prediction."""
        self.model = GradientBoostingRegressor(
            n_estimators=200,
            learning_rate=0.1,
            max_depth=5,
            min_samples_split=5,
            min_samples_leaf=2,
            subsample=0.8,
            random_state=42
        )
        
        # Create preprocessing pipeline
        numeric_features = [
            'distance_km', 'avg_speed_band', 'hour_of_day', 'day_of_week',
            'month', 'temperature', 'humidity', 'rainfall', 'incident_count'
        ]
        
        categorical_features = [
            'route_type', 'transport_mode', 'weather_condition', 
            'is_holiday', 'is_peak_hour', 'has_major_event'
        ]
        
        numeric_transformer = Pipeline(steps=[
            ('scaler', StandardScaler())
        ])
        
        categorical_transformer = Pipeline(steps=[
            ('onehot', OneHotEncoder(handle_unknown='ignore'))
        ])
        
        self.preprocessor = ColumnTransformer(
            transformers=[
                ('num', numeric_transformer, numeric_features),
                ('cat', categorical_transformer, categorical_features)
            ],
            remainder='drop'
        )
    
    def preprocess_data(self, df):
        """
        Preprocess the raw data for model training or prediction.
        
        Args:
            df (pandas.DataFrame): Input data containing route and contextual features
            
        Returns:
            tuple: X (features) and y (target) if target is present, otherwise X
        """
        # Feature engineering
        if 'timestamp' in df.columns:
            df['hour_of_day'] = df['timestamp'].dt.hour
            df['day_of_week'] = df['timestamp'].dt.dayofweek
            df['month'] = df['timestamp'].dt.month
            df['is_peak_hour'] = df['hour_of_day'].apply(
                lambda x: 1 if (7 <= x <= 9) or (17 <= x <= 19) else 0
            )
        
        # Check for target column
        if 'travel_time_minutes' in df.columns:
            y = df['travel_time_minutes']
            X = df.drop(['travel_time_minutes'], axis=1)
            return X, y
        else:
            return df
    
    def train(self, travel_times_data, traffic_data, weather_data, holiday_data, incident_data=None, event_data=None):
        """
        Train the travel time prediction model using historical data.
        
        Args:
            travel_times_data (pandas.DataFrame): Historical travel times data
            traffic_data (pandas.DataFrame): Traffic speed bands data
            weather_data (pandas.DataFrame): Historical weather data
            holiday_data (pandas.DataFrame): Holiday information
            incident_data (pandas.DataFrame, optional): Historical traffic incidents
            event_data (pandas.DataFrame, optional): Event information
            
        Returns:
            dict: Training metrics (MAE, RMSE, R²)
        """
        logger.info("Starting travel time model training process")
        
        # Merge datasets for feature enrichment
        enriched_data = self._merge_datasets(
            travel_times_data, traffic_data, weather_data, 
            holiday_data, incident_data, event_data
        )
        
        # Preprocess the data
        X, y = self.preprocess_data(enriched_data)
        
        # Use time series cross-validation to evaluate the model
        tscv = TimeSeriesSplit(n_splits=5)
        
        fold_metrics = []
        for train_index, test_index in tscv.split(X):
            X_train, X_test = X.iloc[train_index], X.iloc[test_index]
            y_train, y_test = y.iloc[train_index], y.iloc[test_index]
            
            # Fit the preprocessor and transform the data
            X_train_processed = self.preprocessor.fit_transform(X_train)
            X_test_processed = self.preprocessor.transform(X_test)
            
            # Train the model
            self.model.fit(X_train_processed, y_train)
            
            # Evaluate the model
            y_pred = self.model.predict(X_test_processed)
            metrics = self._calculate_metrics(y_test, y_pred)
            fold_metrics.append(metrics)
        
        # Calculate average metrics across folds
        avg_metrics = {
            'mae': np.mean([m['mae'] for m in fold_metrics]),
            'rmse': np.mean([m['rmse'] for m in fold_metrics]),
            'r2': np.mean([m['r2'] for m in fold_metrics])
        }
        
        # Retrain on the full dataset
        X_processed = self.preprocessor.fit_transform(X)
        self.model.fit(X_processed, y)
        
        # Save the trained model
        self.save_model()
        
        logger.info(f"Travel time model training completed. Metrics: {avg_metrics}")
        return avg_metrics
    
    def predict(self, features):
        """
        Predict travel times for given features.
        
        Args:
            features (pandas.DataFrame): Input features for prediction
            
        Returns:
            numpy.ndarray: Predicted travel times in minutes
        """
        if self.model is None:
            raise ValueError("Model not trained or loaded")
        
        # Preprocess the features
        X = self.preprocess_data(features)
        
        # Transform the features
        X_processed = self.preprocessor.transform(X)
        
        # Make predictions
        predictions = self.model.predict(X_processed)
        
        return predictions
    
    def predict_travel_time(self, origin, destination, mode='driving', departure_time=None, 
                           weather_conditions=None, avoid_congestion=False):
        """
        Predict travel time between origin and destination with current conditions.
        
        Args:
            origin (dict): Origin coordinates or location ID
            destination (dict): Destination coordinates or location ID
            mode (str): Transport mode ('driving' or 'public_transport')
            departure_time (datetime, optional): Departure time. Defaults to current time.
            weather_conditions (dict, optional): Weather conditions
            avoid_congestion (bool): Whether to avoid congested roads
            
        Returns:
            dict: Travel time prediction with normal and adjusted times
        """
        if departure_time is None:
            departure_time = datetime.now()
        
        # Get route information (distance, segments, etc.)
        route_info = self._get_route_info(origin, destination, mode, avoid_congestion)
        
        # Get traffic conditions for the route
        traffic_conditions = self._get_traffic_conditions(route_info['segments'])
        
        # Get weather conditions if not provided
        if weather_conditions is None:
            weather_conditions = self._get_weather_conditions()
        
        # Get incident information for the route
        incidents = self._get_route_incidents(route_info['segments'])
        
        # Get events information for the route area
        events = self._get_route_events(route_info['bounding_box'])
        
        # Prepare features for prediction
        features = self._prepare_prediction_features(
            route_info, traffic_conditions, departure_time, 
            weather_conditions, incidents, events, mode, avoid_congestion
        )
        
        # Make prediction
        predicted_time = self.predict(pd.DataFrame([features]))[0]
        
        # Calculate normal travel time (without traffic, incidents, etc.)
        normal_time = self._calculate_normal_travel_time(route_info, mode)
        
        # Return both normal and predicted travel time
        return {
            'origin': origin,
            'destination': destination,
            'mode': mode,
            'departure_time': departure_time.strftime('%Y-%m-%d %H:%M:%S'),
            'distance_km': route_info['distance_km'],
            'normal_travel_time_minutes': round(normal_time, 1),
            'predicted_travel_time_minutes': round(predicted_time, 1),
            'delay_minutes': round(predicted_time - normal_time, 1),
            'delay_percentage': round((predicted_time - normal_time) / normal_time * 100, 1) if normal_time > 0 else 0,
            'weather_impact': weather_conditions.get('weather_main', 'Unknown'),
            'incident_count': len(incidents),
            'event_impact': 'Yes' if events else 'No'
        }
    
    def _get_route_info(self, origin, destination, mode, avoid_congestion):
        """
        Get route information between origin and destination.
        This is a placeholder that should be implemented with actual routing service.
        """
        # Placeholder function - in a real implementation, this would call a routing service
        # such as Google Maps API, OneMap Routing API, or a custom routing engine
        
        # Mock response for development
        return {
            'distance_km': 15.5,
            'segments': [
                {'id': 's1', 'road_name': 'Orchard Road', 'road_category': 'MAJOR'},
                {'id': 's2', 'road_name': 'Thomson Road', 'road_category': 'MAJOR'},
                {'id': 's3', 'road_name': 'Bukit Timah Road', 'road_category': 'MAJOR'}
            ],
            'bounding_box': {
                'min_lat': 1.29, 'min_lng': 103.82,
                'max_lat': 1.34, 'max_lng': 103.87
            }
        }
    
    def _get_traffic_conditions(self, segments):
        """
        Get current traffic conditions for route segments.
        This is a placeholder that should be implemented with actual traffic data.
        """
        # Placeholder function - in a real implementation, this would query Firestore
        # or another data source for current traffic speed bands
        
        # Mock response for development
        return [
            {'segment_id': 's1', 'speed_band': 2.5},
            {'segment_id': 's2', 'speed_band': 3.1},
            {'segment_id': 's3', 'speed_band': 2.8}
        ]
    
    def _get_weather_conditions(self):
        """
        Get current weather conditions.
        This is a placeholder that should be implemented with actual weather data.
        """
        # Placeholder function - in a real implementation, this would query Firestore
        # or another data source for current weather data
        
        # Mock response for development
        return {
            'temperature': 28.5,
            'humidity': 85.0,
            'rainfall': 0.0,
            'weather_main': 'Clear'
        }
    
    def _get_route_incidents(self, segments):
        """
        Get current incidents affecting route segments.
        This is a placeholder that should be implemented with actual incident data.
        """
        # Placeholder function - in a real implementation, this would query Firestore
        # or another data source for current incidents
        
        # Mock response for development
        return []
    
    def _get_route_events(self, bounding_box):
        """
        Get current events in the route area.
        This is a placeholder that should be implemented with actual event data.
        """
        # Placeholder function - in a real implementation, this would query Firestore
        # or another data source for current events
        
        # Mock response for development
        return []
    
    def _prepare_prediction_features(self, route_info, traffic_conditions, departure_time, 
                                    weather_conditions, incidents, events, mode, avoid_congestion):
        """Prepare features for travel time prediction."""
        # Calculate average speed band across all segments
        avg_speed_band = np.mean([tc['speed_band'] for tc in traffic_conditions])
        
        # Prepare feature dictionary
        features = {
            'distance_km': route_info['distance_km'],
            'avg_speed_band': avg_speed_band,
            'route_type': 'urban',  # This could be determined from the route
            'transport_mode': mode,
            'hour_of_day': departure_time.hour,
            'day_of_week': departure_time.weekday(),
            'month': departure_time.month,
            'is_peak_hour': 1 if (7 <= departure_time.hour <= 9) or (17 <= departure_time.hour <= 19) else 0,
            'is_holiday': self._is_holiday(departure_time),
            'temperature': weather_conditions.get('temperature', 28.0),
            'humidity': weather_conditions.get('humidity', 80.0),
            'rainfall': weather_conditions.get('rainfall', 0.0),
            'weather_condition': weather_conditions.get('weather_main', 'Clear'),
            'incident_count': len(incidents),
            'has_major_event': 1 if events else 0
        }
        
        return features
    
    def _is_holiday(self, date):
        """Check if a date is a public holiday."""
        # This is a placeholder - in a real implementation, this would
        # check against a database of holidays
        return 0
    
    def _calculate_normal_travel_time(self, route_info, mode):
        """Calculate normal travel time without traffic or incidents."""
        distance_km = route_info['distance_km']
        
        # Estimates based on mode
        if mode == 'driving':
            # Assume average speed of 40 km/h in normal conditions
            normal_time = distance_km / 40 * 60
        else:  # public_transport
            # Assume average speed of 25 km/h including waiting times
            normal_time = distance_km / 25 * 60
        
        return normal_time
    
    def _merge_datasets(self, travel_times, traffic_data, weather_data, holiday_data, incident_data=None, event_data=None):
        """Merge multiple datasets for feature enrichment."""
        # Placeholder implementation - actual implementation would depend on data structure
        # This method should be customized based on the actual data schema
        return travel_times
    
    def _calculate_metrics(self, y_true, y_pred):
        """Calculate model performance metrics."""
        return {
            'mae': mean_absolute_error(y_true, y_pred),
            'rmse': np.sqrt(mean_squared_error(y_true, y_pred)),
            'r2': r2_score(y_true, y_pred)
        }
    
    def save_model(self, path=None):
        """Save the model to disk."""
        if path is None:
            path = self.model_path or 'app/models/travel_time_model.joblib'
        
        # Create directory if it doesn't exist
        os.makedirs(os.path.dirname(path), exist_ok=True)
        
        # Save model and preprocessor
        model_data = {
            'model': self.model,
            'preprocessor': self.preprocessor
        }
        
        joblib.dump(model_data, path)
        logger.info(f"Travel time model saved to {path}")
    
    def load_model(self, path=None):
        """Load the model from disk."""
        if path is None:
            path = self.model_path or 'app/models/travel_time_model.joblib'
        
        if not os.path.exists(path):
            raise FileNotFoundError(f"Model file not found at {path}")
        
        # Load model and preprocessor
        model_data = joblib.load(path)
        
        self.model = model_data['model']
        self.preprocessor = model_data['preprocessor']
        
        logger.info(f"Travel time model loaded from {path}")