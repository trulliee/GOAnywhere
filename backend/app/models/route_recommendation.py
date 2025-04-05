# app/models/route_recommendation.py

import heapq
import numpy as np
from datetime import datetime, timedelta
import logging
import os
import json
import pandas as pd
from app.services.onemap_service import geocode_address

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class RouteRecommendationModel:
    """
    Model to recommend optimal routes based on various factors including
    traffic conditions, incidents, weather, and user preferences.
    Uses graph-based routing with multi-factor weighting.
    """
    
    def __init__(self, 
                 traffic_prediction_model=None, 
                 travel_time_model=None, 
                 incident_impact_model=None,
                 road_network_path=None):
        """
        Initialize the route recommendation model.
        
        Args:
            traffic_prediction_model: Model for predicting traffic conditions
            travel_time_model: Model for estimating travel times
            incident_impact_model: Model for assessing incident impacts
            road_network_path (str, optional): Path to road network data
        """
        self.traffic_prediction_model = traffic_prediction_model
        self.travel_time_model = travel_time_model
        self.incident_impact_model = incident_impact_model
        
        # Load road network data
        self.road_network = None
        self.road_network_path = road_network_path
        if road_network_path and os.path.exists(road_network_path):
            self.load_road_network(road_network_path)
    
    def load_road_network(self, path):
        """
        Load road network data from file.
        
        Args:
            path (str): Path to road network data file (GeoJSON or similar)
        """
        try:
            with open(path, 'r') as f:
                self.road_network = json.load(f)
            
            logger.info(f"Road network loaded from {path}")
            
            # Process the road network into a graph structure
            self._build_road_graph()
        except Exception as e:
            logger.error(f"Error loading road network: {e}")
    
    def _build_road_graph(self):
        """Build a graph representation of the road network."""
        # This method processes the loaded road network data into a graph
        # structure suitable for routing algorithms
        
        self.graph = {}  # node_id -> list of (neighbor_id, edge_attributes)
        
        if not self.road_network:
            logger.warning("No road network data loaded")
            return
        
        # Process road segments into graph edges
        for feature in self.road_network.get('features', []):
            properties = feature.get('properties', {})
            geometry = feature.get('geometry', {})
            
            if geometry.get('type') != 'LineString':
                continue
            
            # Extract nodes (endpoints of the line segment)
            coordinates = geometry.get('coordinates', [])
            if len(coordinates) < 2:
                continue
            
            # Create unique IDs for start and end nodes
            start_node = f"node_{coordinates[0][0]}_{coordinates[0][1]}"
            end_node = f"node_{coordinates[-1][0]}_{coordinates[-1][1]}"
            
            # Extract road attributes
            road_id = properties.get('road_id', '')
            road_name = properties.get('road_name', '')
            road_type = properties.get('road_type', '')
            speed_limit = properties.get('speed_limit', 50)  # Default 50 km/h
            length = properties.get('length_meters', self._calculate_length(coordinates))
            
            # Add to graph (may need to handle one-way roads specifically)
            if start_node not in self.graph:
                self.graph[start_node] = []
            
            if end_node not in self.graph:
                self.graph[end_node] = []
            
            # Add bidirectional edges (assuming roads are bidirectional)
            self.graph[start_node].append({
                'node': end_node,
                'road_id': road_id,
                'road_name': road_name,
                'road_type': road_type,
                'speed_limit': speed_limit,
                'length': length,
                'coordinates': coordinates
            })
            
            self.graph[end_node].append({
                'node': start_node,
                'road_id': road_id,
                'road_name': road_name,
                'road_type': road_type,
                'speed_limit': speed_limit,
                'length': length,
                'coordinates': coordinates[::-1]  # Reverse coordinates for opposite direction
            })
        
        logger.info(f"Road graph built with {len(self.graph)} nodes")
    
    def _calculate_length(self, coordinates):
        """Calculate the length of a LineString in meters."""
        # Simple implementation using Euclidean distance for demo
        # A real implementation would use geospatial calculations
        total_length = 0
        for i in range(len(coordinates) - 1):
            start = coordinates[i]
            end = coordinates[i + 1]
            # Approximate conversion of degree difference to meters for Singapore latitude
            x_diff = (end[0] - start[0]) * 111320 * np.cos(np.radians(start[1]))
            y_diff = (end[1] - start[1]) * 110540
            segment_length = np.sqrt(x_diff**2 + y_diff**2)
            total_length += segment_length
        return total_length
    
    def get_route_recommendations(self, origin, destination, 
                                  departure_time=None, mode='driving',
                                  preferences=None):
        """
        Get recommended routes between origin and destination.
        
        Args:
            origin (str or dict): Origin address or coordinates
            destination (str or dict): Destination address or coordinates
            departure_time (datetime, optional): Departure time. Defaults to current time.
            mode (str): Transport mode ('driving' or 'public_transport')
            preferences (dict, optional): User preferences (avoid_congestion, prefer_fastest, etc.)
            
        Returns:
            dict: Route recommendations including multiple options and metadata
        """
        # Set default departure time to now if not provided
        if departure_time is None:
            departure_time = datetime.now()
        
        # Set default preferences if not provided
        if preferences is None:
            preferences = {
                'avoid_congestion': False,
                'prefer_fastest': True,
                'avoid_incidents': True
            }
        
        # Convert addresses to coordinates if needed
        origin_coords = self._get_coordinates(origin)
        destination_coords = self._get_coordinates(destination)
        
        if not origin_coords or not destination_coords:
            return {"error": "Could not geocode origin or destination"}
        
        # Get current traffic conditions
        traffic_conditions = self._get_current_traffic_conditions()
        
        # Get active incidents
        active_incidents = self._get_active_incidents()
        
        # Get weather conditions
        weather_conditions = self._get_current_weather()
        
        # Get routes based on transport mode
        if mode == 'driving':
            routes = self._get_driving_routes(
                origin_coords, destination_coords, departure_time,
                traffic_conditions, active_incidents, weather_conditions, preferences
            )
        else:  # public_transport
            routes = self._get_public_transport_routes(
                origin_coords, destination_coords, departure_time,
                traffic_conditions, active_incidents, weather_conditions, preferences
            )
        
        # Prepare response with metadata
        result = {
            'origin': origin,
            'destination': destination,
            'departure_time': departure_time.strftime('%Y-%m-%d %H:%M:%S'),
            'mode': mode,
            'preferences': preferences,
            'weather_summary': self._get_weather_summary(weather_conditions),
            'incident_summary': self._get_incident_summary(active_incidents, origin_coords, destination_coords),
            'routes': routes
        }
        
        return result
    
    def _get_coordinates(self, location):
        """
        Convert address to coordinates or validate existing coordinates.
        
        Args:
            location (str or dict): Address string or coordinates dict
            
        Returns:
            dict: Coordinates dictionary with lat, lng fields
        """
        if isinstance(location, dict) and 'latitude' in location and 'longitude' in location:
            # Already coordinates
            return {
                'latitude': location['latitude'],
                'longitude': location['longitude']
            }
        elif isinstance(location, str):
            # Address string, geocode it
            try:
                geocode_result = geocode_address(location)
                if 'error' in geocode_result:
                    logger.error(f"Geocoding error: {geocode_result['error']}")
                    return None
                
                # Extract coordinates from OneMap response
                results = geocode_result.get('results', [])
                if not results:
                    logger.warning(f"No geocoding results found for {location}")
                    return None
                
                # Use first result
                first_result = results[0]
                return {
                    'latitude': float(first_result.get('LATITUDE', 0)),
                    'longitude': float(first_result.get('LONGITUDE', 0)),
                    'address': first_result.get('ADDRESS', location)
                }
            except Exception as e:
                logger.error(f"Error geocoding address {location}: {e}")
                return None
        
        logger.error(f"Unsupported location format: {location}")
        return None
    
    def _get_current_traffic_conditions(self):
        """
        Get current traffic conditions from firestore or prediction model.
        
        Returns:
            dict: Traffic conditions data
        """
        # This is a placeholder - in a real implementation, this would:
        # 1. Check firestore for recent traffic data
        # 2. If not found or not recent enough, use prediction model
        
        # Mock traffic conditions for development
        return {
            'speed_bands': {
                'ECP_EAST': 3.5,  # Higher values = faster traffic
                'ECP_WEST': 2.8,
                'PIE_EAST': 3.2,
                'PIE_WEST': 2.2,
                'CTE_NORTH': 2.5,
                'CTE_SOUTH': 3.0
            },
            'congestion_areas': [
                {'name': 'Orchard Road', 'severity': 'Moderate'},
                {'name': 'Woodlands Causeway', 'severity': 'High'}
            ],
            'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }
    
    def _get_active_incidents(self):
        """
        Get active traffic incidents.
        
        Returns:
            list: Active incidents with location and impact data
        """
        # This is a placeholder - in a real implementation, this would:
        # 1. Query firestore for active traffic incidents
        # 2. Use the incident impact model to assess severity
        
        # Mock incidents for development
        return [
            {
                'id': 'inc-001',
                'type': 'Accident',
                'location': {
                    'latitude': 1.305, 
                    'longitude': 103.832, 
                    'road_name': 'PIE'
                },
                'severity': 'High',
                'impact_radius_meters': 1000,
                'estimated_duration_minutes': 60,
                'timestamp': (datetime.now() - timedelta(minutes=15)).strftime('%Y-%m-%d %H:%M:%S')
            },
            {
                'id': 'inc-002',
                'type': 'RoadWork',
                'location': {
                    'latitude': 1.327, 
                    'longitude': 103.845, 
                    'road_name': 'Orchard Road'
                },
                'severity': 'Moderate',
                'impact_radius_meters': 400,
                'estimated_duration_minutes': 180,
                'timestamp': (datetime.now() - timedelta(hours=2)).strftime('%Y-%m-%d %H:%M:%S')
            }
        ]
    
    def _get_current_weather(self):
        """
        Get current weather conditions.
        
        Returns:
            dict: Weather conditions data
        """
        # This is a placeholder - in a real implementation, this would:
        # 1. Query firestore for recent weather data
        
        # Mock weather for development
        return {
            'temperature': 29.5,
            'humidity': 85,
            'rainfall': 0.0,
            'weather_main': 'Clear',
            'weather_description': 'Clear skies',
            'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }
    
    def _get_driving_routes(self, origin, destination, departure_time,
                          traffic_conditions, incidents, weather, preferences):
        """
        Get recommended driving routes.
        
        Returns:
            list: Multiple route options with metadata
        """
        # In a production system, this would use the road network graph to run
        # multiple routing algorithms with different weightings
        
        # For the prototype, we'll return mock routes
        return [
            {
                'route_id': 'route-1',
                'name': 'Fastest Route',
                'description': 'Via PIE and CTE',
                'traffic_level': 'Moderate',
                'normal_travel_time_minutes': 25,
                'estimated_travel_time_minutes': 32,
                'distance_km': 18.5,
                'incidents_on_route': 1,
                'affected_by_weather': False,
                'segments': [
                    {'name': 'PIE (East)', 'distance_km': 7.2, 'traffic_level': 'Moderate'},
                    {'name': 'CTE (South)', 'distance_km': 5.8, 'traffic_level': 'Good'},
                    {'name': 'Orchard Road', 'distance_km': 3.5, 'traffic_level': 'Heavy'},
                    {'name': 'Somerset Road', 'distance_km': 2.0, 'traffic_level': 'Moderate'}
                ]
            },
            {
                'route_id': 'route-2',
                'name': 'Alternate Route',
                'description': 'Via East Coast Parkway',
                'traffic_level': 'Light',
                'normal_travel_time_minutes': 30,
                'estimated_travel_time_minutes': 35,
                'distance_km': 22.3,
                'incidents_on_route': 0,
                'affected_by_weather': False,
                'segments': [
                    {'name': 'ECP (East)', 'distance_km': 12.5, 'traffic_level': 'Good'},
                    {'name': 'Rochor Road', 'distance_km': 4.8, 'traffic_level': 'Moderate'},
                    {'name': 'Victoria Street', 'distance_km': 5.0, 'traffic_level': 'Moderate'}
                ]
            },
            {
                'route_id': 'route-3',
                'name': 'Least Congestion',
                'description': 'Longer but avoids traffic hotspots',
                'traffic_level': 'Light',
                'normal_travel_time_minutes': 35,
                'estimated_travel_time_minutes': 38,
                'distance_km': 25.7,
                'incidents_on_route': 0,
                'affected_by_weather': False,
                'segments': [
                    {'name': 'Bukit Timah Road', 'distance_km': 8.2, 'traffic_level': 'Light'},
                    {'name': 'Dunearn Road', 'distance_km': 7.5, 'traffic_level': 'Light'},
                    {'name': 'Holland Road', 'distance_km': 6.0, 'traffic_level': 'Moderate'},
                    {'name': 'Queensway', 'distance_km': 4.0, 'traffic_level': 'Light'}
                ]
            }
        ]
    
    def _get_public_transport_routes(self, origin, destination, departure_time,
                                   traffic_conditions, incidents, weather, preferences):
        """
        Get recommended public transport routes.
        
        Returns:
            list: Multiple route options with metadata
        """
        # In a production system, this would query public transit APIs
        # and combine with traffic and incident data
        
        # For the prototype, we'll return mock routes
        return [
            {
                'route_id': 'pt-route-1',
                'name': 'MRT Direct',
                'description': 'Red Line to Green Line',
                'congestion_level': 'Moderate',
                'normal_travel_time_minutes': 40,
                'estimated_travel_time_minutes': 45,
                'distance_km': 16.2,
                'affected_by_incidents': False,
                'affected_by_weather': False,
                'segments': [
                    {'type': 'walk', 'description': 'Walk to Ang Mo Kio Station', 'duration_minutes': 8},
                    {'type': 'mrt', 'line': 'North-South Line', 'from': 'Ang Mo Kio', 'to': 'City Hall', 'duration_minutes': 22, 'congestion': 'Moderate'},
                    {'type': 'mrt', 'line': 'East-West Line', 'from': 'City Hall', 'to': 'Outram Park', 'duration_minutes': 10, 'congestion': 'Light'},
                    {'type': 'walk', 'description': 'Walk to destination', 'duration_minutes': 5}
                ]
            },
            {
                'route_id': 'pt-route-2',
                'name': 'Bus + MRT',
                'description': 'Bus to MRT station, then Green Line',
                'congestion_level': 'Light',
                'normal_travel_time_minutes': 50,
                'estimated_travel_time_minutes': 55,
                'distance_km': 15.8,
                'affected_by_incidents': False,
                'affected_by_weather': True,
                'segments': [
                    {'type': 'walk', 'description': 'Walk to bus stop', 'duration_minutes': 3},
                    {'type': 'bus', 'service': '157', 'from': 'Bishan Road', 'to': 'Toa Payoh Hub', 'duration_minutes': 15, 'congestion': 'Light'},
                    {'type': 'mrt', 'line': 'North-South Line', 'from': 'Toa Payoh', 'to': 'Raffles Place', 'duration_minutes': 18, 'congestion': 'Moderate'},
                    {'type': 'mrt', 'line': 'East-West Line', 'from': 'Raffles Place', 'to': 'Tanjong Pagar', 'duration_minutes': 5, 'congestion': 'Light'},
                    {'type': 'walk', 'description': 'Walk to destination', 'duration_minutes': 8}
                ]
            },
            {
                'route_id': 'pt-route-3',
                'name': 'Express Bus',
                'description': 'Direct express bus service',
                'congestion_level': 'Low',
                'normal_travel_time_minutes': 55,
                'estimated_travel_time_minutes': 65,
                'distance_km': 18.0,
                'affected_by_incidents': True,
                'affected_by_weather': False,
                'segments': [
                    {'type': 'walk', 'description': 'Walk to bus stop', 'duration_minutes': 7},
                    {'type': 'bus', 'service': '190', 'from': 'Choa Chu Kang', 'to': 'Orchard Road', 'duration_minutes': 50, 'congestion': 'Moderate'},
                    {'type': 'walk', 'description': 'Walk to destination', 'duration_minutes': 8}
                ]
            }
        ]
    
    def _get_weather_summary(self, weather):
        """Create a summary of weather impact on travel."""
        impact = "No significant impact"
        
        # Check for rain
        if weather.get('rainfall', 0) > 0:
            if weather.get('rainfall') > 10:
                impact = "Heavy rain may cause significant delays and reduced visibility"
            else:
                impact = "Light rain may cause minor delays"
        
        # Check for other conditions
        if weather.get('weather_main') in ['Thunderstorm', 'Tornado', 'Squall']:
            impact = "Severe weather conditions may cause significant delays and hazards"
        
        return {
            'condition': weather.get('weather_main', 'Unknown'),
            'description': weather.get('weather_description', ''),
            'temperature': weather.get('temperature', 0),
            'rainfall': weather.get('rainfall', 0),
            'impact': impact
        }
    
    def _get_incident_summary(self, incidents, origin, destination):
        """Create a summary of incidents potentially affecting the journey."""
        # Filter incidents that might affect routes between origin and destination
        relevant_incidents = self._filter_relevant_incidents(incidents, origin, destination)
        
        # Count by severity
        severity_counts = {'Low': 0, 'Moderate': 0, 'High': 0, 'Severe': 0}
        for incident in relevant_incidents:
            severity = incident.get('severity', 'Low')
            severity_counts[severity] = severity_counts.get(severity, 0) + 1
        
        # Generate summary text
        summary_text = "No incidents affecting your route"
        if sum(severity_counts.values()) > 0:
            summary_text = f"{sum(severity_counts.values())} incident(s) may affect your journey"
            if severity_counts.get('High', 0) > 0 or severity_counts.get('Severe', 0) > 0:
                summary_text += ", including serious disruptions"
        
        return {
            'count': len(relevant_incidents),
            'severity_counts': severity_counts,
            'summary': summary_text,
            'incidents': relevant_incidents[:3]  # Include first 3 for reference
        }
    
    def _filter_relevant_incidents(self, incidents, origin, destination):
        """Filter incidents that might affect routes between origin and destination."""
        # This is a simplified placeholder - a real implementation would:
        # 1. Calculate potential routes between origin and destination
        # 2. Check which incidents are on or near those routes
        
        # For now, we'll use a simplistic approach of checking if incidents
        # are within a reasonable bounding box containing origin and destination
        relevant_incidents = []
        
        # Create bounding box (with some buffer)
        min_lat = min(origin['latitude'], destination['latitude']) - 0.05
        max_lat = max(origin['latitude'], destination['latitude']) + 0.05
        min_lng = min(origin['longitude'], destination['longitude']) - 0.05
        max_lng = max(origin['longitude'], destination['longitude']) + 0.05
        
        # Filter incidents
        for incident in incidents:
            loc = incident.get('location', {})
            lat = loc.get('latitude', 0)
            lng = loc.get('longitude', 0)
            
            if min_lat <= lat <= max_lat and min_lng <= lng <= max_lng:
                relevant_incidents.append(incident)
        
        return relevant_incidents
    
    def generate_natural_language_recommendation(self, routes, weather, incidents):
        """
        Generate natural language recommendations based on routes and conditions.
        
        Args:
            routes (list): List of route options
            weather (dict): Weather conditions
            incidents (dict): Incident summary
        
        Returns:
            str: Natural language recommendation
        """
        if not routes:
            return "No routes available at this time."
        
        # Find the fastest and least congested routes
        fastest_route = min(routes, key=lambda r: r.get('estimated_travel_time_minutes', float('inf')))
        least_congested = min(routes, key=lambda r: self._congestion_score(r))
        
        # Generate recommendation
        recommendation = f"I recommend taking the {fastest_route['name']} "
        
        # Add reasoning
        if fastest_route == least_congested:
            recommendation += f"which is both the fastest option (estimated {fastest_route['estimated_travel_time_minutes']} minutes) and has the best traffic conditions."
        else:
            recommendation += f"which should take about {fastest_route['estimated_travel_time_minutes']} minutes. "
            
            time_diff = least_congested['estimated_travel_time_minutes'] - fastest_route['estimated_travel_time_minutes']
            if time_diff < 10:  # If time difference is small
                recommendation += f"Alternatively, the {least_congested['name']} has better traffic conditions and would only add {time_diff} minutes to your journey."
        
        # Add weather information if relevant
        if weather.get('rainfall', 0) > 0:
            recommendation += f" Note that {weather.get('weather_description', 'rain')} may affect travel conditions."
        
        # Add incident information if relevant
        if incidents.get('count', 0) > 0:
            recommendation += f" Be aware that there are {incidents.get('count')} reported incident(s) that might affect your journey."
        
        return recommendation
    
    def _congestion_score(self, route):
        """Calculate a congestion score for a route (lower is better)."""
        if 'traffic_level' in route:
            # For driving routes
            traffic_map = {'Light': 1, 'Moderate': 2, 'Heavy': 3, 'Severe': 4}
            return traffic_map.get(route['traffic_level'], 2)
        elif 'congestion_level' in route:
            # For public transport routes
            congestion_map = {'Low': 1, 'Moderate': 2, 'High': 3}
            return congestion_map.get(route['congestion_level'], 2)
        else:
            return 2  # Default score