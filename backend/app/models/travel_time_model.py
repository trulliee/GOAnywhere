# app/models/travel_time_model.py

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import logging
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split
import joblib
import os
from app.data.firestore_dataloader import FirestoreDataLoader

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class TravelTimeModel:
    """
    Model for predicting travel times between locations based on current
    traffic conditions and historical patterns.
    """
    
    def __init__(self, model_path=None):
        """
        Initialize the travel time prediction model.
        
        Args:
            model_path (str, optional): Path to saved model files
        """
        self.model_path = model_path
        self.travel_time_model = None
        self.expressway_models = {}
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
        logger.info(f"Loading data for travel time model training (days={days})")
        
        # Load travel time data
        travel_times_df = self.data_loader.get_travel_times(days=days)
        
        if travel_times_df.empty:
            logger.warning("No travel time data available for training")
            return pd.DataFrame()
        
        # Start with travel times as base dataset
        dataset = travel_times_df.copy()
        
        # Add time-based features
        if 'Timestamp' in dataset.columns:
            dataset['hour'] = dataset['Timestamp'].dt.hour
            dataset['day_of_week'] = dataset['Timestamp'].dt.dayofweek
            dataset['is_weekend'] = dataset['day_of_week'].apply(lambda x: 1 if x >= 5 else 0)
            dataset['is_peak'] = dataset['hour'].apply(lambda x: 1 if (x >= 7 and x <= 9) or (x >= 17 and x <= 19) else 0)
            dataset['month'] = dataset['Timestamp'].dt.month
        
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
            
            # Drop temporary column
            dataset.drop('date', axis=1, inplace=True)
        else:
            # Default value if holiday data is not available
            dataset['is_holiday'] = 0
        
        # Add weather data if requested
        if include_weather:
            weather_df = self.data_loader.get_weather_data(days=days)
            
            if not weather_df.empty:
                # Process weather features
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
                
                # Extract rainfall prediction if available
                if 'general_forecast' in weather_features.columns:
                    weather_features['rain_forecast'] = weather_features['general_forecast'].apply(
                        lambda x: 1 if 'rain' in str(x).lower() or 'shower' in str(x).lower() else 0
                    )
                
                # For simplicity, we'll merge weather data with the main dataset
                # based on closest date
                if 'timestamp' in weather_features.columns and 'Timestamp' in dataset.columns:
                    # Convert dataset timestamps to date for matching
                    dataset['date'] = dataset['Timestamp'].dt.date
                    weather_features['date'] = pd.to_datetime(weather_features['timestamp']).dt.date
                    
                    # Merge based on date
                    dataset = pd.merge(
                        dataset,
                        weather_features[['date', 'temp_high', 'temp_low', 'rain_forecast']],
                        on='date',
                        how='left'
                    )
                    
                    # Drop temporary columns
                    dataset.drop('date', axis=1, inplace=True)
                else:
                    # Add default weather values
                    dataset['temp_high'] = 30.0
                    dataset['temp_low'] = 25.0
                    dataset['rain_forecast'] = 0
            else:
                logger.warning("No weather data available, adding default values")
                # Add default weather values
                dataset['temp_high'] = 30.0
                dataset['temp_low'] = 25.0
                dataset['rain_forecast'] = 0
        
        # Add incident data if requested
        if include_incidents:
            incidents_df = self.data_loader.get_incidents(days=days)
            
            if not incidents_df.empty:
                # Add incident counts by expressway and timestamp
                if 'Expressway' in dataset.columns and 'Timestamp' in dataset.columns:
                    # Create a time window for each travel time record
                    dataset['window_start'] = dataset['Timestamp'] - timedelta(hours=1)
                    dataset['window_end'] = dataset['Timestamp'] + timedelta(hours=1)
                    
                    # Initialize incident count column
                    dataset['incident_count'] = 0
                    
                    # For each expressway, count relevant incidents
                    for expressway in dataset['Expressway'].unique():
                        # Filter incidents that mention this expressway
                        if 'Message' in incidents_df.columns and 'Timestamp' in incidents_df.columns:
                            expressway_incidents = incidents_df[
                                incidents_df['Message'].str.contains(expressway, na=False)
                            ]
                            
                            # For each travel time record
                            for idx, row in dataset[dataset['Expressway'] == expressway].iterrows():
                                # Count incidents in the time window
                                relevant_incidents = expressway_incidents[
                                    (expressway_incidents['Timestamp'] >= row['window_start']) &
                                    (expressway_incidents['Timestamp'] <= row['window_end'])
                                ]
                                
                                # Update the count
                                dataset.at[idx, 'incident_count'] = len(relevant_incidents)
                    
                    # Drop temporary columns
                    dataset.drop(['window_start', 'window_end'], axis=1, inplace=True)
                else:
                    # Default incident count
                    dataset['incident_count'] = 0
            else:
                # Default incident count
                dataset['incident_count'] = 0
        
        # Add traffic speed data if available
        speed_bands_df = self.data_loader.get_traffic_speed_bands(days=days)
        
        if not speed_bands_df.empty:
            # For each expressway, find the average speed band in the last hour
            if 'Expressway' in dataset.columns and 'Timestamp' in dataset.columns:
                dataset['avg_speed_band'] = 3.0  # Default middle value
                
                # Create a time window for each travel time record
                dataset['window_start'] = dataset['Timestamp'] - timedelta(hours=1)
                
                # Map expressway names to relevant road names in speed bands data
                expressway_map = {
                    'PIE': 'PIE',
                    'AYE': 'AYE',
                    'CTE': 'CTE',
                    'ECP': 'ECP',
                    'TPE': 'TPE',
                    'SLE': 'SLE',
                    'BKE': 'BKE',
                    'KJE': 'KJE',
                    'KPE': 'KPE'
                }
                
                # For each expressway, add average speed
                for exp_code, exp_name in expressway_map.items():
                    if 'RoadName' in speed_bands_df.columns and 'Timestamp' in speed_bands_df.columns:
                        # Filter speed bands for this expressway
                        exp_speeds = speed_bands_df[
                            speed_bands_df['RoadName'].str.contains(exp_name, na=False)
                        ]
                        
                        if not exp_speeds.empty and 'SpeedBand' in exp_speeds.columns:
                            # For each travel time record for this expressway
                            for idx, row in dataset[dataset['Expressway'] == exp_code].iterrows():
                                # Find recent speed bands
                                recent_speeds = exp_speeds[
                                    (exp_speeds['Timestamp'] >= row['window_start']) &
                                    (exp_speeds['Timestamp'] <= row['Timestamp'])
                                ]
                                
                                if not recent_speeds.empty:
                                    # Calculate average speed band
                                    avg_speed = recent_speeds['SpeedBand'].mean()
                                    dataset.at[idx, 'avg_speed_band'] = avg_speed
                
                # Drop temporary column
                dataset.drop('window_start', axis=1, inplace=True)
        
        logger.info(f"Data loading complete, travel time dataset has {len(dataset)} rows and {len(dataset.columns)} columns")
        return dataset
    
    def train_model(self, training_data=None, by_expressway=True, test_size=0.2, n_estimators=100):
        """
        Train the travel time prediction model.
        
        Args:
            training_data (pandas.DataFrame, optional): Pre-loaded training data
            by_expressway (bool): Whether to train separate models for each expressway
            test_size (float): Proportion of data to use for testing
            n_estimators (int): Number of estimators for the gradient boosting
            
        Returns:
            dict: Training performance metrics
        """
        logger.info("Training travel time prediction model")
        
        # Load data if not provided
        if training_data is None or training_data.empty:
            training_data = self.load_data(days=30)
            
            if training_data.empty:
                logger.error("No training data available for travel time model")
                return {"error": "No training data available"}
        
        # Ensure target variable is present
        if 'Esttime' not in training_data.columns:
            logger.error("Target column 'Esttime' missing from training data")
            return {"error": "Target column 'Esttime' missing"}
        
        # Prepare features
        feature_cols = [
            'hour', 'day_of_week', 'is_weekend', 'is_holiday', 'is_peak',
            'Direction', 'temp_high', 'rain_forecast', 'incident_count'
        ]
        
        # Add speed band feature if available
        if 'avg_speed_band' in training_data.columns:
            feature_cols.append('avg_speed_band')
        
        # Add categorical features
        categorical_features = ['Direction']
        
        # For the combined model, add Expressway as a feature
        if not by_expressway:
            feature_cols.append('Expressway')
            categorical_features.append('Expressway')
        
        # Ensure all required columns exist
        for col in feature_cols:
            if col not in training_data.columns:
                # For optional features, set defaults
                if col in ['temp_high', 'rain_forecast', 'incident_count', 'avg_speed_band']:
                    if col == 'temp_high':
                        training_data[col] = 30.0
                    elif col == 'rain_forecast':
                        training_data[col] = 0
                    elif col == 'incident_count':
                        training_data[col] = 0
                    elif col == 'avg_speed_band':
                        training_data[col] = 3.0
                else:
                    logger.error(f"Required column {col} missing from training data")
                    return {"error": f"Required column {col} missing"}
        
        # Training metrics
        all_metrics = {}
        
        if by_expressway:
            # Train separate models for each expressway
            expressways = training_data['Expressway'].unique()
            
            for expressway in expressways:
                logger.info(f"Training model for expressway {expressway}")
                
                # Filter data for this expressway
                expressway_data = training_data[training_data['Expressway'] == expressway]
                
                if len(expressway_data) < 50:
                    logger.warning(f"Limited data for expressway {expressway}: only {len(expressway_data)} samples")
                    continue
                
                # Drop rows with missing values
                expressway_data = expressway_data.dropna(subset=feature_cols + ['Esttime'])
                
                # Split data
                X = expressway_data[feature_cols]
                y = expressway_data['Esttime']
                
                X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=test_size, random_state=42)
                
                # Define model pipeline
                numeric_features = [col for col in feature_cols if col not in categorical_features]
                
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
                
                # Calculate metrics
                mae = np.mean(np.abs(y_test - y_pred))
                mse = np.mean((y_test - y_pred) ** 2)
                rmse = np.sqrt(mse)
                
                metrics = {
                    'mean_absolute_error': mae,
                    'mean_squared_error': mse,
                    'root_mean_squared_error': rmse,
                    'training_samples': len(X_train),
                    'testing_samples': len(X_test)
                }
                
                all_metrics[expressway] = metrics
                
                # Save model
                self.expressway_models[expressway] = pipeline
                
                if self.model_path:
                    os.makedirs(self.model_path, exist_ok=True)
                    joblib.dump(pipeline, os.path.join(self.model_path, f'travel_time_{expressway}_model.joblib'))
                    logger.info(f"Model for expressway {expressway} saved")
            
            # Combine metrics
            all_metrics['overall'] = {
                'models_trained': len(self.expressway_models),
                'expressways': list(self.expressway_models.keys()),
                'avg_mae': np.mean([m['mean_absolute_error'] for m in all_metrics.values() if 'mean_absolute_error' in m])
            }
            
        else:
            # Train a single model for all expressways
            logger.info("Training combined travel time model")
            
            # Drop rows with missing values
            training_data = training_data.dropna(subset=feature_cols + ['Esttime'])
            
            # Split data
            X = training_data[feature_cols]
            y = training_data['Esttime']
            
            X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=test_size, random_state=42)
            
            # Define model pipeline
            numeric_features = [col for col in feature_cols if col not in categorical_features]
            
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
            
            # Calculate metrics
            mae = np.mean(np.abs(y_test - y_pred))
            mse = np.mean((y_test - y_pred) ** 2)
            rmse = np.sqrt(mse)
            
            all_metrics = {
                'mean_absolute_error': mae,
                'mean_squared_error': mse,
                'root_mean_squared_error': rmse,
                'training_samples': len(X_train),
                'testing_samples': len(X_test)
            }
            
            # Save model
            self.travel_time_model = pipeline
            
            if self.model_path:
                os.makedirs(self.model_path, exist_ok=True)
                joblib.dump(pipeline, os.path.join(self.model_path, 'travel_time_model.joblib'))
                logger.info("Combined travel time model saved")
        
        logger.info(f"Travel time model training complete")
        
        # Update training timestamp
        if self.model_path:
            with open(os.path.join(self.model_path, 'travel_time_model_last_trained.txt'), 'w') as f:
                f.write(datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
        
        return all_metrics
    
    def load_models(self):
        """Load saved models from disk."""
        if not self.model_path or not os.path.exists(self.model_path):
            logger.error(f"Model path does not exist: {self.model_path}")
            return False
        
        try:
            # Check for combined model
            combined_model_path = os.path.join(self.model_path, 'travel_time_model.joblib')
            if os.path.exists(combined_model_path):
                self.travel_time_model = joblib.load(combined_model_path)
                logger.info(f"Loaded combined travel time model from {combined_model_path}")
            
            # Check for expressway-specific models
            expressways = ['PIE', 'AYE', 'CTE', 'ECP', 'TPE', 'SLE', 'BKE', 'KJE', 'KPE']
            
            for expressway in expressways:
                model_path = os.path.join(self.model_path, f'travel_time_{expressway}_model.joblib')
                if os.path.exists(model_path):
                    self.expressway_models[expressway] = joblib.load(model_path)
                    logger.info(f"Loaded model for expressway {expressway}")
            
            if self.travel_time_model or self.expressway_models:
                return True
            else:
                logger.error("No travel time models found")
                return False
        except Exception as e:
            logger.error(f"Error loading travel time models: {e}")
            return False
    
    def predict_travel_time(self, expressway, direction, current_time=None):
        """
        Predict travel time for a specific expressway and direction.
        
        Args:
            expressway (str): Expressway code (e.g., 'PIE', 'CTE')
            direction (str): Direction code
            current_time (datetime, optional): Time for prediction. Defaults to current time.
            
        Returns:
            dict: Prediction result with travel time and confidence
        """
        if not self.expressway_models and not self.travel_time_model:
            logger.error("No travel time models available")
            return {
                'error': 'Models not available',
                'status': 'error'
            }
        
        try:
            # Use current time if not provided
            if current_time is None:
                current_time = datetime.now()
            
            # Extract time features
            hour = current_time.hour
            day_of_week = current_time.weekday()
            is_weekend = 1 if day_of_week >= 5 else 0
            is_peak = 1 if (hour >= 7 and hour <= 9) or (hour >= 17 and hour <= 19) else 0
            
            # Check if it's a holiday
            is_holiday = 0
            holidays_df = self.data_loader.get_historical_holidays()
            if not holidays_df.empty:
                current_date = current_time.date()
                if 'Date' in holidays_df.columns:
                    holidays_df['date'] = pd.to_datetime(holidays_df['Date']).dt.date
                    is_holiday = 1 if current_date in set(holidays_df['date']) else 0
            
            # Get weather data
            temp_high = 30.0
            rain_forecast = 0
            
            weather_data = self.data_loader.get_weather_data(days=1)
            if not weather_data.empty:
                # Get most recent weather data
                if 'temp_high' in weather_data.columns:
                    temp_high = weather_data.iloc[0]['temp_high']
                
                if 'rain_forecast' in weather_data.columns:
                    rain_forecast = weather_data.iloc[0]['rain_forecast']
                elif 'general_forecast' in weather_data.columns:
                    forecast = weather_data.iloc[0]['general_forecast']
                    rain_forecast = 1 if isinstance(forecast, str) and ('rain' in forecast.lower() or 'shower' in forecast.lower()) else 0
            
            # Count incidents
            incident_count = 0
            incidents = self.data_loader.get_incidents(days=1)
            
            if not incidents.empty and 'Message' in incidents.columns:
                # Filter incidents for this expressway in the last hour
                recent_incidents = incidents[
                    (incidents['Timestamp'] >= current_time - timedelta(hours=1)) &
                    (incidents['Message'].str.contains(expressway, na=False))
                ]
                
                incident_count = len(recent_incidents)
            
            # Get speed band if available
            avg_speed_band = 3.0  # Default middle value
            
            speed_bands = self.data_loader.get_traffic_speed_bands(days=1)
            if not speed_bands.empty and 'RoadName' in speed_bands.columns and 'SpeedBand' in speed_bands.columns:
                # Filter for this expressway in the last hour
                recent_speeds = speed_bands[
                    (speed_bands['Timestamp'] >= current_time - timedelta(hours=1)) &
                    (speed_bands['RoadName'].str.contains(expressway, na=False))
                ]
                
                if not recent_speeds.empty:
                    avg_speed_band = recent_speeds['SpeedBand'].mean()
            
            # Create feature dictionary
            features = {
                'Expressway': expressway,
                'Direction': direction,
                'hour': hour,
                'day_of_week': day_of_week,
                'is_weekend': is_weekend,
                'is_holiday': is_holiday,
                'is_peak': is_peak,
                'temp_high': temp_high,
                'rain_forecast': rain_forecast,
                'incident_count': incident_count,
                'avg_speed_band': avg_speed_band
            }
            
            # Convert to DataFrame for prediction
            feature_df = pd.DataFrame([features])
            
            # Select model based on availability
            prediction = None
            
            if expressway in self.expressway_models:
                # Use expressway-specific model
                model = self.expressway_models[expressway]
                prediction = model.predict(feature_df[model.feature_names_in_])[0]
            elif self.travel_time_model:
                # Use combined model
                prediction = self.travel_time_model.predict(feature_df[self.travel_time_model.feature_names_in_])[0]
            else:
                # Fallback to real-time data
                return self.get_current_travel_time(expressway, direction)
            
            # Calculate confidence interval based on incident count and weather
            confidence = "high"
            if incident_count > 0:
                confidence = "medium"
            if incident_count > 1 or rain_forecast == 1:
                confidence = "low"
            
            return {
                'status': 'success',
                'expressway': expressway,
                'direction': direction,
                'predicted_time': round(prediction, 1),
                'confidence': confidence,
                'factors': {
                    'time_of_day': 'peak_hour' if is_peak else 'off_peak',
                    'day_type': 'weekend' if is_weekend else 'weekday',
                    'holiday': 'yes' if is_holiday else 'no',
                    'weather': 'rainy' if rain_forecast else 'clear',
                    'incidents': incident_count,
                    'traffic_condition': self._speed_band_to_condition(avg_speed_band)
                }
            }
        except Exception as e:
            logger.error(f"Error predicting travel time: {e}")
            return {
                'error': str(e),
                'status': 'error'
            }
    
    def get_current_travel_time(self, expressway, direction):
        """
        Get the current travel time from realtime data.
        
        Args:
            expressway (str): Expressway code
            direction (str): Direction code
            
        Returns:
            dict: Current travel time information
        """
        try:
            # Get latest travel time data
            travel_times = self.data_loader.get_travel_times(days=1)
            
            if travel_times.empty:
                return {
                    'error': 'No recent travel time data available',
                    'status': 'error'
                }
            
            # Filter for this expressway and direction
            filtered = travel_times[
                (travel_times['Expressway'] == expressway) &
                (travel_times['Direction'] == direction)
            ]
            
            if filtered.empty:
                return {
                    'error': f'No data found for expressway {expressway} direction {direction}',
                    'status': 'error'
                }
            
            # Sort by timestamp to get the most recent
            if 'Timestamp' in filtered.columns:
                filtered = filtered.sort_values('Timestamp', ascending=False)
            
            # Get the most recent travel time
            current_time = filtered.iloc[0]['Esttime']
            
            # Get the timestamp
            timestamp = filtered.iloc[0]['Timestamp'] if 'Timestamp' in filtered.columns else None
            time_since_update = (datetime.now() - timestamp).total_seconds() / 60 if timestamp else None
            
            return {
                'status': 'success',
                'expressway': expressway,
                'direction': direction,
                'current_time': round(current_time, 1),
                'last_updated': timestamp.strftime('%Y-%m-%d %H:%M:%S') if timestamp else None,
                'minutes_since_update': round(time_since_update, 1) if time_since_update else None,
                'is_realtime': True
            }
        except Exception as e:
            logger.error(f"Error getting current travel time: {e}")
            return {
                'error': str(e),
                'status': 'error'
            }
    
    def _speed_band_to_condition(self, speed_band):
        """Convert speed band to traffic condition description."""
        if speed_band <= 1.5:
            return "severe congestion"
        elif speed_band <= 2.5:
            return "heavy traffic"
        elif speed_band <= 3.5:
            return "moderate traffic"
        elif speed_band <= 4.5:
            return "light traffic"
        else:
            return "free flowing"
    
    def compare_routes(self, routes):
        """
        Compare travel times for different expressway routes.
        
        Args:
            routes (list): List of dictionaries with expressway and direction
            
        Returns:
            dict: Comparison of routes with predicted travel times
        """
        if not routes or not isinstance(routes, list):
            return {
                'error': 'Invalid routes parameter',
                'status': 'error'
            }
        
        results = []
        
        for route in routes:
            expressway = route.get('expressway')
            direction = route.get('direction')
            
            if not expressway or not direction:
                continue
            
            # Get prediction for this route
            prediction = self.predict_travel_time(expressway, direction)
            
            if prediction.get('status') == 'success':
                results.append({
                    'expressway': expressway,
                    'direction': direction,
                    'travel_time': prediction.get('predicted_time'),
                    'confidence': prediction.get('confidence'),
                    'factors': prediction.get('factors')
                })
        
        if not results:
            return {
                'error': 'Could not generate predictions for any routes',
                'status': 'error'
            }
        
        # Sort by travel time
        results = sorted(results, key=lambda x: x.get('travel_time', float('inf')))
        
        # Find the fastest route
        fastest = results[0]
        
        return {
            'status': 'success',
            'routes': results,
            'fastest_route': fastest,
            'comparison_time': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'route_count': len(results)
        }
    
    def get_historical_patterns(self, expressway, direction, day_type=None):
        """
        Get historical travel time patterns for a route.
        
        Args:
            expressway (str): Expressway code
            direction (str): Direction code
            day_type (str, optional): 'weekday', 'weekend', or None for all
            
        Returns:
            dict: Historical patterns
        """
        try:
            # Load historical data
            travel_times = self.data_loader.get_travel_times(days=30)
            
            if travel_times.empty:
                return {
                    'error': 'No historical travel time data available',
                    'status': 'error'
                }
            
            # Filter for this expressway and direction
            filtered = travel_times[
                (travel_times['Expressway'] == expressway) &
                (travel_times['Direction'] == direction)
            ]
            
            if filtered.empty:
                return {
                    'error': f'No data found for expressway {expressway} direction {direction}',
                    'status': 'error'
                }
            
            # Add time-based features if not present
            if 'hour' not in filtered.columns and 'Timestamp' in filtered.columns:
                filtered['hour'] = filtered['Timestamp'].dt.hour
                filtered['day_of_week'] = filtered['Timestamp'].dt.dayofweek
                filtered['is_weekend'] = filtered['day_of_week'].apply(lambda x: 1 if x >= 5 else 0)
            
            # Apply day type filter if specified
            if day_type == 'weekday':
                filtered = filtered[filtered['is_weekend'] == 0]
            elif day_type == 'weekend':
                filtered = filtered[filtered['is_weekend'] == 1]
            
            # Group by hour and calculate statistics
            hourly_stats = filtered.groupby('hour')['Esttime'].agg(['mean', 'min', 'max', 'count']).reset_index()
            
            # Convert to dict for JSON serialization
            hourly_data = []
            for _, row in hourly_stats.iterrows():
                hourly_data.append({
                    'hour': int(row['hour']),
                    'avg_time': round(row['mean'], 1),
                    'min_time': round(row['min'], 1),
                    'max_time': round(row['max'], 1),
                    'sample_count': int(row['count'])
                })
            
            # Calculate peak hours
            if not hourly_data:
                peak_morning = None
                peak_evening = None
            else:
                morning_hours = [h for h in hourly_data if h['hour'] >= 6 and h['hour'] <= 10]
                evening_hours = [h for h in hourly_data if h['hour'] >= 16 and h['hour'] <= 20]
                
                peak_morning = max(morning_hours, key=lambda x: x['avg_time']) if morning_hours else None
                peak_evening = max(evening_hours, key=lambda x: x['avg_time']) if evening_hours else None
            
            # Get day of week patterns
            day_stats = filtered.groupby('day_of_week')['Esttime'].mean().reset_index()
            day_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
            
            day_data = []
            for _, row in day_stats.iterrows():
                day_idx = int(row['day_of_week'])
                if 0 <= day_idx < len(day_names):
                    day_data.append({
                        'day': day_names[day_idx],
                        'avg_time': round(row['Esttime'], 1)
                    })
            
            return {
                'status': 'success',
                'expressway': expressway,
                'direction': direction,
                'day_type': day_type or 'all',
                'hourly_patterns': hourly_data,
                'daily_patterns': day_data,
                'peak_morning': peak_morning,
                'peak_evening': peak_evening,
                'data_range': {
                    'start_date': filtered['Timestamp'].min().strftime('%Y-%m-%d') if 'Timestamp' in filtered.columns else None,
                    'end_date': filtered['Timestamp'].max().strftime('%Y-%m-%d') if 'Timestamp' in filtered.columns else None,
                    'days': (filtered['Timestamp'].max() - filtered['Timestamp'].min()).days + 1 if 'Timestamp' in filtered.columns else None
                }
            }
        except Exception as e:
            logger.error(f"Error getting historical patterns: {e}")
            return {
                'error': str(e),
                'status': 'error'
            }