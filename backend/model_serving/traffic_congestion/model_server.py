from fastapi import FastAPI
from pydantic import BaseModel
from typing import List
import joblib
import os
import pandas as pd
from traffic_congestion_model import TrafficCongestionModel

app = FastAPI()
model = TrafficCongestionModel().load_model("model.joblib")

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

# Standard local test route (optional)
@app.post("/predict")
async def predict(request: PredictionRequest):
    try:
        input_dicts = [instance.dict() for instance in request.instances]
        X = model.process_inputs(input_dicts)
        predictions = model.model.predict(X).tolist()
        return {"predictions": predictions}
    except Exception as e:
        return {"error": str(e)}

@app.post("/predict_proba")
async def predict_proba(request: PredictionRequest):
    try:
        input_dicts = [instance.dict() for instance in request.instances]
        X = model.process_inputs(input_dicts)
        probabilities = model.model.predict_proba(X).tolist()
        return {"probabilities": probabilities}
    except Exception as e:
        return {"error": str(e)}

@app.post("/v1/endpoints/{endpoint_id}:predict")
async def vertex_predict(endpoint_id: str, request: PredictionRequest):
    try:
        input_dicts = [instance.dict() for instance in request.instances]
        X = model.process_inputs(input_dicts)
        predictions = model.model.predict(X).tolist()
        probabilities = model.model.predict_proba(X).tolist()
        return {
            "predictions": predictions,
            "probabilities": probabilities
        }
    except Exception as e:
        return {"error": str(e)}

@app.post("/v1/endpoints/{endpoint_id}/deployedModels/{model_id}:predict")
async def vertex_predict(endpoint_id: str, model_id: str, request: PredictionRequest):
    try:
        input_dicts = [instance.dict() for instance in request.instances]
        X = model.process_inputs(input_dicts)
        predictions = model.model.predict(X).tolist()

        # Check if model has predict_proba (some models like SVM might not)
        if hasattr(model.model, "predict_proba"):
            probabilities = model.model.predict_proba(X).tolist()
            return {
                "predictions": predictions,
                "probabilities": probabilities
            }
        else:
            return {
                "predictions": predictions
            }

    except Exception as e:
        return {"error": str(e)}

@app.post("/v1/endpoints/{endpoint_id}/deployedModels/{model_id}:predict_proba")
async def vertex_predict_proba(endpoint_id: str, model_id: str, request: PredictionRequest):
    try:
        input_dicts = [instance.dict() for instance in request.instances]
        X = model.process_inputs(input_dicts)
        probabilities = model.model.predict_proba(X).tolist()
        return {"probabilities": probabilities}
    except Exception as e:
        return {"error": str(e)}

# Health check for readiness
@app.get("/v1/endpoints/{endpoint_id}/deployedModels/{model_id}")
def health_check(endpoint_id: str, model_id: str):
    return {"status": "healthy"}
