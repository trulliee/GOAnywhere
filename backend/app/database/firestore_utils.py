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

def store_estimated_travel_times(travel_times):
    """Stores estimated travel times from LTA DataMall in Firestore."""
    try:
        travel_time_ref = db.collection("estimated_travel_times")

        for entry in travel_times:
            if isinstance(entry, dict):  # Ensure entry is a dictionary
                doc_id = f"{entry.get('Expressway', 'Unknown')}_{entry.get('Startpoint', 'Unknown')}_{entry.get('Endpoint', 'Unknown')}_{entry.get('Direction', 'Unknown')}"
                
                travel_time_data = {
                    "Expressway": entry.get("Expressway", ""),
                    "Direction": entry.get("Direction", ""),
                    "Startpoint": entry.get("Startpoint", ""),
                    "Endpoint": entry.get("Endpoint", ""),
                    "Farendpoint": entry.get("Farendpoint", ""),
                    "Esttime": entry.get("Esttime", 0),  # Keeping original API field name
                    "Timestamp": firestore.SERVER_TIMESTAMP
                }

                doc_ref = travel_time_ref.document(doc_id)
                existing_doc = doc_ref.get()

                # Update only if new data differs to reduce Firestore writes
                if not existing_doc.exists or existing_doc.to_dict().get("Esttime") != travel_time_data["Esttime"]:
                    doc_ref.set(travel_time_data)

        print("Estimated travel times successfully stored in Firestore.")
    except Exception as e:
        print(f"Error storing estimated travel times: {e}")

def store_traffic_data(incidents):
    """Stores traffic incidents data in Firestore."""
    try:
        traffic_ref = db.collection("traffic_incidents")

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

    except Exception as e:
        print(f"Error storing traffic incidents data: {e}")

def store_traffic_speed_bands(speed_bands):
    """Stores traffic speed bands data from LTA DataMall in Firestore."""
    try:
        speed_bands_ref = db.collection("traffic_speed_bands")

        for entry in speed_bands:
            if isinstance(entry, dict):  # Ensure entry is a dictionary
                # Create a unique document ID using LinkId
                doc_id = str(entry.get("LinkID", "unknown"))
                
                # Prepare the data to store
                speed_band_data = {
                    "LinkID": entry.get("LinkID", ""),
                    "RoadName": entry.get("RoadName", ""),
                    "RoadCategory": entry.get("RoadCategory", ""),
                    "SpeedBand": entry.get("SpeedBand", 0),  
                    "MinSpeed": entry.get("MinSpeed", 0),
                    "MaxSpeed": entry.get("MaxSpeed", 0),
                    "StartLongitude": entry.get("StartLongitude", 0),
                    "StartLatitude": entry.get("StartLatitude", 0),
                    "EndLongitude": entry.get("EndLongitude", 0),
                    "EndLatitude": entry.get("EndLatitude", 0),
                    "Timestamp": firestore.SERVER_TIMESTAMP
                }

                # Get existing document to check if update is needed
                doc_ref = speed_bands_ref.document(doc_id)
                existing_doc = doc_ref.get()

                # Update only if new data differs to reduce Firestore writes
                if not existing_doc.exists or existing_doc.to_dict().get("SpeedBand") != speed_band_data["SpeedBand"]:
                    doc_ref.set(speed_band_data)

        print("Traffic speed bands successfully stored in Firestore.")
    except Exception as e:
        print(f"Error storing traffic speed bands: {e}")

def store_vms_data(vms_messages):
    """Stores Variable Message Services (VMS) data from LTA DataMall in Firestore."""
    try:
        vms_ref = db.collection("vms_messages")

        for entry in vms_messages:
            if isinstance(entry, dict):  # Ensure entry is a dictionary
                # Create a unique document ID using equipmentId
                doc_id = str(entry.get("EquipmentID", "unknown"))
                
                # Prepare the data to store
                vms_data = {
                    "EquipmentID": entry.get("EquipmentID", ""),
                    "Latitude": entry.get("Latitude", 0),
                    "Longitude": entry.get("Longitude", 0),
                    "Message": entry.get("Message", ""),
                    "Timestamp": firestore.SERVER_TIMESTAMP
                }

                # Get existing document to check if update is needed
                doc_ref = vms_ref.document(doc_id)
                existing_doc = doc_ref.get()

                # Update only if new message differs to reduce Firestore writes
                if not existing_doc.exists or existing_doc.to_dict().get("Message") != vms_data["Message"]:
                    doc_ref.set(vms_data)

        print("VMS messages successfully stored in Firestore.")
    except Exception as e:
        print(f"Error storing VMS messages: {e}")

def store_traffic_conditions(traffic_conditions):
    """Stores traffic conditions during peak hours data from data.gov.sg in Firestore."""
    try:
        traffic_conditions_ref = db.collection("peak_traffic_conditions")
        
        # Process and store each record
        for entry in traffic_conditions:
            if isinstance(entry, dict):
                # Create a unique document ID using date or other identifier
                doc_id = str(entry.get("year", "")) + "_" + str(entry.get("month", ""))
                
                # Store the data
                traffic_conditions_data = {
                    "year": entry.get("year", ""),
                    "month": entry.get("month", ""),
                    "daily_traffic_volume": entry.get("daily_traffic_volume", 0),
                    "avg_speed": entry.get("avg_speed", 0),
                    "congestion_free_roads_percentage": entry.get("congestion_free_roads_percentage", 0),
                    "Timestamp": firestore.SERVER_TIMESTAMP
                }
                
                traffic_conditions_ref.document(doc_id).set(traffic_conditions_data)
        
        print("Peak hour traffic conditions successfully stored in Firestore.")
    except Exception as e:
        print(f"Error storing peak hour traffic conditions: {e}")

def store_weather_forecast(forecast_data):
    """Stores 24-hour weather forecast data from data.gov.sg in Firestore."""
    try:
        weather_forecast_ref = db.collection("weather_forecast_24hr")
        
        # Create a document ID using the forecast timestamp or date
        timestamp = forecast_data.get("timestamp", "")
        doc_id = timestamp.replace(":", "-").replace(".", "-") if timestamp else str(firestore.SERVER_TIMESTAMP)
        
        # Include all relevant fields from the forecast
        forecast_to_store = {
            "timestamp": timestamp,
            "update_timestamp": forecast_data.get("update_timestamp", ""),
            "valid_period": forecast_data.get("valid_period", {}),
            "general_forecast": forecast_data.get("general_forecast", ""),
            "temperature": forecast_data.get("temperature", {}),
            "relative_humidity": forecast_data.get("relative_humidity", {}),
            "wind": forecast_data.get("wind", {}),
            "regions": forecast_data.get("regions", {}),
            "stored_at": firestore.SERVER_TIMESTAMP
        }
        
        # Store the data
        weather_forecast_ref.document(doc_id).set(forecast_to_store)
        
        print("24-hour weather forecast successfully stored in Firestore.")
    except Exception as e:
        print(f"Error storing 24-hour weather forecast: {e}")
        
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
