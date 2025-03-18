import React, { useState, useEffect, useRef } from 'react';
import { View, TextInput, StyleSheet, FlatList, Text, TouchableOpacity } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

// Import your environment configuration
import ENV from './env';

const LocationAutocomplete = ({ 
  placeholder,
  value,
  onLocationSelect,
  onCoordinatesFound,
  style
}) => {
  const [query, setQuery] = useState(value || '');
  const [predictions, setPredictions] = useState([]);
  const [showPredictions, setShowPredictions] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const timeoutRef = useRef(null);

  // Mapbox configuration
  const MAPBOX_ACCESS_TOKEN = ENV.MAPBOX_ACCESS_TOKEN;
  const MAPBOX_GEOCODING_URL = 'https://api.mapbox.com/geocoding/v5/mapbox.places/';

  // Monitor network connectivity
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected);
    });
    
    return () => unsubscribe();
  }, []);

  // Update query when value changes
  useEffect(() => {
    if (value && value !== query) {
      setQuery(value);
    }
  }, [value]);

  // Fetch place predictions
  useEffect(() => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Validate input and network
    if (!query || query.length < 3 || !isConnected) {
      setPredictions([]);
      setShowPredictions(false);
      return;
    }

    // Debounce API calls
    timeoutRef.current = setTimeout(async () => {
      try {
        const response = await fetch(
          `${MAPBOX_GEOCODING_URL}${encodeURIComponent(query)}.json?` + 
          `access_token=${MAPBOX_ACCESS_TOKEN}&` +
          `country=sg&` +  // Limit to Singapore
          `limit=5`  // Limit to 5 results
        );
        
        const data = await response.json();
        
        if (data.features && data.features.length > 0) {
          const mappedPredictions = data.features.map(feature => ({
            place_id: feature.id,
            description: feature.place_name,
            coordinates: {
              lat: feature.center[1],
              lng: feature.center[0]
            }
          }));
          
          setPredictions(mappedPredictions);
          setShowPredictions(true);
        } else {
          setPredictions([]);
          setShowPredictions(false);
        }
      } catch (error) {
        console.error('Error fetching Mapbox predictions:', error);
        setPredictions([]);
      }
    }, 500);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [query, isConnected]);

  // Handle place selection
  const handleSelectPlace = async (item) => {
    setQuery(item.description);
    setShowPredictions(false);
    
    // Notify parent components
    if (onLocationSelect) {
      onLocationSelect(item.description);
    }
    
    if (item.coordinates && onCoordinatesFound) {
      onCoordinatesFound(item.coordinates);
    }
  };

  // Clear input
  const handleClearInput = () => {
    setQuery('');
    setPredictions([]);
    setShowPredictions(false);
    
    if (onLocationSelect) {
      onLocationSelect('');
    }
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder={placeholder || "Enter location"}
          value={query}
          onChangeText={setQuery}
          onFocus={() => query.length >= 3 && setShowPredictions(true)}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={handleClearInput} style={styles.clearButton}>
            <Text>✕</Text>
          </TouchableOpacity>
        )}
      </View>
      
      {showPredictions && predictions.length > 0 && (
        <FlatList
          data={predictions}
          keyExtractor={(item) => item.place_id}
          style={styles.predictionsList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.predictionItem}
              onPress={() => handleSelectPlace(item)}
            >
              <Text style={styles.predictionText}>{item.description}</Text>
            </TouchableOpacity>
          )}
        />
      )}
      
      {!isConnected && query.length > 0 && (
        <View style={styles.offlineWarning}>
          <Text style={styles.offlineText}>
            No internet connection. Autocomplete is disabled.
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
  },
  input: {
    flex: 1,
    padding: 12,
    fontSize: 16,
  },
  clearButton: {
    padding: 10,
  },
  predictionsList: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    maxHeight: 200,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    zIndex: 10,
  },
  predictionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  predictionText: {
    fontSize: 14,
  },
  offlineWarning: {
    backgroundColor: '#ffebee',
    padding: 8,
    borderRadius: 4,
    marginTop: 8,
  },
  offlineText: {
    color: '#c62828',
    fontSize: 12,
    textAlign: 'center',
  },
});

export default LocationAutocomplete;