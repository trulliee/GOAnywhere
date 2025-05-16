from fastapi import APIRouter
from google.cloud import firestore
import datetime
from dateutil import parser

router = APIRouter()

@router.get("/incidents", tags=["Traffic Incidents"])
def get_recent_traffic_incidents():
    db = firestore.Client()
   
    docs = db.collection("traffic_incidents").stream()

    incidents = []
    for doc in docs:
        data = doc.to_dict()
        data["id"] = doc.id

        # Ensure Timestamp is parseable to datetime
        try:
            incident_time = parser.parse(data["Timestamp"])
            data["parsed_timestamp"] = incident_time.isoformat()
            incidents.append(data)
        except Exception as e:
            continue  # skip malformed timestamps

    # Optional: sort by timestamp descending
    incidents.sort(key=lambda x: x["parsed_timestamp"], reverse=True)

    return {"status": "success", "incidents": incidents}