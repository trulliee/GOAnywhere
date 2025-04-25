# backend/dags/train_and_upload_models_pipeline.py

from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.operators.dummy import DummyOperator
from datetime import datetime, timedelta
import os
import sys

# Set up import paths
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app", "training")))

# === Import model training and upload logic ===
from app.training.train_all import main as train_all_models
from app.training.upload_to_vertex import main as upload_to_vertex_main

# === DAG Configuration ===
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
    description='Retrain and upload traffic prediction models to Vertex AI',
    schedule_interval='@weekly',  # Adjust schedule as needed
    start_date=datetime(2025, 4, 1),
    catchup=False,
    is_paused_upon_creation=False
)

# === Task: Train models ===
def train_models():
    print("🚀 Starting model training...")
    train_all_models()
    print("✅ Model training completed.")

train_task = PythonOperator(
    task_id='train_models',
    python_callable=train_models,
    dag=dag
)

# === Task: Upload trained models to Vertex AI ===
def upload_models():
    print("📤 Uploading latest confirmed models to Vertex AI...")
    upload_to_vertex_main()
    print("✅ Models successfully uploaded to Vertex AI.")

upload_task = PythonOperator(
    task_id='upload_models_to_vertex_ai',
    python_callable=upload_models,
    dag=dag
)

# === DAG Flow ===
start = DummyOperator(task_id='start', dag=dag)
end = DummyOperator(task_id='end', dag=dag)

start >> train_task >> upload_task >> end
