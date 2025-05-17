# backend/dags/data_ingestion_pipeline.py

from datetime import datetime, timedelta
from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.operators.dummy import DummyOperator
import sys
import os

# Add project directory to sys.path
sys.path.insert(0, '/opt/airflow')

# Import functions for traffic, transit, weather, events scraping
from app.services.lta_data import (
    get_estimated_travel_times, get_traffic_incidents, get_traffic_speed_bands, 
    get_vms_messages, get_faulty_traffic_lights, get_planned_road_openings, 
    get_approved_road_works, get_traffic_flow, get_bus_arrival, get_bus_services, get_bus_routes, get_train_service_alerts,
    get_station_crowd_density, get_station_crowd_forecast
)
from app.services.owm_data import fetch_weather_data
from app.scrapers.events_scraper import scrape_visit_singapore_events

# DAG config
default_args = {
    'owner': 'airflow',
    'retries': 2,
    'retry_delay': timedelta(minutes=5),
}

dag = DAG(
    dag_id='data_ingestion_pipeline',
    default_args=default_args,
    description='Ingest traffic, transit, weather, and event data into Firestore',
    schedule_interval='@hourly',  # Can change later if you want
    start_date=datetime(2025, 4, 1),
    catchup=False,
    is_paused_upon_creation=False
)

start = DummyOperator(task_id='start', dag=dag)

# Define ingestion tasks
traffic_tasks = [
    PythonOperator(task_id='fetch_estimated_travel_times', python_callable=get_estimated_travel_times, dag=dag),
    PythonOperator(task_id='fetch_traffic_incidents', python_callable=get_traffic_incidents, dag=dag),
    PythonOperator(task_id='fetch_traffic_speed_bands', python_callable=get_traffic_speed_bands, dag=dag),
    PythonOperator(task_id='fetch_vms_messages', python_callable=get_vms_messages, dag=dag),
    PythonOperator(task_id='fetch_faulty_traffic_lights', python_callable=get_faulty_traffic_lights, dag=dag),
    PythonOperator(task_id='fetch_planned_road_openings', python_callable=get_planned_road_openings, dag=dag),
    PythonOperator(task_id='fetch_approved_road_works', python_callable=get_approved_road_works, dag=dag),
    PythonOperator(task_id='fetch_traffic_flow', python_callable=get_traffic_flow, dag=dag)
]

transit_tasks = [
    PythonOperator(task_id='fetch_bus_arrival', python_callable=get_bus_arrival, op_kwargs={'bus_stop_code': None}, dag=dag),
    PythonOperator(task_id='fetch_bus_services', python_callable=get_bus_services, dag=dag),
    PythonOperator(task_id='fetch_bus_routes', python_callable=get_bus_routes, dag=dag),
    PythonOperator(task_id='fetch_train_service_alerts', python_callable=get_train_service_alerts, dag=dag),
    PythonOperator(task_id='fetch_station_crowd_density', python_callable=get_station_crowd_density, dag=dag),
    PythonOperator(task_id='fetch_station_crowd_forecast', python_callable=get_station_crowd_forecast, dag=dag)
]

weather_tasks = [
    PythonOperator(task_id='fetch_weather_data', python_callable=fetch_weather_data, dag=dag),
]

events_task = PythonOperator(
    task_id='scrape_visit_singapore_events',
    python_callable=scrape_visit_singapore_events,
    do_xcom_push=False,
    dag=dag
)

end = DummyOperator(task_id='end', dag=dag)

# Define the flow
start >> traffic_tasks + transit_tasks + weather_tasks + [events_task] >> end