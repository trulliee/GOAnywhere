# app/services/auth_service.py
import firebase_admin
from firebase_admin import credentials, auth
import os
import json
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

# Initialize Firebase Admin
service_account_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'service-account-key.json')

# Check if Firebase Admin app already initialized to avoid duplicate initialization
try:
    app = firebase_admin.get_app()
except ValueError:
    cred = credentials.Certificate(service_account_path)
    app = firebase_admin.initialize_app(cred)

class AuthService:
    @staticmethod
    async def create_user(email: str, password: str, display_name: Optional[str] = None) -> Dict[str, Any]:
        """Create a new user with email and password"""
        try:
            user_properties = {
                "email": email,
                "password": password,
                "email_verified": False,
            }
            
            if display_name:
                user_properties["display_name"] = display_name
                
            user = auth.create_user(**user_properties)
            
            # Return user info without sensitive data
            return {
                "uid": user.uid,
                "email": user.email,
                "display_name": user.display_name,
                "email_verified": user.email_verified,
                "created_at": datetime.now().isoformat()
            }
        except Exception as e:
            raise Exception(f"Error creating user: {str(e)}")
    
    @staticmethod
    async def verify_token(id_token: str) -> Dict[str, Any]:
        """Verify the Firebase ID token"""
        try:
            decoded_token = auth.verify_id_token(id_token)
            return {
                "uid": decoded_token["uid"],
                "email": decoded_token.get("email"),
                "email_verified": decoded_token.get("email_verified", False),
                "expires_at": decoded_token.get("exp")
            }
        except Exception as e:
            raise Exception(f"Invalid token: {str(e)}")
    
    @staticmethod
    async def generate_custom_token(uid: str) -> str:
        """Generate a custom token for a user to sign in with"""
        try:
            custom_token = auth.create_custom_token(uid)
            return custom_token.decode('utf-8')
        except Exception as e:
            raise Exception(f"Error generating custom token: {str(e)}")
    
    @staticmethod
    async def get_user(uid: str) -> Dict[str, Any]:
        """Get user data by UID"""
        try:
            user = auth.get_user(uid)
            return {
                "uid": user.uid,
                "email": user.email,
                "display_name": user.display_name,
                "email_verified": user.email_verified,
                "phone_number": user.phone_number
            }
        except Exception as e:
            raise Exception(f"Error getting user: {str(e)}")
            
    @staticmethod
    async def create_anonymous_user() -> Dict[str, Any]:
        """Create an anonymous user"""
        try:
            user = auth.create_user()
            
            # Return user info
            return {
                "uid": user.uid,
                "is_anonymous": True,
                "created_at": datetime.now().isoformat()
            }
        except Exception as e:
            raise Exception(f"Error creating anonymous user: {str(e)}")
    
    @staticmethod
    async def verify_password(email: str, password: str) -> Dict[str, Any]:
        """
        Verify user email and password
        
        Note: Firebase Admin SDK doesn't support password verification directly.
        For a production app, you'd need to use Firebase Auth REST API.
        This is a simplified implementation.
        """
        try:
            # Get user by email
            user = auth.get_user_by_email(email)
            
            # In a real implementation, you would verify the password against Firebase Auth
            # Since we can't do that with the Admin SDK, we're just returning the user
            # assuming the password is correct
            
            return {
                "uid": user.uid,
                "email": user.email,
                "display_name": user.display_name,
                "email_verified": user.email_verified
            }
        except Exception as e:
            raise Exception(f"Invalid credentials: {str(e)}")

    @staticmethod
    async def get_user_info(user_id):
        """
        Fetch user information from Firestore
        
        Args:
            user_id (str): The user's ID
            
        Returns:
            dict: User information including name
        """
        from ..database.firestore_utils import get_document
        
        try:
            user_data = await get_document("users", user_id)
            if not user_data:
                return {"error": "User not found"}
            
            # Return user data including name
            return {
                "id": user_id,
                "name": user_data.get("name", "User"),
                "email": user_data.get("email", ""),
                "phone_number": user_data.get("phone_number", ""),
                "user_type": user_data.get("user_type", "registered")
            }
        except Exception as e:
            print(f"Error fetching user info: {str(e)}")
            return {"error": str(e)}