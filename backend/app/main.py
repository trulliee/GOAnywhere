import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Import routers
from app.authentication import account_settings
from app.authentication import auth

from app.routes.prediction import router as prediction_router
from app.routes.dashboard import router as dashboard_router
from app.routes.p2pnavigation import router as p2pnavigation_router
from app.routes.notifications import router as notifications_router
from app.routes.crowdsourced import router as crowd_router

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
app.include_router(prediction_router)
app.include_router(p2pnavigation_router)
app.include_router(notifications_router)
app.include_router(dashboard_router)
app.include_router(crowd_router)
app.include_router(auth.router)
app.include_router(account_settings.router)

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port)
