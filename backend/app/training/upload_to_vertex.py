# app/training/upload_to_vertex.py

import os
from datetime import datetime
from google.cloud import aiplatform
from google.cloud import storage

# === Configuration ===
PROJECT_ID = "goanywhere-c55c8"
REGION = "asia-southeast1"
BUCKET_NAME = "goanywhere-traffic-data-history"
MODEL_ARTIFACT_GCS_PREFIX = "trained_models"
DISPLAY_NAME_PREFIX = "goanywhere"
SERVING_IMAGE = "us-docker.pkg.dev/vertex-ai/prediction/sklearn-cpu.1-0:latest"

# === Vertex AI Initialization ===
aiplatform.init(project=PROJECT_ID, location=REGION, staging_bucket=BUCKET_NAME)

def upload_model(model_type: str):
    """
    Upload a local model (e.g., travel_time or traffic_congestion) to GCS and Vertex AI.
    """
    local_path = f"models/trained/{model_type}/model.joblib"
    if not os.path.exists(local_path):
        print(f"⚠️ Skipping upload: {local_path} does not exist.")
        return

    # Upload to GCS
    gcs_path = f"{MODEL_ARTIFACT_GCS_PREFIX}/{model_type}/model.joblib"
    client = storage.Client()
    bucket = client.bucket(BUCKET_NAME)
    blob = bucket.blob(gcs_path)
    blob.upload_from_filename(local_path)
    print(f"✅ Uploaded {model_type} model to gs://{BUCKET_NAME}/{gcs_path}")

    # Upload to Vertex AI
    display_name = f"{DISPLAY_NAME_PREFIX}-{model_type}-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    artifact_uri = f"gs://{BUCKET_NAME}/{MODEL_ARTIFACT_GCS_PREFIX}/{model_type}/"
    
    print(f"📤 Registering model to Vertex AI: {display_name}")
    model = aiplatform.Model.upload(
        display_name=display_name,
        artifact_uri=artifact_uri,
        serving_container_image_uri=SERVING_IMAGE,
    )
    model.wait()
    print(f"✅ Model registered: {display_name}")

def main():
    print("🚀 Uploading only latest confirmed models to Vertex AI...")
    upload_model("travel_time")
    upload_model("traffic_congestion")

if __name__ == "__main__":
    main()
