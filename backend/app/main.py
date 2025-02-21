import os
from fastapi import FastAPI
from app.routes.traffic import router as traffic_router  
from app.routes.weather import router as weather_router
from app.prediction import router as prediction_router

# Initialize FastAPI
app = FastAPI()

# Root test route
@app.get("/")
def root():
    return {"message": "Hello, World!"}

# Include routers
app.include_router(traffic_router, tags=["Traffic"])
app.include_router(weather_router, tags=["Weather"])
app.include_router(prediction_router, tags=["Prediction"])
