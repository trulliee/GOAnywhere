import os
import sys
from datetime import datetime
from google.cloud import aiplatform
from google.cloud import storage

# Add backend/ to the Python path to allow importing storage/
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))
from storage import gcs_utils

# === Configuration ===
PROJECT_ID = "goanywhere-c55c8"
REGION = "asia-east1"  # Important: NOT asia-southeast1
BUCKET_NAME = "goanywhere-traffic-data-history"
MODEL_ARTIFACT_GCS_PREFIX = "trained_models"
DISPLAY_NAME_PREFIX = "goanywhere"

# === Vertex AI Initialization ===
aiplatform.init(
    project=PROJECT_ID,
    location=REGION,
    staging_bucket=BUCKET_NAME
)

def list_gcs_model_paths():
    """List all valid .joblib model paths under the trained_models/ folder in GCS."""
    client = storage.Client()
    bucket = client.bucket(BUCKET_NAME)
    blobs = bucket.list_blobs(prefix=MODEL_ARTIFACT_GCS_PREFIX)

    model_files = []
    for blob in blobs:
        if blob.name.endswith(".joblib"):
            if "trained/trained" not in blob.name:  # Avoid bad nested paths
                model_files.append(blob.name)
    return model_files

def upload_local_models_to_gcs():
    """Upload locally trained models to GCS, skipping bad folders."""
    print("Uploading local models to GCS...")
    client = storage.Client()
    bucket = client.bucket(BUCKET_NAME)
    local_model_dir = "models/trained"

    for root, dirs, files in os.walk(local_model_dir):
        for file in files:
            if file.endswith(".joblib"):
                rel_path = os.path.relpath(os.path.join(root, file), "models")
                gcs_path = f"{MODEL_ARTIFACT_GCS_PREFIX}/{rel_path.replace(os.sep, '/')}"
                blob = bucket.blob(gcs_path)
                blob.upload_from_filename(os.path.join(root, file))
                print(f"✅ Uploaded {file} to gs://{BUCKET_NAME}/{gcs_path}")

def upload_model_to_vertex(display_name: str, model_gcs_path: str):
    """Upload a model from GCS to Vertex AI Model Registry."""
    print("Creating Model")
    model = aiplatform.Model.upload(
        display_name=display_name,
        artifact_uri=f"gs://{BUCKET_NAME}/{model_gcs_path}",
        serving_container_image_uri="us-docker.pkg.dev/vertex-ai/prediction/sklearn-cpu.1-0:latest",
    )
    model.wait()
    print(f"✅ Uploaded and registered model: {display_name}")

def main():
    upload_local_models_to_gcs()  # Upload all .joblib models to GCS
    print("Listing model folders from GCS...")
    model_files = list_gcs_model_paths()

    if not model_files:
        print("⚠️ No valid model files found in GCS.")
        return

    for model_file in model_files:
        parts = model_file.replace(".joblib", "").split("/")
        if len(parts) < 3:
            print(f"⚠️ Skipping invalid path: {model_file}")
            continue
        model_name = parts[-1]
        model_type = parts[-2]

        display_name = f"{DISPLAY_NAME_PREFIX}-{model_type}-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        try:
            upload_model_to_vertex(display_name, model_file)
        except Exception as e:
            print(f"❌ Failed to upload {model_file}: {e}")

if __name__ == "__main__":
    main()
