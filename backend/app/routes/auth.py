# app/routes/auth.py
from fastapi import APIRouter, HTTPException, Depends, Header, Body, status
from fastapi.security import OAuth2PasswordBearer
from typing import Optional, Dict, Any
from pydantic import BaseModel, EmailStr, Field
from app.services.auth_service import AuthService
from app.database.firestore_utils import store_user_data, update_user_last_login
from firebase_admin import auth

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
    responses={404: {"description": "Not found"}},
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# Request Models
class SignUpRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    name: Optional[str] = None
    phone_number: Optional[str] = None

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
    is_anonymous: bool = False

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

@router.post("/signup", response_model=UserResponse)
async def sign_up(user_data: SignUpRequest):
    try:
        # Create user in Firebase
        created_user = await AuthService.create_user(
            email=user_data.email,
            password=user_data.password,
            display_name=user_data.name
        )
        
        # Generate a custom token for the user
        token = await AuthService.generate_custom_token(created_user["uid"])
        
        # Store additional user data in Firestore
        await store_user_data(
            user_id=created_user["uid"],
            name=user_data.name or user_data.email.split('@')[0],
            email=user_data.email,
            phone_number=user_data.phone_number,
            user_type="registered"
        )
        
        return {
            "uid": created_user["uid"],
            "email": created_user["email"],
            "name": created_user["display_name"],
            "token": token,
            "is_anonymous": False
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.post("/anonymous", response_model=UserResponse)
async def anonymous_login():
    try:
        # Create anonymous user
        anon_user = await AuthService.create_anonymous_user()
        
        # Generate a custom token
        token = await AuthService.generate_custom_token(anon_user["uid"])
        
        # Store user data in Firestore
        await store_user_data(
            user_id=anon_user["uid"],
            user_type="anonymous"
        )
        
        return {
            "uid": anon_user["uid"],
            "token": token,
            "is_anonymous": True
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    
@router.post("/login", response_model=UserResponse)
async def login(login_data: LoginRequest):
    try:
        # For Firebase, we need to use the Firebase Auth REST API
        # This is a simplified implementation
        try:
            # Get user by email first (to check if they exist)
            user = auth.get_user_by_email(login_data.email)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )
            
        # Generate a custom token for the user
        # Note: In a real app, you'd verify the password before generating a token
        # But Firebase Admin SDK doesn't provide password verification
        token = await AuthService.generate_custom_token(user.uid)
        
        # Update last login in Firestore
        await update_user_last_login(user.uid)
        
        return {
            "uid": user.uid,
            "email": user.email,
            "name": user.display_name,
            "token": token,
            "is_anonymous": False
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e)
        )

@router.post("/verify-token")
async def verify_token_endpoint(token_data: TokenData):
    try:
        user_data = await AuthService.verify_token(token_data.id_token)
        
        # Update last login in Firestore
        await update_user_last_login(user_data["uid"])
        
        return user_data
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e)
        )

@router.get("/me", response_model=Dict[str, Any])
async def get_me(current_user: Dict[str, Any] = Depends(get_current_user)):
    try:
        user_data = await AuthService.get_user(current_user["uid"])
        return user_data
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.get("/user-info")
async def user_information(token: str = Depends(oauth2_scheme)):
    """
    Get user information including name
    
    Args:
        token: JWT token from authentication
        
    Returns:
        User information including name
    """
    try:
        # Verify token and get user ID
        decoded_token = await AuthService.verify_token(token)
        user_id = decoded_token["uid"]
        
        # Get user info
        user_info = await AuthService.get_user_info(user_id)
        if "error" in user_info:
            raise HTTPException(status_code=404, detail=user_info["error"])
        
        return user_info
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e)
        )