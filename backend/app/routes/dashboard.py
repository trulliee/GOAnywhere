# app/routes/dashboard.py

from fastapi import APIRouter, HTTPException
import googlemaps
from app.database.firestore_utils import db
from typing import Dict
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# ✅ Define prefix and tags here instead of main.py
router = APIRouter(
    prefix="/dashboard",
    tags=["Dashboard"]
)

GMAPS_API_KEY = os.getenv("GMAPS_API_KEY")
if not GMAPS_API_KEY:
    raise ValueError("Google Maps API key not found in environment variables")

gmaps = googlemaps.Client(key=GMAPS_API_KEY)

def get_user_type(user_id: str) -> str:
    user_ref = db.collection('users').document(user_id).get()
    if user_ref.exists:
        return user_ref.to_dict().get('userType', 'unregistered')
    return "unregistered"

def get_traffic_data() -> dict:
    traffic_ref = db.collection('traffic_incidents').stream()
    incidents = []
    for doc in traffic_ref:
        data = doc.to_dict()
        incidents.append({
            "type": data.get('Type', 'Unknown'),
            "message": data.get('Message', 'No message'),
            "latitude": data.get('Latitude', 0.0),
            "longitude": data.get('Longitude', 0.0)
        })
    return {"incidents": incidents}

@router.get("/{user_id}")
async def get_dashboard(user_id: str, latitude: float, longitude: float):
    user_type = get_user_type(user_id)
    end = "Jurong East"

    try:
        directions = gmaps.directions(
            origin=(latitude, longitude),
            destination=end,
            mode="driving"
        )
        if not directions:
            raise HTTPException(status_code=404, detail="No route found")

        route_leg = directions[0]["legs"][0]
        distance_km = float(route_leg["distance"]["text"].split()[0])
        duration_mins = float(route_leg["duration"]["text"].split()[0])

        travel_time_per_10km = (duration_mins / distance_km) * 10
        average_speed = distance_km / (duration_mins / 60)

        traffic_data = get_traffic_data()
        num_incidents = len(traffic_data["incidents"])
        congestion_level = (
            "high" if num_incidents > 5 else
            "medium" if num_incidents > 2 else
            "low"
        )

        return {
            "travel_time_per_10km": f"{travel_time_per_10km:.1f} mins",
            "congestion_level": congestion_level,
            "average_speed": f"{average_speed:.1f} km/h",
            "total_jam": num_incidents,
            "user_type": user_type
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching route data: {str(e)}")
