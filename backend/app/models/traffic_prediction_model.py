# app/models/traffic_prediction_model.py

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import pickle
import os
import logging
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import joblib
from app.data.firestore_dataloader import FirestoreDataLoader

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class TrafficPredictionModel:
    """
    Traffic prediction model that leverages historical and real-time data
    to predict traffic conditions and travel times.
    """
    
    def __init__(self, model_path=None):
        """
        Initialize the traffic prediction model.
        
        Args:
            model_path (str, optional): Path to saved model files
        """
        self.model_path = model_path
        self.speed_model = None
        self.travel_time_model = None
        self.condition_model = None
        self.data_loader = FirestoreDataLoader()
        
        # Load models if path is provided
        if model_path and os.path.exists(model_path):
            self.load_models()
    
    def load_data(self, days=30, include_weather=True, include_incidents=True):
        """
        Load training data from Firestore using the data loader.
        
        Args:
            days (int): Number of days of data to retrieve
            include_weather (bool): Whether to include weather data
            include_incidents (bool): Whether to include incident data
            
        Returns:
            pandas.DataFrame: Combined dataset for training
        """
        logger.info(f"Loading data for training (days={days}, include_weather={include_weather}, include_incidents={include_incidents})")
        
        # Load traffic speed bands data
        speed_bands_df = self.data_loader.get_traffic_speed_bands(days=days)
        
        if speed_bands_df.empty:
            logger.warning("No traffic speed data available for training")
            return pd.DataFrame()
        
        # Load travel time data if available
        travel_times_df = self.data_loader.get_travel_times(days=days)
        
        # Create base dataset from speed bands
        dataset = speed_bands_df.copy()
        
        # Add time-based features
        if 'Timestamp' in dataset.columns:
            dataset['hour'] = dataset['Timestamp'].dt.hour
            dataset['day_of_week'] = dataset['Timestamp'].dt.dayofweek
            dataset['month'] = dataset['Timestamp'].dt.month
            dataset['is_weekend'] = dataset['day_of_week'].apply(lambda x: 1 if x >= 5 else 0)
        
        # Add road category features if available
        if 'RoadCategory' in dataset.columns:
            # Convert categorical to numeric representation
            road_category_map = {
                'A': 4,
                'B': 3, 
                'C': 2,
                'D': 1,
                'E': 0
            }
            dataset['RoadCategory_Numeric'] = dataset['RoadCategory'].map(road_category_map)
        
        # Add holiday information
        holidays_df = self.data_loader.get_historical_holidays()
        if not holidays_df.empty and 'Timestamp' in dataset.columns:
            # Convert date column to date only for joining
            dataset['date'] = dataset['Timestamp'].dt.date
            
            # Convert holidays to date only
            holidays_df['date'] = pd.to_datetime(holidays_df['Date']).dt.date
            
            # Create a set of holiday dates for efficient lookup
            holiday_dates = set(holidays_df['date'])
            
            # Mark holidays in the dataset
            dataset['is_holiday'] = dataset['date'].apply(lambda x: 1 if x in holiday_dates else 0)
            
            # Clean up temporary column
            dataset.drop('date', axis=1, inplace=True)
        else:
            # Default value if holiday data is not available
            dataset['is_holiday'] = 0
        
        # Add weather data if requested
        if include_weather:
            weather_df = self.data_loader.get_weather_data(days=days)
            
            if not weather_df.empty:
                # Get relevant weather features
                weather_features = weather_df.copy()
                
                # Process nested weather features if needed
                if 'temp_high' not in weather_features.columns and 'temperature' in weather_features.columns:
                    try:
                        weather_features['temp_high'] = weather_features['temperature'].apply(
                            lambda x: x.get('high') if isinstance(x, dict) else None
                        )
                        weather_features['temp_low'] = weather_features['temperature'].apply(
                            lambda x: x.get('low') if isinstance(x, dict) else None
                        )
                    except:
                        logger.warning("Could not extract nested temperature data")
                
                if 'humidity_high' not in weather_features.columns and 'relative_humidity' in weather_features.columns:
                    try:
                        weather_features['humidity_high'] = weather_features['relative_humidity'].apply(
                            lambda x: x.get('high') if isinstance(x, dict) else None
                        )
                        weather_features['humidity_low'] = weather_features['relative_humidity'].apply(
                            lambda x: x.get('low') if isinstance(x, dict) else None
                        )
                    except:
                        logger.warning("Could not extract nested humidity data")
                
                # Extract rainfall prediction if available
                if 'general_forecast' in weather_features.columns:
                    weather_features['rain_forecast'] = weather_features['general_forecast'].apply(
                        lambda x: 1 if 'rain' in str(x).lower() or 'shower' in str(x).lower() else 0
                    )
                
                # Keep only useful columns
                keep_cols = ['timestamp', 'temp_high', 'temp_low', 'humidity_high', 'humidity_low', 'rain_forecast']
                weather_features = weather_features[[col for col in keep_cols if col in weather_features.columns]]
                
                # Rename timestamp to match main dataset
                if 'timestamp' in weather_features.columns:
                    weather_features.rename(columns={'timestamp': 'weather_timestamp'}, inplace=True)
                
                # Merge with main dataset based on closest timestamp
                # For simplicity, we'll just use the most recent weather data
                most_recent_weather = weather_features.iloc[0].to_dict()
                
                for col in most_recent_weather:
                    if col != 'weather_timestamp':
                        dataset[f'weather_{col}'] = most_recent_weather[col]
            else:
                logger.warning("No weather data available, adding default values")
                # Add default weather columns
                dataset['weather_temp_high'] = 30.0  # Default value
                dataset['weather_temp_low'] = 25.0  # Default value
                dataset['weather_rain_forecast'] = 0  # Default value
        
        # Add incident data if requested
        if include_incidents:
            incidents_df = self.data_loader.get_incidents(days=days)
            
            if not incidents_df.empty:
                # Count incidents by road or area
                if 'RoadName' in dataset.columns and 'Message' in incidents_df.columns:
                    # Extract road names from incidents for matching
                    incidents_df['IncidentRoad'] = incidents_df['Message'].apply(
                        lambda x: self._extract_road_name(x) if isinstance(x, str) else ''
                    )
                    
                    # Count incidents by road
                    road_incident_counts = incidents_df.groupby('IncidentRoad').size().reset_index()
                    road_incident_counts.columns = ['IncidentRoad', 'incident_count']
                    
                    # Create road name to incident count mapping
                    road_incident_map = dict(zip(road_incident_counts['IncidentRoad'], road_incident_counts['incident_count']))
                    
                    # Add incident count to dataset based on road name
                    dataset['nearby_incidents'] = dataset['RoadName'].apply(
                        lambda x: road_incident_map.get(x, 0) if isinstance(x, str) else 0
                    )
                else:
                    # Default if we can't match by road name
                    dataset['nearby_incidents'] = 0
            else:
                logger.warning("No incident data available, adding default values")
                dataset['nearby_incidents'] = 0
        
        logger.info(f"Data loading complete, combined dataset has {len(dataset)} rows and {len(dataset.columns)} columns")
        return dataset
    
    def _extract_road_name(self, message):
        """Extract road name from incident message."""
        # This is a simple extraction - could be improved with NLP
        if not isinstance(message, str):
            return ""
            
        # Common road indicators
        road_indicators = [" on ", " at ", " along ", "PIE", "AYE", "CTE", "ECP", "TPE", "SLE", "BKE", "KJE", "KPE"]
        
        for indicator in road_indicators:
            if indicator in message:
                # Extract the part after the indicator
                parts = message.split(indicator, 1)
                if len(parts) > 1:
                    # Get the first word which is likely the road name
                    road_name = parts[1].strip().split(" ")[0]
                    return road_name
        
        return ""
    
    def train_speed_model(self, training_data=None, test_size=0.2, n_estimators=100):
        """
        Train a model to predict traffic speed bands.
        
        Args:
            training_data (pandas.DataFrame, optional): Pre-loaded training data
            test_size (float): Proportion of data to use for testing
            n_estimators (int): Number of estimators for the random forest
            
        Returns:
            dict: Training performance metrics
        """
        logger.info("Training traffic speed prediction model")
        
        # Load data if not provided
        if training_data is None or training_data.empty:
            training_data = self.load_data(days=30)
            
            if training_data.empty:
                logger.error("No training data available for speed model")
                return {"error": "No training data available"}
        
        # Prepare features and target
        feature_cols = [
            'hour', 'day_of_week', 'is_weekend', 'is_holiday',
            'RoadCategory_Numeric', 'weather_temp_high', 'weather_rain_forecast',
            'nearby_incidents'
        ]
        
        # Ensure all feature columns exist
        for col in feature_cols:
            if col not in training_data.columns:
                if col in ['weather_temp_high', 'weather_rain_forecast', 'nearby_incidents']:
                    # These are optional, set to defaults
                    if col == 'weather_temp_high':
                        training_data[col] = 30.0
                    elif col == 'weather_rain_forecast':
                        training_data[col] = 0
                    elif col == 'nearby_incidents':
                        training_data[col] = 0
                else:
                    logger.error(f"Required column {col} missing from training data")
                    return {"error": f"Required column {col} missing from training data"}
        
        # Target column is SpeedBand
        if 'SpeedBand' not in training_data.columns:
            logger.error("Target column 'SpeedBand' missing from training data")
            return {"error": "Target column 'SpeedBand' missing from training data"}
        
        # Filter out rows with missing values
        training_data = training_data.dropna(subset=feature_cols + ['SpeedBand'])
        
        if len(training_data) < 100:
            logger.warning(f"Limited training data available: only {len(training_data)} samples")
        
        # Split data
        X = training_data[feature_cols]
        y = training_data['SpeedBand']
        
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=test_size, random_state=42)
        
        # Define model pipeline
        numeric_features = [col for col in feature_cols if col not in ['RoadCategory']]
        categorical_features = [col for col in feature_cols if col in ['RoadCategory']]
        
        preprocessor = ColumnTransformer(
            transformers=[
                ('num', StandardScaler(), numeric_features),
                ('cat', OneHotEncoder(handle_unknown='ignore'), categorical_features) if categorical_features else ('passthrough', 'passthrough', [])
            ],
            remainder='passthrough'
        )
        
        pipeline = Pipeline([
            ('preprocessor', preprocessor),
            ('model', RandomForestRegressor(n_estimators=n_estimators, random_state=42))
        ])
        
        # Train model
        pipeline.fit(X_train, y_train)
        
        # Evaluate model
        y_pred = pipeline.predict(X_test)
        
        metrics = {
            'mean_absolute_error': mean_absolute_error(y_test, y_pred),
            'mean_squared_error': mean_squared_error(y_test, y_pred),
            'root_mean_squared_error': np.sqrt(mean_squared_error(y_test, y_pred)),
            'r2_score': r2_score(y_test, y_pred),
            'training_samples': len(X_train),
            'testing_samples': len(X_test)
        }
        
        logger.info(f"Speed model training complete: MAE={metrics['mean_absolute_error']:.2f}, R2={metrics['r2_score']:.2f}")
        
        # Save model
        self.speed_model = pipeline
        
        if self.model_path:
            os.makedirs(self.model_path, exist_ok=True)
            joblib.dump(pipeline, os.path.join(self.model_path, 'speed_model.joblib'))
            logger.info(f"Speed model saved to {self.model_path}/speed_model.joblib")
        
        return metrics
    
    def train_travel_time_model(self, training_data=None, test_size=0.2, n_estimators=100):
        """
        Train a model to predict travel times.
        
        Args:
            training_data (pandas.DataFrame, optional): Pre-loaded training data
            test_size (float): Proportion of data to use for testing
            n_estimators (int): Number of estimators for the gradient boosting
            
        Returns:
            dict: Training performance metrics
        """
        logger.info("Training travel time prediction model")
        
        # Load travel time data
        travel_time_data = self.data_loader.get_travel_times(days=30)
        
        if travel_time_data.empty:
            logger.error("No travel time data available for model training")
            return {"error": "No travel time data available"}
        
        # Load traffic speed data to enrich the travel time data
        speed_data = None
        if training_data is None or training_data.empty:
            speed_data = self.data_loader.get_traffic_speed_bands(days=30)
        else:
            speed_data = training_data
        
        # Prepare features from travel time data
        feature_cols = [
            'Expressway', 'Direction', 'Esttime'  # Base features
        ]
        
        # Add time-based features
        if 'Timestamp' in travel_time_data.columns:
            travel_time_data['hour'] = travel_time_data['Timestamp'].dt.hour
            travel_time_data['day_of_week'] = travel_time_data['Timestamp'].dt.dayofweek
            travel_time_data['is_weekend'] = travel_time_data['day_of_week'].apply(lambda x: 1 if x >= 5 else 0)
            
            feature_cols.extend(['hour', 'day_of_week', 'is_weekend'])
        
        # Add weather and holiday features
        holidays_df = self.data_loader.get_historical_holidays()
        if not holidays_df.empty and 'Timestamp' in travel_time_data.columns:
            # Convert date column to date only for joining
            travel_time_data['date'] = travel_time_data['Timestamp'].dt.date
            
            # Convert holidays to date only
            holidays_df['date'] = pd.to_datetime(holidays_df['Date']).dt.date
            
            # Create a set of holiday dates for efficient lookup
            holiday_dates = set(holidays_df['date'])
            
            # Mark holidays in the dataset
            travel_time_data['is_holiday'] = travel_time_data['date'].apply(lambda x: 1 if x in holiday_dates else 0)
            
            # Add to feature columns
            feature_cols.append('is_holiday')
        
        # Add weather data
        weather_df = self.data_loader.get_weather_data(days=30)
        if not weather_df.empty:
            # Get most recent weather data for simplicity
            most_recent_weather = weather_df.iloc[0]
            
            # Add weather features
            if 'temp_high' in most_recent_weather:
                travel_time_data['weather_temp'] = most_recent_weather['temp_high']
                feature_cols.append('weather_temp')
            
            if 'rain_forecast' in most_recent_weather:
                travel_time_data['weather_rain'] = most_recent_weather['rain_forecast']
                feature_cols.append('weather_rain')
        
        # Add incident information
        incidents_df = self.data_loader.get_incidents(days=30)
        if not incidents_df.empty:
            # Count incidents by expressway
            if 'Expressway' in travel_time_data.columns and 'Message' in incidents_df.columns:
                # Extract expressway from incidents
                incidents_df['ExpresswayMentioned'] = incidents_df['Message'].apply(
                    lambda x: any(e in str(x) for e in ['PIE', 'AYE', 'CTE', 'ECP', 'TPE', 'SLE', 'BKE', 'KJE', 'KPE']) if isinstance(x, str) else False
                )
                
                # Add incident count feature
                travel_time_data['incident_count'] = 0  # Default
                
                # Set expressway-specific counts
                for exp in travel_time_data['Expressway'].unique():
                    exp_incidents = incidents_df[incidents_df['Message'].str.contains(exp, na=False)].shape[0]
                    travel_time_data.loc[travel_time_data['Expressway'] == exp, 'incident_count'] = exp_incidents
                
                feature_cols.append('incident_count')
        
        # Ensure target variable is present
        if 'Esttime' not in travel_time_data.columns:
            logger.error("Target column 'Esttime' missing from travel time data")
            return {"error": "Target column 'Esttime' missing"}
        
        # Drop rows with missing values
        travel_time_data = travel_time_data.dropna(subset=[col for col in feature_cols if col != 'Esttime'] + ['Esttime'])
        
        # Prepare categorical features
        categorical_features = ['Expressway', 'Direction']
        numeric_features = [col for col in feature_cols if col not in categorical_features]
        
        # Split data
        X = travel_time_data[[col for col in feature_cols if col != 'Esttime']]
        y = travel_time_data['Esttime']
        
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=test_size, random_state=42)
        
        # Define model pipeline
        preprocessor = ColumnTransformer(
            transformers=[
                ('num', StandardScaler(), numeric_features),
                ('cat', OneHotEncoder(handle_unknown='ignore'), categorical_features)
            ],
            remainder='passthrough'
        )
        
        pipeline = Pipeline([
            ('preprocessor', preprocessor),
            ('model', GradientBoostingRegressor(n_estimators=n_estimators, random_state=42))
        ])
        
        # Train model
        pipeline.fit(X_train, y_train)
        
        # Evaluate model
        y_pred = pipeline.predict(X_test)
        
        metrics = {
            'mean_absolute_error': mean_absolute_error(y_test, y_pred),
            'mean_squared_error': mean_squared_error(y_test, y_pred),
            'root_mean_squared_error': np.sqrt(mean_squared_error(y_test, y_pred)),
            'r2_score': r2_score(y_test, y_pred),
            'training_samples': len(X_train),
            'testing_samples': len(X_test)
        }
        
        logger.info(f"Travel time model training complete: MAE={metrics['mean_absolute_error']:.2f}, R2={metrics['r2_score']:.2f}")
        
        # Save model
        self.travel_time_model = pipeline
        
        if self.model_path:
            os.makedirs(self.model_path, exist_ok=True)
            joblib.dump(pipeline, os.path.join(self.model_path, 'travel_time_model.joblib'))
            logger.info(f"Travel time model saved to {self.model_path}/travel_time_model.joblib")
        
        return metrics
    
    def train_traffic_condition_model(self, training_data=None, test_size=0.2, n_estimators=100):
        """
        Train a model to predict traffic conditions (categorical).
        
        Args:
            training_data (pandas.DataFrame, optional): Pre-loaded training data
            test_size (float): Proportion of data to use for testing
            n_estimators (int): Number of estimators for the random forest
            
        Returns:
            dict: Training performance metrics
        """
        logger.info("Training traffic condition prediction model")
        
        # Load data if not provided
        if training_data is None or training_data.empty:
            training_data = self.load_data(days=30)
            
            if training_data.empty:
                logger.error("No training data available for condition model")
                return {"error": "No training data available"}
        
        # Create traffic condition categories based on speed bands
        if 'SpeedBand' in training_data.columns:
            # Map speed bands to traffic conditions
            # Speed Band 1: 0-20 km/h (Congested)
            # Speed Band 2: 20-40 km/h (Heavy)
            # Speed Band 3: 40-60 km/h (Moderate)
            # Speed Band 4: 60-80 km/h (Light)
            # Speed Band 5: >80 km/h (Free Flow)
            speed_to_condition = {
                1: 'Severe',
                2: 'Heavy',
                3: 'Moderate',
                4: 'Light',
                5: 'Free Flow'
            }
            
            training_data['TrafficCondition'] = training_data['SpeedBand'].map(speed_to_condition)
        else:
            logger.error("Required column 'SpeedBand' missing from training data")
            return {"error": "Required column 'SpeedBand' missing"}
        
        # Prepare features and target
        feature_cols = [
            'hour', 'day_of_week', 'is_weekend', 'is_holiday',
            'RoadCategory_Numeric', 'weather_temp_high', 'weather_rain_forecast',
            'nearby_incidents'
        ]
        
        # Ensure all feature columns exist
        for col in feature_cols:
            if col not in training_data.columns:
                if col in ['weather_temp_high', 'weather_rain_forecast', 'nearby_incidents']:
                    # These are optional, set to defaults
                    if col == 'weather_temp_high':
                        training_data[col] = 30.0
                    elif col == 'weather_rain_forecast':
                        training_data[col] = 0
                    elif col == 'nearby_incidents':
                        training_data[col] = 0
                else:
                    logger.error(f"Required column {col} missing from training data")
                    return {"error": f"Required column {col} missing from training data"}
        
        # Filter out rows with missing values
        training_data = training_data.dropna(subset=feature_cols + ['TrafficCondition'])
        
        # Split data
        X = training_data[feature_cols]
        y = training_data['TrafficCondition']
        
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=test_size, random_state=42)
        
        # Define model pipeline
        numeric_features = [col for col in feature_cols if col not in ['RoadCategory']]
        categorical_features = [col for col in feature_cols if col in ['RoadCategory']]
        
        preprocessor = ColumnTransformer(
            transformers=[
                ('num', StandardScaler(), numeric_features),
                ('cat', OneHotEncoder(handle_unknown='ignore'), categorical_features) if categorical_features else ('passthrough', 'passthrough', [])
            ],
            remainder='passthrough'
        )
        
        pipeline = Pipeline([
            ('preprocessor', preprocessor),
            ('model', RandomForestRegressor(n_estimators=n_estimators, random_state=42))
        ])
        
        # Train model
        pipeline.fit(X_train, y_train)
        
        # Evaluate model
        y_pred = pipeline.predict(X_test)
        
        # For classification metrics, we need to convert predictions to categorical
        condition_labels = list(speed_to_condition.values())
        y_pred_labels = [condition_labels[int(min(max(0, round(pred)-1), 4))] for pred in y_pred]
        
        # Calculate accuracy
        accuracy = sum(1 for a, p in zip(y_test, y_pred_labels) if a == p) / len(y_test)
        
        metrics = {
            'accuracy': accuracy,
            'training_samples': len(X_train),
            'testing_samples': len(X_test)
        }
        
        logger.info(f"Traffic condition model training complete: Accuracy={metrics['accuracy']:.2f}")
        
        # Save model
        self.condition_model = pipeline
        
        if self.model_path:
            os.makedirs(self.model_path, exist_ok=True)
            joblib.dump(pipeline, os.path.join(self.model_path, 'condition_model.joblib'))
            logger.info(f"Traffic condition model saved to {self.model_path}/condition_model.joblib")
        
        return metrics
    
    def load_models(self):
        """Load saved models from disk."""
        if not self.model_path or not os.path.exists(self.model_path):
            logger.error(f"Model path does not exist: {self.model_path}")
            return False
        
        try:
            # Load speed model
            speed_model_path = os.path.join(self.model_path, 'speed_model.joblib')
            if os.path.exists(speed_model_path):
                self.speed_model = joblib.load(speed_model_path)
                logger.info(f"Loaded speed model from {speed_model_path}")
            
            # Load travel time model
            travel_time_model_path = os.path.join(self.model_path, 'travel_time_model.joblib')
            if os.path.exists(travel_time_model_path):
                self.travel_time_model = joblib.load(travel_time_model_path)
                logger.info(f"Loaded travel time model from {travel_time_model_path}")
            
            # Load condition model
            condition_model_path = os.path.join(self.model_path, 'condition_model.joblib')
            if os.path.exists(condition_model_path):
                self.condition_model = joblib.load(condition_model_path)
                logger.info(f"Loaded condition model from {condition_model_path}")
            
            return True
        except Exception as e:
            logger.error(f"Error loading models: {e}")
            return False
    
    def predict_speed(self, features):
        """
        Predict traffic speed band for given features.
        
        Args:
            features (dict): Feature values for prediction
            
        Returns:
            float: Predicted speed band
        """
        if self.speed_model is None:
            logger.error("Speed model not trained or loaded")
            return None
        
        # Ensure all required features are present
        required_features = [
            'hour', 'day_of_week', 'is_weekend', 'is_holiday',
            'RoadCategory_Numeric'
        ]
        
        for feature in required_features:
            if feature not in features:
                if feature == 'is_weekend' and 'day_of_week' in features:
                    # Can derive is_weekend from day_of_week
                    features['is_weekend'] = 1 if features['day_of_week'] >= 5 else 0
                else:
                    logger.error(f"Required feature missing for prediction: {feature}")
                    return None
        
        # Add optional features with defaults if missing
        optional_features = {
            'weather_temp_high': 30.0,
            'weather_rain_forecast': 0,
            'nearby_incidents': 0
        }
        
        for feature, default in optional_features.items():
            if feature not in features:
                features[feature] = default
        
        # Prepare features for model
        feature_df = pd.DataFrame([features])
        
        # Make prediction
        try:
            prediction = self.speed_model.predict(feature_df)[0]
            return prediction
        except Exception as e:
            logger.error(f"Error making speed prediction: {e}")
            return None
    
    def predict_travel_time(self, features):
        """
        Predict travel time for given features.
        
        Args:
            features (dict): Feature values for prediction
            
        Returns:
            float: Predicted travel time in minutes
        """
        if self.travel_time_model is None:
            logger.error("Travel time model not trained or loaded")
            return None
        
        # Ensure required features are present
        required_features = ['Expressway', 'Direction']
        
        for feature in required_features:
            if feature not in features:
                logger.error(f"Required feature missing for travel time prediction: {feature}")
                return None
        
        # Add optional features with defaults if missing
        optional_features = {
            'hour': datetime.now().hour,
            'day_of_week': datetime.now().weekday(),
            'is_weekend': 1 if datetime.now().weekday() >= 5 else 0,
            'is_holiday': 0,
            'weather_temp': 30.0,
            'weather_rain': 0,
            'incident_count': 0
        }
        
        for feature, default in optional_features.items():
            if feature not in features:
                features[feature] = default
        
        # Prepare features for model
        feature_df = pd.DataFrame([features])
        
        # Make prediction
        try:
            prediction = self.travel_time_model.predict(feature_df)[0]
            return prediction
        except Exception as e:
            logger.error(f"Error making travel time prediction: {e}")
            return None
    
    def predict_traffic_condition(self, features):
        """
        Predict traffic condition for given features.
        
        Args:
            features (dict): Feature values for prediction
            
        Returns:
            str: Predicted traffic condition category
        """
        if self.condition_model is None:
            logger.error("Traffic condition model not trained or loaded")
            return None
        
        # Ensure all required features are present
        required_features = [
            'hour', 'day_of_week', 'is_weekend', 'is_holiday',
            'RoadCategory_Numeric'
        ]
        
        for feature in required_features:
            if feature not in features:
                if feature == 'is_weekend' and 'day_of_week' in features:
                    # Can derive is_weekend from day_of_week
                    features['is_weekend'] = 1 if features['day_of_week'] >= 5 else 0
                else:
                    logger.error(f"Required feature missing for condition prediction: {feature}")
                    return None
        
        # Add optional features with defaults if missing
        optional_features = {
            'weather_temp_high': 30.0,
            'weather_rain_forecast': 0,
            'nearby_incidents': 0
        }
        
        for feature, default in optional_features.items():
            if feature not in features:
                features[feature] = default
        
        # Prepare features for model
        feature_df = pd.DataFrame([features])
        
        # Make prediction and convert to category
        try:
            prediction = self.condition_model.predict(feature_df)[0]
            
            # Map numeric prediction to category
            condition_map = {
                1: 'Severe',
                2: 'Heavy',
                3: 'Moderate',
                4: 'Light',
                5: 'Free Flow'
            }
            
            # Round prediction to nearest integer and ensure it's within range
            prediction_index = min(max(1, round(prediction)), 5)
            return condition_map[prediction_index]
            
        except Exception as e:
            logger.error(f"Error making traffic condition prediction: {e}")
            return None
    
    def train_all_models(self, days=30):
        """
        Train all traffic prediction models.
        
        Args:
            days (int): Number of days of data to use for training
            
        Returns:
            dict: Training metrics for all models
        """
        logger.info(f"Training all traffic prediction models using {days} days of data")
        
        # Load training data once
        training_data = self.load_data(days=days)
        
        if training_data.empty:
            logger.error("No training data available")
            return {"error": "No training data available"}
        
        # Train all models
        speed_metrics = self.train_speed_model(training_data=training_data)
        travel_time_metrics = self.train_travel_time_model(training_data=training_data)
        condition_metrics = self.train_traffic_condition_model(training_data=training_data)
        
        # Combine metrics
        all_metrics = {
            'speed_model': speed_metrics,
            'travel_time_model': travel_time_metrics,
            'condition_model': condition_metrics,
            'training_timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'days_of_data': days
        }
        
        logger.info("All traffic prediction models trained successfully")
        
        # Update model last trained timestamp
        if self.model_path:
            with open(os.path.join(self.model_path, 'model_last_trained.txt'), 'w') as f:
                f.write(datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
        
        return all_metrics