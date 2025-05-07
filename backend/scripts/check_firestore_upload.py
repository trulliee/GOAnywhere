import os
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# === Configuration ===
USE_LOCAL = os.getenv("USE_LOCAL_FIREBASE_CREDENTIALS") == "1"
CREDENTIALS_PATH = os.getenv("FIREBASE_CREDENTIALS_PATH")
THRESHOLD_DAYS = 2  # consider stale if no update in 2+ days

# === Initialize Firebase ===
if USE_LOCAL:
    if not CREDENTIALS_PATH or not os.path.exists(CREDENTIALS_PATH):
        raise FileNotFoundError("Valid FIREBASE_CREDENTIALS_PATH is required for local setup.")
    cred = credentials.Certificate(CREDENTIALS_PATH)
else:
    cred = credentials.ApplicationDefault()

firebase_admin.initialize_app(cred)
db = firestore.client()

# === Helper Functions ===
def is_stale(timestamp):
    """Return True if timestamp is older than threshold."""
    if not timestamp:
        return True
    return (datetime.now(timezone.utc) - timestamp).days > THRESHOLD_DAYS

# === Main Logic ===
stale_collections = []

print("🔍 Checking collections...\n")
collections = db.collections()
for col in collections:
    col_name = col.id
    print(f"📁 Collection: {col_name}")
    try:
        docs = col.order_by("last_updated", direction=firestore.Query.DESCENDING).limit(1).stream()
        latest_doc = next(docs, None)
        if latest_doc:
            last_updated = latest_doc.get("last_updated")
            if isinstance(last_updated, datetime):
                print(f"   ⏱ Last updated: {last_updated.isoformat()}")
                if is_stale(last_updated):
                    stale_collections.append((col_name, last_updated))
            else:
                print(f"   ⚠ No valid 'last_updated' field.")
                stale_collections.append((col_name, None))
        else:
            print("   ⚠ Collection is empty.")
            stale_collections.append((col_name, None))
    except Exception as e:
        print(f"   ❌ Error accessing collection: {e}")
        stale_collections.append((col_name, None))

# === Summary ===
print("\n🧯 === Stale or Inactive Collections ===")
if not stale_collections:
    print("✅ All collections have recent updates.")
else:
    for name, ts in stale_collections:
        print(f"🔸 {name} — Last updated: {ts}")
