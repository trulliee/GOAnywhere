import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from xgboost import XGBClassifier
from sklearn.metrics import classification_report, accuracy_score, f1_score
import joblib
from google.cloud import storage, aiplatform
import datetime
import os

class TrafficCongestionModel:
    def __init__(self):
        self.model = None
        self.preprocessor = None
        self.model_name = "traffic_congestion_predictor"
        self.gcs_bucket = "goanywhere-traffic-data-history"
    
    def prepare_data(self, speed_bands_df, incidents_df, weather_df, events_df, holidays_df):
        """
        Prepare and merge all data sources for model training
        """
        # Convert timestamps to datetime objects
        speed_bands_df['Timestamp'] = pd.to_datetime(speed_bands_df['Timestamp'])
        incidents_df['Timestamp'] = pd.to_datetime(incidents_df['Timestamp'])
        weather_df['stored_at'] = pd.to_datetime(weather_df['stored_at'])

        # Extract time features
        speed_bands_df['hour'] = speed_bands_df['Timestamp'].dt.hour
        speed_bands_df['day_of_week'] = speed_bands_df['Timestamp'].dt.dayofweek
        speed_bands_df['month'] = speed_bands_df['Timestamp'].dt.month
        speed_bands_df['date'] = speed_bands_df['Timestamp'].dt.date

        # Handle holidays
        if not holidays_df.empty and 'Date' in holidays_df.columns:
            holidays = set(pd.to_datetime(holidays_df['Date']).dt.date)
            speed_bands_df['is_holiday'] = speed_bands_df['date'].apply(lambda x: x in holidays).astype(int)
        else:
            speed_bands_df['is_holiday'] = 0

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
            speed_bands_df = pd.merge(speed_bands_df, event_counts, left_on='date', right_on='event_date', how='left')
            speed_bands_df['event_count'] = speed_bands_df['event_count'].fillna(0)
        else:
            speed_bands_df['event_count'] = 0

        # Handle incidents
        if not incidents_df.empty:
            incidents_df['date'] = incidents_df['Timestamp'].dt.date
            incident_counts = incidents_df.groupby('date').size().reset_index(name='incident_count')
            speed_bands_df = pd.merge(speed_bands_df, incident_counts, on='date', how='left')
            speed_bands_df['incident_count'] = speed_bands_df['incident_count'].fillna(0)
        else:
            speed_bands_df['incident_count'] = 0

        # Handle weather
        if not weather_df.empty:
            weather_df['date'] = weather_df['stored_at'].dt.date
            weather_df['hour'] = weather_df['stored_at'].dt.hour
            weather_features = weather_df.groupby(['date', 'hour']).agg({
                'temperature': 'mean',
                'humidity': 'mean'
            }).reset_index()

            speed_bands_df = pd.merge(
                speed_bands_df,
                weather_features,
                on=['date', 'hour'],
                how='left'
            )

        # Fill missing values
        speed_bands_df['temperature'] = speed_bands_df['temperature'].fillna(speed_bands_df['temperature'].mean())
        speed_bands_df['humidity'] = speed_bands_df['humidity'].fillna(speed_bands_df['humidity'].mean())

        # Create target variable
        speed_bands_df['congestion'] = (speed_bands_df['SpeedBand'] >= 3).astype(int)

        # Prepare final dataset
        X = speed_bands_df[[
            'RoadName', 'RoadCategory',
            'hour', 'day_of_week', 'month', 'is_holiday',
            'event_count', 'incident_count', 'temperature', 'humidity'
        ]]
        y = speed_bands_df['congestion']

        return X, y
    
    def build_model(self):
        """
        Define the model pipeline with preprocessing
        """
        # Define categorical and numerical features
        categorical_features = ['RoadName', 'RoadCategory']
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
            ('classifier', XGBClassifier(
                n_estimators=100,
                learning_rate=0.1,
                max_depth=5,
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
            X, y, test_size=0.2, random_state=42, stratify=y
        )
        
        if self.model is None:
            self.build_model()
        
        # Train the model
        self.model.fit(X_train, y_train)
        
        # Evaluate the model
        y_pred = self.model.predict(X_test)
        accuracy = accuracy_score(y_test, y_pred)
        f1 = f1_score(y_test, y_pred)
        
        print(f"Model Training Results:")
        print(f"Accuracy: {accuracy:.4f}")
        print(f"F1 Score: {f1:.4f}")
        print("\nClassification Report:")
        print(classification_report(y_test, y_pred))
        
        return {
            'accuracy': accuracy,
            'f1_score': f1,
            'model': self.model
        }
    
    def save_model(self, local_path="models/trained/traffic_congestion"):
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
            gcs_model_path = f"trained_models/traffic_congestion/{timestamp}/model.joblib"
        
        # Upload to GCS
        storage_client = storage.Client()
        bucket = storage_client.bucket(self.gcs_bucket)
        blob = bucket.blob(gcs_model_path)
        
        blob.upload_from_filename(local_model_path)
        
        print(f"Model uploaded to gs://{self.gcs_bucket}/{gcs_model_path}")
        return f"gs://{self.gcs_bucket}/{gcs_model_path}"
    
    def deploy_to_vertex(self, model_gcs_path, project_id, region="asia-southeast1"):
        """
        Deploy the model to Vertex AI
        """
        # Initialize Vertex AI
        aiplatform.init(project=project_id, location=region)
        
        # Create a model resource from the artifacts
        model = aiplatform.Model.upload(
            display_name=f"{self.model_name}_{datetime.datetime.now().strftime('%Y%m%d')}",
            artifact_uri=os.path.dirname(model_gcs_path),
            serving_container_image_uri="gcr.io/cloud-aiplatform/prediction/sklearn-cpu.1-0:latest",
            sync=True
        )
        
        # Deploy the model to an endpoint
        endpoint = model.deploy(
            machine_type="n1-standard-2",
            min_replica_count=1,
            max_replica_count=1
        )
        
        print(f"Model deployed to Vertex AI endpoint: {endpoint.name}")
        return endpoint

# Example usage:
# model = TrafficCongestionModel()
# X, y = model.prepare_data(speed_bands_df, incidents_df, weather_df, events_df, holidays_df)
# results = model.train(X, y)
# local_path = model.save_model()
# gcs_path = model.upload_to_gcs(local_path)
# endpoint = model.deploy_to_vertex(gcs_path, "your-gcp-project-id")