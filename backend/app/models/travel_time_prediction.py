import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import RandomizedSearchCV, TimeSeriesSplit
from sklearn.preprocessing import FunctionTransformer
from sklearn.pipeline import Pipeline as SklearnPipeline
from scipy.stats import randint, uniform
from sklearn.model_selection import RandomizedSearchCV, TimeSeriesSplit
from sklearn.preprocessing import FunctionTransformer
from sklearn.pipeline import Pipeline as SklearnPipeline
from scipy.stats import randint, uniform
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
        
        # Define peak hours for peak_hour_flag
        self.morning_peak_hours = list(range(7, 10))  # 7-9 AM
        self.evening_peak_hours = list(range(17, 21))  # 5-8 PM

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

        if self.feature_names is None:
            raise ValueError("Model feature names not set. Run prepare_data() or load_model() first.")

        # Default values used during training
        default_values = {
            'Expressway': '',
            'Direction': '',
            'Startpoint': '',
            'Endpoint': '',
            'hour': 12,
            'day_of_week': 2,
            'month': 6,
            'is_holiday': 0,
            'event_count': 0,
            'incident_count': 0,
            'temperature': 27.0,
            'humidity': 75.0,
            'peak_hour_flag': 0,
            'day_type': 'weekday',
            'road_type': 'minor',
            'recent_incident_flag': 0,
            'speed_band_previous_hour': 2,
            'rain_flag': 0,
            'max_event_severity': 0,
            'sum_event_severity': 0,
            'mean_incident_severity': 0,
            'max_incident_severity': 0,
            'sum_incident_severity': 0,
            'distance_km': 5.0
        }

        for col in self.feature_names:
            if col not in df.columns:
                df[col] = default_values.get(col, np.nan)
            else:
                df[col] = df[col].fillna(default_values.get(col, df[col].mean() if df[col].dtype in [np.float64, np.int64] else ''))

        df = df[self.feature_names]

        return df

    def prepare_data(self, travel_times_df, incidents_df, speed_bands_df, weather_df, events_df, holidays_df):
        """
        Prepare and merge all data sources for model training
        """
        from geopy.distance import geodesic

        from geopy.distance import geodesic

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

        # Peak hour flag
        travel_times_df['peak_hour_flag'] = travel_times_df['hour'].apply(
            lambda x: 1 if (x in self.morning_peak_hours or x in self.evening_peak_hours) else 0
        )

        # Day type (weekday or weekend)
        travel_times_df['day_type'] = travel_times_df['day_of_week'].apply(
            lambda x: 'weekend' if x >= 5 else 'weekday'
        )

        # Peak hour flag
        travel_times_df['peak_hour_flag'] = travel_times_df['hour'].apply(
            lambda x: 1 if (x in self.morning_peak_hours or x in self.evening_peak_hours) else 0
        )

        # Day type (weekday or weekend)
        travel_times_df['day_type'] = travel_times_df['day_of_week'].apply(
            lambda x: 'weekend' if x >= 5 else 'weekday'
        )

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

            if 'participants' in events_df.columns:
                events_df['event_severity'] = events_df['participants'].apply(
                    lambda x: 2 if x > 1000 else (1 if x > 100 else 0)
                ).fillna(0)
            else:
                events_df['event_severity'] = 1

            event_features = events_df.groupby('event_date').agg({
                'event_severity': ['max', 'sum']
            }).reset_index()
            event_features.columns = ['event_date', 'max_event_severity', 'sum_event_severity']

            if 'participants' in events_df.columns:
                events_df['event_severity'] = events_df['participants'].apply(
                    lambda x: 2 if x > 1000 else (1 if x > 100 else 0)
                ).fillna(0)
            else:
                events_df['event_severity'] = 1

            event_features = events_df.groupby('event_date').agg({
                'event_severity': ['max', 'sum']
            }).reset_index()
            event_features.columns = ['event_date', 'max_event_severity', 'sum_event_severity']

            event_counts = events_df.groupby('event_date').size().reset_index(name='event_count')

            event_features = pd.merge(event_counts, event_features, on='event_date', how='left')

            travel_times_df = pd.merge(travel_times_df, event_features, left_on='date', right_on='event_date', how='left')


            event_features = pd.merge(event_counts, event_features, on='event_date', how='left')

            travel_times_df = pd.merge(travel_times_df, event_features, left_on='date', right_on='event_date', how='left')

            travel_times_df['event_count'] = travel_times_df['event_count'].fillna(0)
            travel_times_df['max_event_severity'] = travel_times_df['max_event_severity'].fillna(0)
            travel_times_df['sum_event_severity'] = travel_times_df['sum_event_severity'].fillna(0)
            travel_times_df['max_event_severity'] = travel_times_df['max_event_severity'].fillna(0)
            travel_times_df['sum_event_severity'] = travel_times_df['sum_event_severity'].fillna(0)
        else:
            travel_times_df['event_count'] = 0
            travel_times_df['max_event_severity'] = 0
            travel_times_df['sum_event_severity'] = 0
            travel_times_df['max_event_severity'] = 0
            travel_times_df['sum_event_severity'] = 0

        # Handle incidents
        if not incidents_df.empty:
            incidents_df['date'] = incidents_df['Timestamp'].dt.date
            incidents_df['hour'] = incidents_df['Timestamp'].dt.hour

            # Incident severity
            if 'Type' in incidents_df.columns:
                severity_mapping = {
                    'accident': 3, 'crash': 3, 'collision': 3, 'major': 3,
                    'breakdown': 2, 'stalled': 2, 'vehicle breakdown': 2,
                    'obstacle': 1, 'roadwork': 1, 'construction': 1, 'hazard': 1, 'debris': 1
                }
                incidents_df['incident_severity'] = 1
                for keyword, severity in severity_mapping.items():
                    mask = incidents_df['Type'].str.lower().str.contains(keyword, na=False)
                    incidents_df.loc[mask, 'incident_severity'] = severity
            else:
                incidents_df['incident_severity'] = 1

            # Standard incident counts
            incidents_df['hour'] = incidents_df['Timestamp'].dt.hour

            # Incident severity
            if 'Type' in incidents_df.columns:
                severity_mapping = {
                    'accident': 3, 'crash': 3, 'collision': 3, 'major': 3,
                    'breakdown': 2, 'stalled': 2, 'vehicle breakdown': 2,
                    'obstacle': 1, 'roadwork': 1, 'construction': 1, 'hazard': 1, 'debris': 1
                }
                incidents_df['incident_severity'] = 1
                for keyword, severity in severity_mapping.items():
                    mask = incidents_df['Type'].str.lower().str.contains(keyword, na=False)
                    incidents_df.loc[mask, 'incident_severity'] = severity
            else:
                incidents_df['incident_severity'] = 1

            # Standard incident counts
            incident_counts = incidents_df.groupby('date').size().reset_index(name='incident_count')

            incident_severity = incidents_df.groupby('date').agg({
                'incident_severity': ['mean', 'max', 'sum']
            }).reset_index()
            incident_severity.columns = ['date', 'mean_incident_severity', 'max_incident_severity', 'sum_incident_severity']


            incident_severity = incidents_df.groupby('date').agg({
                'incident_severity': ['mean', 'max', 'sum']
            }).reset_index()
            incident_severity.columns = ['date', 'mean_incident_severity', 'max_incident_severity', 'sum_incident_severity']

            travel_times_df = pd.merge(travel_times_df, incident_counts, on='date', how='left')
            travel_times_df = pd.merge(travel_times_df, incident_severity, on='date', how='left')

            travel_times_df = pd.merge(travel_times_df, incident_severity, on='date', how='left')

            travel_times_df['incident_count'] = travel_times_df['incident_count'].fillna(0)
            travel_times_df['mean_incident_severity'] = travel_times_df['mean_incident_severity'].fillna(0)
            travel_times_df['max_incident_severity'] = travel_times_df['max_incident_severity'].fillna(0)
            travel_times_df['sum_incident_severity'] = travel_times_df['sum_incident_severity'].fillna(0)

            # RECENT INCIDENT FLAG (optimized)
            hourly_incidents = incidents_df.groupby(['date', 'hour']).size().reset_index(name='incident_count')
            shifts = [0, 1, 2, 3]
            shifted_incidents = []

            for shift in shifts:
                shifted = hourly_incidents.copy()
                shifted['hour'] = (shifted['hour'] + shift) % 24
                shifted_incidents.append(shifted)

            all_recent_incidents = pd.concat(shifted_incidents)
            recent_incidents = all_recent_incidents.groupby(['date', 'hour'])['incident_count'].sum().reset_index()

            travel_times_df = travel_times_df.merge(recent_incidents, on=['date', 'hour'], how='left')
            travel_times_df['recent_incidents'] = travel_times_df['incident_count_y'].fillna(0)
            travel_times_df['recent_incident_flag'] = (travel_times_df['recent_incidents'] > 0).astype(int)

            travel_times_df = travel_times_df.rename(columns={
                'incident_count_x': 'incident_count'
            })

            travel_times_df['mean_incident_severity'] = travel_times_df['mean_incident_severity'].fillna(0)
            travel_times_df['max_incident_severity'] = travel_times_df['max_incident_severity'].fillna(0)
            travel_times_df['sum_incident_severity'] = travel_times_df['sum_incident_severity'].fillna(0)

            # RECENT INCIDENT FLAG (optimized)
            hourly_incidents = incidents_df.groupby(['date', 'hour']).size().reset_index(name='incident_count')
            shifts = [0, 1, 2, 3]
            shifted_incidents = []

            for shift in shifts:
                shifted = hourly_incidents.copy()
                shifted['hour'] = (shifted['hour'] + shift) % 24
                shifted_incidents.append(shifted)

            all_recent_incidents = pd.concat(shifted_incidents)
            recent_incidents = all_recent_incidents.groupby(['date', 'hour'])['incident_count'].sum().reset_index()

            travel_times_df = travel_times_df.merge(recent_incidents, on=['date', 'hour'], how='left')
            travel_times_df['recent_incidents'] = travel_times_df['incident_count_y'].fillna(0)
            travel_times_df['recent_incident_flag'] = (travel_times_df['recent_incidents'] > 0).astype(int)

            travel_times_df = travel_times_df.rename(columns={
                'incident_count_x': 'incident_count'
            })

        else:
            travel_times_df['incident_count'] = 0
            travel_times_df['mean_incident_severity'] = 0
            travel_times_df['max_incident_severity'] = 0
            travel_times_df['sum_incident_severity'] = 0
            travel_times_df['recent_incidents'] = 0
            travel_times_df['recent_incident_flag'] = 0

        # Handle speed band previous hour
        if not speed_bands_df.empty:
            speed_bands_df['hour'] = speed_bands_df['Timestamp'].dt.hour
            speed_bands_df['date'] = speed_bands_df['Timestamp'].dt.date

            if all(col in speed_bands_df.columns for col in ['Expressway', 'Direction', 'hour', 'date', 'Speed_Band']):
                prev_hour_speeds = speed_bands_df.copy()
                prev_hour_speeds['hour'] = (prev_hour_speeds['hour'] + 1) % 24  # Shift to previous hour matching
                prev_hour_speeds = prev_hour_speeds.groupby(['date', 'hour', 'Expressway', 'Direction'])['Speed_Band'].mean().reset_index()

                travel_times_df = travel_times_df.merge(prev_hour_speeds, on=['date', 'hour', 'Expressway', 'Direction'], how='left')
                mean_speed_band = speed_bands_df['Speed_Band'].mean()
                travel_times_df['Speed_Band'] = travel_times_df['Speed_Band'].fillna(mean_speed_band)
                travel_times_df.rename(columns={'Speed_Band': 'speed_band_previous_hour'}, inplace=True)
            else:
                travel_times_df['speed_band_previous_hour'] = 2
        else:
            travel_times_df['speed_band_previous_hour'] = 2

        # Road type
        expressway_type_mapping = {
            'PIE': 'major', 'CTE': 'major', 'ECP': 'major', 'AYE': 'major',
            'KPE': 'major', 'TPE': 'major', 'SLE': 'major'
        }
        travel_times_df['road_type'] = travel_times_df['Expressway'].map(lambda x: expressway_type_mapping.get(x, 'minor'))

        # Weather features
            travel_times_df['mean_incident_severity'] = 0
            travel_times_df['max_incident_severity'] = 0
            travel_times_df['sum_incident_severity'] = 0
            travel_times_df['recent_incidents'] = 0
            travel_times_df['recent_incident_flag'] = 0

        # Handle speed band previous hour
        if not speed_bands_df.empty:
            speed_bands_df['hour'] = speed_bands_df['Timestamp'].dt.hour
            speed_bands_df['date'] = speed_bands_df['Timestamp'].dt.date

            if all(col in speed_bands_df.columns for col in ['Expressway', 'Direction', 'hour', 'date', 'Speed_Band']):
                prev_hour_speeds = speed_bands_df.copy()
                prev_hour_speeds['hour'] = (prev_hour_speeds['hour'] + 1) % 24  # Shift to previous hour matching
                prev_hour_speeds = prev_hour_speeds.groupby(['date', 'hour', 'Expressway', 'Direction'])['Speed_Band'].mean().reset_index()

                travel_times_df = travel_times_df.merge(prev_hour_speeds, on=['date', 'hour', 'Expressway', 'Direction'], how='left')
                mean_speed_band = speed_bands_df['Speed_Band'].mean()
                travel_times_df['Speed_Band'] = travel_times_df['Speed_Band'].fillna(mean_speed_band)
                travel_times_df.rename(columns={'Speed_Band': 'speed_band_previous_hour'}, inplace=True)
            else:
                travel_times_df['speed_band_previous_hour'] = 2
        else:
            travel_times_df['speed_band_previous_hour'] = 2

        # Road type
        expressway_type_mapping = {
            'PIE': 'major', 'CTE': 'major', 'ECP': 'major', 'AYE': 'major',
            'KPE': 'major', 'TPE': 'major', 'SLE': 'major'
        }
        travel_times_df['road_type'] = travel_times_df['Expressway'].map(lambda x: expressway_type_mapping.get(x, 'minor'))

        # Weather features
        if not weather_df.empty:
            weather_df['date'] = weather_df['stored_at'].dt.date
            weather_df['hour'] = weather_df['stored_at'].dt.hour


            weather_features = weather_df.groupby(['date', 'hour']).agg({
                'temperature': 'mean',
                'humidity': 'mean'
            }).reset_index()

            travel_times_df = pd.merge(travel_times_df, weather_features, on=['date', 'hour'], how='left')

            # Rainfall optimized
            if 'rainfall' in weather_df.columns or 'precipitation' in weather_df.columns:
                rain_col = 'rainfall' if 'rainfall' in weather_df.columns else 'precipitation'
                rainfall_df = weather_df[['date', 'hour', rain_col]].copy()

                shifts = [0, 1, 2, 3]
                shifted_rain = []
                for shift in shifts:
                    shifted = rainfall_df.copy()
                    shifted['hour'] = (shifted['hour'] + shift) % 24
                    shifted_rain.append(shifted)

                all_recent_rain = pd.concat(shifted_rain)
                recent_rain = all_recent_rain.groupby(['date', 'hour'])[rain_col].max().reset_index()

                travel_times_df = travel_times_df.merge(recent_rain, on=['date', 'hour'], how='left')
                travel_times_df['rain_flag'] = (travel_times_df[rain_col] > 0.1).astype(int)
            else:
                travel_times_df['rain_flag'] = (travel_times_df['humidity'] > 85).astype(int)
        else:
            travel_times_df['temperature'] = 27.0
            travel_times_df['humidity'] = 75.0
            travel_times_df['rain_flag'] = 0

        # Calculate distance between Startpoint and Endpoint if lat/lng available
        def compute_distance(row):
            try:
                if 'StartpointLat' in row and 'StartpointLng' in row and 'EndpointLat' in row and 'EndpointLng' in row:
                    start = (row['StartpointLat'], row['StartpointLng'])
                    end = (row['EndpointLat'], row['EndpointLng'])
                    return geodesic(start, end).km
                else:
                    return row.get('distance_km', 5.0)
            except:
                return 5.0

        if all(col in travel_times_df.columns for col in ['StartpointLat', 'StartpointLng', 'EndpointLat', 'EndpointLng']):
            travel_times_df['distance_km'] = travel_times_df.apply(compute_distance, axis=1)
            travel_times_df['distance_km'] = travel_times_df['distance_km'].fillna(travel_times_df['distance_km'].mean())
        else:
            travel_times_df['distance_km'] = 5.0  # default fallback

        # Fill missing
        travel_times_df = travel_times_df.fillna({
            'temperature': 27.0, 'humidity': 75.0, 'event_count': 0,
            'incident_count': 0, 'peak_hour_flag': 0, 'recent_incident_flag': 0,
            'speed_band_previous_hour': 2, 'rain_flag': 0, 'max_event_severity': 0,
            'sum_event_severity': 0, 'mean_incident_severity': 0, 'max_incident_severity': 0,
            'sum_incident_severity': 0, 'distance_km': 5.0
        })

        # Select features
            travel_times_df = pd.merge(travel_times_df, weather_features, on=['date', 'hour'], how='left')

            # Rainfall optimized
            if 'rainfall' in weather_df.columns or 'precipitation' in weather_df.columns:
                rain_col = 'rainfall' if 'rainfall' in weather_df.columns else 'precipitation'
                rainfall_df = weather_df[['date', 'hour', rain_col]].copy()

                shifts = [0, 1, 2, 3]
                shifted_rain = []
                for shift in shifts:
                    shifted = rainfall_df.copy()
                    shifted['hour'] = (shifted['hour'] + shift) % 24
                    shifted_rain.append(shifted)

                all_recent_rain = pd.concat(shifted_rain)
                recent_rain = all_recent_rain.groupby(['date', 'hour'])[rain_col].max().reset_index()

                travel_times_df = travel_times_df.merge(recent_rain, on=['date', 'hour'], how='left')
                travel_times_df['rain_flag'] = (travel_times_df[rain_col] > 0.1).astype(int)
            else:
                travel_times_df['rain_flag'] = (travel_times_df['humidity'] > 85).astype(int)
        else:
            travel_times_df['temperature'] = 27.0
            travel_times_df['humidity'] = 75.0
            travel_times_df['rain_flag'] = 0

        # Calculate distance between Startpoint and Endpoint if lat/lng available
        def compute_distance(row):
            try:
                if 'StartpointLat' in row and 'StartpointLng' in row and 'EndpointLat' in row and 'EndpointLng' in row:
                    start = (row['StartpointLat'], row['StartpointLng'])
                    end = (row['EndpointLat'], row['EndpointLng'])
                    return geodesic(start, end).km
                else:
                    return row.get('distance_km', 5.0)
            except:
                return 5.0

        if all(col in travel_times_df.columns for col in ['StartpointLat', 'StartpointLng', 'EndpointLat', 'EndpointLng']):
            travel_times_df['distance_km'] = travel_times_df.apply(compute_distance, axis=1)
            travel_times_df['distance_km'] = travel_times_df['distance_km'].fillna(travel_times_df['distance_km'].mean())
        else:
            travel_times_df['distance_km'] = 5.0  # default fallback

        # Fill missing
        travel_times_df = travel_times_df.fillna({
            'temperature': 27.0, 'humidity': 75.0, 'event_count': 0,
            'incident_count': 0, 'peak_hour_flag': 0, 'recent_incident_flag': 0,
            'speed_band_previous_hour': 2, 'rain_flag': 0, 'max_event_severity': 0,
            'sum_event_severity': 0, 'mean_incident_severity': 0, 'max_incident_severity': 0,
            'sum_incident_severity': 0, 'distance_km': 5.0
        })

        # Select features
        X = travel_times_df[[
            'Expressway', 'Direction', 'Startpoint', 'Endpoint',
            'hour', 'day_of_week', 'month', 'is_holiday',
            'event_count', 'incident_count', 'temperature', 'humidity',
            'peak_hour_flag', 'day_type', 'road_type', 'recent_incident_flag',
            'speed_band_previous_hour', 'rain_flag',
            'max_event_severity', 'sum_event_severity',
            'mean_incident_severity', 'max_incident_severity', 'sum_incident_severity',
            'distance_km'
            'event_count', 'incident_count', 'temperature', 'humidity',
            'peak_hour_flag', 'day_type', 'road_type', 'recent_incident_flag',
            'speed_band_previous_hour', 'rain_flag',
            'max_event_severity', 'sum_event_severity',
            'mean_incident_severity', 'max_incident_severity', 'sum_incident_severity',
            'distance_km'
        ]]
        y = travel_times_df['Esttime']

        self.feature_names = X.columns.tolist()

        self.feature_names = X.columns.tolist()

        return X, y

    def build_model(self):
        """
        Define the model pipeline with preprocessing
        """
        # Define categorical and numerical features
        categorical_features = ['Expressway', 'Direction', 'Startpoint', 'Endpoint', 'day_type', 'road_type']
        numerical_features = [
            'hour', 'day_of_week', 'month', 'is_holiday', 
            'event_count', 'incident_count', 'temperature', 'humidity',
            'peak_hour_flag', 'recent_incident_flag', 'speed_band_previous_hour', 'rain_flag',
            'max_event_severity', 'sum_event_severity',
            'mean_incident_severity', 'max_incident_severity', 'sum_incident_severity', 'distance_km'
        ]
        categorical_features = ['Expressway', 'Direction', 'Startpoint', 'Endpoint', 'day_type', 'road_type']
        numerical_features = [
            'hour', 'day_of_week', 'month', 'is_holiday', 
            'event_count', 'incident_count', 'temperature', 'humidity',
            'peak_hour_flag', 'recent_incident_flag', 'speed_band_previous_hour', 'rain_flag',
            'max_event_severity', 'sum_event_severity',
            'mean_incident_severity', 'max_incident_severity', 'sum_incident_severity', 'distance_km'
        ]
        
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
    
    def train(self, X, y, n_splits=5, n_iter=30):
    def train(self, X, y, n_splits=5, n_iter=30):
        """
        Train the model using TimeSeriesSplit cross-validation and Hyperparameter Tuning
        Train the model using TimeSeriesSplit cross-validation and Hyperparameter Tuning
        """
        if self.model is None:
            self.build_model()
        
        print("\n🔵 Starting Cross-Validation and Hyperparameter Tuning...")

        # Define TimeSeriesSplit cross-validation
        tscv = TimeSeriesSplit(n_splits=n_splits)

        # Define hyperparameter search space
        param_distributions = {
            'regressor__n_estimators': randint(100, 500),
            'regressor__max_depth': randint(5, 30),
            'regressor__min_samples_split': randint(2, 10),
            'regressor__min_samples_leaf': randint(1, 10),
            'regressor__max_features': ['sqrt', 'log2'],
            'regressor__bootstrap': [True, False]
        }

        # Setup RandomizedSearchCV
        random_search = RandomizedSearchCV(
            self.model,
            param_distributions=param_distributions,
            n_iter=n_iter,
            cv=tscv,
            verbose=2,
            random_state=42,
            n_jobs=-1,
            scoring='neg_root_mean_squared_error'  # Negative RMSE
        )

        # Perform hyperparameter search
        random_search.fit(X, y)

        print("\n✅ Best Hyperparameters Found:")
        print(random_search.best_params_)

        # Set the best model
        self.model = random_search.best_estimator_

        # Retrain best model on FULL data
        print("\n🔵 Retraining on FULL data with best parameters...")
        self.model.fit(X, y)

        # Final evaluation on FULL data
        y_pred = self.model.predict(X)
        rmse = np.sqrt(mean_squared_error(y, y_pred))
        mae = mean_absolute_error(y, y_pred)
        r2 = r2_score(y, y_pred)

        print("\n✅ Final Model Metrics (on Full Data):")
        print("\n🔵 Starting Cross-Validation and Hyperparameter Tuning...")

        # Define TimeSeriesSplit cross-validation
        tscv = TimeSeriesSplit(n_splits=n_splits)

        # Define hyperparameter search space
        param_distributions = {
            'regressor__n_estimators': randint(100, 500),
            'regressor__max_depth': randint(5, 30),
            'regressor__min_samples_split': randint(2, 10),
            'regressor__min_samples_leaf': randint(1, 10),
            'regressor__max_features': ['sqrt', 'log2'],
            'regressor__bootstrap': [True, False]
        }

        # Setup RandomizedSearchCV
        random_search = RandomizedSearchCV(
            self.model,
            param_distributions=param_distributions,
            n_iter=n_iter,
            cv=tscv,
            verbose=2,
            random_state=42,
            n_jobs=-1,
            scoring='neg_root_mean_squared_error'  # Negative RMSE
        )

        # Perform hyperparameter search
        random_search.fit(X, y)

        print("\n✅ Best Hyperparameters Found:")
        print(random_search.best_params_)

        # Set the best model
        self.model = random_search.best_estimator_

        # Retrain best model on FULL data
        print("\n🔵 Retraining on FULL data with best parameters...")
        self.model.fit(X, y)

        # Final evaluation on FULL data
        y_pred = self.model.predict(X)
        rmse = np.sqrt(mean_squared_error(y, y_pred))
        mae = mean_absolute_error(y, y_pred)
        r2 = r2_score(y, y_pred)

        print("\n✅ Final Model Metrics (on Full Data):")
        print(f"RMSE: {rmse:.2f}")
        print(f"MAE: {mae:.2f}")
        print(f"R²: {r2:.2f}")

        # Get final feature importances
        feature_importances = None
        if hasattr(self.model['regressor'], 'feature_importances_'):
            feature_names = self.model['preprocessor'].get_feature_names_out()
            feature_importances = self.model['regressor'].feature_importances_

            feature_importance_df = pd.DataFrame({
                'Feature': feature_names,
                'Importance': feature_importances
            }).sort_values('Importance', ascending=False)

            print("\nTop 15 Most Important Features:")
            print(feature_importance_df.head(15))
        else:
            feature_importance_df = None


        # Get final feature importances
        feature_importances = None
        if hasattr(self.model['regressor'], 'feature_importances_'):
            feature_names = self.model['preprocessor'].get_feature_names_out()
            feature_importances = self.model['regressor'].feature_importances_

            feature_importance_df = pd.DataFrame({
                'Feature': feature_names,
                'Importance': feature_importances
            }).sort_values('Importance', ascending=False)

            print("\nTop 15 Most Important Features:")
            print(feature_importance_df.head(15))
        else:
            feature_importance_df = None

        return {
            'rmse': rmse,
            'mae': mae,
            'r2': r2,
            'best_params': random_search.best_params_,
            'feature_importances': feature_importance_df
        }
    
    def save_model(self, 
               trained_local_path="models/trained/travel_time", 
               serving_local_path="model_serving/travel_time"):
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
        """Load a trained model from disk and restore feature names."""
        self.model = joblib.load(model_path)
        
        # Try to extract original feature names used in training
        try:
            if hasattr(self.model, 'named_steps') and 'preprocessor' in self.model.named_steps:
                transformers = self.model.named_steps['preprocessor'].transformers_
                self.feature_names = []
                for _, _, columns in transformers:
                    self.feature_names.extend(columns)
            else:
                print("⚠️ Warning: Could not extract feature names from model.")
        except Exception as e:
            print(f"⚠️ Error extracting feature names: {str(e)}")

        return self

    def predict(self, json_input):
        """Predict travel time from JSON input."""
        if self.model is None:
            raise ValueError("Model has not been trained yet")
        X = self.process_inputs(json_input)
        return self.model.predict(X).tolist()

    def predict_proba(self, json_input):
        """
        Dummy probability-style method for regression.
        Returns a mock probability distribution centered around the prediction.
        Only for interface compatibility with traffic model.
        """
        if self.model is None:
            raise ValueError("Model has not been trained yet")

        X = self.process_inputs(json_input)
        preds = self.model.predict(X)

        # Mock "confidence intervals" (±10% range normalized to 0–1 scale)
        probs = []
        for pred in preds:
            # Normalized pseudo-probability: [low_conf, mid_conf, high_conf]
            low = max(0, pred * 0.9)
            high = pred * 1.1
            probs.append([low, pred, high])

        return probs
