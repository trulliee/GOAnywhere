#!/usr/bin/env python
# scripts/manage_ab_tests.py

import argparse
import sys
import os
import logging
import json
from datetime import datetime, timedelta
import firebase_admin
from firebase_admin import credentials

# Add the parent directory to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import A/B testing module
from app.testing.ab_testing import ModelABTesting

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def init_firebase():
    """Initialize Firebase if not already initialized."""
    try:
        firebase_admin.get_app()
    except ValueError:
        # Load service account key
        cred = credentials.Certificate("service-account-key.json")
        firebase_admin.initialize_app(cred)

def create_experiment(args):
    """Create a new A/B testing experiment."""
    # Initialize Firebase
    init_firebase()
    
    # Create A/B testing instance
    ab_testing = ModelABTesting()
    
    # Parse end date if provided
    end_date = None
    if args.duration:
        end_date = datetime.now() + timedelta(days=args.duration)
    
    # Parse traffic split if provided
    traffic_split = None
    if args.traffic_split:
        parts = args.traffic_split.split(':')
        if len(parts) == 2:
            try:
                control = float(parts[0])
                test = float(parts[1])
                if control + test == 1.0:
                    traffic_split = {'control': control, 'test': test}
                else:
                    logger.error("Traffic split must sum to 1.0")
                    return
            except ValueError:
                logger.error("Invalid traffic split format. Use format '0.8:0.2'")
                return
    
    # Create experiment
    experiment_id = ab_testing.create_experiment(
        model_type=args.model_type,
        control_model_path=args.control_model,
        test_model_path=args.test_model,
        description=args.description,
        success_metric=args.success_metric,
        traffic_split=traffic_split,
        end_date=end_date
    )
    
    print(f"Created experiment {experiment_id}")
    
    return experiment_id

def list_experiments(args):
    """List active A/B testing experiments."""
    # Initialize Firebase
    init_firebase()
    
    # Create A/B testing instance
    ab_testing = ModelABTesting()
    
    # Get active experiments
    experiments = ab_testing.get_active_experiments(model_type=args.model_type)
    
    if not experiments:
        print("No active experiments found.")
        return
    
    # Display experiments
    print(f"Active Experiments ({len(experiments)}):")
    print("-" * 80)
    
    for exp in experiments:
        exp_id = exp.get('id', 'unknown')
        model_type = exp.get('model_type', 'unknown')
        description = exp.get('description', '')
        start_date = exp.get('start_date')
        
        if hasattr(start_date, 'strftime'):
            start_date_str = start_date.strftime('%Y-%m-%d %H:%M:%S')
        else:
            start_date_str = str(start_date)
        
        control_predictions = exp.get('control_metrics', {}).get('predictions', 0)
        test_predictions = exp.get('test_metrics', {}).get('predictions', 0)
        
        print(f"ID: {exp_id}")
        print(f"Model Type: {model_type}")
        print(f"Description: {description}")
        print(f"Started: {start_date_str}")
        print(f"Control Predictions: {control_predictions}")
        print(f"Test Predictions: {test_predictions}")
        
        # Show winner if exists
        winner = exp.get('winner')
        if winner:
            print(f"Winner: {winner}")
        
        print("-" * 80)

def show_experiment(args):
    """Show detailed information about an experiment."""
    # Initialize Firebase
    init_firebase()
    
    # Create A/B testing instance
    ab_testing = ModelABTesting()
    
    # Get experiment results
    results = ab_testing.get_experiment_results(args.experiment_id)
    
    if not results:
        print(f"Experiment {args.experiment_id} not found.")
        return
    
    # Display experiment details
    overview = results.get('overview', {})
    
    print("Experiment Details:")
    print("-" * 80)
    print(f"ID: {overview.get('experiment_id')}")
    print(f"Model Type: {overview.get('model_type')}")
    print(f"Description: {overview.get('description')}")
    
    start_date = overview.get('start_date')
    if hasattr(start_date, 'strftime'):
        print(f"Started: {start_date.strftime('%Y-%m-%d %H:%M:%S')}")
    else:
        print(f"Started: {start_date}")
    
    end_date = overview.get('end_date')
    if end_date:
        if hasattr(end_date, 'strftime'):
            print(f"Ended: {end_date.strftime('%Y-%m-%d %H:%M:%S')}")
        else:
            print(f"Ended: {end_date}")
    
    print(f"Is Active: {overview.get('is_active', False)}")
    print(f"Traffic Split: Control {overview.get('traffic_split', {}).get('control', 0)*100:.1f}% / Test {overview.get('traffic_split', {}).get('test', 0)*100:.1f}%")
    
    print("\nMetrics:")
    print("-" * 80)
    
    control_metrics = overview.get('control_metrics', {})
    test_metrics = overview.get('test_metrics', {})
    
    print("Control Variant:")
    print(f"  Predictions: {control_metrics.get('predictions', 0)}")
    
    # Display appropriate metrics based on what's available
    if 'accuracy' in control_metrics:
        print(f"  Accuracy: {control_metrics.get('accuracy', 0)*100:.2f}%")
    if 'mae' in control_metrics:
        print(f"  MAE: {control_metrics.get('mae', 0):.4f}")
    if 'rmse' in control_metrics:
        print(f"  RMSE: {control_metrics.get('rmse', 0):.4f}")
    
    print("\nTest Variant:")
    print(f"  Predictions: {test_metrics.get('predictions', 0)}")
    
    # Display appropriate metrics based on what's available
    if 'accuracy' in test_metrics:
        print(f"  Accuracy: {test_metrics.get('accuracy', 0)*100:.2f}%")
    if 'mae' in test_metrics:
        print(f"  MAE: {test_metrics.get('mae', 0):.4f}")
    if 'rmse' in test_metrics:
        print(f"  RMSE: {test_metrics.get('rmse', 0):.4f}")
    
    print("\nResults:")
    print("-" * 80)
    print(f"Significant Difference: {overview.get('significant_difference', False)}")
    
    if overview.get('p_value') is not None:
        print(f"P-Value: {overview.get('p_value'):.4f}")
    
    winner = overview.get('winner')
    if winner:
        print(f"Winner: {winner}")
    else:
        print("No winner determined yet")
    
    # Show recent predictions if available
    recent_predictions = results.get('recent_predictions', [])
    if recent_predictions and args.show_predictions:
        print("\nRecent Predictions:")
        print("-" * 80)
        for i, pred in enumerate(recent_predictions[:10]):  # Show at most 10
            variant = pred.get('variant', '')
            prediction = pred.get('prediction', '')
            actual = pred.get('actual', 'N/A')
            
            print(f"{i+1}. Variant: {variant.upper()}, Prediction: {prediction}, Actual: {actual}")

def end_experiment(args):
    """End an A/B testing experiment."""
    # Initialize Firebase
    init_firebase()
    
    # Create A/B testing instance
    ab_testing = ModelABTesting()
    
    # End experiment
    results = ab_testing.end_experiment(
        experiment_id=args.experiment_id,
        promote_winner=not args.no_promote
    )
    
    if not results:
        print(f"Failed to end experiment {args.experiment_id}")
        return
    
    print(f"Ended experiment {args.experiment_id}")
    print("-" * 80)
    
    # Display final results
    print("Final Results:")
    print(f"Duration: {results.get('duration')}")
    
    control_metrics = results.get('control_metrics', {})
    test_metrics = results.get('test_metrics', {})
    
    print(f"Control Predictions: {control_metrics.get('predictions', 0)}")
    print(f"Test Predictions: {test_metrics.get('predictions', 0)}")
    
    # Display appropriate metrics based on what's available
    if 'accuracy' in control_metrics and 'accuracy' in test_metrics:
        print(f"Control Accuracy: {control_metrics.get('accuracy', 0)*100:.2f}%")
        print(f"Test Accuracy: {test_metrics.get('accuracy', 0)*100:.2f}%")
    if 'mae' in control_metrics and 'mae' in test_metrics:
        print(f"Control MAE: {control_metrics.get('mae', 0):.4f}")
        print(f"Test MAE: {test_metrics.get('mae', 0):.4f}")
    if 'rmse' in control_metrics and 'rmse' in test_metrics:
        print(f"Control RMSE: {control_metrics.get('rmse', 0):.4f}")
        print(f"Test RMSE: {test_metrics.get('rmse', 0):.4f}")
    
    print(f"Significant Difference: {results.get('significant_difference', False)}")
    
    if results.get('p_value') is not None:
        print(f"P-Value: {results.get('p_value'):.4f}")
    
    winner = results.get('winner')
    if winner:
        print(f"Winner: {winner}")
        if winner == 'test' and not args.no_promote:
            print("Test model promoted to default")
    else:
        print("No winner determined")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="A/B Testing Management Tool")
    subparsers = parser.add_subparsers(dest="command", help="Command to run")
    
    # Create experiment command
    create_parser = subparsers.add_parser("create", help="Create a new A/B testing experiment")
    create_parser.add_argument("--model-type", required=True, choices=["traffic_prediction", "travel_time", "incident_impact"],
                              help="Type of model to test")
    create_parser.add_argument("--control-model", required=True, 
                              help="Path to the control model file")
    create_parser.add_argument("--test-model", required=True,
                              help="Path to the test model file")
    create_parser.add_argument("--description", default=None,
                              help="Description of the experiment")
    create_parser.add_argument("--success-metric", default="accuracy", 
                              choices=["accuracy", "mae", "rmse"],
                              help="Metric to use for determining success")
    create_parser.add_argument("--traffic-split", default=None,
                              help="Traffic split between control and test (format: '0.8:0.2')")
    create_parser.add_argument("--duration", type=int, default=None,
                              help="Duration of the experiment in days")
    
    # List experiments command
    list_parser = subparsers.add_parser("list", help="List active A/B testing experiments")
    list_parser.add_argument("--model-type", default=None, 
                           choices=["traffic_prediction", "travel_time", "incident_impact"],
                           help="Filter by model type")
    
    # Show experiment command
    show_parser = subparsers.add_parser("show", help="Show details of an experiment")
    show_parser.add_argument("experiment_id", help="ID of the experiment to show")
    show_parser.add_argument("--show-predictions", action="store_true",
                            help="Show recent predictions")
    
    # End experiment command
    end_parser = subparsers.add_parser("end", help="End an A/B testing experiment")
    end_parser.add_argument("experiment_id", help="ID of the experiment to end")
    end_parser.add_argument("--no-promote", action="store_true",
                          help="Don't promote the winning model")
    
    args = parser.parse_args()
    
    # Execute the appropriate command
    if args.command == "create":
        create_experiment(args)
    elif args.command == "list":
        list_experiments(args)
    elif args.command == "show":
        show_experiment(args)
    elif args.command == "end":
        end_experiment(args)
    else:
        parser.print_help()