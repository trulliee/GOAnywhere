from google.cloud import secretmanager
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime
import json
import os

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

def store_bus_arrival_data(bus_stop_code, services, store_history=True):
    """
    Stores bus arrival data in Firestore.
    
    Args:
        bus_stop_code (str): The bus stop code
        services (list): List of bus services and their arrival information
        store_history (bool, optional): Whether to store historical data. Defaults to True.
    """
    try:
        # Create a reference to the bus arrivals collection
        bus_arrivals_ref = db.collection("bus_arrivals")
        
        # Create a document for this bus stop
        bus_stop_doc_ref = bus_arrivals_ref.document(bus_stop_code)
        
        # Prepare the data to store
        arrival_data = {
            "bus_stop_code": bus_stop_code,
            "last_updated": firestore.SERVER_TIMESTAMP,
            "services": {}
        }
        
        # Process each service
        for service in services:
            if not isinstance(service, dict):
                continue
                
            service_no = service.get("ServiceNo", "")
            if not service_no:
                continue
                
            # Extract the next buses data
            arrival_data["services"][service_no] = {
                "operator": service.get("Operator", ""),
                "next_buses": []
            }
            
            # Process NextBus, NextBus2, NextBus3
            for bus_key in ["NextBus", "NextBus2", "NextBus3"]:
                bus_info = service.get(bus_key, {})
                if not bus_info or not bus_info.get("EstimatedArrival"):
                    continue
                    
                # Convert timestamp to Firestore timestamp if it exists
                estimated_arrival = bus_info.get("EstimatedArrival", "")
                firestore_timestamp = None
                if estimated_arrival:
                    try:
                        # Parse the ISO 8601 datetime string
                        from datetime import datetime
                        dt = datetime.fromisoformat(estimated_arrival.replace('Z', '+00:00'))
                        # Convert to Firestore timestamp
                        firestore_timestamp = firestore.Timestamp.from_datetime(dt)
                    except Exception as e:
                        print(f"Error parsing timestamp {estimated_arrival}: {e}")
                
                # Add this bus to the next_buses array
                next_bus = {
                    "origin_code": bus_info.get("OriginCode", ""),
                    "destination_code": bus_info.get("DestinationCode", ""),
                    "estimated_arrival": firestore_timestamp,
                    "estimated_arrival_iso": estimated_arrival,  # Store original ISO string too
                    "monitored": bus_info.get("Monitored", 0),
                    "latitude": float(bus_info.get("Latitude", 0)) if bus_info.get("Latitude") else 0,
                    "longitude": float(bus_info.get("Longitude", 0)) if bus_info.get("Longitude") else 0,
                    "visit_number": bus_info.get("VisitNumber", ""),
                    "load": bus_info.get("Load", ""),
                    "feature": bus_info.get("Feature", ""),
                    "type": bus_info.get("Type", "")
                }
                
                arrival_data["services"][service_no]["next_buses"].append(next_bus)
        
        # Store the data in Firestore
        bus_stop_doc_ref.set(arrival_data)
        
        # Additionally, store a simplified version in a historical collection for analytics
        # Only if store_history is True
        if store_history:
            store_bus_arrival_history(bus_stop_code, services)
        
    except Exception as e:
        print(f"Error storing bus arrival data: {e}")

def store_bus_arrival_history(bus_stop_code, services):
    """
    Stores simplified bus arrival data in a historical collection for analytics.
    
    Args:
        bus_stop_code (str): The bus stop code
        services (list): List of bus services and their arrival information
    """
    try:
        # Create a reference to the historical bus arrivals collection
        history_ref = db.collection("bus_arrivals_history")
        
        # Generate a timestamp-based document ID for this entry
        from datetime import datetime
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        doc_id = f"{bus_stop_code}_{timestamp}"
        
        # Prepare simplified historical data
        history_data = {
            "bus_stop_code": bus_stop_code,
            "timestamp": firestore.SERVER_TIMESTAMP,
            "services": []
        }
        
        # Simplify the services data for historical storage
        for service in services:
            if not isinstance(service, dict):
                continue
                
            service_no = service.get("ServiceNo", "")
            if not service_no:
                continue
                
            # Just store the service number and the estimated arrival time of the next bus
            next_bus = service.get("NextBus", {})
            if next_bus and next_bus.get("EstimatedArrival"):
                service_data = {
                    "service_no": service_no,
                    "operator": service.get("Operator", ""),
                    "estimated_arrival": next_bus.get("EstimatedArrival", ""),
                    "load": next_bus.get("Load", "")
                }
                history_data["services"].append(service_data)
        
        # Only store historical data if there are services with arrivals
        if history_data["services"]:
            history_ref.document(doc_id).set(history_data)
            
    except Exception as e:
        print(f"Error storing bus arrival history: {e}")

def store_bus_services_info(services_data):
    """
    Stores bus services information in Firestore.
    
    Args:
        services_data (list): List of bus services information
    """
    try:
        # Create a reference to the bus services info collection
        bus_services_ref = db.collection("bus_services_info")
        
        # Create a batch to perform all writes together for better performance
        batch = db.batch()
        batch_count = 0
        max_batch_size = 500  # Firestore has a limit of 500 operations per batch
        
        # Process each service entry
        for service in services_data:
            if not isinstance(service, dict):
                continue
                
            service_no = service.get("ServiceNo", "")
            direction = service.get("Direction", "")
            
            if not (service_no and direction):
                continue
                
            # Create a unique document ID for this service direction
            doc_id = f"{service_no}_{direction}"
            
            # Prepare the data to store
            service_data = {
                "service_no": service_no,
                "operator": service.get("Operator", ""),
                "direction": direction,
                "category": service.get("Category", ""),
                "origin_code": service.get("OriginCode", ""),
                "destination_code": service.get("DestinationCode", ""),
                "am_peak_freq": service.get("AM_Peak_Freq", ""),
                "am_offpeak_freq": service.get("AM_Offpeak_Freq", ""),
                "pm_peak_freq": service.get("PM_Peak_Freq", ""),
                "pm_offpeak_freq": service.get("PM_Offpeak_Freq", ""),
                "loop_desc": service.get("LoopDesc", ""),
                "last_updated": firestore.SERVER_TIMESTAMP
            }
            
            # Add to batch
            doc_ref = bus_services_ref.document(doc_id)
            batch.set(doc_ref, service_data)
            batch_count += 1
            
            # If batch size reaches max, commit and start a new batch
            if batch_count >= max_batch_size:
                batch.commit()
                print(f"Committed batch of {batch_count} bus service entries")
                batch = db.batch()
                batch_count = 0
        
        # Commit any remaining operations in the batch
        if batch_count > 0:
            batch.commit()
            print(f"Committed final batch of {batch_count} bus service entries")
            
        print(f"Successfully stored {len(services_data)} bus service entries in Firestore")
    except Exception as e:
        print(f"Error storing bus services data: {e}")

def store_bus_routes(routes_data):
    """
    Stores bus routes data in Firestore.
    
    Args:
        routes_data (list): List of bus routes information
    """
    try:
        # Create a reference to the bus routes collection
        bus_routes_ref = db.collection("bus_routes")
        
        # Create a batch to perform all writes together for better performance
        batch = db.batch()
        batch_count = 0
        max_batch_size = 500  # Firestore has a limit of 500 operations per batch
        
        # Track all service numbers to update the service summary later
        services_summary = {}
        
        # Process each route entry
        for route in routes_data:
            if not isinstance(route, dict):
                continue
                
            service_no = route.get("ServiceNo", "")
            direction = route.get("Direction", "")
            stop_sequence = route.get("StopSequence", "")
            
            if not (service_no and direction and stop_sequence):
                continue
                
            # Create a unique document ID for this route stop
            doc_id = f"{service_no}_{direction}_{stop_sequence}"
            
            # Prepare the data to store
            route_data = {
                "service_no": service_no,
                "operator": route.get("Operator", ""),
                "direction": direction,
                "stop_sequence": stop_sequence,
                "bus_stop_code": route.get("BusStopCode", ""),
                "distance": route.get("Distance", 0),
                "weekday_first_bus": route.get("WD_FirstBus", ""),
                "weekday_last_bus": route.get("WD_LastBus", ""),
                "saturday_first_bus": route.get("SAT_FirstBus", ""),
                "saturday_last_bus": route.get("SAT_LastBus", ""),
                "sunday_first_bus": route.get("SUN_FirstBus", ""),
                "sunday_last_bus": route.get("SUN_LastBus", ""),
                "last_updated": firestore.SERVER_TIMESTAMP
            }
            
            # Add to the service summary for faster lookups
            if service_no not in services_summary:
                services_summary[service_no] = {
                    "service_no": service_no,
                    "operator": route.get("Operator", ""),
                    "directions": set(),
                    "stop_count": 0,
                    "total_distance": 0
                }
            
            services_summary[service_no]["directions"].add(direction)
            services_summary[service_no]["stop_count"] += 1
            
            # Track the maximum distance for distance calculation
            if direction == "1":
                services_summary[service_no]["total_distance"] = max(
                    services_summary[service_no].get("total_distance", 0),
                    float(route.get("Distance", 0))
                )
            
            # Add to batch
            doc_ref = bus_routes_ref.document(doc_id)
            batch.set(doc_ref, route_data)
            batch_count += 1
            
            # If batch size reaches max, commit and start a new batch
            if batch_count >= max_batch_size:
                batch.commit()
                print(f"Committed batch of {batch_count} bus route entries")
                batch = db.batch()
                batch_count = 0
        
        # Commit any remaining operations in the batch
        if batch_count > 0:
            batch.commit()
            print(f"Committed final batch of {batch_count} bus route entries")
        
        # Store the service summary for quicker lookups
        store_bus_services_summary(services_summary)
            
        print(f"Successfully stored {len(routes_data)} bus route entries in Firestore")
    except Exception as e:
        print(f"Error storing bus routes data: {e}")

def store_bus_services_summary(services_summary):
    """
    Stores a summary of bus services for quicker lookup.
    
    Args:
        services_summary (dict): Dictionary of service summaries
    """
    try:
        # Create a reference to the bus services collection
        bus_services_ref = db.collection("bus_services")
        
        # Create a batch for better performance
        batch = db.batch()
        batch_count = 0
        max_batch_size = 500
        
        # Process each service
        for service_no, summary in services_summary.items():
            # Convert set to list for Firestore storage
            summary["directions"] = list(summary["directions"])
            
            # Add to batch
            doc_ref = bus_services_ref.document(service_no)
            batch.set(doc_ref, summary)
            batch_count += 1
            
            # If batch size reaches max, commit and start a new batch
            if batch_count >= max_batch_size:
                batch.commit()
                batch = db.batch()
                batch_count = 0
        
        # Commit any remaining operations in the batch
        if batch_count > 0:
            batch.commit()
            
        print(f"Successfully stored summaries for {len(services_summary)} bus services in Firestore")
    except Exception as e:
        print(f"Error storing bus services summary: {e}")

def store_bus_passenger_volume(records, date, filename):
    """
    Stores bus passenger volume data in Firestore.
    
    Args:
        records (list): List of dictionaries with passenger volume data
        date (str): Date string in format YYYYMM
        filename (str): Original filename for reference
    """
    try:
        # Create a reference to the bus passenger volume collection
        bus_pv_ref = db.collection("bus_passenger_volume")
        
        # Create a document for this date/file
        doc_id = f"{date}_{os.path.splitext(filename)[0]}"
        doc_ref = bus_pv_ref.document(doc_id)
        
        # Store metadata about this file
        metadata = {
            "date": date,
            "filename": filename,
            "record_count": len(records),
            "upload_timestamp": firestore.SERVER_TIMESTAMP
        }
        
        # Store metadata first
        doc_ref.set(metadata)
        print(f"Stored metadata for {filename}")
        
        # Store records in subcollection to avoid document size limits
        records_ref = doc_ref.collection("records")
        
        # Use batched writes for better performance
        batch = db.batch()
        batch_count = 0
        max_batch_size = 500
        
        for i, record in enumerate(records):
            # Use record index as document ID (or you can use a more specific ID if available)
            record_id = str(i)
            record_ref = records_ref.document(record_id)
            
            # Add timestamp to record
            record["imported_at"] = firestore.SERVER_TIMESTAMP
            
            # Add to batch
            batch.set(record_ref, record)
            batch_count += 1
            
            # If batch size reaches max, commit and start a new batch
            if batch_count >= max_batch_size:
                batch.commit()
                print(f"Committed batch of {batch_count} passenger volume records")
                batch = db.batch()
                batch_count = 0
        
        # Commit any remaining operations in the batch
        if batch_count > 0:
            batch.commit()
            print(f"Committed final batch of {batch_count} passenger volume records")
        
        # Create aggregated view for easier querying
        summarize_passenger_volume(records_ref, doc_ref)
            
        print(f"Successfully stored {len(records)} passenger volume records for {filename}")
    except Exception as e:
        print(f"Error storing bus passenger volume data: {e}")

def summarize_passenger_volume(records_ref, doc_ref):
    """
    Creates aggregated summaries of passenger volume data.
    
    Args:
        records_ref: Firestore reference to the records subcollection
        doc_ref: Firestore reference to the parent document
    """
    try:
        # This function would typically query the stored records,
        # compute aggregations (e.g., by bus stop, time of day, weekday/weekend),
        # and store the results in the parent document or a separate subcollection.
        
        # For example:
        # - Total volume by bus stop
        # - Peak hour volume
        # - Weekday vs weekend patterns
        
        # This is a placeholder for the aggregation logic
        # The actual implementation would depend on the CSV structure from LTA
        
        # As a basic example:
        records = records_ref.limit(10000).get()
        
        # Example aggregation (assumes certain fields exist)
        by_stop = {}
        for record in records:
            data = record.to_dict()
            stop_code = data.get("PT_CODE", "unknown")
            
            if stop_code not in by_stop:
                by_stop[stop_code] = {
                    "total_tap_in": 0,
                    "total_tap_out": 0,
                    "weekday_volume": 0,
                    "weekend_volume": 0
                }
            
            # Assuming these fields exist - adjust based on actual data structure
            by_stop[stop_code]["total_tap_in"] += data.get("TAP_IN_VOL", 0)
            by_stop[stop_code]["total_tap_out"] += data.get("TAP_OUT_VOL", 0)
            
            if data.get("DAY_TYPE") == "WEEKDAY":
                by_stop[stop_code]["weekday_volume"] += data.get("TOTAL_TRIPS", 0)
            else:
                by_stop[stop_code]["weekend_volume"] += data.get("TOTAL_TRIPS", 0)
        
        # Store the aggregation in the parent document
        doc_ref.update({
            "aggregated_by_stop": by_stop,
            "aggregation_timestamp": firestore.SERVER_TIMESTAMP
        })
        
        print(f"Created aggregated view for {len(by_stop)} bus stops")
    except Exception as e:
        print(f"Error creating passenger volume summary: {e}")

def store_bus_od_passenger_volume(records, date, filename, chunk_index=0):
    """
    Stores bus origin-destination passenger volume data in Firestore.
    
    Args:
        records (list): List of dictionaries with OD passenger volume data
        date (str): Date string in format YYYYMM
        filename (str): Original filename for reference
        chunk_index (int): Index of the chunk when processing large files
    """
    try:
        # Create a reference to the bus OD passenger volume collection
        bus_od_pv_ref = db.collection("bus_od_passenger_volume")
        
        # Create a document for this date/file
        doc_id = f"{date}_{os.path.splitext(filename)[0]}"
        doc_ref = bus_od_pv_ref.document(doc_id)
        
        # Store or update metadata about this file
        metadata = {
            "date": date,
            "filename": filename,
            "last_chunk_processed": chunk_index,
            "last_updated": firestore.SERVER_TIMESTAMP
        }
        
        # Use set with merge to update or create
        doc_ref.set(metadata, merge=True)
        
        # Get the latest record count if it exists
        doc_snapshot = doc_ref.get()
        record_count = 0
        if doc_snapshot.exists:
            record_count = doc_snapshot.get("record_count", 0)
        
        # Store records in subcollection to avoid document size limits
        chunk_ref = doc_ref.collection("chunks").document(f"chunk_{chunk_index}")
        
        # Store chunk metadata
        chunk_metadata = {
            "chunk_index": chunk_index,
            "record_count": len(records),
            "processed_at": firestore.SERVER_TIMESTAMP
        }
        chunk_ref.set(chunk_metadata)
        
        # Store records in a nested subcollection
        records_ref = chunk_ref.collection("records")
        
        # Use batched writes for better performance
        batch = db.batch()
        batch_count = 0
        max_batch_size = 500
        
        for i, record in enumerate(records):
            # Use record index as document ID (or you can use a more specific ID if available)
            record_id = str(i)
            record_ref = records_ref.document(record_id)
            
            # Add timestamp to record
            record["imported_at"] = firestore.SERVER_TIMESTAMP
            
            # Add to batch
            batch.set(record_ref, record)
            batch_count += 1
            
            # If batch size reaches max, commit and start a new batch
            if batch_count >= max_batch_size:
                batch.commit()
                print(f"Committed batch of {batch_count} OD passenger volume records")
                batch = db.batch()
                batch_count = 0
        
        # Commit any remaining operations in the batch
        if batch_count > 0:
            batch.commit()
            print(f"Committed final batch of {batch_count} OD passenger volume records")
        
        # Update the parent document with new record count
        doc_ref.update({
            "record_count": record_count + len(records),
            "last_updated": firestore.SERVER_TIMESTAMP
        })
        
        # If this is the first chunk, start the aggregation process
        if chunk_index == 0:
            # Schedule aggregation or start it on a background task
            # For simplicity, we'll just call it directly here
            summarize_od_passenger_volume(doc_ref)
            
        print(f"Successfully stored {len(records)} OD passenger volume records for {filename} (chunk {chunk_index})")
    except Exception as e:
        print(f"Error storing bus OD passenger volume data: {e}")

def summarize_od_passenger_volume(doc_ref):
    """
    Creates aggregated summaries of origin-destination passenger volume data.
    
    Args:
        doc_ref: Firestore reference to the parent document
    """
    try:
        # This is a placeholder for the aggregation logic
        # The actual implementation would depend on the CSV structure from LTA
        
        # This would typically:
        # 1. Query all chunks and their records
        # 2. Aggregate by origin-destination pairs
        # 3. Create summaries like:
        #    - Top OD pairs by volume
        #    - Busiest origin stops
        #    - Busiest destination stops
        #    - Weekday vs weekend patterns
        
        # For a simple implementation, we'll focus on the top OD pairs
        # This code assumes specific fields exist - adjust based on actual data
        
        # Set an aggregation in progress flag
        doc_ref.update({"aggregation_in_progress": True})
        
        # Get all chunks
        chunks = doc_ref.collection("chunks").stream()
        
        # Aggregate data across all chunks
        od_pairs = {}
        
        for chunk in chunks:
            chunk_id = chunk.id
            records = doc_ref.collection("chunks").document(chunk_id).collection("records").stream()
            
            for record in records:
                data = record.to_dict()
                
                # Create a key for the OD pair
                origin = data.get("ORIGIN_PT_CODE", "unknown")
                destination = data.get("DESTINATION_PT_CODE", "unknown")
                od_key = f"{origin}_{destination}"
                
                if od_key not in od_pairs:
                    od_pairs[od_key] = {
                        "origin": origin,
                        "destination": destination,
                        "weekday_trips": 0,
                        "weekend_trips": 0,
                        "total_trips": 0
                    }
                
                # Update the aggregated data
                if data.get("DAY_TYPE") == "WEEKDAY":
                    od_pairs[od_key]["weekday_trips"] += data.get("TOTAL_TRIPS", 0)
                else:
                    od_pairs[od_key]["weekend_trips"] += data.get("TOTAL_TRIPS", 0)
                
                od_pairs[od_key]["total_trips"] += data.get("TOTAL_TRIPS", 0)
        
        # Convert to a list and sort by total trips
        od_pairs_list = list(od_pairs.values())
        od_pairs_list.sort(key=lambda x: x["total_trips"], reverse=True)
        
        # Take the top 1000 pairs (adjust as needed)
        top_pairs = od_pairs_list[:1000]
        
        # Store the aggregation
        doc_ref.update({
            "top_od_pairs": top_pairs,
            "aggregation_timestamp": firestore.SERVER_TIMESTAMP,
            "aggregation_in_progress": False
        })
        
        print(f"Created aggregated view with {len(top_pairs)} top OD pairs")
    except Exception as e:
        # Make sure to clear the in-progress flag if there's an error
        doc_ref.update({"aggregation_in_progress": False})
        print(f"Error creating OD passenger volume summary: {e}")

def store_train_od_passenger_volume(records, date, filename, chunk_index=0):
    """
    Stores train origin-destination passenger volume data in Firestore.
    
    Args:
        records (list): List of dictionaries with OD passenger volume data
        date (str): Date string in format YYYYMM
        filename (str): Original filename for reference
        chunk_index (int): Index of the chunk when processing large files
    """
    try:
        # Create a reference to the train OD passenger volume collection
        train_od_pv_ref = db.collection("train_od_passenger_volume")
        
        # Create a document for this date/file
        doc_id = f"{date}_{os.path.splitext(filename)[0]}"
        doc_ref = train_od_pv_ref.document(doc_id)
        
        # Store or update metadata about this file
        metadata = {
            "date": date,
            "filename": filename,
            "last_chunk_processed": chunk_index,
            "last_updated": firestore.SERVER_TIMESTAMP
        }
        
        # Use set with merge to update or create
        doc_ref.set(metadata, merge=True)
        
        # Get the latest record count if it exists
        doc_snapshot = doc_ref.get()
        record_count = 0
        if doc_snapshot.exists:
            record_count = doc_snapshot.get("record_count", 0)
        
        # Store records in subcollection to avoid document size limits
        chunk_ref = doc_ref.collection("chunks").document(f"chunk_{chunk_index}")
        
        # Store chunk metadata
        chunk_metadata = {
            "chunk_index": chunk_index,
            "record_count": len(records),
            "processed_at": firestore.SERVER_TIMESTAMP
        }
        chunk_ref.set(chunk_metadata)
        
        # Store records in a nested subcollection
        records_ref = chunk_ref.collection("records")
        
        # Use batched writes for better performance
        batch = db.batch()
        batch_count = 0
        max_batch_size = 500
        
        for i, record in enumerate(records):
            # Use record index as document ID (or you can use a more specific ID if available)
            record_id = str(i)
            record_ref = records_ref.document(record_id)
            
            # Add timestamp to record
            record["imported_at"] = firestore.SERVER_TIMESTAMP
            
            # Add to batch
            batch.set(record_ref, record)
            batch_count += 1
            
            # If batch size reaches max, commit and start a new batch
            if batch_count >= max_batch_size:
                batch.commit()
                print(f"Committed batch of {batch_count} train OD passenger volume records")
                batch = db.batch()
                batch_count = 0
        
        # Commit any remaining operations in the batch
        if batch_count > 0:
            batch.commit()
            print(f"Committed final batch of {batch_count} train OD passenger volume records")
        
        # Update the parent document with new record count
        doc_ref.update({
            "record_count": record_count + len(records),
            "last_updated": firestore.SERVER_TIMESTAMP
        })
        
        # If this is the first chunk, start the aggregation process
        if chunk_index == 0:
            # Schedule aggregation or start it on a background task
            # For simplicity, we'll just call it directly here
            summarize_train_od_passenger_volume(doc_ref)
            
        print(f"Successfully stored {len(records)} train OD passenger volume records for {filename} (chunk {chunk_index})")
    except Exception as e:
        print(f"Error storing train OD passenger volume data: {e}")

def summarize_train_od_passenger_volume(doc_ref):
    """
    Creates aggregated summaries of train origin-destination passenger volume data.
    
    Args:
        doc_ref: Firestore reference to the parent document
    """
    try:
        # Set an aggregation in progress flag
        doc_ref.update({"aggregation_in_progress": True})
        
        # Get all chunks
        chunks = doc_ref.collection("chunks").stream()
        
        # Aggregate data across all chunks
        od_pairs = {}
        
        for chunk in chunks:
            chunk_id = chunk.id
            records = doc_ref.collection("chunks").document(chunk_id).collection("records").stream()
            
            for record in records:
                data = record.to_dict()
                
                # Create a key for the OD pair
                origin = data.get("ORIGIN_PT_CODE", "unknown")
                destination = data.get("DESTINATION_PT_CODE", "unknown")
                od_key = f"{origin}_{destination}"
                
                if od_key not in od_pairs:
                    od_pairs[od_key] = {
                        "origin": origin,
                        "destination": destination,
                        "weekday_trips": 0,
                        "weekend_trips": 0,
                        "total_trips": 0
                    }
                
                # Update the aggregated data
                if data.get("DAY_TYPE") == "WEEKDAY":
                    od_pairs[od_key]["weekday_trips"] += data.get("TOTAL_TRIPS", 0)
                else:
                    od_pairs[od_key]["weekend_trips"] += data.get("TOTAL_TRIPS", 0)
                
                od_pairs[od_key]["total_trips"] += data.get("TOTAL_TRIPS", 0)
        
        # Convert to a list and sort by total trips
        od_pairs_list = list(od_pairs.values())
        od_pairs_list.sort(key=lambda x: x["total_trips"], reverse=True)
        
        # Take the top 1000 pairs (adjust as needed)
        top_pairs = od_pairs_list[:1000]
        
        # Store the aggregation
        doc_ref.update({
            "top_od_pairs": top_pairs,
            "aggregation_timestamp": firestore.SERVER_TIMESTAMP,
            "aggregation_in_progress": False
        })
        
        print(f"Created aggregated view with {len(top_pairs)} top train OD pairs")
    except Exception as e:
        # Make sure to clear the in-progress flag if there's an error
        doc_ref.update({"aggregation_in_progress": False})
        print(f"Error creating train OD passenger volume summary: {e}")

def store_train_passenger_volume(records, date, filename, chunk_index=0):
    """
    Stores train station passenger volume data in Firestore.
    
    Args:
        records (list): List of dictionaries with train passenger volume data
        date (str): Date string in format YYYYMM
        filename (str): Original filename for reference
        chunk_index (int): Index of the chunk when processing large files
    """
    try:
        # Create a reference to the train passenger volume collection
        train_pv_ref = db.collection("train_passenger_volume")
        
        # Create a document for this date/file
        doc_id = f"{date}_{os.path.splitext(filename)[0]}"
        doc_ref = train_pv_ref.document(doc_id)
        
        # Store or update metadata about this file
        metadata = {
            "date": date,
            "filename": filename,
            "last_chunk_processed": chunk_index,
            "last_updated": firestore.SERVER_TIMESTAMP
        }
        
        # Use set with merge to update or create
        doc_ref.set(metadata, merge=True)
        
        # Get the latest record count if it exists
        doc_snapshot = doc_ref.get()
        record_count = 0
        if doc_snapshot.exists:
            record_count = doc_snapshot.get("record_count", 0)
        
        # Store records in subcollection to avoid document size limits
        chunk_ref = doc_ref.collection("chunks").document(f"chunk_{chunk_index}")
        
        # Store chunk metadata
        chunk_metadata = {
            "chunk_index": chunk_index,
            "record_count": len(records),
            "processed_at": firestore.SERVER_TIMESTAMP
        }
        chunk_ref.set(chunk_metadata)
        
        # Store records in a nested subcollection
        records_ref = chunk_ref.collection("records")
        
        # Use batched writes for better performance
        batch = db.batch()
        batch_count = 0
        max_batch_size = 500
        
        for i, record in enumerate(records):
            # Use record index as document ID (or you can use a more specific ID if available)
            record_id = str(i)
            record_ref = records_ref.document(record_id)
            
            # Add timestamp to record
            record["imported_at"] = firestore.SERVER_TIMESTAMP
            
            # Add to batch
            batch.set(record_ref, record)
            batch_count += 1
            
            # If batch size reaches max, commit and start a new batch
            if batch_count >= max_batch_size:
                batch.commit()
                print(f"Committed batch of {batch_count} train passenger volume records")
                batch = db.batch()
                batch_count = 0
        
        # Commit any remaining operations in the batch
        if batch_count > 0:
            batch.commit()
            print(f"Committed final batch of {batch_count} train passenger volume records")
        
        # Update the parent document with new record count
        doc_ref.update({
            "record_count": record_count + len(records),
            "last_updated": firestore.SERVER_TIMESTAMP
        })
        
        # If this is the first chunk, start the aggregation process
        if chunk_index == 0:
            # Schedule aggregation or start it on a background task
            # For simplicity, we'll just call it directly here
            summarize_train_passenger_volume(doc_ref)
            
        print(f"Successfully stored {len(records)} train passenger volume records for {filename} (chunk {chunk_index})")
    except Exception as e:
        print(f"Error storing train passenger volume data: {e}")

def summarize_train_passenger_volume(doc_ref):
    """
    Creates aggregated summaries of train station passenger volume data.
    
    Args:
        doc_ref: Firestore reference to the parent document
    """
    try:
        # Set an aggregation in progress flag
        doc_ref.update({"aggregation_in_progress": True})
        
        # Get all chunks
        chunks = doc_ref.collection("chunks").stream()
        
        # Aggregate data across all chunks
        station_volumes = {}
        
        for chunk in chunks:
            chunk_id = chunk.id
            records = doc_ref.collection("chunks").document(chunk_id).collection("records").stream()
            
            for record in records:
                data = record.to_dict()
                
                # Create a key for the station
                station_code = data.get("PT_CODE", "unknown")
                
                if station_code not in station_volumes:
                    station_volumes[station_code] = {
                        "station_code": station_code,
                        "station_name": data.get("PT_NAME", "Unknown Station"),
                        "weekday_tap_in": 0,
                        "weekday_tap_out": 0,
                        "weekend_tap_in": 0,
                        "weekend_tap_out": 0,
                        "total_tap_in": 0,
                        "total_tap_out": 0
                    }
                
                # Update the aggregated data
                is_weekday = data.get("DAY_TYPE") == "WEEKDAY"
                tap_in = data.get("TAP_IN_VOL", 0)
                tap_out = data.get("TAP_OUT_VOL", 0)
                
                if is_weekday:
                    station_volumes[station_code]["weekday_tap_in"] += tap_in
                    station_volumes[station_code]["weekday_tap_out"] += tap_out
                else:
                    station_volumes[station_code]["weekend_tap_in"] += tap_in
                    station_volumes[station_code]["weekend_tap_out"] += tap_out
                
                # Update totals
                station_volumes[station_code]["total_tap_in"] += tap_in
                station_volumes[station_code]["total_tap_out"] += tap_out
        
        # Convert to a list and sort by total volume
        station_list = list(station_volumes.values())
        station_list.sort(key=lambda x: (x["total_tap_in"] + x["total_tap_out"]), reverse=True)
        
        # Add overall totals for the entire dataset
        total_stats = {
            "weekday_tap_in_total": sum(s["weekday_tap_in"] for s in station_list),
            "weekday_tap_out_total": sum(s["weekday_tap_out"] for s in station_list),
            "weekend_tap_in_total": sum(s["weekend_tap_in"] for s in station_list),
            "weekend_tap_out_total": sum(s["weekend_tap_out"] for s in station_list),
            "total_tap_in": sum(s["total_tap_in"] for s in station_list),
            "total_tap_out": sum(s["total_tap_out"] for s in station_list),
            "station_count": len(station_list)
        }
        
        # Store the aggregation
        doc_ref.update({
            "station_volumes": station_list,
            "total_statistics": total_stats,
            "aggregation_timestamp": firestore.SERVER_TIMESTAMP,
            "aggregation_in_progress": False
        })
        
        print(f"Created aggregated view for {len(station_list)} train stations")
    except Exception as e:
        # Make sure to clear the in-progress flag if there's an error
        doc_ref.update({"aggregation_in_progress": False})
        print(f"Error creating train passenger volume summary: {e}")

def store_train_service_alerts(alerts):
    """
    Stores train service alerts data from LTA DataMall in Firestore.
    
    Args:
        alerts (list): List of train service alert objects
    """
    try:
        # Create a reference to the train service alerts collection
        train_alerts_ref = db.collection("train_service_alerts")
        
        # Create a batch for better performance
        batch = db.batch()
        batch_count = 0
        max_batch_size = 500
        
        # Current timestamp for tracking when the alert was fetched
        current_timestamp = firestore.SERVER_TIMESTAMP
        
        # Get existing alerts for comparison
        existing_alerts = {}
        for alert_doc in train_alerts_ref.stream():
            existing_alerts[alert_doc.id] = alert_doc.to_dict()
        
        # Track active alerts for this update
        active_alert_ids = []
        
        for alert in alerts:
            if not isinstance(alert, dict):
                continue
                
            # Create a unique ID for this alert
            # Using Line and timestamp from Message.CreatedDate if available
            line = alert.get("Line", "unknown")
            message = alert.get("Message", {})
            
            if isinstance(message, dict) and "CreatedDate" in message:
                created_date = message.get("CreatedDate", "")
                alert_id = f"{line}_{created_date.replace(' ', '_').replace(':', '-').replace('.', '-')}"
            else:
                # If no created date, use current timestamp
                import uuid
                alert_id = f"{line}_{str(uuid.uuid4())[:8]}"
            
            # Add the alert ID to our active list
            active_alert_ids.append(alert_id)
            
            # Prepare the data to store
            alert_data = {
                "status": alert.get("Status", 1),  # 1 for Normal, 2 for Disrupted
                "line": line,
                "direction": alert.get("Direction", ""),
                "stations": alert.get("Stations", "").split(",") if alert.get("Stations") else [],
                "free_public_bus": alert.get("FreePublicBus", "").split(",") if alert.get("FreePublicBus") else [],
                "free_mrt_shuttle": alert.get("FreeMRTShuttle", "").split(",") if alert.get("FreeMRTShuttle") else [],
                "mrt_shuttle_direction": alert.get("MRTShuttleDirection", ""),
                "message_content": message.get("Content", "") if isinstance(message, dict) else message,
                "message_created_date": message.get("CreatedDate", "") if isinstance(message, dict) else "",
                "last_updated": current_timestamp,
                "is_active": True
            }
            
            # Check if alert exists and needs update
            if alert_id in existing_alerts:
                existing_alert = existing_alerts[alert_id]
                
                # Only update if there are changes (excluding last_updated)
                needs_update = False
                for key, value in alert_data.items():
                    if key != "last_updated" and key != "is_active" and existing_alert.get(key) != value:
                        needs_update = True
                        break
                
                if needs_update:
                    doc_ref = train_alerts_ref.document(alert_id)
                    batch.update(doc_ref, alert_data)
                    batch_count += 1
            else:
                # New alert
                doc_ref = train_alerts_ref.document(alert_id)
                batch.set(doc_ref, alert_data)
                batch_count += 1
            
            # If batch size reaches max, commit and start a new batch
            if batch_count >= max_batch_size:
                batch.commit()
                print(f"Committed batch of {batch_count} train service alerts")
                batch = db.batch()
                batch_count = 0
        
        # Mark alerts as inactive if they're no longer in the API response
        for alert_id, alert_data in existing_alerts.items():
            if alert_id not in active_alert_ids and alert_data.get("is_active", True):
                doc_ref = train_alerts_ref.document(alert_id)
                batch.update(doc_ref, {
                    "is_active": False,
                    "deactivated_at": current_timestamp
                })
                batch_count += 1
                
                # If batch size reaches max, commit and start a new batch
                if batch_count >= max_batch_size:
                    batch.commit()
                    print(f"Committed batch of {batch_count} train service alert updates")
                    batch = db.batch()
                    batch_count = 0
        
        # Commit any remaining operations in the batch
        if batch_count > 0:
            batch.commit()
            print(f"Committed final batch of {batch_count} train service alert operations")
        
        # Create a historical record of this update
        store_train_alert_history(alerts, active_alert_ids)
        
        print(f"Successfully processed {len(alerts)} train service alerts")
    except Exception as e:
        print(f"Error storing train service alerts: {e}")

def store_train_alert_history(alerts, active_alert_ids):
    """
    Stores a historical record of train service alerts for tracking over time.
    
    Args:
        alerts (list): The list of current alerts
        active_alert_ids (list): List of active alert IDs
    """
    try:
        # Create a reference to the train alerts history collection
        history_ref = db.collection("train_alerts_history")
        
        # Create a timestamp-based document ID for this snapshot
        from datetime import datetime
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        doc_id = f"snapshot_{timestamp}"
        
        # Prepare the data
        history_data = {
            "timestamp": firestore.SERVER_TIMESTAMP,
            "alert_count": len(alerts),
            "active_alert_ids": active_alert_ids,
            "has_disruptions": any(alert.get("Status") == 2 for alert in alerts if isinstance(alert, dict)),
            "disrupted_lines": [alert.get("Line") for alert in alerts if isinstance(alert, dict) and alert.get("Status") == 2]
        }
        
        # Store the snapshot
        history_ref.document(doc_id).set(history_data)
        
        print(f"Stored historical record of train alerts at {timestamp}")
    except Exception as e:
        print(f"Error storing train alert history: {e}")

def get_active_train_disruptions():
    """
    Retrieves all active train service disruptions.
    
    Returns:
        list: List of active train service disruption objects
    """
    try:
        train_alerts_ref = db.collection("train_service_alerts")
        
        # Query for active alerts with disruption status
        query = train_alerts_ref.where("is_active", "==", True).where("status", "==", 2)
        results = query.stream()
        
        disruptions = []
        for doc in results:
            alert = doc.to_dict()
            alert["id"] = doc.id
            disruptions.append(alert)
            
        return disruptions
    except Exception as e:
        print(f"Error retrieving train disruptions: {e}")
        return []

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

def store_faulty_traffic_lights(faulty_lights):
    """
    Stores faulty traffic lights data from LTA DataMall in Firestore.
    
    Args:
        faulty_lights (list): List of faulty traffic light objects
    """
    try:
        # Create a reference to the faulty traffic lights collection
        traffic_lights_ref = db.collection("faulty_traffic_lights")
        
        # Create a batch for better performance
        batch = db.batch()
        batch_count = 0
        max_batch_size = 500
        
        # Current timestamp for tracking when the data was fetched
        current_timestamp = firestore.SERVER_TIMESTAMP
        
        # Get existing faulty lights for comparison
        existing_lights = {}
        for light_doc in traffic_lights_ref.stream():
            existing_lights[light_doc.id] = light_doc.to_dict()
        
        # Track active faults for this update
        active_fault_ids = []
        
        for light in faulty_lights:
            if not isinstance(light, dict):
                continue
                
            # Use AlarmID as the document ID
            alarm_id = str(light.get("AlarmID", ""))
            node_id = str(light.get("NodeID", ""))
            
            if not alarm_id:
                # If no AlarmID, use NodeID with timestamp
                from datetime import datetime
                timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
                alarm_id = f"{node_id}_{timestamp}"
            
            # Add to our active list
            active_fault_ids.append(alarm_id)
            
            # Convert dates to proper format if they exist
            start_date = light.get("StartDate", "")
            end_date = light.get("EndDate", "")
            
            # Convert to Firestore timestamp if possible
            start_timestamp = None
            end_timestamp = None
            
            if start_date:
                try:
                    from datetime import datetime
                    # Parse the datetime string
                    start_dt = datetime.strptime(start_date, "%Y-%m-%d %H:%M:%S.%f")
                    start_timestamp = firestore.Timestamp.from_datetime(start_dt)
                except Exception as e:
                    print(f"Error parsing start date {start_date}: {e}")
            
            if end_date:
                try:
                    from datetime import datetime
                    # Parse the datetime string
                    end_dt = datetime.strptime(end_date, "%Y-%m-%d %H:%M:%S.%f")
                    end_timestamp = firestore.Timestamp.from_datetime(end_dt)
                except Exception as e:
                    print(f"Error parsing end date {end_date}: {e}")
            
            # Determine if this is a scheduled maintenance
            is_scheduled = bool(end_date)
            
            # Prepare the data to store
            light_data = {
                "alarm_id": alarm_id,
                "node_id": node_id,
                "type": light.get("Type", ""),
                "type_description": "Blackout" if light.get("Type") == 4 else "Flashing Yellow" if light.get("Type") == 13 else "Unknown",
                "start_date": start_date,
                "start_timestamp": start_timestamp,
                "end_date": end_date,
                "end_timestamp": end_timestamp,
                "message": light.get("Message", ""),
                "is_scheduled": is_scheduled,
                "last_updated": current_timestamp,
                "is_active": True
            }
            
            # Parse location information from message if available
            message = light.get("Message", "")
            if message:
                # Try to extract location from the message
                # Example: "Flashing Yellow at Bedok North Interchange/Bedok North Street 1 Junc."
                location_parts = message.split(" at ")
                if len(location_parts) > 1:
                    light_data["location"] = location_parts[1].strip()
            
            # Check if fault exists and needs update
            if alarm_id in existing_lights:
                existing_light = existing_lights[alarm_id]
                
                # Only update if there are changes (excluding last_updated)
                needs_update = False
                for key, value in light_data.items():
                    if key != "last_updated" and existing_light.get(key) != value:
                        needs_update = True
                        break
                
                if needs_update:
                    doc_ref = traffic_lights_ref.document(alarm_id)
                    batch.update(doc_ref, light_data)
                    batch_count += 1
            else:
                # New fault
                doc_ref = traffic_lights_ref.document(alarm_id)
                batch.set(doc_ref, light_data)
                batch_count += 1
            
            # If batch size reaches max, commit and start a new batch
            if batch_count >= max_batch_size:
                batch.commit()
                print(f"Committed batch of {batch_count} faulty traffic light entries")
                batch = db.batch()
                batch_count = 0
        
        # Mark faults as resolved if they're no longer in the API response
        for alarm_id, light_data in existing_lights.items():
            if alarm_id not in active_fault_ids and light_data.get("is_active", True):
                doc_ref = traffic_lights_ref.document(alarm_id)
                batch.update(doc_ref, {
                    "is_active": False,
                    "resolved_at": current_timestamp
                })
                batch_count += 1
                
                # If batch size reaches max, commit and start a new batch
                if batch_count >= max_batch_size:
                    batch.commit()
                    print(f"Committed batch of {batch_count} faulty traffic light updates")
                    batch = db.batch()
                    batch_count = 0
        
        # Commit any remaining operations in the batch
        if batch_count > 0:
            batch.commit()
            print(f"Committed final batch of {batch_count} faulty traffic light operations")
        
        # Store a historical record
        store_traffic_light_history(faulty_lights, active_fault_ids)
        
        print(f"Successfully processed {len(faulty_lights)} faulty traffic lights")
    except Exception as e:
        print(f"Error storing faulty traffic lights: {e}")

def store_traffic_light_history(faulty_lights, active_fault_ids):
    """
    Stores a historical record of faulty traffic lights for tracking over time.
    
    Args:
        faulty_lights (list): The list of current faulty traffic lights
        active_fault_ids (list): List of active fault IDs
    """
    try:
        # Create a reference to the traffic lights history collection
        history_ref = db.collection("traffic_lights_history")
        
        # Create a timestamp-based document ID for this snapshot
        from datetime import datetime
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        doc_id = f"snapshot_{timestamp}"
        
        # Count faults by type
        blackout_count = 0
        flashing_yellow_count = 0
        
        for light in faulty_lights:
            if isinstance(light, dict):
                if light.get("Type") == 4:
                    blackout_count += 1
                elif light.get("Type") == 13:
                    flashing_yellow_count += 1
        
        # Prepare the data
        history_data = {
            "timestamp": firestore.SERVER_TIMESTAMP,
            "fault_count": len(faulty_lights),
            "active_fault_ids": active_fault_ids,
            "blackout_count": blackout_count,
            "flashing_yellow_count": flashing_yellow_count
        }
        
        # Store the snapshot
        history_ref.document(doc_id).set(history_data)
        
        print(f"Stored historical record of traffic light faults at {timestamp}")
    except Exception as e:
        print(f"Error storing traffic light fault history: {e}")

def get_active_faulty_traffic_lights(type_filter=None):
    """
    Retrieves all active faulty traffic lights, optionally filtered by type.
    
    Args:
        type_filter (int, optional): Filter by fault type (4 for Blackout, 13 for Flashing Yellow)
    
    Returns:
        list: List of active faulty traffic light objects
    """
    try:
        traffic_lights_ref = db.collection("faulty_traffic_lights")
        
        # Base query for active faults
        query = traffic_lights_ref.where("is_active", "==", True)
        
        # Add type filter if specified
        if type_filter is not None:
            query = query.where("type", "==", type_filter)
            
        # Execute query
        results = query.stream()
        
        faults = []
        for doc in results:
            fault = doc.to_dict()
            fault["id"] = doc.id
            faults.append(fault)
            
        return faults
    except Exception as e:
        print(f"Error retrieving faulty traffic lights: {e}")
        return []

def store_planned_road_openings(road_openings):
    """
    Stores planned road openings data from LTA DataMall in Firestore.
    
    Args:
        road_openings (list): List of planned road opening objects
    """
    try:
        # Create a reference to the planned road openings collection
        road_openings_ref = db.collection("planned_road_openings")
        
        # Create a batch for better performance
        batch = db.batch()
        batch_count = 0
        max_batch_size = 500
        
        # Current timestamp for tracking when the data was fetched
        current_timestamp = firestore.SERVER_TIMESTAMP
        
        # Get existing road openings for comparison
        existing_openings = {}
        for opening_doc in road_openings_ref.stream():
            existing_openings[opening_doc.id] = opening_doc.to_dict()
        
        # Track active road openings for this update
        active_opening_ids = []
        
        for opening in road_openings:
            if not isinstance(opening, dict):
                continue
                
            # Use EventID as the document ID
            event_id = str(opening.get("EventID", ""))
            
            if not event_id:
                # If no EventID, generate one based on road name and dates
                road_name = opening.get("RoadName", "unknown")
                start_date = opening.get("StartDate", "")
                import re
                # Remove special characters and spaces
                safe_road_name = re.sub(r'[^a-zA-Z0-9]', '', road_name)
                event_id = f"{safe_road_name}_{start_date}"
            
            # Add to our active list
            active_opening_ids.append(event_id)
            
            # Convert dates to proper format if they exist
            start_date = opening.get("StartDate", "")
            end_date = opening.get("EndDate", "")
            
            # Convert to Firestore timestamp if possible
            start_timestamp = None
            end_timestamp = None
            
            if start_date:
                try:
                    from datetime import datetime
                    # Parse the date string
                    start_dt = datetime.strptime(start_date, "%Y-%m-%d")
                    start_timestamp = firestore.Timestamp.from_datetime(start_dt)
                except Exception as e:
                    print(f"Error parsing start date {start_date}: {e}")
            
            if end_date:
                try:
                    from datetime import datetime
                    # Parse the date string
                    end_dt = datetime.strptime(end_date, "%Y-%m-%d")
                    end_timestamp = firestore.Timestamp.from_datetime(end_dt)
                except Exception as e:
                    print(f"Error parsing end date {end_date}: {e}")
            
            # Calculate status based on current date and start/end dates
            from datetime import datetime
            current_date = datetime.now().date()
            
            status = "scheduled"  # Default status
            
            if start_timestamp and end_timestamp:
                start_date_obj = start_timestamp.datetime.date()
                end_date_obj = end_timestamp.datetime.date()
                
                if current_date > end_date_obj:
                    status = "completed"
                elif current_date >= start_date_obj:
                    status = "in_progress"
            
            # Prepare the data to store
            opening_data = {
                "event_id": event_id,
                "start_date": start_date,
                "start_timestamp": start_timestamp,
                "end_date": end_date,
                "end_timestamp": end_timestamp,
                "service_department": opening.get("SvcDept", ""),
                "road_name": opening.get("RoadName", ""),
                "other_info": opening.get("Other", ""),
                "status": status,
                "last_updated": current_timestamp,
                "is_active": True
            }
            
            # Extract contact information if available
            other_info = opening.get("Other", "")
            if other_info and "call" in other_info.lower():
                import re
                # Look for phone numbers in the format
                phone_match = re.search(r'\d{8}', other_info)
                if phone_match:
                    opening_data["contact_number"] = phone_match.group(0)
            
            # Check if opening exists and needs update
            if event_id in existing_openings:
                existing_opening = existing_openings[event_id]
                
                # Only update if there are changes (excluding last_updated)
                needs_update = False
                for key, value in opening_data.items():
                    if key != "last_updated" and existing_opening.get(key) != value:
                        needs_update = True
                        break
                
                if needs_update:
                    doc_ref = road_openings_ref.document(event_id)
                    batch.update(doc_ref, opening_data)
                    batch_count += 1
            else:
                # New road opening
                doc_ref = road_openings_ref.document(event_id)
                batch.set(doc_ref, opening_data)
                batch_count += 1
            
            # If batch size reaches max, commit and start a new batch
            if batch_count >= max_batch_size:
                batch.commit()
                print(f"Committed batch of {batch_count} planned road opening entries")
                batch = db.batch()
                batch_count = 0
        
        # Mark road openings as inactive if they're no longer in the API response
        for event_id, opening_data in existing_openings.items():
            if event_id not in active_opening_ids and opening_data.get("is_active", True):
                doc_ref = road_openings_ref.document(event_id)
                batch.update(doc_ref, {
                    "is_active": False,
                    "status": "completed",
                    "completed_at": current_timestamp
                })
                batch_count += 1
                
                # If batch size reaches max, commit and start a new batch
                if batch_count >= max_batch_size:
                    batch.commit()
                    print(f"Committed batch of {batch_count} planned road opening updates")
                    batch = db.batch()
                    batch_count = 0
        
        # Commit any remaining operations in the batch
        if batch_count > 0:
            batch.commit()
            print(f"Committed final batch of {batch_count} planned road opening operations")
        
        print(f"Successfully processed {len(road_openings)} planned road openings")
    except Exception as e:
        print(f"Error storing planned road openings: {e}")

def get_road_openings(status=None):
    """
    Retrieves planned road openings, optionally filtered by status.
    
    Args:
        status (str, optional): Filter by status ('scheduled', 'in_progress', 'completed')
    
    Returns:
        list: List of road opening objects
    """
    try:
        road_openings_ref = db.collection("planned_road_openings")
        
        # Base query for active road openings
        query = road_openings_ref.where("is_active", "==", True)
        
        # Add status filter if specified
        if status:
            query = query.where("status", "==", status)
            
        # Execute query
        results = query.stream()
        
        openings = []
        for doc in results:
            opening = doc.to_dict()
            opening["id"] = doc.id
            openings.append(opening)
            
        return openings
    except Exception as e:
        print(f"Error retrieving road openings: {e}")
        return []

def store_approved_road_works(road_works):
    """
    Stores approved road works data from LTA DataMall in Firestore.
    
    Args:
        road_works (list): List of approved road work objects
    """
    try:
        # Create a reference to the approved road works collection
        road_works_ref = db.collection("approved_road_works")
        
        # Create a batch for better performance
        batch = db.batch()
        batch_count = 0
        max_batch_size = 500
        
        # Current timestamp for tracking when the data was fetched
        current_timestamp = firestore.SERVER_TIMESTAMP
        
        # Get existing road works for comparison
        existing_works = {}
        for work_doc in road_works_ref.stream():
            existing_works[work_doc.id] = work_doc.to_dict()
        
        # Track active road works for this update
        active_work_ids = []
        
        for work in road_works:
            if not isinstance(work, dict):
                continue
                
            # Use EventID as the document ID
            event_id = str(work.get("EventID", ""))
            
            if not event_id:
                # If no EventID, generate one based on road name and dates
                road_name = work.get("RoadName", "unknown")
                start_date = work.get("StartDate", "")
                import re
                # Remove special characters and spaces
                safe_road_name = re.sub(r'[^a-zA-Z0-9]', '', road_name)
                event_id = f"{safe_road_name}_{start_date}"
            
            # Add to our active list
            active_work_ids.append(event_id)
            
            # Convert dates to proper format if they exist
            start_date = work.get("StartDate", "")
            end_date = work.get("EndDate", "")
            
            # Convert to Firestore timestamp if possible
            start_timestamp = None
            end_timestamp = None
            
            if start_date:
                try:
                    from datetime import datetime
                    # Parse the date string
                    start_dt = datetime.strptime(start_date, "%Y-%m-%d")
                    start_timestamp = firestore.Timestamp.from_datetime(start_dt)
                except Exception as e:
                    print(f"Error parsing start date {start_date}: {e}")
            
            if end_date:
                try:
                    from datetime import datetime
                    # Parse the date string
                    end_dt = datetime.strptime(end_date, "%Y-%m-%d")
                    end_timestamp = firestore.Timestamp.from_datetime(end_dt)
                except Exception as e:
                    print(f"Error parsing end date {end_date}: {e}")
            
            # Calculate status based on current date and start/end dates
            from datetime import datetime
            current_date = datetime.now().date()
            
            status = "scheduled"  # Default status
            
            if start_timestamp and end_timestamp:
                start_date_obj = start_timestamp.datetime.date()
                end_date_obj = end_timestamp.datetime.date()
                
                if current_date > end_date_obj:
                    status = "completed"
                elif current_date >= start_date_obj:
                    status = "in_progress"
            
            # Prepare the data to store
            work_data = {
                "event_id": event_id,
                "start_date": start_date,
                "start_timestamp": start_timestamp,
                "end_date": end_date,
                "end_timestamp": end_timestamp,
                "service_department": work.get("SvcDept", ""),
                "road_name": work.get("RoadName", ""),
                "other_info": work.get("Other", ""),
                "status": status,
                "last_updated": current_timestamp,
                "is_active": True
            }
            
            # Extract contact information if available
            other_info = work.get("Other", "")
            if other_info and "call" in other_info.lower():
                import re
                # Look for phone numbers in the format
                phone_match = re.search(r'\d{8}', other_info)
                if phone_match:
                    work_data["contact_number"] = phone_match.group(0)
            
            # Check if work exists and needs update
            if event_id in existing_works:
                existing_work = existing_works[event_id]
                
                # Only update if there are changes (excluding last_updated)
                needs_update = False
                for key, value in work_data.items():
                    if key != "last_updated" and existing_work.get(key) != value:
                        needs_update = True
                        break
                
                if needs_update:
                    doc_ref = road_works_ref.document(event_id)
                    batch.update(doc_ref, work_data)
                    batch_count += 1
            else:
                # New road work
                doc_ref = road_works_ref.document(event_id)
                batch.set(doc_ref, work_data)
                batch_count += 1
            
            # If batch size reaches max, commit and start a new batch
            if batch_count >= max_batch_size:
                batch.commit()
                print(f"Committed batch of {batch_count} approved road work entries")
                batch = db.batch()
                batch_count = 0
        
        # Mark road works as inactive if they're no longer in the API response
        for event_id, work_data in existing_works.items():
            if event_id not in active_work_ids and work_data.get("is_active", True):
                doc_ref = road_works_ref.document(event_id)
                batch.update(doc_ref, {
                    "is_active": False,
                    "status": "completed",
                    "completed_at": current_timestamp
                })
                batch_count += 1
                
                # If batch size reaches max, commit and start a new batch
                if batch_count >= max_batch_size:
                    batch.commit()
                    print(f"Committed batch of {batch_count} approved road work updates")
                    batch = db.batch()
                    batch_count = 0
        
        # Commit any remaining operations in the batch
        if batch_count > 0:
            batch.commit()
            print(f"Committed final batch of {batch_count} approved road work operations")
        
        print(f"Successfully processed {len(road_works)} approved road works")
    except Exception as e:
        print(f"Error storing approved road works: {e}")

def get_road_works(status=None):
    """
    Retrieves approved road works, optionally filtered by status.
    
    Args:
        status (str, optional): Filter by status ('scheduled', 'in_progress', 'completed')
    
    Returns:
        list: List of road work objects
    """
    try:
        road_works_ref = db.collection("approved_road_works")
        
        # Base query for active road works
        query = road_works_ref.where("is_active", "==", True)
        
        # Add status filter if specified
        if status:
            query = query.where("status", "==", status)
            
        # Execute query
        results = query.stream()
        
        works = []
        for doc in results:
            work = doc.to_dict()
            work["id"] = doc.id
            works.append(work)
            
        return works
    except Exception as e:
        print(f"Error retrieving road works: {e}")
        return []

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

def store_station_crowd_density(crowd_data, train_line):
    """
    Stores real-time MRT/LRT station crowdedness level data in Firestore.
    
    Args:
        crowd_data (list): List of station crowd density objects
        train_line (str): Code of train network line
    """
    try:
        # Create a reference to the station crowd density collection
        crowd_density_ref = db.collection("station_crowd_density")
        
        # Create a document for this train line
        line_doc_ref = crowd_density_ref.document(train_line)
        
        # Current timestamp for tracking when the data was fetched
        current_timestamp = firestore.SERVER_TIMESTAMP
        
        # Prepare the data to store
        line_data = {
            "train_line": train_line,
            "last_updated": current_timestamp,
            "stations": {}
        }
        
        # Mapping for crowd level values to more descriptive terms
        crowd_level_map = {
            "l": "low",
            "m": "moderate",
            "h": "high",
            "NA": "not_available"
        }
        
        # Process each station's crowd data
        for station_data in crowd_data:
            if not isinstance(station_data, dict):
                continue
                
            station_code = station_data.get("Station", "")
            
            if not station_code:
                continue
                
            # Convert timestamps if available
            start_time = station_data.get("StartTime", "")
            end_time = station_data.get("EndTime", "")
            
            start_timestamp = None
            end_timestamp = None
            
            if start_time:
                try:
                    from datetime import datetime
                    # Parse the ISO 8601 datetime string
                    start_dt = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
                    # Convert to Firestore timestamp
                    start_timestamp = firestore.Timestamp.from_datetime(start_dt)
                except Exception as e:
                    print(f"Error parsing start time {start_time}: {e}")
            
            if end_time:
                try:
                    from datetime import datetime
                    # Parse the ISO 8601 datetime string
                    end_dt = datetime.fromisoformat(end_time.replace('Z', '+00:00'))
                    # Convert to Firestore timestamp
                    end_timestamp = firestore.Timestamp.from_datetime(end_dt)
                except Exception as e:
                    print(f"Error parsing end time {end_time}: {e}")
            
            # Get the crowd level
            crowd_level = station_data.get("CrowdLevel", "NA")
            
            # Store data for this station
            line_data["stations"][station_code] = {
                "station_code": station_code,
                "start_time": start_time,
                "start_timestamp": start_timestamp,
                "end_time": end_time,
                "end_timestamp": end_timestamp,
                "crowd_level": crowd_level,
                "crowd_level_desc": crowd_level_map.get(crowd_level, "unknown")
            }
        
        # Store data for this train line
        line_doc_ref.set(line_data)
        
        # Also store historical data for analytics
        store_crowd_density_history(crowd_data, train_line)
        
        print(f"Successfully stored crowd density data for {train_line} with {len(line_data['stations'])} stations")
    except Exception as e:
        print(f"Error storing station crowd density: {e}")

def store_crowd_density_history(crowd_data, train_line):
    """
    Stores historical records of station crowd density for analytics.
    
    Args:
        crowd_data (list): List of station crowd density objects
        train_line (str): Code of train network line
    """
    try:
        # Create a reference to the crowd density history collection
        history_ref = db.collection("crowd_density_history")
        
        # Current timestamp for tracking when the data was fetched
        from datetime import datetime
        timestamp = datetime.now().strftime("%Y%m%d%H%M")
        doc_id = f"{train_line}_{timestamp}"
        
        # Prepare the data to store
        history_data = {
            "train_line": train_line,
            "timestamp": firestore.SERVER_TIMESTAMP,
            "stations": {}
        }
        
        # Process each station's crowd data
        for station_data in crowd_data:
            if not isinstance(station_data, dict):
                continue
                
            station_code = station_data.get("Station", "")
            
            if not station_code:
                continue
                
            # Get the crowd level
            crowd_level = station_data.get("CrowdLevel", "NA")
            
            # Store basic data for this station
            history_data["stations"][station_code] = {
                "crowd_level": crowd_level
            }
        
        # Store the historical snapshot
        history_ref.document(doc_id).set(history_data)
        
        print(f"Stored historical record of crowd density for {train_line} at {timestamp}")
    except Exception as e:
        print(f"Error storing crowd density history: {e}")

def get_crowd_density(train_line=None, station_code=None):
    """
    Retrieves the latest crowd density data, optionally filtered by train line and/or station.
    
    Args:
        train_line (str, optional): Code of train network line
        station_code (str, optional): Station code
    
    Returns:
        dict or list: Crowd density data based on the filters provided
    """
    try:
        crowd_density_ref = db.collection("station_crowd_density")
        
        # If train line is provided
        if train_line:
            line_doc = crowd_density_ref.document(train_line).get()
            
            if not line_doc.exists:
                return {"error": f"No data found for train line {train_line}"}
            
            line_data = line_doc.to_dict()
            
            # If station code is also provided
            if station_code:
                if station_code in line_data.get("stations", {}):
                    return line_data["stations"][station_code]
                else:
                    return {"error": f"No data found for station {station_code} on line {train_line}"}
            
            return line_data
        
        # If only station code is provided (search across all lines)
        elif station_code:
            results = {}
            
            for line_doc in crowd_density_ref.stream():
                line_data = line_doc.to_dict()
                if station_code in line_data.get("stations", {}):
                    results[line_doc.id] = line_data["stations"][station_code]
            
            if not results:
                return {"error": f"No data found for station {station_code}"}
            
            return results
        
        # If no filters provided, return all data
        else:
            results = {}
            
            for line_doc in crowd_density_ref.stream():
                results[line_doc.id] = line_doc.to_dict()
            
            return results
    except Exception as e:
        print(f"Error retrieving crowd density: {e}")
        return {"error": str(e)}
    
def store_station_crowd_forecast(forecast_data, train_line):
    """
    Stores forecasted MRT/LRT station crowdedness level data in Firestore.
    
    Args:
        forecast_data (list): List of station crowd forecast objects
        train_line (str): Code of train network line
    """
    try:
        # Create a reference to the station crowd forecast collection
        crowd_forecast_ref = db.collection("station_crowd_forecast")
        
        # Create a document for this train line
        line_doc_ref = crowd_forecast_ref.document(train_line)
        
        # Current timestamp for tracking when the data was fetched
        current_timestamp = firestore.SERVER_TIMESTAMP
        
        # Group forecast data by date
        forecasts_by_date = {}
        
        # Mapping for crowd level values to more descriptive terms
        crowd_level_map = {
            "l": "low",
            "m": "moderate",
            "h": "high",
            "NA": "not_available"
        }
        
        # Process each forecast entry
        for forecast in forecast_data:
            if not isinstance(forecast, dict):
                continue
                
            station_code = forecast.get("Station", "")
            
            if not station_code:
                continue
                
            # Convert timestamps if available
            date_str = forecast.get("Date", "")
            start_str = forecast.get("Start", "")
            
            date_timestamp = None
            start_timestamp = None
            
            if date_str:
                try:
                    from datetime import datetime
                    # Parse the ISO 8601 datetime string
                    date_dt = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
                    # Convert to Firestore timestamp
                    date_timestamp = firestore.Timestamp.from_datetime(date_dt)
                    # Use as key for organizing forecasts
                    date_key = date_dt.strftime('%Y-%m-%d')
                except Exception as e:
                    print(f"Error parsing date {date_str}: {e}")
                    continue  # Skip this entry if date can't be parsed
            else:
                continue  # Skip entries without date
            
            if start_str:
                try:
                    from datetime import datetime
                    # Parse the ISO 8601 datetime string
                    start_dt = datetime.fromisoformat(start_str.replace('Z', '+00:00'))
                    # Convert to Firestore timestamp
                    start_timestamp = firestore.Timestamp.from_datetime(start_dt)
                    # Time in HH:MM format
                    time_key = start_dt.strftime('%H:%M')
                except Exception as e:
                    print(f"Error parsing start time {start_str}: {e}")
                    time_key = "unknown"
            else:
                time_key = "unknown"
            
            # Get the crowd level
            crowd_level = forecast.get("CrowdLevel", "NA")
            
            # Initialize the date entry if it doesn't exist
            if date_key not in forecasts_by_date:
                forecasts_by_date[date_key] = {
                    "date": date_str,
                    "date_timestamp": date_timestamp,
                    "stations": {}
                }
            
            # Initialize the station entry if it doesn't exist
            if station_code not in forecasts_by_date[date_key]["stations"]:
                forecasts_by_date[date_key]["stations"][station_code] = {
                    "station_code": station_code,
                    "time_slots": {}
                }
            
            # Add the time slot forecast
            forecasts_by_date[date_key]["stations"][station_code]["time_slots"][time_key] = {
                "start_time": start_str,
                "start_timestamp": start_timestamp,
                "crowd_level": crowd_level,
                "crowd_level_desc": crowd_level_map.get(crowd_level, "unknown")
            }
        
        # Prepare the line data with forecasts organized by date
        line_data = {
            "train_line": train_line,
            "last_updated": current_timestamp,
            "forecasts": forecasts_by_date
        }
        
        # Store data for this train line
        line_doc_ref.set(line_data)
        
        print(f"Successfully stored crowd forecast data for {train_line} with {len(forecasts_by_date)} dates")
    except Exception as e:
        print(f"Error storing station crowd forecast: {e}")

def get_crowd_forecast(train_line=None, date=None, station_code=None):
    """
    Retrieves the crowd forecast data, optionally filtered by train line, date, and/or station.
    
    Args:
        train_line (str, optional): Code of train network line
        date (str, optional): Date in YYYY-MM-DD format
        station_code (str, optional): Station code
    
    Returns:
        dict or list: Crowd forecast data based on the filters provided
    """
    try:
        crowd_forecast_ref = db.collection("station_crowd_forecast")
        
        # If train line is provided
        if train_line:
            line_doc = crowd_forecast_ref.document(train_line).get()
            
            if not line_doc.exists:
                return {"error": f"No forecast data found for train line {train_line}"}
            
            line_data = line_doc.to_dict()
            forecasts = line_data.get("forecasts", {})
            
            # If date is also provided
            if date and date in forecasts:
                date_data = forecasts[date]
                
                # If station code is also provided
                if station_code:
                    if station_code in date_data.get("stations", {}):
                        return date_data["stations"][station_code]
                    else:
                        return {"error": f"No forecast data found for station {station_code} on line {train_line} for date {date}"}
                
                return date_data
            elif date:
                return {"error": f"No forecast data found for date {date} on line {train_line}"}
            
            # If only station code is provided (return for all dates)
            if station_code:
                station_forecasts = {}
                
                for date_key, date_data in forecasts.items():
                    if station_code in date_data.get("stations", {}):
                        station_forecasts[date_key] = date_data["stations"][station_code]
                
                if not station_forecasts:
                    return {"error": f"No forecast data found for station {station_code} on line {train_line}"}
                
                return station_forecasts
            
            return line_data
        
        # If no train line is provided, return basic info for all lines
        else:
            results = {}
            
            for line_doc in crowd_forecast_ref.stream():
                line_data = line_doc.to_dict()
                results[line_doc.id] = {
                    "train_line": line_data.get("train_line"),
                    "last_updated": line_data.get("last_updated"),
                    "dates_available": list(line_data.get("forecasts", {}).keys())
                }
            
            return results
    except Exception as e:
        print(f"Error retrieving crowd forecast: {e}")
        return {"error": str(e)}
    
def store_traffic_flow(traffic_flow_data):
    """
    Stores hourly average traffic flow data in Firestore.
    
    Args:
        traffic_flow_data (dict): Traffic flow data from LTA DataMall
    """
    try:
        # Create a reference to the traffic flow collection
        traffic_flow_ref = db.collection("traffic_flow")
        
        # Current timestamp for tracking when the data was fetched
        current_timestamp = firestore.SERVER_TIMESTAMP
        
        # Extract metadata if available
        metadata = traffic_flow_data.get('metadata', {})
        
        # Get the quarter information or use current date
        from datetime import datetime
        current_date = datetime.now()
        current_quarter = (current_date.month - 1) // 3 + 1
        quarter_year = current_date.year
        
        # Try to extract quarter information from metadata
        quarter_info = metadata.get('quarter', f"Q{current_quarter} {quarter_year}")
        
        # Create a document ID for this quarter's data
        doc_id = quarter_info.replace(" ", "_").replace("/", "_")
        
        # Store metadata about this dataset
        quarter_metadata = {
            "quarter_info": quarter_info,
            "time_period": metadata.get('time_period', '0700-0900 hours'),
            "description": metadata.get('description', 'Hourly average traffic flow'),
            "last_updated": current_timestamp,
            "node_count": 0,
            "link_count": 0
        }
        
        # Get the main data sections
        nodes = traffic_flow_data.get('nodes', [])
        links = traffic_flow_data.get('links', [])
        
        # Update metadata with counts
        quarter_metadata["node_count"] = len(nodes)
        quarter_metadata["link_count"] = len(links)
        
        # Store the metadata first
        traffic_flow_ref.document(doc_id).set(quarter_metadata)
        
        # Store nodes in a subcollection
        if nodes:
            nodes_ref = traffic_flow_ref.document(doc_id).collection("nodes")
            
            # Use batched writes for better performance
            batch = db.batch()
            batch_count = 0
            max_batch_size = 500
            
            for node in nodes:
                if not isinstance(node, dict):
                    continue
                    
                node_id = str(node.get('id', ''))
                
                if not node_id:
                    continue
                
                # Store the node data
                node_ref = nodes_ref.document(node_id)
                
                # Add the import timestamp
                node['imported_at'] = current_timestamp
                
                # Add to batch
                batch.set(node_ref, node)
                batch_count += 1
                
                # If batch size reaches max, commit and start a new batch
                if batch_count >= max_batch_size:
                    batch.commit()
                    print(f"Committed batch of {batch_count} traffic flow nodes")
                    batch = db.batch()
                    batch_count = 0
            
            # Commit any remaining operations in the batch
            if batch_count > 0:
                batch.commit()
                print(f"Committed final batch of {batch_count} traffic flow nodes")
        
        # Store links in a subcollection
        if links:
            links_ref = traffic_flow_ref.document(doc_id).collection("links")
            
            # Use batched writes for better performance
            batch = db.batch()
            batch_count = 0
            max_batch_size = 500
            
            for link in links:
                if not isinstance(link, dict):
                    continue
                    
                link_id = str(link.get('id', ''))
                
                if not link_id:
                    continue
                
                # Store the link data
                link_ref = links_ref.document(link_id)
                
                # Add the import timestamp
                link['imported_at'] = current_timestamp
                
                # Add to batch
                batch.set(link_ref, link)
                batch_count += 1
                
                # If batch size reaches max, commit and start a new batch
                if batch_count >= max_batch_size:
                    batch.commit()
                    print(f"Committed batch of {batch_count} traffic flow links")
                    batch = db.batch()
                    batch_count = 0
            
            # Commit any remaining operations in the batch
            if batch_count > 0:
                batch.commit()
                print(f"Committed final batch of {batch_count} traffic flow links")
        
        print(f"Successfully stored traffic flow data for {quarter_info} with {len(nodes)} nodes and {len(links)} links")
    except Exception as e:
        print(f"Error storing traffic flow data: {e}")

def get_traffic_flow_data(quarter=None):
    """
    Retrieves traffic flow data, optionally filtered by quarter.
    
    Args:
        quarter (str, optional): Quarter identifier (e.g., 'Q1_2023')
    
    Returns:
        dict: Traffic flow data including metadata and optionally nodes/links
    """
    try:
        traffic_flow_ref = db.collection("traffic_flow")
        
        # If quarter is provided, get that specific quarter's data
        if quarter:
            quarter_doc = traffic_flow_ref.document(quarter).get()
            
            if not quarter_doc.exists:
                return {"error": f"No traffic flow data found for quarter {quarter}"}
            
            metadata = quarter_doc.to_dict()
            
            # Return just the metadata by default
            return {
                "metadata": metadata,
                "has_nodes": True,
                "has_links": True
            }
        
        # If no quarter specified, return all quarters' metadata
        else:
            results = {}
            
            for quarter_doc in traffic_flow_ref.stream():
                results[quarter_doc.id] = quarter_doc.to_dict()
            
            return results
    except Exception as e:
        print(f"Error retrieving traffic flow data: {e}")
        return {"error": str(e)}

def get_traffic_flow_nodes(quarter, limit=100, skip=0):
    """
    Retrieves traffic flow nodes for a specific quarter with pagination.
    
    Args:
        quarter (str): Quarter identifier (e.g., 'Q1_2023')
        limit (int, optional): Maximum number of nodes to return. Defaults to 100.
        skip (int, optional): Number of nodes to skip. Defaults to 0.
    
    Returns:
        list: List of traffic flow nodes
    """
    try:
        nodes_ref = db.collection("traffic_flow").document(quarter).collection("nodes")
        
        # Apply pagination
        query = nodes_ref.limit(limit)
        
        if skip > 0:
            # Get a reference to start after
            all_docs = list(nodes_ref.limit(skip).stream())
            if all_docs:
                last_doc = all_docs[-1]
                query = nodes_ref.start_after(last_doc).limit(limit)
        
        # Execute query
        nodes = []
        for node_doc in query.stream():
            node = node_doc.to_dict()
            node["id"] = node_doc.id
            nodes.append(node)
        
        return nodes
    except Exception as e:
        print(f"Error retrieving traffic flow nodes: {e}")
        return {"error": str(e)}

def get_traffic_flow_links(quarter, limit=100, skip=0):
    """
    Retrieves traffic flow links for a specific quarter with pagination.
    
    Args:
        quarter (str): Quarter identifier (e.g., 'Q1_2023')
        limit (int, optional): Maximum number of links to return. Defaults to 100.
        skip (int, optional): Number of links to skip. Defaults to 0.
    
    Returns:
        list: List of traffic flow links
    """
    try:
        links_ref = db.collection("traffic_flow").document(quarter).collection("links")
        
        # Apply pagination
        query = links_ref.limit(limit)
        
        if skip > 0:
            # Get a reference to start after
            all_docs = list(links_ref.limit(skip).stream())
            if all_docs:
                last_doc = all_docs[-1]
                query = links_ref.start_after(last_doc).limit(limit)
        
        # Execute query
        links = []
        for link_doc in query.stream():
            link = link_doc.to_dict()
            link["id"] = link_doc.id
            links.append(link)
        
        return links
    except Exception as e:
        print(f"Error retrieving traffic flow links: {e}")
        return {"error": str(e)}

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

def store_events_data(events):
    """
    Stores events data in Firestore.
    
    Args:
        events (list): List of event dictionaries
    """
    try:
        # Create a reference to the events collection
        events_ref = db.collection("singapore_events")
        
        # Use batched writes for better performance
        batch = db.batch()
        batch_count = 0
        max_batch_size = 500
        
        # Current timestamp
        current_timestamp = firestore.SERVER_TIMESTAMP
        
        # Process each event
        for event in events:
            # Create a unique ID based on event title (normalized)
            import re
            normalized_title = re.sub(r'[^a-zA-Z0-9]', '', event.get('title', ''))
            doc_id = normalized_title[:30]  # Limit to first 30 chars
            
            if not doc_id:
                # If we can't generate an ID from title, use a timestamp
                from datetime import datetime
                doc_id = f"event_{datetime.now().strftime('%Y%m%d%H%M%S')}"
            
            # Add server timestamp
            event['imported_at'] = current_timestamp
            event['last_updated'] = current_timestamp
            
            # Set active flag
            event['is_active'] = True
            
            # Add to batch
            doc_ref = events_ref.document(doc_id)
            batch.set(doc_ref, event, merge=True)  # Use merge to update existing events
            batch_count += 1
            
            # If batch size reaches max, commit and start a new batch
            if batch_count >= max_batch_size:
                batch.commit()
                print(f"Committed batch of {batch_count} events")
                batch = db.batch()
                batch_count = 0
        
        # Commit any remaining operations in the batch
        if batch_count > 0:
            batch.commit()
            print(f"Committed final batch of {batch_count} events")
            
        print(f"Successfully stored {len(events)} events in Firestore")
    except Exception as e:
        print(f"Error storing events data: {e}")

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