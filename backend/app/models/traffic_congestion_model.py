import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, accuracy_score, f1_score, confusion_matrix
from sklearn.model_selection import StratifiedKFold, RandomizedSearchCV
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import FunctionTransformer
from scipy.stats import randint, uniform
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
        
        # Define peak hours for peak_hour_flag
        self.morning_peak_hours = list(range(7, 10))  # 7-9 AM
        self.evening_peak_hours = list(range(17, 21))  # 5-8 PM
    
    def prepare_data(self, speed_bands_df, incidents_df, weather_df, events_df, holidays_df):
        """
        Prepare and merge all data sources for model training
        """
        import pytz

        # Convert timestamps
        speed_bands_df['Timestamp'] = pd.to_datetime(speed_bands_df['Timestamp'])
        incidents_df['Timestamp'] = pd.to_datetime(incidents_df['Timestamp'])
        weather_df['stored_at'] = pd.to_datetime(weather_df['stored_at'])

        # Extract time features
        speed_bands_df['hour'] = speed_bands_df['Timestamp'].dt.hour
        speed_bands_df['day_of_week'] = speed_bands_df['Timestamp'].dt.dayofweek
        speed_bands_df['month'] = speed_bands_df['Timestamp'].dt.month
        speed_bands_df['date'] = speed_bands_df['Timestamp'].dt.date

        # Peak hour flag
        speed_bands_df['peak_hour_flag'] = speed_bands_df['hour'].apply(
            lambda x: 1 if (x in self.morning_peak_hours or x in self.evening_peak_hours) else 0
        )

        # Day type
        speed_bands_df['day_type'] = speed_bands_df['day_of_week'].apply(
            lambda x: 'weekend' if x >= 5 else 'weekday'
        )

        # Road type
        if 'RoadCategory' in speed_bands_df.columns:
            expressway_categories = ['Expressway', 'Highway', 'ERP']
            speed_bands_df['road_type'] = speed_bands_df['RoadCategory'].apply(
                lambda x: 'expressway' if any(cat.lower() in str(x).lower() for cat in expressway_categories) else 'normal'
            )
        elif 'RoadName' in speed_bands_df.columns:
            expressway_identifiers = ['PIE', 'CTE', 'ECP', 'AYE', 'KPE', 'TPE', 'SLE', 'BKE', 'MCE']
            speed_bands_df['road_type'] = speed_bands_df['RoadName'].apply(
                lambda x: 'expressway' if any(id in str(x).upper() for id in expressway_identifiers) else 'normal'
            )
        else:
            speed_bands_df['road_type'] = 'normal'

        # Holidays
        if not holidays_df.empty and 'Date' in holidays_df.columns:
            holidays = set(pd.to_datetime(holidays_df['Date']).dt.date)
            speed_bands_df['is_holiday'] = speed_bands_df['date'].apply(lambda x: x in holidays).astype(int)
        else:
            speed_bands_df['is_holiday'] = 0

        # Events
        if not events_df.empty:
            if 'date' in events_df.columns:
                events_df['event_date'] = pd.to_datetime(events_df['date']).dt.date
            elif 'start_date' in events_df.columns:
                events_df['event_date'] = pd.to_datetime(events_df['start_date']).dt.date
            else:
                events_df['event_date'] = pd.NaT

            events_df = events_df.dropna(subset=['event_date'])

            event_counts = events_df.groupby('event_date').size().reset_index(name='event_count')

            if 'participants' in events_df.columns:
                events_df['event_severity'] = events_df['participants'].apply(
                    lambda x: 2 if x > 1000 else (1 if x > 100 else 0)
                ).fillna(0)

                event_severity = events_df.groupby('event_date').agg({
                    'event_severity': ['max', 'sum']
                }).reset_index()
                event_severity.columns = ['event_date', 'max_event_severity', 'sum_event_severity']

                event_features = pd.merge(event_counts, event_severity, on='event_date', how='left')

                speed_bands_df = pd.merge(speed_bands_df, event_features, left_on='date', right_on='event_date', how='left')

                speed_bands_df['max_event_severity'] = speed_bands_df['max_event_severity'].fillna(0)
                speed_bands_df['sum_event_severity'] = speed_bands_df['sum_event_severity'].fillna(0)
            else:
                speed_bands_df = pd.merge(speed_bands_df, event_counts, left_on='date', right_on='event_date', how='left')

            speed_bands_df['event_count'] = speed_bands_df['event_count'].fillna(0)
        else:
            speed_bands_df['event_count'] = 0
            speed_bands_df['max_event_severity'] = 0
            speed_bands_df['sum_event_severity'] = 0

        # Handle incidents
        if not incidents_df.empty:
            incidents_df['date'] = incidents_df['Timestamp'].dt.date
            incidents_df['hour'] = incidents_df['Timestamp'].dt.hour

            # Create datetime column and localize to UTC
            speed_bands_df['datetime'] = pd.to_datetime(
                speed_bands_df['date'].astype(str) + ' ' +
                speed_bands_df['hour'].astype(str) + ':00:00'
            ).dt.tz_localize('UTC')  # 💥 Patch: Localize once here

            # Check if 'Location' column exists
            if 'Location' in incidents_df.columns:
                # Function to check for recent incidents with location filtering
                def has_recent_incident(row):
                    timestamp = row['datetime']
                    road_name = row.get('RoadName', None)
                    start_time = timestamp - pd.Timedelta(hours=3)

                    if road_name:
                        recent_incidents = incidents_df[
                            (incidents_df['Timestamp'] >= start_time) &
                            (incidents_df['Timestamp'] <= timestamp) &
                            (incidents_df['Location'].str.contains(road_name, na=False))
                        ]
                    else:
                        recent_incidents = incidents_df[
                            (incidents_df['Timestamp'] >= start_time) &
                            (incidents_df['Timestamp'] <= timestamp)
                        ]

                    return 1 if len(recent_incidents) > 0 else 0
            else:
                def has_recent_incident(row):
                    timestamp = row['datetime']
                    start_time = timestamp - pd.Timedelta(hours=3)

                    recent_incidents = incidents_df[
                        (incidents_df['Timestamp'] >= start_time) &
                        (incidents_df['Timestamp'] <= timestamp)
                    ]

                    return 1 if len(recent_incidents) > 0 else 0

            # To avoid slow computation, apply to a sample first
            sample_size = min(1000, len(speed_bands_df))
            sampled_data = speed_bands_df.sample(sample_size, random_state=42)
            sampled_data['recent_incident_flag'] = sampled_data.apply(has_recent_incident, axis=1)
            incident_rate = sampled_data['recent_incident_flag'].mean()

            if incident_rate > 0:
                speed_bands_df['recent_incident_flag'] = speed_bands_df.apply(has_recent_incident, axis=1)
            else:
                speed_bands_df['recent_incident_flag'] = 0

            # Standard incident count per day
            incident_counts = incidents_df.groupby('date').size().reset_index(name='incident_count')
            speed_bands_df = pd.merge(speed_bands_df, incident_counts, on='date', how='left')
            speed_bands_df['incident_count'] = speed_bands_df['incident_count'].fillna(0)
        else:
            speed_bands_df['incident_count'] = 0
            speed_bands_df['recent_incident_flag'] = 0

        # Speed Band Previous Hour
        speed_bands_copy = speed_bands_df.copy()
        speed_bands_copy['next_hour'] = (speed_bands_copy['hour'] + 1) % 24
        speed_bands_copy['next_date'] = speed_bands_copy['date']
        speed_bands_copy.loc[speed_bands_copy['hour'] == 23, 'next_date'] = speed_bands_copy['date'] + pd.Timedelta(days=1)

        prev_hour_data = speed_bands_copy[['RoadName', 'next_date', 'next_hour', 'SpeedBand']]
        prev_hour_data = prev_hour_data.rename(columns={
            'next_date': 'date',
            'next_hour': 'hour',
            'SpeedBand': 'speed_band_previous_hour'
        })

        speed_bands_df = pd.merge(
            speed_bands_df,
            prev_hour_data,
            on=['RoadName', 'date', 'hour'],
            how='left'
        )

        mean_speed_band = speed_bands_df['SpeedBand'].mean()
        speed_bands_df['speed_band_previous_hour'] = speed_bands_df['speed_band_previous_hour'].fillna(mean_speed_band)

        # Weather
        if not weather_df.empty:
            weather_df['date'] = weather_df['stored_at'].dt.date
            weather_df['hour'] = weather_df['stored_at'].dt.hour

            weather_features = weather_df.groupby(['date', 'hour']).agg({
                'temperature': 'mean',
                'humidity': 'mean'
            }).reset_index()

            if 'rainfall' in weather_df.columns or 'precipitation' in weather_df.columns:
                rain_col = 'rainfall' if 'rainfall' in weather_df.columns else 'precipitation'
                weather_df['rain_flag'] = (weather_df[rain_col] > 0.1).astype(int)
                rain_features = weather_df.groupby(['date', 'hour'])['rain_flag'].max().reset_index()
                weather_features = pd.merge(weather_features, rain_features, on=['date', 'hour'], how='left')
            else:
                weather_features['rain_flag'] = (weather_features['humidity'] > 85).astype(int)

            speed_bands_df = pd.merge(
                speed_bands_df,
                weather_features,
                on=['date', 'hour'],
                how='left'
            )
        else:
            speed_bands_df['temperature'] = 27.0
            speed_bands_df['humidity'] = 75.0
            speed_bands_df['rain_flag'] = 0

        speed_bands_df['temperature'] = speed_bands_df['temperature'].fillna(speed_bands_df['temperature'].mean())
        speed_bands_df['humidity'] = speed_bands_df['humidity'].fillna(speed_bands_df['humidity'].mean())
        speed_bands_df['rain_flag'] = speed_bands_df['rain_flag'].fillna(0).astype(int)

        # Create target variable
        speed_bands_df['congestion'] = (speed_bands_df['SpeedBand'] >= 3).astype(int)

        # Prepare final dataset
        feature_columns = [
            'RoadName', 'RoadCategory', 'hour', 'day_of_week', 'month', 'is_holiday',
            'event_count', 'incident_count', 'temperature', 'humidity',
            'peak_hour_flag', 'day_type', 'road_type', 'recent_incident_flag',
            'speed_band_previous_hour', 'rain_flag'
        ]

        if 'max_event_severity' in speed_bands_df.columns:
            feature_columns.extend(['max_event_severity', 'sum_event_severity'])

        X = speed_bands_df[feature_columns]
        y = speed_bands_df['congestion']

        X = X.fillna({
            'temperature': 27.0,
            'humidity': 75.0,
            'event_count': 0,
            'incident_count': 0,
            'peak_hour_flag': 0,
            'day_type': 'weekday',
            'road_type': 'normal',
            'recent_incident_flag': 0,
            'speed_band_previous_hour': mean_speed_band,
            'rain_flag': 0,
            'max_event_severity': 0,
            'sum_event_severity': 0
        })

        X = X.dropna()
        y = y.loc[X.index]

        return X, y

    def build_model(self):
        """
        Define the model pipeline with preprocessing
        """
        # Get all feature names from the training data
        categorical_features = ['RoadName', 'RoadCategory', 'day_type', 'road_type']
        
        # Not all categorical features might be available, filter them
        categorical_features = [f for f in categorical_features if f in self.feature_names]
        
        # Define numerical features
        base_numerical_features = [
            'hour', 'day_of_week', 'month', 'is_holiday', 
            'event_count', 'incident_count', 'temperature', 'humidity'
        ]
        
        # Add new numerical features
        new_numerical_features = [
            'peak_hour_flag', 'recent_incident_flag', 
            'speed_band_previous_hour', 'rain_flag',
            'max_event_severity', 'sum_event_severity'
        ]
        
        # Combine numerical features and filter to only those available
        numerical_features = [f for f in base_numerical_features + new_numerical_features 
                             if f in self.feature_names]
        
        # Create preprocessing steps for both feature types
        categorical_transformer = Pipeline(steps=[
            ('onehot', OneHotEncoder(handle_unknown='ignore'))
        ])
        
        numerical_transformer = Pipeline(steps=[
            ('scaler', StandardScaler())
        ])
        
        # Combine preprocessing steps
        transformers = []
        
        if categorical_features:
            transformers.append(('cat', categorical_transformer, categorical_features))
        
        if numerical_features:
            transformers.append(('num', numerical_transformer, numerical_features))
            
        self.preprocessor = ColumnTransformer(transformers=transformers)
        
        # Create the modeling pipeline
        self.model = Pipeline(steps=[
            ('preprocessor', self.preprocessor),
            ('classifier', RandomForestClassifier(
                n_estimators=100,
                max_depth=5,
                random_state=42,
                n_jobs=-1
            ))
        ])
        
        return self.model

    def train(self, X, y, n_splits=5, n_iter=30):
        """
        Train the model with Stratified Cross-Validation and Hyperparameter Tuning
        """
        # Store feature names for use in build_model
        self.feature_names = X.columns.tolist()

        # Build model pipeline
        self.build_model()

        print("\n🔵 Starting Cross-Validation and Hyperparameter Tuning...")

        # Define cross-validation strategy
        skf = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=42)

        # Define hyperparameter search space
        param_distributions = {
            'classifier__n_estimators': randint(100, 500),
            'classifier__max_depth': randint(5, 20),
            'classifier__min_samples_split': randint(2, 10),
            'classifier__min_samples_leaf': randint(1, 10),
            'classifier__max_features': ['sqrt', 'log2'],
            'classifier__bootstrap': [True, False]
        }

        # Setup RandomizedSearchCV
        random_search = RandomizedSearchCV(
            self.model,
            param_distributions=param_distributions,
            n_iter=n_iter,
            cv=skf,
            scoring='f1',  # Focus on F1 Score for imbalanced classes
            verbose=2,
            n_jobs=-1,
            random_state=42
        )

        # Perform search
        random_search.fit(X, y)

        print("\n✅ Best Hyperparameters Found:")
        print(random_search.best_params_)

        # Set the best model
        self.model = random_search.best_estimator_

        # Final evaluation on full data
        print("\n🔵 Retraining on FULL data with best parameters...")
        self.model.fit(X, y)

        # Evaluate on full data
        y_pred = self.model.predict(X)
        accuracy = accuracy_score(y, y_pred)
        f1 = f1_score(y, y_pred)
        cm = confusion_matrix(y, y_pred)

        print("\n✅ Final Model Metrics (on Full Data):")
        print(f"Accuracy: {accuracy:.4f}")
        print(f"F1 Score: {f1:.4f}")
        print("\nConfusion Matrix:")
        print(cm)

        # Get final feature importances
        feature_importances = None
        if hasattr(self.model['classifier'], 'feature_importances_'):
            feature_names = self.model['preprocessor'].get_feature_names_out()
            feature_importances = self.model['classifier'].feature_importances_

            feature_importance_df = pd.DataFrame({
                'Feature': feature_names,
                'Importance': feature_importances
            }).sort_values('Importance', ascending=False)

            print("\nTop 15 Most Important Features:")
            print(feature_importance_df.head(15))
        else:
            feature_importance_df = None

        return {
            'accuracy': accuracy,
            'f1_score': f1,
            'model': self.model,
            'best_params': random_search.best_params_,
            'feature_importances': feature_importance_df
        }

    @staticmethod
    def to_dataframe(X):
        if isinstance(X, list):
            return pd.DataFrame(X)
        elif isinstance(X, dict):
            return pd.DataFrame([X])
        elif isinstance(X, pd.DataFrame):
            return X
        else:
            raise ValueError("Unsupported input type")

    def save_model(self, local_path="models/trained/traffic_congestion"):
        """
        Save the model to a local path with input preprocessor wrapper
        """
        if self.model is None:
            raise ValueError("Model has not been trained yet")

        # 🧠 Wrap the model to make it compatible with Vertex AI
        wrapped_model = make_pipeline(
            FunctionTransformer(self.to_dataframe),
            self.model
        )

        os.makedirs(local_path, exist_ok=True)
        joblib.dump(wrapped_model, f"{local_path}/model.joblib")
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