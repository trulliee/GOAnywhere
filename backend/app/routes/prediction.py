import logging
from fastapi import APIRouter, Query, Depends, HTTPException
from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel
from app.models.traffic_prediction import get_traffic_weather_prediction

# Set up logger
logger = logging.getLogger(__name__)

# Define response models
class BasicPredictionResponse(BaseModel):
    road_condition: str
    possible_delay: str
    weather_condition: str

class RoadConditionsProbability(BaseModel):
    Congested: float = 0.0
    Moderate: float = 0.0
    Clear: float = 0.0

class TravelTime(BaseModel):
    driving: Optional[float] = None
    public_transport: Optional[float] = None

class AlternativeRoute(BaseModel):
    name: str
    estimated_time: float

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
            
        prediction = get_traffic_weather_prediction("unregistered", time, day, location)
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
    
    Returns:
    - Road Conditions Probability (e.g., 80% Congested, 20% Clear)
    - Estimated Travel Time (For driving & public transport)
    - Alternative Routes Suggestion
    - Incident Alerts
    - Weather-Based Recommendations
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
            # Simple parsing - in a real app, this would be more sophisticated
            parts = route.split(',')
            route_info = {
                "expressway": parts[0] if len(parts) > 0 else None,
                "start": parts[1] if len(parts) > 1 else None,
                "end": parts[2] if len(parts) > 2 else None
            }
            
        prediction = get_traffic_weather_prediction("registered", time, day, location, route_info)
        return DetailedPredictionResponse(**prediction)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")

@router.get("/predict/train-models")
def train_prediction_models():
    """Train prediction models with the latest data (admin only)."""
    try:
        from app.models.traffic_prediction import TrafficWeatherPredictor
        predictor = TrafficWeatherPredictor()
        predictor.train_models()
        return {"message": "Models trained successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Training error: {str(e)}")