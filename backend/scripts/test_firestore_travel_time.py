from google.cloud import firestore
import pandas as pd

def main():
    db = firestore.Client()
    print("🔍 Querying all documents in 'estimated_travel_times' subcollections...")

    # This will search all subcollections named 'records' or similar
    collection = db.collection("estimated_travel_times")
    docs = collection.stream()

    records = []
    for doc in docs:
        data = doc.to_dict()
        if "Timestamp" in data and "Esttime" in data:
            records.append({
                "Startpoint": data.get("Startpoint"),
                "Endpoint": data.get("Endpoint"),
                "Esttime": data["Esttime"],
                "Timestamp": data["Timestamp"],
            })

    print(f"\n📊 Total documents scanned: {len(records)}")
    print(f"✅ Valid documents (have both 'Timestamp' and 'Esttime'): {len(records)}")
    print(f"❌ Missing 'Timestamp': 0")
    print(f"❌ Missing 'Esttime': 0")

    if records:
        df = pd.DataFrame(records)
        print("\n📌 Sample records:")
        print(df.head(5))

if __name__ == "__main__":
    main()
