# app/routes/prediction.py

from fastapi import APIRouter, Depends, HTTPException, Body, Query
from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any, Union
from datetime import datetime
import logging

# Import model implementations
from app.models.traffic_prediction_model import TrafficPredictionModel
from app.models.travel_time_model import TravelTimeModel
from app.models.incident_impact_model import IncidentImpactModel
from app.models.route_recommendation import RouteRecommendationModel
from app.models.feedback_analyzer import FeedbackAnalyzer

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize router
router = APIRouter(
    prefix="/prediction",
    tags=["prediction"],
    responses={404: {"description": "Not found"}},
)

# Initialize models (lazy loading)
traffic_model = None
travel_time_model = None
incident_model = None
route_model = None
feedback_analyzer = None

def get_traffic_model():
    """Lazy loading of traffic prediction model."""
    global traffic_model
    if traffic_model is None:
        traffic_model = TrafficPredictionModel('app/models/traffic_prediction_model.joblib')
    return traffic_model

def get_travel_time_model():
    """Lazy loading of travel time model."""
    global travel_time_model
    if travel_time_model is None:
        travel_time_model = TravelTimeModel('app/models/travel_time_model.joblib')
    return travel_time_model

def get_incident_model():
    """Lazy loading of incident impact model."""
    global incident_model
    if incident_model is None:
        incident_model = IncidentImpactModel('app/models/incident_impact_model.joblib')
    return incident_model

def get_route_model():
    """Lazy loading of route recommendation model."""
    global route_model
    if route_model is None:
        route_model = RouteRecommendationModel(
            traffic_prediction_model=get_traffic_model(),
            travel_time_model=get_travel_time_model(),
            incident_impact_model=get_incident_model()
        )
    return route_model

def get_feedback_analyzer():
    """Lazy loading of feedback analyzer."""
    global feedback_analyzer
    if feedback_analyzer is None:
        feedback_analyzer = FeedbackAnalyzer()
    return feedback_analyzer

# Input models
class LocationModel(BaseModel):
    latitude: float = Field(..., description="Latitude coordinate")
    longitude: float = Field(..., description="Longitude coordinate")
    name: Optional[str] = Field(None, description="Location name (if available)")

class WeatherConditionsModel(BaseModel):
    temperature: Optional[float] = Field(None, description="Temperature in Celsius")
    humidity: Optional[float] = Field(None, description="Humidity percentage")
    rainfall: Optional[float] = Field(None, description="Rainfall amount in mm")
    visibility: Optional[float] = Field(None, description="Visibility in km")
    weather_main: Optional[str] = Field(None, description="Main weather condition (Clear, Rain, etc.)")

class RoutePreferencesModel(BaseModel):
    avoid_congestion: Optional[bool] = Field(False, description="Prefer routes with less congestion")
    prefer_fastest: Optional[bool] = Field(True, description="Prefer fastest routes")
    avoid_incidents: Optional[bool] = Field(True, description="Avoid routes with incidents")

class NavigationRequestModel(BaseModel):
    start_location: Union[str, LocationModel] = Field(..., description="Starting point (address or coordinates)")
    destination_location: Union[str, LocationModel] = Field(..., description="Destination point (address or coordinates)")
    departure_time: Optional[datetime] = Field(None, description="Departure time (defaults to current time)")
    transport_mode: str = Field("driving", description="Mode of transport (driving or public_transport)")
    preferences: Optional[RoutePreferencesModel] = Field(None, description="Route preferences")

class FeedbackRequestModel(BaseModel):
    prediction_type: str = Field(..., description="Type of prediction (travel_time, traffic_condition, etc.)")
    prediction_id: str = Field(..., description="ID of the prediction being rated")
    user_id: str = Field(..., description="ID of the user providing feedback")
    actual_value: Union[float, str] = Field(..., description="Actual observed value")
    predicted_value: Union[float, str] = Field(..., description="Value that was predicted")
    timestamp: Optional[datetime] = Field(None, description="Time when feedback was provided")
    location: Optional[LocationModel] = Field(None, description="Location relevant to the prediction")
    additional_comments: Optional[str] = Field(None, description="Additional feedback comments")

# API Routes
@router.post("/route", response_model=Dict[str, Any])
async def get_route_recommendations(
    request: NavigationRequestModel = Body(...),
):
    """
    Get route recommendations based on current traffic conditions, incidents, and weather.
    """
    try:
        # Initialize route model
        route_model = get_route_model()
        
        # Get departure time (default to now)
        departure_time = request.departure_time or datetime.now()
        
        # Get recommendations
        recommendations = route_model.get_route_recommendations(
            origin=request.start_location,
            destination=request.destination_location,
            departure_time=departure_time,
            mode=request.transport_mode,
            preferences=request.preferences.dict() if request.preferences else None
        )
        
        return recommendations
    
    except Exception as e:
        logger.error(f"Error getting route recommendations: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/traffic", response_model=Dict[str, Any])
async def predict_traffic_conditions(
    latitude: float = Query(..., description="Latitude coordinate"),
    longitude: float = Query(..., description="Longitude coordinate"),
    prediction_time: Optional[datetime] = Query(None, description="Time for prediction (defaults to current time)"),
    road_name: Optional[str] = Query(None, description="Road name (if known)")
):
    """
    Predict traffic conditions at a specific location and time.
    """
    try:
        # Initialize traffic model
        traffic_model = get_traffic_model()
        
        # Get prediction time (default to now)
        pred_time = prediction_time or datetime.now()
        
        # Create location object
        location = {
            'latitude': latitude,
            'longitude': longitude,
            'road_name': road_name
        }
        
        # Get current weather conditions
        # In a real implementation, this would query a weather service
        # or use cached weather data from Firestore
        weather = {
            'temperature': 28.5,
            'humidity': 85.0,
            'rainfall': 0.0,
            'weather_main': 'Clear'
        }
        
        # Create features for prediction
        features = {
            'timestamp': pred_time,
            'latitude': latitude,
            'longitude': longitude,
            'road_name': road_name,
            'temperature': weather['temperature'],
            'humidity': weather['humidity'],
            'rainfall': weather['rainfall'],
            'weather_main': weather['weather_main'],
            'hour_of_day': pred_time.hour,
            'day_of_week': pred_time.weekday(),
            'month': pred_time.month,
            'is_peak_hour': 1 if (7 <= pred_time.hour <= 9) or (17 <= pred_time.hour <= 19) else 0
        }
        
        # Make prediction
        import pandas as pd
        prediction = traffic_model.predict(pd.DataFrame([features]))[0]
        
        # Create response
        response = {
            'location': location,
            'prediction_time': pred_time.isoformat(),
            'predicted_speed_band': prediction,
            'traffic_condition': traffic_model._map_speed_to_severity(prediction),
            'confidence': 0.85,  # Placeholder - would be provided by the model
            'weather_conditions': weather
        }
        
        return response
    
    except Exception as e:
        logger.error(f"Error predicting traffic conditions: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/travel-time", response_model=Dict[str, Any])
async def predict_travel_time(
    request: NavigationRequestModel = Body(...),
):
    """
    Predict travel time between origin and destination.
    """
    try:
        # Initialize travel time model
        travel_time_model = get_travel_time_model()
        
        # Get departure time (default to now)
        departure_time = request.departure_time or datetime.now()
        
        # Predict travel time
        prediction = travel_time_model.predict_travel_time(
            origin=request.start_location,
            destination=request.destination_location,
            mode=request.transport_mode,
            departure_time=departure_time,
            avoid_congestion=request.preferences.avoid_congestion if request.preferences else False
        )
        
        return prediction
    
    except Exception as e:
        logger.error(f"Error predicting travel time: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/incident-impact", response_model=Dict[str, Any])
async def predict_incident_impact(
    incident_type: str = Query(..., description="Type of incident (accident, roadwork, etc.)"),
    latitude: float = Query(..., description="Latitude coordinate"),
    longitude: float = Query(..., description="Longitude coordinate"),
    road_name: Optional[str] = Query(None, description="Road name (if known)"),
    prediction_time: Optional[datetime] = Query(None, description="Time for prediction (defaults to current time)")
):
    """
    Predict the impact of a traffic incident.
    """
    try:
        # Initialize incident model
        incident_model = get_incident_model()
        
        # Get prediction time (default to now)
        pred_time = prediction_time or datetime.now()
        
        # Create location object
        location = {
            'latitude': latitude,
            'longitude': longitude,
            'road_name': road_name
        }
        
        # Get current weather conditions
        # In a real implementation, this would query a weather service
        # or use cached weather data from Firestore
        weather = {
            'temperature': 28.5,
            'humidity': 85.0,
            'rainfall': 0.0,
            'weather_main': 'Clear'
        }
        
        # Predict incident impact
        impact = incident_model.predict_impact(
            incident_type=incident_type,
            location=location,
            timestamp=pred_time,
            weather_conditions=weather
        )
        
        return impact
    
    except Exception as e:
        logger.error(f"Error predicting incident impact: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/feedback", response_model=Dict[str, Any])
async def submit_prediction_feedback(
    feedback: FeedbackRequestModel = Body(...),
):
    """
    Submit feedback on a prediction's accuracy.
    """
    try:
        # Initialize feedback analyzer
        analyzer = get_feedback_analyzer()
        
        # Prepare feedback data
        feedback_data = feedback.dict()
        
        # Record feedback
        feedback_id = analyzer.record_feedback(feedback_data)
        
        return {
            "message": "Feedback recorded successfully",
            "feedback_id": feedback_id
        }
    
    except Exception as e:
        logger.error(f"Error recording feedback: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/accuracy-metrics", response_model=Dict[str, Any])
async def get_accuracy_metrics(
    prediction_type: str = Query(..., description="Type of prediction (travel_time, traffic_condition, etc.)"),
    time_period: str = Query("last_30_days", description="Time period for metrics (last_7_days, last_30_days, last_90_days)")
):
    """
    Get accuracy metrics for predictions based on user feedback.
    """
    try:
        # Initialize feedback analyzer
        analyzer = get_feedback_analyzer()
        
        # Get analysis
        analysis = analyzer.analyze_feedback_trends(prediction_type, time_period)
        
        return analysis
    
    except Exception as e:
        logger.error(f"Error getting accuracy metrics: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/performance-report", response_model=Dict[str, Any])
async def get_performance_report(
    prediction_type: str = Query(..., description="Type of prediction (travel_time, traffic_condition, etc.)"),
    time_period: str = Query("last_30_days", description="Time period for report (last_7_days, last_30_days, last_90_days)")
):
    """
    Get a comprehensive performance report with visualizations.
    """
    try:
        # Initialize feedback analyzer
        analyzer = get_feedback_analyzer()
        
        # Generate report
        report = analyzer.generate_performance_report(prediction_type, time_period)
        
        return report
    
    except Exception as e:
        logger.error(f"Error generating performance report: {e}")
        raise HTTPException(status_code=500, detail=str(e))