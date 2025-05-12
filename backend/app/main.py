from dotenv import load_dotenv
load_dotenv()
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

print("FIREBASE_CREDENTIALS_PATH =", os.getenv("FIREBASE_CREDENTIALS_PATH"))

# Import routers
<<<<<<< HEAD
#from app.routes.traffic import router as traffic_router # Need to uncomment later
#from app.routes.weather import router as weather_router # Need to uncomment later
from app.prediction import router as ml_prediction_router  # ✅ Patch: import from app.prediction, NOT app.routes.prediction
# from app.routes.auth import router as auth_router  # Uncomment if you add auth later
#from app.dashboard import router as dashboard_router
#from app.p2pnavigation import router as p2pnavigation_router
#from app.notifications import router as notifications_router
#from app.routes.prediction import router as ml_prediction_router
from app.authentication import account_settings
from app.authentication import auth
#from app.routes.prediction import router as prediction_router
#from app.routes.traffic_incidents import router as traffic_incidents_router
#from app.routes.auth import router as auth_router  # Import the auth router
from app.routes.prediction import router as prediction_router
from app.notifications import router as notifications_router # Import the notifications router
from app.crowdsourced import router as crowd_router
from app.database.firestore_utils import get_firebase_credentials
=======
from app.authentication import account_settings
from app.authentication import auth

from app.routes.prediction import router as prediction_router
from app.routes.dashboard import router as dashboard_router
from app.routes.p2pnavigation import router as p2pnavigation_router
from app.routes.notifications import router as notifications_router
from app.routes.crowdsourced import router as crowd_router

# Load environment variables
load_dotenv()
>>>>>>> 0d9375f6fc8a9b441e0c7bfc872f24a0cfe45df1

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
<<<<<<< HEAD
#app.include_router(traffic_router, tags=["Traffic"])
#app.include_router(weather_router, tags=["Weather"])
#app.include_router(ml_prediction_router, tags=["Prediction"])  # ✅ Consistent tag naming
#app.include_router(auth_router)  # Uncomment if needed
#app.include_router(p2pnavigation_router, prefix="/p2pnavigation", tags=["P2P Navigation"])
#app.include_router(ml_prediction_router, tags=["ML Prediction"])
app.include_router(prediction_router, prefix="/api/predict", tags=["Prediction"])
app.include_router(notifications_router, tags=["Notifications"])
app.include_router(crowd_router, tags=["Crowdsourced"])
#app.include_router(dashboard_router, prefix="/dashboard", tags=["Dashboard"]) # Include the dashboard router
#app.include_router(crowd_router) # Include the crowdsourced router
app.include_router(auth.router, prefix="/auth", tags=["Auth"])
=======
app.include_router(prediction_router)
app.include_router(p2pnavigation_router)
app.include_router(notifications_router)
app.include_router(dashboard_router)
app.include_router(crowd_router)
app.include_router(auth.router)
>>>>>>> 0d9375f6fc8a9b441e0c7bfc872f24a0cfe45df1
app.include_router(account_settings.router)

if __name__ == "__main__":
    import uvicorn
    db = get_firebase_credentials()
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port)
