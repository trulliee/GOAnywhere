from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from app.database.firestore_utils import db
from datetime import datetime
from google.cloud import firestore  # Needed for Query

router = APIRouter()

# Pydantic model for incoming crowd data
class CrowdData(BaseModel):
    user_id: str  # User ID is now required
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    type: str  # e.g., "accident", "traffic jam"
    source: str
    timestamp: Optional[str] = None

# Function to check if user is a registered user
def is_registered_user(user_id: str) -> bool:
    try:
        user_ref = db.collection('users').document(user_id)
        user_doc = user_ref.get()

        if not user_doc.exists:
            return False
        
        user_data = user_doc.to_dict()
        return user_data.get('settings', {}).get('userType') == "registered"
    except Exception as e:
        print(f"Error checking user: {e}")
        return False

# POST endpoint to receive and store crowd data
@router.post("/submit-crowd-data")
def submit_crowdsourced_data(data: CrowdData):
    try:
        if not data.user_id:
            raise HTTPException(status_code=400, detail="Missing user_id.")

        if not is_registered_user(data.user_id):
            raise HTTPException(status_code=403, detail="Unauthorized: Only registered users can submit reports.")

        # Use backend timestamp if none provided
        data_to_store = {
            "user_id": data.user_id,
            "latitude": data.latitude,
            "longitude": data.longitude,
            "type": data.type,
            "source": data.source,
            "timestamp": data.timestamp or datetime.utcnow().isoformat()
        }

        # Store in Firestore
        doc_ref = db.collection("crowdsourced_reports").document()
        doc_ref.set(data_to_store)

        return {
            "status": "success",
            "id": doc_ref.id,
            "location_received": {
                "lat": data.latitude,
                "lng": data.longitude
            }
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Server Error: {str(e)}")

# GET endpoint to fetch all reports
@router.get("/get-crowd-data")
def get_crowdsourced_data():
    try:
        reports = db.collection("crowdsourced_reports").order_by("timestamp", direction=firestore.Query.DESCENDING).stream()
        result = []
        for report in reports:
            entry = report.to_dict()
            entry["id"] = report.id
            result.append(entry)
        return {"reports": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Server Error: {str(e)}")
