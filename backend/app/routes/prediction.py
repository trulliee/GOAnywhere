# routes/prediction.py
from fastapi import APIRouter, Depends, HTTPException, Query, Header
from typing import Dict, Optional, Any
from datetime import datetime
from pydantic import BaseModel, Field
import logging
from app.models.traffic_prediction import get_traffic_prediction
from app.services.geocoding_service import process_location_input
from app.services.auth_service import AuthService
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
logger.info("========== PREDICTION ROUTER LOADED ==========")
logger.info(f"Router prefix: {router.prefix}")

# Add a simple test endpoint
@router.get("/test")
async def test_prediction_route():
    logger.info("Test prediction route called!")
    return {"message": "Prediction router is working"}

router = APIRouter(
    prefix="/api/predict",
    tags=["traffic-prediction"],
    responses={404: {"description": "Not found"}},
)

class LocationInput(BaseModel):
    name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class PredictionRequest(BaseModel):
    start_location: LocationInput
    destination_location: LocationInput
    mode_of_transport: str = Field(..., description="Either 'driving' or 'public_transport'")
    prediction_time: Optional[datetime] = Field(None, description="Time for prediction, default is current time")

class BasicPredictionResponse(BaseModel):
    road_conditions: str
    possible_delays: str
    weather_conditions: str

class RoadConditionProbability(BaseModel):
    Clear: float
    Moderate: float
    Congested: float

class AlternativeRoute(BaseModel):
    name: str
    distance_km: float
    estimated_time_min: float
    congestion_level: str
    description: str

class DetailedPredictionResponse(BaseModel):
    road_conditions: str
    weather_conditions: str
    road_conditions_probability: RoadConditionProbability
    estimated_travel_time: float
    possible_delays: str
    general_travel_recommendation: str
    incident_alerts: list
    weather_based_recommendations: list
    alternative_routes: list[AlternativeRoute]

# Helper function to verify user authentication - completely rewritten
async def verify_user(authorization: Optional[str] = None) -> dict:
    """
    Verify the auth token and determine if the user is registered
    Returns user info dict with user_type
    """
    logger.info(f"Verifying user with authorization: {authorization is not None}")
    
    # If no authorization is provided, return unregistered user type
    if not authorization:
        logger.info("No authorization provided, user is unregistered")
        return {"user_type": "unregistered"}
    
    try:
        # Remove 'Bearer ' prefix if present and authorization is a string
        token = None
        if isinstance(authorization, str):
            token = authorization.replace("Bearer ", "") if authorization.startswith("Bearer ") else authorization
        
        if not token:
            logger.info("No valid token extracted, user is unregistered")
            return {"user_type": "unregistered"}
            
        # Verify the token
        user_info = await AuthService.verify_token(token)
        
        # Get additional user data from Firestore
        user_details = await AuthService.get_user_info(user_info["uid"])
        
        logger.info(f"User verified successfully: {user_info['uid']}")
        return {
            "user_id": user_info["uid"],
            "user_type": "registered",
            "email": user_info.get("email"),
            "name": user_details.get("name", "User")
        }
    except Exception as e:
        logger.error(f"Auth error in verify_user: {str(e)}")
        return {"user_type": "unregistered"}

@router.post("/traffic", response_model=Dict[str, Any])
async def predict_traffic(
    request: PredictionRequest,
    authorization: Optional[str] = Header(None, description="Bearer token (optional)")
):
    """
    Predict traffic conditions between two locations.
    - For unregistered users: Returns basic prediction with road conditions, delays, and weather.
    - For registered users: Returns detailed prediction with probabilities, estimated time, alternative routes, etc.
    """
    try:
        logger.info(f"Received traffic prediction request with auth header: {authorization is not None}")
        
        # Check user authentication with our safer implementation
        user = await verify_user(authorization)
        logger.info(f"User type for prediction: {user.get('user_type', 'unregistered')}")
        
        # Process location inputs
        start_coords = None
        if request.start_location.latitude is not None and request.start_location.longitude is not None:
            start_coords = {
                'latitude': request.start_location.latitude,
                'longitude': request.start_location.longitude
            }
        else:
            if not request.start_location.name:
                raise HTTPException(status_code=400, detail="Either coordinates or location name must be provided for start location")
            
            # Geocode the location name
            geocoded_start = await process_location_input(request.start_location.name)
            if 'error' in geocoded_start:
                raise HTTPException(status_code=400, detail=f"Could not geocode start location: {geocoded_start['error']}")
            start_coords = geocoded_start
        
        # Process destination location
        dest_coords = None
        if request.destination_location.latitude is not None and request.destination_location.longitude is not None:
            dest_coords = {
                'latitude': request.destination_location.latitude,
                'longitude': request.destination_location.longitude
            }
        else:
            if not request.destination_location.name:
                raise HTTPException(status_code=400, detail="Either coordinates or location name must be provided for destination location")
                
            # Geocode the location name
            geocoded_dest = await process_location_input(request.destination_location.name)
            if 'error' in geocoded_dest:
                raise HTTPException(status_code=400, detail=f"Could not geocode destination location: {geocoded_dest['error']}")
            dest_coords = geocoded_dest
        
        # Validate mode of transport
        if request.mode_of_transport not in ['driving', 'public_transport']:
            raise HTTPException(status_code=400, detail="mode_of_transport must be either 'driving' or 'public_transport'")
        
        # Get the prediction based on user type
        user_type = user.get("user_type", "unregistered")
        prediction = await get_traffic_prediction(
            start_coords,
            dest_coords,
            request.mode_of_transport,
            request.prediction_time,
            user_type
        )
        
        # Add a clean status field to the response
        prediction['status'] = 'success'
        
        # Add geocoded locations to the response
        prediction['start_location'] = start_coords
        prediction['destination_location'] = dest_coords
        
        return prediction
        
    except HTTPException as e:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Prediction error: {e}")
        raise HTTPException(status_code=500, detail=f"Error making prediction: {str(e)}")

@router.get("/example", response_model=DetailedPredictionResponse)
async def get_example_prediction():
    """Get an example of a detailed prediction response (for documentation)"""
    return {
        "road_conditions": "Moderate",
        "weather_conditions": "Clear",
        "road_conditions_probability": {
            "Clear": 25.5,
            "Moderate": 55.2,
            "Congested": 19.3
        },
        "estimated_travel_time": 32.5,
        "possible_delays": "No",
        "general_travel_recommendation": "Ideal",
        "incident_alerts": [
            {
                "type": "Accident",
                "message": "Accident on PIE towards Changi",
                "distance_from_start": 3.5,
                "latitude": 1.3421,
                "longitude": 103.8198,
                "source": "official"
            }
        ],
        "weather_based_recommendations": [
            "Weather conditions are favorable for travel"
        ],
        "alternative_routes": [
            {
                "name": "Alternative Route 1", 
                "distance_km": 15.2,
                "estimated_time_min": 28.5,
                "congestion_level": "Low",
                "description": "Longer route via major roads with less congestion"
            }
        ]
    }