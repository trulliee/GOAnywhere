from fastapi import APIRouter
from app.services.lta_data import get_traffic_incidents

router = APIRouter()

@router.get("/traffic")
def fetch_traffic_data():
    """Fetch and store real-time traffic data."""
    try:
        get_traffic_incidents()
        return {"message": "Traffic data fetched and stored successfully"}
    except Exception as e:
        return {"error": str(e)}