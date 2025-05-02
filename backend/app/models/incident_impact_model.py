# app/models/incident_impact_model.py

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import logging
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split
import joblib
import os
from app.data.firestore_dataloader import FirestoreDataLoader

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class IncidentImpactModel:
    """
    Model for predicting the impact of traffic incidents on travel times
    and traffic conditions in surrounding areas.
    """
    
    def __init__(self, model_path=None):
        """
        Initialize the incident impact model.
        
        Args:
            model_path (str, optional): Path to saved model files
        """
        self.model_path = model_path
        self.impact_model = None
        self.data_loader = FirestoreDataLoader()
        
        # Load model if path is provided
        if model_path and os.path.exists(model_path):
            self.load_model()
    
    def load_data(self, days=30):
        """
        Load training data from Firestore using the data loader.
        
        Args:
            days (int): Number of days of data to retrieve
            
        Returns:
            pandas.DataFrame: Combined dataset for training
        """
        logger.info(f"Loading data for incident impact model training (days={days})")
        
        # Load incidents data
        incidents_df = self.data_loader.get_incidents(days=days)
        
        if incidents_df.empty:
            logger.warning("No incident data available for training")
            return pd.DataFrame()
        
        # Load traffic speed bands data
        speed_bands_df = self.data_loader.get_traffic_speed_bands(days=days)
        
        # Load travel time data if available
        travel_times_df = self.data_loader.get_travel_times(days=days)
        
        # Create incident impact dataset
        if incidents_df.empty or speed_bands_df.empty:
            logger.error("Required data sources are empty")
            return pd.DataFrame()
        
        # Process the data to create features and target variables
        # This will involve finding speed bands and travel times before and after incidents
        
        # Prepare incidents data
        if 'Timestamp' not in incidents_df.columns:
            if 'time_reported' in incidents_df.columns:
                incidents_df['Timestamp'] = incidents_df['time_reported']
            else:
                logger.error("No timestamp information available in incidents data")
                return pd.DataFrame()
        
        # Extract road information from incidents
        if 'Message' in incidents_df.columns:
            incidents_df['AffectedRoad'] = incidents_df['Message'].apply(
                lambda x: self._extract_road_name(x) if isinstance(x, str) else ''
            )
        
        # Merge incidents with speed bands data
        combined_data = []
        
        for _, incident in incidents_df.iterrows():
            incident_time = incident.get('Timestamp')
            affected_road = incident.get('AffectedRoad', '')
            incident_type = incident.get('Type', 'Unknown')
            
            if not incident_time or not affected_road:
                continue
            
            # Find speed bands before and after the incident
            if 'Timestamp' in speed_bands_df.columns and 'RoadName' in speed_bands_df.columns:
                # Before incident (1 hour window)
                before_start = incident_time - timedelta(hours=1)
                before_end = incident_time
                
                before_data = speed_bands_df[
                    (speed_bands_df['Timestamp'] >= before_start) &
                    (speed_bands_df['Timestamp'] < before_end) &
                    (speed_bands_df['RoadName'].str.contains(affected_road, na=False))
                ]
                
                # After incident (2 hour window)
                after_start = incident_time
                after_end = incident_time + timedelta(hours=2)
                
                after_data = speed_bands_df[
                    (speed_bands_df['Timestamp'] >= after_start) &
                    (speed_bands_df['Timestamp'] < after_end) &
                    (speed_bands_df['RoadName'].str.contains(affected_road, na=False))
                ]
                
                if before_data.empty or after_data.empty:
                    continue
                
                # Calculate average speed bands
                avg_before_speed = before_data['SpeedBand'].mean()
                avg_after_speed = after_data['SpeedBand'].mean()
                
                # Calculate speed impact
                speed_impact = avg_before_speed - avg_after_speed
                
                # Find travel times if available
                time_impact = None
                
                if not travel_times_df.empty and 'Timestamp' in travel_times_df.columns:
                    # Find relevant expressway
                    expressways = ['PIE', 'AYE', 'CTE', 'ECP', 'TPE', 'SLE', 'BKE', 'KJE', 'KPE']
                    affected_expressway = None
                    
                    for exp in expressways:
                        if exp in affected_road:
                            affected_expressway = exp
                            break
                    
                    if affected_expressway:
                        # Find travel times before and after
                        before_times = travel_times_df[
                            (travel_times_df['Timestamp'] >= before_start) &
                            (travel_times_df['Timestamp'] < before_end) &
                            (travel_times_df['Expressway'] == affected_expressway)
                        ]
                        
                        after_times = travel_times_df[
                            (travel_times_df['Timestamp'] >= after_start) &
                            (travel_times_df['Timestamp'] < after_end) &
                            (travel_times_df['Expressway'] == affected_expressway)
                        ]
                        
                        if not before_times.empty and not after_times.empty:
                            avg_before_time = before_times['Esttime'].mean()
                            avg_after_time = after_times['Esttime'].mean()
                            time_impact = avg_after_time - avg_before_time
                
                # Add features about the incident
                # Time of day
                hour = incident_time.hour
                is_peak = 1 if (7 <= hour <= 9) or (17 <= hour <= 19) else 0
                
                # Day of week
                day_of_week = incident_time.weekday()
                is_weekend = 1 if day_of_week >= 5 else 0
                
                # Add weather info if possible
                weather_data = self.data_loader.get_weather_data(days=days)
                rain_condition = 0
                
                if not weather_data.empty:
                    # Find weather on the incident day
                    incident_date = incident_time.date()
                    day_weather = weather_data[pd.to_datetime(weather_data['timestamp']).dt.date == incident_date]
                    
                    if not day_weather.empty:
                        # Check if rain was forecasted
                        if 'general_forecast' in day_weather.columns:
                            forecast = day_weather.iloc[0]['general_forecast']
                            if isinstance(forecast, str) and ('rain' in forecast.lower() or 'shower' in forecast.lower()):
                                rain_condition = 1
                
                # Create impact record
                impact_record = {
                    'incident_timestamp': incident_time,
                    'affected_road': affected_road,
                    'incident_type': incident_type,
                    'hour': hour,
                    'is_peak': is_peak,
                    'day_of_week': day_of_week,
                    'is_weekend': is_weekend,
                    'rain_condition': rain_condition,
                    'before_speed': avg_before_speed,
                    'after_speed': avg_after_speed,
                    'speed_impact': speed_impact,
                    'time_impact': time_impact
                }
                
                combined_data.append(impact_record)
        
        # Create dataframe
        if not combined_data:
            logger.warning("No impact data could be generated")
            return pd.DataFrame()
        
        impact_df = pd.DataFrame(combined_data)
        logger.info(f"Created impact dataset with {len(impact_df)} records")
        
        return impact_df
    
    def _extract_road_name(self, message):
        """Extract road name from incident message."""
        if not isinstance(message, str):
            return ""
            
        # Common road indicators
        road_indicators = [" on ", " at ", " along ", "PIE", "AYE", "CTE", "ECP", "TPE", "SLE", "BKE", "KJE", "KPE"]
        
        for indicator in road_indicators:
            if indicator in message:
                # If it's an expressway, return it
                if indicator in ["PIE", "AYE", "CTE", "ECP", "TPE", "SLE", "BKE", "KJE", "KPE"]:
                    return indicator
                
                # Extract the part after the indicator
                parts = message.split(indicator, 1)
                if len(parts) > 1:
                    # Get the first word which is likely the road name
                    road_name = parts[1].strip().split(" ")[0]
                    return road_name
        
        return ""
    
    def train_model(self, training_data=None, test_size=0.2, n_estimators=100):
        """
        Train the incident impact prediction model.
        
        Args:
            training_data (pandas.DataFrame, optional): Pre-loaded training data
            test_size (float): Proportion of data to use for testing
            n_estimators (int): Number of estimators for the random forest
            
        Returns:
            dict: Training performance metrics
        """
        logger.info("Training incident impact prediction model")
        
        # Load data if not provided
        if training_data is None or training_data.empty:
            training_data = self.load_data(days=60)  # Use more data for better training
            
            if training_data.empty:
                logger.error("No training data available for impact model")
                return {"error": "No training data available"}
        
        # Choose the target variable based on availability
        target_var = 'speed_impact'
        if 'time_impact' in training_data.columns and not training_data['time_impact'].isna().all():
            target_var = 'time_impact'
            logger.info("Using travel time impact as target variable")
        else:
            logger.info("Using speed band impact as target variable")
        
        # Prepare features
        categorical_features = ['incident_type', 'affected_road']
        numerical_features = ['hour', 'is_peak', 'day_of_week', 'is_weekend', 'rain_condition', 'before_speed']
        
        # Ensure all feature columns exist
        for col in numerical_features + categorical_features:
            if col not in training_data.columns:
                logger.error(f"Required column {col} missing from training data")
                return {"error": f"Required column {col} missing from training data"}
        
        # Drop rows with missing target
        training_data = training_data.dropna(subset=[target_var])
        
        if len(training_data) < 50:
            logger.warning(f"Limited training data available: only {len(training_data)} samples")
        
        # Split data
        feature_cols = numerical_features + categorical_features
        X = training_data[feature_cols]
        y = training_data[target_var]
        
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=test_size, random_state=42)
        
        # Define preprocessing steps
        categorical_transformer = OneHotEncoder(handle_unknown='ignore')
        numerical_transformer = StandardScaler()
        
        preprocessor = ColumnTransformer(
            transformers=[
                ('num', numerical_transformer, numerical_features),
                ('cat', categorical_transformer, categorical_features)
            ]
        )
        
        # Create pipeline
        pipeline = Pipeline(steps=[
            ('preprocessor', preprocessor),
            ('model', RandomForestRegressor(n_estimators=n_estimators, random_state=42))
        ])
        
        # Train model
        pipeline.fit(X_train, y_train)
        
        # Evaluate model
        y_pred = pipeline.predict(X_test)
        
        # Calculate metrics
        mae = np.mean(np.abs(y_test - y_pred))
        mse = np.mean((y_test - y_pred) ** 2)
        rmse = np.sqrt(mse)
        
        # Calculate average impact from training data
        avg_impact = y_train.mean()
        
        metrics = {
            'mean_absolute_error': mae,
            'mean_squared_error': mse,
            'root_mean_squared_error': rmse,
            'avg_impact': avg_impact,
            'training_samples': len(X_train),
            'testing_samples': len(X_test),
            'target_variable': target_var
        }
        
        logger.info(f"Impact model training complete: MAE={metrics['mean_absolute_error']:.2f}")
        
        # Save model
        self.impact_model = pipeline
        
        if self.model_path:
            os.makedirs(self.model_path, exist_ok=True)
            joblib.dump(pipeline, os.path.join(self.model_path, 'incident_impact_model.joblib'))
            
            # Save metadata about the model
            with open(os.path.join(self.model_path, 'impact_model_metadata.json'), 'w') as f:
                import json
                json.dump({
                    'target_variable': target_var,
                    'categorical_features': categorical_features,
                    'numerical_features': numerical_features,
                    'training_timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                    'avg_impact': float(avg_impact)
                }, f)
                
            logger.info(f"Impact model saved to {self.model_path}")
        
        return metrics
    
    def load_model(self):
        """Load saved model from disk."""
        if not self.model_path or not os.path.exists(self.model_path):
            logger.error(f"Model path does not exist: {self.model_path}")
            return False
        
        try:
            model_path = os.path.join(self.model_path, 'incident_impact_model.joblib')
            if os.path.exists(model_path):
                self.impact_model = joblib.load(model_path)
                logger.info(f"Loaded impact model from {model_path}")
                return True
            else:
                logger.error(f"Model file not found at {model_path}")
                return False
        except Exception as e:
            logger.error(f"Error loading impact model: {e}")
            return False
    
    def predict_impact(self, incident_data):
        """
        Predict the impact of a traffic incident.
        
        Args:
            incident_data (dict): Information about the incident
                - 'road_name': Name of affected road
                - 'type': Type of incident
                - 'timestamp': When the incident occurred
                
        Returns:
            dict: Predicted impact information
        """
        if self.impact_model is None:
            logger.error("Impact model not trained or loaded")
            return {
                'error': 'Model not available',
                'status': 'error'
            }
        
        try:
            # Extract features from incident data
            road_name = incident_data.get('road_name', '')
            incident_type = incident_data.get('type', 'Unknown')
            timestamp = incident_data.get('timestamp', datetime.now())
            
            if not isinstance(timestamp, datetime):
                try:
                    timestamp = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                except:
                    timestamp = datetime.now()
            
            # Calculate time-based features
            hour = timestamp.hour
            is_peak = 1 if (7 <= hour <= 9) or (17 <= hour <= 19) else 0
            day_of_week = timestamp.weekday()
            is_weekend = 1 if day_of_week >= 5 else 0
            
            # Get current speed conditions for the road
            current_speed = self._get_current_speed_for_road(road_name)
            
            # Check weather conditions
            rain_condition = self._get_current_weather()
            
            # Create feature dictionary
            features = {
                'incident_type': incident_type,
                'affected_road': road_name,
                'hour': hour,
                'is_peak': is_peak,
                'day_of_week': day_of_week,
                'is_weekend': is_weekend,
                'rain_condition': rain_condition,
                'before_speed': current_speed
            }
            
            # Convert to DataFrame for prediction
            feature_df = pd.DataFrame([features])
            
            # Make prediction
            impact = self.impact_model.predict(feature_df)[0]
            
            # Load model metadata to determine what type of impact was predicted
            target_type = "speed_impact"
            try:
                metadata_path = os.path.join(self.model_path, 'impact_model_metadata.json')
                if os.path.exists(metadata_path):
                    with open(metadata_path, 'r') as f:
                        import json
                        metadata = json.load(f)
                        target_type = metadata.get('target_variable', 'speed_impact')
            except:
                pass
            
            # Create detailed response
            result = {
                'status': 'success',
                'road_name': road_name,
                'impact_type': target_type,
                'predicted_impact': round(impact, 2)
            }
            
            # Add interpretation
            if target_type == 'time_impact':
                result['impact_description'] = f"Estimated {abs(round(impact, 1))} minute {'increase' if impact > 0 else 'decrease'} in travel time"
                result['severity'] = self._categorize_time_impact(impact)
            else:
                result['impact_description'] = f"Estimated {abs(round(impact, 2))} reduction in speed band"
                result['severity'] = self._categorize_speed_impact(impact)
            
            # Add estimated duration based on incident type and conditions
            duration = self._estimate_incident_duration(incident_type, is_peak, is_weekend, rain_condition)
            result['estimated_duration_minutes'] = duration
            
            # Add affected area radius
            result['affected_area_km'] = self._estimate_affected_area(incident_type, is_peak, current_speed)
            
            return result
            
        except Exception as e:
            logger.error(f"Error predicting incident impact: {e}")
            return {
                'error': str(e),
                'status': 'error'
            }
    
    def _get_current_speed_for_road(self, road_name):
        """
        Get the current speed band for a specific road.
        
        Args:
            road_name (str): Name of the road
            
        Returns:
            float: Current speed band (1-5)
        """
        try:
            # Load recent speed band data
            speed_bands = self.data_loader.get_traffic_speed_bands(days=1)
            
            if not speed_bands.empty and 'RoadName' in speed_bands.columns and 'SpeedBand' in speed_bands.columns:
                # Filter for this road
                road_data = speed_bands[speed_bands['RoadName'].str.contains(road_name, na=False)]
                
                if not road_data.empty:
                    # Get most recent speed band
                    if 'Timestamp' in road_data.columns:
                        road_data = road_data.sort_values('Timestamp', ascending=False)
                    
                    return road_data.iloc[0]['SpeedBand']
            
            # Default value if not found
            return 3.0  # Middle speed band
        except:
            return 3.0
    
    def _get_current_weather(self):
        """
        Check if it's currently raining.
        
        Returns:
            int: 1 if raining, 0 otherwise
        """
        try:
            # Load weather data
            weather_data = self.data_loader.get_weather_data(days=1)
            
            if not weather_data.empty:
                # Get most recent forecast
                if 'general_forecast' in weather_data.columns:
                    forecast = weather_data.iloc[0]['general_forecast']
                    if isinstance(forecast, str) and ('rain' in forecast.lower() or 'shower' in forecast.lower()):
                        return 1
            
            return 0
        except:
            return 0
    
    def _categorize_time_impact(self, impact):
        """Categorize the severity of time impact."""
        if impact <= 3:
            return "Low"
        elif impact <= 10:
            return "Medium"
        else:
            return "High"
    
    def _categorize_speed_impact(self, impact):
        """Categorize the severity of speed band impact."""
        if impact <= 0.5:
            return "Low"
        elif impact <= 1.5:
            return "Medium"
        else:
            return "High"
    
    def _estimate_incident_duration(self, incident_type, is_peak, is_weekend, rain_condition):
        """
        Estimate the duration of an incident based on its characteristics.
        
        Args:
            incident_type: Type of incident
            is_peak: Whether occurring during peak hours
            is_weekend: Whether occurring on weekend
            rain_condition: Whether it's raining
            
        Returns:
            int: Estimated duration in minutes
        """
        # Base duration by incident type
        base_duration = 30  # Default
        
        if 'Accident' in incident_type:
            base_duration = 45
        elif 'Vehicle breakdown' in incident_type:
            base_duration = 25
        elif 'Roadwork' in incident_type:
            base_duration = 120
        elif 'Heavy Traffic' in incident_type:
            base_duration = 60
        elif 'Obstacle' in incident_type:
            base_duration = 20
        elif 'Diversion' in incident_type:
            base_duration = 90
        elif 'Road Block' in incident_type:
            base_duration = 75
        
        # Adjust for conditions
        if is_peak:
            base_duration *= 1.3  # 30% longer during peak hours
        
        if is_weekend:
            base_duration *= 0.8  # 20% shorter on weekends (less traffic)
        
        if rain_condition:
            base_duration *= 1.25  # 25% longer when raining
        
        return round(base_duration)
    
    def _estimate_affected_area(self, incident_type, is_peak, current_speed):
        """
        Estimate the radius of the area affected by an incident.
        
        Args:
            incident_type: Type of incident
            is_peak: Whether occurring during peak hours
            current_speed: Current speed band
            
        Returns:
            float: Estimated radius in kilometers
        """
        # Base radius by incident type
        base_radius = 1.0  # Default
        
        if 'Accident' in incident_type:
            base_radius = 2.0
        elif 'Vehicle breakdown' in incident_type:
            base_radius = 1.0
        elif 'Roadwork' in incident_type:
            base_radius = 1.5
        elif 'Heavy Traffic' in incident_type:
            base_radius = 3.0
        elif 'Obstacle' in incident_type:
            base_radius = 0.5
        elif 'Diversion' in incident_type:
            base_radius = 2.5
        elif 'Road Block' in incident_type:
            base_radius = 2.0
        
        # Adjust for conditions
        if is_peak:
            base_radius *= 1.5  # 50% larger during peak hours
        
        # Adjust for current speed (congestion spreads further in high-speed conditions)
        if current_speed >= 4:
            base_radius *= 1.2  # 20% larger in high-speed conditions
        elif current_speed <= 2:
            base_radius *= 0.8  # 20% smaller in already congested conditions
        
        return round(base_radius, 1)
    
    def get_historical_impacts(self, road_name=None, incident_type=None, days=30):
        """
        Retrieve historical impact data for analysis.
        
        Args:
            road_name (str, optional): Filter by road name
            incident_type (str, optional): Filter by incident type
            days (int): Number of days of historical data to analyze
            
        Returns:
            dict: Historical impact statistics
        """
        # Load historical data
        impact_data = self.load_data(days=days)
        
        if impact_data.empty:
            return {
                'status': 'error',
                'error': 'No historical impact data available'
            }
        
        # Apply filters
        if road_name:
            impact_data = impact_data[impact_data['affected_road'].str.contains(road_name, na=False)]
        
        if incident_type:
            impact_data = impact_data[impact_data['incident_type'] == incident_type]
        
        if impact_data.empty:
            return {
                'status': 'error',
                'error': 'No data matching the filter criteria'
            }
        
        # Calculate statistics
        stats = {}
        
        # Speed impact stats
        if 'speed_impact' in impact_data.columns:
            speed_impacts = impact_data['speed_impact'].dropna()
            if not speed_impacts.empty:
                stats['speed_impact'] = {
                    'mean': float(speed_impacts.mean()),
                    'median': float(speed_impacts.median()),
                    'min': float(speed_impacts.min()),
                    'max': float(speed_impacts.max()),
                    'std': float(speed_impacts.std())
                }
        
        # Time impact stats
        if 'time_impact' in impact_data.columns:
            time_impacts = impact_data['time_impact'].dropna()
            if not time_impacts.empty:
                stats['time_impact'] = {
                    'mean': float(time_impacts.mean()),
                    'median': float(time_impacts.median()),
                    'min': float(time_impacts.min()),
                    'max': float(time_impacts.max()),
                    'std': float(time_impacts.std())
                }
        
        # Impact by incident type
        if 'incident_type' in impact_data.columns and 'speed_impact' in impact_data.columns:
            type_impacts = impact_data.groupby('incident_type')['speed_impact'].mean().to_dict()
            stats['impact_by_type'] = {k: float(v) for k, v in type_impacts.items()}
        
        # Impact by time of day
        if 'hour' in impact_data.columns and 'speed_impact' in impact_data.columns:
            hour_impacts = impact_data.groupby('hour')['speed_impact'].mean().to_dict()
            stats['impact_by_hour'] = {str(k): float(v) for k, v in hour_impacts.items()}
        
        # Impact by day of week
        if 'day_of_week' in impact_data.columns and 'speed_impact' in impact_data.columns:
            day_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
            day_impacts = impact_data.groupby('day_of_week')['speed_impact'].mean().to_dict()
            stats['impact_by_day'] = {day_names[k]: float(v) for k, v in day_impacts.items() if 0 <= k < 7}
        
        # Impact with/without rain
        if 'rain_condition' in impact_data.columns and 'speed_impact' in impact_data.columns:
            rain_group = impact_data.groupby('rain_condition')['speed_impact'].mean()
            if 0 in rain_group and 1 in rain_group:
                stats['rain_impact'] = {
                    'no_rain': float(rain_group[0]),
                    'rain': float(rain_group[1]),
                    'difference': float(rain_group[1] - rain_group[0])
                }
        
        # Create response
        result = {
            'status': 'success',
            'data_points': len(impact_data),
            'days_analyzed': days,
            'road_filter': road_name,
            'incident_type_filter': incident_type,
            'statistics': stats
        }
        
        return result