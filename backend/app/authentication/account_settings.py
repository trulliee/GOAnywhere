from fastapi import APIRouter, HTTPException, Depends, Header, status
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from firebase_admin import auth
from app.database.firestore_utils import db
import datetime

router = APIRouter(
    prefix="/account",
    tags=["Account Settings"],
    responses={404: {"description": "Not found"}},
)

# Dependency to get user ID from token
async def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        token = authorization.split("Bearer ")[1]
        decoded_token = auth.verify_id_token(token)
        return decoded_token
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))


# ====== MODELS ======

class UpdateProfileRequest(BaseModel):
    name: Optional[str]
    phone_number: Optional[str] = Field(None, alias="phoneNumber")
    settings: Optional[Dict[str, Any]]  # e.g., {"locationSharing": True, "notifications": False}


class ChangePasswordRequest(BaseModel):
    email: str
    new_password: str = Field(..., min_length=6)


class DeleteAccountRequest(BaseModel):
    user_id: str


# ====== ROUTES ======

@router.put("/update-profile")
async def update_profile(
    update_data: UpdateProfileRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    user_id = current_user["uid"]
    try:
        user_ref = db.collection("users").document(user_id)
        updates = {}

        if update_data.name:
            updates["name"] = update_data.name
        if update_data.phone_number:
            updates["phone_number"] = update_data.phone_number
        if update_data.settings:
            updates["settings"] = update_data.settings
        updates["last_updated"] = datetime.datetime.utcnow().isoformat()

        user_ref.update(updates)

        return {"message": "Profile updated successfully."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/change-password")
async def change_password(data: ChangePasswordRequest):
    try:
        user = auth.get_user_by_email(data.email)
        auth.update_user(
            user.uid,
            password=data.new_password
        )
        return {"message": "Password updated successfully."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/delete-account")
async def delete_account(
    request: DeleteAccountRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    user_id = request.user_id
    if user_id != current_user["uid"]:
        raise HTTPException(status_code=403, detail="Permission denied")

    try:
        # Delete from Firebase Auth
        auth.delete_user(user_id)
        # Delete from Firestore
        db.collection("users").document(user_id).delete()

        return {"message": "User account deleted successfully."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
