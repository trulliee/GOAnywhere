import pandas as pd
from google.cloud import aiplatform

# ====== CONFIGURATION ======
PROJECT_ID = "goanywhere-c55c8"
REGION = "asia-southeast1"
ENDPOINT_ID = "3500013792048185344"

# Feature columns that your model expects (order matters)
FEATURE_COLUMNS = [
    'RoadName', 'RoadCategory', 'hour', 'day_of_week', 'month', 'is_holiday',
    'event_count', 'incident_count', 'temperature', 'humidity',
    'peak_hour_flag', 'day_type', 'road_type', 'recent_incident_flag',
    'speed_band_previous_hour', 'rain_flag'
]

# ====== SAMPLE INPUT ======
sample_instances = [
    ["CTE", "Expressway", 8, 2, 4, 0, 1, 0, 28, 70, 1, "weekday", "expressway", 0, 4.5, 0],
    ["PIE", "Expressway", 18, 5, 7, 1, 0, 2, 30, 65, 1, "weekend", "expressway", 1, 3.8, 1]
]

# ====== HELPER FUNCTION ======
def predict(instances):
    aiplatform.init(project=PROJECT_ID, location=REGION)
    endpoint = aiplatform.Endpoint(
        endpoint_name=f"projects/{PROJECT_ID}/locations/{REGION}/endpoints/{ENDPOINT_ID}"
    )
    response = endpoint.predict(instances=instances)
    return response

# ====== MAIN ======
if __name__ == "__main__":
    print("🚀 Sending prediction request...")

    response = predict(sample_instances)
    
    print("✅ Prediction Response:")
    print(response)