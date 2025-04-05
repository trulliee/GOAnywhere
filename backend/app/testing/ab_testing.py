# app/testing/ab_testing.py

import os
import logging
import joblib
import json
import random
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from firebase_admin import firestore
import uuid
from scipy import stats

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class ModelABTesting:
    """
    A/B Testing framework for model evaluation and comparison.
    This class allows for:
    1. Serving predictions from multiple model versions
    2. Recording performance metrics for each version
    3. Statistical comparison between model versions
    4. Automatic promotion of better-performing models
    """
    
    def __init__(self, db=None):
        """
        Initialize the A/B testing module.
        
        Args:
            db: Firestore database instance (optional)
        """
        # Use the provided db or the default one from firebase_admin
        self.db = db or firestore.client()
        
        # Initialize collections
        self.experiments_collection = self.db.collection('ab_testing_experiments')
        self.results_collection = self.db.collection('ab_testing_results')
        self.config_collection = self.db.collection('ab_testing_config')
        self.model_versions_collection = self.db.collection('model_versions')
        
        # Load active experiments
        self.active_experiments = self._load_active_experiments()
        self.traffic_allocation = self._load_traffic_allocation()
        
        # Cache for loaded models
        self.model_cache = {}
    
    def _load_active_experiments(self):
        """Load active A/B testing experiments from Firestore."""
        try:
            # Query for active experiments
            query = self.experiments_collection.where('is_active', '==', True)
            results = query.stream()
            
            # Convert to dictionary for easy lookup
            active_experiments = {}
            for doc in results:
                exp = doc.to_dict()
                exp['id'] = doc.id
                active_experiments[doc.id] = exp
            
            logger.info(f"Loaded {len(active_experiments)} active A/B testing experiments")
            return active_experiments
        
        except Exception as e:
            logger.error(f"Error loading active experiments: {e}")
            return {}
    
    def _load_traffic_allocation(self):
        """Load traffic allocation configuration from Firestore."""
        try:
            # Get traffic allocation configuration
            config_doc = self.config_collection.document('traffic_allocation').get()
            
            if config_doc.exists:
                return config_doc.to_dict()
            else:
                # Default traffic allocation
                default_config = {
                    'default_variant_weight': 0.8,  # 80% to default/control model
                    'test_variant_weight': 0.2,     # 20% to test model
                    'last_updated': firestore.SERVER_TIMESTAMP
                }
                
                # Save default config
                self.config_collection.document('traffic_allocation').set(default_config)
                
                return default_config
        
        except Exception as e:
            logger.error(f"Error loading traffic allocation: {e}")
            # Return default values
            return {
                'default_variant_weight': 0.8,
                'test_variant_weight': 0.2
            }
    
    def create_experiment(self, model_type, control_model_path, test_model_path, 
                          description=None, success_metric='accuracy', 
                          traffic_split=None, end_date=None):
        """
        Create a new A/B testing experiment.
        
        Args:
            model_type (str): Type of model (traffic_prediction, travel_time, incident_impact)
            control_model_path (str): Path to the control (default) model
            test_model_path (str): Path to the test model
            description (str, optional): Description of the experiment
            success_metric (str): Metric to use for determining success (accuracy, mae, etc.)
            traffic_split (dict, optional): Custom traffic split configuration
            end_date (datetime, optional): When the experiment should automatically end
            
        Returns:
            str: ID of the created experiment
        """
        try:
            # Validate model paths
            if not os.path.exists(control_model_path):
                raise ValueError(f"Control model not found at {control_model_path}")
            
            if not os.path.exists(test_model_path):
                raise ValueError(f"Test model not found at {test_model_path}")
            
            # Extract model versions from filenames
            control_version = os.path.basename(control_model_path).split('_')[-1].split('.')[0]
            test_version = os.path.basename(test_model_path).split('_')[-1].split('.')[0]
            
            # Create experiment document
            experiment = {
                'model_type': model_type,
                'control_model_path': control_model_path,
                'test_model_path': test_model_path,
                'control_version': control_version,
                'test_version': test_version,
                'description': description or f"A/B test of {model_type} models",
                'success_metric': success_metric,
                'start_date': firestore.SERVER_TIMESTAMP,
                'end_date': end_date,
                'traffic_split': traffic_split or {
                    'control': self.traffic_allocation.get('default_variant_weight', 0.8),
                    'test': self.traffic_allocation.get('test_variant_weight', 0.2)
                },
                'is_active': True,
                'control_metrics': {
                    'predictions': 0,
                    'correct_predictions': 0,
                    'accuracy': 0,
                    'mae': 0,
                    'rmse': 0
                },
                'test_metrics': {
                    'predictions': 0,
                    'correct_predictions': 0,
                    'accuracy': 0,
                    'mae': 0,
                    'rmse': 0
                },
                'significant_difference': False,
                'p_value': None,
                'winner': None,
                'created_at': firestore.SERVER_TIMESTAMP,
                'updated_at': firestore.SERVER_TIMESTAMP
            }
            
            # Add experiment to Firestore
            experiment_ref = self.experiments_collection.document()
            experiment_ref.set(experiment)
            experiment_id = experiment_ref.id
            
            # Log creation
            logger.info(f"Created A/B testing experiment {experiment_id} for {model_type}")
            
            # Update active experiments cache
            experiment['id'] = experiment_id
            self.active_experiments[experiment_id] = experiment
            
            return experiment_id
        
        except Exception as e:
            logger.error(f"Error creating A/B testing experiment: {e}")
            raise
    
    def get_model_for_request(self, model_type, user_id=None, force_variant=None):
        """
        Get the appropriate model to use for a prediction request based on A/B testing rules.
        
        Args:
            model_type (str): Type of model to use
            user_id (str, optional): User ID for consistent assignment
            force_variant (str, optional): Force a specific variant ('control' or 'test')
            
        Returns:
            tuple: (model, experiment_id, variant)
        """
        try:
            # Find active experiments for this model type
            experiments = [exp for exp_id, exp in self.active_experiments.items() 
                          if exp['model_type'] == model_type]
            
            if not experiments:
                # No active experiments, use default model
                default_model_path = f"app/models/{model_type}_model.joblib"
                model = self._load_model(default_model_path)
                return model, None, 'default'
            
            # Use the most recently created experiment
            experiment = sorted(experiments, key=lambda x: x.get('created_at', 0), reverse=True)[0]
            experiment_id = experiment['id']
            
            # Determine which variant to use
            if force_variant:
                variant = force_variant
            elif user_id:
                # Consistently assign users to variants based on hash
                hash_value = hash(user_id + experiment_id) % 100
                if hash_value < experiment['traffic_split']['control'] * 100:
                    variant = 'control'
                else:
                    variant = 'test'
            else:
                # Random assignment based on traffic split
                if random.random() < experiment['traffic_split']['control']:
                    variant = 'control'
                else:
                    variant = 'test'
            
            # Get the appropriate model path based on variant
            if variant == 'control':
                model_path = experiment['control_model_path']
            else:
                model_path = experiment['test_model_path']
            
            # Load and return the model
            model = self._load_model(model_path)
            return model, experiment_id, variant
        
        except Exception as e:
            logger.error(f"Error getting model for A/B testing: {e}")
            # Fallback to default model
            default_model_path = f"app/models/{model_type}_model.joblib"
            model = self._load_model(default_model_path)
            return model, None, 'default'
    
    def record_prediction_result(self, experiment_id, variant, prediction, actual=None, 
                                prediction_time=None, metadata=None):
        """
        Record the result of a prediction for A/B testing analysis.
        
        Args:
            experiment_id (str): ID of the experiment
            variant (str): Variant used for prediction ('control' or 'test')
            prediction: The model's prediction
            actual: The actual value (if available)
            prediction_time (datetime, optional): When the prediction was made
            metadata (dict, optional): Additional metadata about the prediction
            
        Returns:
            str: ID of the recorded result
        """
        if not experiment_id or variant not in ['control', 'test']:
            return None
            
        try:
            # Create result document
            result = {
                'experiment_id': experiment_id,
                'variant': variant,
                'prediction': prediction,
                'actual': actual,
                'prediction_time': prediction_time or firestore.SERVER_TIMESTAMP,
                'metadata': metadata or {},
                'created_at': firestore.SERVER_TIMESTAMP
            }
            
            # Add result to Firestore
            result_ref = self.results_collection.document()
            result_ref.set(result)
            result_id = result_ref.id
            
            # Update experiment metrics if actual value is provided
            if actual is not None:
                self._update_experiment_metrics(experiment_id, variant, prediction, actual)
            
            return result_id
        
        except Exception as e:
            logger.error(f"Error recording prediction result: {e}")
            return None
    
    def update_result_with_actual(self, result_id, actual_value):
        """
        Update a previously recorded prediction with the actual value.
        
        Args:
            result_id (str): ID of the result to update
            actual_value: The actual value for the prediction
            
        Returns:
            bool: True if update was successful, False otherwise
        """
        try:
            # Get the result document
            result_ref = self.results_collection.document(result_id)
            result_doc = result_ref.get()
            
            if not result_doc.exists:
                logger.error(f"Result {result_id} not found")
                return False
            
            result = result_doc.to_dict()
            experiment_id = result.get('experiment_id')
            variant = result.get('variant')
            prediction = result.get('prediction')
            
            # Update the result with the actual value
            result_ref.update({
                'actual': actual_value,
                'updated_at': firestore.SERVER_TIMESTAMP
            })
            
            # Update experiment metrics
            if experiment_id and variant and prediction is not None:
                self._update_experiment_metrics(experiment_id, variant, prediction, actual_value)
            
            return True
        
        except Exception as e:
            logger.error(f"Error updating result with actual value: {e}")
            return False
    
    def _update_experiment_metrics(self, experiment_id, variant, prediction, actual):
        """
        Update metrics for an experiment based on a prediction and actual value.
        
        Args:
            experiment_id (str): ID of the experiment
            variant (str): Variant used for prediction ('control' or 'test')
            prediction: The model's prediction
            actual: The actual value
        """
        try:
            # Get the experiment document
            experiment_ref = self.experiments_collection.document(experiment_id)
            experiment_doc = experiment_ref.get()
            
            if not experiment_doc.exists:
                logger.error(f"Experiment {experiment_id} not found")
                return
            
            experiment = experiment_doc.to_dict()
            metrics_field = f"{variant}_metrics"
            current_metrics = experiment.get(metrics_field, {})
            
            # Update metrics in a transaction to avoid race conditions
            @firestore.transactional
            def update_in_transaction(transaction, ref):
                # Get fresh document in transaction
                exp_snapshot = ref.get(transaction=transaction)
                if not exp_snapshot.exists:
                    return
                
                exp_data = exp_snapshot.to_dict()
                metrics = exp_data.get(metrics_field, {})
                
                # Increment prediction count
                predictions = metrics.get('predictions', 0) + 1
                
                # Calculate accuracy for categorical predictions
                if isinstance(prediction, (str, int)) and isinstance(actual, (str, int)):
                    # For classification tasks
                    correct = 1 if prediction == actual else 0
                    correct_predictions = metrics.get('correct_predictions', 0) + correct
                    accuracy = correct_predictions / predictions if predictions > 0 else 0
                    
                    metrics_update = {
                        f"{metrics_field}.predictions": predictions,
                        f"{metrics_field}.correct_predictions": correct_predictions,
                        f"{metrics_field}.accuracy": accuracy,
                        'updated_at': firestore.SERVER_TIMESTAMP
                    }
                    
                else:
                    # For regression tasks
                    try:
                        # Convert to numeric values if needed
                        num_prediction = float(prediction)
                        num_actual = float(actual)
                        
                        # Calculate error
                        abs_error = abs(num_prediction - num_actual)
                        sq_error = abs_error ** 2
                        
                        # Update MAE
                        old_mae = metrics.get('mae', 0)
                        new_mae = ((old_mae * (predictions - 1)) + abs_error) / predictions if predictions > 0 else abs_error
                        
                        # Update RMSE (keeping track of mean squared error)
                        old_mse = metrics.get('mse', 0)
                        new_mse = ((old_mse * (predictions - 1)) + sq_error) / predictions if predictions > 0 else sq_error
                        new_rmse = np.sqrt(new_mse)
                        
                        metrics_update = {
                            f"{metrics_field}.predictions": predictions,
                            f"{metrics_field}.mae": new_mae,
                            f"{metrics_field}.mse": new_mse,
                            f"{metrics_field}.rmse": new_rmse,
                            'updated_at': firestore.SERVER_TIMESTAMP
                        }
                        
                    except (ValueError, TypeError) as e:
                        # Could not convert to numeric, just update prediction count
                        metrics_update = {
                            f"{metrics_field}.predictions": predictions,
                            'updated_at': firestore.SERVER_TIMESTAMP
                        }
                
                # Update the experiment
                transaction.update(ref, metrics_update)
                
                # Check for significant difference and potentially declare winner
                self._check_for_significant_difference(transaction, ref, exp_data)
                
                return True
            
            # Execute the transaction
            transaction = self.db.transaction()
            update_in_transaction(transaction, experiment_ref)
            
        except Exception as e:
            logger.error(f"Error updating experiment metrics: {e}")
    
    def _check_for_significant_difference(self, transaction, experiment_ref, experiment_data):
        """
        Check if there's a statistically significant difference between variants.
        
        Args:
            transaction: Firestore transaction
            experiment_ref: Reference to the experiment document
            experiment_data: Current experiment data
        """
        try:
            # Get metrics for both variants
            control_metrics = experiment_data.get('control_metrics', {})
            test_metrics = experiment_data.get('test_metrics', {})
            success_metric = experiment_data.get('success_metric', 'accuracy')
            
            # Need minimum sample size for statistical significance
            min_sample_size = 100
            control_samples = control_metrics.get('predictions', 0)
            test_samples = test_metrics.get('predictions', 0)
            
            if control_samples < min_sample_size or test_samples < min_sample_size:
                return  # Not enough data yet
            
            # Get metric values
            if success_metric == 'accuracy':
                # For classification models
                control_value = control_metrics.get('accuracy', 0)
                test_value = test_metrics.get('accuracy', 0)
                
                # Perform z-test for proportions
                control_successes = control_metrics.get('correct_predictions', 0)
                test_successes = test_metrics.get('correct_predictions', 0)
                
                p_value = self._z_test_proportions(
                    control_successes, control_samples,
                    test_successes, test_samples
                )
                
                # Higher is better for accuracy
                if p_value < 0.05:  # Statistically significant
                    winner = 'test' if test_value > control_value else 'control'
                else:
                    winner = None
                
            elif success_metric in ['mae', 'rmse']:
                # For regression models
                control_value = control_metrics.get(success_metric, float('inf'))
                test_value = test_metrics.get(success_metric, float('inf'))
                
                # For these metrics, lower is better
                # We need more detailed data to do a proper t-test
                # This is a simplified approach
                relative_improvement = (control_value - test_value) / control_value if control_value > 0 else 0
                
                # Consider it significant if there's a 10% improvement with sufficient samples
                significant = relative_improvement > 0.1 and min(control_samples, test_samples) >= 500
                p_value = 0.01 if significant else 0.5  # Simplified
                
                if significant:
                    winner = 'test' if test_value < control_value else 'control'
                else:
                    winner = None
            else:
                # Unsupported metric
                return
            
            # Update experiment with results
            update_data = {
                'significant_difference': p_value < 0.05,
                'p_value': p_value,
                'winner': winner
            }
            
            transaction.update(experiment_ref, update_data)
            
            # If the test variant is the winner and the experiment has been running long enough,
            # we could automatically promote it to be the new default model
            if winner == 'test' and experiment_data.get('auto_promote', False):
                self._promote_test_model(experiment_data, transaction=transaction)
                
        except Exception as e:
            logger.error(f"Error checking for significant difference: {e}")
    
    def _z_test_proportions(self, successes1, trials1, successes2, trials2):
        """
        Perform a z-test for the difference between two proportions.
        
        Args:
            successes1 (int): Number of successes in sample 1
            trials1 (int): Number of trials in sample 1
            successes2 (int): Number of successes in sample 2
            trials2 (int): Number of trials in sample 2
            
        Returns:
            float: p-value
        """
        # Calculate proportions
        p1 = successes1 / trials1 if trials1 > 0 else 0
        p2 = successes2 / trials2 if trials2 > 0 else 0
        
        # Calculate pooled proportion
        pooled_p = (successes1 + successes2) / (trials1 + trials2)
        
        # Calculate standard error
        se = np.sqrt(pooled_p * (1 - pooled_p) * (1/trials1 + 1/trials2))
        
        # Calculate z statistic
        if se == 0:
            return 1.0  # No difference
            
        z = (p1 - p2) / se
        
        # Calculate two-tailed p-value
        p_value = 2 * (1 - stats.norm.cdf(abs(z)))
        
        return p_value
    
    def _promote_test_model(self, experiment_data, transaction=None):
        """
        Promote a test model to be the new default model.
        
        Args:
            experiment_data (dict): Experiment data
            transaction (optional): Firestore transaction
        """
        try:
            model_type = experiment_data.get('model_type')
            test_model_path = experiment_data.get('test_model_path')
            test_version = experiment_data.get('test_version')
            
            if not (model_type and test_model_path and test_version):
                logger.error("Missing required data for model promotion")
                return
            
            # New default model path
            default_model_path = f"app/models/{model_type}_model.joblib"
            
            # Copy the test model to the default model path
            try:
                import shutil
                shutil.copy2(test_model_path, default_model_path)
                logger.info(f"Promoted test model to default: {test_model_path} -> {default_model_path}")
                
                # Update model version registry
                version_data = {
                    'model_type': model_type,
                    'version': test_version,
                    'path': default_model_path,
                    'is_default': True,
                    'promoted_from_experiment': experiment_data.get('id'),
                    'promoted_at': firestore.SERVER_TIMESTAMP
                }
                
                # Use the provided transaction or create a new one
                if transaction:
                    transaction.set(self.model_versions_collection.document(test_version), version_data)
                else:
                    self.model_versions_collection.document(test_version).set(version_data)
                
            except Exception as e:
                logger.error(f"Error copying model file: {e}")
        
        except Exception as e:
            logger.error(f"Error promoting test model: {e}")
    
    def end_experiment(self, experiment_id, promote_winner=True):
        """
        End an A/B testing experiment.
        
        Args:
            experiment_id (str): ID of the experiment to end
            promote_winner (bool): Whether to promote the winning model
            
        Returns:
            dict: Final experiment results
        """
        try:
            # Get the experiment document
            experiment_ref = self.experiments_collection.document(experiment_id)
            experiment_doc = experiment_ref.get()
            
            if not experiment_doc.exists:
                logger.error(f"Experiment {experiment_id} not found")
                return None
            
            experiment = experiment_doc.to_dict()
            
            # Mark experiment as inactive
            experiment_ref.update({
                'is_active': False,
                'end_date': firestore.SERVER_TIMESTAMP,
                'updated_at': firestore.SERVER_TIMESTAMP
            })
            
            # Promote winner if requested
            winner = experiment.get('winner')
            if promote_winner and winner == 'test':
                self._promote_test_model(experiment)
            
            # Remove from active experiments
            if experiment_id in self.active_experiments:
                del self.active_experiments[experiment_id]
            
            # Return final results
            return {
                'experiment_id': experiment_id,
                'model_type': experiment.get('model_type'),
                'duration': str(experiment.get('end_date') - experiment.get('start_date')) if experiment.get('end_date') and experiment.get('start_date') else None,
                'control_metrics': experiment.get('control_metrics'),
                'test_metrics': experiment.get('test_metrics'),
                'significant_difference': experiment.get('significant_difference'),
                'p_value': experiment.get('p_value'),
                'winner': winner
            }
        
        except Exception as e:
            logger.error(f"Error ending experiment: {e}")
            return None
    
    def get_active_experiments(self, model_type=None):
        """
        Get a list of active A/B testing experiments.
        
        Args:
            model_type (str, optional): Filter by model type
            
        Returns:
            list: Active experiments
        """
        try:
            # Refresh active experiments
            self.active_experiments = self._load_active_experiments()
            
            # Filter by model type if provided
            if model_type:
                return [exp for exp_id, exp in self.active_experiments.items() 
                       if exp.get('model_type') == model_type]
            else:
                return list(self.active_experiments.values())
        
        except Exception as e:
            logger.error(f"Error getting active experiments: {e}")
            return []
    
    def get_experiment_results(self, experiment_id):
        """
        Get detailed results for an experiment.
        
        Args:
            experiment_id (str): ID of the experiment
            
        Returns:
            dict: Experiment results including detailed metrics
        """
        try:
            # Get the experiment document
            experiment_ref = self.experiments_collection.document(experiment_id)
            experiment_doc = experiment_ref.get()
            
            if not experiment_doc.exists:
                logger.error(f"Experiment {experiment_id} not found")
                return None
            
            experiment = experiment_doc.to_dict()
            
            # Get recent prediction results
            results_query = (self.results_collection
                            .where('experiment_id', '==', experiment_id)
                            .order_by('prediction_time', direction=firestore.Query.DESCENDING)
                            .limit(100))
            results = [doc.to_dict() for doc in results_query.stream()]
            
            # Extract experiment overview
            overview = {
                'experiment_id': experiment_id,
                'model_type': experiment.get('model_type'),
                'description': experiment.get('description'),
                'start_date': experiment.get('start_date'),
                'end_date': experiment.get('end_date'),
                'is_active': experiment.get('is_active', False),
                'traffic_split': experiment.get('traffic_split'),
                'control_metrics': experiment.get('control_metrics'),
                'test_metrics': experiment.get('test_metrics'),
                'significant_difference': experiment.get('significant_difference'),
                'p_value': experiment.get('p_value'),
                'winner': experiment.get('winner')
            }
            
            # Return combined results
            return {
                'overview': overview,
                'recent_predictions': results
            }
        
        except Exception as e:
            logger.error(f"Error getting experiment results: {e}")
            return None
    
    def _load_model(self, model_path):
        """
        Load a model from disk with caching.
        
        Args:
            model_path (str): Path to the model file
            
        Returns:
            object: Loaded model
        """
        try:
            # Check if model is already in cache
            if model_path in self.model_cache:
                return self.model_cache[model_path]['model']
            
            # Load model from disk
            model_data = joblib.load(model_path)
            
            # Could be the model directly or a dictionary with model and preprocessor
            if isinstance(model_data, dict) and 'model' in model_data:
                model = model_data['model']
                # Store in cache with timestamp
                self.model_cache[model_path] = {
                    'model': model,
                    'loaded_at': datetime.now()
                }
                return model
            else:
                # Store in cache with timestamp
                self.model_cache[model_path] = {
                    'model': model_data,
                    'loaded_at': datetime.now()
                }
                return model_data
        
        except Exception as e:
            logger.error(f"Error loading model {model_path}: {e}")
            raise