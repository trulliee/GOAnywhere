from fastapi import APIRouter
from app.services.owm_data import fetch_weather_data

router = APIRouter()

@router.get("/weather")
def get_weather_data():
    """Fetch and return real-time weather data."""
    try:
        fetch_weather_data()
        return {"message": "Weather data fetched and stored successfully"}
    except Exception as e:
        return {"error": str(e)}