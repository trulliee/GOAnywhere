# app/data/firestore_dataloader.py

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from firebase_admin import firestore
from google.cloud import storage
import tempfile
import os
import logging
import json

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class FirestoreDataLoader:
    """
    Utility class for loading data from Firestore and Google Cloud Storage 
    for machine learning models.
    """
    
    def __init__(self, gcs_bucket_name=None):
        """
        Initialize the data loader.
        
        Args:
            gcs_bucket_name (str, optional): Name of the GCS bucket for auxiliary data.
        """
        self.db = firestore.client()
        self.gcs_bucket_name = gcs_bucket_name or "goanywhere-traffic-data-history"
        self.storage_client = storage.Client()
    
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
    
    # LTA DataMall 2.2: Bus Services
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
                doc = self.db.collection("bus_services_info").document(service_no).get()
                if not doc.exists:
                    logger.warning(f"No data found for bus service {service_no}")
                    return pd.DataFrame()
                
                data = [doc.to_dict()]
            else:
                # Query for all services
                docs = self.db.collection("bus_services_info").stream()
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
    
    # LTA DataMall 2.4: Bus Stops
    def get_bus_stops(self, bus_stop_code=None):
        """
        Get bus stops information from Firestore.
        
        Args:
            bus_stop_code (str, optional): Specific bus stop code to query.
            
        Returns:
            pandas.DataFrame: Bus stops data
        """
        logger.info(f"Loading bus stops data for stop {bus_stop_code or 'all stops'}")
        
        try:
            # Query Firestore - assuming bus stops are stored in a collection
            bus_stops_ref = self.db.collection("bus_stops")
            
            if bus_stop_code:
                # Query for specific bus stop
                doc = bus_stops_ref.document(bus_stop_code).get()
                if not doc.exists:
                    logger.warning(f"No data found for bus stop {bus_stop_code}")
                    return pd.DataFrame()
                
                data = [doc.to_dict()]
            else:
                # Query for all bus stops
                docs = bus_stops_ref.stream()
                data = [doc.to_dict() for doc in docs]
            
            if not data:
                logger.warning("No bus stops data found")
                return pd.DataFrame()
            
            df = pd.DataFrame(data)
            logger.info(f"Loaded {len(df)} bus stop records")
            return df
            
        except Exception as e:
            logger.error(f"Error loading bus stops data: {e}")
            return pd.DataFrame()
    
    # LTA DataMall 2.5: Passenger Volume by Bus Stops
    def get_bus_passenger_volume(self, date=None):
        """
        Get bus passenger volume data from Firestore.
        
        Args:
            date (str, optional): Date in format YYYYMM. Defaults to latest available.
            
        Returns:
            pandas.DataFrame: Bus passenger volume data
        """
        logger.info(f"Loading bus passenger volume data for date {date or 'latest'}")
        
        try:
            # Query Firestore
            pv_ref = self.db.collection("bus_passenger_volume")
            
            if date:
                # Query for specific date
                docs = pv_ref.where("date", "==", date).stream()
            else:
                # Get the latest data
                docs = pv_ref.order_by("date", direction=firestore.Query.DESCENDING).limit(1).stream()
            
            # Process results
            all_records = []
            for doc in docs:
                metadata = doc.to_dict()
                
                # Get records from subcollection
                records_ref = doc.reference.collection("records")
                for record_doc in records_ref.stream():
                    record = record_doc.to_dict()
                    # Add metadata
                    record['date'] = metadata.get('date')
                    record['filename'] = metadata.get('filename')
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
    
    # LTA DataMall 2.6: Passenger Volume by Origin Destination Bus Stops
    def get_bus_od_passenger_volume(self, date=None):
        """
        Get bus origin-destination passenger volume data from Firestore.
        
        Args:
            date (str, optional): Date in format YYYYMM. Defaults to latest available.
            
        Returns:
            pandas.DataFrame: Bus OD passenger volume data
        """
        logger.info(f"Loading bus OD passenger volume data for date {date or 'latest'}")
        
        try:
            # Query Firestore
            od_ref = self.db.collection("bus_od_passenger_volume")
            
            if date:
                # Query for specific date
                docs = od_ref.where("date", "==", date).stream()
            else:
                # Get the latest data
                docs = od_ref.order_by("date", direction=firestore.Query.DESCENDING).limit(1).stream()
            
            # Process results
            all_records = []
            
            for doc in docs:
                metadata = doc.to_dict()
                
                # Get chunks subcollection
                chunks_ref = doc.reference.collection("chunks")
                for chunk_doc in chunks_ref.stream():
                    # Get records from nested subcollection
                    records_ref = chunk_doc.reference.collection("records")
                    
                    for record_doc in records_ref.stream():
                        record = record_doc.to_dict()
                        # Add metadata
                        record['date'] = metadata.get('date')
                        record['filename'] = metadata.get('filename')
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
    
    # LTA DataMall 2.7: Passenger Volume by Origin Destination Train Stations
    def get_train_od_passenger_volume(self, date=None):
        """
        Get train origin-destination passenger volume data from Firestore.
        
        Args:
            date (str, optional): Date in format YYYYMM. Defaults to latest available.
            
        Returns:
            pandas.DataFrame: Train OD passenger volume data
        """
        logger.info(f"Loading train OD passenger volume data for date {date or 'latest'}")
        
        try:
            # Query Firestore
            od_ref = self.db.collection("train_od_passenger_volume")
            
            if date:
                # Query for specific date
                docs = od_ref.where("date", "==", date).stream()
            else:
                # Get the latest data
                docs = od_ref.order_by("date", direction=firestore.Query.DESCENDING).limit(1).stream()
            
            # Process results
            all_records = []
            
            for doc in docs:
                metadata = doc.to_dict()
                
                # Get chunks subcollection
                chunks_ref = doc.reference.collection("chunks")
                for chunk_doc in chunks_ref.stream():
                    # Get records from nested subcollection
                    records_ref = chunk_doc.reference.collection("records")
                    
                    for record_doc in records_ref.stream():
                        record = record_doc.to_dict()
                        # Add metadata
                        record['date'] = metadata.get('date')
                        record['filename'] = metadata.get('filename')
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
    
    # LTA DataMall 2.8: Passenger Volume by Train Stations
    def get_train_passenger_volume(self, date=None):
        """
        Get train passenger volume data from Firestore.
        
        Args:
            date (str, optional): Date in format YYYYMM. Defaults to latest available.
            
        Returns:
            pandas.DataFrame: Train passenger volume data
        """
        logger.info(f"Loading train passenger volume data for date {date or 'latest'}")
        
        try:
            # Query Firestore
            pv_ref = self.db.collection("train_passenger_volume")
            
            if date:
                # Query for specific date
                docs = pv_ref.where("date", "==", date).stream()
            else:
                # Get the latest data
                docs = pv_ref.order_by("date", direction=firestore.Query.DESCENDING).limit(1).stream()
            
            # Process results
            all_records = []
            
            for doc in docs:
                metadata = doc.to_dict()
                
                # Get chunks subcollection
                chunks_ref = doc.reference.collection("chunks")
                for chunk_doc in chunks_ref.stream():
                    # Get records from nested subcollection
                    records_ref = chunk_doc.reference.collection("records")
                    
                    for record_doc in records_ref.stream():
                        record = record_doc.to_dict()
                        # Add metadata
                        record['date'] = metadata.get('date')
                        record['filename'] = metadata.get('filename')
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
    
    # LTA DataMall 2.11: Train Service Alerts
    def get_train_service_alerts(self, active_only=True):
        """
        Get train service alerts from Firestore.
        
        Args:
            active_only (bool): Whether to return only active alerts. Defaults to True.
            
        Returns:
            pandas.DataFrame: Train service alerts data
        """
        logger.info(f"Loading train service alerts (active_only={active_only})")
        
        try:
            # Query Firestore
            alerts_ref = self.db.collection("train_service_alerts")
            
            if active_only:
                query = alerts_ref.where("is_active", "==", True)
            else:
                query = alerts_ref
            
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
            
            # Process timestamps if they exist
            timestamp_cols = ['last_updated', 'deactivated_at']
            for col in timestamp_cols:
                if col in df.columns:
                    df[col] = pd.to_datetime(df[col], errors='coerce')
            
            logger.info(f"Loaded {len(df)} train service alert records")
            return df
            
        except Exception as e:
            logger.error(f"Error loading train service alerts: {e}")
            return pd.DataFrame()
    
    # LTA DataMall 2.13: Estimated Travel Times
    def get_travel_times(self, days=30):
        """
        Get estimated travel times from Firestore.
        
        Args:
            days (int): Number of days of data to retrieve
            
        Returns:
            pandas.DataFrame: Travel times data
        """
        logger.info(f"Loading estimated travel times data for the past {days} days")
        
        # Calculate the cutoff date
        cutoff_date = datetime.now() - timedelta(days=days)
        
        # Query Firestore
        travel_times_ref = self.db.collection("estimated_travel_times")
        query = (travel_times_ref
                .where("Timestamp", ">=", cutoff_date)
                .order_by("Timestamp", direction=firestore.Query.DESCENDING))
        
        # Execute query
        docs = query.stream()
        
        # Convert to list
        records = []
        for doc in docs:
            record = doc.to_dict()
            record['id'] = doc.id
            records.append(record)
        
        if not records:
            logger.warning("No estimated travel times data found")
            return pd.DataFrame()
        
        df = pd.DataFrame(records)
        
        # Process timestamps if they exist
        if 'Timestamp' in df.columns:
            df['Timestamp'] = pd.to_datetime(df['Timestamp'], errors='coerce')
        
        logger.info(f"Loaded {len(df)} estimated travel time records")
        return df
    
    # LTA DataMall 2.14: Faulty Traffic Lights
    def get_faulty_traffic_lights(self, active_only=True):
        """
        Get faulty traffic lights data from Firestore.
        
        Args:
            active_only (bool): Whether to return only active faults. Defaults to True.
            
        Returns:
            pandas.DataFrame: Faulty traffic lights data
        """
        logger.info(f"Loading faulty traffic lights data (active_only={active_only})")
        
        try:
            # Query Firestore
            lights_ref = self.db.collection("faulty_traffic_lights")
            
            if active_only:
                query = lights_ref.where("is_active", "==", True)
            else:
                query = lights_ref
            
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
            
            # Process timestamps if they exist
            timestamp_cols = ['last_updated', 'start_timestamp', 'end_timestamp', 'resolved_at']
            for col in timestamp_cols:
                if col in df.columns:
                    df[col] = pd.to_datetime(df[col], errors='coerce')
            
            logger.info(f"Loaded {len(df)} faulty traffic light records")
            return df
            
        except Exception as e:
            logger.error(f"Error loading faulty traffic lights data: {e}")
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
                    df[col] = pd.to_datetime(df[col], errors='coerce')
            
            logger.info(f"Loaded {len(df)} planned road opening records")
            return df
            
        except Exception as e:
            logger.error(f"Error loading planned road openings data: {e}")
            return pd.DataFrame()
    
    # LTA DataMall 2.16: Approved Road Works
    def get_approved_road_works(self, status=None):
        """
        Get approved road works data from Firestore.
        
        Args:
            status (str, optional): Filter by status ('scheduled', 'in_progress', 'completed').
            
        Returns:
            pandas.DataFrame: Approved road works data
        """
        logger.info(f"Loading approved road works data (status={status or 'all'})")
        
        try:
            # Query Firestore
            works_ref = self.db.collection("approved_road_works")
            
            # Base query for active road works
            query = works_ref.where("is_active", "==", True)
            
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
                logger.warning("No approved road works data found")
                return pd.DataFrame()
            
            df = pd.DataFrame(records)
            
            # Process timestamps if they exist
            timestamp_cols = ['last_updated', 'start_timestamp', 'end_timestamp', 'completed_at']
            for col in timestamp_cols:
                if col in df.columns:
                    df[col] = pd.to_datetime(df[col], errors='coerce')
            
            logger.info(f"Loaded {len(df)} approved road work records")
            return df
            
        except Exception as e:
            logger.error(f"Error loading approved road works data: {e}")
            return pd.DataFrame()
    
    # LTA DataMall 2.18: Traffic Incidents
    def get_incidents(self, days=30, include_user_reported=True):
        """
        Get traffic incidents from Firestore.
        
        Args:
            days (int): Number of days of data to retrieve
            include_user_reported (bool): Whether to include user-reported incidents
            
        Returns:
            pandas.DataFrame: Incidents data
        """
        logger.info(f"Loading traffic incidents data for the past {days} days")
        
        # Calculate the cutoff date
        cutoff_date = datetime.now() - timedelta(days=days)
        
        # Query official incidents
        incidents_ref = self.db.collection("traffic_incidents")
        query = (incidents_ref
                .where("Timestamp", ">=", cutoff_date)
                .order_by("Timestamp", direction=firestore.Query.DESCENDING))
        
        # Execute query
        docs = query.stream()
        
        # Convert to list
        records = []
        for doc in docs:
            record = doc.to_dict()
            record['id'] = doc.id
            record['source'] = 'official'
            records.append(record)
        
        # Include user-reported incidents if requested
        if include_user_reported:
            user_incidents_ref = self.db.collection("user_reported_incidents")
            user_query = (user_incidents_ref
                         .where("time_reported", ">=", cutoff_date)
                         .where("status", "==", "active")
                         .order_by("time_reported", direction=firestore.Query.DESCENDING))
            
            user_docs = user_query.stream()
            
            for doc in user_docs:
                record = doc.to_dict()
                record['id'] = doc.id
                record['source'] = 'user-reported'
                # Normalize field names
                if 'time_reported' in record and 'Timestamp' not in record:
                    record['Timestamp'] = record['time_reported']
                records.append(record)
        
        if not records:
            logger.warning("No incidents data found")
            return pd.DataFrame()
        
        df = pd.DataFrame(records)
        
        # Process timestamps if they exist
        timestamp_cols = ['Timestamp', 'time_reported']
        for col in timestamp_cols:
            if col in df.columns:
                df[col] = pd.to_datetime(df[col], errors='coerce')
        
        logger.info(f"Loaded {len(df)} traffic incident records")
        return df
    
    # LTA DataMall 2.19: Traffic Speed Bands
    def get_traffic_speed_bands(self, days=7, limit=10000):
        """
        Get traffic speed bands from Firestore.
        
        Args:
            days (int): Number of days of data to retrieve
            limit (int): Maximum number of records to retrieve
            
        Returns:
            pandas.DataFrame: Traffic speed bands data
        """
        logger.info(f"Loading traffic speed bands data for the past {days} days")
        
        # Calculate the cutoff date
        cutoff_date = datetime.now() - timedelta(days=days)
        
        # Query Firestore
        speed_bands_ref = self.db.collection("traffic_speed_bands")
        query = (speed_bands_ref
                .where("Timestamp", ">=", cutoff_date)
                .order_by("Timestamp", direction=firestore.Query.DESCENDING)
                .limit(limit))
        
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
            df['Timestamp'] = pd.to_datetime(df['Timestamp'], errors='coerce')
        
        logger.info(f"Loaded {len(df)} traffic speed band records")
        return df
    
    # LTA DataMall 2.20: VMS/EMAS
    def get_vms_messages(self):
        """
        Get Variable Message Services (VMS) data from Firestore.
        
        Returns:
            pandas.DataFrame: VMS messages data
        """
        logger.info("Loading VMS messages data")
        
        try:
            # Query Firestore
            vms_ref = self.db.collection("vms_messages")
            
            # Execute query
            docs = vms_ref.stream()
            
            # Convert to DataFrame
            records = []
            for doc in docs:
                record = doc.to_dict()
                record['id'] = doc.id
                records.append(record)
            
            if not records:
                logger.warning("No VMS messages data found")
                return pd.DataFrame()
            
            df = pd.DataFrame(records)
            
            # Process timestamps if they exist
            if 'Timestamp' in df.columns:
                df['Timestamp'] = pd.to_datetime(df['Timestamp'], errors='coerce')
            
            logger.info(f"Loaded {len(df)} VMS message records")
            return df
            
        except Exception as e:
            logger.error(f"Error loading VMS messages data: {e}")
            return pd.DataFrame()
    
    # LTA DataMall 2.24: Station Crowd Density Real Time
    def get_station_crowd_density(self, train_line=None):
        """
        Get station crowd density data from Firestore.
        
        Args:
            train_line (str, optional): Train line code. If None, get all lines.
            
        Returns:
            dict or pandas.DataFrame: Station crowd density data
        """
        logger.info(f"Loading station crowd density data for line {train_line or 'all'}")
        
        try:
            # Query Firestore
            crowd_ref = self.db.collection("station_crowd_density")
            
            if train_line:
                # Get specific train line
                doc = crowd_ref.document(train_line).get()
                if not doc.exists:
                    logger.warning(f"No crowd density data found for train line {train_line}")
                    return pd.DataFrame()
                
                data = doc.to_dict()
                # Convert to DataFrame
                stations_data = data.get('stations', {})
                records = []
                for station_code, station_data in stations_data.items():
                    station_data['station_code'] = station_code
                    station_data['train_line'] = train_line
                    station_data['last_updated'] = data.get('last_updated')
                    records.append(station_data)
                
                return pd.DataFrame(records)
            else:
                # Get all train lines
                docs = crowd_ref.stream()
                all_records = []
                
                for doc in docs:
                    train_line = doc.id
                    data = doc.to_dict()
                    stations_data = data.get('stations', {})
                    
                    for station_code, station_data in stations_data.items():
                        station_data['station_code'] = station_code
                        station_data['train_line'] = train_line
                        station_data['last_updated'] = data.get('last_updated')
                        all_records.append(station_data)
                
                if not all_records:
                    logger.warning("No station crowd density data found")
                    return pd.DataFrame()
                
                return pd.DataFrame(all_records)
                
        except Exception as e:
            logger.error(f"Error loading station crowd density data: {e}")
            return pd.DataFrame()