from google.cloud import secretmanager
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime
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

# Collection references for user-reported incidents
user_incidents_ref = db.collection('user_reported_incidents')
incident_categories_ref = db.collection('incident_categories')

def initialize_user_incident(incident_data):
    """
    Enhanced version of create_user_incident with validation fields
    
    Args:
        incident_data (dict): The incident data
    
    Returns:
        str: The ID of the created incident
    """
    # Add server timestamp and validation fields
    if 'time_reported' not in incident_data:
        incident_data['time_reported'] = firestore.SERVER_TIMESTAMP
    
    # Set initial values for validation
    incident_data['approves'] = 0
    incident_data['rejects'] = 0
    incident_data['status'] = 'pending'  # Start as pending, not active
    
    # Add the incident to Firestore
    doc_ref = user_incidents_ref.document()
    doc_ref.set(incident_data)
    return doc_ref.id

def create_user_incident(incident_data):
    """
    Create a new user-reported traffic incident with the proper schema
    
    Args:
        incident_data (dict): The incident data including user_id, mode_of_transport, type, etc.
    
    Returns:
        str: The ID of the created incident
    """
    # Set up default structure if fields are missing
    structured_data = {
        # User information
        "user_id": incident_data.get("user_id", "anonymous"),
        "mode_of_transport": incident_data.get("mode_of_transport", "driving"),
        
        # Incident details
        "type": incident_data.get("type", ""),
        "sub_type": incident_data.get("sub_type", ""),
        
        # Location data
        "location": {
            "latitude": incident_data.get("location", {}).get("latitude", 0),
            "longitude": incident_data.get("location", {}).get("longitude", 0),
            "name": incident_data.get("location", {}).get("name", "")
        },
        
        # Timestamps
        "time_reported": incident_data.get("time_reported", firestore.SERVER_TIMESTAMP),
        
        # Status and validation
        "status": incident_data.get("status", "pending"),
        "approves": incident_data.get("approves", 0),
        "rejects": incident_data.get("rejects", 0),
        
        # Optional media
        "media": incident_data.get("media", []),
        
        # Description
        "description": incident_data.get("description", "")
    }
    
    # Add the incident to Firestore
    doc_ref = user_incidents_ref.document()
    doc_ref.set(structured_data)
    return doc_ref.id

def get_user_incidents(mode=None, status='active', limit=50):
    """
    Get active user-reported incidents, optionally filtered by mode
    
    Args:
        mode (str, optional): Filter by 'driving' or 'public_transport'. Defaults to None.
        status (str, optional): Filter by incident status. Defaults to 'active'.
        limit (int, optional): Maximum number of incidents to return. Defaults to 50.
    
    Returns:
        list: List of incident dictionaries
    """
    query = user_incidents_ref.where('status', '==', status).order_by('time_reported', direction=firestore.Query.DESCENDING).limit(limit)
    
    # Add mode filter if provided
    if mode:
        query = user_incidents_ref.where('mode_of_transport', '==', mode).where('status', '==', status).order_by('time_reported', direction=firestore.Query.DESCENDING).limit(limit)
    
    # Execute query
    results = query.stream()
    
    # Convert to list of dictionaries with document IDs
    incidents = []
    for doc in results:
        incident = doc.to_dict()
        incident['id'] = doc.id
        incidents.append(incident)
        
    return incidents

def update_user_incident_status(incident_id, status):
    """
    Update the status of a user-reported incident
    
    Args:
        incident_id (str): The ID of the incident
        status (str): The new status ('active', 'resolved', 'duplicate')
    
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        user_incidents_ref.document(incident_id).update({
            'status': status
        })
        return True
    except Exception as e:
        print(f"Error updating user incident status: {e}")
        return False

def vote_user_incident(incident_id, vote_type):
    """
    Add an upvote or downvote to a user-reported incident
    
    Args:
        incident_id (str): The ID of the incident
        vote_type (str): Either 'upvote' or 'downvote'
    
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        # Get a reference to the incident
        incident_ref = user_incidents_ref.document(incident_id)
        
        # Use a transaction to safely update vote count
        @firestore.transactional
        def update_in_transaction(transaction, ref):
            snapshot = ref.get(transaction=transaction)
            if not snapshot.exists:
                return False
            
            # Increment the appropriate vote counter
            if vote_type == 'upvote':
                new_count = snapshot.get('upvotes', 0) + 1
                transaction.update(ref, {'upvotes': new_count})
            elif vote_type == 'downvote':
                new_count = snapshot.get('downvotes', 0) + 1
                transaction.update(ref, {'downvotes': new_count})
            return True
        
        return update_in_transaction(db.transaction(), incident_ref)
    except Exception as e:
        print(f"Error updating votes: {e}")
        return False

# Functions for incident categories
def initialize_incident_categories():
    """
    Initialize the incident categories collection with default categories.
    Only runs if the collection is empty.
    """
    # Check if categories already exist
    categories = list(incident_categories_ref.limit(1).stream())
    if categories:
        print("Incident categories already initialized.")
        return
        
    # Define default categories for driving mode
    driving_categories = {
        'type': 'driving',
        'categories': [
            {'name': 'Accident', 'subcategories': ['Shoulder', 'Road', 'Multi-vehicle', 'Hit and Run']},
            {'name': 'Road Work', 'subcategories': ['Shoulder', 'Road', 'Lane Closure', 'Diversion']},
            {'name': 'Police', 'subcategories': ['Bridge', 'Shoulder', 'Hidden', 'Road Block', 'Speed Trap']},
            {'name': 'Weather', 'subcategories': ['Heavy Rain', 'Floods', 'Strong Winds', 'Fog']},
            {'name': 'Hazard', 'subcategories': ['Object on Road', 'Slippery Road', 'Pothole', 'Oil Spill', 'Broken Traffic Light', 'Fallen Tree']},
            {'name': 'Map Issue', 'subcategories': ['Wrong Street Name', 'Road Missing', 'Incorrect Speed Limit', 'Wrong One-Way Direction']}
        ]
    }
    
    # Define default categories for public transport mode
    public_transport_categories = {
        'type': 'public_transport',
        'categories': [
            {'name': 'Accident', 'subcategories': ['Train Collision', 'Bus Crash', 'Passenger Injury']},
            {'name': 'Road Work', 'subcategories': ['Affecting Bus Lanes', 'Affecting Train Tracks']},
            {'name': 'High Crowds', 'subcategories': ['Bus Stop Full', 'Train Station Full', 'Delayed Buses/Trains']},
            {'name': 'Weather', 'subcategories': ['Heavy Rain', 'Floods', 'Strong Winds', 'Fog', 'Heatwaves']},
            {'name': 'Hazard', 'subcategories': ['Slippery Train Platform', 'Broken Escalator', 'Broken Elevator', 'Fire Alarm Activated', 'Suspicious Package']},
            {'name': 'Police', 'subcategories': ['Train/Bus Security Checks', 'Suspicious Activity Reported', 'Closed Station Due to Security']}
        ]
    }
    
    # Add to Firestore
    incident_categories_ref.document('driving').set(driving_categories)
    incident_categories_ref.document('public_transport').set(public_transport_categories)
    print("Incident categories initialized successfully.")

def get_incident_categories(mode=None):
    """
    Get incident categories, optionally filtered by mode
    
    Args:
        mode (str, optional): Filter by 'driving' or 'public_transport'. Defaults to None.
    
    Returns:
        dict: Dictionary of categories or list if mode is specified
    """
    if mode:
        # Get categories for a specific mode
        doc_ref = incident_categories_ref.document(mode)
        doc = doc_ref.get()
        if doc.exists:
            return doc.to_dict()
        else:
            return {}
    else:
        # Get all categories
        categories = {}
        for doc in incident_categories_ref.stream():
            categories[doc.id] = doc.to_dict()
        return categories

# Function to get both official and user-reported incidents
def get_all_incidents(mode=None, include_official=True, include_user_reported=True, limit=50):
    """
    Get a combined list of incidents from both official sources and user reports
    
    Args:
        mode (str, optional): Filter by 'driving' or 'public_transport'. Defaults to None.
        include_official (bool): Include official incidents. Defaults to True.
        include_user_reported (bool): Include user-reported incidents. Defaults to True.
        limit (int): Maximum incidents to return per source. Defaults to 50.
        
    Returns:
        list: Combined list of incidents with source label
    """
    all_incidents = []
    
    # Get official incidents if requested
    if include_official:
        official_query = db.collection("traffic_incidents").limit(limit)
        official_results = official_query.stream()
        
        for doc in official_results:
            incident = doc.to_dict()
            incident['id'] = doc.id
            incident['source'] = 'official'
            all_incidents.append(incident)
    
    # Get user-reported incidents if requested
    if include_user_reported:
        user_query = user_incidents_ref.where('status', '==', 'active').limit(limit)
        
        # Add mode filter if provided
        if mode:
            user_query = user_incidents_ref.where('mode_of_transport', '==', mode).where('status', '==', 'active').limit(limit)
        
        user_results = user_query.stream()
        
        for doc in user_results:
            incident = doc.to_dict()
            incident['id'] = doc.id
            incident['source'] = 'user-reported'
            all_incidents.append(incident)
    
    # Sort all incidents by timestamp (newest first)
    sorted_incidents = sorted(all_incidents, key=lambda x: x.get('time_reported', 0), reverse=True)
    
    return sorted_incidents

# Add these functions to firestore_utils.py

# Update to the vote_on_incident function in firestore_utils.py

def vote_on_incident(incident_id, user_id, vote_type):
    """
    Register a user's vote on an incident report
    
    Args:
        incident_id (str): The ID of the incident
        user_id (str): The ID of the voting user
        vote_type (str): Either 'approve' or 'reject'
    
    Returns:
        dict: Updated vote counts and validation status
    """
    try:
        # Get a reference to the incident and votes subcollection
        incident_ref = user_incidents_ref.document(incident_id)
        votes_ref = incident_ref.collection('votes')
        
        # Check if this user has already voted
        user_vote_ref = votes_ref.document(user_id)
        user_vote = user_vote_ref.get()
        
        # Use a transaction to ensure vote counts remain consistent
        @firestore.transactional
        def update_in_transaction(transaction, ref):
            snapshot = ref.get(transaction=transaction)
            if not snapshot.exists:
                return {"error": "Incident not found"}
            
            incident_data = snapshot.to_dict()
            current_time = firestore.SERVER_TIMESTAMP
            
            # If user already voted, update their vote (change or remove)
            if user_vote.exists:
                old_vote = user_vote.to_dict().get('vote')
                if old_vote == vote_type:
                    # User is voting the same way again - remove their vote
                    transaction.delete(user_vote_ref)
                    
                    # Decrement the appropriate counter
                    if vote_type == 'approve':
                        new_approves = incident_data.get('approves', 0) - 1
                        transaction.update(ref, {'approves': new_approves})
                    else:
                        new_rejects = incident_data.get('rejects', 0) - 1
                        transaction.update(ref, {'rejects': new_rejects})
                else:
                    # User is changing their vote
                    transaction.update(user_vote_ref, {
                        'vote': vote_type,
                        'timestamp': current_time
                    })
                    
                    # Update both counters
                    if vote_type == 'approve':
                        new_approves = incident_data.get('approves', 0) + 1
                        new_rejects = incident_data.get('rejects', 0) - 1
                    else:
                        new_approves = incident_data.get('approves', 0) - 1
                        new_rejects = incident_data.get('rejects', 0) + 1
                    
                    transaction.update(ref, {
                        'approves': new_approves,
                        'rejects': new_rejects
                    })
            else:
                # New vote
                transaction.set(user_vote_ref, {
                    'vote': vote_type,
                    'timestamp': current_time
                })
                
                # Increment the appropriate counter
                if vote_type == 'approve':
                    new_approves = incident_data.get('approves', 0) + 1
                    transaction.update(ref, {'approves': new_approves})
                else:
                    new_rejects = incident_data.get('rejects', 0) + 1
                    transaction.update(ref, {'rejects': new_rejects})
            
            # Get the updated incident data to check validation status
            updated_snapshot = ref.get(transaction=transaction)
            updated_data = updated_snapshot.to_dict()
            
            # Check time-based validation thresholds
            report_time = updated_data.get('time_reported')
            current_approves = updated_data.get('approves', 0)
            current_rejects = updated_data.get('rejects', 0)
            
            # If validation status needs to change
            validation_changed = False
            new_status = updated_data.get('status')
            
            # Within 20 minutes threshold check (convert to seconds)
            if report_time and (current_time - report_time).seconds < 1200:  # 20 minutes in seconds
                # 10 approves = verified (per new requirements)
                if current_approves >= 10 and new_status != 'verified':
                    transaction.update(ref, {'status': 'verified', 'validated_at': current_time})
                    new_status = 'verified'
                    validation_changed = True
                
                # 10 rejects = invalidated (per new requirements)
                elif current_rejects >= 10 and new_status != 'false_report':
                    transaction.update(ref, {'status': 'false_report', 'validated_at': current_time})
                    new_status = 'false_report'
                    validation_changed = True
            
            return {
                'incident_id': incident_id,
                'approves': current_approves,
                'rejects': current_rejects, 
                'status': new_status,
                'validation_changed': validation_changed
            }
        
        # Execute the transaction
        result = update_in_transaction(db.transaction(), incident_ref)
        return result
    
    except Exception as e:
        print(f"Error processing vote: {e}")
        return {"error": str(e)}

# Update the get_incident_validation_status function for 20 minute window and 10 votes threshold
def get_incident_validation_status(incident_id):
    """
    Get current validation statistics for an incident
    
    Args:
        incident_id (str): The ID of the incident
    
    Returns:
        dict: Validation statistics and status
    """
    try:
        incident_ref = user_incidents_ref.document(incident_id)
        incident = incident_ref.get()
        
        if not incident.exists:
            return {"error": "Incident not found"}
        
        incident_data = incident.to_dict()
        
        # Calculate time remaining in validation window (if still within 20 minutes)
        current_time = firestore.SERVER_TIMESTAMP
        report_time = incident_data.get('time_reported')
        
        time_elapsed = (current_time - report_time).seconds if report_time else 0
        time_remaining = max(0, 1200 - time_elapsed)  # 20 minutes in seconds
        
        # Get vote counts
        approves = incident_data.get('approves', 0)
        rejects = incident_data.get('rejects', 0)
        
        return {
            "incident_id": incident_id,
            "status": incident_data.get('status', 'pending'),
            "approves": approves,
            "rejects": rejects,
            "time_elapsed_seconds": time_elapsed,
            "time_remaining_seconds": time_remaining,
            "approves_needed": max(0, 10 - approves),  # Changed from 20 to 10
            "rejects_needed": max(0, 10 - rejects)     # Changed from 20 to 10
        }
    
    except Exception as e:
        print(f"Error getting validation status: {e}")
        return {"error": str(e)}

# Add these functions to your app/database/firestore_utils.py file

async def store_user_data(user_id, name=None, email=None, phone_number=None, user_type="registered"):
    """
    Stores user data in Firestore
    
    Args:
        user_id (str): The Firebase UID of the user
        name (str, optional): The user's display name
        email (str, optional): The user's email
        phone_number (str, optional): The user's phone number
        user_type (str): Either "registered" or "anonymous"
    
    Returns:
        bool: True if successful
    """
    try:
        # Create a reference to the users collection
        users_ref = db.collection('users')
        
        # Prepare user data
        user_data = {
            'user_id': user_id,
            'user_type': user_type,
            'created_at': firestore.SERVER_TIMESTAMP,
            'last_login': firestore.SERVER_TIMESTAMP
        }
        
        # Add optional fields if provided
        if name:
            user_data['name'] = name
        if email:
            user_data['email'] = email
        if phone_number:
            user_data['phone_number'] = phone_number
            
        # Store in Firestore using the UID as document ID
        users_ref.document(user_id).set(user_data)
        
        return True
    except Exception as e:
        print(f"Error storing user data: {e}")
        return False

async def update_user_last_login(user_id):
    """
    Updates the last login timestamp for a user
    
    Args:
        user_id (str): The Firebase UID of the user
    
    Returns:
        bool: True if successful
    """
    try:
        # Update the last_login field
        db.collection('users').document(user_id).update({
            'last_login': firestore.SERVER_TIMESTAMP
        })
        
        return True
    except Exception as e:
        print(f"Error updating user last login: {e}")
        return False