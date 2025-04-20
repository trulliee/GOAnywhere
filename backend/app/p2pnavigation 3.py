from fastapi import APIRouter, HTTPException
from fastapi.middleware.cors import CORSMiddleware
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

# Route for getting directions
@router.get("/get_route")
async def get_route(start: str, end: str):
    try:
        # Fetch route details from Google Maps Directions API
        directions = gmaps.directions(start, end, mode="driving")

        if not directions:
            raise HTTPException(status_code=404, detail="No route found")

        route_leg = directions[0]["legs"][0]  # Extract first leg of the route
        distance = route_leg["distance"]["text"]
        duration = route_leg["duration"]["text"]
        polyline = directions[0]["overview_polyline"]["points"]

        # Correct extraction of start and end coordinates
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
