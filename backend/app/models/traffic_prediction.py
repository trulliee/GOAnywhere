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
from storage.gcs_utils import initialize_storage_client, download_from_gcs, list_gcs_files
import logging

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

class TrafficWeatherPredictor:
    def __init__(self):
        """Initialize the predictor with trained models."""
        self.road_conditions_model = None
        self.delay_model = None
        self.weather_conditions_model = None
        self.travel_time_model = None
        self.incidents_model = None
        self.load_models()
        
    def load_models(self):
        """Load trained models if they exist, otherwise train new ones."""
        try:
            if os.path.exists(ROAD_CONDITIONS_MODEL):
                self.road_conditions_model = joblib.load(ROAD_CONDITIONS_MODEL)
                logger.info("Loaded road conditions model")
            
            if os.path.exists(DELAY_MODEL):
                self.delay_model = joblib.load(DELAY_MODEL)
                logger.info("Loaded delay model")
                
            if os.path.exists(WEATHER_CONDITIONS_MODEL):
                self.weather_conditions_model = joblib.load(WEATHER_CONDITIONS_MODEL)
                logger.info("Loaded weather conditions model")
                
            if os.path.exists(TRAVEL_TIME_MODEL):
                self.travel_time_model = joblib.load(TRAVEL_TIME_MODEL)
                logger.info("Loaded travel time model")
                
            if os.path.exists(INCIDENTS_MODEL):
                self.incidents_model = joblib.load(INCIDENTS_MODEL)
                logger.info("Loaded incidents model")
                
        except Exception as e:
            logger.error(f"Error loading models: {e}")
            logger.info("Will train new models if data is available")
    
    def fetch_data(self):
        """Fetch data from both Firestore and Google Cloud Storage."""
        data = {
            'traffic_speed_bands': fetch_firestore_data('traffic_speed_bands', limit=1000),
            'traffic_incidents': fetch_firestore_data('traffic_incidents', limit=1000),
            'estimated_travel_times': fetch_firestore_data('estimated_travel_times', limit=1000),
            'vms_messages': fetch_firestore_data('vms_messages', limit=1000),
            'weather_data': fetch_firestore_data('weather_data', limit=100),
            'weather_forecast_24hr': fetch_firestore_data('weather_forecast_24hr', limit=100)
        }
        
        # Fetch historical data from Google Cloud Storage
        BUCKET_NAME = "goanywhere-traffic-data-history"
        storage_client = initialize_storage_client()
        
        if storage_client:
            # Create a temporary directory for downloads if it doesn't exist
            temp_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'storage', 'temp')
            os.makedirs(temp_dir, exist_ok=True)
            
            # List files in the GCS bucket
            gcs_files = list_gcs_files(BUCKET_NAME)
            logger.info(f"Found {len(gcs_files)} files in GCS bucket")
            
            # Download and process each CSV file
            for blob_name in gcs_files:
                if blob_name.endswith('.csv'):
                    local_path = os.path.join(temp_dir, os.path.basename(blob_name))
                    
                    try:
                        # Download file from GCS
                        success = download_from_gcs(BUCKET_NAME, blob_name, local_path)
                        
                        if success:
                            # Read and process CSV
                            csv_data = pd.read_csv(local_path)
                            
                            # Categorize based on filename
                            filename = os.path.basename(blob_name).lower()
                            if 'trafficspeedbands' in filename or 'traffic_speed_bands' in filename:
                                data['historical_speed_bands'] = csv_data.to_dict('records')
                            elif 'trafficincidents' in filename or 'traffic_incidents' in filename or 'accident' in filename:
                                data['historical_incidents'] = csv_data.to_dict('records')
                            elif 'estimatedtraveltimes' in filename or 'travel_times' in filename:
                                data['historical_travel_times'] = csv_data.to_dict('records')
                            elif 'vms' in filename:
                                data['historical_vms'] = csv_data.to_dict('records')
                            elif 'weather' in filename:
                                data['historical_weather'] = csv_data.to_dict('records')
                            elif 'holidays' in filename:
                                data['holidays'] = csv_data.to_dict('records')
                                
                            logger.info(f"Loaded historical data from GCS: {blob_name}")
                    except Exception as e:
                        logger.error(f"Error processing GCS file {blob_name}: {e}")
        else:
            logger.warning("Failed to initialize GCS client. Will use local data if available.")
            
            # Fallback to local CSV files if GCS access fails
            uploads_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'storage', 'uploads')
            
            try:
                for filename in os.listdir(uploads_dir):
                    if filename.endswith('.csv'):
                        filepath = os.path.join(uploads_dir, filename)
                        try:
                            csv_data = pd.read_csv(filepath)
                            filename_lower = filename.lower()
                            if 'traffic_speed_bands' in filename_lower:
                                data['historical_speed_bands'] = csv_data.to_dict('records')
                            elif 'traffic_incidents' in filename_lower or 'accident' in filename_lower:
                                data['historical_incidents'] = csv_data.to_dict('records')
                            elif 'travel_times' in filename_lower:
                                data['historical_travel_times'] = csv_data.to_dict('records')
                            elif 'vms' in filename_lower:
                                data['historical_vms'] = csv_data.to_dict('records')
                            elif 'weather' in filename_lower:
                                data['historical_weather'] = csv_data.to_dict('records')
                            elif 'holidays' in filename_lower:
                                data['holidays'] = csv_data.to_dict('records')
                            logger.info(f"Loaded historical data from local file: {filename}")
                        except Exception as e:
                            logger.error(f"Error loading CSV file {filename}: {e}")
            except Exception as e:
                logger.error(f"Error accessing uploads directory: {e}")
        
        return data
    
    def preprocess_data(self, data):
        """Preprocess data for model training."""
        processed_data = {}
        
        # Extract holiday data if available
        holidays = []
        if 'holidays' in data and data['holidays']:
            holidays_df = pd.DataFrame(data['holidays'])
            if 'Date' in holidays_df.columns:
                # Convert to datetime and extract just the dates
                holidays_df['Date'] = pd.to_datetime(holidays_df['Date'])
                holidays = holidays_df['Date'].dt.date.tolist()
                logger.info(f"Loaded {len(holidays)} holiday dates")
        
        # Process speed bands data (real-time + historical)
        speed_bands = data.get('traffic_speed_bands', [])
        historical_speed_bands = data.get('historical_speed_bands', [])
        
        if speed_bands or historical_speed_bands:
            # Combine real-time and historical data
            all_speed_bands = speed_bands + historical_speed_bands
            
            # Convert to DataFrame
            speed_df = pd.DataFrame(all_speed_bands)
            
            # Clean and preprocess
            if not speed_df.empty:
                # Handle timestamps
                if 'Timestamp' in speed_df.columns:
                    speed_df['Timestamp'] = pd.to_datetime(speed_df['Timestamp'])
                    speed_df['Hour'] = speed_df['Timestamp'].dt.hour
                    speed_df['DayOfWeek'] = speed_df['Timestamp'].dt.dayofweek
                    speed_df['IsWeekend'] = speed_df['DayOfWeek'].apply(lambda x: 1 if x >= 5 else 0)
                    
                    # Add holiday feature if we have holiday data
                    if holidays:
                        speed_df['IsHoliday'] = speed_df['Timestamp'].dt.date.isin(holidays).astype(int)
                    else:
                        speed_df['IsHoliday'] = 0
                
                # Fill missing values
                speed_df = speed_df.fillna({
                    'SpeedBand': 0,
                    'MinSpeed': 0,
                    'MaxSpeed': 0
                })
                
                processed_data['speed_bands'] = speed_df
        
        # Process travel times data (real-time + historical)
        travel_times = data.get('estimated_travel_times', [])
        historical_travel_times = data.get('historical_travel_times', [])
        
        if travel_times or historical_travel_times:
            # Combine real-time and historical data
            all_travel_times = travel_times + historical_travel_times
            
            # Convert to DataFrame
            travel_df = pd.DataFrame(all_travel_times)
            
            # Clean and preprocess
            if not travel_df.empty:
                # Handle timestamps
                if 'Timestamp' in travel_df.columns:
                    travel_df['Timestamp'] = pd.to_datetime(travel_df['Timestamp'])
                    travel_df['Hour'] = travel_df['Timestamp'].dt.hour
                    travel_df['DayOfWeek'] = travel_df['Timestamp'].dt.dayofweek
                    travel_df['IsWeekend'] = travel_df['DayOfWeek'].apply(lambda x: 1 if x >= 5 else 0)
                    
                    # Add holiday feature if we have holiday data
                    if holidays:
                        travel_df['IsHoliday'] = travel_df['Timestamp'].dt.date.isin(holidays).astype(int)
                    else:
                        travel_df['IsHoliday'] = 0
                
                # Convert estimated time to numeric
                if 'Esttime' in travel_df.columns:
                    travel_df['Esttime'] = pd.to_numeric(travel_df['Esttime'], errors='coerce')
                
                # Fill missing values
                travel_df = travel_df.fillna({
                    'Esttime': travel_df['Esttime'].mean() if 'Esttime' in travel_df.columns else 0
                })
                
                processed_data['travel_times'] = travel_df
        
        # Process incidents data (real-time + historical)
        incidents = data.get('traffic_incidents', [])
        historical_incidents = data.get('historical_incidents', [])
        
        if incidents or historical_incidents:
            # Combine real-time and historical data
            all_incidents = incidents + historical_incidents
            
            # Convert to DataFrame
            incidents_df = pd.DataFrame(all_incidents)
            
            # Clean and preprocess
            if not incidents_df.empty:
                # Handle timestamps
                if 'Timestamp' in incidents_df.columns:
                    incidents_df['Timestamp'] = pd.to_datetime(incidents_df['Timestamp'])
                    incidents_df['Hour'] = incidents_df['Timestamp'].dt.hour
                    incidents_df['DayOfWeek'] = incidents_df['Timestamp'].dt.dayofweek
                    incidents_df['IsWeekend'] = incidents_df['DayOfWeek'].apply(lambda x: 1 if x >= 5 else 0)
                    
                    # Add holiday feature if we have holiday data
                    if holidays:
                        incidents_df['IsHoliday'] = incidents_df['Timestamp'].dt.date.isin(holidays).astype(int)
                    else:
                        incidents_df['IsHoliday'] = 0
                
                # Process accident casualty data if available (from data.gov.sg)
                if 'Year' in incidents_df.columns and 'Fatalities' in incidents_df.columns:
                    # This is likely the RoadTrafficAccidentCasualtiesAnnual.csv data
                    incidents_df['HasFatality'] = incidents_df['Fatalities'].apply(lambda x: 1 if x > 0 else 0)
                
                processed_data['incidents'] = incidents_df
        
        # Process weather data (real-time + historical)
        weather_data = data.get('weather_data', [])
        weather_forecast = data.get('weather_forecast_24hr', [])
        historical_weather = data.get('historical_weather', [])
        
        if weather_data or historical_weather:
            # Combine real-time and historical data
            all_weather = weather_data + (historical_weather if historical_weather else [])
            
            # Convert to DataFrame
            weather_df = pd.DataFrame(all_weather)
            
            # Clean and preprocess
            if not weather_df.empty:
                # Handle timestamps if present in historical data
                if 'Timestamp' in weather_df.columns:
                    weather_df['Timestamp'] = pd.to_datetime(weather_df['Timestamp'])
                    weather_df['Hour'] = weather_df['Timestamp'].dt.hour
                    weather_df['DayOfWeek'] = weather_df['Timestamp'].dt.dayofweek
                    weather_df['IsWeekend'] = weather_df['DayOfWeek'].apply(lambda x: 1 if x >= 5 else 0)
                    
                    # Add holiday feature if we have holiday data
                    if holidays:
                        weather_df['IsHoliday'] = weather_df['Timestamp'].dt.date.isin(holidays).astype(int)
                
                # Process historical daily weather records if available
                if 'Station' in weather_df.columns and 'Rainfall Total (mm)' in weather_df.columns:
                    # This is likely the HistoricalDailyWeatherRecords.csv data
                    weather_df['HasRainfall'] = weather_df['Rainfall Total (mm)'].apply(lambda x: 1 if x > 0 else 0)
                    
                    # Convert date column if it exists
                    if 'Date' in weather_df.columns:
                        weather_df['Date'] = pd.to_datetime(weather_df['Date'])
                        weather_df['Month'] = weather_df['Date'].dt.month
                        weather_df['Year'] = weather_df['Date'].dt.year
                
                # Fill missing values for temperature and humidity for real-time data
                numeric_cols = ['temperature', 'humidity']
                for col in numeric_cols:
                    if col in weather_df.columns:
                        weather_df[col] = pd.to_numeric(weather_df[col], errors='coerce')
                        weather_df[col] = weather_df[col].fillna(weather_df[col].mean())
                
                processed_data['weather'] = weather_df
        
        return processed_data

    def create_dummy_models(self):
        """Create simple dummy models when training fails."""
        from sklearn.dummy import DummyClassifier, DummyRegressor
        
        # Road conditions model (most_frequent strategy for categorical outcomes)
        self.road_conditions_model = DummyClassifier(strategy='most_frequent')
        self.road_conditions_model.fit([[0, 0, 0]], ['Clear'])  # Single sample with default class
        
        # Delay model (binary classification)
        self.delay_model = DummyClassifier(strategy='most_frequent')
        self.delay_model.fit([[0, 0, 0]], [0])  # Single sample with "No delay"
        
        # Weather conditions model
        self.weather_conditions_model = DummyClassifier(strategy='most_frequent')
        self.weather_conditions_model.fit([[0, 0]], ['Clear'])  # Single sample with "Clear"
        
        # Travel time model (regression)
        self.travel_time_model = DummyRegressor(strategy='mean')
        self.travel_time_model.fit([[0, 0, 0]], [15.0])  # Single sample with 15 minutes
        
        # Incidents model
        self.incidents_model = DummyClassifier(strategy='most_frequent')
        self.incidents_model.fit([[0, 0, 0]], [0])  # Single sample with "No incidents"
        
        logger.info("Created dummy models as fallback")
    
    def train_models(self, data=None):
        """Train prediction models using the available data."""
        if data is None:
            data = self.fetch_data()
        
        processed_data = self.preprocess_data(data)
        
        # Train Road Conditions Model (Clear, Moderate, Congested)
        if 'speed_bands' in processed_data:
            try:
                speed_df = processed_data['speed_bands']
                
                # Feature engineering for road conditions
                if 'SpeedBand' in speed_df.columns:
                    speed_feature = 'SpeedBand'
                elif 'MaxSpeed' in speed_df.columns:
                    speed_feature = 'MaxSpeed'
                else:
                    logger.warning("No speed feature found for road conditions model")
                    return
                    
                # Make sure the speed feature is numeric
                speed_df[speed_feature] = pd.to_numeric(speed_df[speed_feature], errors='coerce')
                
                # Drop rows with NaN in the speed feature
                speed_df = speed_df.dropna(subset=[speed_feature])
                
                # Create road condition labels
                speed_df['RoadCondition'] = pd.cut(
                    speed_df[speed_feature],
                    bins=[0, 1, 3, 5],
                    labels=['Congested', 'Moderate', 'Clear']
                )
                
                # Drop rows where binning produced NaN (values outside the bins)
                speed_df = speed_df.dropna(subset=['RoadCondition'])
                
                # Select features
                features = ['Hour', 'DayOfWeek', 'IsWeekend']
                if 'IsHoliday' in speed_df.columns:
                    features.append('IsHoliday')
                
                features.append(speed_feature)
                
                # Make sure all selected features exist in the dataframe
                features = [f for f in features if f in speed_df.columns]
                
                # Make sure all features are numeric
                for feature in features:
                    speed_df[feature] = pd.to_numeric(speed_df[feature], errors='coerce')
                
                # Drop rows with NaN values in any feature
                speed_df = speed_df.dropna(subset=features + ['RoadCondition'])
                
                # Final check - make sure we have enough data
                if len(speed_df) < 10:
                    logger.warning(f"Insufficient data for road conditions model: only {len(speed_df)} valid rows")
                    return
                    
                X = speed_df[features]
                y = speed_df['RoadCondition']
                
                # Final NaN check
                if X.isna().values.any() or y.isna().any():
                    logger.warning("NaN values still present after preprocessing!")
                    # Last resort - fill NaNs in features with mean values
                    X = X.fillna(X.mean())
                    # For target, we must drop those rows
                    mask = ~y.isna()
                    X = X[mask]
                    y = y[mask]
                
                # Split the data
                X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
                
                # Create and train the model
                self.road_conditions_model = RandomForestClassifier(n_estimators=100, random_state=42)
                self.road_conditions_model.fit(X_train, y_train)
                
                # Save the model
                joblib.dump(self.road_conditions_model, ROAD_CONDITIONS_MODEL)
                logger.info("Road conditions model trained and saved")
            except Exception as e:
                logger.error(f"Error training road conditions model: {e}")
                
        # Train Delay Model (Yes/No)
        if 'travel_times' in processed_data:
            travel_df = processed_data['travel_times']
            
            # Feature engineering for delays
            if 'Esttime' in travel_df.columns:
                # Define threshold for delays (e.g., 20 minutes)
                delay_threshold = 20
                travel_df['HasDelay'] = (travel_df['Esttime'] > delay_threshold).astype(int)
                
                # Select features and target (including IsHoliday if available)
                features = ['Hour', 'DayOfWeek', 'IsWeekend']
                if 'IsHoliday' in travel_df.columns:
                    features.append('IsHoliday')
                    
                X = travel_df[features]
                y = travel_df['HasDelay']
                
                # Split the data
                X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
                
                # Create and train the model
                self.delay_model = RandomForestClassifier(n_estimators=100, random_state=42)
                self.delay_model.fit(X_train, y_train)
                
                # Save the model
                joblib.dump(self.delay_model, DELAY_MODEL)
                logger.info("Delay model trained and saved")

        # Train Weather Conditions Model
        if 'weather' in processed_data:
            weather_df = processed_data['weather']
            
            # Feature engineering for weather conditions
            if 'weather' in weather_df.columns:
                # Map weather descriptions to conditions
                weather_conditions = {
                    'clear': 'Clear',
                    'cloud': 'Cloudy',
                    'rain': 'Rain',
                    'drizzle': 'Rain',
                    'fog': 'Fog',
                    'mist': 'Fog',
                    'thunder': 'Thunderstorm',
                    'storm': 'Thunderstorm'
                }
                
                # Create a function to map weather descriptions
                def map_weather_condition(desc):
                    desc = str(desc).lower()
                    for key, value in weather_conditions.items():
                        if key in desc:
                            return value
                    return 'Other'
                
                weather_df['WeatherCondition'] = weather_df['weather'].apply(map_weather_condition)
                
                # Select features and target
                X = weather_df[['temperature', 'humidity']] if all(col in weather_df.columns for col in ['temperature', 'humidity']) else weather_df[['temperature']]
                y = weather_df['WeatherCondition']
                
                # Split the data
                X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
                
                # Create and train the model
                self.weather_conditions_model = RandomForestClassifier(n_estimators=100, random_state=42)
                self.weather_conditions_model.fit(X_train, y_train)
                
                # Save the model
                joblib.dump(self.weather_conditions_model, WEATHER_CONDITIONS_MODEL)
                logger.info("Weather conditions model trained and saved")
        
        # Train Travel Time Model (for registered users)
        if 'travel_times' in processed_data:
            travel_df = processed_data['travel_times']
            
            if 'Esttime' in travel_df.columns:
                # Select features and target (including IsHoliday if available)
                features = ['Hour', 'DayOfWeek', 'IsWeekend']
                if 'IsHoliday' in travel_df.columns:
                    features.append('IsHoliday')
                    
                # Add expressway or road info if available
                if 'Expressway' in travel_df.columns:
                    # Convert categorical Expressway to numeric via one-hot encoding
                    expressway_dummies = pd.get_dummies(travel_df['Expressway'], prefix='Expressway')
                    X = pd.concat([travel_df[features], expressway_dummies], axis=1)
                else:
                    X = travel_df[features]
                    
                y = travel_df['Esttime']
                
                # Split the data
                X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
                
                # Create and train the model
                self.travel_time_model = RandomForestRegressor(n_estimators=100, random_state=42)
                self.travel_time_model.fit(X_train, y_train)
                
                # Save the model
                joblib.dump(self.travel_time_model, TRAVEL_TIME_MODEL)
                logger.info("Travel time model trained and saved")
        
        # Train Incidents Model (for registered users)
        if 'incidents' in processed_data and 'speed_bands' in processed_data:
            incidents_df = processed_data['incidents']
            speed_df = processed_data['speed_bands']
            
            # Prepare data for incident prediction
            if not incidents_df.empty and not speed_df.empty:
                # Group incidents by hour and day of week
                if 'Hour' in incidents_df.columns and 'DayOfWeek' in incidents_df.columns:
                    incident_counts = incidents_df.groupby(['Hour', 'DayOfWeek']).size().reset_index(name='IncidentCount')
                    
                    # Merge with speed data
                    merged_df = pd.merge(
                        speed_df[['Hour', 'DayOfWeek', 'SpeedBand']] if 'SpeedBand' in speed_df.columns else speed_df[['Hour', 'DayOfWeek', 'MaxSpeed']],
                        incident_counts,
                        on=['Hour', 'DayOfWeek'],
                        how='left'
                    )
                    
                    merged_df['IncidentCount'] = merged_df['IncidentCount'].fillna(0)
                    
                    # Select features and target (including IsHoliday if available)
                    features = ['Hour', 'DayOfWeek']
                    
                    # Add IsWeekend and IsHoliday if available
                    if 'IsWeekend' in merged_df.columns:
                        features.append('IsWeekend')
                    if 'IsHoliday' in merged_df.columns:
                        features.append('IsHoliday')
                    
                    # Add SpeedBand or MaxSpeed
                    if 'SpeedBand' in merged_df.columns:
                        features.append('SpeedBand')
                    elif 'MaxSpeed' in merged_df.columns:
                        features.append('MaxSpeed')
                    
                    X = merged_df[features]
                    y = (merged_df['IncidentCount'] > 0).astype(int)  # Binary classification: incident or no incident
                    
                    # Split the data
                    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
                    
                    # Create and train the model
                    self.incidents_model = RandomForestClassifier(n_estimators=100, random_state=42)
                    self.incidents_model.fit(X_train, y_train)
                    
                    # Save the model
                    joblib.dump(self.incidents_model, INCIDENTS_MODEL)
                    logger.info("Incidents model trained and saved")
    
   # Update the get_basic_prediction method in the TrafficWeatherPredictor class

    def get_basic_prediction(self, time=None, day=None, location=None):
        """
        Generate basic prediction for unregistered users using pandas DataFrame with proper feature names.
        
        Returns:
            dict: Prediction results including road conditions, possible delays, weather conditions, and travel recommendations
        """
        # Use current time and day if not provided
        if time is None:
            now = datetime.now()
            hour = now.hour
        else:
            hour = time
            
        if day is None:
            now = datetime.now()
            day_of_week = now.weekday()
            is_weekend = 1 if day_of_week >= 5 else 0
        else:
            day_of_week = day
            is_weekend = 1 if day_of_week >= 5 else 0
        
        # Get latest traffic and weather data
        latest_speed_bands = fetch_firestore_data('traffic_speed_bands', limit=10)
        latest_travel_times = fetch_firestore_data('estimated_travel_times', limit=10)
        latest_weather = fetch_firestore_data('weather_data', limit=1)
        
        # Default values
        road_condition = "Unknown"
        has_delay = "Unknown"
        weather_condition = "Unknown"
        travel_recommendation = "Unknown"
        
        # Predict Road Condition
        if self.road_conditions_model is not None:
            # Get average speed band from latest data
            avg_speed_band = 0
            if latest_speed_bands:
                speed_bands = [item.get('SpeedBand', 0) for item in latest_speed_bands if 'SpeedBand' in item]
                if speed_bands:
                    avg_speed_band = sum(speed_bands) / len(speed_bands)
            
            # Make prediction using pandas DataFrame with proper column names
            is_holiday = 0  # Default to not a holiday
            
            # Create feature DataFrame with proper column names
            feature_names = []
            feature_values = []
            
            # Add features in the expected order
            feature_names.extend(['Hour', 'DayOfWeek', 'IsWeekend'])
            feature_values.extend([hour, day_of_week, is_weekend])
            
            # Add IsHoliday if model expects it
            if hasattr(self.road_conditions_model, 'n_features_in_') and self.road_conditions_model.n_features_in_ > 4:
                feature_names.append('IsHoliday')
                feature_values.append(is_holiday)
            
            # Add speed feature - use 'SpeedBand' as this appears to be what was used in training
            feature_names.append('SpeedBand')
            feature_values.append(avg_speed_band)
            
            # Create DataFrame with proper column names
            features_df = pd.DataFrame([feature_values], columns=feature_names)
            
            try:
                road_condition = self.road_conditions_model.predict(features_df)[0]
                
                # Get confidence score
                road_condition_probs = self.road_conditions_model.predict_proba(features_df)[0]
                max_prob = max(road_condition_probs)
                
                # If confidence is low, use a rule-based approach
                if max_prob < 0.6:
                    if avg_speed_band <= 1:
                        road_condition = "Congested"
                    elif avg_speed_band <= 3:
                        road_condition = "Moderate"
                    else:
                        road_condition = "Clear"
            except Exception as e:
                logger.error(f"Error predicting road condition: {e}")
                # Fallback to rule-based approach
                if avg_speed_band <= 1:
                    road_condition = "Congested"
                elif avg_speed_band <= 3:
                    road_condition = "Moderate"
                else:
                    road_condition = "Clear"
        else:
            # Fallback to rule-based approach
            avg_speed_band = 0
            if latest_speed_bands:
                speed_bands = [item.get('SpeedBand', 0) for item in latest_speed_bands if 'SpeedBand' in item]
                if speed_bands:
                    avg_speed_band = sum(speed_bands) / len(speed_bands)
            
            if avg_speed_band <= 1:
                road_condition = "Congested"
            elif avg_speed_band <= 3:
                road_condition = "Moderate"
            else:
                road_condition = "Clear"
        
        # Predict Possible Delays
        if self.delay_model is not None:
            # Create feature DataFrame with proper column names
            feature_names = ['Hour', 'DayOfWeek', 'IsWeekend']
            feature_values = [hour, day_of_week, is_weekend]
            
            # Add IsHoliday if model expects it
            if hasattr(self.delay_model, 'n_features_in_') and self.delay_model.n_features_in_ > 3:
                feature_names.append('IsHoliday')
                feature_values.append(0)  # Default to not a holiday
            
            # Create DataFrame with proper column names
            features_df = pd.DataFrame([feature_values], columns=feature_names)
            
            try:
                delay_prediction = self.delay_model.predict(features_df)[0]
                has_delay = "Yes" if delay_prediction == 1 else "No"
            except Exception as e:
                logger.error(f"Error predicting delay: {e}")
                # Fallback to rule-based approach
                has_delay = "No"  # Default
        else:
            # Fallback to rule-based approach
            avg_travel_time = 0
            if latest_travel_times:
                travel_times = [item.get('Esttime', 0) for item in latest_travel_times if 'Esttime' in item]
                if travel_times:
                    avg_travel_time = sum(travel_times) / len(travel_times)
            
            has_delay = "Yes" if avg_travel_time > 20 else "No"
        
        # Predict Weather Condition
        if self.weather_conditions_model is not None and latest_weather:
            if latest_weather:
                temp = latest_weather[0].get('temperature', 25)
                humidity = latest_weather[0].get('humidity', 75)
                
                # Create feature DataFrame with proper column names
                feature_names = ['temperature', 'humidity']
                feature_values = [temp, humidity]
                
                # Create DataFrame with proper column names
                features_df = pd.DataFrame([feature_values], columns=feature_names)
                
                try:
                    weather_condition = self.weather_conditions_model.predict(features_df)[0]
                except Exception as e:
                    logger.error(f"Error predicting weather condition: {e}")
                    weather_condition = "Clear"  # Default
            else:
                weather_condition = "Clear"  # Default
        else:
            # Fallback to actual weather data
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
            else:
                weather_condition = "Clear"  # Default
        
        # Generate Travel Recommendation
        if road_condition == "Clear" and has_delay == "No" and weather_condition not in ["Rain", "Fog", "Thunderstorm"]:
            travel_recommendation = "Ideal"
        else:
            travel_recommendation = "Not Ideal"
        
        return {
            "road_condition": road_condition,
            "possible_delay": has_delay,
            "weather_condition": weather_condition,
            "travel_recommendation": travel_recommendation
        }

    # Update the get_detailed_prediction method in the TrafficWeatherPredictor class

    def get_detailed_prediction(self, time=None, day=None, location=None, route=None):
        """
        Generate detailed prediction for registered users using pandas DataFrame with proper feature names.
        
        Returns:
            dict: Detailed prediction results
        """
        # Use current time and day if not provided
        if time is None:
            now = datetime.now()
            hour = now.hour
        else:
            hour = time
            
        if day is None:
            now = datetime.now()
            day_of_week = now.weekday()
            is_weekend = 1 if day_of_week >= 5 else 0
        else:
            day_of_week = day
            is_weekend = 1 if day_of_week >= 5 else 0
        
        # Get latest traffic and weather data
        latest_speed_bands = fetch_firestore_data('traffic_speed_bands', limit=10)
        latest_travel_times = fetch_firestore_data('estimated_travel_times', limit=10)
        latest_weather = fetch_firestore_data('weather_data', limit=1)
        latest_incidents = fetch_firestore_data('traffic_incidents', limit=10)
        
        # Basic prediction as a starting point
        basic_prediction = self.get_basic_prediction(time, day, location)
        
        # Initialize detailed prediction
        detailed_prediction = {
            "road_conditions_probability": {},
            "estimated_travel_time": {"driving": None, "public_transport": None},
            "alternative_routes": [],
            "incident_alerts": [],
            "weather_recommendations": []
        }
        
        # Road Conditions Probability
        if self.road_conditions_model is not None:
            # Get average speed band from latest data
            avg_speed_band = 0
            if latest_speed_bands:
                speed_bands = [item.get('SpeedBand', 0) for item in latest_speed_bands if 'SpeedBand' in item]
                if speed_bands:
                    avg_speed_band = sum(speed_bands) / len(speed_bands)
            
            # Create feature DataFrame with proper column names
            feature_names = ['Hour', 'DayOfWeek', 'IsWeekend', 'SpeedBand']
            feature_values = [hour, day_of_week, is_weekend, avg_speed_band]
            
            # Create DataFrame with proper column names
            features_df = pd.DataFrame([feature_values], columns=feature_names)
            
            try:
                road_condition_probs = self.road_conditions_model.predict_proba(features_df)[0]
                
                # Map probabilities to conditions
                conditions = self.road_conditions_model.classes_
                for i, condition in enumerate(conditions):
                    detailed_prediction["road_conditions_probability"][condition] = round(road_condition_probs[i] * 100, 1)
            except Exception as e:
                logger.error(f"Error predicting road condition probabilities: {e}")
                # Fallback to simple probabilities based on road condition
                road_condition = basic_prediction["road_condition"]
                if road_condition == "Congested":
                    detailed_prediction["road_conditions_probability"] = {"Congested": 80, "Moderate": 15, "Clear": 5}
                elif road_condition == "Moderate":
                    detailed_prediction["road_conditions_probability"] = {"Congested": 15, "Moderate": 70, "Clear": 15}
                else:
                    detailed_prediction["road_conditions_probability"] = {"Congested": 5, "Moderate": 15, "Clear": 80}
        else:
            # Fallback to simple probabilities based on road condition
            road_condition = basic_prediction["road_condition"]
            if road_condition == "Congested":
                detailed_prediction["road_conditions_probability"] = {"Congested": 80, "Moderate": 15, "Clear": 5}
            elif road_condition == "Moderate":
                detailed_prediction["road_conditions_probability"] = {"Congested": 15, "Moderate": 70, "Clear": 15}
            else:
                detailed_prediction["road_conditions_probability"] = {"Congested": 5, "Moderate": 15, "Clear": 80}
        
        # Estimated Travel Time
        if self.travel_time_model is not None:
            # Create feature DataFrame with proper column names
            feature_names = ['Hour', 'DayOfWeek', 'IsWeekend']
            feature_values = [hour, day_of_week, is_weekend]
            
            # Add IsHoliday if model expects it
            is_holiday = 0  # Default to not a holiday
            if hasattr(self.travel_time_model, 'n_features_in_') and self.travel_time_model.n_features_in_ > 3:
                feature_names.append('IsHoliday')
                feature_values.append(is_holiday)
            
            # Add expressway features if provided in the route
            if route and route.get('expressway'):
                expressway = route.get('expressway')
                # In a real implementation, you would handle one-hot encoding properly
                # This is a simplified approach
                feature_names.append(f'Expressway_{expressway}')
                feature_values.append(1)
            
            # Create DataFrame with proper column names
            features_df = pd.DataFrame([feature_values], columns=feature_names)
            
            try:
                predicted_time = max(5, self.travel_time_model.predict(features_df)[0])  # Ensure min 5 minutes
                
                # Adjust for different transport modes
                detailed_prediction["estimated_travel_time"]["driving"] = round(predicted_time, 1)
                detailed_prediction["estimated_travel_time"]["public_transport"] = round(predicted_time * 1.5, 1)  # Assume public transport takes 1.5x
            except Exception as e:
                logger.error(f"Error predicting travel time: {e}")
                # Fallback to average from latest data
                avg_travel_time = 15  # Default
                if latest_travel_times:
                    travel_times = [item.get('Esttime', 0) for item in latest_travel_times if 'Esttime' in item]
                    if travel_times:
                        avg_travel_time = sum(travel_times) / len(travel_times)
                
                detailed_prediction["estimated_travel_time"]["driving"] = round(avg_travel_time, 1)
                detailed_prediction["estimated_travel_time"]["public_transport"] = round(avg_travel_time * 1.5, 1)
        else:
            # Fallback to average from latest data
            avg_travel_time = 15  # Default
            if latest_travel_times:
                travel_times = [item.get('Esttime', 0) for item in latest_travel_times if 'Esttime' in item]
                if travel_times:
                    avg_travel_time = sum(travel_times) / len(travel_times)
            
            detailed_prediction["estimated_travel_time"]["driving"] = round(avg_travel_time, 1)
            detailed_prediction["estimated_travel_time"]["public_transport"] = round(avg_travel_time * 1.5, 1)
        
        # Rest of the method remains the same
        # Alternative Routes Suggestion (simple logic for now)
        road_condition = basic_prediction["road_condition"]
        if road_condition == "Congested":
            detailed_prediction["alternative_routes"] = [
                {"name": "Alternative Route 1", "estimated_time": round(detailed_prediction["estimated_travel_time"]["driving"] * 0.8, 1)},
                {"name": "Alternative Route 2", "estimated_time": round(detailed_prediction["estimated_travel_time"]["driving"] * 0.9, 1)}
            ]
        elif road_condition == "Moderate":
            detailed_prediction["alternative_routes"] = [
                {"name": "Alternative Route 1", "estimated_time": round(detailed_prediction["estimated_travel_time"]["driving"] * 0.9, 1)}
            ]
        
        # Incident Alerts
        if latest_incidents:
            for incident in latest_incidents:
                detailed_prediction["incident_alerts"].append({
                    "type": incident.get("Type", "Unknown"),
                    "message": incident.get("Message", "No details available"),
                    "location": {
                        "latitude": incident.get("Latitude", 0),
                        "longitude": incident.get("Longitude", 0)
                    }
                })
        
        # Weather-Based Recommendations
        weather_condition = basic_prediction["weather_condition"]
        if weather_condition == "Rain":
            detailed_prediction["weather_recommendations"].append("Expect slower traffic due to rain. Allow extra travel time.")
            if road_condition == "Congested":
                detailed_prediction["weather_recommendations"].append("Consider postponing non-essential travel due to rain and congestion.")
        elif weather_condition == "Fog":
            detailed_prediction["weather_recommendations"].append("Reduced visibility due to fog. Drive with caution and use low-beam headlights.")
        elif weather_condition == "Thunderstorm":
            detailed_prediction["weather_recommendations"].append("Severe weather conditions. Consider postponing travel if possible.")
            detailed_prediction["weather_recommendations"].append("If you must travel, avoid flood-prone areas and stay clear of trees and power lines.")
        
        return detailed_prediction

def get_traffic_weather_prediction(user_type="unregistered", time=None, day=None, location=None, route=None):
    """Get traffic and weather prediction based on user type."""
    predictor = TrafficWeatherPredictor()
    
    try:
        # Check if models exist, if not train them
        if (predictor.road_conditions_model is None or 
            predictor.delay_model is None or 
            predictor.weather_conditions_model is None):
            predictor.train_models()
            
        # If models are still None after training, use dummy models
        if (predictor.road_conditions_model is None or 
            predictor.delay_model is None or 
            predictor.weather_conditions_model is None):
            predictor.create_dummy_models()
    except Exception as e:
        logger.error(f"Error in model initialization: {e}")
        predictor.create_dummy_models()
    
    if user_type == "registered":
        return predictor.get_detailed_prediction(time, day, location, route)
    else:
        return predictor.get_basic_prediction(time, day, location)