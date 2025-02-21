from google.cloud import secretmanager
import firebase_admin
from firebase_admin import credentials, firestore
import json

# Create the Secret Manager client
client = secretmanager.SecretManagerServiceClient()

# Replace with your Secret Manager secret name
secret_name = "projects/541900038032/secrets/firebase-service-account-key/versions/latest"

# Access the secret version
response = client.access_secret_version(name=secret_name)

# The secret payload is in 'response.payload.data'
service_account_key = response.payload.data.decode("UTF-8")

# Load the service account key as a JSON object
service_account_key_json = json.loads(service_account_key)

# Initialize Firebase with the service account key
cred = credentials.Certificate(service_account_key_json)
firebase_admin.initialize_app(cred)

# Firestore database client
db = firestore.client()

def store_traffic_data(incidents, traffic_flows):
    """Stores traffic data (incidents and traffic flows) in Firestore."""
    try:
        traffic_ref = db.collection("traffic_incidents")
        traffic_flow_ref = db.collection("traffic_flow")

        # Store incidents
        for incident in incidents:
            if isinstance(incident, dict):  # Check if incident is a dictionary
                doc_id = str(incident.get("IncidentID", "unknown"))
                filtered_incident = {
                    "Type": incident.get("Type", ""),
                    "Latitude": incident.get("Latitude", 0),
                    "Longitude": incident.get("Longitude", 0),
                    "Message": incident.get("Message", ""),
                    "Timestamp": firestore.SERVER_TIMESTAMP
                }
                traffic_ref.document(doc_id).set(filtered_incident)

        '''
        # havent uploaded traffic_flows data from lta data mall
        # Store traffic flows
        for flow in traffic_flows:
            if isinstance(flow, dict):  # Check if flow is a dictionary
                doc_id = str(flow.get("Link", "unknown"))
                filtered_flow = {
                    "Link": flow.get("Link", ""),
                    "Timestamp": firestore.SERVER_TIMESTAMP
                }
                traffic_flow_ref.document(doc_id).set(filtered_flow)
        '''
    except Exception as e:
        print(f"Error storing traffic data: {e}")
    
        
def store_weather_data(weather_info):
    """Stores weather data in Firestore."""
    try:
        weather_ref = db.collection("weather_data")
        weather_ref.document(weather_info["city"]).set(weather_info)
    except Exception as e:
        print(f"Error storing weather data: {e}")

def upload_csv_to_firestore(csv_file_path, collection_name):
    """Uploads a CSV file to Firestore."""
    try:
        # Load CSV file
        df = pd.read_csv(csv_file_path)

        # Firestore collection reference
        collection_ref = db.collection(collection_name)

        # Iterate through rows and store each as a Firestore document
        for index, row in df.iterrows():
            doc_id = f"year_{row['Year']}" if 'Year' in row else str(index)  # Use year as document ID if available
            collection_ref.document(doc_id).set(row.to_dict())

        print(f"CSV data successfully uploaded to Firestore collection: {collection_name}")

    except Exception as e:
        print(f"Error uploading CSV to Firestore: {e}")

def fetch_firestore_data(collection_name, limit=10):
    """Fetches and returns documents from Firestore as a list."""
    try:
        collection_ref = db.collection(collection_name)
        docs = collection_ref.limit(limit).stream()

        data_list = []
        for doc in docs:
            data_list.append(doc.to_dict())  # Convert Firestore doc to dictionary

        return data_list  # Return the list of documents

    except Exception as e:
        print(f"Error fetching Firestore data: {e}")
        return []
