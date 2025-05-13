# app/routes/auth.py
from fastapi import APIRouter, HTTPException, Depends, Header, status, Body
from fastapi.security import OAuth2PasswordBearer
from typing import Optional, Dict, Any
from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from .auth_services import AuthService
from app.database.firestore_utils import store_user_data, update_user_last_login, db
from firebase_admin import auth
import httpx

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

from fastapi import APIRouter

router = APIRouter(
    tags=["Auth"],
    responses={404: {"description": "Not found"}},
)


# Request Models
class SignUpRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    name: Optional[str] = None
    phone_number: Optional[str] = Field(None, alias="phoneNumber")

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenData(BaseModel):
    id_token: str

# Response Models
class UserResponse(BaseModel):
    uid: str
    email: Optional[str] = None
    name: Optional[str] = None
    token: str

class UpdateProfileRequest(BaseModel):
    user_id : str
    name: Optional[str] = None
    email: Optional[str] = None
    phone_number: Optional[str] = None

def add_user_notification(user_id, title, message, type="info"):
    db.collection("users").document(user_id).collection("notifications").add({
        "title": title,
        "message": message,
        "type": type,
        "timestamp": datetime.utcnow()
    })

# Dependency to get current user
async def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = authorization.split("Bearer ")[1]
    try:
        user_data = await AuthService.verify_token(token)
        return user_data
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"},
        )

# Signup Route
@router.post("/signup", response_model=UserResponse)
async def sign_up(user_data: SignUpRequest):
    print("Received user_data:", user_data.dict())
    try:
        created_user = await AuthService.create_user(
            email=user_data.email,
            password=user_data.password,
            display_name=user_data.name
        )
        
        now = datetime.now()
        
        await store_user_data(
            user_id=created_user["uid"],
            name=user_data.name or user_data.email.split('@')[0],
            email=user_data.email,
            phone_number=user_data.phone_number,
            user_type="registered",
            created_at=now,
            last_login=now,
            settings={
                "locationSharing": False,
                "notifications": True
            }
        )
        
        token = await AuthService.generate_custom_token(created_user["uid"])
        
        return {
            "uid": created_user["uid"],
            "email": created_user["email"],
            "name": created_user["display_name"],
            "token": token,
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        print("Signup error:", str(e))
        raise HTTPException(status_code=400, detail="Signup failed. Please check your input.")
    
FIREBASE_API_KEY = "AIzaSyDJRcgdtLm_bIvr0oXmEvH7clRTGoPiW2Y"

@router.post("/login", response_model=UserResponse)
async def login(login_data: LoginRequest):
    try:
        # Use Firebase REST API to verify email/password
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_API_KEY}",
                json={
                    "email": login_data.email,
                    "password": login_data.password,
                    "returnSecureToken": True
                },
                headers={"Content-Type": "application/json"}
            )
        
        if response.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid email or password")

        data = response.json()
        id_token = data["idToken"]
        uid = data["localId"]

        user = auth.get_user(uid)
        await update_user_last_login(uid)

        user_doc = db.collection("users").document(uid).get()
        user_type = user_doc.to_dict().get("user_type", "registered") if user_doc.exists else "registered"
        return {
            "uid": uid,
            "email": user.email,
            "name": user.display_name,
            "token": id_token,
            "user_type": user_type,
        }

    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))



# Verify Token Route
@router.post("/verify-token")
async def verify_token_endpoint(token_data: TokenData):
    try:
        user_data = await AuthService.verify_token(token_data.id_token)
        await update_user_last_login(user_data["uid"])
        return user_data
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))

# Get Current User Profile
@router.get("/me", response_model=Dict[str, Any])
async def get_me(current_user: Dict[str, Any] = Depends(get_current_user)):
    try:
        user_data = await AuthService.get_user(current_user["uid"])
        return user_data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/auth/upgrade")
async def upgrade_to_paid(user_id: str):
    try:
        # Find the user document in Firestore
        user_ref = db.collection('users').document(user_id)
        user_doc = user_ref.get()

        if not user_doc.exists:
            raise HTTPException(status_code=404, detail="User not found")

        # Update user's premium status and userType
        user_ref.update({
            "premium_features": True,
            "userType": "paid registered user"
        })

        return {"message": "User successfully upgraded to Paid Registered User."}
    
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/update_profile")
async def update_profile(update_data: UpdateProfileRequest):
    user_ref = db.collection("users").document(update_data.user_id)
    doc = user_ref.get()

    if not doc.exists:
        raise HTTPException(status_code=404, detail="User not found")

    existing = doc.to_dict()
    updates = {}

    if update_data.name and update_data.name != existing.get("name"):
        updates["name"] = update_data.name
        add_user_notification(update_data.user_id, "Username Updated", "Your username has been updated.")

    if update_data.email and update_data.email != existing.get("email"):
        updates["email"] = update_data.email
        add_user_notification(update_data.user_id, "Email Updated", "Your email has been updated.")

    if update_data.phone_number and update_data.phone_number != existing.get("phone_number"):
        updates["phone_number"] = update_data.phone_number
        add_user_notification(update_data.user_id, "Phone Number Updated", "Your phone number has been updated.")

    if updates:
        updates["last_updated"] = datetime.utcnow()
        user_ref.update(updates)
        return {
            "message": "Profile updated successfully",
            "updated_fields": list(updates.keys())
        }
    else:
        return {
            "message": "No changes detected",
            "updated_fields": []
        }
    
@router.post("/auth/change_password")
async def change_password(data: dict, current_user: Dict[str, Any] = Depends(get_current_user)):
    try:
        new_password = data.get("new_password")
        if not new_password or len(new_password) < 6:
            raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")

        auth.update_user(current_user["uid"], password=new_password)

        add_user_notification(current_user["uid"], "Password Changed", "Your password has been successfully updated.")
        return {"message": "Password updated successfully."}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

