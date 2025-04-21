import httpx
import os
from typing import Dict, Any

# Use your Mapbox token from environment variable
MAPBOX_ACCESS_TOKEN = os.environ.get('MAPBOX_ACCESS_TOKEN', 'pk.eyJ1IjoidHJvbGxleTEyNCIsImEiOiJjbThkOTQ2ODgybDF2MmpyM2YwbzQwaHhwIn0.W9SmB0piy6kIiMp3BPmZxA')

async def geocode_location(location: str) -> Dict[str, Any]:
    """
    Geocode a location using Mapbox
    
    Args:
        location (str): Location to geocode
    
    Returns:
        dict: Geocoding results with latitude, longitude, formatted address
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f'https://api.mapbox.com/geocoding/v5/mapbox.places/{location}.json',
                params={
                    'access_token': MAPBOX_ACCESS_TOKEN,
                    'country': 'sg',  # Limit to Singapore
                    'limit': 1
                }
            )
            
            data = response.json()
            
            if data['features']:
                feature = data['features'][0]
                return {
                    'latitude': feature['center'][1],
                    'longitude': feature['center'][0],
                    'formatted_address': feature['place_name']
                }
            
            return {'error': 'Location not found'}
    
    except Exception as e:
        print(f"Geocoding error: {e}")
        return {'error': 'Geocoding failed'}

async def process_location_input(location: str, coordinates: Dict[str, float] = None) -> Dict[str, Any]:
    """
    Process location input, either using provided coordinates or geocoding
    
    Args:
        location (str): Location name
        coordinates (dict, optional): Predefined coordinates
    
    Returns:
        dict: Location details with latitude, longitude
    """
    # If coordinates are provided, use them directly
    if coordinates:
        return {
            'latitude': coordinates['lat'],
            'longitude': coordinates['lng']
        }
    
    # Otherwise, geocode the location
    return await geocode_location(location)