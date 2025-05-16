from fastapi import APIRouter, HTTPException
from app.database.firestore_utils import store_user_data, update_user_last_login, db
from firebase_admin import firestore
from firebase_admin.firestore import SERVER_TIMESTAMP

router = APIRouter()

@router.get("/admin/alert-notifications")
async def get_admin_notifications():
    try:
        docs = db.collection("crowdsourced_reports").stream()

        notifications = []
        for doc in docs:
            data = doc.to_dict()
            report_type = data.get("type", "Unknown Report")
            username = data.get("username", "Unknown User")
            lat = data.get("latitude", "N/A")
            lng = data.get("longitude", "N/A")
            ts = data.get("timestamp", None)

            # Only trigger notifications for critical types
            if report_type.lower() in ["accident", "high crowd", "blockage"]:
                message = f"{report_type} reported by {username} at ({lat}, {lng})"
                notifications.append({
                    "id": doc.id,
                    "message": message,
                    "type": report_type,
                    "username": username,
                    "timestamp": ts
                })

        return {"notifications": notifications}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


