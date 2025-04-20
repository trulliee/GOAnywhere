from fastapi import APIRouter
from app.services.lta_data import get_traffic_incidents, get_estimated_travel_times, get_traffic_speed_bands
from app.services.data_gov import get_peak_traffic_conditions, get_traffic_metadata

router = APIRouter()

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
    
from app.services.lta_data import get_traffic_incidents, get_estimated_travel_times, get_traffic_speed_bands, get_vms_messages

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