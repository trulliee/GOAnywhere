import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.traffic import router as traffic_router  
from app.routes.weather import router as weather_router
from app.routes.prediction import router as prediction_router
from app.routes.traffic_incidents import router as traffic_incidents_router
from app.routes.auth import router as auth_router  # Import the auth router
from app.dashboard import router as dashboard_router  # Import the dashboard router
from app.p2pnavigation import router as p2pnavigation_router  # Import the p2pnavigation router
from app.notifications import router as notifications_router # Import the notifications router
from dotenv import load_dotenv

dotenv_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
load_dotenv(dotenv_path)
print("GOOGLE_MAPS_API_KEY =", os.getenv("GOOGLE_MAPS_API_KEY"))

import logging


# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("uvicorn")

# Initialize FastAPIS
app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    #allow_origins=["http://192.168.68.62:8081"],  # Update this in production with your actual origins
    allow_origins=["*"],  # Update this in production with your actual origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add this middleware to log all requests
@app.middleware("http")
async def log_requests(request, call_next):
    logger.info(f"Request path: {request.method} {request.url.path}")
    response = await call_next(request)
    logger.info(f"Response status: {response.status_code}")
    return response
# Root test route
@app.get("/")
def root():
    return {"message": "Hello, World!"}

# Include routers
app.include_router(traffic_router, tags=["Traffic"])
app.include_router(weather_router, tags=["Weather"])
app.include_router(prediction_router)  
app.include_router(auth_router)  # Add the auth router
app.include_router(p2pnavigation_router, prefix="/p2pnavigation", tags=["P2P Navigation"]) # Include the p2pnavigation router
app.include_router(notifications_router, tags=["Notifications"])
app.include_router(dashboard_router, prefix="/dashboard", tags=["Dashboard"]) # Include the dashboard router
