import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.traffic import router as traffic_router  
from app.routes.weather import router as weather_router
from app.routes.prediction import router as prediction_router
from app.routes import incidents
from app.routes.user_incidents import router as user_incidents_router
from app.routes.auth import router as auth_router  # Import the auth router
from dotenv import load_dotenv
load_dotenv()


# Initialize FastAPI
app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://192.168.1.12:8081"],  # Update this in production with your actual origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Root test route
@app.get("/")
def root():
    return {"message": "Hello, World!"}

# Include routers
app.include_router(traffic_router, tags=["Traffic"])
app.include_router(weather_router, tags=["Weather"])
app.include_router(prediction_router, tags=["Prediction"])
app.include_router(incidents.router)
app.include_router(user_incidents_router)
app.include_router(auth_router)  # Add the auth router