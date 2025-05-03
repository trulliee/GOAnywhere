# backend/dags/events_scraper_dag.py
from datetime import datetime, timedelta
from airflow import DAG
from airflow.operators.python import PythonOperator
import sys

# Add the required paths to Python's sys.path
sys.path.insert(0, '/opt/airflow')

# Import the scraper function
from app.scrapers.events_scraper import scrape_visit_singapore_events

default_args = {
    'owner': 'airflow',
    'depends_on_past': False,
    'email_on_failure': False,
    'email_on_retry': False,
    'retries': 1,
    'retry_delay': timedelta(minutes=5),
}

dag = DAG(
    'events_data_collection',
    default_args=default_args,
    description='Scrape events data from Visit Singapore website',
    schedule_interval='0 1 * * *',  # Run daily at 1 AM
    start_date=datetime(2025, 3, 1),
    catchup=False,
    is_paused_upon_creation=False
)

# Task to scrape events
scrape_events_task = PythonOperator(
    task_id='scrape_visit_singapore_events',
    python_callable=scrape_visit_singapore_events,
    op_kwargs={'max_pages': 5},
    dag=dag,
)