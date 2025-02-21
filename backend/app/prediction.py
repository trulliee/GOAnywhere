from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

def get_db():
    from app.main import db  # Import here to avoid circular import
    return db

class RequestData(BaseModel):
    start: str
    end: str
    date: str

class TrafficPrediction(BaseModel):
    jam_level: str
    congestion_level: str
    accident_probability: str
    weather_condition: str
    overall_conclusion: str

@router.post("/predict")
async def predict_traffic(request: RequestData):
    prediction = TrafficPrediction(
        jam_level="yellow",
        congestion_level="high",
        accident_probability="low",
        weather_condition="cloudy",
        overall_conclusion="It's okay to drive."
    )

    # Save to Firestore
    doc_ref = db.collection("traffic_predictions").document()
    doc_ref.set(request.dict() | prediction.dict())  # Merge input & output data

    return prediction