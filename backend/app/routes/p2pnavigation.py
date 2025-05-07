# app/routes/p2pnavigation.py

from fastapi import APIRouter, HTTPException
import googlemaps
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# ✅ Define prefix and tags here
router = APIRouter(
    prefix="/p2pnavigation",
    tags=["P2P Navigation"]
)

# Get API key
GMAPS_API_KEY = os.getenv("GMAPS_API_KEY")
if not GMAPS_API_KEY:
    raise ValueError("Google Maps API key not found in environment variables")

# Google Maps client
gmaps = googlemaps.Client(key=GMAPS_API_KEY)

# === GET /p2pnavigation/get_route ===
@router.get("/get_route")
async def get_route(start: str, end: str):
    try:
        directions = gmaps.directions(start, end, mode="driving")
        if not directions:
            raise HTTPException(status_code=404, detail="No route found")

        route_leg = directions[0]["legs"][0]
        distance = route_leg["distance"]["text"]
        duration = route_leg["duration"]["text"]
        polyline = directions[0]["overview_polyline"]["points"]

        start_coords = {
            "lat": route_leg["start_location"]["lat"],
            "lng": route_leg["start_location"]["lng"]
        }
        end_coords = {
            "lat": route_leg["end_location"]["lat"],
            "lng": route_leg["end_location"]["lng"]
        }

        return {
            "polyline": polyline,
            "distance": distance,
            "duration": duration,
            "start_coords": start_coords,
            "end_coords": end_coords
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
