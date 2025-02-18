import os
import firebase_admin
from firebase_admin import credentials, firestore
from fastapi import FastAPI
from prediction import router as prediction_router  # Import prediction routes

# Initialize Firebase
key_path = os.getenv("FIREBASE_KEY_PATH", "firebase-adminsdk.json")
cred = credentials.Certificate(key_path)
firebase_admin.initialize_app(cred)

# Firestore database client
db = firestore.client()

# Initialize FastAPI
app = FastAPI()

# Root test route
@app.get("/")
def root():
    return "helloworld"

# Include the prediction routes
app.include_router(prediction_router)

# Run the server
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
