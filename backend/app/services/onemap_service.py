# app/services/onemap_service.py
import requests
import json
import os
from datetime import datetime, timedelta

# Store token info
token_info = {
    'access_token': None,
    'expiry_time': None
}

def get_token():
    """
    Gets a valid OneMap API token.
    Refreshes token if expired.
    
    Returns:
        str: Valid OneMap API token
    """
    now = datetime.now()
    
    # Check if token exists and is still valid
    if token_info['access_token'] and token_info['expiry_time'] and now < token_info['expiry_time']:
        return token_info['access_token']
    
    # Get credentials from environment variables or config
    email = os.environ.get('ONEMAP_EMAIL', '')
    password = os.environ.get('ONEMAP_PASSWORD', '')
    
    if not email or not password:
        # Try to load from a config file
        try:
            with open('config/onemap_credentials.json', 'r') as f:
                credentials = json.load(f)
                email = credentials.get('email', '')
                password = credentials.get('password', '')
        except:
            print("Error: OneMap credentials not found.")
            return None
    
    # Get new token
    url = "https://www.onemap.gov.sg/api/auth/post/getToken"
    payload = {
        "email": email,
        "password": password
    }
    
    try:
        response = requests.post(url, json=payload)
        if response.status_code == 200:
            data = response.json()
            token_info['access_token'] = data.get('access_token')
            
            # Calculate expiry time
            expiry_seconds = data.get('expiry_timestamp', 86400)  # Default to 24 hours
            token_info['expiry_time'] = now + timedelta(seconds=expiry_seconds)
            
            return token_info['access_token']
        else:
            print(f"Error getting OneMap token: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"Exception during OneMap authentication: {e}")
        return None

def geocode_address(search_val, return_geom=True, get_addr_details=True):
    """
    Performs geocoding using the OneMap API.
    
    Args:
        search_val (str): Address or postal code to geocode
        return_geom (bool): Whether to return geometry information
        get_addr_details (bool): Whether to return detailed address information
    
    Returns:
        dict: Geocoding results
    """
    token = get_token()
    if not token:
        return {"error": "No valid token available"}
    
    url = "https://www.onemap.gov.sg/api/common/elastic/search"
    
    params = {
        "searchVal": search_val,
        "returnGeom": "Y" if return_geom else "N",
        "getAddrDetails": "Y" if get_addr_details else "N"
    }
    
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    try:
        response = requests.get(url, params=params, headers=headers)
        if response.status_code == 200:
            return response.json()
        else:
            print(f"Error during geocoding: {response.status_code} - {response.text}")
            return {"error": f"API error: {response.status_code}"}
    except Exception as e:
        print(f"Exception during geocoding: {e}")
        return {"error": str(e)}

def reverse_geocode(x_coord, y_coord, buffer=10, address_type="All", other_features="N"):
    """
    Performs reverse geocoding using the OneMap API.
    
    Args:
        x_coord (float): X coordinate (SVY21 format)
        y_coord (float): Y coordinate (SVY21 format)
        buffer (int): Buffer distance in meters
        address_type (str): Type of addresses to return
        other_features (str): Whether to return other features
    
    Returns:
        dict: Reverse geocoding results
    """
    token = get_token()
    if not token:
        return {"error": "No valid token available"}
    
    url = "https://www.onemap.gov.sg/api/public/revgeocodexy"
    
    params = {
        "location": f"{x_coord},{y_coord}",
        "buffer": buffer,
        "addressType": address_type,
        "otherFeatures": other_features
    }
    
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    try:
        response = requests.get(url, params=params, headers=headers)
        if response.status_code == 200:
            return response.json()
        else:
            print(f"Error during reverse geocoding: {response.status_code} - {response.text}")
            return {"error": f"API error: {response.status_code}"}
    except Exception as e:
        print(f"Exception during reverse geocoding: {e}")
        return {"error": str(e)}

def reverse_geocode_lat_long(latitude, longitude, buffer=10, address_type="All", other_features="N"):
    """
    Performs reverse geocoding using latitude and longitude.
    
    Args:
        latitude (float): Latitude coordinate (WGS84 format)
        longitude (float): Longitude coordinate (WGS84 format)
        buffer (int): Buffer distance in meters
        address_type (str): Type of addresses to return
        other_features (str): Whether to return other features
    
    Returns:
        dict: Reverse geocoding results
    """
    token = get_token()
    if not token:
        return {"error": "No valid token available"}
    
    url = "https://www.onemap.gov.sg/api/public/revgeocode"
    
    params = {
        "location": f"{latitude},{longitude}",
        "buffer": buffer,
        "addressType": address_type,
        "otherFeatures": other_features
    }
    
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    try:
        response = requests.get(url, params=params, headers=headers)
        if response.status_code == 200:
            return response.json()
        else:
            print(f"Error during reverse geocoding: {response.status_code} - {response.text}")
            return {"error": f"API error: {response.status_code}"}
    except Exception as e:
        print(f"Exception during reverse geocoding: {e}")
        return {"error": str(e)}