from fastapi import APIRouter
from app.routes.prediction import router as prediction_router
import logging

# Set up logger
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Create router for the prediction API
router = APIRouter()

# Include the prediction router from routes/prediction.py
router.include_router(prediction_router, prefix="/api", tags=["Prediction"])

# You can add additional functions here for frontend-specific functionality
def get_frontend_prediction_data(start_location=None, end_location=None, transport_mode="driving", time=None, day=None):
    """
    Get prediction data formatted for frontend display.
    This is a helper function to standardize prediction data across different parts of the app.
    
    Args:
        start_location (str): Starting location
        end_location (str): Destination location
        transport_mode (str): 'driving' or 'transit'
        time (int): Hour of the day (0-23)
        day (int): Day of the week (0=Monday, 6=Sunday)
        
    Returns:
        dict: Prediction data formatted for frontend
    """
    try:
        # Import prediction functionality
        from backend.app.models.traffic_congestion_model import get_traffic_weather_prediction
        
        # Determine user type based on available parameters
        user_type = "registered" if start_location and end_location else "unregistered"
        
        # Create route info if both locations are provided
        route_info = None
        if start_location and end_location:
            route_info = {
                "start": start_location,
                "end": end_location,
                "transport_mode": transport_mode
            }
        
        # Get prediction
        prediction = get_traffic_weather_prediction(
            user_type=user_type,
            time=time,
            day=day,
            location=end_location,  # Use end_location as the target location
            route=route_info
        )
        
        return prediction
        
    except Exception as e:
        logger.error(f"Error in get_frontend_prediction_data: {e}")
        # Return minimal fallback data on error
        return {
            "road_condition": "Moderate",
            "possible_delay": "No significant delays",
            "weather_condition": "Partly Cloudy"
        }