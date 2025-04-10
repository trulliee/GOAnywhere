# app/models/feedback_analyzer.py

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import logging
import os
from firebase_admin import firestore
from app.data.firestore_dataloader import FirestoreDataLoader

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class FeedbackAnalyzer:
    """
    Analyzes user feedback on prediction accuracy to evaluate model performance
    and identify patterns for improvement.
    """
    
    def __init__(self):
        """Initialize the feedback analyzer."""
        self.data_loader = FirestoreDataLoader()
        self.db = firestore.client()
        
        # Initialize collections
        self.feedback_collection = self.db.collection('prediction_feedback')
        self.accuracy_metrics_collection = self.db.collection('prediction_accuracy_metrics')
        self.model_performance_collection = self.db.collection('model_performance')
    
    def record_feedback(self, feedback_data):
        """
        Record user feedback on a prediction.
        
        Args:
            feedback_data (dict): User feedback with prediction details
            
        Returns:
            str: Feedback document ID
        """
        # Validate required fields
        required_fields = ['prediction_type', 'prediction_id', 'actual_value', 'predicted_value', 'user_id']
        for field in required_fields:
            if field not in feedback_data:
                raise ValueError(f"Missing required field: {field}")
        
        # Add timestamp if not provided
        if 'timestamp' not in feedback_data:
            feedback_data['timestamp'] = firestore.SERVER_TIMESTAMP
        
        # Add calculated accuracy if not provided
        if 'accuracy_error' not in feedback_data and 'actual_value' in feedback_data and 'predicted_value' in feedback_data:
            # Handle different types of predictions
            if feedback_data['prediction_type'] == 'travel_time':
                # For time predictions, calculate absolute and percentage error
                actual = float(feedback_data['actual_value'])
                predicted = float(feedback_data['predicted_value'])
                abs_error = abs(actual - predicted)
                if actual > 0:
                    pct_error = (abs_error / actual) * 100
                else:
                    pct_error = 0
                
                feedback_data['accuracy_error'] = {
                    'absolute_error': abs_error,
                    'percentage_error': pct_error
                }
            elif feedback_data['prediction_type'] == 'traffic_condition':
                # For categorical predictions, calculate match (1 for correct, 0 for incorrect)
                actual = str(feedback_data['actual_value']).lower()
                predicted = str(feedback_data['predicted_value']).lower()
                match = 1 if actual == predicted else 0
                
                feedback_data['accuracy_error'] = {
                    'match': match
                }
        
        # Store in Firestore
        doc_ref = self.feedback_collection.document()
        doc_ref.set(feedback_data)
        
        # Update aggregated metrics
        self._update_accuracy_metrics(feedback_data)
        
        return doc_ref.id
    
    def _update_accuracy_metrics(self, feedback_data):
        """
        Update aggregated accuracy metrics based on new feedback.
        
        Args:
            feedback_data (dict): User feedback data
        """
        # Determine which metrics to update based on prediction type
        prediction_type = feedback_data.get('prediction_type')
        
        # Create document ID based on prediction type and date
        today = datetime.now().strftime('%Y-%m-%d')
        doc_id = f"{prediction_type}_{today}"
        
        # Try to get existing metrics document
        metrics_ref = self.accuracy_metrics_collection.document(doc_id)
        metrics_doc = metrics_ref.get()
        
        if metrics_doc.exists:
            # Update existing metrics
            metrics = metrics_doc.to_dict()
            
            # Increment counts
            metrics['total_feedback_count'] = metrics.get('total_feedback_count', 0) + 1
            
            # Update error metrics based on prediction type
            if prediction_type == 'travel_time':
                accuracy_error = feedback_data.get('accuracy_error', {})
                abs_error = accuracy_error.get('absolute_error', 0)
                pct_error = accuracy_error.get('percentage_error', 0)
                
                # Update total errors
                metrics['total_absolute_error'] = metrics.get('total_absolute_error', 0) + abs_error
                metrics['total_percentage_error'] = metrics.get('total_percentage_error', 0) + pct_error
                
                # Update average errors
                metrics['avg_absolute_error'] = metrics['total_absolute_error'] / metrics['total_feedback_count']
                metrics['avg_percentage_error'] = metrics['total_percentage_error'] / metrics['total_feedback_count']
                
                # Track error distribution
                error_range = self._get_error_range(pct_error)
                error_dist = metrics.get('error_distribution', {})
                error_dist[error_range] = error_dist.get(error_range, 0) + 1
                metrics['error_distribution'] = error_dist
                
            elif prediction_type == 'traffic_condition':
                accuracy_error = feedback_data.get('accuracy_error', {})
                match = accuracy_error.get('match', 0)
                
                # Update match counts
                metrics['match_count'] = metrics.get('match_count', 0) + match
                
                # Update accuracy rate
                metrics['accuracy_rate'] = metrics['match_count'] / metrics['total_feedback_count']
                
                # Track incorrect predictions
                if match == 0:
                    actual = feedback_data.get('actual_value', '')
                    predicted = feedback_data.get('predicted_value', '')
                    mismatch_pairs = metrics.get('mismatch_pairs', {})
                    pair_key = f"{predicted}_vs_{actual}"
                    mismatch_pairs[pair_key] = mismatch_pairs.get(pair_key, 0) + 1
                    metrics['mismatch_pairs'] = mismatch_pairs
            
            # Update metrics doc
            metrics_ref.set(metrics)
            
        else:
            # Create new metrics document
            metrics = {
                'prediction_type': prediction_type,
                'date': today,
                'total_feedback_count': 1,
                'last_updated': firestore.SERVER_TIMESTAMP
            }
            
            # Add type-specific metrics
            if prediction_type == 'travel_time':
                accuracy_error = feedback_data.get('accuracy_error', {})
                abs_error = accuracy_error.get('absolute_error', 0)
                pct_error = accuracy_error.get('percentage_error', 0)
                
                metrics.update({
                    'total_absolute_error': abs_error,
                    'total_percentage_error': pct_error,
                    'avg_absolute_error': abs_error,
                    'avg_percentage_error': pct_error,
                    'error_distribution': {
                        self._get_error_range(pct_error): 1
                    }
                })
                
            elif prediction_type == 'traffic_condition':
                accuracy_error = feedback_data.get('accuracy_error', {})
                match = accuracy_error.get('match', 0)
                
                metrics.update({
                    'match_count': match,
                    'accuracy_rate': match,
                })
                
                # Track incorrect predictions
                if match == 0:
                    actual = feedback_data.get('actual_value', '')
                    predicted = feedback_data.get('predicted_value', '')
                    metrics['mismatch_pairs'] = {
                        f"{predicted}_vs_{actual}": 1
                    }
            
            # Store new metrics
            metrics_ref.set(metrics)
    
    def _get_error_range(self, error_percent):
        """Categorize error percentage into ranges."""
        if error_percent <= 5:
            return "0-5%"
        elif error_percent <= 10:
            return "5-10%"
        elif error_percent <= 20:
            return "10-20%"
        elif error_percent <= 50:
            return "20-50%"
        else:
            return "50%+"
    
    def get_feedback_data(self, prediction_type, time_period='last_30_days'):
        """
        Get feedback data from Firestore using the data loader.
        
        Args:
            prediction_type (str): Type of prediction to analyze
            time_period (str): Time period to analyze ('last_7_days', 'last_30_days', 'last_90_days')
            
        Returns:
            pandas.DataFrame: Feedback data
        """
        # Calculate date range
        end_date = datetime.now()
        
        if time_period == 'last_7_days':
            start_date = end_date - timedelta(days=7)
        elif time_period == 'last_30_days':
            start_date = end_date - timedelta(days=30)
        elif time_period == 'last_90_days':
            start_date = end_date - timedelta(days=90)
        else:
            start_date = end_date - timedelta(days=30)  # Default to 30 days
        
        # Query feedback data
        query = (self.feedback_collection
                .where('prediction_type', '==', prediction_type)
                .where('timestamp', '>=', start_date)
                .where('timestamp', '<=', end_date)
                .order_by('timestamp'))
        
        # Execute query
        results = query.stream()
        
        # Convert to pandas DataFrame for analysis
        feedback_list = []
        for doc in results:
            feedback = doc.to_dict()
            feedback['id'] = doc.id
            feedback_list.append(feedback)
        
        if not feedback_list:
            return pd.DataFrame()
        
        df = pd.DataFrame(feedback_list)
        
        # Ensure timestamp is a datetime
        if 'timestamp' in df.columns:
            # Convert Firestore timestamps to datetime
            df['timestamp'] = df['timestamp'].apply(
                lambda x: x.timestamp() if hasattr(x, 'timestamp') else x
            )
            df['timestamp'] = pd.to_datetime(df['timestamp'], unit='s')
            df['date'] = df['timestamp'].dt.date
        
        return df
    
    def analyze_feedback_trends(self, prediction_type, time_period='last_30_days'):
        """
        Analyze feedback trends over a specified time period.
        
        Args:
            prediction_type (str): Type of prediction to analyze
            time_period (str): Time period to analyze ('last_7_days', 'last_30_days', 'last_90_days')
            
        Returns:
            dict: Analysis results
        """
        # Get the feedback data using the new method
        df = self.get_feedback_data(prediction_type, time_period)
        
        if df.empty:
            return {
                'prediction_type': prediction_type,
                'time_period': time_period,
                'feedback_count': 0,
                'message': 'No feedback data available for the selected period'
            }
        
        # Calculate date range from the data
        start_date = df['timestamp'].min()
        end_date = df['timestamp'].max()
        
        # Prepare analysis results
        analysis = {
            'prediction_type': prediction_type,
            'time_period': time_period,
            'feedback_count': len(df),
            'date_range': {
                'start': start_date.strftime('%Y-%m-%d'),
                'end': end_date.strftime('%Y-%m-%d')
            }
        }
        
        # Analyze based on prediction type
        if prediction_type == 'travel_time':
            # Extract error metrics if available
            if 'accuracy_error' in df.columns:
                df['absolute_error'] = df['accuracy_error'].apply(
                    lambda x: x.get('absolute_error', 0) if isinstance(x, dict) else 0
                )
                df['percentage_error'] = df['accuracy_error'].apply(
                    lambda x: x.get('percentage_error', 0) if isinstance(x, dict) else 0
                )
            
                # Calculate overall metrics
                analysis['overall_metrics'] = {
                    'avg_absolute_error': df['absolute_error'].mean(),
                    'median_absolute_error': df['absolute_error'].median(),
                    'avg_percentage_error': df['percentage_error'].mean(),
                    'median_percentage_error': df['percentage_error'].median(),
                }
                
                # Calculate daily metrics
                daily_metrics = df.groupby('date').agg({
                    'absolute_error': ['mean', 'median'],
                    'percentage_error': ['mean', 'median'],
                    'id': 'count'
                }).reset_index()
                
                daily_metrics.columns = ['date', 'avg_absolute_error', 'median_absolute_error', 
                                        'avg_percentage_error', 'median_percentage_error', 'count']
                
                # Convert to list of dicts for easy JSON serialization
                analysis['daily_metrics'] = daily_metrics.to_dict('records')
                
                # Identify patterns or anomalies
                analysis['insights'] = self._generate_travel_time_insights(df, daily_metrics)
                
        elif prediction_type == 'traffic_condition':
            # Extract match metrics if available
            if 'accuracy_error' in df.columns:
                df['match'] = df['accuracy_error'].apply(
                    lambda x: x.get('match', 0) if isinstance(x, dict) else 0
                )
            
                # Calculate overall accuracy
                analysis['overall_metrics'] = {
                    'accuracy_rate': df['match'].mean() * 100,
                    'total_correct': df['match'].sum(),
                    'total_incorrect': len(df) - df['match'].sum()
                }
                
                # Calculate daily accuracy
                daily_metrics = df.groupby('date').agg({
                    'match': ['mean', 'sum'],
                    'id': 'count'
                }).reset_index()
                
                daily_metrics.columns = ['date', 'accuracy_rate', 'correct_count', 'total_count']
                daily_metrics['accuracy_rate'] = daily_metrics['accuracy_rate'] * 100
                daily_metrics['incorrect_count'] = daily_metrics['total_count'] - daily_metrics['correct_count']
                
                # Convert to list of dicts for easy JSON serialization
                analysis['daily_metrics'] = daily_metrics.to_dict('records')
                
                # Analyze mismatches
                mismatch_df = df[df['match'] == 0]
                mismatch_analysis = self._analyze_traffic_condition_mismatches(mismatch_df)
                analysis['mismatch_analysis'] = mismatch_analysis
                
                # Identify patterns or anomalies
                analysis['insights'] = self._generate_traffic_condition_insights(df, daily_metrics, mismatch_analysis)
        
        return analysis
    
    def _generate_travel_time_insights(self, df, daily_metrics):
        """Generate insights from travel time prediction feedback."""
        insights = []
        
        # Check if error is increasing over time
        if len(daily_metrics) > 5:  # Need enough data points
            recent_trend = daily_metrics.iloc[-5:]['avg_percentage_error'].pct_change().mean()
            
            if recent_trend > 0.05:  # Error increasing by more than 5%
                insights.append({
                    'type': 'warning',
                    'message': 'Travel time prediction errors have been increasing over the last 5 days',
                    'increase_rate': f"{recent_trend*100:.1f}%"
                })
            elif recent_trend < -0.05:  # Error decreasing by more than 5%
                insights.append({
                    'type': 'positive',
                    'message': 'Travel time prediction accuracy has been improving over the last 5 days',
                    'improvement_rate': f"{-recent_trend*100:.1f}%"
                })
        
        # Identify time periods with high error rates
        if 'hour' not in df.columns and 'timestamp' in df.columns:
            df['hour'] = df['timestamp'].dt.hour
            
        hourly_errors = df.groupby('hour')['percentage_error'].mean()
        if not hourly_errors.empty:
            worst_hour = hourly_errors.idxmax()
            worst_hour_error = hourly_errors.max()
            
            if worst_hour_error > 20:  # More than 20% error
                insights.append({
                    'type': 'action',
                    'message': f"Travel time predictions during hour {worst_hour} have high error rates ({worst_hour_error:.1f}%)",
                    'recommendation': "Consider retraining the model with more data from this time period"
                })
        
        # Check for areas with high error rates
        if 'location' in df.columns:
            location_errors = df.groupby('location')['percentage_error'].mean()
            if not location_errors.empty and len(location_errors) > 1:
                worst_location = location_errors.idxmax()
                worst_location_error = location_errors.max()
                
                if worst_location_error > 25:  # More than 25% error
                    insights.append({
                        'type': 'action',
                        'message': f"Travel time predictions for location '{worst_location}' have high error rates ({worst_location_error:.1f}%)",
                        'recommendation': "Consider gathering more training data for this location"
                    })
        
        # Add insights based on other data sources
        try:
            # Check if traffic patterns have changed recently
            speed_bands = self.data_loader.get_traffic_speed_bands(days=7)
            
            if not speed_bands.empty and 'timestamp' in df.columns:
                # Get most recent feedback data point timestamp
                latest_feedback = df['timestamp'].max()
                
                # Look for traffic data around the same time
                if 'Timestamp' in speed_bands.columns:
                    recent_traffic = speed_bands[
                        (speed_bands['Timestamp'] >= latest_feedback - timedelta(hours=1)) &
                        (speed_bands['Timestamp'] <= latest_feedback + timedelta(hours=1))
                    ]
                    
                    if not recent_traffic.empty and 'SpeedBand' in recent_traffic.columns:
                        avg_speed = recent_traffic['SpeedBand'].mean()
                        
                        # If traffic is significantly congested
                        if avg_speed < 2.5:
                            insights.append({
                                'type': 'info',
                                'message': 'Recent traffic conditions have been heavily congested, which may affect prediction accuracy',
                                'source': 'traffic_data'
                            })
        except Exception as e:
            logger.warning(f"Error getting additional insights from traffic data: {e}")
        
        return insights
    
    def _generate_traffic_condition_insights(self, df, daily_metrics, mismatch_analysis):
        """Generate insights from traffic condition prediction feedback."""
        insights = []
        
        # Check if accuracy is decreasing over time
        if len(daily_metrics) > 5:  # Need enough data points
            recent_trend = daily_metrics.iloc[-5:]['accuracy_rate'].pct_change().mean()
            
            if recent_trend < -0.05:  # Accuracy decreasing by more than 5%
                insights.append({
                    'type': 'warning',
                    'message': 'Traffic condition prediction accuracy has been decreasing over the last 5 days',
                    'decrease_rate': f"{-recent_trend*100:.1f}%"
                })
            elif recent_trend > 0.05:  # Accuracy increasing by more than 5%
                insights.append({
                    'type': 'positive',
                    'message': 'Traffic condition prediction accuracy has been improving over the last 5 days',
                    'improvement_rate': f"{recent_trend*100:.1f}%"
                })
        
        # Identify common misclassifications
        if mismatch_analysis and 'common_mismatches' in mismatch_analysis:
            common_mismatches = mismatch_analysis['common_mismatches']
            if common_mismatches:
                top_mismatch = common_mismatches[0]
                insights.append({
                    'type': 'action',
                    'message': f"The model frequently predicts '{top_mismatch['predicted']}' when the actual condition is '{top_mismatch['actual']}'",
                    'recommendation': "Consider adjusting the classification thresholds for these conditions",
                    'occurrence_count': top_mismatch['count']
                })
        
        # Check for time periods with low accuracy
        if 'hour' not in df.columns and 'timestamp' in df.columns:
            df['hour'] = df['timestamp'].dt.hour
            
        hourly_accuracy = df.groupby('hour')['match'].mean() * 100
        if not hourly_accuracy.empty:
            worst_hour = hourly_accuracy.idxmin()
            worst_hour_accuracy = hourly_accuracy.min()
            
            if worst_hour_accuracy < 70:  # Less than 70% accuracy
                insights.append({
                    'type': 'action',
                    'message': f"Traffic condition predictions during hour {worst_hour} have low accuracy ({worst_hour_accuracy:.1f}%)",
                    'recommendation': "Model may need retraining with more data from this time period"
                })
        
        # Add insights based on other data sources
        try:
            # Check if there are unusual traffic patterns
            incidents = self.data_loader.get_incidents(days=7)
            
            if not incidents.empty:
                # Count incidents by day
                if 'Timestamp' in incidents.columns:
                    incidents['date'] = incidents['Timestamp'].dt.date
                    daily_incident_counts = incidents.groupby('date').size()
                    
                    # Check if there are days with significantly higher incidents
                    avg_incidents = daily_incident_counts.mean()
                    max_incidents = daily_incident_counts.max()
                    
                    if max_incidents > avg_incidents * 1.5:  # 50% more incidents than average
                        high_incident_day = daily_incident_counts.idxmax()
                        
                        insights.append({
                            'type': 'info',
                            'message': f"Traffic incidents on {high_incident_day} were significantly higher than average, which may affect prediction accuracy",
                            'source': 'incident_data',
                            'incident_count': int(max_incidents)
                        })
        except Exception as e:
            logger.warning(f"Error getting additional insights from incident data: {e}")
        
        return insights
    
    def _analyze_traffic_condition_mismatches(self, mismatch_df):
        """Analyze patterns in traffic condition mismatches."""
        if mismatch_df.empty:
            return {
                'total_mismatches': 0,
                'message': 'No mismatches found in the data'
            }
        
        result = {
            'total_mismatches': len(mismatch_df)
        }
        
        # Count mismatches by actual vs predicted pairs
        mismatch_counts = mismatch_df.groupby(['actual_value', 'predicted_value']).size().reset_index()
        mismatch_counts.columns = ['actual', 'predicted', 'count']
        mismatch_counts = mismatch_counts.sort_values('count', ascending=False)
        
        # Convert to dictionaries for serialization
        result['common_mismatches'] = mismatch_counts.to_dict('records')
        
        # Check for systematic bias
        if len(mismatch_counts) > 0:
            # Are we consistently over-predicting severity?
            severity_order = ['Free Flow', 'Light', 'Moderate', 'Heavy', 'Severe']
            
            # Add ability to convert predictions to numeric severity
            def get_severity_level(condition):
                try:
                    return severity_order.index(condition)
                except (ValueError, IndexError):
                    return -1  # Unknown condition
            
            # Add severity levels to the dataframe
            mismatch_df['actual_severity'] = mismatch_df['actual_value'].apply(get_severity_level)
            mismatch_df['predicted_severity'] = mismatch_df['predicted_value'].apply(get_severity_level)
            
            # Calculate if predictions are consistently higher or lower
            mismatch_df['severity_diff'] = mismatch_df['predicted_severity'] - mismatch_df['actual_severity']
            
            avg_diff = mismatch_df['severity_diff'].mean()
            
            if avg_diff > 0.5:
                result['systematic_bias'] = {
                    'type': 'over_prediction',
                    'message': 'Model tends to predict more severe traffic conditions than actually occur',
                    'avg_difference': avg_diff
                }
            elif avg_diff < -0.5:
                result['systematic_bias'] = {
                    'type': 'under_prediction',
                    'message': 'Model tends to predict less severe traffic conditions than actually occur',
                    'avg_difference': avg_diff
                }
            else:
                result['systematic_bias'] = {
                    'type': 'balanced',
                    'message': 'No systematic bias detected in traffic condition predictions',
                    'avg_difference': avg_diff
                }
        
        return result
    
    def generate_performance_report(self, prediction_type, time_period='last_30_days'):
        """
        Generate a comprehensive performance report with visualizations.
        
        Args:
            prediction_type (str): Type of prediction to analyze
            time_period (str): Time period to analyze
            
        Returns:
            dict: Performance report with metrics and chart data
        """
        # Get analysis results
        analysis = self.analyze_feedback_trends(prediction_type, time_period)
        
        # Create performance report
        report = {
            'prediction_type': prediction_type,
            'time_period': time_period,
            'generated_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'data_summary': {
                'feedback_count': analysis.get('feedback_count', 0),
                'date_range': analysis.get('date_range', {})
            }
        }
        
        # Add type-specific metrics
        if prediction_type == 'travel_time':
            report['accuracy_metrics'] = analysis.get('overall_metrics', {})
            
            # Generate error distribution chart data
            if 'daily_metrics' in analysis:
                daily_data = analysis['daily_metrics']
                dates = [entry['date'].strftime('%Y-%m-%d') if hasattr(entry['date'], 'strftime') else entry['date'] 
                        for entry in daily_data]
                avg_errors = [entry['avg_percentage_error'] for entry in daily_data]
                
                report['chart_data'] = {
                    'time_series': {
                        'labels': dates,
                        'datasets': [{
                            'label': 'Average Error (%)',
                            'data': avg_errors
                        }]
                    }
                }
        
        elif prediction_type == 'traffic_condition':
            report['accuracy_metrics'] = analysis.get('overall_metrics', {})
            
            # Generate accuracy chart data
            if 'daily_metrics' in analysis:
                daily_data = analysis['daily_metrics']
                dates = [entry['date'].strftime('%Y-%m-%d') if hasattr(entry['date'], 'strftime') else entry['date'] 
                        for entry in daily_data]
                accuracy_rates = [entry['accuracy_rate'] for entry in daily_data]
                
                report['chart_data'] = {
                    'time_series': {
                        'labels': dates,
                        'datasets': [{
                            'label': 'Accuracy Rate (%)',
                            'data': accuracy_rates
                        }]
                    }
                }
            
            # Add confusion matrix data if available
            if 'mismatch_analysis' in analysis and 'common_mismatches' in analysis['mismatch_analysis']:
                mismatches = analysis['mismatch_analysis']['common_mismatches']
                
                # Extract unique values for actual and predicted
                actual_values = set()
                predicted_values = set()
                
                for mismatch in mismatches:
                    actual_values.add(mismatch['actual'])
                    predicted_values.add(mismatch['predicted'])
                
                # Convert to sorted lists
                actual_list = sorted(list(actual_values))
                predicted_list = sorted(list(predicted_values))
                
                # Create confusion matrix data
                matrix_data = []
                for actual in actual_list:
                    row = []
                    for predicted in predicted_list:
                        # Find count for this combination
                        count = 0
                        for mismatch in mismatches:
                            if mismatch['actual'] == actual and mismatch['predicted'] == predicted:
                                count = mismatch['count']
                                break
                        row.append(count)
                    matrix_data.append(row)
                
                report['chart_data']['confusion_matrix'] = {
                    'labels': {
                        'actual': actual_list,
                        'predicted': predicted_list
                    },
                    'data': matrix_data
                }
        
        # Add insights
        report['insights'] = analysis.get('insights', [])
        
        # Add recommendations
        report['recommendations'] = self._generate_recommendations(analysis)
        
        # Add contextual data from other sources
        report['context'] = self._get_contextual_data()
        
        # Store report in Firestore
        report_id = f"{prediction_type}_{datetime.now().strftime('%Y%m%d%H%M%S')}"
        self.model_performance_collection.document(report_id).set(report)
        
        return report
    
    def _get_contextual_data(self):
        """Get contextual data from other sources to enrich the report."""
        context = {}
        
        try:
            # Get recent incidents
            incidents = self.data_loader.get_incidents(days=7)
            if not incidents.empty:
                context['recent_incidents'] = {
                    'count': len(incidents),
                    'types': incidents['Type'].value_counts().to_dict() if 'Type' in incidents.columns else {}
                }
            
            # Get weather info
            weather = self.data_loader.get_weather_data(days=1)
            if not weather.empty:
                context['weather_conditions'] = {
                    'forecast': weather.iloc[0]['general_forecast'] if 'general_forecast' in weather.columns else 'Unknown',
                    'temperature_range': f"{weather.iloc[0]['temp_low']}-{weather.iloc[0]['temp_high']}" 
                        if all(col in weather.columns for col in ['temp_low', 'temp_high']) else 'Unknown'
                }
            
            # Get public holidays
            holidays = self.data_loader.get_historical_holidays()
            if not holidays.empty:
                # Get upcoming holidays
                today = datetime.now().date()
                upcoming = holidays[pd.to_datetime(holidays['Date']).dt.date >= today]
                
                if not upcoming.empty:
                    next_holiday = upcoming.iloc[0]
                    context['next_holiday'] = {
                        'name': next_holiday['Name'] if 'Name' in next_holiday else 'Unknown',
                        'date': next_holiday['Date'].strftime('%Y-%m-%d') if hasattr(next_holiday['Date'], 'strftime') else str(next_holiday['Date'])
                    }
        except Exception as e:
            logger.warning(f"Error getting contextual data: {e}")
        
        return context
    
    def _generate_recommendations(self, analysis):
        """Generate recommendations based on analysis results."""
        recommendations = []
        
        # Add recommendations from insights
        insights = analysis.get('insights', [])
        for insight in insights:
            if insight.get('type') == 'action' and 'recommendation' in insight:
                recommendations.append({
                    'priority': 'high' if 'high error rates' in insight.get('message', '') else 'medium',
                    'source': 'insight_analysis',
                    'action': insight['recommendation']
                })
        
        # Add general recommendations based on metrics
        prediction_type = analysis.get('prediction_type', '')
        
        if prediction_type == 'travel_time':
            metrics = analysis.get('overall_metrics', {})
            avg_pct_error = metrics.get('avg_percentage_error', 0)
            
            if avg_pct_error > 25:
                recommendations.append({
                    'priority': 'high',
                    'source': 'metrics_analysis',
                    'action': 'Consider retraining the travel time model with more recent data'
                })
            elif avg_pct_error > 15:
                recommendations.append({
                    'priority': 'medium',
                    'source': 'metrics_analysis',
                    'action': 'Review travel time model features for potential improvements'
                })
            
        elif prediction_type == 'traffic_condition':
            metrics = analysis.get('overall_metrics', {})
            accuracy_rate = metrics.get('accuracy_rate', 0)
            
            if accuracy_rate < 70:
                recommendations.append({
                    'priority': 'high',
                    'source': 'metrics_analysis',
                    'action': 'Consider retraining the traffic condition model with more recent data'
                })
            elif accuracy_rate < 85:
                recommendations.append({
                    'priority': 'medium',
                    'source': 'metrics_analysis',
                    'action': 'Review traffic condition model features or classification thresholds'
                })
            
            # Check for bias in predictions
            mismatch_analysis = analysis.get('mismatch_analysis', {})
            systematic_bias = mismatch_analysis.get('systematic_bias', {})
            
            if systematic_bias.get('type') == 'over_prediction':
                recommendations.append({
                    'priority': 'medium',
                    'source': 'bias_analysis',
                    'action': 'Adjust model to reduce over-prediction of severe traffic conditions'
                })
            elif systematic_bias.get('type') == 'under_prediction':
                recommendations.append({
                    'priority': 'medium',
                    'source': 'bias_analysis',
                    'action': 'Adjust model to account for under-prediction of severe traffic conditions'
                })
        
        # Add data quality recommendations
        try:
            # Check for potential data issues by looking at other data sources
            has_data_issue = False
            data_issue_reason = []
            
            # Check traffic speed band data
            speed_bands = self.data_loader.get_traffic_speed_bands(days=1)
            if speed_bands.empty:
                has_data_issue = True
                data_issue_reason.append("Missing recent traffic speed data")
            
            # Check incidents data
            incidents = self.data_loader.get_incidents(days=1)
            if incidents.empty:
                has_data_issue = True
                data_issue_reason.append("Missing recent incident data")
            
            # If data issues detected, add recommendation
            if has_data_issue:
                recommendations.append({
                    'priority': 'high',
                    'source': 'data_quality',
                    'action': f"Investigate data pipeline issues: {', '.join(data_issue_reason)}"
                })
                
        except Exception as e:
            logger.warning(f"Error generating data quality recommendations: {e}")
        
        return recommendations
    
    def create_feedback_visualization(self, prediction_type, time_period='last_30_days'):
        """
        Create visualizations of feedback data for the admin dashboard.
        
        Args:
            prediction_type (str): Type of prediction to visualize
            time_period (str): Time period to analyze
            
        Returns:
            dict: Visualization data for the dashboard
        """
        # Get analysis results
        analysis = self.analyze_feedback_trends(prediction_type, time_period)
        
        if analysis.get('feedback_count', 0) == 0:
            return {
                'prediction_type': prediction_type,
                'time_period': time_period,
                'error': 'No feedback data available for visualization'
            }
        
        # Create visualization config
        viz_data = {
            'prediction_type': prediction_type,
            'time_period': time_period,
            'chart_configs': []
        }
        
        # Time series chart
        if 'daily_metrics' in analysis:
            daily_data = analysis['daily_metrics']
            
            if prediction_type == 'travel_time':
                dates = [entry.get('date') for entry in daily_data]
                avg_errors = [entry.get('avg_percentage_error', 0) for entry in daily_data]
                
                viz_data['chart_configs'].append({
                    'chart_type': 'line',
                    'title': 'Travel Time Prediction Error Over Time',
                    'x_label': 'Date',
                    'y_label': 'Average Error (%)',
                    'data': {
                        'labels': dates,
                        'datasets': [{
                            'label': 'Average Error (%)',
                            'data': avg_errors,
                            'borderColor': 'rgba(255, 99, 132, 1)',
                            'backgroundColor': 'rgba(255, 99, 132, 0.2)'
                        }]
                    }
                })
                
            elif prediction_type == 'traffic_condition':
                dates = [entry.get('date') for entry in daily_data]
                accuracy_rates = [entry.get('accuracy_rate', 0) for entry in daily_data]
                
                viz_data['chart_configs'].append({
                    'chart_type': 'line',
                    'title': 'Traffic Condition Prediction Accuracy Over Time',
                    'x_label': 'Date',
                    'y_label': 'Accuracy Rate (%)',
                    'data': {
                        'labels': dates,
                        'datasets': [{
                            'label': 'Accuracy Rate (%)',
                            'data': accuracy_rates,
                            'borderColor': 'rgba(54, 162, 235, 1)',
                            'backgroundColor': 'rgba(54, 162, 235, 0.2)'
                        }]
                    }
                })
        
        # Add additional charts based on prediction type
        if prediction_type == 'travel_time':
            # Add error distribution chart
            if 'error_distribution' in analysis:
                error_ranges = list(analysis['error_distribution'].keys())
                error_counts = list(analysis['error_distribution'].values())
                
                viz_data['chart_configs'].append({
                    'chart_type': 'bar',
                    'title': 'Travel Time Prediction Error Distribution',
                    'x_label': 'Error Range',
                    'y_label': 'Number of Predictions',
                    'data': {
                        'labels': error_ranges,
                        'datasets': [{
                            'label': 'Error Distribution',
                            'data': error_counts,
                            'backgroundColor': 'rgba(153, 102, 255, 0.6)'
                        }]
                    }
                })
                
        elif prediction_type == 'traffic_condition':
            # Add confusion matrix chart
            if 'mismatch_analysis' in analysis:
                # This is complex visualization that requires custom rendering
                # We'll include the data for the frontend to render
                viz_data['custom_visualizations'] = {
                    'confusion_matrix': {
                        'type': 'confusion_matrix',
                        'title': 'Traffic Condition Prediction Confusion Matrix',
                        'data': analysis['mismatch_analysis'].get('common_mismatches', [])
                    }
                }
        
        # Add contextual information from other data sources
        try:
            # Add traffic data context
            speed_bands = self.data_loader.get_traffic_speed_bands(days=7)
            
            if not speed_bands.empty and 'Timestamp' in speed_bands.columns and 'SpeedBand' in speed_bands.columns:
                # Group by day and calculate average speed
                speed_bands['date'] = speed_bands['Timestamp'].dt.date
                daily_speeds = speed_bands.groupby('date')['SpeedBand'].mean().reset_index()
                
                # Add to visualizations
                viz_data['chart_configs'].append({
                    'chart_type': 'line',
                    'title': 'Average Traffic Speed Bands',
                    'x_label': 'Date',
                    'y_label': 'Average Speed Band',
                    'data': {
                        'labels': [date.strftime('%Y-%m-%d') for date in daily_speeds['date']],
                        'datasets': [{
                            'label': 'Average Speed Band',
                            'data': [round(speed, 2) for speed in daily_speeds['SpeedBand']],
                            'borderColor': 'rgba(75, 192, 192, 1)',
                            'backgroundColor': 'rgba(75, 192, 192, 0.2)'
                        }]
                    }
                })
        except Exception as e:
            logger.warning(f"Error adding contextual visualizations: {e}")
        
        return viz_data
    
    def compare_model_versions(self, prediction_type, version1, version2):
        """
        Compare the performance of two model versions.
        
        Args:
            prediction_type (str): Type of prediction to analyze
            version1 (str): First model version identifier
            version2 (str): Second model version identifier
            
        Returns:
            dict: Comparison results
        """
        # Get performance reports for both versions
        reports = {}
        
        for version in [version1, version2]:
            report_query = (self.model_performance_collection
                           .where('prediction_type', '==', prediction_type)
                           .where('version', '==', version)
                           .limit(1))
            
            report_docs = report_query.stream()
            for doc in report_docs:
                reports[version] = doc.to_dict()
        
        # If either report is missing, return error
        if version1 not in reports:
            return {
                'error': f"No performance report found for version {version1}",
                'status': 'error'
            }
        
        if version2 not in reports:
            return {
                'error': f"No performance report found for version {version2}",
                'status': 'error'
            }
        
        # Create comparison
        comparison = {
            'prediction_type': prediction_type,
            'version1': version1,
            'version2': version2,
            'generated_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }
        
        # Add metrics comparison
        metrics1 = reports[version1].get('accuracy_metrics', {})
        metrics2 = reports[version2].get('accuracy_metrics', {})
        
        metrics_diff = {}
        
        for key in metrics1:
            if key in metrics2:
                value1 = metrics1[key]
                value2 = metrics2[key]
                
                if isinstance(value1, (int, float)) and isinstance(value2, (int, float)):
                    diff = value2 - value1
                    pct_change = diff / value1 * 100 if value1 != 0 else 0
                    
                    # Determine if change is positive or negative
                    is_improvement = False
                    
                    if prediction_type == 'travel_time' and key in ['avg_absolute_error', 'avg_percentage_error']:
                        # For error metrics, lower is better
                        is_improvement = diff < 0
                    elif prediction_type == 'traffic_condition' and key in ['accuracy_rate']:
                        # For accuracy metrics, higher is better
                        is_improvement = diff > 0
                    
                    metrics_diff[key] = {
                        'version1': value1,
                        'version2': value2,
                        'difference': diff,
                        'percent_change': pct_change,
                        'is_improvement': is_improvement
                    }
        
        comparison['metrics_comparison'] = metrics_diff
        
        # Determine overall improvement
        overall_improved = False
        significant_change = False
        
        if prediction_type == 'travel_time':
            # Check error metrics
            if 'avg_percentage_error' in metrics_diff:
                pct_change = metrics_diff['avg_percentage_error']['percent_change']
                overall_improved = metrics_diff['avg_percentage_error']['is_improvement']
                significant_change = abs(pct_change) > 5  # More than 5% change
        elif prediction_type == 'traffic_condition':
            # Check accuracy metrics
            if 'accuracy_rate' in metrics_diff:
                pct_change = metrics_diff['accuracy_rate']['percent_change']
                overall_improved = metrics_diff['accuracy_rate']['is_improvement']
                significant_change = abs(pct_change) > 5  # More than 5% change
        
        comparison['overall_assessment'] = {
            'is_improvement': overall_improved,
            'is_significant': significant_change,
            'summary': f"Version {version2} {'is better than' if overall_improved else 'is worse than'} version {version1}." +
                      f" The change is {'significant' if significant_change else 'not significant'}."
        }
        
        return comparison