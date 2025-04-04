import logging
from fastapi import APIRouter, Query, Depends, HTTPException, Header, Request
from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel
import json

# Set up logger
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Define response models
class BasicPredictionResponse(BaseModel):
    road_condition: str
    possible_delay: str
    weather_condition: str

class TravelTime(BaseModel):
    driving: float
    public_transport: float

class AlternativeRoute(BaseModel):
    name: str
    estimated_time: float
    description: Optional[str] = None

class IncidentLocation(BaseModel):
    latitude: float
    longitude: float

class IncidentAlert(BaseModel):
    type: str
    message: str
    location: IncidentLocation

class DetailedPredictionResponse(BaseModel):
    road_conditions_probability: Dict[str, float]
    estimated_travel_time: TravelTime
    alternative_routes: List[AlternativeRoute] = []
    incident_alerts: List[IncidentAlert] = []
    weather_recommendations: List[str] = []
    general_travel_recommendation: str
    road_condition: str
    possible_delay: str
    weather_condition: str

class TrafficForecastRequest(BaseModel):
    start_location: str
    destination_location: str
    transport_mode: str
    prediction_datetime: str

router = APIRouter()

@router.get("/prediction/unregistered", response_model=BasicPredictionResponse)
def get_basic_prediction(
    time: Optional[int] = Query(None, description="Hour of the day (0-23)"),
    day: Optional[int] = Query(None, description="Day of the week (0=Monday, 6=Sunday)"),
    location: Optional[str] = Query(None, description="Location name or coordinates")
):
    try:
        # Use current time and day if not provided
        if time is None:
            time = datetime.now().hour
        if day is None:
            day = datetime.now().weekday()
            
        # Import the prediction model
        from app.models.traffic_prediction import get_traffic_weather_prediction
        
        prediction = get_traffic_weather_prediction("unregistered", time, day, location)
        
        # Log the prediction for debugging
        logger.info(f"Unregistered prediction response: {json.dumps(prediction, default=str)}")
        
        return BasicPredictionResponse(**prediction)
    except Exception as e:
        import traceback
        stack_trace = traceback.format_exc()
        logger.error(f"Prediction error: {str(e)}\n{stack_trace}")
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")

@router.get("/prediction/registered", response_model=DetailedPredictionResponse)
def get_detailed_prediction(
    time: Optional[int] = Query(None, description="Hour of the day (0-23)"),
    day: Optional[int] = Query(None, description="Day of the week (0=Monday, 6=Sunday)"),
    location: Optional[str] = Query(None, description="Location name or coordinates"),
    route: Optional[str] = Query(None, description="Route information")
):
    """
    Get detailed traffic and weather prediction for registered users.
    """
    try:
        # Use current time and day if not provided
        if time is None:
            time = datetime.now().hour
        if day is None:
            day = datetime.now().weekday()
            
        # Parse route information if provided
        route_info = None
        if route:
            try:
                # First try parsing as JSON
                route_info = json.loads(route)
            except json.JSONDecodeError:
                # Fall back to simple parsing
                parts = route.split(',')
                route_info = {
                    "expressway": parts[0] if len(parts) > 0 else None,
                    "start": parts[1] if len(parts) > 1 else None,
                    "end": parts[2] if len(parts) > 2 else None
                }
        
        # Import the prediction model
        from app.models.traffic_prediction import get_traffic_weather_prediction
            
        prediction = get_traffic_weather_prediction("registered", time, day, location, route_info)
        
        # Log the prediction for debugging
        logger.info(f"Detailed prediction response: {json.dumps(prediction, default=str)}")
        
        return DetailedPredictionResponse(**prediction)
    except Exception as e:
        logger.error(f"Detailed prediction error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")

@router.post("/traffic") 
async def traffic_forecast(request: Request, traffic_request: TrafficForecastRequest):
    """
    Process traffic forecast requests from the mobile app.
    """
    try:
        logger.info(f"Received traffic forecast request: {traffic_request}")
        logger.info(f"Start location: {traffic_request.start_location}, Destination: {traffic_request.destination_location}")
        
        # Get the authorization header
        auth_header = request.headers.get("Authorization", "")
        logger.info(f"Auth header received: {auth_header[:10]}..." if auth_header else "No auth header")
        
        # Determine user type - assume all users with tokens are registered
        token = auth_header.replace("Bearer ", "") if auth_header and auth_header.startswith("Bearer ") else None
        user_type = "registered" if token else "unregistered"
        logger.info(f"Determined user_type: {user_type}")
        
        # Parse datetime 
        prediction_time = datetime.now()
        if traffic_request.prediction_datetime:
            try:
                prediction_time = datetime.fromisoformat(traffic_request.prediction_datetime.replace('Z', '+00:00'))
            except ValueError:
                logger.warning(f"Could not parse datetime: {traffic_request.prediction_datetime}, using current time")
        
        # Extract hour and day from prediction time
        hour = prediction_time.hour
        day = prediction_time.weekday()
        
        # Create route info with both locations
        route_info = {
            "start": traffic_request.start_location,
            "end": traffic_request.destination_location,
            "transport_mode": traffic_request.transport_mode
        }
        
        logger.info(f"Getting prediction for user_type: {user_type}, route: {route_info}")
        
        # Import the prediction module
        from app.models.traffic_prediction import get_traffic_weather_prediction
        
        # Get prediction based on identified user type
        prediction = get_traffic_weather_prediction(user_type, hour, day, traffic_request.destination_location, route_info)
            
        # For unregistered users, return only the basic fields
        if user_type != "registered":
            return {
                "road_condition": prediction.get("road_condition", "Moderate"),
                "possible_delay": prediction.get("possible_delay", "No significant delays"),
                "weather_condition": prediction.get("weather_condition", "Partly Cloudy")
            }
        
        # For registered users, ensure all required fields are present
        logger.info("Processing detailed prediction for registered user")
        
        # Validate the prediction structure
        if isinstance(prediction, dict):
            # Ensure essential keys exist
            if "road_conditions_probability" not in prediction:
                logger.warning("Missing road_conditions_probability, adding default")
                prediction["road_conditions_probability"] = {"Congested": 30, "Moderate": 40, "Clear": 30}
                
            if "estimated_travel_time" not in prediction:
                logger.warning("Missing estimated_travel_time, adding default")
                prediction["estimated_travel_time"] = {
                    "driving": 20,
                    "public_transport": 35
                }
                
            if "alternative_routes" not in prediction or not prediction["alternative_routes"]:
                logger.warning("Missing alternative_routes, adding default")
                prediction["alternative_routes"] = [
                    {
                        "name": "Alternative Route via CTE",
                        "estimated_time": 18,
                        "description": "Via less congested roads"
                    },
                    {
                        "name": "Scenic Route via PIE",
                        "estimated_time": 22,
                        "description": "Slightly longer but steadier traffic flow"
                    }
                ]
                
            if "weather_recommendations" not in prediction or not prediction["weather_recommendations"]:
                logger.warning("Missing weather_recommendations, adding default")
                prediction["weather_recommendations"] = [
                    "Regular driving conditions apply.",
                    "Stay alert and follow traffic rules."
                ]
                
            if "general_travel_recommendation" not in prediction:
                logger.warning("Missing general_travel_recommendation, adding default")
                prediction["general_travel_recommendation"] = "Not Ideal"
        else:
            logger.warning(f"Unexpected prediction type: {type(prediction)}")
            raise HTTPException(status_code=500, detail="Invalid prediction format")
        
        # Log the complete prediction for debugging
        logger.info(f"FINAL BACKEND PREDICTION BEING SENT TO CLIENT: {json.dumps(prediction)}")
        
        return prediction
        
    except Exception as e:
        logger.error(f"Traffic forecast error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate traffic forecast: {str(e)}")