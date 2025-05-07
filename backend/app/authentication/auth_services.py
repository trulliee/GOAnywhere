from firebase_admin import auth

print("auth_services.py LOADED")

class AuthService:
    @staticmethod
    async def create_user(email: str, password: str, display_name: str = None):
        try:
            user = auth.create_user(
                email=email,
                password=password,
                display_name=display_name
            )
            return {
                "uid": user.uid,
                "email": user.email,
                "display_name": user.display_name
            }
        except Exception as e:
            print("Firebase error:", str(e))
            raise Exception("Firebase account creation failed.")

    @staticmethod
    async def generate_custom_token(uid: str):
        token = auth.create_custom_token(uid)
        return token.decode("utf-8")

    @staticmethod
    async def verify_token(id_token: str):
        decoded_token = auth.verify_id_token(id_token)
        return decoded_token

    @staticmethod
    async def get_user(uid: str):
        user = auth.get_user(uid)
        return {
            "uid": user.uid,
            "email": user.email,
            "name": user.display_name
        }

    @staticmethod
    async def get_user_info(uid: str):
        try:
            user = auth.get_user(uid)
            return {
                "uid": user.uid,
                "email": user.email,
                "name": user.display_name
            }
        except Exception as e:
            return {"error": str(e)}
