# app/routes/prediction.py

from fastapi import APIRouter, Depends, HTTPException, Body, Query, Header
from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any, Union
from datetime import datetime, timedelta
import logging
import uuid

# Import model implementations
from app.models.traffic_prediction_model import TrafficPredictionModel
from app.models.travel_time_model import TravelTimeModel
from app.models.incident_impact_model import IncidentImpactModel
from app.models.route_recommendation import RouteRecommendationModel
from app.models.feedback_analyzer import FeedbackAnalyzer

# Import A/B testing
from app.testing.ab_testing import ModelABTesting

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize router
router = APIRouter(
    prefix="/prediction",
    tags=["prediction"],
    responses={404: {"description": "Not found"}},
)

# Initialize models (lazy loading)
traffic_model = None
travel_time_model = None
incident_model = None
route_model = None
feedback_analyzer = None
ab_testing = None

def get_traffic_model():
    """Lazy loading of traffic prediction model."""
    global traffic_model
    if traffic_model is None:
        traffic_model = TrafficPredictionModel('app/models/traffic_prediction_model.joblib')
    return traffic_model

def get_travel_time_model():
    """Lazy loading of travel time model."""
    global travel_time_model
    if travel_time_model is None:
        travel_time_model = TravelTimeModel('app/models/travel_time_model.joblib')
    return travel_time_model

def get_incident_model():
    """Lazy loading of incident impact model."""
    global incident_model
    if incident_model is None:
        incident_model = IncidentImpactModel('app/models/incident_impact_model.joblib')
    return incident_model

def get_route_model():
    """Lazy loading of route recommendation model."""
    global route_model
    if route_model is None:
        route_model = RouteRecommendationModel(
            traffic_prediction_model=get_traffic_model(),
            travel_time_model=get_travel_time_model(),
            incident_impact_model=get_incident_model()
        )
    return route_model

def get_feedback_analyzer():
    """Lazy loading of feedback analyzer."""
    global feedback_analyzer
    if feedback_analyzer is None:
        feedback_analyzer = FeedbackAnalyzer()
    return feedback_analyzer

def get_ab_testing():
    """Lazy loading of A/B testing module."""
    global ab_testing
    if ab_testing is None:
        ab_testing = ModelABTesting()
    return ab_testing

# Input models
class LocationModel(BaseModel):
    latitude: float = Field(..., description="Latitude coordinate")
    longitude: float = Field(..., description="Longitude coordinate")
    name: Optional[str] = Field(None, description="Location name (if available)")

class WeatherConditionsModel(BaseModel):
    temperature: Optional[float] = Field(None, description="Temperature in Celsius")
    humidity: Optional[float] = Field(None, description="Humidity percentage")
    rainfall: Optional[float] = Field(None, description="Rainfall amount in mm")
    visibility: Optional[float] = Field(None, description="Visibility in km")
    weather_main: Optional[str] = Field(None, description="Main weather condition (Clear, Rain, etc.)")

class RoutePreferencesModel(BaseModel):
    avoid_congestion: Optional[bool] = Field(False, description="Prefer routes with less congestion")
    prefer_fastest: Optional[bool] = Field(True, description="Prefer fastest routes")
    avoid_incidents: Optional[bool] = Field(True, description="Avoid routes with incidents")

class NavigationRequestModel(BaseModel):
    start_location: Union[str, LocationModel] = Field(..., description="Starting point (address or coordinates)")
    destination_location: Union[str, LocationModel] = Field(..., description="Destination point (address or coordinates)")
    departure_time: Optional[datetime] = Field(None, description="Departure time (defaults to current time)")
    transport_mode: str = Field("driving", description="Mode of transport (driving or public_transport)")
    preferences: Optional[RoutePreferencesModel] = Field(None, description="Route preferences")

class FeedbackRequestModel(BaseModel):
    prediction_type: str = Field(..., description="Type of prediction (travel_time, traffic_condition, etc.)")
    prediction_id: str = Field(..., description="ID of the prediction being rated")
    user_id: str = Field(..., description="ID of the user providing feedback")
    actual_value: Union[float, str] = Field(..., description="Actual observed value")
    predicted_value: Union[float, str] = Field(..., description="Value that was predicted")
    timestamp: Optional[datetime] = Field(None, description="Time when feedback was provided")
    location: Optional[LocationModel] = Field(None, description="Location relevant to the prediction")
    additional_comments: Optional[str] = Field(None, description="Additional feedback comments")
    experiment_id: Optional[str] = Field(None, description="ID of the A/B testing experiment")
    variant: Optional[str] = Field(None, description="Variant used for prediction (control or test)")

# API Routes
@router.post("/route", response_model=Dict[str, Any])
async def get_route_recommendations(
    request: NavigationRequestModel = Body(...),
    user_id: Optional[str] = Header(None),
    ab_test: Optional[bool] = Query(True, description="Enable A/B testing")
):
    """
    Get route recommendations based on current traffic conditions, incidents, and weather.
    """
    try:
        # Get departure time (default to now)
        departure_time = request.departure_time or datetime.now()
        
        # Initialize route model
        route_model = get_route_model()
        
        # For route recommendations, we're not using A/B testing directly here,
        # since this endpoint uses a composite model that includes traffic, travel time, and incident models
        
        # Get recommendations
        recommendations = route_model.get_route_recommendations(
            origin=request.start_location,
            destination=request.destination_location,
            departure_time=departure_time,
            mode=request.transport_mode,
            preferences=request.preferences.dict() if request.preferences else None
        )
        
        # Generate a prediction_id for tracking
        prediction_id = str(uuid.uuid4())
        recommendations['prediction_id'] = prediction_id
        
        return recommendations
    
    except Exception as e:
        logger.error(f"Error getting route recommendations: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/traffic", response_model=Dict[str, Any])
async def predict_traffic_conditions(
    latitude: float = Query(..., description="Latitude coordinate"),
    longitude: float = Query(..., description="Longitude coordinate"),
    prediction_time: Optional[datetime] = Query(None, description="Time for prediction (defaults to current time)"),
    road_name: Optional[str] = Query(None, description="Road name (if known)"),
    user_id: Optional[str] = Header(None),
    ab_test: Optional[bool] = Query(True, description="Enable A/B testing")
):
    """
    Predict traffic conditions at a specific location and time.
    """
    try:
        # Get prediction time (default to now)
        pred_time = prediction_time or datetime.now()
        
        # Create location object
        location = {
            'latitude': latitude,
            'longitude': longitude,
            'road_name': road_name
        }
        
        # Get current weather conditions
        # In a real implementation, this would query a weather service
        # or use cached weather data from Firestore
        weather = {
            'temperature': 28.5,
            'humidity': 85.0,
            'rainfall': 0.0,
            'weather_main': 'Clear'
        }
        
        # Create features for prediction
        features = {
            'timestamp': pred_time,
            'latitude': latitude,
            'longitude': longitude,
            'road_name': road_name,
            'temperature': weather['temperature'],
            'humidity': weather['humidity'],
            'rainfall': weather['rainfall'],
            'weather_main': weather['weather_main'],
            'hour_of_day': pred_time.hour,
            'day_of_week': pred_time.weekday(),
            'month': pred_time.month,
            'is_peak_hour': 1 if (7 <= pred_time.hour <= 9) or (17 <= pred_time.hour <= 19) else 0
        }
        
        # For A/B testing
        experiment_id = None
        variant = "default"
        
        # Use A/B testing to get the model if enabled
        if ab_test:
            ab_testing = get_ab_testing()
            model, experiment_id, variant = ab_testing.get_model_for_request("traffic_prediction", user_id)
        else:
            # Use the standard model
            model = get_traffic_model()
        
        # Make prediction
        import pandas as pd
        prediction = model.predict(pd.DataFrame([features]))[0]
        
        # Create response
        response = {
            'location': location,
            'prediction_time': pred_time.isoformat(),
            'predicted_speed_band': prediction,
            'traffic_condition': model._map_speed_to_severity(prediction),
            'confidence': 0.85,  # Placeholder - would be provided by the model
            'weather_conditions': weather,
            'prediction_id': str(uuid.uuid4()),
            'experiment_id': experiment_id,
            'variant': variant
        }
        
        # Record the prediction for A/B testing if enabled
        if ab_test and experiment_id and variant in ['control', 'test']:
            ab_testing.record_prediction_result(
                experiment_id=experiment_id,
                variant=variant,
                prediction=prediction,
                metadata={'location': location, 'time': pred_time.isoformat()}
            )
        
        return response
    
    except Exception as e:
        logger.error(f"Error predicting traffic conditions: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/travel-time", response_model=Dict[str, Any])
async def predict_travel_time(
    request: NavigationRequestModel = Body(...),
    user_id: Optional[str] = Header(None),
    ab_test: Optional[bool] = Query(True, description="Enable A/B testing")
):
    """
    Predict travel time between origin and destination.
    """
    try:
        # Get departure time (default to now)
        departure_time = request.departure_time or datetime.now()
        
        # For A/B testing
        experiment_id = None
        variant = "default"
        
        # Use A/B testing to get the model if enabled
        if ab_test:
            ab_testing = get_ab_testing()
            model, experiment_id, variant = ab_testing.get_model_for_request("travel_time", user_id)
        else:
            # Use the standard model
            model = get_travel_time_model()
        
        # Predict travel time
        prediction = model.predict_travel_time(
            origin=request.start_location,
            destination=request.destination_location,
            mode=request.transport_mode,
            departure_time=departure_time,
            avoid_congestion=request.preferences.avoid_congestion if request.preferences else False
        )
        
        # Add A/B testing information
        prediction['prediction_id'] = str(uuid.uuid4())
        prediction['experiment_id'] = experiment_id
        prediction['variant'] = variant
        
        # Record the prediction for A/B testing if enabled
        if ab_test and experiment_id and variant in ['control', 'test']:
            ab_testing.record_prediction_result(
                experiment_id=experiment_id,
                variant=variant,
                prediction=prediction['predicted_travel_time_minutes'],
                metadata={
                    'origin': str(request.start_location),
                    'destination': str(request.destination_location),
                    'mode': request.transport_mode,
                    'time': departure_time.isoformat()
                }
            )
        
        return prediction
    
    except Exception as e:
        logger.error(f"Error predicting travel time: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/incident-impact", response_model=Dict[str, Any])
async def predict_incident_impact(
    incident_type: str = Query(..., description="Type of incident (accident, roadwork, etc.)"),
    latitude: float = Query(..., description="Latitude coordinate"),
    longitude: float = Query(..., description="Longitude coordinate"),
    road_name: Optional[str] = Query(None, description="Road name (if known)"),
    prediction_time: Optional[datetime] = Query(None, description="Time for prediction (defaults to current time)"),
    user_id: Optional[str] = Header(None),
    ab_test: Optional[bool] = Query(True, description="Enable A/B testing")
):
    """
    Predict the impact of a traffic incident.
    """
    try:
        # Get prediction time (default to now)
        pred_time = prediction_time or datetime.now()
        
        # Create location object
        location = {
            'latitude': latitude,
            'longitude': longitude,
            'road_name': road_name
        }
        
        # Get current weather conditions
        # In a real implementation, this would query a weather service
        # or use cached weather data from Firestore
        weather = {
            'temperature': 28.5,
            'humidity': 85.0,
            'rainfall': 0.0,
            'weather_main': 'Clear'
        }
        
        # For A/B testing
        experiment_id = None
        variant = "default"
        
        # Use A/B testing to get the model if enabled
        if ab_test:
            ab_testing = get_ab_testing()
            model, experiment_id, variant = ab_testing.get_model_for_request("incident_impact", user_id)
        else:
            # Use the standard model
            model = get_incident_model()
        
        # Predict incident impact
        impact = model.predict_impact(
            incident_type=incident_type,
            location=location,
            timestamp=pred_time,
            weather_conditions=weather
        )
        
        # Add A/B testing information
        impact['prediction_id'] = str(uuid.uuid4())
        impact['experiment_id'] = experiment_id
        impact['variant'] = variant
        
        # Record the prediction for A/B testing if enabled
        if ab_test and experiment_id and variant in ['control', 'test']:
            ab_testing.record_prediction_result(
                experiment_id=experiment_id,
                variant=variant,
                prediction=impact['severity_level'],
                metadata={
                    'incident_type': incident_type,
                    'location': location,
                    'time': pred_time.isoformat()
                }
            )
        
        return impact
    
    except Exception as e:
        logger.error(f"Error predicting incident impact: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/feedback", response_model=Dict[str, Any])
async def submit_prediction_feedback(
    feedback: FeedbackRequestModel = Body(...),
):
    """
    Submit feedback on a prediction's accuracy.
    This endpoint also updates A/B testing results when experiment_id and variant are provided.
    """
    try:
        # Initialize feedback analyzer
        analyzer = get_feedback_analyzer()
        
        # Prepare feedback data
        feedback_data = feedback.dict()
        
        # Record feedback
        feedback_id = analyzer.record_feedback(feedback_data)
        
        # If this feedback is for an A/B test, update the experiment results
        if feedback.experiment_id and feedback.variant in ['control', 'test']:
            ab_testing = get_ab_testing()
            
            # Update the result with the actual value
            ab_testing.record_prediction_result(
                experiment_id=feedback.experiment_id,
                variant=feedback.variant,
                prediction=feedback.predicted_value,
                actual=feedback.actual_value,
                metadata={
                    'feedback_id': feedback_id,
                    'user_id': feedback.user_id,
                    'prediction_type': feedback.prediction_type
                }
            )
        
        return {
            "message": "Feedback recorded successfully",
            "feedback_id": feedback_id
        }
    
    except Exception as e:
        logger.error(f"Error recording feedback: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/accuracy-metrics", response_model=Dict[str, Any])
async def get_accuracy_metrics(
    prediction_type: str = Query(..., description="Type of prediction (travel_time, traffic_condition, etc.)"),
    time_period: str = Query("last_30_days", description="Time period for metrics (last_7_days, last_30_days, last_90_days)")
):
    """
    Get accuracy metrics for predictions based on user feedback.
    This combines both standard feedback and A/B testing results.
    """
    try:
        # Initialize feedback analyzer
        analyzer = get_feedback_analyzer()
        
        # Get feedback analysis
        analysis = analyzer.analyze_feedback_trends(prediction_type, time_period)
        
        # Get A/B testing results for the same model type
        ab_testing = get_ab_testing()
        experiments = ab_testing.get_active_experiments(model_type=prediction_type)
        
        # Add A/B testing results to the analysis
        if experiments:
            analysis['ab_testing'] = {
                'active_experiments': len(experiments),
                'experiments': []
            }
            
            for experiment in experiments:
                exp_summary = {
                    'id': experiment.get('id'),
                    'description': experiment.get('description'),
                    'start_date': experiment.get('start_date'),
                    'control_metrics': experiment.get('control_metrics'),
                    'test_metrics': experiment.get('test_metrics'),
                    'significant_difference': experiment.get('significant_difference'),
                    'winner': experiment.get('winner')
                }
                analysis['ab_testing']['experiments'].append(exp_summary)
        
        return analysis
    
    except Exception as e:
        logger.error(f"Error getting accuracy metrics: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/performance-report", response_model=Dict[str, Any])
async def get_performance_report(
    prediction_type: str = Query(..., description="Type of prediction (travel_time, traffic_condition, etc.)"),
    time_period: str = Query("last_30_days", description="Time period for report (last_7_days, last_30_days, last_90_days)")
):
    """
    Get a comprehensive performance report with visualizations.
    """
    try:
        # Initialize feedback analyzer
        analyzer = get_feedback_analyzer()
        
        # Generate report
        report = analyzer.generate_performance_report(prediction_type, time_period)
        
        # Add A/B testing results if available
        ab_testing = get_ab_testing()
        experiments = ab_testing.get_active_experiments(model_type=prediction_type)
        
        if experiments:
            report['ab_testing'] = {
                'active_experiments': len(experiments),
                'experiments': []
            }
            
            for experiment in experiments:
                exp_results = ab_testing.get_experiment_results(experiment.get('id'))
                if exp_results:
                    report['ab_testing']['experiments'].append(exp_results.get('overview'))
        
        return report
    
    except Exception as e:
        logger.error(f"Error generating performance report: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Add A/B Testing specific endpoints
class ABTestExperimentCreateModel(BaseModel):
    model_type: str = Field(..., description="Type of model to test (traffic_prediction, travel_time, incident_impact)")
    control_model_path: str = Field(..., description="Path to the control model file")
    test_model_path: str = Field(..., description="Path to the test model file")
    description: Optional[str] = Field(None, description="Description of the experiment")
    success_metric: str = Field("accuracy", description="Metric to use for determining success")
    traffic_split: Optional[Dict[str, float]] = Field(None, description="Traffic split between control and test")
    duration_days: Optional[int] = Field(None, description="Duration of the experiment in days")

@router.post("/ab-test/experiments", response_model=Dict[str, Any])
async def create_ab_test_experiment(
    request: ABTestExperimentCreateModel = Body(...),
):
    """
    Create a new A/B testing experiment.
    """
    try:
        # Initialize A/B testing
        ab_testing = get_ab_testing()
        
        # Calculate end date if duration provided
        end_date = None
        if request.duration_days:
            end_date = datetime.now() + timedelta(days=request.duration_days)
        
        # Create experiment
        experiment_id = ab_testing.create_experiment(
            model_type=request.model_type,
            control_model_path=request.control_model_path,
            test_model_path=request.test_model_path,
            description=request.description,
            success_metric=request.success_metric,
            traffic_split=request.traffic_split,
            end_date=end_date
        )
        
        return {
            "message": "A/B testing experiment created successfully",
            "experiment_id": experiment_id
        }
    
    except Exception as e:
        logger.error(f"Error creating A/B testing experiment: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/ab-test/experiments", response_model=List[Dict[str, Any]])
async def list_ab_test_experiments(
    model_type: Optional[str] = Query(None, description="Filter by model type")
):
    """
    List active A/B testing experiments.
    """
    try:
        # Initialize A/B testing
        ab_testing = get_ab_testing()
        
        # Get active experiments
        experiments = ab_testing.get_active_experiments(model_type=model_type)
        
        return experiments
    
    except Exception as e:
        logger.error(f"Error listing A/B testing experiments: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/ab-test/experiments/{experiment_id}", response_model=Dict[str, Any])
async def get_ab_test_experiment(
    experiment_id: str
):
    """
    Get detailed information about an A/B testing experiment.
    """
    try:
        # Initialize A/B testing
        ab_testing = get_ab_testing()
        
        # Get experiment results
        results = ab_testing.get_experiment_results(experiment_id)
        
        if not results:
            raise HTTPException(status_code=404, detail=f"Experiment {experiment_id} not found")
        
        return results
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting A/B testing experiment: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/ab-test/experiments/{experiment_id}/end", response_model=Dict[str, Any])
async def end_ab_test_experiment(
    experiment_id: str,
    promote_winner: bool = Query(True, description="Whether to promote the winning model")
):
    """
    End an A/B testing experiment.
    """
    try:
        # Initialize A/B testing
        ab_testing = get_ab_testing()
        
        # End experiment
        results = ab_testing.end_experiment(experiment_id, promote_winner=promote_winner)
        
        if not results:
            raise HTTPException(status_code=404, detail=f"Experiment {experiment_id} not found")
        
        return {
            "message": f"Experiment {experiment_id} ended successfully",
            "results": results
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error ending A/B testing experiment: {e}")
        raise HTTPException(status_code=500, detail=str(e))