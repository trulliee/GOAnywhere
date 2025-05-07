import pandas as pd
import numpy as np
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.model_selection import StratifiedKFold, RandomizedSearchCV
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, f1_score, confusion_matrix
from scipy.stats import randint
import joblib
import os

class TrafficCongestionModel:
    def __init__(self):
        self.model = None
        self.preprocessor = None
        self.feature_names = None
        self.morning_peak_hours = list(range(7, 10))
        self.evening_peak_hours = list(range(17, 21))

    def process_inputs(self, json_input):
        """
        Processes JSON input into a DataFrame with correct columns and ordering.
        Ensures compatibility with training schema.
        """
        import pandas as pd
        import numpy as np

        if isinstance(json_input, dict):
            df = pd.DataFrame([json_input])
        elif isinstance(json_input, list):
            df = pd.DataFrame(json_input)
        else:
            raise ValueError("Input must be a dict or list of dicts")

        # Set default values for missing features (based on training logic)
        default_values = {
            'temperature': 27.0,
            'humidity': 75.0,
            'event_count': 0,
            'incident_count': 0,
            'peak_hour_flag': 0,
            'day_type': 'weekday',
            'road_type': 'normal',
            'recent_incident_flag': 0,
            'speed_band_previous_hour': 2,
            'rain_flag': 0,
            'max_event_severity': 0,
            'sum_event_severity': 0
        }

        for col in self.feature_names:
            if col not in df.columns:
                default = default_values.get(col, np.nan)
                df[col] = default
            else:
                df[col] = df[col].fillna(default_values.get(col, df[col].mean() if df[col].dtype in [np.float64, np.int64] else ''))

        # Enforce correct column order
        df = df[self.feature_names]

        return df

    def prepare_data(self, speed_bands_df, incidents_df, weather_df, events_df, holidays_df):
        import pytz

        speed_bands_df['Timestamp'] = pd.to_datetime(speed_bands_df['Timestamp'])
        incidents_df['Timestamp'] = pd.to_datetime(incidents_df['Timestamp'])
        weather_df['stored_at'] = pd.to_datetime(weather_df['stored_at'])

        speed_bands_df['hour'] = speed_bands_df['Timestamp'].dt.hour
        speed_bands_df['day_of_week'] = speed_bands_df['Timestamp'].dt.dayofweek
        speed_bands_df['month'] = speed_bands_df['Timestamp'].dt.month
        speed_bands_df['date'] = speed_bands_df['Timestamp'].dt.date

        speed_bands_df['peak_hour_flag'] = speed_bands_df['hour'].apply(
            lambda x: 1 if (x in self.morning_peak_hours or x in self.evening_peak_hours) else 0
        )

        speed_bands_df['day_type'] = speed_bands_df['day_of_week'].apply(
            lambda x: 'weekend' if x >= 5 else 'weekday'
        )

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

        if not holidays_df.empty and 'Date' in holidays_df.columns:
            holidays = set(pd.to_datetime(holidays_df['Date']).dt.date)
            speed_bands_df['is_holiday'] = speed_bands_df['date'].apply(lambda x: x in holidays).astype(int)
        else:
            speed_bands_df['is_holiday'] = 0

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

        if not incidents_df.empty:
            incidents_df['date'] = incidents_df['Timestamp'].dt.date
            incidents_df['hour'] = incidents_df['Timestamp'].dt.hour

            if 'Location' not in incidents_df.columns:
                incidents_df['Location'] = ""  

            speed_bands_df['datetime'] = pd.to_datetime(
                speed_bands_df['date'].astype(str) + ' ' + speed_bands_df['hour'].astype(str) + ':00:00'
            ).dt.tz_localize('UTC')

            def has_recent_incident(row):
                timestamp = row['datetime']
                road_name = row.get('RoadName', None)
                start_time = timestamp - pd.Timedelta(hours=3)
                if road_name:
                    recent_incidents = incidents_df[
                        (incidents_df['Timestamp'] >= start_time) & (incidents_df['Timestamp'] <= timestamp) &
                        (incidents_df['Location'].str.contains(road_name, na=False))
                    ]
                else:
                    recent_incidents = incidents_df[
                        (incidents_df['Timestamp'] >= start_time) & (incidents_df['Timestamp'] <= timestamp)
                    ]
                return 1 if len(recent_incidents) > 0 else 0

            sample_size = min(1000, len(speed_bands_df))
            sampled_data = speed_bands_df.sample(sample_size, random_state=42)
            sampled_data['recent_incident_flag'] = sampled_data.apply(has_recent_incident, axis=1)
            incident_rate = sampled_data['recent_incident_flag'].mean()

            if incident_rate > 0:
                speed_bands_df['recent_incident_flag'] = speed_bands_df.apply(has_recent_incident, axis=1)
            else:
                speed_bands_df['recent_incident_flag'] = 0

            incident_counts = incidents_df.groupby('date').size().reset_index(name='incident_count')
            speed_bands_df = pd.merge(speed_bands_df, incident_counts, on='date', how='left')
            speed_bands_df['incident_count'] = speed_bands_df['incident_count'].fillna(0)
        else:
            speed_bands_df['incident_count'] = 0
            speed_bands_df['recent_incident_flag'] = 0

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

        speed_bands_df = pd.merge(speed_bands_df, prev_hour_data, on=['RoadName', 'date', 'hour'], how='left')

        mean_speed_band = speed_bands_df['SpeedBand'].mean()
        speed_bands_df['speed_band_previous_hour'] = speed_bands_df['speed_band_previous_hour'].fillna(mean_speed_band)

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

            speed_bands_df = pd.merge(speed_bands_df, weather_features, on=['date', 'hour'], how='left')
        else:
            speed_bands_df['temperature'] = 27.0
            speed_bands_df['humidity'] = 75.0
            speed_bands_df['rain_flag'] = 0

        speed_bands_df['temperature'] = speed_bands_df['temperature'].fillna(speed_bands_df['temperature'].mean())
        speed_bands_df['humidity'] = speed_bands_df['humidity'].fillna(speed_bands_df['humidity'].mean())
        speed_bands_df['rain_flag'] = speed_bands_df['rain_flag'].fillna(0).astype(int)

        speed_bands_df['congestion'] = (speed_bands_df['SpeedBand'] >= 3).astype(int)

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
        categorical_features = ['RoadName', 'RoadCategory', 'day_type', 'road_type']
        categorical_features = [f for f in categorical_features if f in self.feature_names]

        base_numerical_features = [
            'hour', 'day_of_week', 'month', 'is_holiday',
            'event_count', 'incident_count', 'temperature', 'humidity'
        ]
        new_numerical_features = [
            'peak_hour_flag', 'recent_incident_flag', 'speed_band_previous_hour', 'rain_flag',
            'max_event_severity', 'sum_event_severity'
        ]
        numerical_features = [f for f in base_numerical_features + new_numerical_features if f in self.feature_names]

        categorical_transformer = Pipeline([
            ('onehot', OneHotEncoder(handle_unknown='ignore'))
        ])
        numerical_transformer = Pipeline([
            ('scaler', StandardScaler())
        ])

        transformers = []
        if categorical_features:
            transformers.append(('cat', categorical_transformer, categorical_features))
        if numerical_features:
            transformers.append(('num', numerical_transformer, numerical_features))

        self.preprocessor = ColumnTransformer(transformers=transformers)

        self.model = Pipeline([
            ('preprocessor', self.preprocessor),
            ('classifier', RandomForestClassifier(
                n_estimators=100, max_depth=5, random_state=42, n_jobs=-1
            ))
        ])

        return self.model

    def train(self, X, y, n_splits=5, n_iter=30):
        self.feature_names = X.columns.tolist()
        self.build_model()

        skf = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=42)
        param_distributions = {
            'classifier__n_estimators': randint(100, 500),
            'classifier__max_depth': randint(5, 20),
            'classifier__min_samples_split': randint(2, 10),
            'classifier__min_samples_leaf': randint(1, 10),
            'classifier__max_features': ['sqrt', 'log2'],
            'classifier__bootstrap': [True, False]
        }

        random_search = RandomizedSearchCV(
            self.model, param_distributions=param_distributions,
            n_iter=n_iter, cv=skf, scoring='f1', verbose=2, n_jobs=-1, random_state=42
        )

        random_search.fit(X, y)

        self.model = random_search.best_estimator_

        y_pred = self.model.predict(X)
        accuracy = accuracy_score(y, y_pred)
        f1 = f1_score(y, y_pred)
        cm = confusion_matrix(y, y_pred)

        return {
            'accuracy': accuracy,
            'f1_score': f1,
            'confusion_matrix': cm,
            'best_params': random_search.best_params_
        }

    def save_model(self, 
               trained_local_path="models/trained/traffic_congestion", 
               serving_local_path="model_serving/traffic_congestion"):
        if self.model is None:
            raise ValueError("Model has not been trained yet")

        # Create directories if they don't exist
        os.makedirs(trained_local_path, exist_ok=True)
        os.makedirs(serving_local_path, exist_ok=True)

        # Define paths
        trained_model_path = os.path.join(trained_local_path, "model.joblib")
        serving_model_path = os.path.join(serving_local_path, "model.joblib")

        # Save to both places
        joblib.dump(self.model, trained_model_path)
        joblib.dump(self.model, serving_model_path)

        print(f"✅ Model saved to:")
        print(f"   - {trained_model_path}")
        print(f"   - {serving_model_path}")
        return trained_model_path, serving_model_path

    def load_model(self, model_path):
        """Load a trained model from disk."""
        self.model = joblib.load(model_path)
        
        # Extract feature names from the preprocessor if available
        try:
            # Try to access the feature names from the column transformer
            if hasattr(self.model, 'named_steps') and 'preprocessor' in self.model.named_steps:
                transformers = self.model.named_steps['preprocessor'].transformers_
                self.feature_names = []
                for _, _, columns in transformers:
                    self.feature_names.extend(columns)
            else:
                print("Warning: Could not extract feature names from model.")
        except Exception as e:
            print(f"Error extracting feature names: {str(e)}")
            
        return self
    
    def predict(self, json_input):
        """Predict congestion from JSON input."""
        if self.model is None:
            raise ValueError("Model has not been trained yet")
        X = self.process_inputs(json_input)
        return self.model.predict(X).tolist()

    def predict_proba(self, json_input):
        """Predict congestion probabilities from JSON input."""
        if self.model is None:
            raise ValueError("Model has not been trained yet")
        X = self.process_inputs(json_input)
        return self.model.predict_proba(X).tolist()
