# backend/crowdsourced_reports.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from firestore_utils import db  # Import db from your existing firestore_utils
from datetime import datetime

router = APIRouter()

class CrowdsourceReport(BaseModel):
    latitude: float
    longitude: float
    type: str  # (like "accident", "road closure", "roadworks", etc.)
    source: str  # "driver" or "public"

@router.post("/submit-crowd-report")
async def submit_crowd_report(report: CrowdsourceReport):
    try:
        data = {
            "latitude": report.latitude,
            "longitude": report.longitude,
            "type": report.type.lower(),
            "source": report.source.lower(),
            "timestamp": datetime.utcnow().isoformat(),  # Server time
            "createdAt": datetime.utcnow()
        }
        db.collection("crowdsourced_reports").add(data)
        return {"message": "Crowdsourced report submitted successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
