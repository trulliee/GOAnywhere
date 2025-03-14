from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
import json

from app.database.firestore_utils import (
    create_user_incident, 
    get_user_incidents,
    get_incident_categories,
    update_user_incident_status,
    vote_user_incident,
    get_all_incidents
)

router = APIRouter(
    prefix="/api/incidents",
    tags=["user-incidents"],
    responses={404: {"description": "Not found"}},
)

# Define Pydantic models for data validation
class Location(BaseModel):
    latitude: float
    longitude: float
    name: str

class IncidentCreate(BaseModel):
    user_id: Optional[str] = None
    mode_of_transport: str
    type: str
    sub_type: str
    location: Location
    description: Optional[str] = None
    media: Optional[List[str]] = None

class IncidentResponse(BaseModel):
    id: str
    user_id: Optional[str] = None
    mode_of_transport: str
    type: str
    sub_type: str
    location: Dict[str, Any]
    time_reported: Any
    status: str
    upvotes: int
    downvotes: int
    description: Optional[str] = None
    media: Optional[List[str]] = None
    source: Optional[str] = None

class CategoryResponse(BaseModel):
    type: str
    categories: List[Dict[str, Any]]

# Routes for user-reported incidents
@router.post("/report", response_model=Dict[str, str])
async def report_incident(incident: IncidentCreate):
    """
    Create a new user-reported traffic incident
    """
    incident_data = incident.dict()
    incident_id = create_user_incident(incident_data)
    return {"id": incident_id, "message": "Incident reported successfully"}

@router.get("/user-reported", response_model=List[IncidentResponse])
async def get_user_reported_incidents(mode: Optional[str] = None, status: str = "active", limit: int = 50):
    """
    Get user-reported traffic incidents
    """
    incidents = get_user_incidents(mode, status, limit)
    return incidents

@router.get("/categories", response_model=Dict[str, CategoryResponse])
async def get_categories(mode: Optional[str] = None):
    """
    Get incident categories
    """
    return get_incident_categories(mode)

@router.put("/{incident_id}/status", response_model=Dict[str, str])
async def update_incident_status(incident_id: str, status: str):
    """
    Update status of a user-reported incident
    """
    success = update_user_incident_status(incident_id, status)
    if not success:
        raise HTTPException(status_code=404, detail="Incident not found or update failed")
    return {"message": f"Incident status updated to {status}"}

@router.post("/{incident_id}/vote", response_model=Dict[str, str])
async def vote_incident(incident_id: str, vote_type: str):
    """
    Vote on a user-reported incident
    """
    if vote_type not in ["upvote", "downvote"]:
        raise HTTPException(status_code=400, detail="Vote type must be 'upvote' or 'downvote'")
    
    success = vote_user_incident(incident_id, vote_type)
    if not success:
        raise HTTPException(status_code=404, detail="Incident not found or vote failed")
    return {"message": f"Incident {vote_type}d successfully"}

@router.get("/all", response_model=List[IncidentResponse])
async def get_combined_incidents(
    mode: Optional[str] = None, 
    include_official: bool = True, 
    include_user_reported: bool = True,
    limit: int = 50
):
    """
    Get both official and user-reported incidents
    """
    incidents = get_all_incidents(mode, include_official, include_user_reported, limit)
    return incidents