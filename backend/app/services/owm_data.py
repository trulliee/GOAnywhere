from google.cloud import secretmanager
import requests
from app.database.firestore_utils import store_weather_data

# Create Secret Manager client
client = secretmanager.SecretManagerServiceClient()

# Access OpenWeatherMap API key from Secret Manager
def get_secret(secret_name):
    response = client.access_secret_version(name=secret_name)
    return response.payload.data.decode("UTF-8").strip()

# Fetch OpenWeatherMap API key from Secret Manager
WEATHER_API_KEY = get_secret("projects/541900038032/secrets/openweather-api-key/versions/latest")
WEATHER_URL = "https://api.openweathermap.org/data/2.5/weather"

def fetch_weather_data(city="Singapore"):
    """Fetches real-time weather data and stores it in Firestore."""
    params = {"q": city, "appid": WEATHER_API_KEY, "units": "metric"}
    
    try:
        response = requests.get(WEATHER_URL, params=params)
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
        print(f"Weather data fetched and stored: {weather_info}")

        return {"message": "Weather data fetched and stored", "data": weather_info}

    except requests.exceptions.RequestException as e:
        print(f"Error fetching weather data: {e}")
        return {"error": str(e)}
    
if __name__ == "__main__":
    fetch_weather_data()