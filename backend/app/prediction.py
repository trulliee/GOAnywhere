# app/prediction.py

# app/prediction.py

from fastapi import APIRouter
from app.routes.prediction import router as prediction_router
import logging

# Set up logger
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Create router for the prediction API
router = APIRouter()

# Include the prediction router from routes/prediction.py
<<<<<<< HEAD
router.include_router(prediction_router, prefix="/api", tags=["Prediction"])
=======
router.include_router(prediction_router, prefix="/api", tags=["Prediction"])