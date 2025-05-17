from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List
import logging
import joblib
import os
import pandas as pd
from travel_time_prediction import TravelTimePredictionModel

app = FastAPI()

# Find latest model by timestamp in filename
def find_latest_model(path: str) -> str:
    files = [f for f in os.listdir(path) if f.startswith("model_") and f.endswith(".joblib")]
    if not files:
        raise FileNotFoundError("No versioned model files found in model_serving directory")
    files.sort(reverse=True)  # Newest first
    return os.path.join(path, files[0])

# Load the latest versioned model
model_path = os.path.join(os.path.dirname(__file__), "model.joblib")
model = TravelTimePredictionModel().load_model(model_path)
print("✅ Travel Time model loaded:", model_path)

# Pydantic input schema
class Instance(BaseModel):
    Expressway: str
    Direction: str
    Startpoint: str
    Endpoint: str
    hour: int
    day_of_week: int
    month: int
    is_holiday: int
    event_count: int
    incident_count: int
    temperature: float
    humidity: float
    peak_hour_flag: int
    day_type: str
    road_type: str
    recent_incident_flag: int
    speed_band_previous_hour: float
    rain_flag: int
    max_event_severity: int
    sum_event_severity: int
    mean_incident_severity: float
    max_incident_severity: int
    sum_incident_severity: int
    distance_km: float

class PredictionRequest(BaseModel):
    instances: List[Instance]

# Dummy class labels for travel time range
def get_dummy_classes():
    return ["low_estimate", "point_estimate", "high_estimate"]

# --- Local testing route ---
@app.post("/predict")
async def predict(request: PredictionRequest):
    try:
        input_data = [inst.dict() for inst in request.instances]
        result = model.predict(input_data)

        return {
            "predictions": [
                {
                    "prediction": result["predictions"][i],
                    "probabilities": result["probabilities"][i],
                    "classes": result["classes"]
                }
                for i in range(len(result["predictions"]))
            ]
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

