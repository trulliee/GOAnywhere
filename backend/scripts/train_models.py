import os
from datetime import datetime, timedelta
from app.models.traffic_prediction import TrafficWeatherPredictor
import logging

logging.basicConfig(level=logging.INFO)

MODEL_TIMESTAMP_PATH = "/opt/airflow/data/model_last_trained.txt"

def should_retrain_model():
    if os.path.exists(MODEL_TIMESTAMP_PATH):
        with open(MODEL_TIMESTAMP_PATH, "r") as f:
            last_retrain_time = datetime.fromisoformat(f.read().strip())
        # Retrain if more than 1 day has passed since last retraining
        return datetime.now() - last_retrain_time > timedelta(days=1)
    return True  # If timestamp file doesn't exist, retrain

def retrain_all_models():
    if should_retrain_model():
        predictor = TrafficWeatherPredictor()
        predictor.train_models()
        with open(MODEL_TIMESTAMP_PATH, "w") as f:
            f.write(datetime.now().isoformat())
        logging.info("✅ Models retrained successfully.")
    else:
        logging.info("🚩 Models recently trained. Skipping retraining.")

if __name__ == "__main__":
    retrain_all_models()
