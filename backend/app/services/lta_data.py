from google.cloud import secretmanager
import requests
from app.database.firestore_utils import store_traffic_data, store_estimated_travel_times, store_traffic_speed_bands, store_vms_data

# Create Secret Manager client
client = secretmanager.SecretManagerServiceClient()

# Access the LTA API key from Secret Manager
def get_secret(secret_name):
    response = client.access_secret_version(name=secret_name)
    return response.payload.data.decode("UTF-8")

# Fetch LTA API key from Secret Manager
LTA_API_KEY = get_secret("projects/541900038032/secrets/LTA_API_account_key/versions/latest")
ESTIMATED_TRAVEL_TIMES_URL = "https://datamall2.mytransport.sg/ltaodataservice/EstTravelTimes"
TRAFFIC_INCIDENTS_URL = "https://datamall2.mytransport.sg/ltaodataservice/TrafficIncidents"
TRAFFIC_SPEED_BANDS_URL = "https://datamall2.mytransport.sg/ltaodataservice/v3/TrafficSpeedBands"
VMS_URL = "https://datamall2.mytransport.sg/ltaodataservice/VMS"

def get_estimated_travel_times():
    headers = {'AccountKey': LTA_API_KEY}
    response = requests.get(ESTIMATED_TRAVEL_TIMES_URL, headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        print("Raw API Response (Estimated Travel Times):", data)  # Debugging
        
        travel_times = data.get('value', [])
        
        if isinstance(travel_times, list):
            store_estimated_travel_times(travel_times)  # Store estimated travel times in Firestore
            print("Estimated travel times stored successfully!")
        else:
            print("Error: Estimated travel times data is not a list!")
    else:
        print(f"Failed to fetch estimated travel times: {response.status_code} - {response.text}")

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