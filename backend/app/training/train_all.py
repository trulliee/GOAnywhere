import os
import pandas as pd
import logging
import datetime
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import FunctionTransformer
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

print("USE_LOCAL_FIREBASE_CREDENTIALS =", os.getenv("USE_LOCAL_FIREBASE_CREDENTIALS"))


# Import model classes with correct file names
from app.models.travel_time_prediction import TravelTimePredictionModel
from app.models.traffic_congestion_model import TrafficCongestionModel
from app.data.firestore_dataloader import FirestoreDataLoader
from app.scrapers.events_scraper import scrape_visit_singapore_events

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def train_travel_time_model(data_loader):
    logger.info("Training Travel Time Prediction Model")
    lookback_days = None

    # Load all necessary data using the FirestoreDataLoader with correct method names
    # Check available methods in the data_loader
    available_methods = [method for method in dir(data_loader) if not method.startswith('_') and callable(getattr(data_loader, method))]
    logger.info(f"Available methods in FirestoreDataLoader: {available_methods}")
    
    # Try to load travel times
    try:
        # Try different possible method names
        if 'get_travel_times' in available_methods:
            travel_times_df = data_loader.get_travel_times(days=lookback_days)
        elif 'get_estimated_travel_times' in available_methods:
            travel_times_df = data_loader.get_estimated_travel_times(days=lookback_days)
        else:
            logger.error("No method found to get travel times data")
            return False
            
        # Try different possible method names for incidents
        if 'get_incidents' in available_methods:
            incidents_df = data_loader.get_incidents(days=lookback_days)
        elif 'get_traffic_incidents' in available_methods:
            incidents_df = data_loader.get_traffic_incidents(days=lookback_days)
        else:
            logger.warning("No method found to get incidents data, using empty DataFrame")
            incidents_df = pd.DataFrame()
            
        # Try different possible method names for speed bands
        if 'get_traffic_speed_bands' in available_methods:
            speed_bands_df = data_loader.get_traffic_speed_bands(days=lookback_days)
        else:
            logger.warning("No method found to get speed bands data, using empty DataFrame")
            speed_bands_df = pd.DataFrame()
        
        # Try to get weather data
        if 'get_weather_data' in available_methods:
            weather_df = data_loader.get_weather_data(days=lookback_days)
        else:
            logger.warning("No method found to get weather data, using empty DataFrame")
            weather_df = pd.DataFrame()
            
        # Try to get holidays data
        if 'get_historical_holidays' in available_methods:
            holidays_df = data_loader.get_historical_holidays()
        else:
            logger.warning("No method found to get holidays data, using empty DataFrame")
            holidays_df = pd.DataFrame()
            
        # Try to get events data
        events_df = pd.DataFrame()
        if 'get_events_data' in available_methods:
            try:
                events_df = data_loader.get_events_data(days_ahead=None)
            except Exception as e:
                logger.warning(f"Error getting events data: {e}")
                
        # Scrape events if needed
        if events_df.empty:
            logger.info("Scraping events data...")
            try:
                scrape_visit_singapore_events(max_pages=2)
                if 'get_events_data' in available_methods:
                    events_df = data_loader.get_events_data(days_ahead=None)
            except Exception as e:
                logger.warning(f"Error scraping events: {e}")
                
    except Exception as e:
        logger.error(f"Error loading data: {e}")
        return False

    if len(travel_times_df) < 10:  # Reduced threshold for testing
        logger.warning(f"Not enough travel time data. Only {len(travel_times_df)} records found.")
        return False

    logger.info(f"Loaded {len(travel_times_df)} travel time records, {len(incidents_df)} incidents, "
                f"{len(speed_bands_df)} speed band records")

    # Training the model
    model = TravelTimePredictionModel()
    X, y = model.prepare_data(travel_times_df, incidents_df, speed_bands_df, weather_df, events_df, holidays_df)
    results = model.train(X, y)

    # Save model
    model_path = model.save_model()

    logger.info(f"Travel Time Model saved to: {model_path}")
    logger.info(f"Model metrics: RMSE: {results['test_rmse']:.2f}, MAE: {results['test_mae']:.2f}, R²: {results['test_r2']:.2f}")

    return True

def train_congestion_model(data_loader):
    logger.info("Training Traffic Congestion Prediction Model")
    lookback_days = None

    # Available methods were already logged in the travel time model function
    
    # Try to load speed bands
    try:
        # Try different possible method names for speed bands
        available_methods = [method for method in dir(data_loader) if not method.startswith('_') and callable(getattr(data_loader, method))]
        
        if 'get_traffic_speed_bands' in available_methods:
            speed_bands_df = data_loader.get_traffic_speed_bands(days=lookback_days)
        else:
            logger.warning("No method found to get speed bands data, using empty DataFrame")
            speed_bands_df = pd.DataFrame()
            
        # Try different possible method names for incidents
        if 'get_incidents' in available_methods:
            incidents_df = data_loader.get_incidents(days=lookback_days)
        elif 'get_traffic_incidents' in available_methods:
            incidents_df = data_loader.get_traffic_incidents(days=lookback_days)
        else:
            logger.warning("No method found to get incidents data, using empty DataFrame")
            incidents_df = pd.DataFrame()
            
        # Try to get weather data
        if 'get_weather_data' in available_methods:
            weather_df = data_loader.get_weather_data(days=lookback_days)
        else:
            logger.warning("No method found to get weather data, using empty DataFrame")
            weather_df = pd.DataFrame()
            
        # Try to get holidays data
        if 'get_historical_holidays' in available_methods:
            holidays_df = data_loader.get_historical_holidays()
        else:
            logger.warning("No method found to get holidays data, using empty DataFrame")
            holidays_df = pd.DataFrame()
            
        # Try to get events data
        events_df = pd.DataFrame()
        if 'get_events_data' in available_methods:
            try:
                events_df = data_loader.get_events_data(days_ahead=None)
            except Exception as e:
                logger.warning(f"Error getting events data: {e}")
                
    except Exception as e:
        logger.error(f"Error loading data: {e}")
        return False

    if len(speed_bands_df) < 10:  # Reduced threshold for testing
        logger.warning(f"Not enough speed band data. Only {len(speed_bands_df)} records found.")
        return False

    logger.info(f"Loaded {len(speed_bands_df)} speed band records, {len(incidents_df)} incidents")

    # Training the model
    model = TrafficCongestionModel()
    X, y = model.prepare_data(speed_bands_df, incidents_df, weather_df, events_df, holidays_df)
    results = model.train(X, y)

    # Save model
    model_path = model.save_model()

    logger.info(f"Traffic Congestion Model saved to: {model_path}")
    logger.info(f"Model metrics: Test Accuracy: {results['test_accuracy']:.4f}, Test F1 Score: {results['test_f1_score']:.4f}")

    return True

def main():
    logger.info("Initializing Firestore data loader")
    try:
        data_loader = FirestoreDataLoader()
        
        # Create models directory if it doesn't exist
        os.makedirs("models/trained", exist_ok=True)

        # List available methods to debug
        available_methods = [method for method in dir(data_loader) if not method.startswith('_') and callable(getattr(data_loader, method))]
        logger.info(f"Available methods in FirestoreDataLoader: {available_methods}")

        # Train models with better error handling
        try:
            travel_time_success = train_travel_time_model(data_loader)
        except Exception as e:
            logger.error(f"Error training travel time model: {e}")
            travel_time_success = False
            
        try:
            congestion_success = train_congestion_model(data_loader)
        except Exception as e:
            logger.error(f"Error training congestion model: {e}")
            congestion_success = False

        # Log overall status
        if travel_time_success and congestion_success:
            logger.info("All models trained successfully.")
        else:
            logger.warning("Some models failed to train properly.")
        
        return travel_time_success and congestion_success
    except Exception as e:
        logger.error(f"Error during model training: {e}")
        return False

if __name__ == "__main__":
    main()