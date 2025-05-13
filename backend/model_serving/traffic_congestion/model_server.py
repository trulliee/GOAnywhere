from fastapi import HTTPException, FastAPI
from pydantic import BaseModel
from typing import List
import joblib
import os
import pandas as pd
from traffic_congestion_model import TrafficCongestionModel

app = FastAPI()

# Load model safely
model_path = "model.joblib"
if not os.path.exists(model_path):
    raise RuntimeError(f"Model file not found: {model_path}")
model = TrafficCongestionModel().load_model(model_path)

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

# # --- Vertex AI Compatible Endpoints ---
# @app.post("/v1/endpoints/{endpoint_id}:predict")
# async def vertex_predict(endpoint_id: str, request: PredictionRequest):
#     try:
#         json_input = [inst.dict() for inst in request.instances]
#         result = model.predict(json_input)
#         return {
#             "predictions": [
#                 {
#                     "prediction": result["predictions"][i],
#                     "probabilities": result["probabilities"][i],
#                     "classes": result["classes"]
#                 }
#                 for i in range(len(result["predictions"]))
#             ]
#         }
#     except Exception as e:
#         import traceback
#         traceback.print_exc()
#         return {"error": str(e)}

# @app.post("/v1/endpoints/{endpoint_id}/deployedModels/{model_id}:predict")
# async def vertex_predict_with_model(endpoint_id: str, model_id: str, request: PredictionRequest):
#     try:
#         json_input = [inst.dict() for inst in request.instances]
#         result = model.predict(json_input)
#         return {
#             "predictions": [
#                 {
#                     "prediction": result["predictions"][i],
#                     "probabilities": result["probabilities"][i],
#                     "classes": result["classes"]
#                 }
#                 for i in range(len(result["predictions"]))
#             ]
#         }
#     except Exception as e:
#         import traceback
#         traceback.print_exc()
#         return {"error": str(e)}

# @app.get("/v1/endpoints/{endpoint_id}/deployedModels/{model_id}")
# def health_check(endpoint_id: str, model_id: str):
#     return {"status": "healthy"}