from fastapi import APIRouter
from app.services.owm_data import fetch_weather_data
from app.services.data_gov import get_24hr_weather_forecast

router = APIRouter()

@router.get("/weather")
def get_weather_data():
    """Fetch and return real-time weather data."""
    try:
        fetch_weather_data()
        return {"message": "Weather data fetched and stored successfully"}
    except Exception as e:
        return {"error": str(e)}

@router.get("/weather/forecast-24hr")
def fetch_24hr_weather_forecast():
    """Fetch and store 24-hour weather forecast."""
    try:
        success = get_24hr_weather_forecast()
        if success:
            return {"message": "24-hour weather forecast fetched and stored successfully"}
        else:
            return {"error": "Failed to fetch 24-hour weather forecast"}
    except Exception as e:
        return {"error": str(e)}