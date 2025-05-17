from fastapi import HTTPException, FastAPI
from pydantic import BaseModel
from typing import List
import joblib
import os
import pandas as pd
from traffic_congestion_model import TrafficCongestionModel

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
model = TrafficCongestionModel().load_model(model_path)
print("✅ Traffic Congestion model loaded:", model_path)

# Pydantic request schema
class Instance(BaseModel):
    RoadName: str
    RoadCategory: str
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
    speed_band_previous_hour: int
    rain_flag: int
    max_event_severity: int
    sum_event_severity: int

class PredictionRequest(BaseModel):
    instances: List[Instance]

# --- Local route for testing ---
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