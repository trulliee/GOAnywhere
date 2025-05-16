from google.cloud import secretmanager
import requests
import os
from app.database.firestore_utils import store_weather_data

# Create Secret Manager client
client = secretmanager.SecretManagerServiceClient()

def get_secret(secret_id: str, version_id: str = "latest") -> str:
    project_id = os.environ.get("GCP_PROJECT_ID", "goanywhere-c55c8")
    name = f"projects/{project_id}/secrets/{secret_id}/versions/{version_id}"
    response = client.access_secret_version(request={"name": name})
    return response.payload.data.decode("UTF-8").strip()  # ✅ strip newlines

# Fetch API key once from Secret Manager
WEATHER_API_KEY = get_secret("openweather-api-key")  # ✅ actual secret usage

def fetch_weather_data(city="Singapore"):
    """Fetches real-time weather data and stores it in Firestore."""
    try:
        params = {
            "q": city,
            "appid": WEATHER_API_KEY,  # ✅ correct key
            "units": "metric"
        }

        url = "https://api.openweathermap.org/data/2.5/weather"
        response = requests.get(url, params=params)
        response.raise_for_status()
        data = response.json()

        # Extract relevant fields
        weather_info = {
            "city": city,
            "temperature": data["main"]["temp"],
            "humidity": data["main"]["humidity"],
            "weather": data["weather"][0]["description"]
        }

        # Store in Firebase Firestore
        store_weather_data(weather_info)

        return {"message": "Weather data fetched and stored", "data": weather_info}

    except requests.exceptions.RequestException as e:
        print(f"Error fetching weather data: {e}")
        return {"error": str(e)}
