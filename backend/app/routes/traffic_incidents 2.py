from fastapi import APIRouter, Depends, HTTPException, Body, Path, Query
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
import json

from app.database.firestore_utils import (
    initialize_user_incident,
    get_user_incidents,
    get_incident_categories,
    get_incident_validation_status,
    vote_on_incident
)

router = APIRouter(
    prefix="/api/traffic",
    tags=["traffic-incidents"],
    responses={404: {"description": "Not found"}},
)

# Define Pydantic models for validation
class Location(BaseModel):
    latitude: float
    longitude: float
    name: Optional[str] = None

class TrafficIncidentCreate(BaseModel):
    user_id: Optional[str] = None
    mode_of_transport: str = Field(..., description="Either 'driving' or 'public_transport'")
    type: str = Field(..., description="Main incident category type")
    sub_type: str = Field(..., description="Subcategory of the incident")
    location: Location
    description: Optional[str] = None
    media: Optional[List[str]] = None

class IncidentVote(BaseModel):
    user_id: str
    vote_type: str = Field(..., description="Either 'approve' or 'reject'")

class IncidentResponse(BaseModel):
    id: str
    mode_of_transport: str
    type: str
    sub_type: str
    location: Dict[str, Any]
    time_reported: Any
    status: str
    approves: int = 0
    rejects: int = 0
    description: Optional[str] = None
    media: Optional[List[str]] = None

# Step 1-5: Report traffic incident flow
@router.post("/incidents/report", response_model=Dict[str, str])
async def report_traffic_incident(incident: TrafficIncidentCreate):
    """
    Create a new traffic incident report
    
    Step 1-5 of the user flow:
    - User selects incident type and subcategory
    - Location, date and time are automatically filled
    - User submits report
    """
    incident_data = incident.dict()
    
    # Initialize with validation fields
    incident_id = initialize_user_incident(incident_data)
    
    return {
        "id": incident_id,
        "message": "Traffic incident reported successfully"
    }

# Get all traffic incidents with optional filtering
@router.get("/incidents", response_model=List[IncidentResponse])
async def get_traffic_incidents(
    mode: Optional[str] = Query(None, description="Filter by 'driving' or 'public_transport'"),
    status: str = Query("pending", description="Filter by status: 'pending', 'verified', 'false_report'"),
    limit: int = Query(50, description="Maximum number of incidents to return")
):
    """
    Get traffic incidents with optional filtering
    
    Step 7: All reports will appear in traffic incident screen
    """
    incidents = get_user_incidents(mode, status, limit)
    return incidents

# Get incident categories based on mode of transport
@router.get("/incidents/categories", response_model=Dict[str, Any])
async def get_traffic_incident_categories(
    mode: Optional[str] = Query(None, description="Filter by 'driving' or 'public_transport'")
):
    """
    Get available traffic incident categories for reporting
    
    Step 2-3: User picks incident type and subcategory
    """
    return get_incident_categories(mode)

# Step 8-10: Verification flow
@router.post("/incidents/{incident_id}/vote", response_model=Dict[str, Any])
async def vote_on_traffic_incident(
    incident_id: str = Path(..., description="The ID of the incident to vote on"),
    vote_data: IncidentVote = Body(...)
):
    """
    Vote on a traffic incident (approve or reject)
    
    Step 8-10 of the user flow:
    - Users can verify if reports are true or false
    - Users click approve or reject
    - Confirm or cancel the vote
    - 10 approves within 20 minutes = verified
    - 10 rejects within 20 minutes = false report
    """
    if vote_data.vote_type not in ["approve", "reject"]:
        raise HTTPException(status_code=400, detail="Vote type must be 'approve' or 'reject'")
    
    result = vote_on_incident(incident_id, vote_data.user_id, vote_data.vote_type)
    
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    
    return result

# Get validation status for an incident
@router.get("/incidents/{incident_id}/status", response_model=Dict[str, Any])
async def get_traffic_incident_status(
    incident_id: str = Path(..., description="The ID of the incident to check")
):
    """
    Get the current validation status of a traffic incident
    
    - Shows current approve/reject counts
    - Shows time remaining in validation window
    - Shows number of votes needed to verify or mark as false
    """
    result = get_incident_validation_status(incident_id)
    
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    
    return result