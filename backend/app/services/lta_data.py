from google.cloud import secretmanager
import requests
from app.database.firestore_utils import store_traffic_data  # Correct import path

# Create Secret Manager client
client = secretmanager.SecretManagerServiceClient()

# Access the LTA API key from Secret Manager
def get_secret(secret_name):
    response = client.access_secret_version(name=secret_name)
    return response.payload.data.decode("UTF-8")

# Fetch LTA API key from Secret Manager
LTA_API_KEY = get_secret("projects/541900038032/secrets/LTA_API_account_key/versions/latest")
TRAFFIC_INCIDENTS_URL = "https://datamall2.mytransport.sg/ltaodataservice/TrafficIncidents"
TRAFFIC_FLOW_URL = "https://datamall2.mytransport.sg/ltaodataservice/TrafficFlow"

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
        
        # Fetch traffic flow data
        get_traffic_flow(incidents)  # Pass incidents directly to flow data fetching function
    else:
        print("Failed to fetch traffic incidents:", response.status_code)

def get_traffic_flow(incidents):
    headers = {'AccountKey': LTA_API_KEY}
    response = requests.get(TRAFFIC_FLOW_URL, headers=headers)

    print(f"Traffic Flow API Status Code: {response.status_code}")  # Log the status code
    print(f"Traffic Flow API Response: {response.text}")  # Log the full response text
    
    if response.status_code == 200:
        flow_data = response.json()
        print("Raw API Response (Traffic Flow):", flow_data)  # Debugging

        traffic_flows = flow_data.get('value', [])

        if isinstance(traffic_flows, list):
            # Store both incidents and traffic flows together
            store_traffic_data(incidents, traffic_flows)  # Store both traffic incidents and flow data
            print("Traffic data stored successfully!")
        else:
            print("Error: Traffic flow data is not a list!")
    else:
        print(f"Failed to fetch traffic flow data: {response.status_code} - {response.text}")
