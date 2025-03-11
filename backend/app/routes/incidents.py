from fastapi import APIRouter, Depends, HTTPException, Header
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
import uuid
from app.database.firestore_utils import db

router = APIRouter(
    prefix="/incidents",
    tags=["incidents"],
)

# Simple mock authentication - in a real app, use proper JWT tokens
MOCK_API_KEYS = {
    "user1_api_key": {"user_id": "user1", "name": "User 1"},
    "user2_api_key": {"user_id": "user2", "name": "User 2"},
    "admin_api_key": {"user_id": "admin", "name": "Admin User"}
}

# Mock authentication dependency
async def get_current_user(api_key: Optional[str] = Header(None)):
    if not api_key:
        return None  # Unauthenticated user
    
    if api_key not in MOCK_API_KEYS:
        return None  # Invalid API key
    
    return MOCK_API_KEYS[api_key]

# Models
class IncidentType:
    ACCIDENT = "accident"
    CONGESTION = "congestion"
    ROADBLOCK = "roadblock"

class IncidentBase(BaseModel):
    incident_type: str  # One of: "accident", "congestion", "roadblock"
    location: str
    description: Optional[str] = None

class IncidentCreate(IncidentBase):
    pass

class Incident(IncidentBase):
    id: str
    reported_at: datetime
    reporter_id: Optional[str] = None
    reporter_name: Optional[str] = None
    resolved: bool = False
    resolved_at: Optional[datetime] = None

    class Config:
        orm_mode = True

# Helper function to convert Firestore document to Incident model
def firestore_to_incident(doc):
    incident_data = doc.to_dict()
    incident_data['id'] = doc.id
    
    # Convert Firestore timestamp to datetime
    if 'reported_at' in incident_data:
        incident_data['reported_at'] = incident_data['reported_at'].datetime
    
    if 'resolved_at' in incident_data and incident_data['resolved_at']:
        incident_data['resolved_at'] = incident_data['resolved_at'].datetime
    
    return Incident(**incident_data)

@router.get("/", response_model=List[Incident])
async def get_incidents(
    incident_type: Optional[str] = None,
    location: Optional[str] = None,
    resolved: bool = False
):
    """
    Get all incidents with optional filtering.
    This endpoint is accessible to all users (both registered and unregistered).
    """
    incidents_ref = db.collection('incidents')
    query = incidents_ref
    
    # Apply filters
    if incident_type:
        query = query.where('incident_type', '==', incident_type)
    
    if resolved is not None:
        query = query.where('resolved', '==', resolved)
    
    # Execute query
    incidents = []
    for doc in query.stream():
        incident = firestore_to_incident(doc)
        
        # Apply location filter (Firestore doesn't support LIKE queries easily)
        if location and location.lower() not in incident.location.lower():
            continue
            
        incidents.append(incident)
    
    return incidents

@router.post("/", response_model=Incident)
async def create_incident(
    incident: IncidentCreate,
    current_user: dict = Depends(get_current_user)
):
    """
    Create a new incident report.
    This endpoint is only accessible to authenticated users.
    """
    # Check if user is authenticated
    if not current_user:
        raise HTTPException(
            status_code=401,
            detail="Not authenticated. Please provide a valid API key."
        )
    
    # Validate incident type
    valid_types = [IncidentType.ACCIDENT, IncidentType.CONGESTION, IncidentType.ROADBLOCK]
    if incident.incident_type not in valid_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid incident type. Must be one of: {', '.join(valid_types)}"
        )
    
    # Create incident document
    now = datetime.utcnow()
    incident_id = str(uuid.uuid4())
    
    incident_data = incident.dict()
    incident_data.update({
        "reported_at": now,
        "reporter_id": current_user["user_id"],
        "reporter_name": current_user["name"],
        "resolved": False,
    })
    
    # Save to Firestore
    db.collection('incidents').document(incident_id).set(incident_data)
    
    # Return created incident
    return Incident(id=incident_id, **incident_data)

@router.get("/{incident_id}", response_model=Incident)
async def get_incident(incident_id: str):
    """
    Get a specific incident by ID.
    This endpoint is accessible to all users.
    """
    doc = db.collection('incidents').document(incident_id).get()
    
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Incident not found")
    
    return firestore_to_incident(doc)

@router.put("/{incident_id}/resolve")
async def resolve_incident(
    incident_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Mark an incident as resolved.
    This endpoint is only accessible to authenticated users.
    """
    # Check if user is authenticated
    if not current_user:
        raise HTTPException(
            status_code=401,
            detail="Not authenticated. Please provide a valid API key."
        )
    
    # Get the incident
    doc_ref = db.collection('incidents').document(incident_id)
    doc = doc_ref.get()
    
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Incident not found")
    
    incident_data = doc.to_dict()
    
    # Only the reporter or an admin can resolve the incident
    if current_user["user_id"] != incident_data.get("reporter_id") and current_user["user_id"] != "admin":
        raise HTTPException(
            status_code=403,
            detail="Not authorized to resolve this incident"
        )
    
    # Update incident
    doc_ref.update({
        "resolved": True,
        "resolved_at": datetime.utcnow()
    })
    
    return {"message": "Incident marked as resolved"}