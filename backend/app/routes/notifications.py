# app/routes/notifications.py

from fastapi import APIRouter, HTTPException
from app.database.firestore_utils import fetch_firestore_data, db

# ✅ Consistent router declaration with prefix + tags
router = APIRouter(
    prefix="/notifications",
    tags=["Notifications"]
)

# === EXTREME WEATHER ===
@router.get("/extreme_weather/{user_id}")
async def get_extreme_weather_notifications(user_id: str):
    try:
        data = fetch_firestore_data("extreme_weather")
        notifications = [entry['message'] for entry in data if entry.get("user_id") == user_id]

        if not notifications:
            raise HTTPException(status_code=404, detail="No notifications found")

        return {"notifications": notifications}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching notifications: {str(e)}")


# === EXTREME ROAD CONDITIONS ===
@router.get("/extreme_road_conditions/{user_id}")
async def get_extreme_road_conditions_notifications(user_id: str):
    try:
        data = fetch_firestore_data("extreme_road_conditions")
        notifications = [entry['message'] for entry in data if entry.get("user_id") == user_id]

        if not notifications:
            raise HTTPException(status_code=404, detail="No notifications found")

        return {"notifications": notifications}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching notifications: {str(e)}")


# === USER REPORTS ===
@router.get("/user_reports/{user_id}")
async def get_user_reports_notifications(user_id: str):
    try:
        docs = db.collection("user_reports").where("user_id", "==", user_id).stream()
        notifications = [doc.to_dict()["message"] for doc in docs]

        if not notifications:
            raise HTTPException(status_code=404, detail="No user report notifications found")

        return {"notifications": notifications}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching notifications: {str(e)}")


# === USER SETTINGS ===
@router.get("/user_settings/{user_id}")
async def get_user_settings_notifications(user_id: str):
    try:
        docs = db.collection("user_settings").where("user_id", "==", user_id).stream()
        notifications = [doc.to_dict()["message"] for doc in docs]

        if not notifications:
            raise HTTPException(status_code=404, detail="No user setting change notifications found")

        return {"notifications": notifications}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching notifications: {str(e)}")
