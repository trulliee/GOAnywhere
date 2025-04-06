import requests
from app.database.firestore_utils import store_traffic_conditions, store_weather_forecast

def get_peak_traffic_conditions():
    """
    Fetches road traffic conditions during peak hours from data.gov.sg
    Collection ID 379: Daily traffic volume, average speed, and congestion-free roads
    during peak hours on weekdays
    """
    try:
        collection_id = 379
        url = f"https://api-production.data.gov.sg/v2/public/api/collections/{collection_id}/data"
        
        response = requests.get(url)
        
        if response.status_code == 200:
            data = response.json()
            print("Raw API Response (Traffic Conditions):", data)
            
            # Extract the relevant data from the response
            # Note: You may need to adjust this based on the actual structure of the API response
            traffic_conditions = data.get('data', [])
            
            if traffic_conditions:
                # Store the data in Firestore
                store_traffic_conditions(traffic_conditions)
                print("Traffic conditions data stored successfully!")
                return True
            else:
                print("Error: No traffic conditions data found in the response.")
                return False
        else:
            print(f"Failed to fetch traffic conditions: {response.status_code} - {response.text}")
            return False
    
    except Exception as e:
        print(f"Error fetching traffic conditions data: {e}")
        return False

def get_traffic_metadata(collection_id):
    """
    Fetches metadata for a specific collection from data.gov.sg
    Useful for understanding the structure of the data
    """
    try:
        url = f"https://api-production.data.gov.sg/v2/public/api/collections/{collection_id}/metadata"
        
        response = requests.get(url)
        
        if response.status_code == 200:
            metadata = response.json()
            print(f"Metadata for collection {collection_id}:", metadata)
            return metadata
        else:
            print(f"Failed to fetch metadata: {response.status_code} - {response.text}")
            return None
    
    except Exception as e:
        print(f"Error fetching metadata: {e}")
        return None

def get_24hr_weather_forecast():
    """
    Fetches 24-hour weather forecast from data.gov.sg
    """
    try:
        url = "https://api-open.data.gov.sg/v2/real-time/api/twenty-four-hr-forecast"
        
        response = requests.get(url)
        
        if response.status_code == 200:
            data = response.json()
            print("Raw API Response (24hr Weather Forecast):", data)
            
            # Extract the relevant data from the response
            forecast_data = data.get('data', {})
            
            if forecast_data:
                # Store the data in Firestore
                store_weather_forecast(forecast_data)
                print("24-hour weather forecast data stored successfully!")
                return True
            else:
                print("Error: No weather forecast data found in the response.")
                return False
        else:
            print(f"Failed to fetch weather forecast: {response.status_code} - {response.text}")
            return False
    
    except Exception as e:
        print(f"Error fetching weather forecast data: {e}")
        return False