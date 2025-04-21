import os
from google.cloud import secretmanager, storage
import firebase_admin
from firebase_admin import firestore
from app.services.lta_data import (
    get_bus_services, get_bus_routes, get_train_service_alerts, get_estimated_travel_times,
    get_faulty_traffic_lights, get_planned_road_openings, get_approved_road_works,
    get_traffic_incidents, get_traffic_speed_bands, get_vms_messages,
    get_station_crowd_density, get_station_crowd_forecast, get_traffic_flow,
    get_bus_passenger_volume, get_bus_od_passenger_volume,
    get_train_od_passenger_volume, get_train_passenger_volume
)
from app.services.data_gov import get_peak_traffic_conditions, get_24hr_weather_forecast
from app.scrapers.events_scraper import scrape_visit_singapore_events

def setup_credentials_from_secret(secret_id="firebase-service-account-key"):
    client = secretmanager.SecretManagerServiceClient()
    name = f"projects/541900038032/secrets/{secret_id}/versions/latest"
    response = client.access_secret_version(name=name)
    key_data = response.payload.data.decode("UTF-8")
    
    key_path = os.path.join("storage", "service-account-key.json")
    with open(key_path, "w") as f:
        f.write(key_data)
    
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = key_path
    print(f"✅ Loaded credentials from Secret Manager into {key_path}")

# # Step 1: Load credentials
# setup_credentials_from_secret()

# Step 2: Initialize Firebase
if not firebase_admin._apps:
    firebase_admin.initialize_app()

db = firestore.client()
storage_client = storage.Client()

# Step 3: Fetch & store all data
def fetch_all_data():
    print("\nFetching data from APIs...\n")
    get_bus_services()
    get_bus_routes()
    get_train_service_alerts()
    get_estimated_travel_times()
    get_faulty_traffic_lights()
    get_planned_road_openings()
    get_approved_road_works()
    get_traffic_incidents()
    get_traffic_speed_bands()
    get_vms_messages()
    get_station_crowd_density()
    get_station_crowd_forecast()
    get_traffic_flow()
    get_bus_passenger_volume()
    get_bus_od_passenger_volume()
    get_train_od_passenger_volume()
    get_train_passenger_volume()
    get_peak_traffic_conditions()
    get_24hr_weather_forecast()
    scrape_visit_singapore_events(max_pages=3)
    print("\n✅ All data fetched and stored!\n")

def check_firestore_collections():
    collections_to_check = [
        "bus_arrivals", "bus_services_info", "bus_routes", "bus_stops",
        "bus_passenger_volume", "bus_od_passenger_volume", "train_od_passenger_volume",
        "train_passenger_volume", "train_service_alerts", "estimated_travel_times",
        "faulty_traffic_lights", "planned_road_openings", "approved_road_works",
        "traffic_incidents", "traffic_speed_bands", "vms_messages",
        "station_crowd_density", "station_crowd_forecast", "traffic_flow",
        "peak_traffic_conditions", "weather_forecast_24hr", "singapore_events"
    ]
    results = {}
    for collection in collections_to_check:
        try:
            docs = db.collection(collection).limit(5).stream()
            doc_count = len(list(docs))
            results[collection] = f"✅ Contains {doc_count} documents" if doc_count else "❌ Collection exists but contains no documents"
        except Exception as e:
            results[collection] = f"❌ Error: {str(e)}"
    return results

def check_gcs_files(bucket_name="goanywhere-traffic-data-history"):
    try:
        bucket = storage_client.bucket(bucket_name)
        files_to_check = [
            "uploads/PublicHolidaysfor2025.csv",
            "uploads/RoadTrafficAccidentCasualtiesMonthly.csv",
            "uploads/RoadTrafficAccidentCasualtiesAnnual.csv",
            "uploads/HistoricalDailyWeatherRecords.csv",
            "uploads/RoadNetwork.kml"
        ]
        results = {}
        for file_path in files_to_check:
            blob = bucket.blob(file_path)
            if blob.exists():
                blob.reload()
                if blob.size is not None:
                    size_mb = blob.size / (1024 * 1024)
                    results[file_path] = f"✅ Exists - Size: {size_mb:.2f} MB"
                else:
                    results[file_path] = "⚠️ Exists but size is unknown"
            else:
                results[file_path] = "❌ Does not exist"
        return results
    except Exception as e:
        return {"Error": f"Failed to check GCS files: {str(e)}"}

if __name__ == "__main__":
    # Step 4: Fetch everything
    fetch_all_data()

    # Step 5: Check Firestore contents
    print("\n=== FIRESTORE COLLECTIONS ===")
    firebase_results = check_firestore_collections()
    for collection, status in firebase_results.items():
        print(f"{collection}: {status}")
    
    # Step 6: Check GCS files
    print("\n=== GCS FILES ===")
    gcs_results = check_gcs_files()
    for file_path, status in gcs_results.items():
        print(f"{file_path}: {status}")
