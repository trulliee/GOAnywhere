from fastapi import APIRouter, HTTPException
import googlemaps
from app.database.firestore_utils import db
from typing import Dict
import googlemaps
import os
from dotenv import load_dotenv

# Load environment variables from the .env file
load_dotenv()

router = APIRouter()

# Retrieve Google Maps API Key from environment variable
GMAPS_API_KEY = os.getenv("GMAPS_API_KEY")
if not GMAPS_API_KEY:
    raise ValueError("Google Maps API key not found in environment variables")

gmaps = googlemaps.Client(key=GMAPS_API_KEY)  # Keep only one instance globally

# Helper function to get user data
def get_user_type(user_id: str) -> str:
    user_ref = db.collection('users').document(user_id).get()  # Using `db` from firestore_utils
    if user_ref.exists:
        data = user_ref.to_dict()
        return data.get('userType', 'unregistered')  # Default to unregistered if not found
    return "unregistered"

# Helper function to fetch traffic data from Firestore
def get_traffic_data() -> dict:
    traffic_ref = db.collection('traffic_incidents').stream()  # Using `db` from firestore_utils
    incidents = []
    try:
        for doc in traffic_ref:
            data = doc.to_dict()
            incidents.append({
                "type": data.get('Type', 'Unknown'),
                "message": data.get('Message', 'No message'),
                "latitude": data.get('Latitude', 0.0),
                "longitude": data.get('Longitude', 0.0)
            })
    except Exception as e:
        print(f"Error fetching traffic data: {e}")
    
    return {
        "incidents": incidents  # Just returning the incidents for later use
    }

# Dashboard endpoint to fetch route and traffic info
@router.get("/dashboard/{user_id}")
async def get_dashboard(user_id: str, latitude: float, longitude: float):
    user_type = get_user_type(user_id)
    
    # Predefined destination endpoint
    end = "Jurong East"  # Example destination, can be dynamic or user-specific
    
    # Call Google Maps Directions API to get route details from user's current location
    try:
        directions = gmaps.directions(
            origin=(latitude, longitude),  # Using the user's current location
            destination=end, 
            mode="driving"
        )
        if not directions:
            raise HTTPException(status_code=404, detail="No route found")
        
        route_leg = directions[0]["legs"][0]
        distance = route_leg["distance"]["text"]
        duration = route_leg["duration"]["text"]
        polyline = directions[0]["overview_polyline"]["points"]

        start_coords = route_leg["start_location"]
        end_coords = route_leg["end_location"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching route data: {str(e)}")
    
    # Extracting distance and duration values
    distance_km = float(distance.split(" ")[0])  # Extract distance in km
    duration_mins = float(duration.split(" ")[0])  # Extract duration in mins
    
    # Calculate travel time per 10 km
    travel_time_per_10km = (duration_mins / distance_km) * 10  # Time per 10 km
    
    # Calculate average speed (km/h)
    average_speed = distance_km / (duration_mins / 60)  # Distance divided by time in hours

    # Fetch traffic data (existing logic)
    traffic_data = get_traffic_data()
    
    # Estimate congestion level based on traffic data
    congestion_level = "low"
    num_incidents = len(traffic_data["incidents"])
    
    if num_incidents > 5:
        congestion_level = "high"
    elif num_incidents > 2:
        congestion_level = "medium"
    
    # Total jam (based on number of incidents)
    total_jam = num_incidents

    # Prepare the dashboard response
    response = {
        "travel_time_per_10km": f"{travel_time_per_10km:.1f} mins",  # Format to 1 decimal place
        "congestion_level": congestion_level,
        "average_speed": f"{average_speed:.1f} km/h",  # Format to 1 decimal place
        "total_jam": total_jam,
        "user_type": user_type
    }
    
    return response
