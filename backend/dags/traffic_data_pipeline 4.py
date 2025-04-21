from datetime import datetime, timedelta
from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.operators.dummy import DummyOperator
import os
import sys

# Add the parent directory to sys.path so Python can find the app directory
sys.path.insert(0, '/opt/airflow')

# Import service layer functions for traffic data
from app.services.lta_data import (
    get_estimated_travel_times,
    get_traffic_incidents,
    get_traffic_speed_bands,
    get_vms_messages,
    get_faulty_traffic_lights,
    get_planned_road_openings,
    get_approved_road_works,
    get_traffic_flow,
    get_bus_arrival,
    get_bus_services,
    get_bus_routes,
    get_train_service_alerts
)

# Import real-time train station crowd data functions
from app.services.lta_data import (
    get_station_crowd_density,
    get_station_crowd_forecast
)

# Import data.gov.sg functions
from app.services.data_gov import (
    get_peak_traffic_conditions,
    get_24hr_weather_forecast
)

# Import OpenWeatherMap functions
from app.services.owm_data import fetch_weather_data

# Import model training function
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

# Create DAGs with different schedules

# 15-minute interval DAG for real-time data
realtime_dag = DAG(
    'realtime_traffic_data',
    default_args=default_args,
    description='Collect real-time traffic and transit data every 15 minutes',
    schedule_interval='*/15 * * * *',  # every 15 mins
    start_date=datetime(2025, 3, 1),
    catchup=False,
    is_paused_upon_creation=False
)

# Hourly DAG for less frequent updates
hourly_dag = DAG(
    'hourly_traffic_data',
    default_args=default_args,
    description='Collect traffic data that updates hourly',
    schedule_interval='5 * * * *',  # 5 minutes past every hour
    start_date=datetime(2025, 3, 1),
    catchup=False,
    is_paused_upon_creation=False
)

# Daily DAG for routine daily updates
daily_dag = DAG(
    'daily_traffic_data',
    default_args=default_args,
    description='Collect daily traffic data and train models',
    schedule_interval='0 4 * * *',  # 4:00 AM every day
    start_date=datetime(2025, 3, 1),
    catchup=False,
    is_paused_upon_creation=False
)

# Weekly DAG for less frequent data
weekly_dag = DAG(
    'weekly_traffic_data',
    default_args=default_args,
    description='Collect weekly traffic flow and passenger data',
    schedule_interval='0 2 * * 1',  # 2:00 AM every Monday
    start_date=datetime(2025, 3, 1),
    catchup=False,
    is_paused_upon_creation=False
)

# ----- REALTIME DAG TASKS (15-minute intervals) -----

# Start task
start_realtime = DummyOperator(
    task_id='start_realtime_collection',
    dag=realtime_dag,
)

# Real-time traffic data tasks
fetch_travel_times_task = PythonOperator(
    task_id='fetch_estimated_travel_times',
    python_callable=get_estimated_travel_times,
    dag=realtime_dag,
)

fetch_incidents_task = PythonOperator(
    task_id='fetch_traffic_incidents',
    python_callable=get_traffic_incidents,
    dag=realtime_dag,
)

fetch_speed_bands_task = PythonOperator(
    task_id='fetch_traffic_speed_bands',
    python_callable=get_traffic_speed_bands,
    dag=realtime_dag,
)

fetch_vms_task = PythonOperator(
    task_id='fetch_vms_messages',
    python_callable=get_vms_messages,
    dag=realtime_dag,
)

# Real-time transit data tasks
fetch_bus_arrival_task = PythonOperator(
    task_id='fetch_bus_arrivals',
    python_callable=get_bus_arrival,
    op_kwargs={'bus_stop_code': None},  # Will fetch all stops
    dag=realtime_dag,
)

fetch_train_alerts_task = PythonOperator(
    task_id='fetch_train_service_alerts',
    python_callable=get_train_service_alerts,
    dag=realtime_dag,
)

fetch_station_crowd_task = PythonOperator(
    task_id='fetch_station_crowd_density',
    python_callable=get_station_crowd_density,
    dag=realtime_dag,
)

# Weather data
fetch_weather_task = PythonOperator(
    task_id='fetch_weather_data',
    python_callable=fetch_weather_data,
    dag=realtime_dag,
)

fetch_weather_forecast_task = PythonOperator(
    task_id='fetch_24hr_weather_forecast',
    python_callable=get_24hr_weather_forecast,
    dag=realtime_dag,
)

# End task
end_realtime = DummyOperator(
    task_id='end_realtime_collection',
    dag=realtime_dag,
)

# ----- HOURLY DAG TASKS -----

# Start task
start_hourly = DummyOperator(
    task_id='start_hourly_collection',
    dag=hourly_dag,
)

# Hourly data tasks
fetch_faulty_lights_task = PythonOperator(
    task_id='fetch_faulty_traffic_lights',
    python_callable=get_faulty_traffic_lights,
    dag=hourly_dag,
)

fetch_crowd_forecast_task = PythonOperator(
    task_id='fetch_station_crowd_forecast',
    python_callable=get_station_crowd_forecast,
    dag=hourly_dag,
)

# End task
end_hourly = DummyOperator(
    task_id='end_hourly_collection',
    dag=hourly_dag,
)

# ----- DAILY DAG TASKS -----

# Start task
start_daily = DummyOperator(
    task_id='start_daily_collection',
    dag=daily_dag,
)

# Daily data tasks
fetch_road_openings_task = PythonOperator(
    task_id='fetch_planned_road_openings',
    python_callable=get_planned_road_openings,
    dag=daily_dag,
)

fetch_road_works_task = PythonOperator(
    task_id='fetch_approved_road_works',
    python_callable=get_approved_road_works,
    dag=daily_dag,
)

fetch_peak_traffic_task = PythonOperator(
    task_id='fetch_peak_traffic_conditions',
    python_callable=get_peak_traffic_conditions,
    dag=daily_dag,
)

# Bus service static data
fetch_bus_services_task = PythonOperator(
    task_id='fetch_bus_services',
    python_callable=get_bus_services,
    dag=daily_dag,
)

fetch_bus_routes_task = PythonOperator(
    task_id='fetch_bus_routes',
    python_callable=get_bus_routes,
    dag=daily_dag,
)

# Retrain models task
retrain_models_task = PythonOperator(
    task_id='retrain_prediction_models',
    python_callable=retrain_all_models,
    dag=daily_dag,
)

# End task
end_daily = DummyOperator(
    task_id='end_daily_collection',
    dag=daily_dag,
)

# ----- WEEKLY DAG TASKS -----

# Start task
start_weekly = DummyOperator(
    task_id='start_weekly_collection',
    dag=weekly_dag,
)

# Weekly data tasks
fetch_traffic_flow_task = PythonOperator(
    task_id='fetch_traffic_flow',
    python_callable=get_traffic_flow,
    dag=weekly_dag,
)

# End task
end_weekly = DummyOperator(
    task_id='end_weekly_collection',
    dag=weekly_dag,
)

# ----- REALTIME DAG DEPENDENCIES -----
start_realtime >> [fetch_travel_times_task, fetch_incidents_task, fetch_weather_task]
fetch_travel_times_task >> fetch_speed_bands_task >> fetch_vms_task
fetch_incidents_task >> fetch_vms_task
fetch_weather_task >> fetch_weather_forecast_task
[fetch_vms_task, fetch_bus_arrival_task, fetch_train_alerts_task, fetch_station_crowd_task, fetch_weather_forecast_task] >> end_realtime

# ----- HOURLY DAG DEPENDENCIES -----
start_hourly >> [fetch_faulty_lights_task, fetch_crowd_forecast_task] >> end_hourly

# ----- DAILY DAG DEPENDENCIES -----
start_daily >> [fetch_road_openings_task, fetch_road_works_task, fetch_peak_traffic_task, fetch_bus_services_task]
fetch_bus_services_task >> fetch_bus_routes_task
[fetch_road_openings_task, fetch_road_works_task, fetch_peak_traffic_task, fetch_bus_routes_task] >> retrain_models_task >> end_daily

# ----- WEEKLY DAG DEPENDENCIES -----
start_weekly >> fetch_traffic_flow_task >> end_weekly