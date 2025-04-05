import sys
import os
import firebase_admin
from firebase_admin import credentials, firestore

# Add the parent directory to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Create a function to update incident categories
def update_incident_categories():
    """
    Update the incident categories collection with the new structure.
    """
    try:
        # Check if Firebase app has been initialized
        if not firebase_admin._apps:
            try:
                # Try to get the credentials from the environment via Secret Manager
                from app.database.firestore_utils import db
            except:
                # Fallback to local service account key
                cred = credentials.Certificate("service-account-key.json")
                firebase_admin.initialize_app(cred)
        
        # Get Firestore client
        db = firestore.client()
        incident_categories_ref = db.collection('incident_categories')
        
        print("Updating incident categories...")
        
        # Define updated categories for driving mode (3x2 grid)
        driving_categories = {
            'type': 'driving',
            'categories': [
                {'name': 'Accidents', 'subcategories': ['Shoulder', 'Road', 'Multi-Vehicle', 'Hit and Run']},
                {'name': 'Road Works', 'subcategories': ['Shoulder', 'Road', 'Lane Closure', 'Diversion']},
                {'name': 'Hazards', 'subcategories': ['Object on Road', 'Slippery Road', 'Pothole', 'Oil Spill']},
                {'name': 'Weather', 'subcategories': ['Heavy Rain', 'Floods', 'Strong Winds', 'Fog']},
                {'name': 'Traffic Police', 'subcategories': ['Road Block', 'Speed Trap', 'Random Check', 'Security']},
                {'name': 'Map Issues', 'subcategories': ['Wrong Street Name', 'Road Missing', 'Incorrect Speed Limit']}
            ]
        }
        
        # Define updated categories for public transport mode (4x2 grid)
        public_transport_categories = {
            'type': 'public_transport',
            'categories': [
                {'name': 'Accidents', 'subcategories': ['Train Collision', 'Bus Crash', 'Passenger Injury']},
                {'name': 'Delays', 'subcategories': ['Train Delay', 'Bus Delay', 'Schedule Change']},
                {'name': 'Hazards', 'subcategories': ['Platform Hazard', 'Bus Stop Hazard', 'Broken Facility']},
                {'name': 'High Crowds', 'subcategories': ['Station Crowded', 'Bus Overcrowded', 'Queue']},
                {'name': 'Transit Works', 'subcategories': ['Station Renovation', 'Track Work', 'Bus Lane Work']},
                {'name': 'Weather', 'subcategories': ['Heavy Rain', 'Floods', 'Strong Winds', 'Service Impact']},
                {'name': 'Traffic Police', 'subcategories': ['Security Check', 'Fare Inspection', 'Checkpoint']},
                {'name': 'Map Issues', 'subcategories': ['Wrong Stop Name', 'Missing Route', 'Incorrect Schedule']}
            ]
        }
        
        # Update in Firestore
        incident_categories_ref.document('driving').set(driving_categories)
        incident_categories_ref.document('public_transport').set(public_transport_categories)
        
        print("Incident categories updated successfully.")
    except Exception as e:
        print(f"Error updating incident categories: {e}")

if __name__ == "__main__":
    update_incident_categories()