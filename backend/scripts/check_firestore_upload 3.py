import firebase_admin
from firebase_admin import firestore
from database.firestore_utils import fetch_firestore_data

# Ensure Firebase is initialized
if not firebase_admin._apps:
    firebase_admin.initialize_app()

# Firestore database client
db = firestore.client()

def check_traffic_data():
    """Check and print some sample traffic incident data from Firestore."""
    traffic_data = fetch_firestore_data("traffic_incidents", limit=5)
    print("Sample Traffic Data:", traffic_data)

def check_weather_data():
    """Check and print some sample weather data from Firestore."""
    weather_data = fetch_firestore_data("weather_data", limit=5)
    print("Sample Weather Data:", weather_data)

if __name__ == "__main__":
    check_traffic_data()
    check_weather_data()
