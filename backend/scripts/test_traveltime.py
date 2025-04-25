import pandas as pd
import numpy as np
import joblib

# Load trained travel time model
model_path = "../models/trained/travel_time/model.joblib"
model = joblib.load(model_path)

# Create a sample input
sample_input = {
    "Expressway": "PIE",
    "Direction": "E",
    "Startpoint": "Bukit Timah",
    "Endpoint": "Toa Payoh",

    "hour": 8,
    "day_of_week": 2,   # Tuesday
    "month": 4,
    "is_holiday": 0,

    "event_count": 1,
    "incident_count": 3,
    "temperature": 31.5,
    "humidity": 78.0,

    "peak_hour_flag": 1,
    "day_type": "weekday",
    "road_type": "major",

    "recent_incident_flag": 1,
    "speed_band_previous_hour": 3.2,
    "rain_flag": 0,

    "max_event_severity": 1,
    "sum_event_severity": 1,

    "mean_incident_severity": 2,
    "max_incident_severity": 3,
    "sum_incident_severity": 6
}

# Convert to DataFrame
input_df = pd.DataFrame([sample_input])

# Run prediction
predicted_travel_time = model.predict(input_df)[0]

# Output the prediction
print(f"🕒 Predicted Travel Time: {predicted_travel_time:.2f} minutes")

# Inspect dummy prediction range
sample_batch = pd.DataFrame([sample_input for _ in range(100)])
predictions = model.predict(sample_batch)

print(f"Mean predicted travel time: {np.mean(predictions):.2f} minutes")
print(f"Min: {np.min(predictions):.2f}, Max: {np.max(predictions):.2f}")