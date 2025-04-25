import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Import routers
from app.routes.traffic import router as traffic_router
from app.routes.weather import router as weather_router
from app.prediction import router as ml_prediction_router  # ✅ Patch: import from app.prediction, NOT app.routes.prediction
# from app.routes.auth import router as auth_router  # Uncomment if you add auth later
from app.dashboard import router as dashboard_router
from app.p2pnavigation import router as p2pnavigation_router
from app.notifications import router as notifications_router
#from app.routes.prediction import router as ml_prediction_router
from app.authentication import account_settings
from app.authentication import auth
#from app.routes.prediction import router as prediction_router
#from app.routes.traffic_incidents import router as traffic_incidents_router
#from app.routes.auth import router as auth_router  # Import the auth router
from app.dashboard import router as dashboard_router  # Import the dashboard router
from app.p2pnavigation import router as p2pnavigation_router  # Import the p2pnavigation router
from app.notifications import router as notifications_router # Import the notifications router
from app.crowdsourced import router as crowd_router

# Load environment variables
load_dotenv()

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
app.include_router(traffic_router, tags=["Traffic"])
app.include_router(weather_router, tags=["Weather"])
app.include_router(ml_prediction_router, tags=["Prediction"])  # ✅ Consistent tag naming
# app.include_router(auth_router)  # Uncomment if needed
app.include_router(p2pnavigation_router, prefix="/p2pnavigation", tags=["P2P Navigation"])
#app.include_router(ml_prediction_router, tags=["ML Prediction"])
#app.include_router(auth_router)  # Add the auth router
app.include_router(p2pnavigation_router, prefix="/p2pnavigation", tags=["P2P Navigation"]) # Include the p2pnavigation router
app.include_router(notifications_router, tags=["Notifications"])
app.include_router(dashboard_router, prefix="/dashboard", tags=["Dashboard"])
app.include_router(crowd_router, tags=["Crowdsourced"])

# Run the app when executed directly
if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8080))  # Default to 8080 if PORT not set
    uvicorn.run("app.main:app", host="0.0.0.0", port=port)

app.include_router(dashboard_router, prefix="/dashboard", tags=["Dashboard"]) # Include the dashboard router
app.include_router(crowd_router) # Include the crowdsourced router
app.include_router(auth.router)
app.include_router(account_settings.router)