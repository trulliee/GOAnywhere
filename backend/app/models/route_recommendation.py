# app/models/route_recommendation.py

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import logging
import networkx as nx
from app.data.firestore_dataloader import FirestoreDataLoader

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class RouteRecommendationModel:
    """
    Model for recommending optimal routes based on traffic conditions, 
    travel times, incidents, and user preferences.
    """
    
    def __init__(self):
        """Initialize the route recommendation model."""
        self.data_loader = FirestoreDataLoader()
        self.road_graph = None
        self.expressway_travel_times = {}
        self.last_data_update = None
        self.update_interval = timedelta(minutes=15)
    
    def update_data(self, force=False):
        """
        Update the cached traffic and route data.
        
        Args:
            force (bool): Whether to force update regardless of the last update time
            
        Returns:
            bool: Whether the data was updated
        """
        current_time = datetime.now()
        
        # Check if update is needed
        if not force and self.last_data_update and (current_time - self.last_data_update) < self.update_interval:
            logger.info("Using cached data (updated less than 15 minutes ago)")
            return False
        
        logger.info("Updating route and traffic data")
        
        # Load latest travel time data
        travel_times = self.data_loader.get_travel_times(days=1)
        if not travel_times.empty:
            # Group by expressway and direction for quick lookup
            self.expressway_travel_times = {}
            
            for _, row in travel_times.iterrows():
                expressway = row.get('Expressway')
                direction = row.get('Direction')
                travel_time = row.get('Esttime')
                
                if expressway and direction and travel_time:
                    key = f"{expressway}_{direction}"
                    # Keep the most recent entry for each expressway-direction
                    if key not in self.expressway_travel_times:
                        self.expressway_travel_times[key] = travel_time
            
            logger.info(f"Updated travel times for {len(self.expressway_travel_times)} expressway segments")
        
        # Load traffic incidents
        incidents = self.data_loader.get_incidents(days=1)
        
        # Load traffic speed bands
        speed_bands = self.data_loader.get_traffic_speed_bands(days=1, limit=5000)
        
        # Build road graph if not already built
        if self.road_graph is None:
            self._build_road_graph()
        
        # Update road graph with latest traffic data
        if not speed_bands.empty:
            self._update_graph_weights(speed_bands, incidents)
        
        self.last_data_update = current_time
        logger.info("Route and traffic data successfully updated")
        
        return True
    
    def _build_road_graph(self):
        """Build the road network graph from available data sources."""
        logger.info("Building road network graph")
        
        # Create an empty directed graph
        self.road_graph = nx.DiGraph()
        
        # Load road network data from GCS
        road_network = self.data_loader.get_road_network()
        
        # If no formal road network data is available, we'll build from speed bands
        if road_network is None:
            logger.warning("No road network file found, building from speed bands data")
            
            # Load speed bands data
            speed_bands = self.data_loader.get_traffic_speed_bands(days=7, limit=10000)
            
            if speed_bands.empty:
                logger.error("No speed bands data available to build road graph")
                return
            
            # Extract unique road segments
            segments = []
            
            # Check which columns are available
            location_cols = []
            if all(col in speed_bands.columns for col in ['StartLongitude', 'StartLatitude', 'EndLongitude', 'EndLatitude']):
                location_cols = ['StartLongitude', 'StartLatitude', 'EndLongitude', 'EndLatitude']
            
            if location_cols and 'RoadName' in speed_bands.columns:
                # Group by road name and coordinates to identify segments
                segment_cols = ['RoadName'] + location_cols
                unique_segments = speed_bands[segment_cols].drop_duplicates()
                
                for _, segment in unique_segments.iterrows():
                    road_name = segment['RoadName']
                    
                    # Create nodes for start and end points
                    start_node = f"{road_name}_S_{segment['StartLongitude']:.4f}_{segment['StartLatitude']:.4f}"
                    end_node = f"{road_name}_E_{segment['EndLongitude']:.4f}_{segment['EndLatitude']:.4f}"
                    
                    # Add nodes
                    self.road_graph.add_node(start_node, 
                                            longitude=segment['StartLongitude'], 
                                            latitude=segment['StartLatitude'],
                                            road_name=road_name)
                    
                    self.road_graph.add_node(end_node, 
                                            longitude=segment['EndLongitude'], 
                                            latitude=segment['EndLatitude'],
                                            road_name=road_name)
                    
                    # Calculate segment length (approximate)
                    length = self._calculate_distance(
                        segment['StartLatitude'], segment['StartLongitude'],
                        segment['EndLatitude'], segment['EndLongitude']
                    )
                    
                    # Add an edge from start to end
                    self.road_graph.add_edge(start_node, end_node, 
                                            road_name=road_name,
                                            length=length,
                                            speed_limit=self._get_speed_limit(road_name),
                                            current_speed=65,  # Default value
                                            travel_time=length/65)  # Travel time in hours
                    
                    segments.append({
                        'start_node': start_node,
                        'end_node': end_node,
                        'road_name': road_name,
                        'length': length
                    })
                
                logger.info(f"Built road graph with {self.road_graph.number_of_nodes()} nodes and {self.road_graph.number_of_edges()} edges")
            else:
                logger.error("Speed bands data does not contain required columns for graph building")
        else:
            # Process the KML file to build the road graph
            # This would require parsing the KML - implementation will depend on the KML structure
            logger.info("KML parsing for road network not implemented - using fallback method")
            
            # Fallback to simpler graph from travel times
            travel_times = self.data_loader.get_travel_times(days=7)
            
            if not travel_times.empty:
                # Create nodes for expressway start and end points
                for _, row in travel_times.iterrows():
                    expressway = row.get('Expressway')
                    direction = row.get('Direction')
                    
                    if expressway and direction:
                        # Create simple start/end nodes
                        start_node = f"{expressway}_{direction}_start"
                        end_node = f"{expressway}_{direction}_end"
                        
                        # Add nodes if they don't exist
                        if start_node not in self.road_graph:
                            self.road_graph.add_node(start_node, expressway=expressway)
                        
                        if end_node not in self.road_graph:
                            self.road_graph.add_node(end_node, expressway=expressway)
                        
                        # Add an edge with the travel time
                        travel_time = row.get('Esttime', 30)  # Default to 30 minutes if not available
                        
                        self.road_graph.add_edge(start_node, end_node,
                                                expressway=expressway,
                                                direction=direction,
                                                travel_time=travel_time/60,  # Convert to hours
                                                current_travel_time=travel_time/60)
                
                logger.info(f"Built simple road graph with {self.road_graph.number_of_nodes()} nodes and {self.road_graph.number_of_edges()} edges")
            else:
                logger.error("No travel time data available for fallback graph building")
    
    def _update_graph_weights(self, speed_bands, incidents):
        """
        Update the road graph with current traffic information.
        
        Args:
            speed_bands (pandas.DataFrame): Current speed band data
            incidents (pandas.DataFrame): Current traffic incidents
        """
        if self.road_graph is None or self.road_graph.number_of_edges() == 0:
            logger.error("Road graph not initialized")
            return
        
        # Update edges with current speed information
        if not speed_bands.empty and all(col in speed_bands.columns for col in ['RoadName', 'SpeedBand']):
            updated_count = 0
            
            # Group data by road name for efficiency
            road_speeds = speed_bands.groupby('RoadName')['SpeedBand'].mean().to_dict()
            
            # Map speed bands to actual speeds (km/h)
            speed_band_map = {
                1: 10,   # 0-20 km/h
                2: 30,   # 20-40 km/h
                3: 50,   # 40-60 km/h
                4: 70,   # 60-80 km/h
                5: 90    # >80 km/h
            }
            
            # Update each edge in the graph
            for u, v, data in self.road_graph.edges(data=True):
                road_name = data.get('road_name')
                
                if road_name and road_name in road_speeds:
                    # Get average speed band for this road
                    speed_band = road_speeds[road_name]
                    
                    # Convert to actual speed
                    current_speed = speed_band_map.get(int(round(speed_band)), 50)
                    
                    # Update edge attributes
                    self.road_graph[u][v]['current_speed'] = current_speed
                    
                    # Update travel time based on new speed (length in km, speed in km/h, time in hours)
                    if 'length' in data:
                        length = data['length']
                        self.road_graph[u][v]['current_travel_time'] = length / current_speed
                        updated_count += 1
            
            logger.info(f"Updated speeds for {updated_count} road segments")
        
        # Update for incidents
        if not incidents.empty:
            # Create a set of affected roads
            affected_roads = set()
            
            for _, incident in incidents.iterrows():
                message = incident.get('Message', '')
                
                if isinstance(message, str):
                    # Extract road name from incident message (simple approach)
                    for edge_data in self.road_graph.edges(data=True):
                        road_name = edge_data[2].get('road_name') or edge_data[2].get('expressway')
                        
                        if road_name and road_name in message:
                            u, v = edge_data[0], edge_data[1]
                            affected_roads.add(road_name)
                            
                            # Reduce speed for affected roads
                            current_speed = self.road_graph[u][v].get('current_speed', 50)
                            new_speed = max(current_speed * 0.6, 10)  # Reduce speed by 40%, min 10 km/h
                            self.road_graph[u][v]['current_speed'] = new_speed
                            
                            # Update travel time
                            if 'length' in self.road_graph[u][v]:
                                length = self.road_graph[u][v]['length']
                                self.road_graph[u][v]['current_travel_time'] = length / new_speed
            
            if affected_roads:
                logger.info(f"Applied incident slowdowns to {len(affected_roads)} roads: {', '.join(list(affected_roads)[:5])}")
        
        # Update with the latest travel times from LTA DataMall
        for key, travel_time in self.expressway_travel_times.items():
            try:
                expressway, direction = key.split('_')
                
                # Find all edges that match this expressway and direction
                for u, v, data in self.road_graph.edges(data=True):
                    if data.get('expressway') == expressway and data.get('direction') == direction:
                        # Update travel time (convert minutes to hours)
                        self.road_graph[u][v]['current_travel_time'] = travel_time / 60
            except:
                continue
    
    def _calculate_distance(self, lat1, lon1, lat2, lon2):
        """
        Calculate distance between two points using Haversine formula.
        
        Args:
            lat1, lon1, lat2, lon2: Coordinates of two points
            
        Returns:
            float: Distance in kilometers
        """
        # Approximate radius of earth in km
        R = 6371.0
        
        # Convert to radians
        lat1_rad = np.radians(lat1)
        lon1_rad = np.radians(lon1)
        lat2_rad = np.radians(lat2)
        lon2_rad = np.radians(lon2)
        
        # Haversine formula
        dlon = lon2_rad - lon1_rad
        dlat = lat2_rad - lat1_rad
        
        a = np.sin(dlat / 2)**2 + np.cos(lat1_rad) * np.cos(lat2_rad) * np.sin(dlon / 2)**2
        c = 2 * np.arctan2(np.sqrt(a), np.sqrt(1 - a))
        
        # Distance in km
        distance = R * c
        return distance
    
    def _get_speed_limit(self, road_name):
        """
        Get the default speed limit for a road based on its name.
        
        Args:
            road_name (str): Name of the road
            
        Returns:
            int: Default speed limit in km/h
        """
        # Set default speed limits based on road type
        expressways = ['PIE', 'AYE', 'CTE', 'ECP', 'TPE', 'SLE', 'BKE', 'KJE', 'KPE']
        
        if any(exp in road_name for exp in expressways):
            return 90  # Expressway
        elif 'ROAD' in road_name or 'RD' in road_name:
            return 60  # Major road
        elif 'AVENUE' in road_name or 'AVE' in road_name:
            return 50  # Avenue
        elif 'STREET' in road_name or 'ST' in road_name:
            return 40  # Street
        else:
            return 50  # Default
    
    def find_nearest_node(self, lat, lon):
        """
        Find the nearest node in the road graph to the given coordinates.
        
        Args:
            lat (float): Latitude
            lon (float): Longitude
            
        Returns:
            str: Node ID of the nearest node
        """
        if self.road_graph is None or self.road_graph.number_of_nodes() == 0:
            logger.error("Road graph not initialized")
            return None
        
        # Ensure data is up to date
        self.update_data()
        
        nearest_node = None
        min_distance = float('inf')
        
        for node, data in self.road_graph.nodes(data=True):
            if 'latitude' in data and 'longitude' in data:
                node_lat = data['latitude']
                node_lon = data['longitude']
                
                distance = self._calculate_distance(lat, lon, node_lat, node_lon)
                
                if distance < min_distance:
                    min_distance = distance
                    nearest_node = node
        
        return nearest_node
    
    def recommend_route(self, origin, destination, preferences=None):
        """
        Recommend the optimal route based on current traffic conditions and user preferences.
        
        Args:
            origin (dict): Origin coordinates {'lat': float, 'lon': float}
            destination (dict): Destination coordinates {'lat': float, 'lon': float}
            preferences (dict, optional): User preferences
                - 'avoid_toll': bool - Whether to avoid toll roads
                - 'avoid_expressway': bool - Whether to avoid expressways
                - 'priority': str - 'fastest' (default) or 'shortest'
                
        Returns:
            dict: Recommended route information
        """
        # Ensure data is up to date
        self.update_data()
        
        if self.road_graph is None or self.road_graph.number_of_nodes() == 0:
            return {
                'error': 'Road network data not available',
                'status': 'error'
            }
        
        # Default preferences
        if preferences is None:
            preferences = {
                'avoid_toll': False,
                'avoid_expressway': False,
                'priority': 'fastest'
            }
        
        # Find nearest nodes to origin and destination
        origin_node = self.find_nearest_node(origin.get('lat'), origin.get('lon'))
        destination_node = self.find_nearest_node(destination.get('lat'), destination.get('lon'))
        
        if origin_node is None or destination_node is None:
            return {
                'error': 'Could not match coordinates to road network',
                'status': 'error'
            }
        
        # Apply filters based on preferences
        graph_copy = self.road_graph.copy()
        
        if preferences.get('avoid_toll', False) or preferences.get('avoid_expressway', False):
            edges_to_remove = []
            
            for u, v, data in graph_copy.edges(data=True):
                # Check if edge is on an expressway
                is_expressway = False
                road_name = data.get('road_name') or data.get('expressway')
                
                if road_name:
                    expressways = ['PIE', 'AYE', 'CTE', 'ECP', 'TPE', 'SLE', 'BKE', 'KJE', 'KPE']
                    is_expressway = any(exp in road_name for exp in expressways)
                
                # Remove edge if it meets filter criteria
                if (preferences.get('avoid_toll', False) and 'ERP' in str(data)) or \
                   (preferences.get('avoid_expressway', False) and is_expressway):
                    edges_to_remove.append((u, v))
            
            for edge in edges_to_remove:
                if graph_copy.has_edge(*edge):
                    graph_copy.remove_edge(*edge)
        
        # Check if there's still a path after filtering
        if not nx.has_path(graph_copy, origin_node, destination_node):
            return {
                'error': 'No route available with the given preferences',
                'status': 'error'
            }
        
        # Define weight attribute based on preferences
        weight = 'current_travel_time'  # Default to travel time
        if preferences and preferences.get('priority') == 'shortest':
            weight = 'length'
        
        try:
            # Find the shortest path
            path = nx.shortest_path(graph_copy, origin_node, destination_node, weight=weight)
            
            # Calculate route details
            total_distance = 0
            total_time = 0
            route_steps = []
            
            for i in range(len(path) - 1):
                u, v = path[i], path[i+1]
                edge_data = graph_copy[u][v]
                
                distance = edge_data.get('length', 0)
                time = edge_data.get('current_travel_time', 0) * 60  # Convert to minutes
                road_name = edge_data.get('road_name') or edge_data.get('expressway') or "Unknown Road"
                
                total_distance += distance
                total_time += time
                
                route_steps.append({
                    'road': road_name,
                    'distance': round(distance, 2),
                    'time': round(time, 1)
                })
            
            # Simplify route steps by combining consecutive steps on the same road
            simplified_steps = []
            current_road = None
            current_distance = 0
            current_time = 0
            
            for step in route_steps:
                if step['road'] == current_road:
                    # Combine with previous step
                    current_distance += step['distance']
                    current_time += step['time']
                else:
                    # Add previous combined step if it exists
                    if current_road:
                        simplified_steps.append({
                            'road': current_road,
                            'distance': round(current_distance, 2),
                            'time': round(current_time, 1)
                        })
                    
                    # Start new combined step
                    current_road = step['road']
                    current_distance = step['distance']
                    current_time = step['time']
            
            # Add the last combined step
            if current_road:
                simplified_steps.append({
                    'road': current_road,
                    'distance': round(current_distance, 2),
                    'time': round(current_time, 1)
                })
            
            # Get coordinates for route visualization
            route_coords = []
            for node in path:
                node_data = graph_copy.nodes[node]
                if 'latitude' in node_data and 'longitude' in node_data:
                    route_coords.append({
                        'lat': node_data['latitude'],
                        'lon': node_data['longitude']
                    })
            
            # Check for incidents along the route
            incidents_along_route = []
            incidents = self.data_loader.get_incidents(days=1)
            
            if not incidents.empty:
                for i in range(len(path) - 1):
                    u, v = path[i], path[i+1]
                    edge_data = graph_copy[u][v]
                    road_name = edge_data.get('road_name') or edge_data.get('expressway')
                    
                    if road_name:
                        # Find incidents on this road
                        for _, incident in incidents.iterrows():
                            message = incident.get('Message', '')
                            
                            if isinstance(message, str) and road_name in message:
                                incidents_along_route.append({
                                    'road': road_name,
                                    'message': message,
                                    'type': incident.get('Type', 'Unknown')
                                })
            
            return {
                'status': 'success',
                'total_distance': round(total_distance, 2),
                'total_time': round(total_time, 1),
                'route_steps': simplified_steps,
                'route_coordinates': route_coords if route_coords else None,
                'incidents': incidents_along_route
            }
            
        except nx.NetworkXNoPath:
            return {
                'error': 'No route available between the specified locations',
                'status': 'error'
            }
        except Exception as e:
            logger.error(f"Error finding route: {e}")
            return {
                'error': f'Error finding route: {str(e)}',
                'status': 'error'
            }
    
    def get_alternative_routes(self, origin, destination, count=3, preferences=None):
        """
        Get multiple alternative routes between origin and destination.
        
        Args:
            origin (dict): Origin coordinates {'lat': float, 'lon': float}
            destination (dict): Destination coordinates {'lat': float, 'lon': float}
            count (int): Number of alternative routes to generate
            preferences (dict, optional): User preferences
                
        Returns:
            list: List of route information dictionaries
        """
        # Ensure data is up to date
        self.update_data()
        
        if self.road_graph is None or self.road_graph.number_of_nodes() == 0:
            return [{
                'error': 'Road network data not available',
                'status': 'error'
            }]
        
        # Find the primary route first
        primary_route = self.recommend_route(origin, destination, preferences)
        
        if primary_route.get('status') == 'error':
            return [primary_route]
        
        routes = [primary_route]
        
        # Find nearest nodes to origin and destination
        origin_node = self.find_nearest_node(origin.get('lat'), origin.get('lon'))
        destination_node = self.find_nearest_node(destination.get('lat'), destination.get('lon'))
        
        if origin_node is None or destination_node is None:
            return routes
        
        # Apply filters based on preferences
        graph_copy = self.road_graph.copy()
        
        if preferences and (preferences.get('avoid_toll', False) or preferences.get('avoid_expressway', False)):
            edges_to_remove = []
            
            for u, v, data in graph_copy.edges(data=True):
                # Check if edge is on an expressway
                is_expressway = False
                road_name = data.get('road_name') or data.get('expressway')
                
                if road_name:
                    expressways = ['PIE', 'AYE', 'CTE', 'ECP', 'TPE', 'SLE', 'BKE', 'KJE', 'KPE']
                    is_expressway = any(exp in road_name for exp in expressways)
                
                # Remove edge if it meets filter criteria
                if (preferences.get('avoid_toll', False) and 'ERP' in str(data)) or \
                   (preferences.get('avoid_expressway', False) and is_expressway):
                    edges_to_remove.append((u, v))
            
            for edge in edges_to_remove:
                if graph_copy.has_edge(*edge):
                    graph_copy.remove_edge(*edge)

        # Define weight attribute based on preferences
        weight = 'current_travel_time'  # Default to travel time
        if preferences and preferences.get('priority') == 'shortest':
            weight = 'length'
        
        # For alternative routes, we'll need to modify the graph
        # Strategy: Find primary path, then increase the weights of those edges
        try:
            # Find the primary path
            primary_path = nx.shortest_path(graph_copy, origin_node, destination_node, weight=weight)
            
            # For each additional route
            for i in range(1, count):
                # Create a modified graph with increased weights on the primary path
                mod_graph = graph_copy.copy()
                
                # Increase weights on edges in the primary path to discourage their use
                for j in range(len(primary_path) - 1):
                    u, v = primary_path[j], primary_path[j+1]
                    if mod_graph.has_edge(u, v):
                        # Increase the weight significantly to discourage use
                        mod_graph[u][v][weight] = mod_graph[u][v][weight] * (2 + i)
                
                # Try to find an alternative path
                try:
                    alt_path = nx.shortest_path(mod_graph, origin_node, destination_node, weight=weight)
                    
                    # Check if this path is significantly different
                    if self._path_similarity(primary_path, alt_path) < 0.8:  # Less than 80% similar
                        # Calculate route details
                        total_distance = 0
                        total_time = 0
                        route_steps = []
                        
                        for j in range(len(alt_path) - 1):
                            u, v = alt_path[j], alt_path[j+1]
                            edge_data = graph_copy[u][v]
                            
                            distance = edge_data.get('length', 0)
                            time = edge_data.get('current_travel_time', 0) * 60  # Convert to minutes
                            road_name = edge_data.get('road_name') or edge_data.get('expressway') or "Unknown Road"
                            
                            total_distance += distance
                            total_time += time
                            
                            route_steps.append({
                                'road': road_name,
                                'distance': round(distance, 2),
                                'time': round(time, 1)
                            })
                        
                        # Simplify route steps
                        simplified_steps = []
                        current_road = None
                        current_distance = 0
                        current_time = 0
                        
                        for step in route_steps:
                            if step['road'] == current_road:
                                # Combine with previous step
                                current_distance += step['distance']
                                current_time += step['time']
                            else:
                                # Add previous combined step if it exists
                                if current_road:
                                    simplified_steps.append({
                                        'road': current_road,
                                        'distance': round(current_distance, 2),
                                        'time': round(current_time, 1)
                                    })
                                
                                # Start new combined step
                                current_road = step['road']
                                current_distance = step['distance']
                                current_time = step['time']
                        
                        # Add the last combined step
                        if current_road:
                            simplified_steps.append({
                                'road': current_road,
                                'distance': round(current_distance, 2),
                                'time': round(current_time, 1)
                            })
                        
                        # Get coordinates for route visualization
                        route_coords = []
                        for node in alt_path:
                            node_data = graph_copy.nodes[node]
                            if 'latitude' in node_data and 'longitude' in node_data:
                                route_coords.append({
                                    'lat': node_data['latitude'],
                                    'lon': node_data['longitude']
                                })
                        
                        # Check for incidents along the route
                        incidents_along_route = []
                        incidents = self.data_loader.get_incidents(days=1)
                        
                        if not incidents.empty:
                            for j in range(len(alt_path) - 1):
                                u, v = alt_path[j], alt_path[j+1]
                                edge_data = graph_copy[u][v]
                                road_name = edge_data.get('road_name') or edge_data.get('expressway')
                                
                                if road_name:
                                    # Find incidents on this road
                                    for _, incident in incidents.iterrows():
                                        message = incident.get('Message', '')
                                        
                                        if isinstance(message, str) and road_name in message:
                                            incidents_along_route.append({
                                                'road': road_name,
                                                'message': message,
                                                'type': incident.get('Type', 'Unknown')
                                            })
                        
                        # Create route info
                        route_info = {
                            'status': 'success',
                            'total_distance': round(total_distance, 2),
                            'total_time': round(total_time, 1),
                            'route_steps': simplified_steps,
                            'route_coordinates': route_coords if route_coords else None,
                            'incidents': incidents_along_route,
                            'alt_route_number': i
                        }
                        
                        # Add to routes list
                        routes.append(route_info)
                        
                        # Update primary path for next iteration to ensure diversity
                        primary_path = alt_path
                        
                except nx.NetworkXNoPath:
                    # No alternative path found, break loop
                    logger.info(f"Could not find alternative route {i}")
                    break
                except Exception as e:
                    logger.error(f"Error finding alternative route {i}: {e}")
                    continue
            
        except nx.NetworkXNoPath:
            # No path available, return just the primary route (which may be an error)
            logger.warning("No path available between specified nodes")
            return routes
        except Exception as e:
            logger.error(f"Error generating alternative routes: {e}")
            # Return primary route
            return routes
        
        return routes
    
    def _path_similarity(self, path1, path2):
        """
        Calculate the similarity between two paths.
        
        Args:
            path1, path2: Lists of node IDs representing paths
            
        Returns:
            float: Similarity score between 0 and 1
        """
        # Convert paths to sets for intersection
        set1 = set(path1)
        set2 = set(path2)
        
        # Calculate Jaccard similarity
        intersection = len(set1.intersection(set2))
        union = len(set1.union(set2))
        
        if union == 0:
            return 0
        
        return intersection / union