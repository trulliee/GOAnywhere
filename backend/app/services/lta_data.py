from google.cloud import secretmanager
import requests
import time
from app.database.firestore_utils import (
    store_traffic_data,
    store_estimated_travel_times,
    store_traffic_speed_bands,
    store_vms_data,
    store_bus_arrival_data,
    store_bus_routes,
    store_bus_services_info,
    store_bus_passenger_volume,
    store_bus_od_passenger_volume,
    store_train_od_passenger_volume,
    store_train_passenger_volume,
    store_train_service_alerts,
    store_faulty_traffic_lights,
    store_planned_road_openings,
    store_approved_road_works,
    store_station_crowd_density,
    store_station_crowd_forecast,
    store_traffic_flow  # Add this new import
)
import os
import zipfile
import tempfile
import pandas as pd
from datetime import datetime, timedelta

# Create Secret Manager client
client = secretmanager.SecretManagerServiceClient()

# Access the LTA API key from Secret Manager
def get_secret(secret_name):
    response = client.access_secret_version(name=secret_name)
    return response.payload.data.decode("UTF-8")

# Fetch LTA API key from Secret Manager
LTA_API_KEY = get_secret("projects/541900038032/secrets/LTA_API_account_key/versions/latest")

# Define API endpoints
BUS_ARRIVAL_URL = "https://datamall2.mytransport.sg/ltaodataservice/v3/BusArrival"
BUS_STOPS_URL = "https://datamall2.mytransport.sg/ltaodataservice/BusStops"
BUS_ROUTES_URL = "https://datamall2.mytransport.sg/ltaodataservice/BusRoutes"
BUS_SERVICES_URL = "https://datamall2.mytransport.sg/ltaodataservice/BusServices"
BUS_PASSENGER_VOLUME_URL = "https://datamall2.mytransport.sg/ltaodataservice/PV/Bus"
BUS_OD_PASSENGER_VOLUME_URL = "https://datamall2.mytransport.sg/ltaodataservice/PV/ODBus"
TRAIN_OD_PASSENGER_VOLUME_URL = "https://datamall2.mytransport.sg/ltaodataservice/PV/ODTrain"
TRAIN_PASSENGER_VOLUME_URL = "https://datamall2.mytransport.sg/ltaodataservice/PV/Train"
TRAIN_SERVICE_ALERTS_URL = "https://datamall2.mytransport.sg/ltaodataservice/TrainServiceAlerts"
ESTIMATED_TRAVEL_TIMES_URL = "https://datamall2.mytransport.sg/ltaodataservice/EstTravelTimes"
FAULTY_TRAFFIC_LIGHTS_URL = "https://datamall2.mytransport.sg/ltaodataservice/FaultyTrafficLights"
ROAD_OPENINGS_URL = "https://datamall2.mytransport.sg/ltaodataservice/RoadOpenings"
ROAD_WORKS_URL = "https://datamall2.mytransport.sg/ltaodataservice/RoadWorks"
TRAFFIC_INCIDENTS_URL = "https://datamall2.mytransport.sg/ltaodataservice/TrafficIncidents"
TRAFFIC_SPEED_BANDS_URL = "https://datamall2.mytransport.sg/ltaodataservice/v3/TrafficSpeedBands"
VMS_URL = "https://datamall2.mytransport.sg/ltaodataservice/VMS"
STATION_CROWD_DENSITY_URL = "https://datamall2.mytransport.sg/ltaodataservice/PCDRealTime"
STATION_CROWD_FORECAST_URL = "https://datamall2.mytransport.sg/ltaodataservice/PCDForecast"
TRAFFIC_FLOW_URL = "https://datamall2.mytransport.sg/ltaodataservice/TrafficFlow"

def get_bus_arrival(bus_stop_code=None):
    """
    Fetches real-time Bus Arrival information from LTA DataMall API.
    If no bus_stop_code is provided, fetches data for all bus stops.
    
    Args:
        bus_stop_code (str, optional): The bus stop code to query. Defaults to None.
    
    Returns:
        None: Data is directly stored in Firebase
    """
    headers = {'AccountKey': LTA_API_KEY}
    
    if bus_stop_code:
        # Query for a specific bus stop
        params = {'BusStopCode': bus_stop_code}
        response = requests.get(BUS_ARRIVAL_URL, headers=headers, params=params)
        
        if response.status_code == 200:
            data = response.json()
            print(f"Raw API Response (Bus Arrival for stop {bus_stop_code}):", data)  # Debugging
            
            # Extract bus services data
            bus_stop_code = data.get('BusStopCode', '')
            services = data.get('Services', [])
            
            if isinstance(services, list):
                # Store the bus arrival data in Firebase
                store_bus_arrival_data(bus_stop_code, services)
                print(f"Bus arrival data for stop {bus_stop_code} stored successfully!")
            else:
                print("Error: Bus services data is not a list!")
        else:
            print(f"Failed to fetch bus arrival data for stop {bus_stop_code}: {response.status_code} - {response.text}")
    else:
        # Query all bus stops (requires a list of bus stop codes)
        print("Fetching all bus stops...")
        # This function needs to be implemented or obtained from another source
        bus_stops = get_all_bus_stops()
        
        for stop_code in bus_stops:
            # Process each bus stop with a delay to avoid rate limiting
            print(f"Processing bus stop {stop_code}...")
            get_bus_arrival(stop_code)
            time.sleep(1)  # Be nice to the API

def get_all_bus_stops():
    """
    Fetches all bus stops from LTA DataMall API.
    
    Returns:
        list: List of bus stop codes
    """
    headers = {'AccountKey': LTA_API_KEY}
    
    bus_stop_codes = []
    skip = 0
    
    # LTA API returns data in batches of 500, so we need to paginate
    while True:
        response = requests.get(f"{BUS_STOPS_URL}?$skip={skip}", headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            value = data.get('value', [])
            
            if not value:
                break
                
            # Extract bus stop codes
            for bus_stop in value:
                bus_stop_codes.append(bus_stop.get('BusStopCode', ''))
                
            skip += 500
            
            # If we got less than 500 results, we've reached the end
            if len(value) < 500:
                break
        else:
            print(f"Failed to fetch bus stops: {response.status_code} - {response.text}")
            break
            
    print(f"Found {len(bus_stop_codes)} bus stops.")
    return bus_stop_codes

def get_bus_services():
    """
    Fetches detailed bus service information from LTA DataMall API.
    This includes service details like frequency, first/last stops, etc.
    
    Returns:
        None: Data is directly stored in Firebase
    """
    headers = {'AccountKey': LTA_API_KEY}
    
    services_data = []
    skip = 0
    
    # LTA API returns data in batches of 500, so we need to paginate
    while True:
        response = requests.get(f"{BUS_SERVICES_URL}?$skip={skip}", headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            value = data.get('value', [])
            
            if not value:
                break
                
            # Extend our services data with this batch
            services_data.extend(value)
            print(f"Fetched {len(value)} bus services (offset: {skip})")
                
            skip += 500
            
            # If we got less than 500 results, we've reached the end
            if len(value) < 500:
                break
        else:
            print(f"Failed to fetch bus services: {response.status_code} - {response.text}")
            break
    
    if services_data:
        print(f"Total bus services fetched: {len(services_data)}")
        # Store the services data in Firebase
        store_bus_services_info(services_data)
        print("Bus services data stored successfully!")
    else:
        print("No bus services data fetched.")

def get_bus_routes():
    """
    Fetches detailed bus route information from LTA DataMall API.
    This includes all bus stops along each route and first/last bus timings.
    
    Returns:
        None: Data is directly stored in Firebase
    """
    headers = {'AccountKey': LTA_API_KEY}
    response = requests.get(BUS_ROUTES_URL, headers=headers)
    
    routes_data = []
    skip = 0
    
    # LTA API returns data in batches of 500, so we need to paginate
    while True:
        response = requests.get(f"{BUS_ROUTES_URL}?$skip={skip}", headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            value = data.get('value', [])
            
            if not value:
                break
                
            # Extend our routes data with this batch
            routes_data.extend(value)
            print(f"Fetched {len(value)} bus routes (offset: {skip})")
                
            skip += 500
            
            # If we got less than 500 results, we've reached the end
            if len(value) < 500:
                break
        else:
            print(f"Failed to fetch bus routes: {response.status_code} - {response.text}")
            break
    
    if routes_data:
        print(f"Total bus routes fetched: {len(routes_data)}")
        # Store the routes data in Firebase
        store_bus_routes(routes_data)
        print("Bus routes data stored successfully!")
    else:
        print("No bus routes data fetched.")

def get_bus_passenger_volume(date=None):
    """
    Fetches bus passenger volume data from LTA DataMall API.
    
    Args:
        date (str, optional): Date in format YYYYMM. Defaults to previous month.
    
    Returns:
        None: Data is directly stored in Firebase
    """
    headers = {'AccountKey': LTA_API_KEY}
    
    # If no date provided, use previous month
    if not date:
        today = datetime.now()
        first_day_of_month = today.replace(day=1)
        last_month = first_day_of_month - timedelta(days=1)
        date = last_month.strftime('%Y%m')
    
    # Make API request
    params = {'Date': date}
    response = requests.get(BUS_PASSENGER_VOLUME_URL, headers=headers, params=params)
    
    if response.status_code == 200:
        data = response.json()
        download_link = data.get('Link', '')
        
        if download_link:
            print(f"Found download link for bus passenger volume data: {download_link}")
            
            try:
                # Download the ZIP file
                zip_response = requests.get(download_link)
                
                if zip_response.status_code == 200:
                    # Create a temporary directory for extraction
                    with tempfile.TemporaryDirectory() as temp_dir:
                        zip_path = os.path.join(temp_dir, f"bus_passenger_volume_{date}.zip")
                        
                        # Save ZIP file
                        with open(zip_path, 'wb') as f:
                            f.write(zip_response.content)
                        
                        # Extract ZIP file
                        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                            zip_ref.extractall(temp_dir)
                        
                        # Process extracted files
                        for filename in os.listdir(temp_dir):
                            if filename.endswith('.csv'):
                                csv_path = os.path.join(temp_dir, filename)
                                print(f"Processing CSV file: {filename}")
                                
                                # Read CSV file
                                try:
                                    df = pd.read_csv(csv_path)
                                    
                                    # Convert to list of dictionaries for Firestore
                                    records = df.to_dict('records')
                                    
                                    # Store in Firestore
                                    store_bus_passenger_volume(records, date, filename)
                                    
                                except Exception as e:
                                    print(f"Error processing CSV file {filename}: {e}")
                else:
                    print(f"Failed to download ZIP file: {zip_response.status_code}")
            except Exception as e:
                print(f"Error processing download link: {e}")
        else:
            print("No download link found in the response")
    else:
        print(f"Failed to fetch bus passenger volume data: {response.status_code} - {response.text}")

def get_bus_od_passenger_volume(date=None):
    """
    Fetches bus origin-destination passenger volume data from LTA DataMall API.
    
    Args:
        date (str, optional): Date in format YYYYMM. Defaults to previous month.
    
    Returns:
        None: Data is directly stored in Firebase
    """
    headers = {'AccountKey': LTA_API_KEY}
    
    # If no date provided, use previous month
    if not date:
        today = datetime.now()
        first_day_of_month = today.replace(day=1)
        last_month = first_day_of_month - timedelta(days=1)
        date = last_month.strftime('%Y%m')
    
    # Make API request
    params = {'Date': date}
    response = requests.get(BUS_OD_PASSENGER_VOLUME_URL, headers=headers, params=params)
    
    if response.status_code == 200:
        data = response.json()
        download_link = data.get('Link', '')
        
        if download_link:
            print(f"Found download link for bus OD passenger volume data: {download_link}")
            
            try:
                # Download the ZIP file
                zip_response = requests.get(download_link)
                
                if zip_response.status_code == 200:
                    # Create a temporary directory for extraction
                    with tempfile.TemporaryDirectory() as temp_dir:
                        zip_path = os.path.join(temp_dir, f"bus_od_passenger_volume_{date}.zip")
                        
                        # Save ZIP file
                        with open(zip_path, 'wb') as f:
                            f.write(zip_response.content)
                        
                        # Extract ZIP file
                        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                            zip_ref.extractall(temp_dir)
                        
                        # Process extracted files
                        for filename in os.listdir(temp_dir):
                            if filename.endswith('.csv'):
                                csv_path = os.path.join(temp_dir, filename)
                                print(f"Processing CSV file: {filename}")
                                
                                # Read CSV file
                                try:
                                    # Read in chunks due to potentially large file size
                                    chunk_size = 10000  # Adjust based on your memory constraints
                                    
                                    # Process each chunk
                                    for chunk_index, chunk in enumerate(pd.read_csv(csv_path, chunksize=chunk_size)):
                                        print(f"Processing chunk {chunk_index + 1}")
                                        
                                        # Convert to list of dictionaries for Firestore
                                        records = chunk.to_dict('records')
                                        
                                        # Store in Firestore
                                        store_bus_od_passenger_volume(records, date, filename, chunk_index)
                                    
                                except Exception as e:
                                    print(f"Error processing CSV file {filename}: {e}")
                else:
                    print(f"Failed to download ZIP file: {zip_response.status_code}")
            except Exception as e:
                print(f"Error processing download link: {e}")
        else:
            print("No download link found in the response")
    else:
        print(f"Failed to fetch bus OD passenger volume data: {response.status_code} - {response.text}")

def get_train_od_passenger_volume(date=None):
    """
    Fetches train origin-destination passenger volume data from LTA DataMall API.
    
    Args:
        date (str, optional): Date in format YYYYMM. Defaults to previous month.
    
    Returns:
        None: Data is directly stored in Firebase
    """
    headers = {'AccountKey': LTA_API_KEY}
    
    # If no date provided, use previous month
    if not date:
        today = datetime.now()
        first_day_of_month = today.replace(day=1)
        last_month = first_day_of_month - timedelta(days=1)
        date = last_month.strftime('%Y%m')
    
    # Make API request
    params = {'Date': date}
    response = requests.get(TRAIN_OD_PASSENGER_VOLUME_URL, headers=headers, params=params)
    
    if response.status_code == 200:
        data = response.json()
        download_link = data.get('Link', '')
        
        if download_link:
            print(f"Found download link for train OD passenger volume data: {download_link}")
            
            try:
                # Download the ZIP file
                zip_response = requests.get(download_link)
                
                if zip_response.status_code == 200:
                    # Create a temporary directory for extraction
                    with tempfile.TemporaryDirectory() as temp_dir:
                        zip_path = os.path.join(temp_dir, f"train_od_passenger_volume_{date}.zip")
                        
                        # Save ZIP file
                        with open(zip_path, 'wb') as f:
                            f.write(zip_response.content)
                        
                        # Extract ZIP file
                        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                            zip_ref.extractall(temp_dir)
                        
                        # Process extracted files
                        for filename in os.listdir(temp_dir):
                            if filename.endswith('.csv'):
                                csv_path = os.path.join(temp_dir, filename)
                                print(f"Processing CSV file: {filename}")
                                
                                # Read CSV file
                                try:
                                    # Read in chunks due to potentially large file size
                                    chunk_size = 10000  # Adjust based on your memory constraints
                                    
                                    # Process each chunk
                                    for chunk_index, chunk in enumerate(pd.read_csv(csv_path, chunksize=chunk_size)):
                                        print(f"Processing chunk {chunk_index + 1}")
                                        
                                        # Convert to list of dictionaries for Firestore
                                        records = chunk.to_dict('records')
                                        
                                        # Store in Firestore
                                        store_train_od_passenger_volume(records, date, filename, chunk_index)
                                    
                                except Exception as e:
                                    print(f"Error processing CSV file {filename}: {e}")
                else:
                    print(f"Failed to download ZIP file: {zip_response.status_code}")
            except Exception as e:
                print(f"Error processing download link: {e}")
        else:
            print("No download link found in the response")
    else:
        print(f"Failed to fetch train OD passenger volume data: {response.status_code} - {response.text}")

def get_train_passenger_volume(date=None):
    """
    Fetches train station passenger volume data from LTA DataMall API.
    
    Args:
        date (str, optional): Date in format YYYYMM. Defaults to previous month.
    
    Returns:
        None: Data is directly stored in Firebase
    """
    headers = {'AccountKey': LTA_API_KEY}
    
    # If no date provided, use previous month
    if not date:
        today = datetime.now()
        first_day_of_month = today.replace(day=1)
        last_month = first_day_of_month - timedelta(days=1)
        date = last_month.strftime('%Y%m')
    
    # Make API request
    params = {'Date': date}
    response = requests.get(TRAIN_PASSENGER_VOLUME_URL, headers=headers, params=params)
    
    if response.status_code == 200:
        data = response.json()
        download_link = data.get('Link', '')
        
        if download_link:
            print(f"Found download link for train passenger volume data: {download_link}")
            
            try:
                # Download the ZIP file
                zip_response = requests.get(download_link)
                
                if zip_response.status_code == 200:
                    # Create a temporary directory for extraction
                    with tempfile.TemporaryDirectory() as temp_dir:
                        zip_path = os.path.join(temp_dir, f"train_passenger_volume_{date}.zip")
                        
                        # Save ZIP file
                        with open(zip_path, 'wb') as f:
                            f.write(zip_response.content)
                        
                        # Extract ZIP file
                        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                            zip_ref.extractall(temp_dir)
                        
                        # Process extracted files
                        for filename in os.listdir(temp_dir):
                            if filename.endswith('.csv'):
                                csv_path = os.path.join(temp_dir, filename)
                                print(f"Processing CSV file: {filename}")
                                
                                # Read CSV file
                                try:
                                    # Read in chunks due to potentially large file size
                                    chunk_size = 10000  # Adjust based on your memory constraints
                                    
                                    # Process each chunk
                                    for chunk_index, chunk in enumerate(pd.read_csv(csv_path, chunksize=chunk_size)):
                                        print(f"Processing chunk {chunk_index + 1}")
                                        
                                        # Convert to list of dictionaries for Firestore
                                        records = chunk.to_dict('records')
                                        
                                        # Store in Firestore
                                        store_train_passenger_volume(records, date, filename, chunk_index)
                                    
                                except Exception as e:
                                    print(f"Error processing CSV file {filename}: {e}")
                else:
                    print(f"Failed to download ZIP file: {zip_response.status_code}")
            except Exception as e:
                print(f"Error processing download link: {e}")
        else:
            print("No download link found in the response")
    else:
        print(f"Failed to fetch train passenger volume data: {response.status_code} - {response.text}")

def get_train_service_alerts():
    """
    Fetches train service alerts from LTA DataMall API.
    This includes information on train service unavailability during scheduled operating hours.
    
    Returns:
        None: Data is directly stored in Firebase
    """
    headers = {'AccountKey': LTA_API_KEY}
    response = requests.get(TRAIN_SERVICE_ALERTS_URL, headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        print("Raw API Response (Train Service Alerts):", data)  # DEBUG: Print API response
        
        alerts = data.get('value', [])  # Ensure we get a list
        
        if not isinstance(alerts, list):
            print("Error: API response format is incorrect!")
            return
        
        # Store the train service alerts data
        store_train_service_alerts(alerts)
        print("Train service alerts data stored successfully!")
    else:
        print(f"Failed to fetch train service alerts: {response.status_code} - {response.text}")

def get_estimated_travel_times():
    """
    Fetches estimated travel times for expressway segments from LTA DataMall API,
    filters out incomplete or invalid records, and stores only clean data into Firestore.
    
    Returns:
        None
    """
    headers = {'AccountKey': LTA_API_KEY}
    response = requests.get(ESTIMATED_TRAVEL_TIMES_URL, headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        print("Raw API Response (Estimated Travel Times):", data)  # Debugging
        
        travel_times = data.get('value', [])
        
        if isinstance(travel_times, list):
            valid_travel_times = []
            invalid_count = 0

            for record in travel_times:
                # Validate the record before storing
                if (
                    record.get('Name') and
                    record.get('StartPoint') and
                    record.get('EndPoint') and
                    isinstance(record.get('EstTime'), (int, float)) and record['EstTime'] > 0
                ):
                    valid_travel_times.append(record)
                else:
                    invalid_count += 1

            if valid_travel_times:
                store_estimated_travel_times(valid_travel_times)
                print(f"Stored {len(valid_travel_times)} valid estimated travel time records.")
            else:
                print("No valid estimated travel times found to store.")

            if invalid_count > 0:
                print(f"Skipped {invalid_count} invalid records (missing fields or zero travel time).")
        else:
            print("Error: Estimated travel times data is not a list!")
    else:
        print(f"Failed to fetch estimated travel times: {response.status_code} - {response.text}")

def get_faulty_traffic_lights():
    """
    Fetches information about faulty traffic lights from LTA DataMall API.
    This includes traffic lights that are currently faulty or undergoing maintenance.
    
    Returns:
        None: Data is directly stored in Firebase
    """
    headers = {'AccountKey': LTA_API_KEY}
    response = requests.get(FAULTY_TRAFFIC_LIGHTS_URL, headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        print("Raw API Response (Faulty Traffic Lights):", data)  # DEBUG: Print API response
        
        faulty_lights = data.get('value', [])  # Ensure we get a list
        
        if not isinstance(faulty_lights, list):
            print("Error: API response format is incorrect!")
            return
        
        # Store the faulty traffic lights data
        store_faulty_traffic_lights(faulty_lights)
        print("Faulty traffic lights data stored successfully!")
    else:
        print(f"Failed to fetch faulty traffic lights: {response.status_code} - {response.text}")

def get_planned_road_openings():
    """
    Fetches information about planned road openings from LTA DataMall API.
    This includes details about new roads that are scheduled to be opened.
    
    Returns:
        None: Data is directly stored in Firebase
    """
    headers = {'AccountKey': LTA_API_KEY}
    response = requests.get(ROAD_OPENINGS_URL, headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        print("Raw API Response (Planned Road Openings):", data)  # DEBUG: Print API response
        
        road_openings = data.get('value', [])  # Ensure we get a list
        
        if not isinstance(road_openings, list):
            print("Error: API response format is incorrect!")
            return
        
        # Store the planned road openings data
        store_planned_road_openings(road_openings)
        print("Planned road openings data stored successfully!")
    else:
        print(f"Failed to fetch planned road openings: {response.status_code} - {response.text}")

def get_approved_road_works():
    """
    Fetches information about approved road works from LTA DataMall API.
    This includes details about road works that are scheduled or in progress.
    
    Returns:
        None: Data is directly stored in Firebase
    """
    headers = {'AccountKey': LTA_API_KEY}
    response = requests.get(ROAD_WORKS_URL, headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        print("Raw API Response (Approved Road Works):", data)  # DEBUG: Print API response
        
        road_works = data.get('value', [])  # Ensure we get a list
        
        if not isinstance(road_works, list):
            print("Error: API response format is incorrect!")
            return
        
        # Store the approved road works data
        store_approved_road_works(road_works)
        print("Approved road works data stored successfully!")
    else:
        print(f"Failed to fetch approved road works: {response.status_code} - {response.text}")

def get_traffic_incidents():
    headers = {'AccountKey': LTA_API_KEY}
    response = requests.get(TRAFFIC_INCIDENTS_URL, headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        print("Raw API Response (Incidents):", data)  # DEBUG: Print API response
        
        incidents = data.get('value', [])  # Ensure we get a list

        if not isinstance(incidents, list):
            print("Error: API response format is incorrect!")
            return
        
        # Store just the traffic incidents data
        store_traffic_data(incidents)
        print("Traffic incidents data stored successfully!")
    else:
        print("Failed to fetch traffic incidents:", response.status_code)

def get_traffic_speed_bands():
    """Fetches traffic speed bands from LTA DataMall API."""
    headers = {'AccountKey': LTA_API_KEY}
    response = requests.get(TRAFFIC_SPEED_BANDS_URL, headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        print("Raw API Response (Traffic Speed Bands):", data)  # DEBUG: Print API response
        
        speed_bands = data.get('value', [])  # Ensure we get a list

        if not isinstance(speed_bands, list):
            print("Error: API response format is incorrect!")
            return
        
        # Store the traffic speed bands data
        store_traffic_speed_bands(speed_bands)
        print("Traffic speed bands data stored successfully!")
    else:
        print(f"Failed to fetch traffic speed bands: {response.status_code} - {response.text}")

def get_vms_messages():
    """Fetches Variable Message Services (VMS) data from LTA DataMall API."""
    headers = {'AccountKey': LTA_API_KEY}
    response = requests.get(VMS_URL, headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        print("Raw API Response (VMS Messages):", data)  # DEBUG: Print API response
        
        vms_messages = data.get('value', [])  # Ensure we get a list

        if not isinstance(vms_messages, list):
            print("Error: API response format is incorrect!")
            return
        
        # Store the VMS messages data
        store_vms_data(vms_messages)
        print("VMS messages data stored successfully!")
    else:
        print(f"Failed to fetch VMS messages: {response.status_code} - {response.text}")

def get_station_crowd_density(train_line=None):
    """
    Fetches real-time MRT/LRT station crowdedness level from LTA DataMall API.
    
    Args:
        train_line (str, optional): Code of train network line (e.g. 'EWL', 'NSL', 'CCL').
                                   If not provided, will fetch data for all train lines.
    
    Returns:
        None: Data is directly stored in Firebase
    """
    headers = {'AccountKey': LTA_API_KEY}
    
    # List of all supported train lines
    train_lines = [
        'CCL', 'CEL', 'CGL', 'DTL', 'EWL', 'NEL', 'NSL', 'BPL', 'SLRT', 'PLRT', 'TEL'
    ]
    
    # If specific train line is provided, only fetch that one
    if train_line:
        if train_line in train_lines:
            params = {'TrainLine': train_line}
            response = requests.get(STATION_CROWD_DENSITY_URL, headers=headers, params=params)
            
            if response.status_code == 200:
                data = response.json()
                print(f"Raw API Response (Station Crowd Density - {train_line}):", data)
                
                crowd_data = data.get('value', [])
                
                if isinstance(crowd_data, list):
                    # Store the crowd density data
                    store_station_crowd_density(crowd_data, train_line)
                    print(f"Station crowd density data for {train_line} stored successfully!")
                else:
                    print("Error: API response format is incorrect!")
            else:
                print(f"Failed to fetch station crowd density for {train_line}: {response.status_code} - {response.text}")
        else:
            print(f"Invalid train line: {train_line}. Supported train lines: {', '.join(train_lines)}")
    else:
        # Fetch data for all train lines
        for line in train_lines:
            try:
                params = {'TrainLine': line}
                response = requests.get(STATION_CROWD_DENSITY_URL, headers=headers, params=params)
                
                if response.status_code == 200:
                    data = response.json()
                    
                    crowd_data = data.get('value', [])
                    
                    if isinstance(crowd_data, list):
                        # Store the crowd density data
                        store_station_crowd_density(crowd_data, line)
                        print(f"Station crowd density data for {line} stored successfully!")
                    else:
                        print(f"Error: API response format for {line} is incorrect!")
                else:
                    print(f"Failed to fetch station crowd density for {line}: {response.status_code} - {response.text}")
                
                # Add delay to avoid rate limiting
                time.sleep(1)
                
            except Exception as e:
                print(f"Error fetching crowd density for {line}: {e}")

def get_station_crowd_forecast(train_line=None):
    """
    Fetches forecasted MRT/LRT station crowdedness level from LTA DataMall API.
    
    Args:
        train_line (str, optional): Code of train network line (e.g. 'EWL', 'NSL', 'CCL').
                                   If not provided, will fetch data for all train lines.
    
    Returns:
        None: Data is directly stored in Firebase
    """
    headers = {'AccountKey': LTA_API_KEY}
    
    # List of all supported train lines
    train_lines = [
        'CCL', 'CEL', 'CGL', 'DTL', 'EWL', 'NEL', 'NSL', 'BPL', 'SLRT', 'PLRT', 'TEL'
    ]
    
    # If specific train line is provided, only fetch that one
    if train_line:
        if train_line in train_lines:
            params = {'TrainLine': train_line}
            response = requests.get(STATION_CROWD_FORECAST_URL, headers=headers, params=params)
            
            if response.status_code == 200:
                data = response.json()
                print(f"Raw API Response (Station Crowd Forecast - {train_line}):", data)
                
                forecast_data = data.get('value', [])
                
                if isinstance(forecast_data, list):
                    # Store the crowd forecast data
                    store_station_crowd_forecast(forecast_data, train_line)
                    print(f"Station crowd forecast data for {train_line} stored successfully!")
                else:
                    print("Error: API response format is incorrect!")
            else:
                print(f"Failed to fetch station crowd forecast for {train_line}: {response.status_code} - {response.text}")
        else:
            print(f"Invalid train line: {train_line}. Supported train lines: {', '.join(train_lines)}")
    else:
        # Fetch data for all train lines
        for line in train_lines:
            try:
                params = {'TrainLine': line}
                response = requests.get(STATION_CROWD_FORECAST_URL, headers=headers, params=params)
                
                if response.status_code == 200:
                    data = response.json()
                    
                    forecast_data = data.get('value', [])
                    
                    if isinstance(forecast_data, list):
                        # Store the crowd forecast data
                        store_station_crowd_forecast(forecast_data, line)
                        print(f"Station crowd forecast data for {line} stored successfully!")
                    else:
                        print(f"Error: API response format for {line} is incorrect!")
                else:
                    print(f"Failed to fetch station crowd forecast for {line}: {response.status_code} - {response.text}")
                
                # Add delay to avoid rate limiting
                time.sleep(1)
                
            except Exception as e:
                print(f"Error fetching crowd forecast for {line}: {e}")

def get_traffic_flow():
    """
    Fetches hourly average traffic flow data from LTA DataMall API.
    This data is taken from a representative month of every quarter during 0700-0900 hours.
    
    Returns:
        None: Data is directly stored in Firebase
    """
    headers = {'AccountKey': LTA_API_KEY}
    response = requests.get(TRAFFIC_FLOW_URL, headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        print("Raw API Response (Traffic Flow):", data)  # DEBUG: Print API response
        
        download_link = data.get('Link', '')
        
        if download_link:
            print(f"Found download link for traffic flow data: {download_link}")
            
            try:
                # Download the JSON file
                json_response = requests.get(download_link)
                
                if json_response.status_code == 200:
                    # Parse the JSON data
                    traffic_flow_data = json_response.json()
                    
                    # Store the traffic flow data
                    store_traffic_flow(traffic_flow_data)
                    print("Traffic flow data stored successfully!")
                else:
                    print(f"Failed to download traffic flow data: {json_response.status_code}")
            except Exception as e:
                print(f"Error processing traffic flow data: {e}")
        else:
            print("No download link found in the response")
    else:
        print(f"Failed to fetch traffic flow data: {response.status_code} - {response.text}")

# Optional utility function for rate-limited requests
def rate_limited_request(url, headers, params=None, max_retries=3, retry_delay=1):
    """
    Makes a rate-limited request to an API with retries
    
    Args:
        url (str): The API endpoint URL
        headers (dict): Request headers
        params (dict, optional): Request parameters. Defaults to None.
        max_retries (int, optional): Maximum number of retry attempts. Defaults to 3.
        retry_delay (int, optional): Initial delay between retries in seconds. Defaults to 1.
        
    Returns:
        requests.Response: The API response or None if all retries failed
    """
    for attempt in range(max_retries):
        try:
            response = requests.get(url, headers=headers, params=params)
            
            # If we get a rate limiting response (429)
            if response.status_code == 429:
                # Wait longer with each retry (exponential backoff)
                sleep_time = retry_delay * (2 ** attempt)
                print(f"Rate limited. Waiting {sleep_time} seconds before retry.")
                time.sleep(sleep_time)
                continue
                
            return response
        except Exception as e:
            print(f"Request error: {e}. Attempt {attempt+1}/{max_retries}")
            time.sleep(retry_delay)
    
    # If we've exhausted all retries
    print("Max retries reached. Unable to complete request.")
    return None