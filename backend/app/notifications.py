from fastapi import APIRouter, HTTPException
from app.database.firestore_utils import fetch_firestore_data,db

# Create a FastAPI router
router = APIRouter()

# Endpoint to get all extreme weather notifications for a specific user 
@router.get("/notifications/extreme_weather/{user_id}")
async def get_extreme_weather_notifications(user_id: str):
    try:
        # Fetch extreme weather data from Firestore using firestore_utils
        data = fetch_firestore_data("extreme_weather")
        
        # Filter the data based on user_id
        notifications = [entry['message'] for entry in data if entry.get("user_id") == user_id]

        if not notifications:
            raise HTTPException(status_code=404, detail="No notifications found")

        return {"notifications": notifications}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching notifications: {str(e)}")

# Endpoint to get all extreme road conditions notifications for a specific user 
@router.get("/notifications/extreme_road_conditions/{user_id}")
async def get_extreme_road_conditions_notifications(user_id: str):
    try:
        # Fetch extreme road conditions data from Firestore using firestore_utils
        data = fetch_firestore_data("extreme_road_conditions")
        
        # Filter the data based on user_id
        notifications = [entry['message'] for entry in data if entry.get("user_id") == user_id]

        if not notifications:
            raise HTTPException(status_code=404, detail="No notifications found")

        return {"notifications": notifications}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching notifications: {str(e)}")

# Endpoint to get all user report notifications for a specific user
@router.get("/notifications/user_reports/{user_id}")
async def get_user_reports_notifications(user_id: str):
    try:
        # Query Firestore collection "user_reports"
        collection_ref = db.collection("user_reports")
        docs = collection_ref.where("user_id", "==", user_id).stream()

        # Extract notifications (messages)
        notifications = []
        for doc in docs:
            notifications.append(doc.to_dict()["message"])

        # If no notifications found, return a 404
        if not notifications:
            raise HTTPException(status_code=404, detail="No user report notifications found")

        return {"notifications": notifications}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching notifications: {str(e)}")

# Endpoint to get all user setting change notifications for a specific user
@router.get("/notifications/user_settings/{user_id}")
async def get_user_settings_notifications(user_id: str):
    try:
        # Query Firestore collection "user_settings"
        collection_ref = db.collection("user_settings")
        docs = collection_ref.where("user_id", "==", user_id).stream()

        # Extract notifications (messages)
        notifications = []
        for doc in docs:
            notifications.append(doc.to_dict()["message"])

        # If no notifications found, return a 404
        if not notifications:
            raise HTTPException(status_code=404, detail="No user setting change notifications found")

        return {"notifications": notifications}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching notifications: {str(e)}")
