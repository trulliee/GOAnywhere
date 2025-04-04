# app/models/incident_impact_model.py

import pandas as pd
import numpy as np
import joblib
import os
from datetime import datetime, timedelta
import logging
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class IncidentImpactModel:
    """
    Model to classify traffic incidents by severity and predict their impact radius
    and duration in Singapore.
    """
    
    def __init__(self, model_path=None):
        """
        Initialize the incident impact model.
        
        Args:
            model_path (str, optional): Path to saved model file. If None, a new model is created.
        """
        self.model = None
        self.preprocessor = None
        self.model_path = model_path
        
        if model_path and os.path.exists(model_path):
            self.load_model()
        else:
            self._initialize_model()
    
    def _initialize_model(self):
        """Initialize a new Random Forest classifier for incident impact prediction."""
        self.model = RandomForestClassifier(
            n_estimators=100,
            max_depth=10,
            min_samples_split=5,
            min_samples_leaf=2,
            random_state=42
        )
        
        # Create preprocessing pipeline
        numeric_features = [
            'hour_of_day', 'day_of_week', 'month', 
            'temperature', 'humidity', 'rainfall', 'visibility'
        ]
        
        categorical_features = [
            'incident_type', 'area_name', 'road_category', 
            'is_peak_hour', 'is_holiday', 'weather_condition'
        ]
        
        numeric_transformer = Pipeline(steps=[
            ('scaler', StandardScaler())
        ])
        
        categorical_transformer = Pipeline(steps=[
            ('onehot', OneHotEncoder(handle_unknown='ignore'))
        ])
        
        self.preprocessor = ColumnTransformer(
            transformers=[
                ('num', numeric_transformer, numeric_features),
                ('cat', categorical_transformer, categorical_features)
            ],
            remainder='drop'
        )
    
    def preprocess_data(self, df):
        """
        Preprocess the raw data for model training or prediction.
        
        Args:
            df (pandas.DataFrame): Input data containing incident and contextual features
            
        Returns:
            tuple: X (features) and y (target) if target is present, otherwise X
        """
        # Feature engineering
        if 'timestamp' in df.columns:
            df['hour_of_day'] = df['timestamp'].dt.hour
            df['day_of_week'] = df['timestamp'].dt.dayofweek
            df['month'] = df['timestamp'].dt.month
            df['is_peak_hour'] = df['hour_of_day'].apply(
                lambda x: 1 if (7 <= x <= 9) or (17 <= x <= 19) else 0
            )
        
        # Check for target column
        if 'severity_level' in df.columns:
            y = df['severity_level']
            X = df.drop(['severity_level'], axis=1)
            return X, y
        else:
            return df
    
    def train(self, incidents_data, weather_data, holiday_data, road_data=None):
        """
        Train the incident impact classification model using historical data.
        
        Args:
            incidents_data (pandas.DataFrame): Historical traffic incidents data
            weather_data (pandas.DataFrame): Historical weather data
            holiday_data (pandas.DataFrame): Holiday information
            road_data (pandas.DataFrame, optional): Road network data
            
        Returns:
            dict: Training metrics (accuracy, classification report)
        """
        logger.info("Starting incident impact model training process")
        
        # Merge datasets for feature enrichment
        enriched_data = self._merge_datasets(
            incidents_data, weather_data, holiday_data, road_data
        )
        
        # Preprocess the data
        X, y = self.preprocess_data(enriched_data)
        
        # Split into train and test sets
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )
        
        # Fit the preprocessor and transform the data
        X_train_processed = self.preprocessor.fit_transform(X_train)
        X_test_processed = self.preprocessor.transform(X_test)
        
        # Train the model
        logger.info("Training Random Forest classifier")
        self.model.fit(X_train_processed, y_train)
        
        # Evaluate the model
        y_pred = self.model.predict(X_test_processed)
        
        # Calculate metrics
        metrics = {
            'accuracy': accuracy_score(y_test, y_pred),
            'classification_report': classification_report(y_test, y_pred, output_dict=True),
            'confusion_matrix': confusion_matrix(y_test, y_pred).tolist()
        }
        
        # Save the trained model
        self.save_model()
        
        logger.info(f"Incident impact model training completed. Accuracy: {metrics['accuracy']:.4f}")
        return metrics
    
    def predict(self, features):
        """
        Predict incident severity level for given features.
        
        Args:
            features (pandas.DataFrame): Input features for prediction
            
        Returns:
            numpy.ndarray: Predicted severity level
        """
        if self.model is None:
            raise ValueError("Model not trained or loaded")
        
        # Preprocess the features
        X = self.preprocess_data(features)
        
        # Transform the features
        X_processed = self.preprocessor.transform(X)
        
        # Make predictions
        predictions = self.model.predict(X_processed)
        
        return predictions
    
    def predict_impact(self, incident_type, location, timestamp, weather_conditions=None):
        """
        Predict impact details for a specific incident.
        
        Args:
            incident_type (str): Type of incident (accident, roadwork, etc.)
            location (dict): Location coordinates and metadata
            timestamp (datetime): Time of the incident
            weather_conditions (dict, optional): Weather conditions
            
        Returns:
            dict: Predicted impact details including severity, radius, and duration
        """
        # Prepare features for the incident
        features = self._prepare_prediction_features(
            incident_type, location, timestamp, weather_conditions
        )
        
        # Make prediction
        severity_level = self.predict(pd.DataFrame([features]))[0]
        
        # Map severity level to impact radius and duration
        impact_radius, impact_duration = self._map_severity_to_impact(
            severity_level, incident_type, location
        )
        
        # Create formatted response
        result = {
            'incident_type': incident_type,
            'location': location,
            'timestamp': timestamp.strftime('%Y-%m-%d %H:%M:%S'),
            'severity_level': severity_level,
            'severity_description': self._get_severity_description(severity_level),
            'impact_radius_meters': impact_radius,
            'estimated_duration_minutes': impact_duration,
            'affected_roads': self._get_affected_roads(location, impact_radius)
        }
        
        return result
    
    def _prepare_prediction_features(self, incident_type, location, timestamp, weather_conditions):
        """Prepare features for incident impact prediction."""
        # Extract location information
        latitude = location.get('latitude', 0)
        longitude = location.get('longitude', 0)
        road_name = location.get('road_name', '')
        area_name = location.get('area_name', self._get_area_from_coords(latitude, longitude))
        road_category = location.get('road_category', self._get_road_category(road_name))
        
        # Basic temporal features
        features = {
            'incident_type': incident_type,
            'latitude': latitude,
            'longitude': longitude,
            'road_name': road_name,
            'area_name': area_name,
            'road_category': road_category,
            'hour_of_day': timestamp.hour,
            'day_of_week': timestamp.weekday(),
            'month': timestamp.month,
            'is_peak_hour': 1 if (7 <= timestamp.hour <= 9) or (17 <= timestamp.hour <= 19) else 0,
            'is_holiday': self._is_holiday(timestamp.date())
        }
        
        # Add weather conditions if provided
        if weather_conditions:
            features.update({
                'temperature': weather_conditions.get('temperature', 28.0),
                'humidity': weather_conditions.get('humidity', 80.0),
                'rainfall': weather_conditions.get('rainfall', 0.0),
                'visibility': weather_conditions.get('visibility', 10.0),
                'weather_condition': weather_conditions.get('weather_main', 'Clear')
            })
        else:
            # Default weather values for Singapore
            features.update({
                'temperature': 28.0,
                'humidity': 80.0,
                'rainfall': 0.0,
                'visibility': 10.0,
                'weather_condition': 'Clear'
            })
        
        return features
    
    def _get_area_from_coords(self, latitude, longitude):
        """Get area name from coordinates."""
        # This is a placeholder - in a real system, you would use a geospatial lookup
        # Using Singapore's planning areas or similar
        
        # Simple placeholder implementation for demo purposes
        if 1.28 <= latitude <= 1.32 and 103.8 <= longitude <= 103.85:
            return "CENTRAL"
        elif 1.32 <= latitude <= 1.35:
            return "NORTH"
        elif 1.35 <= latitude <= 1.4:
            return "NORTH_EAST"
        elif 1.3 <= latitude <= 1.33 and 103.9 <= longitude <= 103.95:
            return "EAST"
        else:
            return "WEST"
    
    def _get_road_category(self, road_name):
        """Get road category from road name."""
        # This is a placeholder - in a real system, you would use a road database
        
        # Simple logic for demo purposes
        if any(term in road_name.upper() for term in ["EXPRESSWAY", "ECP", "PIE", "CTE", "SLE", "TPE", "KJE", "AYE"]):
            return "EXPRESSWAY"
        elif any(term in road_name.upper() for term in ["AVENUE", "AVE", "DRIVE", "DR"]):
            return "MAJOR_ARTERIAL"
        elif any(term in road_name.upper() for term in ["STREET", "ST", "ROAD", "RD"]):
            return "MINOR_ARTERIAL"
        else:
            return "LOCAL"
    
    def _is_holiday(self, date):
        """Check if date is a public holiday."""
        # This is a placeholder - in a real implementation, this would
        # check against a database of Singapore public holidays
        # For demo purposes, we'll assume weekends are holidays
        return 1 if date.weekday() >= 5 else 0
    
    def _map_severity_to_impact(self, severity_level, incident_type, location):
        """Map severity level to impact radius and duration."""
        # Base values by severity
        impact_mapping = {
            'Low': (200, 15),       # 200m radius, 15 minutes
            'Moderate': (500, 30),  # 500m radius, 30 minutes
            'High': (1000, 60),     # 1km radius, 60 minutes
            'Severe': (2000, 120)   # 2km radius, 120 minutes
        }
        
        # Adjust for incident type
        type_multipliers = {
            'Accident': (1.5, 2.0),         # Higher impact for accidents
            'RoadWork': (1.0, 3.0),         # Lower radius but longer duration
            'RoadClosure': (2.0, 4.0),      # High impact all around
            'VehicleBreakdown': (0.7, 1.0), # Medium impact
            'TrafficJam': (1.2, 1.0),       # Wide radius but normal duration
            'Event': (1.5, 2.5)             # Events can cause significant disruption
        }
        
        # Get base values
        base_radius, base_duration = impact_mapping.get(severity_level, (300, 30))
        
        # Apply incident type multipliers
        incident_type_key = ''.join(word for word in incident_type.split() if word.isalnum())
        radius_mult, duration_mult = type_multipliers.get(incident_type_key, (1.0, 1.0))
        
        # Consider road category - expressways have wider impact
        road_category = location.get('road_category', '')
        if road_category == 'EXPRESSWAY':
            radius_mult *= 1.5
            duration_mult *= 1.3
        
        # Calculate final values
        impact_radius = int(base_radius * radius_mult)
        impact_duration = int(base_duration * duration_mult)
        
        return impact_radius, impact_duration
    
    def _get_severity_description(self, severity_level):
        """Get a user-friendly description of the severity level."""
        descriptions = {
            'Low': "Minor impact with minimal traffic disruption.",
            'Moderate': "Moderate impact causing some traffic delay.",
            'High': "Significant impact with considerable traffic disruption.",
            'Severe': "Severe impact causing major traffic blockage or congestion."
        }
        return descriptions.get(severity_level, "Unknown severity level")
    
    def _get_affected_roads(self, location, impact_radius):
        """Get list of roads affected by the incident based on location and impact radius."""
        # This is a placeholder - in a real system, this would query a spatial database
        # of Singapore's road network to find roads within the impact radius
        
        # For demo purposes, return a placeholder
        return [
            "Affected roads would be determined by a geospatial query",
            f"Finding all roads within {impact_radius}m of the incident location"
        ]
    
    def _merge_datasets(self, incidents_data, weather_data, holiday_data, road_data=None):
        """Merge multiple datasets for feature enrichment."""
        # This is a placeholder - actual implementation would depend on data schema
        # but would perform joins based on timestamps, location proximity, etc.
        
        # For example, joining weather data to incidents based on timestamp
        merged_data = pd.merge_asof(
            incidents_data.sort_values('timestamp'),
            weather_data.sort_values('timestamp'),
            on='timestamp',
            direction='nearest'
        )
        
        # Add holiday information
        merged_data = self._add_holiday_info(merged_data, holiday_data)
        
        # Add road information if available
        if road_data is not None:
            # Join road data based on spatial proximity
            # This would require more complex geospatial operations
            pass
        
        return merged_data
    
    def _add_holiday_info(self, df, holiday_data):
        """Add holiday information to the dataset."""
        # Extract dates from the dataframe
        dates = df['timestamp'].dt.date.unique()
        
        # Create a lookup dictionary for holidays
        holiday_dates = set(pd.to_datetime(holiday_data['Date']).dt.date)
        
        # Add is_holiday column
        df['is_holiday'] = df['timestamp'].dt.date.isin(holiday_dates).astype(int)
        
        return df
    
    def save_model(self, path=None):
        """Save the model to disk."""
        if path is None:
            path = self.model_path or 'app/models/incident_impact_model.joblib'
        
        # Create directory if it doesn't exist
        os.makedirs(os.path.dirname(path), exist_ok=True)
        
        # Save model and preprocessor
        model_data = {
            'model': self.model,
            'preprocessor': self.preprocessor
        }
        
        joblib.dump(model_data, path)
        logger.info(f"Incident impact model saved to {path}")
    
    def load_model(self, path=None):
        """Load the model from disk."""
        if path is None:
            path = self.model_path or 'app/models/incident_impact_model.joblib'
        
        if not os.path.exists(path):
            raise FileNotFoundError(f"Model file not found at {path}")
        
        # Load model and preprocessor
        model_data = joblib.load(path)
        
        self.model = model_data['model']
        self.preprocessor = model_data['preprocessor']
        
        logger.info(f"Incident impact model loaded from {path}")