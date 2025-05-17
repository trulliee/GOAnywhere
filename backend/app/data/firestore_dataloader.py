import pandas as pd
import numpy as np
import firebase_admin
import os
import datetime
from firebase_admin import credentials, firestore
from google.cloud import storage
from google.oauth2 import service_account
from dotenv import load_dotenv
from app.database.firestore_utils import get_firestore_client
import tempfile
import logging
import json

from pathlib import Path
env_path = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(dotenv_path=env_path)


# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class FirestoreDataLoader:
    """
    Utility class for loading data from Firestore and Google Cloud Storage 
    for machine learning models and data analysis.
    """
    
    def __init__(self, gcs_bucket_name=None):
        """
        Initialize the data loader.
        
        Args:
            gcs_bucket_name (str, optional): Name of the GCS bucket for auxiliary data.
        """
        self.db = get_firestore_client()

        # Optional: Initialize GCS client only if needed
        use_local = os.getenv("USE_LOCAL_FIREBASE_CREDENTIALS")
        if use_local == "1":
            creds_path = os.getenv("FIREBASE_CREDENTIALS_PATH")
            gcs_cred = service_account.Credentials.from_service_account_file(creds_path)
        else:
            # Use default credentials (e.g. for Cloud Run)
            gcs_cred = None

        self.storage_client = storage.Client(credentials=gcs_cred) if gcs_cred else storage.Client()
        self.gcs_bucket_name = gcs_bucket_name or "goanywhere-traffic-data-history"

            
    # LTA DataMall 2.1: Bus Arrival
    def get_bus_arrivals(self, bus_stop_code=None, limit=10):
        """
        Get real-time bus arrival data from Firestore.
        
        Args:
            bus_stop_code (str, optional): Specific bus stop code to query.
            limit (int): Maximum number of stops to retrieve if no specific stop is provided.
            
        Returns:
            pandas.DataFrame: Bus arrival data
        """
        logger.info(f"Loading bus arrival data for stop {bus_stop_code or 'all stops'}")
        
        try:
            # Query Firestore
            bus_arrivals_ref = self.db.collection("bus_arrivals")
            
            if bus_stop_code:
                # Get data for specific bus stop
                doc = bus_arrivals_ref.document(bus_stop_code).get()
                if not doc.exists:
                    logger.warning(f"No bus arrival data found for stop {bus_stop_code}")
                    return pd.DataFrame()
                
                data = doc.to_dict()
                return self._process_bus_arrival_data(data)
            else:
                # Get data for multiple stops
                docs = bus_arrivals_ref.limit(limit).stream()
                all_data = []
                
                for doc in docs:
                    data = doc.to_dict()
                    processed = self._process_bus_arrival_data(data)
                    if not processed.empty:
                        all_data.append(processed)
                
                if not all_data:
                    logger.warning("No bus arrival data found")
                    return pd.DataFrame()
                
                return pd.concat(all_data)
                
        except Exception as e:
            logger.error(f"Error loading bus arrival data: {e}")
            return pd.DataFrame()
    
    def _process_bus_arrival_data(self, data):
        """Helper method to process bus arrival data into a DataFrame format"""
        records = []
        bus_stop_code = data.get('bus_stop_code')
        last_updated = data.get('last_updated')
        services = data.get('services', {})
        
        for service_no, service_data in services.items():
            next_buses = service_data.get('next_buses', [])
            
            for i, bus in enumerate(next_buses):
                record = {
                    'bus_stop_code': bus_stop_code,
                    'service_no': service_no,
                    'operator': service_data.get('operator'),
                    'arrival_sequence': i + 1,
                    'last_updated': last_updated
                }
                # Add all bus details
                record.update(bus)
                records.append(record)
        
        return pd.DataFrame(records)
    
    # LTA DataMall: Bus Arrival History
    def get_bus_arrival_history(self, bus_stop_code=None, days=None, limit=1000):
        """
        Get historical bus arrival data from Firestore.
        
        Args:
            bus_stop_code (str, optional): Specific bus stop code to query.
            days (int): Number of days of history to retrieve.
            limit (int): Maximum number of records to retrieve.
            
        Returns:
            pandas.DataFrame: Historical bus arrival data
        """
        logger.info(f"Loading historical bus arrival data for stop {bus_stop_code or 'all stops'}")
        
        try:
            # Calculate the cutoff date
            if days is not None:
                cutoff_date = datetime.datetime.now() - datetime.timedelta(days=days)
                query = query.where(... >= cutoff_date)

            
            # Query Firestore
            history_ref = self.db.collection("bus_arrivals_history")
            
            # Build query
            query = history_ref
            
            if bus_stop_code:
                # Using a compound query to filter by bus stop code
                # Note: This requires a composite index to be created in Firestore
                query = query.where("bus_stop_code", "==", bus_stop_code)
            
            # Filter by timestamp and order by timestamp
            if days is not None:
                cutoff_date = datetime.datetime.now() - datetime.timedelta(days=days)
                query = query.where(filter=FieldFilter("Timestamp", ">=", cutoff_date))

            query = query.order_by("timestamp", direction=firestore.Query.DESCENDING)
            query = query.limit(limit)
            
            # Execute query
            docs = query.stream()
            
            # Convert to DataFrame
            records = []
            for doc in docs:
                record = doc.to_dict()
                record['id'] = doc.id
                records.append(record)
            
            if not records:
                logger.warning("No historical bus arrival data found")
                return pd.DataFrame()
            
            # Process to flattened DataFrame format
            flat_records = []
            for record in records:
                bus_stop_code = record.get('bus_stop_code')
                timestamp = record.get('timestamp')
                
                for service in record.get('services', []):
                    flat_record = {
                        'bus_stop_code': bus_stop_code,
                        'timestamp': timestamp,
                        'service_no': service.get('service_no'),
                        'operator': service.get('operator'),
                        'estimated_arrival': service.get('estimated_arrival'),
                        'load': service.get('load')
                    }
                    flat_records.append(flat_record)
            
            df = pd.DataFrame(flat_records)
            
            # Convert timestamps
            if 'timestamp' in df.columns:
                df['timestamp'] = pd.to_datetime(df['timestamp'], errors='coerce', utc=True)
            if 'estimated_arrival' in df.columns:
                df['estimated_arrival'] = pd.to_datetime(df['estimated_arrival'], errors='coerce', utc=True)
            
            logger.info(f"Loaded {len(df)} historical bus arrival records")
            return df
            
        except Exception as e:
            logger.error(f"Error loading historical bus arrival data: {e}")
            return pd.DataFrame()
    
    # Bus Services
    def get_bus_services(self, service_no=None):
        """
        Get bus services information from Firestore.
        
        Args:
            service_no (str, optional): Specific bus service number to query.
            
        Returns:
            pandas.DataFrame: Bus services data
        """
        logger.info(f"Loading bus services data for service {service_no or 'all services'}")
        
        try:
            # Query Firestore
            if service_no:
                # Query for specific service
                doc = self.db.collection("bus_services").document(service_no).get()
                if not doc.exists:
                    logger.warning(f"No data found for bus service {service_no}")
                    return pd.DataFrame()
                
                data = [doc.to_dict()]
            else:
                # Query for all services
                docs = self.db.collection("bus_services").stream()
                data = [doc.to_dict() for doc in docs]
            
            if not data:
                logger.warning("No bus services data found")
                return pd.DataFrame()
            
            df = pd.DataFrame(data)
            logger.info(f"Loaded {len(df)} bus service records")
            return df
            
        except Exception as e:
            logger.error(f"Error loading bus services data: {e}")
            return pd.DataFrame()
    
    # Bus Services Info
    def get_bus_services_info(self, service_no=None):
        """
        Get detailed bus services information from Firestore.
        
        Args:
            service_no (str, optional): Specific bus service number to query.
            
        Returns:
            pandas.DataFrame: Bus services info data
        """
        logger.info(f"Loading bus services info for service {service_no or 'all services'}")
        
        try:
            # Query Firestore
            if service_no:
                # Query for specific service
                doc = self.db.collection("bus_services_info").document(service_no).get()
                if not doc.exists:
                    logger.warning(f"No info found for bus service {service_no}")
                    return pd.DataFrame()
                
                data = [doc.to_dict()]
            else:
                # Query for all services
                docs = self.db.collection("bus_services_info").stream()
                data = [doc.to_dict() for doc in docs]
            
            if not data:
                logger.warning("No bus services info found")
                return pd.DataFrame()
            
            df = pd.DataFrame(data)
            logger.info(f"Loaded {len(df)} bus service info records")
            return df
            
        except Exception as e:
            logger.error(f"Error loading bus services info: {e}")
            return pd.DataFrame()
    
    # LTA DataMall 2.3: Bus Routes
    def get_bus_routes(self, service_no=None, direction=None):
        """
        Get bus routes information from Firestore.
        
        Args:
            service_no (str, optional): Specific bus service number to query.
            direction (str, optional): Direction of the route (1 or 2).
            
        Returns:
            pandas.DataFrame: Bus routes data
        """
        logger.info(f"Loading bus routes data for service {service_no or 'all services'}")
        
        try:
            # Query Firestore
            bus_routes_ref = self.db.collection("bus_routes")
            query = bus_routes_ref
            
            if service_no:
                query = query.where("service_no", "==", service_no)
            
            if direction:
                query = query.where("direction", "==", direction)
            
            # Execute query
            docs = query.stream()
            
            # Convert to DataFrame
            records = []
            for doc in docs:
                record = doc.to_dict()
                record['id'] = doc.id
                records.append(record)
            
            if not records:
                logger.warning(f"No bus routes data found for service {service_no or 'all services'}")
                return pd.DataFrame()
            
            df = pd.DataFrame(records)
            
            # Sort by service number, direction, and stop sequence
            if all(col in df.columns for col in ["service_no", "direction", "stop_sequence"]):
                df = df.sort_values(by=["service_no", "direction", "stop_sequence"])
            
            logger.info(f"Loaded {len(df)} bus route records")
            return df
            
        except Exception as e:
            logger.error(f"Error loading bus routes data: {e}")
            return pd.DataFrame()

    # LTA DataMall: Bus Passenger Volume
    def get_bus_passenger_volume(self, date=None, limit=100):
        """
        Get bus passenger volume data from Firestore.
        
        Args:
            date (str, optional): Date in format YYYYMM to filter by.
            limit (int): Maximum number of records to retrieve.
            
        Returns:
            pandas.DataFrame: Bus passenger volume data
        """
        logger.info(f"Loading bus passenger volume data")
        
        try:
            # Query Firestore
            pv_ref = self.db.collection("bus_passenger_volume")
            
            # Build query
            query = pv_ref
            
            if date:
                # Filter by date prefix
                query = query.where("date", "==", date)
            
            # Execute query to get parent documents
            parent_docs = query.limit(limit).stream()
            
            all_records = []
            
            # Fetch records from each parent document's subcollection
            for parent_doc in parent_docs:
                parent_data = parent_doc.to_dict()
                metadata = {
                    'date': parent_data.get('date'),
                    'filename': parent_data.get('filename'),
                    'parent_id': parent_doc.id
                }
                
                # Get records from subcollection
                records_ref = parent_doc.reference.collection("records")
                record_docs = records_ref.limit(1000).stream()  # Limit to 1000 records per parent
                
                for record_doc in record_docs:
                    record = record_doc.to_dict()
                    # Add metadata
                    record.update(metadata)
                    all_records.append(record)
            
            if not all_records:
                logger.warning("No bus passenger volume data found")
                return pd.DataFrame()
            
            df = pd.DataFrame(all_records)
            
            logger.info(f"Loaded {len(df)} bus passenger volume records")
            return df
            
        except Exception as e:
            logger.error(f"Error loading bus passenger volume data: {e}")
            return pd.DataFrame()
    
    # LTA DataMall: Bus OD Passenger Volume
    def get_bus_od_passenger_volume(self, date=None, limit=100, chunk_size=1000):
        """
        Get bus origin-destination passenger volume data from Firestore.
        
        Args:
            date (str, optional): Date in format YYYYMM to filter by.
            limit (int): Maximum number of parent documents to retrieve.
            chunk_size (int): Maximum number of records per chunk to retrieve.
            
        Returns:
            pandas.DataFrame: Bus OD passenger volume data
        """
        logger.info(f"Loading bus OD passenger volume data")
        
        try:
            # Query Firestore
            od_pv_ref = self.db.collection("bus_od_passenger_volume")
            
            # Build query
            query = od_pv_ref
            
            if date:
                # Filter by date
                query = query.where("date", "==", date)
            
            # Execute query to get parent documents
            parent_docs = query.limit(limit).stream()
            
            all_records = []
            
            # Fetch records from each parent document's chunks and their subcollections
            for parent_doc in parent_docs:
                parent_data = parent_doc.to_dict()
                metadata = {
                    'date': parent_data.get('date'),
                    'filename': parent_data.get('filename'),
                    'parent_id': parent_doc.id
                }
                
                # Get chunks subcollection
                chunks_ref = parent_doc.reference.collection("chunks")
                chunk_docs = chunks_ref.limit(5).stream()  # Limit to 5 chunks
                
                for chunk_doc in chunk_docs:
                    chunk_data = chunk_doc.to_dict()
                    chunk_metadata = {
                        'chunk_index': chunk_data.get('chunk_index'),
                        'chunk_id': chunk_doc.id
                    }
                    
                    # Get records from chunk's subcollection
                    records_ref = chunk_doc.reference.collection("records")
                    record_docs = records_ref.limit(chunk_size).stream()
                    
                    for record_doc in record_docs:
                        record = record_doc.to_dict()
                        # Add metadata
                        record.update(metadata)
                        record.update(chunk_metadata)
                        all_records.append(record)
            
            if not all_records:
                logger.warning("No bus OD passenger volume data found")
                return pd.DataFrame()
            
            df = pd.DataFrame(all_records)
            
            logger.info(f"Loaded {len(df)} bus OD passenger volume records")
            return df
            
        except Exception as e:
            logger.error(f"Error loading bus OD passenger volume data: {e}")
            return pd.DataFrame()
    
    # LTA DataMall: Train OD Passenger Volume
    def get_train_od_passenger_volume(self, date=None, limit=100, chunk_size=1000):
        """
        Get train origin-destination passenger volume data from Firestore.
        
        Args:
            date (str, optional): Date in format YYYYMM to filter by.
            limit (int): Maximum number of parent documents to retrieve.
            chunk_size (int): Maximum number of records per chunk to retrieve.
            
        Returns:
            pandas.DataFrame: Train OD passenger volume data
        """
        logger.info(f"Loading train OD passenger volume data")
        
        try:
            # Query Firestore
            od_pv_ref = self.db.collection("train_od_passenger_volume")
            
            # Build query
            query = od_pv_ref
            
            if date:
                # Filter by date
                query = query.where("date", "==", date)
            
            # Execute query to get parent documents
            parent_docs = query.limit(limit).stream()
            
            all_records = []
            
            # Fetch records from each parent document's chunks and their subcollections
            for parent_doc in parent_docs:
                parent_data = parent_doc.to_dict()
                metadata = {
                    'date': parent_data.get('date'),
                    'filename': parent_data.get('filename'),
                    'parent_id': parent_doc.id
                }
                
                # Get chunks subcollection
                chunks_ref = parent_doc.reference.collection("chunks")
                chunk_docs = chunks_ref.limit(5).stream()  # Limit to 5 chunks
                
                for chunk_doc in chunk_docs:
                    chunk_data = chunk_doc.to_dict()
                    chunk_metadata = {
                        'chunk_index': chunk_data.get('chunk_index'),
                        'chunk_id': chunk_doc.id
                    }
                    
                    # Get records from chunk's subcollection
                    records_ref = chunk_doc.reference.collection("records")
                    record_docs = records_ref.limit(chunk_size).stream()
                    
                    for record_doc in record_docs:
                        record = record_doc.to_dict()
                        # Add metadata
                        record.update(metadata)
                        record.update(chunk_metadata)
                        all_records.append(record)
            
            if not all_records:
                logger.warning("No train OD passenger volume data found")
                return pd.DataFrame()
            
            df = pd.DataFrame(all_records)
            
            logger.info(f"Loaded {len(df)} train OD passenger volume records")
            return df
            
        except Exception as e:
            logger.error(f"Error loading train OD passenger volume data: {e}")
            return pd.DataFrame()
    
    # LTA DataMall: Train Passenger Volume
    def get_train_passenger_volume(self, date=None, limit=100, chunk_size=1000):
        """
        Get train passenger volume data from Firestore.
        
        Args:
            date (str, optional): Date in format YYYYMM to filter by.
            limit (int): Maximum number of parent documents to retrieve.
            chunk_size (int): Maximum number of records per chunk to retrieve.
            
        Returns:
            pandas.DataFrame: Train passenger volume data
        """
        logger.info(f"Loading train passenger volume data")
        
        try:
            # Query Firestore
            pv_ref = self.db.collection("train_passenger_volume")
            
            # Build query
            query = pv_ref
            
            if date:
                # Filter by date
                query = query.where("date", "==", date)
            
            # Execute query to get parent documents
            parent_docs = query.limit(limit).stream()
            
            all_records = []
            
            # Fetch records from each parent document's chunks and their subcollections
            for parent_doc in parent_docs:
                parent_data = parent_doc.to_dict()
                metadata = {
                    'date': parent_data.get('date'),
                    'filename': parent_data.get('filename'),
                    'parent_id': parent_doc.id
                }
                
                # Get chunks subcollection
                chunks_ref = parent_doc.reference.collection("chunks")
                chunk_docs = chunks_ref.limit(5).stream()  # Limit to 5 chunks
                
                for chunk_doc in chunk_docs:
                    chunk_data = chunk_doc.to_dict()
                    chunk_metadata = {
                        'chunk_index': chunk_data.get('chunk_index'),
                        'chunk_id': chunk_doc.id
                    }
                    
                    # Get records from chunk's subcollection
                    records_ref = chunk_doc.reference.collection("records")
                    record_docs = records_ref.limit(chunk_size).stream()
                    
                    for record_doc in record_docs:
                        record = record_doc.to_dict()
                        # Add metadata
                        record.update(metadata)
                        record.update(chunk_metadata)
                        all_records.append(record)
            
            if not all_records:
                logger.warning("No train passenger volume data found")
                return pd.DataFrame()
            
            df = pd.DataFrame(all_records)
            
            logger.info(f"Loaded {len(df)} train passenger volume records")
            return df
            
        except Exception as e:
            logger.error(f"Error loading train passenger volume data: {e}")
            return pd.DataFrame()
    
    # LTA DataMall: Train Service Alerts
    def get_train_service_alerts(self, active_only=True):
        """
        Get train service alerts from Firestore.
        
        Args:
            active_only (bool): Whether to retrieve only active alerts.
            
        Returns:
            pandas.DataFrame: Train service alerts data
        """
        logger.info(f"Loading train service alerts (active_only={active_only})")
        
        try:
            # Query Firestore
            alerts_ref = self.db.collection("train_service_alerts")
            
            # Build query
            query = alerts_ref
            
            if active_only:
                query = query.where("is_active", "==", True)
            
            # Execute query
            docs = query.stream()
            
            # Convert to DataFrame
            records = []
            for doc in docs:
                record = doc.to_dict()
                record['id'] = doc.id
                records.append(record)
            
            if not records:
                logger.warning("No train service alerts found")
                return pd.DataFrame()
            
            df = pd.DataFrame(records)
            
            # Convert timestamps if they exist
            timestamp_cols = ['last_updated', 'deactivated_at']
            for col in timestamp_cols:
                if col in df.columns:
                    df[col] = pd.to_datetime(df[col], errors='coerce', utc=True)
            
            logger.info(f"Loaded {len(df)} train service alert records")
            return df
            
        except Exception as e:
            logger.error(f"Error loading train service alerts: {e}")
            return pd.DataFrame()
    
    # Train Alert History
    def get_train_alert_history(self, days=None):
        """
        Get historical train service alert data from Firestore.
        
        Args:
            days (int): Number of days of history to retrieve.
            
        Returns:
            pandas.DataFrame: Train alert history data
        """
        logger.info(f"Loading train alert history for the past days")
        
        try:
            # Calculate the cutoff date
            if days is not None:
                cutoff_date = datetime.datetime.now() - datetime.timedelta(days=days)
                query = query.where(... >= cutoff_date)
            
            # Query Firestore
            history_ref = self.db.collection("train_alerts_history")
            
            # Execute query
            docs = history_ref.stream()
            
            # Convert to DataFrame
            records = []
            for doc in docs:
                record = doc.to_dict()
                record['id'] = doc.id
                records.append(record)
            
            if not records:
                logger.warning("No train alert history found")
                return pd.DataFrame()
            
            df = pd.DataFrame(records)
            
            # Convert timestamps if they exist
            if 'timestamp' in df.columns:
                df['timestamp'] = pd.to_datetime(df['timestamp'], errors='coerce', utc=True)
                
                # Filter by cutoff date
                df = df[df['timestamp'] >= cutoff_date]
            
            logger.info(f"Loaded {len(df)} train alert history records")
            return df
            
        except Exception as e:
            logger.error(f"Error loading train alert history: {e}")
            return pd.DataFrame()

    # LTA DataMall 2.13: Estimated Travel Times
    def get_travel_times(self, days: int = None) -> pd.DataFrame:
        """
        Retrieve estimated travel times from top-level Firestore collection.

        Args:
            days (int, optional): If provided, filters data from the last N days.

        Returns:
            pd.DataFrame: Travel time data with Timestamp and Esttime
        """
        try:
            logger.info("🔄 Loading estimated travel times data from top-level collection...")
            collection_ref = self.db.collection("estimated_travel_times")

            # Build query
            if days is not None:
                cutoff = datetime.datetime.now() - datetime.timedelta(days=days)
                query = collection_ref.where("Timestamp", ">=", cutoff)
            else:
                query = collection_ref

            docs = query.stream()
            records = []

            for doc in docs:
                data = doc.to_dict()
                if "Timestamp" in data and "Esttime" in data:
                    data["id"] = doc.id
                    records.append(data)

            if not records:
                logger.warning("⚠️ No valid estimated travel times data found.")
                return pd.DataFrame()

            df = pd.DataFrame(records)
            df["Timestamp"] = pd.to_datetime(df["Timestamp"], errors="coerce", utc=True)

            logger.info(f"✅ Loaded {len(df)} estimated travel time records.")
            return df

        except Exception as e:
            logger.error(f"❌ Error loading estimated travel times: {e}")
            return pd.DataFrame()

    # LTA DataMall: Faulty Traffic Lights
    def get_faulty_traffic_lights(self, active_only=True, type_filter=None):
        """
        Get faulty traffic lights data from Firestore.
        
        Args:
            active_only (bool): Whether to retrieve only active faults.
            type_filter (int, optional): Filter by fault type (4 for Blackout, 13 for Flashing Yellow).
            
        Returns:
            pandas.DataFrame: Faulty traffic lights data
        """
        logger.info(f"Loading faulty traffic lights data (active_only={active_only})")
        
        try:
            # Query Firestore
            lights_ref = self.db.collection("faulty_traffic_lights")
            
            # Build query
            query = lights_ref
            
            if active_only:
                query = query.where("is_active", "==", True)
            
            if type_filter is not None:
                query = query.where("type", "==", type_filter)
            
            # Execute query
            docs = query.stream()
            
            # Convert to DataFrame
            records = []
            for doc in docs:
                record = doc.to_dict()
                record['id'] = doc.id
                records.append(record)
            
            if not records:
                logger.warning("No faulty traffic lights data found")
                return pd.DataFrame()
            
            df = pd.DataFrame(records)
            
            # Convert timestamps if they exist
            timestamp_cols = ['last_updated', 'start_timestamp', 'end_timestamp', 'resolved_at']
            for col in timestamp_cols:
                if col in df.columns:
                    df[col] = pd.to_datetime(df[col], errors='coerce', utc=True)
            
            logger.info(f"Loaded {len(df)} faulty traffic light records")
            return df
            
        except Exception as e:
            logger.error(f"Error loading faulty traffic lights data: {e}")
            return pd.DataFrame()
    
    # Traffic Light Fault History
    def get_traffic_light_history(self, days=None):
        """
        Get historical traffic light fault data from Firestore.
        
        Args:
            days (int): Number of days of history to retrieve.
            
        Returns:
            pandas.DataFrame: Traffic light fault history data
        """
        logger.info(f"Loading traffic light fault history for the past days")
        
        try:
            # Calculate the cutoff date
            if days is not None:
                cutoff_date = datetime.datetime.now() - datetime.timedelta(days=days)
                query = query.where(... >= cutoff_date)
            
            # Query Firestore
            history_ref = self.db.collection("traffic_lights_history")
            
            # Execute query
            docs = history_ref.stream()
            
            # Convert to DataFrame
            records = []
            for doc in docs:
                record = doc.to_dict()
                record['id'] = doc.id
                records.append(record)
            
            if not records:
                logger.warning("No traffic light fault history found")
                return pd.DataFrame()
            
            df = pd.DataFrame(records)
            
            # Convert timestamps if they exist
            if 'timestamp' in df.columns:
                df['timestamp'] = pd.to_datetime(df['timestamp'], errors='coerce', utc=True)
                
                # Filter by cutoff date
                df = df[df['timestamp'] >= cutoff_date]
            
            logger.info(f"Loaded {len(df)} traffic light fault history records")
            return df
            
        except Exception as e:
            logger.error(f"Error loading traffic light fault history: {e}")
            return pd.DataFrame()
    
    # LTA DataMall 2.15: Planned Road Openings
    def get_planned_road_openings(self, status=None):
        """
        Get planned road openings data from Firestore.
        
        Args:
            status (str, optional): Filter by status ('scheduled', 'in_progress', 'completed').
            
        Returns:
            pandas.DataFrame: Planned road openings data
        """
        logger.info(f"Loading planned road openings data (status={status or 'all'})")
        
        try:
            # Query Firestore
            openings_ref = self.db.collection("planned_road_openings")
            
            # Base query for active road openings
            query = openings_ref.where("is_active", "==", True)
            
            # Add status filter if specified
            if status:
                query = query.where("status", "==", status)
            
            # Execute query
            docs = query.stream()
            
            # Convert to DataFrame
            records = []
            for doc in docs:
                record = doc.to_dict()
                record['id'] = doc.id
                records.append(record)
            
            if not records:
                logger.warning("No planned road openings data found")
                return pd.DataFrame()
            
            df = pd.DataFrame(records)
            
            # Process timestamps if they exist
            timestamp_cols = ['last_updated', 'start_timestamp', 'end_timestamp', 'completed_at']
            for col in timestamp_cols:
                if col in df.columns:
                    df[col] = pd.to_datetime(df[col], errors='coerce', utc=True)
            
            logger.info(f"Loaded {len(df)} planned road opening records")
            return df
            
        except Exception as e:
            logger.error(f"Error loading planned road openings data: {e}")
            return pd.DataFrame()

    # LTA DataMall 2.19: Traffic Speed Bands
    def get_traffic_speed_bands(self, days=None, limit=10000):
        """
        Get traffic speed bands from Firestore.
        
        Args:
            days (int): Number of days of data to retrieve
            limit (int): Maximum number of records to retrieve
            
        Returns:
            pandas.DataFrame: Traffic speed bands data
        """
        logger.info(f"Loading traffic speed bands data for the past days")
        
        try:            
            # Query Firestore
            speed_bands_ref = self.db.collection("traffic_speed_bands")
            if days is not None:
                cutoff_date = datetime.datetime.now() - datetime.timedelta(days=days)
                query = (speed_bands_ref
                        .where(filter=FieldFilter("Timestamp", ">=", cutoff_date))
                        .order_by("Timestamp", direction=firestore.Query.DESCENDING))
            else:
                query = speed_bands_ref.order_by("Timestamp", direction=firestore.Query.DESCENDING)

            
            # Execute query
            docs = query.stream()
            
            # Convert to DataFrame
            records = []
            for doc in docs:
                record = doc.to_dict()
                record['id'] = doc.id
                records.append(record)
            
            if not records:
                logger.warning("No traffic speed bands data found")
                return pd.DataFrame()
            
            df = pd.DataFrame(records)
            
            # Process timestamps if they exist
            if 'Timestamp' in df.columns:
                df['Timestamp'] = pd.to_datetime(df['Timestamp'], errors='coerce', utc=True)
            
            logger.info(f"Loaded {len(df)} traffic speed band records")
            return df
            
        except Exception as e:
            logger.error(f"Error loading traffic speed bands data: {e}")
            return pd.DataFrame()

    # LTA DataMall 2.18: Traffic Incidents
    def get_incidents(self, days=None, include_user_reported=False):
        """
        Get traffic incidents from Firestore.
        
        Args:
            days (int): Number of days of data to retrieve
            include_user_reported (bool): Whether to include user-reported incidents
            
        Returns:
            pandas.DataFrame: Incidents data
        """
        logger.info(f"Loading traffic incidents data for the past days")
        
        try:
            # Query official incidents
            incidents_ref = self.db.collection("traffic_incidents")
            if days is not None:
                cutoff_date = datetime.datetime.now() - datetime.timedelta(days=days)
                query = (incidents_ref
                        .where(filter=FieldFilter("Timestamp", ">=", cutoff_date))
                        .order_by("Timestamp", direction=firestore.Query.DESCENDING))
            else:
                query = incidents_ref.order_by("Timestamp", direction=firestore.Query.DESCENDING)

            
            # Execute query
            docs = query.stream()
            
            # Convert to list
            records = []
            for doc in docs:
                record = doc.to_dict()
                record['id'] = doc.id
                record['source'] = 'official'
                records.append(record)
            
            if not records:
                logger.warning("No incidents data found")
                return pd.DataFrame()
            
            df = pd.DataFrame(records)
            
            # Process timestamps if they exist
            timestamp_cols = ['Timestamp', 'time_reported']
            for col in timestamp_cols:
                if col in df.columns:
                    df[col] = pd.to_datetime(df[col], errors='coerce', utc=True)
            
            if 'Timestamp' in df.columns:
                df['date'] = df['Timestamp'].dt.date

            logger.info(f"Loaded {len(df)} traffic incident records")
            return df
            
        except Exception as e:
            logger.error(f"Error loading traffic incidents data: {e}")
            return pd.DataFrame()

    # Weather data
    def get_weather_data(self, days=None, location=None):
        """
        Load weather data from Firestore.
        
        Args:
            days (int): Number of days of data to retrieve
            location (str, optional): Specific location to filter by (default: "Singapore")
            
        Returns:
            pandas.DataFrame: Weather data formatted for model compatibility
        """
        try:
            logging.info(f"Loading weather data for the past days")

            # Base query
            query = self.db.collection('weather_data')

            # Apply time filter only if days is provided
            if days is not None:
                start_time = datetime.datetime.now() - datetime.timedelta(days=days)
                query = query.where("stored_at", ">=", start_time)

            # Apply location filter if specified
            if location:
                query = query.where("city", "==", location)

            # Execute query
            docs = query.stream()

            # Convert to list of dicts
            weather_data = []
            for doc in docs:
                data = doc.to_dict()
                data['id'] = doc.id
                # Add stored_at if missing
                if 'stored_at' not in data:
                    data['stored_at'] = doc.create_time
                weather_data.append(data)

            if not weather_data:
                logging.warning("No weather data found")
                return pd.DataFrame()

            # Convert to DataFrame
            df = pd.DataFrame(weather_data)

            # Fix missing columns if necessary
            if 'temperature' not in df.columns and 'temp' in df.columns:
                df['temperature'] = df['temp']

            if 'humidity' not in df.columns:
                df['humidity'] = 70.0  # Default fallback

            if 'stored_at' in df.columns:
                df['stored_at'] = pd.to_datetime(df['stored_at'], errors='coerce')
            else:
                logger.warning("'stored_at' column not found in weather data")
                df['stored_at'] = pd.NaT

            logging.info(f"Loaded {len(df)} weather records")
            return df

        except Exception as e:
            logging.error(f"Error loading weather data: {e}")
            return pd.DataFrame()

    def get_historical_holidays(self, years=None):
        """
        Load public holiday data from Google Cloud Storage.
        
        Args:
            years (list, optional): List of years to retrieve data for
            
        Returns:
            pandas.DataFrame: Holiday data
        """
        try:
            logging.info("Loading historical holiday data")
            
            # Check if our uploaded holidays CSV is in GCS
            if self.storage_client:
                try:
                    bucket = self.storage_client.bucket(self.gcs_bucket_name)
                    blob = bucket.blob("uploads/PublicHolidaysfor2025.csv")
                    
                    # Create temp file path but DO NOT open it
                    with tempfile.NamedTemporaryFile(delete=False, suffix='.csv') as temp_file:
                        temp_file_path = temp_file.name  # just get the path

                    # Download to that path
                    blob.download_to_filename(temp_file_path)
                    
                    # Now read
                    holidays_df = pd.read_csv(temp_file_path)
                    
                    # Optional: delete temp file after reading
                    os.remove(temp_file_path)
                    
                    # Rename columns to match expected format (if needed)
                    column_mapping = {
                        'date': 'Date',
                        'day': 'Day',
                        'holiday': 'Name'
                    }
                    holidays_df.rename(columns={k: v for k, v in column_mapping.items() 
                                                if k in holidays_df.columns and v not in holidays_df.columns}, 
                                    inplace=True)
                        
                    # Convert date column to datetime format
                    if 'Date' in holidays_df.columns:
                        holidays_df['Date'] = pd.to_datetime(holidays_df['Date'], utc=True)
                    
                    # Filter by years if specified
                    if years:
                        holidays_df = holidays_df[holidays_df['Date'].dt.year.isin(years)]
                    
                    logging.info(f"Loaded {len(holidays_df)} holiday records")
                    return holidays_df

                except Exception as e:
                    # Fallback: create a minimal holidays dataset with expected columns
                    logging.warning("Creating default holiday dataset")
                    default_holidays = pd.DataFrame({
                        'Date': pd.to_datetime([
                            '2025-01-01', '2025-01-29', '2025-01-30', '2025-03-31', 
                            '2025-04-18', '2025-05-01', '2025-05-12', '2025-06-07', 
                            '2025-08-09', '2025-10-20', '2025-12-25'
                        ]),
                        'Day': ['Wednesday', 'Wednesday', 'Thursday', 'Monday', 
                            'Friday', 'Thursday', 'Monday', 'Saturday', 
                            'Saturday', 'Monday', 'Thursday'],
                        'Name': ["New Year's Day", "Chinese New Year", "Chinese New Year", "Hari Raya Puasa",
                                "Good Friday", "Labour Day", "Vesak Day", "Hari Raya Haji",
                                "National Day", "Deepavali", "Christmas Day"]
                    })
                    
                    # Filter by years if specified
                    if years:
                        default_holidays = default_holidays[default_holidays['Date'].dt.year.isin(years)]
                        
                    return default_holidays
        
        except Exception as e:
            logging.error(f"Error loading holiday data: {e}")
            return pd.DataFrame(columns=['Date', 'Day', 'Name'])

    # Singapore Events data
    def get_events_data(self, active_only=True, days_ahead=None):
        """
        Get Singapore events data from Firestore.

        Args:
            active_only (bool): Whether to retrieve only active events.
            days_ahead (int): For active events, how many days ahead to consider.

        Returns:
            pandas.DataFrame: Events data
        """
        logger.info(f"Loading Singapore events data (active_only={active_only})")

        try:
            events_ref = self.db.collection("singapore_events")
            docs = events_ref.stream()

            records = []
            for doc in docs:
                record = doc.to_dict()
                record["id"] = doc.id
                records.append(record)

            if not records:
                logger.warning("No events data found")
                return pd.DataFrame()

            df = pd.DataFrame(records)

            # Filter active events
            if active_only and 'is_active' in df.columns:
                df = df[df['is_active'] == True]

            # Convert date/time fields with utc=True to handle tz-aware datetimes
            date_cols = ['start_date', 'end_date', 'imported_at', 'last_updated', 'scraped_at']
            for col in date_cols:
                if col in df.columns:
                    df[col] = pd.to_datetime(df[col], errors='coerce', utc=True)

            # Filter for upcoming events if active_only is True and days_ahead is valid
            if active_only and days_ahead is not None and 'end_date' in df.columns:
                now_utc = pd.Timestamp.utcnow()
                cutoff = now_utc + pd.Timedelta(days=days_ahead)

                df = df[df['end_date'] >= now_utc]
                df = df[df['start_date'] <= cutoff]


            logger.info(f"Loaded {len(df)} event records")
            return df

        except Exception as e:
            logger.error(f"Error loading events data: {e}")
            return pd.DataFrame()


    # Traffic Flow Data
    def get_traffic_flow_data(self, quarter=None):
        """
        Get traffic flow data from Firestore.
        
        Args:
            quarter (str, optional): Quarter identifier (e.g., 'Q1_2023').
            
        Returns:
            dict: Traffic flow data including metadata.
        """
        logger.info(f"Loading traffic flow data for quarter {quarter or 'latest'}")
        
        try:
            # Query Firestore
            traffic_flow_ref = self.db.collection("traffic_flow")
            
            # If quarter is provided, get that specific quarter's data
            if quarter:
                quarter_doc = traffic_flow_ref.document(quarter).get()
                
                if not quarter_doc.exists:
                    logger.warning(f"No traffic flow data found for quarter {quarter}")
                    return {}
                
                metadata = quarter_doc.to_dict()
                
                # Return metadata
                return {'metadata': metadata, 'has_nodes': True, 'has_links': True}
            
            # If no quarter specified, return all quarters' metadata
            else:
                results = {}
                
                for quarter_doc in traffic_flow_ref.stream():
                    results[quarter_doc.id] = quarter_doc.to_dict()
                
                if not results:
                    logger.warning("No traffic flow data found")
                    return {}
                    
                return results
                
        except Exception as e:
            logger.error(f"Error loading traffic flow data: {e}")
            return {}