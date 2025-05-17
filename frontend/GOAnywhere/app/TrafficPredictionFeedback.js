import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import axios from 'axios';
import styles from './TrafficPredictionStyling';

const API_BASE_URL = 'https://goanywhere-backend-541900038032.asia-southeast1.run.app';

const TrafficPredictionFeedback = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const predictionType = route.params?.predictionType ?? '';

  const [userId, setUserId] = useState('');
  const [rating, setRating] = useState(null);
  const [comment, setComment] = useState('');

  const submitFeedback = async () => {
    if (!userId || !rating) {
      Alert.alert('Missing Fields', 'Please provide both User ID and Rating.');
      return;
    }

    const payload = {
      user_id: userId,
      prediction_type: predictionType,
      rating: rating,
      comment: comment || '',
      timestamp: new Date().toISOString()
    };

    try {
      const res = await axios.post(`${API_BASE_URL}/prediction/feedback`, payload);
      if (res.data.status === 'success') {
        Alert.alert('Thank You!', 'Your feedback has been submitted.');
        navigation.goBack();
      } else {
        throw new Error('Failed to submit feedback');
      }
    } catch (error) {
      console.error('Feedback submission failed:', error);
      Alert.alert('Error', 'Could not submit feedback. Please try again later.');
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#121212', padding: 20 }}>
      <Text style={styles.titleText}>Give Feedback</Text>
      <Text style={[styles.inputLabel, { marginTop: 16 }]}>User ID</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter your user ID"
        placeholderTextColor="#999"
        value={userId}
        onChangeText={setUserId}
      />

      <Text style={styles.inputLabel}>Rating (1–5)</Text>
      <View style={styles.inputRow}>
        {[1, 2, 3, 4, 5].map((val) => (
          <TouchableOpacity
            key={val}
            style={[
              styles.inputOption,
              rating === val && styles.inputOptionSelected
            ]}
            onPress={() => setRating(val)}
          >
            <Text style={styles.inputOptionText}>{val}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.inputLabel}>Comments (Optional)</Text>
      <TextInput
        style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
        multiline
        placeholder="Tell us how accurate the prediction was..."
        placeholderTextColor="#999"
        value={comment}
        onChangeText={setComment}
      />

      <TouchableOpacity style={styles.applyButton} onPress={submitFeedback}>
        <Ionicons name="send" size={18} color="#FFF" style={styles.buttonIcon} />
        <Text style={styles.applyButtonText}>Submit Feedback</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()}>
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

export default TrafficPredictionFeedback;
