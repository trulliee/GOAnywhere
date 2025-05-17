from fastapi import APIRouter, HTTPException
import subprocess
import logging
import os

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/retrain", tags=["Model Management"])
def retrain_models():
    try:
        logger.info("Starting model retraining only...")

        # Set PYTHONPATH so that imports work correctly
        env = os.environ.copy()
        env["PYTHONPATH"] = os.getcwd()

        result = subprocess.run(
            ["python", "app/training/train_all.py"],
            check=True,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            env=env
        )

        logger.info("✅ Model retraining completed:\n" + result.stdout)

        return {
            "status": "success",
            "message": "Model retraining completed successfully.",
            "stdout": result.stdout,
            "stderr": result.stderr
        }

    except subprocess.CalledProcessError as e:
        logger.error("❌ Model retraining script failed.")
        logger.error("STDOUT:\n" + e.stdout)
        logger.error("STDERR:\n" + e.stderr)

        return {
            "status": "failed",
            "stdout": e.stdout,
            "stderr": e.stderr,
            "message": "Model retraining failed. See logs for details."
        }

    except Exception as e:
        logger.exception("❌ Unexpected error during retrain.")
        raise HTTPException(status_code=500, detail=str(e))
