import sys
import os

# Add the parent directory to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import the initialization function
from app.database.firestore_utils import initialize_incident_categories

if __name__ == "__main__":
    print("Initializing incident categories...")
    initialize_incident_categories()
    print("Done!")