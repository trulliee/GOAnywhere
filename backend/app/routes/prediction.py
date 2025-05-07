# app/routes/prediction.py

from fastapi import APIRouter, HTTPException, Body, Query
from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any
from datetime import datetime
import logging
import os
import requests
import google.auth
from google.auth.transport.requests import Request as GoogleAuthRequest

from app.models.traffic_congestion_model import TrafficCongestionModel
from app.models.travel_time_prediction import TravelTimePredictionModel
from app.models.route_recommendation import RouteRecommendationModel
from app.models.feedback_analyzer import FeedbackAnalyzer

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Initialize router
router = APIRouter(
    prefix="/prediction",
    tags=["Prediction"]
)

# Environment config
VERTEX_ENDPOINT_TRAFFIC = os.getenv("VERTEX_ENDPOINT_TRAFFIC")
VERTEX_ENDPOINT_TRAVEL_TIME = os.getenv("VERTEX_ENDPOINT_TRAVEL_TIME")
PROJECT_ID = os.getenv("GCP_PROJECT_ID")
REGION = os.getenv("GCP_REGION", "asia-southeast1")

# Helper function to get access token
def get_google_auth_token():
    credentials, _ = google.auth.default()
    credentials.refresh(GoogleAuthRequest())
    return credentials.token

# Prediction request structure
class TrafficPredictionInput(BaseModel):
    RoadName: str
    RoadCategory: str
    hour: int
    day_of_week: int
    month: int
    is_holiday: int
    event_count: int = 0
    incident_count: int = 0
    temperature: float = 27.0
    humidity: float = 75.0
    peak_hour_flag: int = 0
    day_type: str = "weekday"
    road_type: str = "normal"
    recent_incident_flag: int = 0
    speed_band_previous_hour: int = 2
    rain_flag: int = 0
    max_event_severity: int = 0
    sum_event_severity: int = 0

@router.post("/traffic")
async def predict_traffic(input_data: TrafficPredictionInput):
    """
    Send traffic prediction request to deployed Vertex AI model server.
    """
    try:
        # Format the payload
        payload = {"instances": [input_data.dict()]}

        # Build full Vertex AI endpoint URL
        url = f"https://{REGION}-aiplatform.googleapis.com/v1/projects/{PROJECT_ID}/locations/{REGION}/endpoints/{VERTEX_ENDPOINT_TRAFFIC}:predict"
        
        # Get access token
        token = get_google_auth_token()
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }

        # Send request
        response = requests.post(url, headers=headers, json=payload)
        if response.status_code != 200:
            logger.error(f"Vertex AI traffic model error: {response.text}")
            raise HTTPException(status_code=500, detail="Vertex AI model failed to respond.")

        result = response.json()
        predictions = result.get("predictions", [])
        probabilities = result.get("probabilities", [])

        return {
            "status": "success",
            "predictions": predictions,
            "probabilities": probabilities
        }

    except Exception as e:
        logger.error(f"Traffic prediction error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

class TravelTimeInput(BaseModel):
    Expressway: str
    Direction: str
    Startpoint: str
    Endpoint: str
    hour: int
    day_of_week: int
    month: int
    is_holiday: int
    event_count: int = 0
    incident_count: int = 0
    temperature: float = 27.0
    humidity: float = 75.0
    peak_hour_flag: int = 0
    day_type: str = "weekday"
    road_type: str = "minor"
    recent_incident_flag: int = 0
    speed_band_previous_hour: float = 2
    rain_flag: int = 0
    max_event_severity: int = 0
    sum_event_severity: int = 0
    mean_incident_severity: float = 0.0
    max_incident_severity: int = 0
    sum_incident_severity: int = 0
    distance_km: float = 5.0

    
@router.post("/travel_time")
async def predict_travel_time(input_data: TravelTimeInput):
    """
    Send travel time prediction request to deployed Vertex AI model server.
    """
    try:
        payload = {"instances": [input_data.dict()]}

        url = f"https://{REGION}-aiplatform.googleapis.com/v1/projects/{PROJECT_ID}/locations/{REGION}/endpoints/{VERTEX_ENDPOINT_TRAVEL_TIME}:predict"
        token = get_google_auth_token()
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }

        response = requests.post(url, headers=headers, json=payload)
        if response.status_code != 200:
            logger.error(f"Vertex AI travel time model error: {response.text}")
            raise HTTPException(status_code=500, detail="Vertex AI model failed to respond.")

        result = response.json()
        predictions = result.get("predictions", [])
        probabilities = result.get("probabilities", [])

        return {
            "status": "success",
            "predictions": predictions,
            "probabilities": probabilities
        }

    except Exception as e:
        logger.error(f"Travel time prediction error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# (Leave route, feedback, and analysis logic unchanged...)

class IncidentImpactInput(BaseModel):
    road_name: str
    type: str
    timestamp: Optional[datetime] = None

class Coordinates(BaseModel):
    lat: float
    lon: float

class RoutePreferences(BaseModel):
    avoid_toll: bool = False
    avoid_expressway: bool = False
    priority: str = "fastest"

class RouteInput(BaseModel):
    origin: Coordinates
    destination: Coordinates
    preferences: Optional[RoutePreferences] = None

@router.post("/route")
async def recommend_route(input_data: RouteInput):
    """Recommend a route between origin and destination."""
    try:
        # Ensure route model is initialized
        route_model.update_data(force=True)
        
        # Make prediction
        result = route_model.recommend_route(
            input_data.origin.dict(),
            input_data.destination.dict(),
            input_data.preferences.dict() if input_data.preferences else None
        )
        
        if result.get("status") == "error":
            raise HTTPException(status_code=500, detail=result.get("error", "Route recommendation failed"))
        
        return result
    except Exception as e:
        logger.error(f"Error in route recommendation: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/routes/alternative")
async def get_alternative_routes(input_data: RouteInput, count: int = Query(3, ge=1, le=5)):
    """Get multiple alternative routes between origin and destination."""
    try:
        # Ensure route model is initialized
        route_model.update_data(force=True)
        
        # Get alternative routes
        results = route_model.get_alternative_routes(
            input_data.origin.dict(),
            input_data.destination.dict(),
            count,
            input_data.preferences.dict() if input_data.preferences else None
        )
        
        if isinstance(results, list) and results and results[0].get("status") == "error":
            raise HTTPException(status_code=500, detail=results[0].get("error", "Alternative routes recommendation failed"))
        
        return {
            "status": "success",
            "count": len(results),
            "routes": results
        }
    except Exception as e:
        logger.error(f"Error in alternative routes recommendation: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class FeedbackInput(BaseModel):
    prediction_type: str
    prediction_id: str
    actual_value: float
    predicted_value: float
    user_id: str
    timestamp: Optional[datetime] = None

@router.post("/feedback")
async def submit_feedback(input_data: FeedbackInput):
    """Submit feedback for a prediction."""
    try:
        # Prepare feedback data
        feedback_data = input_data.dict()
        
        # Record feedback
        feedback_id = feedback_analyzer.record_feedback(feedback_data)
        
        return {
            "status": "success",
            "feedback_id": feedback_id,
            "message": "Feedback recorded successfully"
        }
    except Exception as e:
        logger.error(f"Error recording feedback: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class AnalysisInput(BaseModel):
    prediction_type: str
    time_period: str = "last_30_days"

@router.post("/feedback/analyze")
async def analyze_feedback(input_data: AnalysisInput):
    """Analyze feedback for a prediction type."""
    try:
        # Get analysis
        analysis = feedback_analyzer.analyze_feedback_trends(
            input_data.prediction_type,
            input_data.time_period
        )
        
        return analysis
    except Exception as e:
        logger.error(f"Error analyzing feedback: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/feedback/report")
async def generate_performance_report(input_data: AnalysisInput):
    """Generate a comprehensive performance report."""
    try:
        # Generate report
        report = feedback_analyzer.generate_performance_report(
            input_data.prediction_type,
            input_data.time_period
        )
        
        return report
    except Exception as e:
        logger.error(f"Error generating report: {e}")
        raise HTTPException(status_code=500, detail=str(e))