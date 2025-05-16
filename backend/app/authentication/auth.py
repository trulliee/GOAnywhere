# app/routes/auth.py
from fastapi import APIRouter, HTTPException, Depends, Header, status, Body, Request
from fastapi.security import OAuth2PasswordBearer
from typing import Optional, Dict, Any
from pydantic import BaseModel, EmailStr, Field
import datetime
from .auth_services import AuthService
from app.database.firestore_utils import store_user_data, update_user_last_login, get_firestore_client
from firebase_admin import auth
import httpx
import requests
import phonenumbers
from fastapi import HTTPException

def validate_phone(phone: str, region="SG"):
    try:
        phone = phone.strip()
        parsed = phonenumbers.parse(phone, region)
        if not phonenumbers.is_valid_number(parsed):
            raise HTTPException(status_code=400, detail="Invalid phone number format.")
    except Exception:
        raise HTTPException(status_code=400, detail="Phone number parsing failed.")


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
    user_type: Optional[str] = None

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
    print(f"Phone number received: '{user_data.phone_number}'")
    print(f"Raw phone input: {user_data.phone_number!r}")
    # Check for duplicate phone number
    if user_data.phone_number:
        validate_phone(user_data.phone_number, region="SG")
    if user_data.phone_number:
        existing = list(db.collection("users").where("phone_number", "==", user_data.phone_number).limit(1).stream())
        if existing:
            raise HTTPException(status_code=409, detail="Phone number already in use.")
        
    try:
        created_user = await AuthService.create_user(
            email=user_data.email,
            password=user_data.password,
            display_name=user_data.name
        )
        
        now = datetime.datetime.now()
        
        user_type = "admin" if not user_data.phone_number else "registered"

        await store_user_data(
            user_id=created_user["uid"],
            name=user_data.name or user_data.email.split('@')[0],
            email=user_data.email,
            phone_number=user_data.phone_number,
            user_type=user_type,
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
        print("Firestore UID check:", uid)
        print("Document exists:", user_doc.exists)
        if user_doc.exists:
            user_data = user_doc.to_dict()
            print("Document content:", user_data)
            user_type = user_data.get("user_type", "registered")
        else:
            print("Document not found in Firestore")
            user_type = "registered"

        if user_type == "banned":
            raise HTTPException(status_code=403, detail="Account has been deactivated by an admin.")

        print("Logging in user with UID:", uid)
        print("Checking Firestore document:", db.collection("users").document(uid).path)
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

    updates = {}
    existing = doc.to_dict()
    if update_data.name and update_data.name != existing.get("name"):
        updates["name"] = update_data.name
        try:
            auth.update_user(update_data.user_id, display_name=update_data.name)
        except Exception as e:
            print("Error updating name in Firebase Auth:", str(e))

        add_user_notification(update_data.user_id, "Username Updated", "Your username has been updated.")

    if update_data.email and update_data.email != existing.get("email"):
        updates["email"] = update_data.email
        try:
            auth.update_user(update_data.user_id, email=update_data.email)
        except Exception as e:
            print("Error updating email in Firebase Auth:", str(e))
            raise HTTPException(status_code=500, detail="Failed to update email in Firebase Auth.")
        add_user_notification(update_data.user_id, "Email Updated", "Your email has been updated.")

    if update_data.phone_number and update_data.phone_number != existing.get("phone_number"):
        validate_phone(update_data.phone_number, region="SG")

        # Check for uniqueness
        existing_users = db.collection("users") \
            .where("phone_number", "==", update_data.phone_number) \
            .limit(1).stream()

        for doc in existing_users:
            if doc.id != update_data.user_id:
                raise HTTPException(status_code=409, detail="Phone number already in use.")

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
    
@router.post("/change_password")
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

@router.post("/login-with-phone")
async def login_with_phone(request: Request):
    try:
        data = await request.json()
        phone = data.get("phone")
        password = data.get("password")

        if not phone or not password:
            raise HTTPException(status_code=400, detail="Phone and password are required.")

        # Find email by phone number in Firestore
        user_docs = db.collection("users").where("phone_number", "==", phone).limit(1).stream()
        email = None
        for doc in user_docs:
            email = doc.to_dict().get("email")
            break

        if not email:
            raise HTTPException(status_code=404, detail="Phone number not found.")

        # Proceed with login using the existing Firebase Auth email/password method
        login_data = {
            "email": email,
            "password": password,
            "returnSecureToken": True
        }

        firebase_response = requests.post(
            f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_API_KEY}",
            json=login_data
        )

        if firebase_response.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid credentials.")

        firebase_data = firebase_response.json()

        user = auth.get_user(firebase_data.get("localId"))
        await update_user_last_login(user.uid)

        user_doc = db.collection("users").document(user.uid).get()
        user_type = user_doc.to_dict().get("user_type", "registered") if user_doc.exists else "registered"
        phone_number = user_doc.to_dict().get("phone_number", "") if user_doc.exists else ""

        return {
            "uid": user.uid,
            "email": user.email,
            "name": user.display_name,
            "phone": phone_number,
            "token": firebase_data.get("idToken"),
            "user_type": user_type,
        }


    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
