import pandas as pd
import joblib

# Load trained model
model_path = "../models/trained/traffic_congestion/model.joblib"
model = joblib.load(model_path)

# Create a sample input matching the training features
sample_input = {
    "RoadName": "PIE",                   # Expressway name
    "RoadCategory": "Expressway",       # Category of road
    "day_type": "weekday",              # 'weekday' or 'weekend'
    "road_type": "expressway",          # 'expressway' or 'normal'

    "hour": 8,                          # 24-hour format
    "day_of_week": 2,                   # Monday=0, Sunday=6
    "month": 4,                         # April
    "is_holiday": 0,                    # 0 = not a holiday, 1 = holiday

    "event_count": 2,                   # Number of events on that day
    "incident_count": 5,                # Number of incidents on that day

    "temperature": 32.5,                # in degrees Celsius
    "humidity": 80.0,                   # in percentage

    "peak_hour_flag": 1,                # 1 if during peak hour
    "recent_incident_flag": 1,          # 1 if incident occurred in last 3 hours
    "speed_band_previous_hour": 3.5,    # average speed band from previous hour
    "rain_flag": 0,                     # 0 = no rain, 1 = rain

    "max_event_severity": 1,            # max severity of events (0-2)
    "sum_event_severity": 2             # total severity across events
}

# Convert to DataFrame
input_df = pd.DataFrame([sample_input])

# Run prediction
prediction = model.predict(input_df)
predicted_class = prediction[0]  # 1 = congestion, 0 = no congestion

# Optional: Get probability of each class
if hasattr(model, "predict_proba"):
    proba = model.predict_proba(input_df)
    print(f"Class Probabilities: {proba[0]}")

# Output the prediction
print(f"🚦 Predicted Congestion: {'Yes' if predicted_class == 1 else 'No'}")
