# app/routes/prediction.py

from fastapi import APIRouter, HTTPException, Body, Query
from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any
from datetime import datetime
import logging
#from app.models.traffic_congestion_model import TrafficPredictionModel
from app.models.travel_time_prediction import TravelTimeModel
from app.models.route_recommendation import RouteRecommendationModel
from app.models.feedback_analyzer import FeedbackAnalyzer
from app.services.vertex import submit_training_job, deploy_model_to_endpoint

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Initialize router
router = APIRouter(
    prefix="/api/prediction",
    tags=["prediction"],
    responses={404: {"description": "Not found"}},
)

# Initialize models - you may need to adjust paths based on your setup
MODEL_PATH = "./models"
traffic_model = TrafficPredictionModel(model_path=MODEL_PATH)
travel_time_model = TravelTimeModel(model_path=MODEL_PATH)
route_model = RouteRecommendationModel()
feedback_analyzer = FeedbackAnalyzer()

# Model status check
@router.get("/status")
async def check_models_status():
    """Check if all models are loaded and available."""
    status = {
        "traffic_model": traffic_model.speed_model is not None,
        "travel_time_model": travel_time_model.travel_time_model is not None or bool(travel_time_model.expressway_models),
        "route_model": route_model.road_graph is not None,
        "feedback_analyzer": True  # Always available as it doesn't need pre-loaded models
    }
    
    return {
        "status": "ok" if all(status.values()) else "partial",
        "models_status": status
    }

# Define input models for API
class TrafficPredictionInput(BaseModel):
    road_name: str
    hour: int = Field(..., ge=0, lt=24)
    day_of_week: int = Field(..., ge=0, lt=7)
    is_weekend: int = Field(..., ge=0, le=1)
    is_holiday: int = Field(..., ge=0, le=1)
    RoadCategory_Numeric: int = Field(..., ge=0, le=4)
    weather_temp_high: float = 30.0
    weather_rain_forecast: int = Field(0, ge=0, le=1)
    nearby_incidents: int = Field(0, ge=0)

@router.post("/traffic")
async def predict_traffic(input_data: TrafficPredictionInput):
    """Predict traffic conditions for a given road and time."""
    try:
        # Convert input data to dict for model
        features = input_data.dict()
        
        # Check if models are loaded
        if traffic_model.speed_model is None or traffic_model.condition_model is None:
            traffic_model.load_models()
            if traffic_model.speed_model is None:
                raise HTTPException(status_code=500, detail="Traffic prediction models not loaded")
        
        # Make predictions
        speed_prediction = traffic_model.predict_speed(features)
        condition_prediction = traffic_model.predict_traffic_condition(features)
        
        if speed_prediction is None or condition_prediction is None:
            raise HTTPException(status_code=500, detail="Prediction failed")
        
        # Determine confidence based on weather and incidents
        confidence = "high"
        if features["weather_rain_forecast"] == 1:
            confidence = "medium"
        if features["nearby_incidents"] > 0:
            confidence = "low"
        
        return {
            "status": "success",
            "predictions": {
                "speed_band": round(speed_prediction, 1),
                "traffic_condition": condition_prediction,
                "confidence": confidence
            }
        }
    except Exception as e:
        logger.error(f"Error in traffic prediction: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class TravelTimeInput(BaseModel):
    expressway: str
    direction: str
    timestamp: Optional[datetime] = None

@router.post("/travel_time")
async def predict_travel_time(input_data: TravelTimeInput):
    """Predict travel time for a specific expressway and direction."""
    try:
        # Check if model is loaded
        if not travel_time_model.travel_time_model and not travel_time_model.expressway_models:
            travel_time_model.load_models()
            if not travel_time_model.travel_time_model and not travel_time_model.expressway_models:
                raise HTTPException(status_code=500, detail="Travel time model not loaded")
        
        # Make prediction
        result = travel_time_model.predict_travel_time(
            input_data.expressway,
            input_data.direction,
            input_data.timestamp
        )
        
        if result.get("status") == "error":
            raise HTTPException(status_code=500, detail=result.get("error", "Prediction failed"))
        
        return result
    except Exception as e:
        logger.error(f"Error in travel time prediction: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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

@router.post("/train-models")
async def train_models_endpoint():
    """Trigger model training on Vertex AI"""
    try:
        job_result = submit_training_job()
        return {"success": True, "job_info": job_result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Training job failed: {str(e)}")

@router.post("/deploy-model")
async def deploy_model_endpoint(model_path: str, model_name: str):
    """Deploy a trained model to a Vertex AI endpoint"""
    try:
        deployment_result = deploy_model_to_endpoint(model_path, model_name)
        return {"success": True, "deployment_info": deployment_result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Model deployment failed: {str(e)}")