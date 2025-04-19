# backend/dags/train_and_upload_models_pipeline.py

from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.operators.dummy import DummyOperator
from datetime import datetime, timedelta
import os
import sys

# Set up import paths
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app")))

from app.training.train_all import main as train_all_models
from storage.gcs_utils import upload_to_gcs, initialize_storage_client

# === Configuration ===
PROJECT_ID = "goanywhere-c55c8"
BUCKET_NAME = "goanywhere-traffic-data-history"
LOCAL_MODEL_DIR = "models/trained"

# === DAG Definition ===
default_args = {
    'owner': 'airflow',
    'depends_on_past': False,
    'email_on_failure': False,
    'email_on_retry': False,
    'retries': 1,
    'retry_delay': timedelta(minutes=5),
}

dag = DAG(
    'train_and_upload_models_pipeline',
    default_args=default_args,
    description='Retrain and upload traffic prediction models',
    schedule_interval='@weekly',  # Adjust if needed
    start_date=datetime(2025, 4, 1),
    catchup=False,
    is_paused_upon_creation=False
)

# === Task: Train models ===
def train_models():
    print("Starting model training...")
    train_all_models()
    print("Model training completed.")

train_task = PythonOperator(
    task_id='train_models',
    python_callable=train_models,
    dag=dag
)

# === Task: Upload trained models ===
def upload_models():
    print("Initializing GCS storage client...")
    initialize_storage_client()

    for root, _, files in os.walk(LOCAL_MODEL_DIR):
        for file in files:
            if file.endswith('.joblib'):
                local_path = os.path.join(root, file)
                rel_path = os.path.relpath(local_path, LOCAL_MODEL_DIR)
                gcs_path = f"trained_models/{rel_path}"
                upload_to_gcs(BUCKET_NAME, local_path, gcs_path)
                print(f"✅ Uploaded {local_path} to gs://{BUCKET_NAME}/{gcs_path}")

upload_task = PythonOperator(
    task_id='upload_trained_models',
    python_callable=upload_models,
    dag=dag
)

# === Pipeline structure ===
start = DummyOperator(task_id='start', dag=dag)
end = DummyOperator(task_id='end', dag=dag)

start >> train_task >> upload_task >> end