# scripts/train_models.py

import sys
import os
import logging
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import joblib
import json
from google.cloud import storage
import firebase_admin
from firebase_admin import credentials, firestore

# Add the parent directory to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import model classes
from app.models.traffic_prediction_model import TrafficPredictionModel
from app.models.travel_time_model import TravelTimeModel
from app.models.incident_impact_model import IncidentImpactModel
from app.models.route_recommendation import RouteRecommendationModel
from app.models.feedback_analyzer import FeedbackAnalyzer

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/model_training.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Initialize Firebase if not already initialized
try:
    app = firebase_admin.get_app()
except ValueError:
    # Load service account key
    cred = credentials.Certificate("service-account-key.json")
    firebase_admin.initialize_app(cred)

# Get Firestore and Storage clients
db = firestore.client()
storage_client = storage.Client()

def download_cloud_storage_data(bucket_name, source_blob_name, destination_file_name):
    """
    Download data from Google Cloud Storage.
    
    Args:
        bucket_name (str): Name of the GCS bucket
        source_blob_name (str): Name of the blob in the bucket
        destination_file_name (str): Local file path to save the data
    
    Returns:
        bool: True if download was successful, False otherwise
    """
    try:
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(source_blob_name)
        
        # Create directory if it doesn't exist
        os.makedirs(os.path.dirname(destination_file_name), exist_ok=True)
        
        # Download the file
        blob.download_to_filename(destination_file_name)
        
        logger.info(f"Downloaded {source_blob_name} to {destination_file_name}")
        return True
    
    except Exception as e:
        logger.error(f"Error downloading from Cloud Storage: {e}")
        return False

def load_historical_data():
    """
    Load historical data for model training from various sources.
    
    Returns:
        dict: Dictionary containing DataFrames for different data types
    """
    data = {}
    
    # Local file paths for downloaded data
    local_data_dir = "app/storage/temp"
    os.makedirs(local_data_dir, exist_ok=True)
    
    # Define GCS bucket
    bucket_name = "goanywhere-traffic-data"
    
    # Download and load data from GCS
    try:
        # Public holidays data
        holidays_file = os.path.join(local_data_dir, "PublicHolidaysfor2025.csv")
        if not os.path.exists(holidays_file):
            download_cloud_storage_data(
                bucket_name, 
                "temporal_data/PublicHolidaysfor2025.csv", 
                holidays_file
            )
        data['holidays'] = pd.read_csv(holidays_file)
        
        # Road traffic accident data
        accidents_file = os.path.join(local_data_dir, "RoadTrafficAccidentCasualtiesMonthly.csv")
        if not os.path.exists(accidents_file):
            download_cloud_storage_data(
                bucket_name,
                "traffic_data/RoadTrafficAccidentCasualtiesMonthly.csv",
                accidents_file
            )
        data['accidents'] = pd.read_csv(accidents_file)
        
        # Historical weather data
        weather_file = os.path.join(local_data_dir, "HistoricalDailyWeatherRecords.csv")
        if not os.path.exists(weather_file):
            download_cloud_storage_data(
                bucket_name,
                "weather_data/HistoricalDailyWeatherRecords.csv",
                weather_file
            )
        data['weather'] = pd.read_csv(weather_file)
        
        # Road network data
        road_network_file = os.path.join(local_data_dir, "road_network.geojson")
        if not os.path.exists(road_network_file):
            download_cloud_storage_data(
                bucket_name,
                "road_data/road_network.geojson",
                road_network_file
            )
            with open(road_network_file, 'r') as f:
                data['road_network'] = json.load(f)
        
    except Exception as e:
        logger.error(f"Error loading data from Cloud Storage: {e}")
    
    # Load data from Firestore
    try:
        # Traffic speed bands
        speed_bands_ref = db.collection("traffic_speed_bands")
        speed_bands_docs = list(speed_bands_ref.order_by('Timestamp', direction=firestore.Query.DESCENDING).limit(1000).stream())
        speed_bands_data = [doc.to_dict() for doc in speed_bands_docs]
        data['traffic_speed_bands'] = pd.DataFrame(speed_bands_data)
        
        # Traffic incidents
        incidents_ref = db.collection("traffic_incidents")
        incidents_docs = list(incidents_ref.order_by('Timestamp', direction=firestore.Query.DESCENDING).limit(1000).stream())
        incidents_data = [doc.to_dict() for doc in incidents_docs]
        data['traffic_incidents'] = pd.DataFrame(incidents_data)
        
        # Estimated travel times
        travel_times_ref = db.collection("estimated_travel_times")
        travel_times_docs = list(travel_times_ref.order_by('Timestamp', direction=firestore.Query.DESCENDING).limit(1000).stream())
        travel_times_data = [doc.to_dict() for doc in travel_times_docs]
        data['estimated_travel_times'] = pd.DataFrame(travel_times_data)
        
        # Weather data
        weather_ref = db.collection("weather_data")
        weather_docs = list(weather_ref.order_by('Timestamp', direction=firestore.Query.DESCENDING).limit(1000).stream())
        weather_data = [doc.to_dict() for doc in weather_docs]
        data['current_weather'] = pd.DataFrame(weather_data)
        
        # Weather forecast
        forecast_ref = db.collection("weather_forecast_24hr")
        forecast_docs = list(forecast_ref.order_by('stored_at', direction=firestore.Query.DESCENDING).limit(100).stream())
        forecast_data = [doc.to_dict() for doc in forecast_docs]
        data['weather_forecast'] = pd.DataFrame(forecast_data)
        
        # Events data
        events_ref = db.collection("singapore_events")
        events_docs = list(events_ref.where('is_active', '==', True).stream())
        events_data = [doc.to_dict() for doc in events_docs]
        data['events'] = pd.DataFrame(events_data)
        
    except Exception as e:
        logger.error(f"Error loading data from Firestore: {e}")
    
    # Report loaded data
    for key, df in data.items():
        if isinstance(df, pd.DataFrame):
            logger.info(f"Loaded {key} data: {len(df)} records")
        else:
            logger.info(f"Loaded {key} data")
    
    return data

def preprocess_data(data):
    """
    Preprocess the data for model training.
    
    Args:
        data (dict): Dictionary containing the raw data
    
    Returns:
        dict: Dictionary containing preprocessed data for each model
    """
    preprocessed = {}
    
    try:
        # Preprocess traffic speed bands data
        if 'traffic_speed_bands' in data and not data['traffic_speed_bands'].empty:
            df = data['traffic_speed_bands'].copy()
            
            # Convert timestamps
            if 'Timestamp' in df.columns:
                df['timestamp'] = pd.to_datetime(df['Timestamp'])
            
            # Process road name and category
            if 'RoadName' in df.columns:
                df['road_name'] = df['RoadName']
            
            if 'RoadCategory' in df.columns:
                df['road_category'] = df['RoadCategory']
            
            # Process speed band values
            if 'SpeedBand' in df.columns:
                df['speed_band'] = df['SpeedBand']
            
            # Add coordinates for spatial analysis
            if all(col in df.columns for col in ['StartLatitude', 'StartLongitude', 'EndLatitude', 'EndLongitude']):
                df['start_coords'] = list(zip(df['StartLatitude'], df['StartLongitude']))
                df['end_coords'] = list(zip(df['EndLatitude'], df['EndLongitude']))
            
            preprocessed['traffic_speed_bands'] = df
        
        # Preprocess traffic incidents data
        if 'traffic_incidents' in data and not data['traffic_incidents'].empty:
            df = data['traffic_incidents'].copy()
            
            # Convert timestamps
            if 'Timestamp' in df.columns:
                df['timestamp'] = pd.to_datetime(df['Timestamp'])
            
            # Process incident type
            if 'Type' in df.columns:
                df['incident_type'] = df['Type']
            
            # Process coordinates
            if all(col in df.columns for col in ['Latitude', 'Longitude']):
                df['coords'] = list(zip(df['Latitude'], df['Longitude']))
            
            # Extract message information (may contain location details)
            if 'Message' in df.columns:
                df['message'] = df['Message']
                
                # Try to extract location information from messages
                def extract_location(msg):
                    # This is a simple placeholder - a real implementation would
                    # use more advanced NLP to extract location information
                    if isinstance(msg, str):
                        parts = msg.split(' on ')
                        if len(parts) > 1:
                            return parts[1].split(' ')[0]  # Take the first word after "on"
                    return None
                
                df['location_text'] = df['Message'].apply(extract_location)
            
            preprocessed['traffic_incidents'] = df
        
        # Preprocess travel time data
        if 'estimated_travel_times' in data and not data['estimated_travel_times'].empty:
            df = data['estimated_travel_times'].copy()
            
            # Convert timestamps
            if 'Timestamp' in df.columns:
                df['timestamp'] = pd.to_datetime(df['Timestamp'])
            
            # Process route information
            if all(col in df.columns for col in ['Expressway', 'Direction', 'Startpoint', 'Endpoint']):
                df['route_id'] = df['Expressway'] + '_' + df['Direction']
                df['route_description'] = df['Startpoint'] + ' to ' + df['Endpoint']
            
            # Process travel time
            if 'Esttime' in df.columns:
                df['travel_time_minutes'] = df['Esttime']
            
            preprocessed['travel_times'] = df
        
        # Preprocess weather data
        if 'weather' in data and not data['weather'].empty:
            df = data['weather'].copy()
            
            # Ensure date is in datetime format
            if 'Date' in df.columns:
                df['date'] = pd.to_datetime(df['Date'])
            
            # Map to common schema
            weather_mapping = {
                'Mean Temperature (°C)': 'temperature',
                'Maximum Temperature (°C)': 'max_temperature',
                'Minimum Temperature (°C)': 'min_temperature',
                'Mean Wind Speed (km/h)': 'wind_speed',
                'Max Wind Speed (km/h)': 'max_wind_speed',
                'Total Rainfall (mm)': 'rainfall',
                'Mean Relative Humidity (%)': 'humidity'
            }
            
            for old_col, new_col in weather_mapping.items():
                if old_col in df.columns:
                    df[new_col] = df[old_col]
            
            preprocessed['historical_weather'] = df
        
        # Preprocess current weather data
        if 'current_weather' in data and not data['current_weather'].empty:
            df = data['current_weather'].copy()
            
            # Convert timestamps
            if 'timestamp' in df.columns:
                df['timestamp'] = pd.to_datetime(df['timestamp'])
            
            # Map to common schema
            if 'temperature' in df.columns:
                df['temperature'] = df['temperature']
            
            if 'humidity' in df.columns:
                df['humidity'] = df['humidity']
            
            # Convert weather text to condition
            if 'weather' in df.columns:
                df['weather_condition'] = df['weather']
            
            preprocessed['current_weather'] = df
        
        # Preprocess holidays data
        if 'holidays' in data and not data['holidays'].empty:
            df = data['holidays'].copy()
            
            # Ensure date is in datetime format
            if 'Date' in df.columns:
                df['date'] = pd.to_datetime(df['Date'])
            
            # Add useful features
            if 'date' in df.columns:
                df['day_of_week'] = df['date'].dt.dayofweek
                df['month'] = df['date'].dt.month
                df['is_holiday'] = 1  # All rows are holidays
            
            preprocessed['holidays'] = df
        
        # Preprocess events data
        if 'events' in data and not data['events'].empty:
            df = data['events'].copy()
            
            # Process event dates
            if 'date_text' in df.columns:
                # Extract date information from text if possible
                df['parsed_date'] = df['date_text'].apply(lambda x: x[:10] if isinstance(x, str) and len(x) >= 10 else None)
                
                # Try to convert to datetime
                df['event_date'] = pd.to_datetime(df['parsed_date'], errors='coerce')
            
            # Prepare event location
            if 'location' in df.columns:
                df['event_location'] = df['location']
            
            preprocessed['events'] = df
        
        # Combine data for different models
        
        # Traffic prediction model data
        traffic_data = []
        if 'traffic_speed_bands' in preprocessed:
            traffic_data.append(preprocessed['traffic_speed_bands'])
        
        if traffic_data:
            preprocessed['traffic_prediction_data'] = pd.concat(traffic_data, ignore_index=True)
        
        # Travel time model data
        travel_data = []
        if 'travel_times' in preprocessed:
            travel_data.append(preprocessed['travel_times'])
        
        if travel_data:
            preprocessed['travel_time_data'] = pd.concat(travel_data, ignore_index=True)
        
        # Incident impact model data
        incident_data = []
        if 'traffic_incidents' in preprocessed:
            incident_data.append(preprocessed['traffic_incidents'])
        
        if incident_data:
            preprocessed['incident_impact_data'] = pd.concat(incident_data, ignore_index=True)
        
    except Exception as e:
        logger.error(f"Error in data preprocessing: {e}")
    
    return preprocessed

def train_traffic_prediction_model(data):
    """
    Train the traffic prediction model.
    
    Args:
        data (dict): Preprocessed data dictionary
    
    Returns:
        tuple: (model, metrics)
    """
    try:
        if 'traffic_prediction_data' not in data or data['traffic_prediction_data'].empty:
            logger.error("No traffic prediction data available for training")
            return None, None
        
        # Create model instance
        model = TrafficPredictionModel(model_path="app/models/traffic_prediction_model.joblib")
        
        # Prepare training data
        training_data = data['traffic_prediction_data']
        weather_data = data.get('historical_weather', pd.DataFrame())
        holiday_data = data.get('holidays', pd.DataFrame())
        incident_data = data.get('traffic_incidents', pd.DataFrame())
        event_data = data.get('events', pd.DataFrame())
        
        # Train model
        metrics = model.train(
            traffic_data=training_data,
            weather_data=weather_data,
            holiday_data=holiday_data,
            incident_data=incident_data,
            event_data=event_data
        )
        
        logger.info(f"Traffic prediction model training completed with metrics: {metrics}")
        
        # Save metadata about the training
        training_metadata = {
            'model_type': 'traffic_prediction',
            'training_time': datetime.now().isoformat(),
            'data_size': len(training_data),
            'metrics': metrics,
            'model_version': datetime.now().strftime('%Y%m%d%H%M')
        }
        
        # Save metadata to Firestore
        db.collection('model_training').document(f"traffic_prediction_{training_metadata['model_version']}").set(training_metadata)
        
        # Write the last training time to the model_last_trained.txt file
        with open('storage/model_last_trained.txt', 'w') as f:
            f.write(f"traffic_prediction_model: {datetime.now().isoformat()}\n")
        
        return model, metrics
    
    except Exception as e:
        logger.error(f"Error training traffic prediction model: {e}")
        return None, None

def train_travel_time_model(data):
    """
    Train the travel time model.
    
    Args:
        data (dict): Preprocessed data dictionary
    
    Returns:
        tuple: (model, metrics)
    """
    try:
        if 'travel_time_data' not in data or data['travel_time_data'].empty:
            logger.error("No travel time data available for training")
            return None, None
        
        # Create model instance
        model = TravelTimeModel(model_path="app/models/travel_time_model.joblib")
        
        # Prepare training data
        travel_times_data = data['travel_time_data']
        traffic_data = data.get('traffic_speed_bands', pd.DataFrame())
        weather_data = data.get('historical_weather', pd.DataFrame())
        holiday_data = data.get('holidays', pd.DataFrame())
        incident_data = data.get('traffic_incidents', pd.DataFrame())
        event_data = data.get('events', pd.DataFrame())
        
        # Train model
        metrics = model.train(
            travel_times_data=travel_times_data,
            traffic_data=traffic_data,
            weather_data=weather_data,
            holiday_data=holiday_data,
            incident_data=incident_data,
            event_data=event_data
        )
        
        logger.info(f"Travel time model training completed with metrics: {metrics}")
        
        # Save metadata about the training
        training_metadata = {
            'model_type': 'travel_time',
            'training_time': datetime.now().isoformat(),
            'data_size': len(travel_times_data),
            'metrics': metrics,
            'model_version': datetime.now().strftime('%Y%m%d%H%M')
        }
        
        # Save metadata to Firestore
        db.collection('model_training').document(f"travel_time_{training_metadata['model_version']}").set(training_metadata)
        
        # Append the last training time to the model_last_trained.txt file
        with open('storage/model_last_trained.txt', 'a') as f:
            f.write(f"travel_time_model: {datetime.now().isoformat()}\n")
        
        return model, metrics
    
    except Exception as e:
        logger.error(f"Error training travel time model: {e}")
        return None, None

def train_incident_impact_model(data):
    """
    Train the incident impact model.
    
    Args:
        data (dict): Preprocessed data dictionary
    
    Returns:
        tuple: (model, metrics)
    """
    try:
        if 'incident_impact_data' not in data or data['incident_impact_data'].empty:
            logger.error("No incident impact data available for training")
            return None, None
        
        # Create model instance
        model = IncidentImpactModel(model_path="app/models/incident_impact_model.joblib")
        
        # Prepare training data
        incidents_data = data['incident_impact_data']
        weather_data = data.get('historical_weather', pd.DataFrame())
        holiday_data = data.get('holidays', pd.DataFrame())
        road_data = data.get('road_network')
        
        # Train model
        metrics = model.train(
            incidents_data=incidents_data,
            weather_data=weather_data,
            holiday_data=holiday_data,
            road_data=road_data
        )
        
        logger.info(f"Incident impact model training completed with metrics: {metrics}")
        
        # Save metadata about the training
        training_metadata = {
            'model_type': 'incident_impact',
            'training_time': datetime.now().isoformat(),
            'data_size': len(incidents_data),
            'metrics': metrics,
            'model_version': datetime.now().strftime('%Y%m%d%H%M')
        }
        
        # Save metadata to Firestore
        db.collection('model_training').document(f"incident_impact_{training_metadata['model_version']}").set(training_metadata)
        
        # Append the last training time to the model_last_trained.txt file
        with open('storage/model_last_trained.txt', 'a') as f:
            f.write(f"incident_impact_model: {datetime.now().isoformat()}\n")
        
        return model, metrics
    
    except Exception as e:
        logger.error(f"Error training incident impact model: {e}")
        return None, None

def backup_model(model_path, version):
    """
    Backup a model file to Google Cloud Storage.
    
    Args:
        model_path (str): Path to the model file
        version (str): Version identifier for the backup
    
    Returns:
        bool: True if backup was successful, False otherwise
    """
    try:
        # Define bucket name for model backups
        bucket_name = "goanywhere-ml-models"
        
        # Create Cloud Storage bucket if it doesn't exist
        bucket = storage_client.bucket(bucket_name)
        if not bucket.exists():
            bucket = storage_client.create_bucket(bucket_name)
            logger.info(f"Created new bucket: {bucket_name}")
        
        # Define destination blob name using model name and version
        model_filename = os.path.basename(model_path)
        model_name = os.path.splitext(model_filename)[0]
        destination_blob_name = f"{model_name}/{model_name}_{version}.joblib"
        
        # Upload model to Cloud Storage
        blob = bucket.blob(destination_blob_name)
        blob.upload_from_filename(model_path)
        
        logger.info(f"Model {model_path} backed up to gs://{bucket_name}/{destination_blob_name}")
        
        return True
    
    except Exception as e:
        logger.error(f"Error backing up model {model_path}: {e}")
        return False

def retrain_all_models():
    """
    Main function to retrain all prediction models.
    
    Returns:
        bool: True if all models were trained successfully, False otherwise
    """
    try:
        logger.info("Starting model retraining process")
        
        # Load and preprocess data
        raw_data = load_historical_data()
        preprocessed_data = preprocess_data(raw_data)
        
        # Train traffic prediction model
        traffic_model, traffic_metrics = train_traffic_prediction_model(preprocessed_data)
        
        # Train travel time model
        travel_model, travel_metrics = train_travel_time_model(preprocessed_data)
        
        # Train incident impact model
        incident_model, incident_metrics = train_incident_impact_model(preprocessed_data)
        
        # Generate version identifier for backups
        version = datetime.now().strftime('%Y%m%d%H%M')
        
        # Backup models
        if traffic_model:
            backup_model("app/models/traffic_prediction_model.joblib", version)
        
        if travel_model:
            backup_model("app/models/travel_time_model.joblib", version)
        
        if incident_model:
            backup_model("app/models/incident_impact_model.joblib", version)
        
        # Log summary
        logger.info("Model retraining completed successfully")
        
        return True
    
    except Exception as e:
        logger.error(f"Error in model retraining process: {e}")
        return False

if __name__ == "__main__":
    # If run directly, retrain all models
    retrain_result = retrain_all_models()
    
    if retrain_result:
        print("Model retraining completed successfully")
    else:
        print("Model retraining encountered errors. Check logs for details.")
        sys.exit(1)