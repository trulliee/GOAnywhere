from datetime import datetime, timedelta
from airflow import DAG
from airflow.operators.python import PythonOperator
import os
import sys

# Add the parent directory to sys.path so Python can find the scripts directory
sys.path.insert(0, '/opt/airflow')
# Or use the specific path to the scripts directory
# sys.path.insert(0, '/opt/airflow/backend/scripts')

# Import service layer functions
from app.services.lta_data import get_estimated_travel_times, get_traffic_incidents, get_traffic_speed_bands, get_vms_messages
from app.services.data_gov import get_peak_traffic_conditions, get_24hr_weather_forecast
from app.services.owm_data import fetch_weather_data

# Change the import path to match your directory structure
from backend.scripts.train_models import retrain_all_models

# Default arguments
default_args = {
    'owner': 'airflow',
    'depends_on_past': False,
    'email_on_failure': False,
    'email_on_retry': False,
    'retries': 1,
    'retry_delay': timedelta(minutes=5),
}

# DAG definition
dag = DAG(
    'traffic_data_collection',
    default_args=default_args,
    description='Collect traffic data and retrain prediction models',
    schedule_interval='*/15 * * * *',  # every 15 mins
    start_date=datetime(2025, 3, 1),
    catchup=False,
    is_paused_upon_creation=False
)

# Data fetch tasks
fetch_travel_times_task = PythonOperator(
    task_id='fetch_estimated_travel_times',
    python_callable=get_estimated_travel_times,
    dag=dag,
)

fetch_incidents_task = PythonOperator(
    task_id='fetch_traffic_incidents',
    python_callable=get_traffic_incidents,
    dag=dag,
)

fetch_speed_bands_task = PythonOperator(
    task_id='fetch_traffic_speed_bands',
    python_callable=get_traffic_speed_bands,
    dag=dag,
)

fetch_vms_task = PythonOperator(
    task_id='fetch_vms_messages',
    python_callable=get_vms_messages,
    dag=dag,
)

fetch_peak_traffic_task = PythonOperator(
    task_id='fetch_peak_traffic_conditions',
    python_callable=get_peak_traffic_conditions,
    dag=dag,
)

fetch_weather_forecast_task = PythonOperator(
    task_id='fetch_24hr_weather_forecast',
    python_callable=get_24hr_weather_forecast,
    dag=dag,
)

fetch_weather_data_task = PythonOperator(
    task_id='fetch_weather_data',
    python_callable=fetch_weather_data,
    dag=dag,
)

# Retrain models task
retrain_models_task = PythonOperator(
    task_id='retrain_prediction_models',
    python_callable=retrain_all_models,
    dag=dag,
)

# Task Dependencies
fetch_travel_times_task >> fetch_incidents_task >> fetch_speed_bands_task >> fetch_vms_task
fetch_vms_task >> fetch_peak_traffic_task >> fetch_weather_forecast_task >> fetch_weather_data_task
[fetch_weather_data_task, fetch_weather_forecast_task, fetch_peak_traffic_task] >> retrain_models_task