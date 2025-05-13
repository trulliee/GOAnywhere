import random
from datetime import datetime, timezone
import time
from dotenv import load_dotenv
import os

# Load .env variables
load_dotenv()

# Import Firestore client via your existing utility
from backend.app.database.firestore_utils import db

# Import metadata values extracted earlier
from backend.scripts.extract_firebase import (
    EXPRESSWAYS,
    ROAD_CATEGORIES,
    STARTPOINTS,
    ENDPOINTS,
    ROAD_NAMES
)

# === Cleanup Helper ===
def clear_collection(collection_name):
    print(f"Clearing collection: {collection_name}")
    collection = db.collection(collection_name)
    docs = collection.stream()
    for doc in docs:
        doc.reference.delete()
    print(f"✅ Cleared {collection_name}\n")

# === Synthetic Generation Helpers ===
def generate_estimated_travel_time():
    now = datetime.now(timezone.utc)

    expressway = random.choice(EXPRESSWAYS)
    startpoint = random.choice(STARTPOINTS)
    endpoint = random.choice(ENDPOINTS)
    farendpoint = random.choice(ENDPOINTS)
    direction = random.choice([1, 2])
    esttime = round(random.uniform(1, 25), 1)

     # 🔥 FIX: Append a timestamp or UUID to avoid overwrite
    unique_suffix = str(int(time.time() * 1e6))[-6:]  # Last 6 digits of microsecond time
    doc_id = f"{expressway}_{startpoint}_{endpoint}_{direction}_{unique_suffix}".replace(" ", "_").replace("/", "-")

    return doc_id, {
        "Expressway": expressway,
        "Startpoint": startpoint,
        "Endpoint": endpoint,
        "Farendpoint": farendpoint,
        "Direction": direction,
        "Esttime": esttime,
        "Timestamp": now,  # Native datetime with UTC timezone
        "date": now.strftime("%Y-%m-%d")
    }


def generate_traffic_speed_band():
    # Realistic speed band definitions (from LTA)
    speed_band_definitions = {
        1: (0, 8),
        2: (10, 19),
        3: (20, 29),
        4: (30, 39),
        5: (40, 49),
        6: (50, 59),
        7: (60, 69),
        8: (70, 120)
    }

    speed_band = random.randint(1, 8)
    min_speed, max_speed = speed_band_definitions[speed_band]

    # Singapore lat/lon boundaries
    lat_bounds = (1.22, 1.47)
    lon_bounds = (103.6, 104.1)

    # Generate realistic start and end lat/lon pairs
    start_lat = round(random.uniform(*lat_bounds), 12)
    start_lon = round(random.uniform(*lon_bounds), 12)
    end_lat = round(start_lat + random.uniform(-0.0015, 0.0015), 12)
    end_lon = round(start_lon + random.uniform(-0.0015, 0.0015), 12)

    now = datetime.now(timezone.utc)

    return {
        "LinkID": str(random.randint(103000000, 103999999)),
        "RoadName": random.choice(ROAD_NAMES),
        "RoadCategory": random.choice(ROAD_CATEGORIES),
        "SpeedBand": speed_band,
        "MinSpeed": min_speed,
        "MaxSpeed": max_speed,
        "StartLatitude": start_lat,
        "StartLongitude": start_lon,
        "EndLatitude": end_lat,
        "EndLongitude": end_lon,
        "Timestamp": now,  # Native datetime with UTC timezone
        "date": now.strftime("%Y-%m-%d")
    }



def generate_traffic_incident():
    from datetime import datetime, timezone

    incident_types = [
        "Accident", "Roadwork", "Vehicle breakdown", "Weather", "Obstacle",
        "Road Block", "Heavy Traffic", "Miscellaneous", "Diversion",
        "Unattended Vehicle", "Fire", "Plant Failure", "Reverse Flow"
    ]

    expressways = ["PIE", "AYE", "CTE", "ECP", "SLE", "BKE", "TPE"]
    landmarks = ["BKE", "Tuas", "City", "Changi Airport", "Toa Payoh", "Jurong", "Woodlands"]
    lanes = [1, 2, 3, 4]

    now = datetime.now(timezone.utc)
    incident_type = random.choice(incident_types)
    expressway = random.choice(expressways)
    landmark = random.choice(landmarks)
    lane = random.choice(lanes)

    lat = round(random.uniform(1.22, 1.47), 15)
    lon = round(random.uniform(103.6, 104.1), 15)

    # Generate doc ID using epoch format similar to Firestore
    epoch = time.time()
    doc_id = f"incident_{epoch:.6f}"

    msg = f"({now.day}/{now.month}){now.strftime('%H:%M')} {incident_type} on {expressway} (towards {landmark}) after {landmark}. Avoid lane {lane}."

    return doc_id, {
        "Type": incident_type,
        "Latitude": lat,
        "Longitude": lon,
        "Message": msg,
        "Timestamp": now,  # Native datetime with UTC timezone
        "date": now.strftime("%Y-%m-%d")
    }

# === Backfilling Function ===
def backfill_collection(collection_name, generator_fn, count):
    print(f"Backfilling {collection_name} with {count} records...")
    batch = db.batch()
    collection = db.collection(collection_name)

    for i in range(count):
        result = generator_fn()
        if isinstance(result, tuple):
            doc_id, data = result
            doc_ref = collection.document(doc_id)
        else:
            data = result
            doc_ref = collection.document(data.get("LinkID") or "")  # fallback
        batch.set(doc_ref, data)

        if (i + 1) % 500 == 0:
            batch.commit()
            batch = db.batch()
            print(f"Committed {i + 1} records")

    batch.commit()
    print(f"✅ Finished backfilling {collection_name}\n")


# === Entry Point ===
if __name__ == "__main__":
    # clear_collection("estimated_travel_times")
    # clear_collection("traffic_speed_bands")
    # clear_collection("traffic_incidents")

    backfill_collection("estimated_travel_times", generate_estimated_travel_time, 5000)
    # backfill_collection("traffic_speed_bands", generate_traffic_speed_band, 5000)
    # backfill_collection("traffic_incidents", generate_traffic_incident, 5000)