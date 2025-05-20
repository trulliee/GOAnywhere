# app/routes/prediction.py

from fastapi import APIRouter, HTTPException, Query, Body
from pydantic import BaseModel, Field
from typing import List, Optional
import datetime
import logging
import os
import requests
import json
import google.auth
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.cloud import firestore
from app.models.feedback_analyzer import FeedbackAnalyzer

# Logger setup
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/prediction",
    tags=["Prediction"]
)

print("✅ prediction router loaded")

@router.get("/ping")
def ping():
    return {"message": "prediction router is alive"}


# Instantiate FeedbackAnalyzer
feedback_analyzer = FeedbackAnalyzer()

# Firestore logging
db = firestore.Client()

def log_prediction_to_firestore(model_name: str, model_input: dict, model_output: dict):
    log_entry = {
        "model_name": model_name,
        "input": model_input,
        "output": model_output,
        "timestamp": datetime.datetime.utcnow()
    }
    try:
        db.collection("model_predictions_log").add(log_entry)
        logger.info(f"[LOGGED] Prediction logged for model: {model_name}")
    except Exception as e:
        logger.error(f"[LOGGING ERROR] Failed to log prediction: {e}")


# # Auth token helper
# def get_google_auth_token():
#     credentials, _ = google.auth.default()
#     credentials.refresh(GoogleAuthRequest())
#     return credentials.token

from google.oauth2 import service_account

def get_google_auth_token():
    service_account_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")

    scopes = ["https://www.googleapis.com/auth/cloud-platform"]

    if service_account_path and os.path.exists(service_account_path):
        # Use explicit service account locally
        credentials = service_account.Credentials.from_service_account_file(service_account_path, scopes=scopes)
    else:
        # Use default credentials on Cloud Run
        credentials, _ = google.auth.default(scopes=scopes)

    credentials.refresh(GoogleAuthRequest())
    return credentials.token


# --- 🚦 Traffic Congestion Input Schema ---
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

# --- 🔮 Predict Congestion Class Only ---
# Cloud Run URL for traffic congestion model
CLOUD_RUN_CONGESTION_URL = "https://goanywhere-traffic-congestion-model-server-541900038032.asia-southeast1.run.app/predict"

@router.post("/congestion")
async def predict_congestion(input_data: TrafficPredictionInput = Body(...)):
    try:
        payload = {"instances": [input_data.dict()]}

        headers = {
            "Content-Type": "application/json"
        }

        response = requests.post(CLOUD_RUN_CONGESTION_URL, headers=headers, json=payload)

        logger.info(f"[DEBUG] Received input payload: {json.dumps(input_data.dict())}")
        logger.info(f"[PREDICT] URL: {CLOUD_RUN_CONGESTION_URL}")
        logger.info(f"[PREDICT] Response: {response.text}")

        if response.status_code != 200:
            try:
                error_details = response.json()
            except Exception:
                error_details = response.text
            logger.error(f"Prediction error: {error_details}")
            raise HTTPException(status_code=500, detail="Cloud Run congestion model failed.")

        result = response.json()

        # Log to Firestore
        log_prediction_to_firestore(
            model_name="traffic_congestion",
            model_input=input_data.dict(),
            model_output=result,
        )

        return {
            "status": "success",
            "predictions": result.get("predictions", [])
        }


    except Exception as e:
        logger.exception("Unexpected error during congestion prediction.")
        raise HTTPException(status_code=500, detail=str(e))

# --- Travel Time Prediction ---

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
    try:
        payload = {"instances": [input_data.dict()]}

        url = "https://goanywhere-travel-time-model-server-541900038032.asia-southeast1.run.app/predict"
        headers = {
            "Content-Type": "application/json"
        }

        response = requests.post(url, headers=headers, json=payload)

        logger.info(f"Travel time request payload: {json.dumps(payload)}")
        logger.info(f"URL: {url}")
        logger.info(f"Response code: {response.status_code}")
        logger.info(f"Response body: {response.text}")

        if response.status_code != 200:
            try:
                error_details = response.json()
            except Exception:
                error_details = response.text
            logger.error(f"Cloud Run travel time model error: {error_details}")
            raise HTTPException(status_code=500, detail="Cloud Run travel time model failed to respond.")

        result = response.json()

        # Log to Firestore
        log_prediction_to_firestore(
            model_name="travel_time",
            model_input=input_data.dict(),
            model_output=result,
        )

        return {
            "status": "success",
            "predictions": result.get("predictions", [])
        }

    except Exception as e:
        logger.error(f"Travel time prediction error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# --- Feedback ---

class FeedbackRatingInput(BaseModel):
    prediction_type: str
    rating: int = Field(ge=1, le=5)
    comment: Optional[str] = None
    timestamp: Optional[datetime.datetime] = None

@router.post("/feedback")
async def submit_feedback(input_data: FeedbackRatingInput):
    try:
        feedback_data = input_data.dict()
        feedback_id = feedback_analyzer.record_feedback(
            prediction_type=feedback_data["prediction_type"],
            rating=feedback_data["rating"],
            feedback_text=feedback_data.get("comment", "")
        )

        return {
            "status": "success",
            "feedback_id": feedback_id,
            "message": "Feedback submitted successfully"
        }
    except Exception as e:
        logger.error(f"Feedback submission error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/feedback/summary")
async def get_feedback_summary(prediction_type: str = Query(...), days: int = Query(30)):
    try:
        summary = feedback_analyzer.analyze_feedback(prediction_type, days)
        return summary
    except Exception as e:
        logger.error(f"Feedback summary error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))