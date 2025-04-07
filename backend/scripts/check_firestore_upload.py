import firebase_admin
from firebase_admin import firestore
from app.database.firestore_utils import fetch_firestore_data  # Updated import path

# Ensure Firebase is initialized
if not firebase_admin._apps:
    firebase_admin.initialize_app()

# Firestore database client
db = firestore.client()

def check_collections_data():
    """Check and print data summaries for all LTA data collections."""
    collections = [
        "traffic_incidents", "estimated_travel_times", "traffic_speed_bands",
        "vms_messages", "faulty_traffic_lights", "planned_road_openings",
        "approved_road_works", "station_crowd_density", "station_crowd_forecast",
        "traffic_flow", "train_service_alerts", "bus_arrival", "bus_services",
        "bus_routes", "bus_passenger_volume", "bus_od_passenger_volume",
        "train_passenger_volume", "train_od_passenger_volume", "weather_data"
    ]
    
    for collection in collections:
        try:
            data = fetch_firestore_data(collection, limit=1)
            if data:
                print(f"{collection}: ✅ Data exists. Latest timestamp: {data[0].get('timestamp', 'N/A')}")
            else:
                print(f"{collection}: ❌ No data found")
        except Exception as e:
            print(f"{collection}: ❌ Error checking data: {str(e)}")

def check_traffic_data():
    """Check and print some sample traffic incident data from Firestore."""
    traffic_data = fetch_firestore_data("traffic_incidents", limit=5)
    print("Sample Traffic Data:", traffic_data)

def check_weather_data():
    """Check and print some sample weather data from Firestore."""
    weather_data = fetch_firestore_data("weather_data", limit=5)
    print("Sample Weather Data:", weather_data)

if __name__ == "__main__":
    check_collections_data()
    check_traffic_data()
    check_weather_data()