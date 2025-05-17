from fastapi import APIRouter
from google.cloud import firestore
import datetime

router = APIRouter()

@router.get("/incidents", tags=["Traffic Incidents"])
def get_recent_traffic_incidents():
    db = firestore.Client()

    now = datetime.datetime.utcnow()
    seven_days_ago = now - datetime.timedelta(days=7)

    # Query incidents with Timestamp >= seven_days_ago
    query = (
        db.collection("traffic_incidents")
        .where("Timestamp", ">=", seven_days_ago)
        .order_by("Timestamp", direction=firestore.Query.DESCENDING)
    )

    docs = query.stream()

    incidents = []
    for doc in docs:
        data = doc.to_dict()
        data["id"] = doc.id
        data["parsed_timestamp"] = data["Timestamp"].isoformat()
        incidents.append(data)

    return {"status": "success", "incidents": incidents}
