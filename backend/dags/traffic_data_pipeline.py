from datetime import datetime, timedelta
from airflow import DAG
from airflow.operators.python import PythonOperator
import os
import sys

# Import service layer functions
from app.services.lta_data import get_estimated_travel_times, get_traffic_incidents, get_traffic_speed_bands, get_vms_messages
from app.services.data_gov import get_peak_traffic_conditions, get_24hr_weather_forecast
from app.services.owm_data import get_weather_data

# Define default arguments for the DAG
default_args = {
    'owner': 'airflow',
    'depends_on_past': False,
    'email_on_failure': False,
    'email_on_retry': False,
    'retries': 1,
    'retry_delay': timedelta(minutes=5),
}

# Create the DAG
dag = DAG(
    'traffic_data_collection',
    default_args=default_args,
    description='Collect traffic data from various sources',
    schedule_interval='*/15 * * * *',  # Run every 15 minutes
    start_date=datetime(2025, 3, 1),
    catchup=False,
    is_paused_upon_creation=False
)

# Create tasks for LTA DataMall API
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

# Create tasks for Data.gov.sg API
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

# Create task for OpenWeatherMap API
fetch_weather_data_task = PythonOperator(
    task_id='fetch_weather_data',
    python_callable=get_weather_data,
    dag=dag,
)

# Set task dependencies - run tasks in sequence to avoid API rate limiting
# First fetch all LTA data
fetch_travel_times_task >> fetch_incidents_task >> fetch_speed_bands_task >> fetch_vms_task
# Then fetch data from other sources
fetch_vms_task >> fetch_peak_traffic_task >> fetch_weather_forecast_task >> fetch_weather_data_task