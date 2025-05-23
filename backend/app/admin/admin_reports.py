from fastapi import APIRouter, HTTPException
from app.database.firestore_utils import store_user_data, update_user_last_login, get_firestore_client

db = get_firestore_client()

router = APIRouter()

@router.get("/admin/crowdsourced-reports")
async def get_crowdsourced_reports():
    try:
        reports_ref = db.collection("crowdsourced_reports")
        docs = reports_ref.stream()

        reports = []
        for doc in docs:
            data = doc.to_dict()
            timestamp = data.get("timestamp")

            reports.append({
                "id": doc.id,
                "username": data.get("username", "Unknown"),
                "type": data.get("type", "Unknown"),
                "timestamp": timestamp,
            })

        return {"reports": reports}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch reports: {str(e)}")
