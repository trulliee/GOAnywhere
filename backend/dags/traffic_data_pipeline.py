from datetime import datetime, timedelta
from airflow import DAG
from airflow.operators.python import PythonOperator
import requests
import json
import os
import firebase_admin
from firebase_admin import credentials, firestore
import pandas as pd
import sys
from google.cloud import secretmanager

dir_path = os.path.dirname(os.path.realpath(__file__))
sys.path.append(os.path.join(os.path.dirname(dir_path), 'storage'))

# Access the LTA API key from Secret Manager
def get_secret(secret_name):
    client = secretmanager.SecretManagerServiceClient()
    response = client.access_secret_version(name=secret_name)
    return response.payload.data.decode("UTF-8")

# Initialize Firebase
def init_firebase():
    if not firebase_admin._apps:
        cred_path = "/opt/airflow/backend/service-account-key.json"  # Your existing Firebase key
        if os.path.exists(cred_path):
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
        else:
            raise FileNotFoundError(f"Firebase credentials not found at {cred_path}")
    return firestore.client()

# LTA DataMall API Functions
def fetch_estimated_travel_times():
    """Fetch estimated travel times from LTA DataMall API"""
    url = "http://datamall2.mytransport.sg/ltaodataservice/EstTravelTimes"
    # Get API key from Secret Manager
    api_key = get_secret("projects/541900038032/secrets/LTA_API_account_key/versions/latest")
    headers = {
        'AccountKey': api_key,
        'accept': 'application/json'
    }
    
    response = requests.get(url, headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        
        # Initialize Firebase
        db = init_firebase()
        
        # Store data in Firestore
        for item in data.get('value', []):
            item['Timestamp'] = datetime.now()
            db.collection('estimated_travel_times').add(item)
            
        # Also save to CSV for backup
        df = pd.DataFrame(data.get('value', []))
        if not df.empty:
            df['Timestamp'] = datetime.now()
            filename = f"/opt/airflow/data/uploads/estimated_travel_times_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
            df.to_csv(filename, index=False)
            
        return f"Successfully fetched and stored {len(data.get('value', []))} travel time records"
    else:
        return f"Error fetching data: {response.status_code}"

def fetch_traffic_incidents():
    """Fetch traffic incidents from LTA DataMall API"""
    url = "http://datamall2.mytransport.sg/ltaodataservice/TrafficIncidents"
    # Get API key from Secret Manager
    api_key = get_secret("projects/541900038032/secrets/LTA_API_account_key/versions/latest")
    headers = {
        'AccountKey': api_key,
        'accept': 'application/json'
    }
    
    response = requests.get(url, headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        
        # Initialize Firebase
        db = init_firebase()
        
        # Store data in Firestore
        for item in data.get('value', []):
            item['Timestamp'] = datetime.now()
            db.collection('traffic_incidents').add(item)
            
        # Also save to CSV for backup
        df = pd.DataFrame(data.get('value', []))
        if not df.empty:
            df['Timestamp'] = datetime.now()
            filename = f"/opt/airflow/data/uploads/traffic_incidents_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
            df.to_csv(filename, index=False)
            
        return f"Successfully fetched and stored {len(data.get('value', []))} traffic incidents"
    else:
        return f"Error fetching data: {response.status_code}"

def fetch_traffic_speed_bands():
    """Fetch traffic speed bands from LTA DataMall API"""
    url = "http://datamall2.mytransport.sg/ltaodataservice/v3/TrafficSpeedBands"
    # Get API key from Secret Manager
    api_key = get_secret("projects/541900038032/secrets/LTA_API_account_key/versions/latest")
    headers = {
        'AccountKey': api_key,
        'accept': 'application/json'
    }
    
    response = requests.get(url, headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        
        # Initialize Firebase
        db = init_firebase()
        
        # Store data in Firestore
        for item in data.get('value', []):
            item['Timestamp'] = datetime.now()
            db.collection('traffic_speed_bands').add(item)
            
        # Also save to CSV for backup
        df = pd.DataFrame(data.get('value', []))
        if not df.empty:
            df['Timestamp'] = datetime.now()
            filename = f"/opt/airflow/data/uploads/traffic_speed_bands_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
            df.to_csv(filename, index=False)
            
        return f"Successfully fetched and stored {len(data.get('value', []))} traffic speed records"
    else:
        return f"Error fetching data: {response.status_code}"
        
def fetch_vms_messages():
    """Fetch VMS messages from LTA DataMall API"""
    url = "http://datamall2.mytransport.sg/ltaodataservice/VMS"
    # Get API key from Secret Manager
    api_key = get_secret("projects/541900038032/secrets/LTA_API_account_key/versions/latest")
    headers = {
        'AccountKey': api_key,
        'accept': 'application/json'
    }
    
    response = requests.get(url, headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        
        # Initialize Firebase
        db = init_firebase()
        
        # Store data in Firestore
        for item in data.get('value', []):
            item['Timestamp'] = datetime.now()
            db.collection('vms_messages').add(item)
            
        # Also save to CSV for backup
        df = pd.DataFrame(data.get('value', []))
        if not df.empty:
            df['Timestamp'] = datetime.now()
            filename = f"/opt/airflow/data/uploads/vms_messages_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
            df.to_csv(filename, index=False)
            
        return f"Successfully fetched and stored {len(data.get('value', []))} VMS messages"
    else:
        return f"Error fetching data: {response.status_code}"

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

# Create tasks
fetch_travel_times_task = PythonOperator(
    task_id='fetch_estimated_travel_times',
    python_callable=fetch_estimated_travel_times,
    dag=dag,
)

fetch_incidents_task = PythonOperator(
    task_id='fetch_traffic_incidents',
    python_callable=fetch_traffic_incidents,
    dag=dag,
)

fetch_speed_bands_task = PythonOperator(
    task_id='fetch_traffic_speed_bands',
    python_callable=fetch_traffic_speed_bands,
    dag=dag,
)

fetch_vms_task = PythonOperator(
    task_id='fetch_vms_messages',
    python_callable=fetch_vms_messages,
    dag=dag,
)

# Set task dependencies - run tasks in sequence to avoid API rate limiting
fetch_travel_times_task >> fetch_incidents_task >> fetch_speed_bands_task >> fetch_vms_task
