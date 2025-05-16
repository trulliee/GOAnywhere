from fastapi import APIRouter, HTTPException
import os
import logging
from glob import glob

router = APIRouter()
logger = logging.getLogger(__name__)

def get_latest_model_file(path: str):
    files = glob(os.path.join(path, "model_*.joblib"))
    if not files:
        raise FileNotFoundError(f"No versioned model found in {path}")
    files.sort(reverse=True)
    return files[0]

@router.post("/retrain")
def retrain_models():
    try:
        # Step 1: Run training script
        os.system("python app/training/train_all.py")

        # Step 2: Copy latest versioned models
        congestion_src = get_latest_model_file("models/trained/traffic_congestion")
        travel_time_src = get_latest_model_file("models/trained/travel_time")

        os.makedirs("model_serving/traffic_congestion", exist_ok=True)
        os.makedirs("model_serving/travel_time", exist_ok=True)

        os.system(f'copy "{congestion_src}" "model_serving\\traffic_congestion\\{os.path.basename(congestion_src)}"')
        os.system(f'copy "{congestion_src}" "model_serving\\traffic_congestion\\model.joblib"')

        os.system(f'copy "{travel_time_src}" "model_serving\\travel_time\\{os.path.basename(travel_time_src)}"')
        os.system(f'copy "{travel_time_src}" "model_serving\\travel_time\\model.joblib"')

        # Step 3: Deploy updated containers
        os.system("python scripts\\deploy_model.py")

        return {"status": "success", "message": "Retraining + deployment complete."}
    except Exception as e:
        logger.exception("Retrain endpoint failed.")
        raise HTTPException(status_code=500, detail=str(e))
