from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List
import logging
import joblib
import os
import pandas as pd
from travel_time_prediction import TravelTimePredictionModel

app = FastAPI()

# Load model
model_path = "model.joblib"
if not os.path.exists(model_path):
    raise RuntimeError(f"Model file not found: {model_path}")
model = TravelTimePredictionModel().load_model(model_path)

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

        # 1) Let the model do its thing
        result = model.predict(input_data)
        # result is already:
        # {
        #   "predictions": [...],
        #   "probabilities": [...],
        #   "classes": [...]
        # }

        # 2) Return it verbatim (or wrap with status)
        return {
            "status": "success",
            **result
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



# # --- Vertex AI Compatible Endpoints ---
# async def vertex_predict_common(request: PredictionRequest):
#     try:
#         input_data = [inst.dict() for inst in request.instances]
#         preds = model.predict(input_data)

#         probas = []
#         for p in preds:
#             low = round(p - 0.2 * p, 2)
#             high = round(p + 0.2 * p, 2)
#             probas.append([low, p, high])

#         return {
#             "predictions": preds,
#             "probabilities": probas,
#             "classes": ["low_estimate", "point_estimate", "high_estimate"]
#         }
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))

# @app.post("/v1/endpoints/{endpoint_id}:predict")
# async def vertex_predict(endpoint_id: str, request: PredictionRequest):
#     return await vertex_predict_common(request)

# @app.post("/v1/endpoints/{endpoint_id}/deployedModels/{model_id}:predict")
# async def vertex_predict_with_model(endpoint_id: str, model_id: str, request: PredictionRequest):
#     return await vertex_predict_common(request)


# @app.get("/v1/endpoints/{endpoint_id}/deployedModels/{model_id}")
# def health_check(endpoint_id: str, model_id: str):
#     return {"status": "healthy"}
