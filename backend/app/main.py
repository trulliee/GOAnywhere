import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

print("FIREBASE_CREDENTIALS_PATH =", os.getenv("FIREBASE_CREDENTIALS_PATH"))

# Import routers
from app.authentication import account_settings
from app.authentication import auth
from app.admin import admin_user
from app.admin import admin_reports
from app.admin.admin_notifications import router as admin_notifications_router
from app.database.firestore_utils import get_firebase_credentials
from app.routes.cloud_jobs import router as cloud_jobs_router
from app.routes.retrain_models import router as retrain_router
from app.routes.prediction import router as prediction_router
from app.routes.notifications import router as notifications_router # Import the notifications router
from app.routes.crowdsourced import router as crowd_router
from app.routes import traffic_incidents 

# Initialize FastAPI app
app = FastAPI()

# Add CORS middleware (allow all origins for now; tighten later if needed)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Test root route
@app.get("/")
def root():
    return {"message": "Hello, World!"}

# Include routers
app.include_router(prediction_router, tags=["Prediction"])
app.include_router(notifications_router, tags=["Notifications"])
app.include_router(crowd_router, tags=["Crowdsourced"])
app.include_router(auth.router, prefix="/auth", tags=["Auth"])
app.include_router(account_settings.router)
app.include_router(admin_user.router)
app.include_router(admin_reports.router)
app.include_router(admin_notifications_router)
app.include_router(cloud_jobs_router, tags=["Cloud Jobs"])
app.include_router(retrain_router, tags=["Retrain"])
app.include_router(traffic_incidents.router)


if __name__ == "__main__":
    import uvicorn
    db = get_firebase_credentials()
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port)
