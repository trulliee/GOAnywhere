from fastapi import APIRouter
from app.routes.prediction import router as prediction_router

# Create router for the prediction API
router = APIRouter()

# Include the prediction router from routes/prediction.py
router.include_router(prediction_router, prefix="/api", tags=["Prediction"])

# You can add additional functions here for frontend-specific functionality
def get_frontend_prediction_data():
    # Your frontend connection logic here
    pass