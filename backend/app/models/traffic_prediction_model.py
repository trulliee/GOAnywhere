# app/models/traffic_prediction_model.py

import pandas as pd
import numpy as np
import joblib
import os
from datetime import datetime, timedelta
import logging
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from xgboost import XGBRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class TrafficPredictionModel:
    """
    Model to predict traffic speed bands across Singapore road network.
    Uses XGBoost for time-series forecasting of traffic conditions.
    """
    
    def __init__(self, model_path=None):
        """
        Initialize the traffic prediction model.
        
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
        """Initialize a new XGBoost model for traffic prediction."""
        self.model = XGBRegressor(
            n_estimators=200,
            learning_rate=0.1,
            max_depth=6,
            subsample=0.8,
            colsample_bytree=0.8,
            objective='reg:squarederror',
            random_state=42
        )
        
        # Create preprocessing pipeline
        numeric_features = [
            'hour_of_day', 'day_of_week', 'month', 'temperature', 
            'humidity', 'rainfall', 'visibility'
        ]
        
        categorical_features = [
            'road_category', 'is_holiday', 'is_peak_hour', 
            'weather_condition', 'area_name'
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
            df (pandas.DataFrame): Input data containing traffic and contextual features
            
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
        if 'speed_band' in df.columns:
            y = df['speed_band']
            X = df.drop(['speed_band'], axis=1)
            return X, y
        else:
            return df
    
    def train(self, traffic_data, weather_data, holiday_data, incident_data=None, event_data=None):
        """
        Train the traffic prediction model using historical data.
        
        Args:
            traffic_data (pandas.DataFrame): Historical traffic speed bands data
            weather_data (pandas.DataFrame): Historical weather data
            holiday_data (pandas.DataFrame): Holiday information
            incident_data (pandas.DataFrame, optional): Historical traffic incidents
            event_data (pandas.DataFrame, optional): Event information
            
        Returns:
            dict: Training metrics (accuracy, MAE, RMSE)
        """
        logger.info("Starting model training process")
        
        # Merge datasets for feature enrichment
        enriched_data = self._merge_datasets(
            traffic_data, weather_data, holiday_data, incident_data, event_data
        )
        
        # Preprocess the data
        X, y = self.preprocess_data(enriched_data)
        
        # Split into train and test sets
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42
        )
        
        # Fit the preprocessor and transform the data
        X_train_processed = self.preprocessor.fit_transform(X_train)
        X_test_processed = self.preprocessor.transform(X_test)
        
        # Train the model
        logger.info("Training XGBoost model")
        self.model.fit(X_train_processed, y_train)
        
        # Evaluate the model
        y_pred = self.model.predict(X_test_processed)
        metrics = self._calculate_metrics(y_test, y_pred)
        
        # Save the trained model
        self.save_model()
        
        logger.info(f"Model training completed. Metrics: {metrics}")
        return metrics
    
    def predict(self, features):
        """
        Predict traffic speed bands for given features.
        
        Args:
            features (pandas.DataFrame): Input features for prediction
            
        Returns:
            numpy.ndarray: Predicted traffic speed bands
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
    
    def predict_for_route(self, route_segments, time=None, weather_conditions=None):
        """
        Predict traffic conditions for a specific route.
        
        Args:
            route_segments (list): List of road segments in the route
            time (datetime, optional): Time for prediction. Defaults to current time.
            weather_conditions (dict, optional): Weather conditions to use for prediction
            
        Returns:
            dict: Predicted traffic conditions for each segment
        """
        if time is None:
            time = datetime.now()
        
        # Prepare features for each segment
        route_features = []
        for segment in route_segments:
            # Extract segment features
            segment_features = self._extract_segment_features(segment, time, weather_conditions)
            route_features.append(segment_features)
        
        # Combine all segment features
        features_df = pd.DataFrame(route_features)
        
        # Make predictions for all segments
        predictions = self.predict(features_df)
        
        # Combine segments with predictions
        results = []
        for i, segment in enumerate(route_segments):
            results.append({
                'segment_id': segment.get('id'),
                'road_name': segment.get('road_name'),
                'predicted_speed_band': predictions[i],
                'severity_level': self._map_speed_to_severity(predictions[i]),
                'timestamp': time.strftime('%Y-%m-%d %H:%M:%S')
            })
        
        return results
    
    def _extract_segment_features(self, segment, time, weather_conditions):
        """Extract features for a road segment at specific time."""
        # Basic temporal features
        features = {
            'hour_of_day': time.hour,
            'day_of_week': time.weekday(),
            'month': time.month,
            'is_peak_hour': 1 if (7 <= time.hour <= 9) or (17 <= time.hour <= 19) else 0,
            'road_category': segment.get('road_category', 'OTHER'),
            'area_name': segment.get('area_name', 'CENTRAL'),
        }
        
        # Add weather conditions if provided
        if weather_conditions:
            features.update({
                'temperature': weather_conditions.get('temperature', 28.0),
                'humidity': weather_conditions.get('humidity', 80.0),
                'rainfall': weather_conditions.get('rainfall', 0.0),
                'visibility': weather_conditions.get('visibility', 10.0),
                'weather_condition': weather_conditions.get('weather_main', 'Clear')
            })
        else:
            # Default weather values for Singapore
            features.update({
                'temperature': 28.0,
                'humidity': 80.0,
                'rainfall': 0.0,
                'visibility': 10.0,
                'weather_condition': 'Clear'
            })
        
        return features
    
    def _map_speed_to_severity(self, speed_band):
        """Map speed band to traffic severity level."""
        if speed_band > 3:
            return "Free Flow"
        elif speed_band > 2:
            return "Light"
        elif speed_band > 1:
            return "Moderate"
        else:
            return "Heavy"
    
    def _merge_datasets(self, traffic_data, weather_data, holiday_data, incident_data=None, event_data=None):
        """Merge multiple datasets for feature enrichment."""
        # Merge traffic and weather data on timestamp
        merged_data = pd.merge(
            traffic_data,
            weather_data,
            on='timestamp',
            how='left'
        )
        
        # Add holiday information
        merged_data = self._add_holiday_info(merged_data, holiday_data)
        
        # Add incident impact if incident data is provided
        if incident_data is not None:
            merged_data = self._add_incident_impact(merged_data, incident_data)
        
        # Add event impact if event data is provided
        if event_data is not None:
            merged_data = self._add_event_impact(merged_data, event_data)
        
        return merged_data
    
    def _add_holiday_info(self, df, holiday_data):
        """Add holiday information to the dataset."""
        # Extract dates from the dataframe
        dates = df['timestamp'].dt.date.unique()
        
        # Create a lookup dictionary for holidays
        holiday_dates = set(pd.to_datetime(holiday_data['Date']).dt.date)
        
        # Add is_holiday column
        df['is_holiday'] = df['timestamp'].dt.date.isin(holiday_dates).astype(int)
        
        return df
    
    def _add_incident_impact(self, df, incident_data):
        """Add incident impact features to the dataset."""
        # Implementation depends on incident data structure
        # This is a placeholder that should be customized
        return df
    
    def _add_event_impact(self, df, event_data):
        """Add event impact features to the dataset."""
        # Implementation depends on event data structure
        # This is a placeholder that should be customized
        return df
    
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
            path = self.model_path or 'app/models/traffic_prediction_model.joblib'
        
        # Create directory if it doesn't exist
        os.makedirs(os.path.dirname(path), exist_ok=True)
        
        # Save model and preprocessor
        model_data = {
            'model': self.model,
            'preprocessor': self.preprocessor
        }
        
        joblib.dump(model_data, path)
        logger.info(f"Model saved to {path}")
    
    def load_model(self, path=None):
        """Load the model from disk."""
        if path is None:
            path = self.model_path or 'app/models/traffic_prediction_model.joblib'
        
        if not os.path.exists(path):
            raise FileNotFoundError(f"Model file not found at {path}")
        
        # Load model and preprocessor
        model_data = joblib.load(path)
        
        self.model = model_data['model']
        self.preprocessor = model_data['preprocessor']
        
        logger.info(f"Model loaded from {path}")