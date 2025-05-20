from fastapi import APIRouter, HTTPException, Body
from app.database.firestore_utils import store_user_data, update_user_last_login, get_firestore_client

db = get_firestore_client()

router = APIRouter()

@router.get("/admin/users")
async def get_all_users():
    try:
        users_ref = db.collection("users")
        docs = users_ref.stream()

        users = []
        for doc in docs:
            data = doc.to_dict()
            users.append({
                "id": doc.id,
                "name": data.get("name", "Unnamed"),
                "email": data.get("email", ""),
                "user_type": data.get("user_type", "registered"),
                "last_login": data.get("last_login").isoformat() if data.get("last_login") else None
            })

        return {"users": users}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch users: {str(e)}")


@router.post("/admin/ban_user")
async def ban_user(
    user_id: str = Body(...),
    action: str = Body(..., regex="^(ban|unban)$")
):
    try:
        user_ref = db.collection("users").document(user_id)
        doc = user_ref.get()

        if not doc.exists:
            raise HTTPException(status_code=404, detail="User not found")

        new_type = "banned" if action == "ban" else "registered"
        user_ref.update({"user_type": new_type})

        return {"status": "success", "new_user_type": new_type}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update user: {str(e)}")

@router.delete("/admin/delete-user/{user_id}")
async def delete_user(user_id: str):
    try:
        db.collection('users').document(user_id).delete()
        return {"message": "User deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))