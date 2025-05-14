# notifications.py
from fastapi import APIRouter, HTTPException
from typing import List
from pydantic import BaseModel
from app.database.firestore_utils import db

router = APIRouter(
    tags=["Notifications"],
    responses={404: {"description": "Not found"}}
)

class Notification(BaseModel):
    title: str
    message: str

@router.get("/notifications/account/{user_id}", response_model=List[Notification])
def get_account_notifications(user_id: str):
    try:
        notifs_ref = db.collection("users").document(user_id).collection("notifications")
        docs = notifs_ref.stream()

        notifications = []
        for doc in docs:
            data = doc.to_dict()
            notifications.append({
                "title": data.get("title"),
                "message": data.get("message")
            })

        return notifications
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
