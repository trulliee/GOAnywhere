# app/routes/prediction.py

from fastapi import APIRouter, HTTPException, Body, Query
from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any
from datetime import datetime
import logging
import os
import requests
import json
import google.auth
from google.auth.transport.requests import Request as GoogleAuthRequest

from app.models.traffic_congestion_model import TrafficCongestionModel
from app.models.travel_time_prediction import TravelTimePredictionModel
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

        logger.info(f"Payload sent: {json.dumps(payload)}")
        logger.info(f"URL: {url}")
        logger.info(f"Response code: {response.status_code}")
        logger.info(f"Response body: {response.text}")
        
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

class FeedbackRatingInput(BaseModel):
    user_id: str
    prediction_type: str
    rating: int = Field(ge=1, le=5)
    comment: Optional[str] = None
    timestamp: Optional[datetime] = None

@router.post("/feedback")
async def submit_feedback(input_data: FeedbackRatingInput):
    try:
        feedback_data = input_data.dict()
        feedback_id = feedback_analyzer.store_feedback(feedback_data)
        return {
            "status": "success",
            "feedback_id": feedback_id,
            "message": "Feedback submitted successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/feedback/summary")
async def get_feedback_summary(prediction_type: str = Query(...), days: int = Query(30)):
    try:
        summary = feedback_analyzer.analyze_feedback(prediction_type, days)
        return summary
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
