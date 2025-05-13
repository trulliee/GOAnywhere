from google.cloud import firestore

def extract_unique_metadata():
    db = firestore.Client()

    travel_times_docs = db.collection("estimated_travel_times").stream()
    speed_bands_docs = db.collection("traffic_speed_bands").stream()

    expressways = set()
    startpoints = set()
    endpoints = set()
    road_names = set()
    road_categories = set()

    for doc in travel_times_docs:
        data = doc.to_dict()
        expressways.add(data.get("Name"))
        startpoints.add(data.get("StartPoint"))
        endpoints.add(data.get("EndPoint"))

    for doc in speed_bands_docs:
        data = doc.to_dict()
        road_names.add(data.get("RoadName"))
        road_categories.add(data.get("RoadCategory"))

    # Remove None values caused by incomplete records
    expressways = sorted([v for v in expressways if v])
    startpoints = sorted([v for v in startpoints if v])
    endpoints = sorted([v for v in endpoints if v])
    road_names = sorted([v for v in road_names if v])
    road_categories = sorted([v for v in road_categories if v])

    # Provide fallback values if any list is empty
    if not expressways:
        expressways = ["AYE", "PIE", "CTE", "ECP", "SLE", "BKE", "TPE", "KPE"]
    if not startpoints:
        startpoints = ["ALEXANDRA RD", "JURONG EAST", "CITY", "BEDOK", "CHANGI AIRPORT"]
    if not endpoints:
        endpoints = ["CITY", "TAMPINES", "TOA PAYOH", "WOODLANDS", "JURONG WEST"]
    if not road_names:
        road_names = ["KENT ROAD", "ORCHARD ROAD", "TAMPINES AVE 5", "GEYLANG ROAD"]
    if not road_categories:
        road_categories = ["A", "B", "C", "D", "E", "F"]

    return {
        "expressways": expressways,
        "startpoints": startpoints,
        "endpoints": endpoints,
        "road_names": road_names,
        "road_categories": road_categories,
    }

# === Extract on import ===
_metadata = extract_unique_metadata()
EXPRESSWAYS = _metadata["expressways"]
STARTPOINTS = _metadata["startpoints"]
ENDPOINTS = _metadata["endpoints"]
ROAD_NAMES = _metadata["road_names"]
ROAD_CATEGORIES = _metadata["road_categories"]

# Example usage
if __name__ == "__main__":
    from pprint import pprint
    pprint(_metadata)
