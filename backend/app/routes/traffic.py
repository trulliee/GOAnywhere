from fastapi import APIRouter
from app.services.lta_data import (
    get_traffic_incidents, 
    get_estimated_travel_times, 
    get_traffic_speed_bands,
    get_vms_messages,
    get_faulty_traffic_lights,
    get_planned_road_openings,
    get_approved_road_works,
    get_station_crowd_density,
    get_station_crowd_forecast,
    get_traffic_flow,
    get_train_service_alerts,
    get_bus_arrival,
    get_bus_services,
    get_bus_routes,
    get_bus_passenger_volume,
    get_bus_od_passenger_volume,
    get_train_od_passenger_volume,
    get_train_passenger_volume
)
from app.services.data_gov import get_peak_traffic_conditions, get_traffic_metadata

router = APIRouter()

# Existing endpoints
@router.get("/traffic/estimated-travel-times")
def fetch_estimated_travel_times():
    """Fetch and store estimated travel times of expressways."""
    try:
        get_estimated_travel_times()
        return {"message": "Estimated travel times fetched and stored successfully"}
    except Exception as e:
        return {"error": str(e)}

@router.get("/traffic/traffic-incidents")
def fetch_traffic_data():
    """Fetch and store real-time traffic incidents data."""
    try:
        get_traffic_incidents()
        return {"message": "Traffic incidents fetched and stored successfully"}
    except Exception as e:
        return {"error": str(e)}

@router.get("/traffic/speed-bands")
def fetch_traffic_speed_bands():
    """Fetch and store real-time traffic speed bands data."""
    try:
        get_traffic_speed_bands()
        return {"message": "Traffic speed bands data fetched and stored successfully"}
    except Exception as e:
        return {"error": str(e)}
    
@router.get("/traffic/vms")
def fetch_vms_messages():
    """Fetch and store variable message services (VMS) data."""
    try:
        get_vms_messages()
        return {"message": "VMS messages fetched and stored successfully"}
    except Exception as e:
        return {"error": str(e)}

@router.get("/traffic/peak-conditions")
def fetch_peak_traffic_conditions():
    """Fetch and store road traffic conditions during peak hours."""
    try:
        success = get_peak_traffic_conditions()
        if success:
            return {"message": "Peak hour traffic conditions fetched and stored successfully"}
        else:
            return {"error": "Failed to fetch peak hour traffic conditions"}
    except Exception as e:
        return {"error": str(e)}
    
@router.get("/traffic/metadata/{collection_id}")
def fetch_collection_metadata(collection_id: int):
    """Fetch metadata for a specific data.gov.sg collection."""
    try:
        metadata = get_traffic_metadata(collection_id)
        if metadata:
            return {"message": "Metadata fetched successfully", "data": metadata}
        else:
            return {"error": "Failed to fetch metadata"}
    except Exception as e:
        return {"error": str(e)}

# New endpoints for additional data types
@router.get("/traffic/faulty-traffic-lights")
def fetch_faulty_traffic_lights():
    """Fetch and store faulty traffic lights data."""
    try:
        get_faulty_traffic_lights()
        return {"message": "Faulty traffic lights data fetched and stored successfully"}
    except Exception as e:
        return {"error": str(e)}

@router.get("/traffic/planned-road-openings")
def fetch_planned_road_openings():
    """Fetch and store planned road openings data."""
    try:
        get_planned_road_openings()
        return {"message": "Planned road openings data fetched and stored successfully"}
    except Exception as e:
        return {"error": str(e)}

@router.get("/traffic/approved-road-works")
def fetch_approved_road_works():
    """Fetch and store approved road works data."""
    try:
        get_approved_road_works()
        return {"message": "Approved road works data fetched and stored successfully"}
    except Exception as e:
        return {"error": str(e)}

@router.get("/traffic/station-crowd-density")
def fetch_station_crowd_density(train_line: str = None):
    """Fetch and store real-time station crowd density data."""
    try:
        get_station_crowd_density(train_line)
        return {"message": f"Station crowd density data for {train_line or 'all lines'} fetched and stored successfully"}
    except Exception as e:
        return {"error": str(e)}

@router.get("/traffic/station-crowd-forecast")
def fetch_station_crowd_forecast(train_line: str = None):
    """Fetch and store station crowd forecast data."""
    try:
        get_station_crowd_forecast(train_line)
        return {"message": f"Station crowd forecast data for {train_line or 'all lines'} fetched and stored successfully"}
    except Exception as e:
        return {"error": str(e)}

@router.get("/traffic/traffic-flow")
def fetch_traffic_flow():
    """Fetch and store traffic flow data."""
    try:
        get_traffic_flow()
        return {"message": "Traffic flow data fetched and stored successfully"}
    except Exception as e:
        return {"error": str(e)}

@router.get("/train/service-alerts")
def fetch_train_service_alerts():
    """Fetch and store train service alerts data."""
    try:
        get_train_service_alerts()
        return {"message": "Train service alerts data fetched and stored successfully"}
    except Exception as e:
        return {"error": str(e)}

# Bus data endpoints
@router.get("/bus/arrival")
def fetch_bus_arrival(bus_stop_code: str):
    """Fetch and store bus arrival data for a specific bus stop."""
    try:
        get_bus_arrival(bus_stop_code)
        return {"message": f"Bus arrival data for stop {bus_stop_code} fetched and stored successfully"}
    except Exception as e:
        return {"error": str(e)}

@router.get("/bus/services")
def fetch_bus_services():
    """Fetch and store bus services data."""
    try:
        get_bus_services()
        return {"message": "Bus services data fetched and stored successfully"}
    except Exception as e:
        return {"error": str(e)}

@router.get("/bus/routes")
def fetch_bus_routes():
    """Fetch and store bus routes data."""
    try:
        get_bus_routes()
        return {"message": "Bus routes data fetched and stored successfully"}
    except Exception as e:
        return {"error": str(e)}

@router.get("/bus/passenger-volume")
def fetch_bus_passenger_volume(date: str = None):
    """Fetch and store bus passenger volume data."""
    try:
        get_bus_passenger_volume(date)
        return {"message": f"Bus passenger volume data for {date or 'previous month'} fetched and stored successfully"}
    except Exception as e:
        return {"error": str(e)}

@router.get("/bus/od-passenger-volume")
def fetch_bus_od_passenger_volume(date: str = None):
    """Fetch and store bus origin-destination passenger volume data."""
    try:
        get_bus_od_passenger_volume(date)
        return {"message": f"Bus OD passenger volume data for {date or 'previous month'} fetched and stored successfully"}
    except Exception as e:
        return {"error": str(e)}

# Train data endpoints
@router.get("/train/passenger-volume")
def fetch_train_passenger_volume(date: str = None):
    """Fetch and store train passenger volume data."""
    try:
        get_train_passenger_volume(date)
        return {"message": f"Train passenger volume data for {date or 'previous month'} fetched and stored successfully"}
    except Exception as e:
        return {"error": str(e)}

@router.get("/train/od-passenger-volume")
def fetch_train_od_passenger_volume(date: str = None):
    """Fetch and store train origin-destination passenger volume data."""
    try:
        get_train_od_passenger_volume(date)
        return {"message": f"Train OD passenger volume data for {date or 'previous month'} fetched and stored successfully"}
    except Exception as e:
        return {"error": str(e)}

@router.get("/check-all-data-sources")
def check_all_data_sources():
    """Check all LTA data sources in Firestore."""
    collections = [
        "traffic_incidents", "estimated_travel_times", "traffic_speed_bands",
        "vms_messages", "faulty_traffic_lights", "planned_road_openings",
        "approved_road_works", "station_crowd_density", "station_crowd_forecast",
        "traffic_flow", "train_service_alerts", "bus_arrival", "bus_services",
        "bus_routes", "bus_passenger_volume", "bus_od_passenger_volume",
        "train_passenger_volume", "train_od_passenger_volume"
    ]
    
    results = {}
    for collection in collections:
        try:
            from app.database.firestore_utils import fetch_firestore_data
            data = fetch_firestore_data(collection, limit=1)
            if data:
                results[collection] = {
                    "status": "active",
                    "latest_timestamp": data[0].get("timestamp", "N/A"),
                    "record_count": len(data)
                }
            else:
                results[collection] = {
                    "status": "empty",
                    "message": "No data found"
                }
        except Exception as e:
            results[collection] = {
                "status": "error",
                "message": str(e)
            }
    
    return {"results": results}