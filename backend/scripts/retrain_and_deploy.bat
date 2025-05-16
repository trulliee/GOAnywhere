@echo off
echo 🔁 Training models...
python app\training\train_all.py

echo 📦 Copying new model.joblib files...
copy models\trained\traffic_congestion\model.joblib model_serving\traffic_congestion\model.joblib
copy models\trained\travel_time\model.joblib model_serving\travel_time\model.joblib

echo 🚀 Deploying updated containers to Cloud Run...
python scripts\deploy_model.py

echo ✅ Retrain and deployment complete.
pause
