import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import joblib
from google.cloud import storage
import datetime
import os

class TravelTimePredictionModel:
    def __init__(self):
        self.model = None
        self.preprocessor = None
        self.model_name = "travel_time_predictor"
        self.gcs_bucket = "goanywhere-traffic-data-history"
    
    def prepare_data(self, travel_times_df, incidents_df, speed_bands_df, weather_df, events_df, holidays_df):
        """
        Prepare and merge all data sources for model training
        """
        # Convert timestamps to datetime objects
        travel_times_df['Timestamp'] = pd.to_datetime(travel_times_df['Timestamp'])
        incidents_df['Timestamp'] = pd.to_datetime(incidents_df['Timestamp'])
        speed_bands_df['Timestamp'] = pd.to_datetime(speed_bands_df['Timestamp'])
        weather_df['stored_at'] = pd.to_datetime(weather_df['stored_at'])

        # Extract time features
        travel_times_df['hour'] = travel_times_df['Timestamp'].dt.hour
        travel_times_df['day_of_week'] = travel_times_df['Timestamp'].dt.dayofweek
        travel_times_df['month'] = travel_times_df['Timestamp'].dt.month
        travel_times_df['date'] = travel_times_df['Timestamp'].dt.date

        # Handle holidays
        if not holidays_df.empty and 'Date' in holidays_df.columns:
            holidays = set(pd.to_datetime(holidays_df['Date']).dt.date)
            travel_times_df['is_holiday'] = travel_times_df['date'].apply(lambda x: x in holidays).astype(int)
        else:
            travel_times_df['is_holiday'] = 0

        # Handle events
        if not events_df.empty:
            if 'date' in events_df.columns:
                events_df['event_date'] = pd.to_datetime(events_df['date']).dt.date
            elif 'start_date' in events_df.columns:
                events_df['event_date'] = pd.to_datetime(events_df['start_date']).dt.date
            else:
                events_df['event_date'] = pd.NaT

            events_df = events_df.dropna(subset=['event_date'])

            event_counts = events_df.groupby('event_date').size().reset_index(name='event_count')
            travel_times_df = pd.merge(travel_times_df, event_counts, left_on='date', right_on='event_date', how='left')
            travel_times_df['event_count'] = travel_times_df['event_count'].fillna(0)
        else:
            travel_times_df['event_count'] = 0

        # Handle incidents
        if not incidents_df.empty:
            incidents_df['date'] = incidents_df['Timestamp'].dt.date
            incident_counts = incidents_df.groupby('date').size().reset_index(name='incident_count')
            travel_times_df = pd.merge(travel_times_df, incident_counts, on='date', how='left')
            travel_times_df['incident_count'] = travel_times_df['incident_count'].fillna(0)
        else:
            travel_times_df['incident_count'] = 0

        # Handle weather
        if not weather_df.empty:
            weather_df['date'] = weather_df['stored_at'].dt.date
            weather_df['hour'] = weather_df['stored_at'].dt.hour
            weather_features = weather_df.groupby(['date', 'hour']).agg({
                'temperature': 'mean',
                'humidity': 'mean'
            }).reset_index()

            travel_times_df = pd.merge(
                travel_times_df,
                weather_features,
                on=['date', 'hour'],
                how='left'
            )

        # Fill missing values
        travel_times_df['temperature'] = travel_times_df['temperature'].fillna(travel_times_df['temperature'].mean())
        travel_times_df['humidity'] = travel_times_df['humidity'].fillna(travel_times_df['humidity'].mean())

        # Prepare final dataset
        X = travel_times_df[[
            'Expressway', 'Direction', 'Startpoint', 'Endpoint',
            'hour', 'day_of_week', 'month', 'is_holiday',
            'event_count', 'incident_count', 'temperature', 'humidity'
        ]]
        y = travel_times_df['Esttime']
        
        # Fill missing values with reasonable defaults
        X = X.fillna({
            'temperature': 27.0,
            'humidity': 75.0,
            'event_count': 0,
            'incident_count': 0
        })

        # After filling, drop any rows if somehow still NaN
        X = X.dropna()
        y = y.loc[X.index]

        return X, y

    def build_model(self):
        """
        Define the model pipeline with preprocessing
        """
        # Define categorical and numerical features
        categorical_features = ['Expressway', 'Direction', 'Startpoint', 'Endpoint']
        numerical_features = ['hour', 'day_of_week', 'month', 'is_holiday', 
                              'event_count', 'incident_count', 'temperature', 'humidity']
        
        # Create preprocessing steps for both feature types
        categorical_transformer = Pipeline(steps=[
            ('onehot', OneHotEncoder(handle_unknown='ignore'))
        ])
        
        numerical_transformer = Pipeline(steps=[
            ('scaler', StandardScaler())
        ])
        
        # Combine preprocessing steps
        self.preprocessor = ColumnTransformer(
            transformers=[
                ('cat', categorical_transformer, categorical_features),
                ('num', numerical_transformer, numerical_features)
            ])
        
        # Create the modeling pipeline
        self.model = Pipeline(steps=[
            ('preprocessor', self.preprocessor),
            ('regressor', RandomForestRegressor(
                n_estimators=100, 
                max_depth=15,
                random_state=42,
                n_jobs=-1
            ))
        ])
        
        return self.model
    
    def train(self, X, y):
        """
        Train the model
        """
        # Split the data into training and testing sets
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42
        )
        
        if self.model is None:
            self.build_model()
        
        # Train the model
        self.model.fit(X_train, y_train)
        
        # Evaluate the model
        y_pred = self.model.predict(X_test)
        rmse = np.sqrt(mean_squared_error(y_test, y_pred))
        mae = mean_absolute_error(y_test, y_pred)
        r2 = r2_score(y_test, y_pred)
        
        print(f"Model Training Results:")
        print(f"RMSE: {rmse:.2f}")
        print(f"MAE: {mae:.2f}")
        print(f"R²: {r2:.2f}")
        
        return {
            'rmse': rmse,
            'mae': mae,
            'r2': r2,
            'model': self.model
        }
    
    def save_model(self, local_path="models/trained/travel_time"):
        """
        Save the model to a local path
        """
        if self.model is None:
            raise ValueError("Model has not been trained yet")
        
        # Create the directory if it doesn't exist
        os.makedirs(local_path, exist_ok=True)
        
        # Save the model
        joblib.dump(self.model, f"{local_path}/model.joblib")
        
        print(f"Model saved to {local_path}/model.joblib")
        return f"{local_path}/model.joblib"
    
    def upload_to_gcs(self, local_model_path, gcs_model_path=None):
        """
        Upload the model to Google Cloud Storage
        """
        if gcs_model_path is None:
            timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            gcs_model_path = f"trained_models/travel_time/{timestamp}/model.joblib"
        
        # Upload to GCS
        storage_client = storage.Client()
        bucket = storage_client.bucket(self.gcs_bucket)
        blob = bucket.blob(gcs_model_path)
        
        blob.upload_from_filename(local_model_path)
        
        print(f"Model uploaded to gs://{self.gcs_bucket}/{gcs_model_path}")
        return f"gs://{self.gcs_bucket}/{gcs_model_path}"
    
    def deploy_to_vertex(self, gcs_model_path):
        """
        Deploy the model to Vertex AI
        Note: This is placeholder code - would need to be implemented
        """
        # Implementation for Vertex AI deployment
        # Would use google.cloud.aiplatform library
        print("Model ready for deployment to Vertex AI")

# Example usage:
# model = TravelTimePredictionModel()
# X, y = model.prepare_data(travel_times_df, incidents_df, speed_bands_df, weather_df, events_df, holidays_df)
# results = model.train(X, y)
# local_path = model.save_model()
# gcs_path = model.upload_to_gcs(local_path)
# model.deploy_to_vertex(gcs_path)