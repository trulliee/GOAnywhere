import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  Image,
  Platform
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons, MaterialIcons, FontAwesome, AntDesign, Feather } from '@expo/vector-icons';
import { Tooltip } from 'react-native-elements';
import { Picker } from '@react-native-picker/picker';
import { Alert } from 'react-native';
import RNPickerSelect from 'react-native-picker-select';
import moment from 'moment';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useNavigation } from '@react-navigation/native';

// Import styles
import styles from './TrafficPredictionStyling';

const TrafficPredictionRendering = ({
  startLocation,
  setStartLocation,
  endLocation,
  setEndLocation,
  isLoading,
  routes,
  selectedRouteIndex,
  congestionPrediction,
  travelTimePrediction,
  selectedDate,
  datePickerVisible,
  currentTemperature,
  currentHumidity,
  predictionLock,
  routeFound,
  routeDistance,
  routeTime,
  routeCount,
  editingCongestion,
  editingTravelTime,
  customCongestionInput,
  customTravelTimeInput,
  findRoute,
  resetPredictions,
  selectRoute,
  handleDateChange,
  toggleDatePicker,
  toggleEditCongestion,
  toggleEditTravelTime,
  updateCustomCongestionInput,
  updateCustomTravelTimeInput,
  applyCustomCongestionInput,
  applyCustomTravelTimeInput,
  predictCongestion,
  predictTravelTime,
  predictBoth,
  bothPredicted,
  startJourney,
  goToFeedback,
  formatMinutes,
  isHoliday,
  getDayType
  }) => {
  
  const navigation = useNavigation();
 
  const renderDateBanner = () => (
    <View style={styles.dateBanner}>
      <Text style={styles.titleText}>Traffic Prediction</Text>
      <Text style={styles.dateSubtitle}>
        Displaying Traffic Prediction for {moment(selectedDate).format('dddd, MMMM D, YYYY')}
      </Text>
      <TouchableOpacity onPress={toggleDatePicker} style={styles.dateSelector}>
        <View style={styles.dateBadgeContainer}>
          <View style={styles.dateBadge}>
            <Text style={styles.dateBadgeText}>
              {isHoliday(selectedDate) ? 'Holiday' : getDayType(selectedDate)}
            </Text>
          </View>
          <Ionicons name="calendar" size={18} color="#CCC" style={styles.calendarIcon} />
        </View>
      </TouchableOpacity>
      
      {datePickerVisible && (
        <Modal
          transparent={true}
          animationType="fade"
          visible={datePickerVisible}
          onRequestClose={toggleDatePicker}
        >
          <TouchableOpacity 
            style={styles.datePickerOverlay}
            onPress={toggleDatePicker}
            activeOpacity={1}
          >
            <View style={styles.datePickerContainer}>
              <Text style={styles.datePickerTitle}>Select Prediction Date</Text>
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleDateChange}
                style={styles.datePicker}
                textColor="#FFF"
                minimumDate={new Date(2024, 0, 1)}
                maximumDate={new Date(2025, 11, 31)}
              />
              {Platform.OS === 'ios' && (
                <TouchableOpacity 
                  style={styles.datePickerDoneButton}
                  onPress={toggleDatePicker}
                >
                  <Text style={styles.datePickerDoneText}>Done</Text>
                </TouchableOpacity>
              )}
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      currentTemperature !== null && currentHumidity !== null && (
        <View style={styles.weatherInfoBanner}>
          <TouchableOpacity onPress={() => Alert.alert('Weather Information', 'Default is to current Singapore weather.')}>
              <Text style={styles.weatherInfoText}>
              🌡 Temp: {Math.round(currentTemperature)}°C   💧 Humidity: {Math.round(currentHumidity)}%
              </Text>
              <Ionicons name="information-circle-outline" size={18} color="#9de3d2" style={{ marginLeft: 8 }} />
          </TouchableOpacity>
        </View>
      )
    </View>
  );

  const renderRouteInput = () => (
    <View style={styles.inputContainer}>
      <Text style={styles.sectionTitle}>Enter Your Route</Text>
      
      <Text style={styles.inputLabel}>Start Location</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter start location"
        placeholderTextColor="#999"
        value={startLocation}
        onChangeText={setStartLocation}
      />
      
      <Text style={styles.inputLabel}>Destination</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter destination"
        placeholderTextColor="#999"
        value={endLocation}
        onChangeText={setEndLocation}
      />
      
      <TouchableOpacity 
        style={styles.findButton}
        onPress={findRoute}
        disabled={isLoading}
      >
        <Text style={styles.buttonText}>Find Route</Text>
      </TouchableOpacity>
    </View>
  );

  const renderRouteFound = () => (
    routeFound && routes.length === 0 && (
      <Modal
        animationType="fade"
        transparent={true}
        visible={routeFound && routes.length === 0}
        onRequestClose={() => {}}
      >
        <View style={styles.centeredModalView}>
          <View style={styles.modalView}>
            <Text style={styles.modalTitle}>Route Found</Text>
            <Text style={styles.modalText}>
              Route from {startLocation.split(',')[0]} to {endLocation.split(',')[0]} found.
            </Text>
            <Text style={styles.modalDetail}>Distance: {routeDistance}</Text>
            <Text style={styles.modalDetail}>Estimated Time of Travel: {routeTime}</Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => {}}
            >
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    )
  );

  const renderRouteMap = () => (
    routes.length > 0 && selectedRouteIndex !== null && (
      <View style={styles.mapContainer}>
        <Text style={styles.sectionTitle}>Route Map Information</Text>
        {routeCount > 0 && (
          <Text style={styles.routeCountText}>{routeCount} routes found</Text>
        )}
        <View style={styles.mapImageContainer}>
          <MapView
            style={styles.mapImage}
            region={{
              latitude: routes[selectedRouteIndex]?.markers?.[0]?.latitude || 1.3521,
              longitude: routes[selectedRouteIndex]?.markers?.[0]?.longitude || 103.8198,
              latitudeDelta: 0.1,
              longitudeDelta: 0.1,
            }}
            scrollEnabled
            zoomEnabled
            rotateEnable
            pitchEnabled
          >
            {routes[selectedRouteIndex]?.polyline && (
              <Polyline
                coordinates={routes[selectedRouteIndex].polyline}
                strokeWidth={4}
                strokeColor="#0066FF"
              />
            )}
            
            {routes[selectedRouteIndex]?.markers?.map((marker, i) => (
              <Marker
                key={i}
                coordinate={marker}
                pinColor={i === 0 ? "green" : "red"}
              />
            ))}
          </MapView>
        </View>
        
        <View style={styles.mapInfoContainer}>
          <Text style={[styles.mapInfoLabel, { color: '#FFF' }]}>
            Distance: {routes[selectedRouteIndex].distance}
          </Text>
          <Text style={[styles.mapInfoLabel, { color: '#FFF' }]}>
            Est. Travel Time: {routes[selectedRouteIndex].duration}
          </Text>
          {routes[selectedRouteIndex].summary && (
            <Text style={[styles.mapInfoValue, { color: '#FFF' }]}>
              Via: {routes[selectedRouteIndex].summary}
            </Text>
          )}
        </View>
      </View>
    )
  );

  const renderRouteTabs = () => (
    routes.length > 0 && (
      <View style={styles.routeTabsContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.routeTabsContent}
        >
          {routes.map((route, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.routeTab,
                selectedRouteIndex === index && styles.selectedRouteTab
              ]}
              onPress={() => selectRoute(index)}
              disabled={predictionLock && selectedRouteIndex !== index}
            >
              <Text style={[
                styles.routeTabText,
                selectedRouteIndex === index && styles.selectedRouteTabText
              ]}>
                Route {index + 1}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    )
  );
  
  const renderPredictionButtons = () => (
    routes.length > 0 && selectedRouteIndex !== null && !congestionPrediction && !travelTimePrediction && (
      <View style={styles.predictionButtonsContainer}>
        <View style={styles.predictionButtonsRow}>
          <TouchableOpacity
            style={[styles.predictionButton, { backgroundColor: '#FFF' }]}
            onPress={predictCongestion}
            disabled={isLoading || selectedRouteIndex === null}
          >
            <MaterialIcons name="traffic" size={16} color="#000" style={styles.buttonIcon} />
            <Text style={styles.congestionButtonText}>Predict Traffic Congestion</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.predictionButton, { backgroundColor: '#FFF' }]}
            onPress={predictTravelTime}
            disabled={isLoading || selectedRouteIndex === null}
          >
            <Ionicons name="time" size={16} color="#000" style={styles.buttonIcon} />
            <Text style={styles.congestionButtonText}>Predict Travel Time</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.predictionButton, { backgroundColor: '#444' }]}
            onPress={predictBoth}
            disabled={isLoading || selectedRouteIndex === null}
          >
            <MaterialIcons name="all-inclusive" size={16} color="#FFF" style={styles.buttonIcon} />
            <Text style={styles.bothButtonText}>Predict Both</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  );

  const renderEditableCongestionForm = () => (
    <View style={styles.editFormContainer}>
        <Text style={styles.editFormTitle}>Edit Congestion Prediction Input</Text>

        {/* Peak Hour Toggle */}
        <View style={styles.inputRow}>
        <Text style={styles.inputRowLabel}>Peak Hour:</Text>
        {[0, 1].map((val) => (
            <TouchableOpacity
            key={`peak_hour_${val}`}
            style={[
                styles.inputOption,
                customCongestionInput.peak_hour_flag === val && styles.inputOptionSelected
            ]}
            onPress={() => updateCustomCongestionInput('peak_hour_flag', val)}
            >
            <Text style={styles.inputOptionText}>{val === 1 ? 'Yes' : 'No'}</Text>
            </TouchableOpacity>
        ))}
        </View>

        {/* Holiday Toggle */}
        <View style={styles.inputRow}>
        <Text style={styles.inputRowLabel}>Holiday:</Text>
        {[0, 1].map((val) => (
            <TouchableOpacity
            key={`holiday_${val}`}
            style={[
                styles.inputOption,
                customCongestionInput.is_holiday === val && styles.inputOptionSelected
            ]}
            onPress={() => updateCustomCongestionInput('is_holiday', val)}
            >
            <Text style={styles.inputOptionText}>{val === 1 ? 'Yes' : 'No'}</Text>
            </TouchableOpacity>
        ))}
        </View>

        {/* Event Count Dropdown (0–5) */}
        <View style={styles.inputRowVertical}>
          <Text style={styles.inputRowLabel}>Nearby Events</Text>
          <TouchableOpacity
            onPress={() =>
              Alert.alert(
                'Nearby Events',
                'Number of relevant traffic-affecting events within the area.'
              )
            }
          >
            <Ionicons name="information-circle-outline" size={16} color="#9de3d2" style={{ marginLeft: 6 }} />
          </TouchableOpacity>
          <RNPickerSelect
            onValueChange={(value) => updateCustomCongestionInput('event_count', value)}
            value={customCongestionInput.event_count}
            items={[0, 1, 2, 3, 4, 5].map((val) => ({
              label: val.toString(),
              value: val
            }))}
            style={{
              inputAndroid: styles.dropdownInput
            }}
            useNativeAndroidPickerStyle={false}
          />
        </View>

        {/* Incident Count Dropdown (0–5) */}
        <View style={styles.inputRowVertical}>
          <Text style={styles.inputRowLabel}>Nearby Incidents</Text>
          <TouchableOpacity
            onPress={() =>
              Alert.alert(
                'Nearby Incidents',
                'Number of relevant traffic-affecting incidents within the area.'
              )
            }
          >
            <Ionicons name="information-circle-outline" size={16} color="#9de3d2" style={{ marginLeft: 6 }} />
          </TouchableOpacity>
          <RNPickerSelect
            onValueChange={(value) => updateCustomCongestionInput('incident_count', value)}
            value={customCongestionInput.incident_count}
            items={[0, 1, 2, 3, 4, 5].map((val) => ({
              label: val.toString(),
              value: val
            }))}
            style={{
              inputAndroid: styles.dropdownInput
            }}
            useNativeAndroidPickerStyle={false}
          />
        </View>

        {/* Max Event Severity (0–3) */}
        <View style={styles.inputRowVertical}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.inputRowLabel}>Biggest Event Nearby</Text>
            <TouchableOpacity
              onPress={() =>
                Alert.alert(
                  'Biggest Event Nearby',
                  'Represents the severity of the most impactful event (e.g., road works or closures) near the selected route. Ranges from 0 (none) to 3 (major disruption).'
                )
              }
            >
              <Ionicons name="information-circle-outline" size={16} color="#9de3d2" style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          </View> {/* ✅ Add this closing tag here */}
          
          <RNPickerSelect
            onValueChange={(value) => updateCustomCongestionInput('max_event_severity', value)}
            value={customCongestionInput.max_event_severity}
            items={[0, 1, 2, 3].map((val) => ({
              label: val.toString(),
              value: val
            }))}
            style={{
              inputAndroid: styles.dropdownInput
            }}
            useNativeAndroidPickerStyle={false}
          />
        </View>

        {/* Sum Event Severity (0–5) */}
        <View style={styles.inputRowVertical}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.inputRowLabel}>Total Event Effect</Text>
            <TouchableOpacity
            onPress={() =>
              Alert.alert(
                'Total Event Effect',
                'Sum of the severity levels for all nearby traffic-related events (e.g., road works, closures). A higher total indicates more disruptions along the route.'
              )
            }
          >
            <Ionicons name="information-circle-outline" size={16} color="#9de3d2" style={{ marginLeft: 6 }} />
          </TouchableOpacity>
          </View>
          <RNPickerSelect
            onValueChange={(value) => updateCustomCongestionInput('sum_event_severity', value)}
            value={customCongestionInput.sum_event_severity}
            items={[0, 1, 2, 3, 4, 5].map((val) => ({
              label: val.toString(),
              value: val
            }))}
            style={{
              inputAndroid: styles.dropdownInput
            }}
            useNativeAndroidPickerStyle={false}
          />
        </View>

        {/* Recent Incident Toggle */}
        <View style={styles.inputRow}>
          <Text style={styles.inputRowLabel}>Recent Incident:</Text>
          {[0, 1].map((val) => (
            <TouchableOpacity
              key={`recent_incident_${val}`}
              style={[
                styles.inputOption,
                customCongestionInput.recent_incident_flag === val && styles.inputOptionSelected
              ]}
              onPress={() => updateCustomCongestionInput('recent_incident_flag', val)}
            >
              <Text style={styles.inputOptionText}>{val === 1 ? 'Yes' : 'No'}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Rain Toggle */}
        <View style={styles.inputRow}>
        <Text style={styles.inputRowLabel}>Rain:</Text>
        {[0, 1].map((val) => (
            <TouchableOpacity
            key={`rain_flag_${val}`}
            style={[
                styles.inputOption,
                customCongestionInput.rain_flag === val && styles.inputOptionSelected
            ]}
            onPress={() => updateCustomCongestionInput('rain_flag', val)}
            >
            <Text style={styles.inputOptionText}>{val === 1 ? 'Yes' : 'No'}</Text>
            </TouchableOpacity>
        ))}
        </View>

        {/* Buttons */}
        <TouchableOpacity 
        style={styles.applyButton}
        onPress={applyCustomCongestionInput}
        >
        <Text style={styles.applyButtonText}>Apply Changes</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.cancelButton}
          onPress={toggleEditCongestion}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
    </View>
  );

  const renderEditableTravelTimeForm = () => (
    <View style={styles.editFormContainer}>
        <Text style={styles.editFormTitle}>Edit Travel Time Prediction Input</Text>

        {/* Peak Hour */}
        <View style={styles.inputRow}>
        <Text style={styles.inputRowLabel}>Peak Hour:</Text>
        {[0, 1].map((val) => (
            <TouchableOpacity
            key={`peak_hour_flag_${val}`}
            style={[
                styles.inputOption,
                customTravelTimeInput.peak_hour_flag === val && styles.inputOptionSelected
            ]}
            onPress={() => updateCustomTravelTimeInput('peak_hour_flag', val)}
            >
            <Text style={styles.inputOptionText}>{val === 1 ? 'Yes' : 'No'}</Text>
            </TouchableOpacity>
        ))}
        </View>

        {/* Holiday */}
        <View style={styles.inputRow}>
        <Text style={styles.inputRowLabel}>Holiday:</Text>
        {[0, 1].map((val) => (
            <TouchableOpacity
            key={`is_holiday_${val}`}
            style={[
                styles.inputOption,
                customTravelTimeInput.is_holiday === val && styles.inputOptionSelected
            ]}
            onPress={() => updateCustomTravelTimeInput('is_holiday', val)}
            >
            <Text style={styles.inputOptionText}>{val === 1 ? 'Yes' : 'No'}</Text>
            </TouchableOpacity>
        ))}
        </View>

        {/* Event Count */}
        <View style={styles.inputRowVertical}>
          <Text style={styles.inputRowLabel}>Nearby Events</Text>
          <TouchableOpacity
            onPress={() =>
              Alert.alert(
                'Nearby Events',
                'Number of relevant traffic-affecting events within the area.'
              )
            }
          >
            <Ionicons name="information-circle-outline" size={16} color="#9de3d2" style={{ marginLeft: 6 }} />
          </TouchableOpacity>
          <RNPickerSelect
            onValueChange={(value) => updateCustomTravelTimeInput('event_count', value)}
            value={customTravelTimeInput.event_count}
            items={[0, 1, 2, 3, 4, 5].map((val) => ({ label: val.toString(), value: val }))}
            style={{
              inputAndroid: styles.dropdownInput
            }}
            useNativeAndroidPickerStyle={false}
          />
        </View>

        {/* Incident Count */}
        <View style={styles.inputRowVertical}>
          <Text style={styles.inputRowLabel}>Nearby Incidents</Text>
          <TouchableOpacity
            onPress={() =>
              Alert.alert(
                'Nearby Incidents',
                'Number of relevant traffic-affecting incidents within the area.'
              )
            }
          >
            <Ionicons name="information-circle-outline" size={16} color="#9de3d2" style={{ marginLeft: 6 }} />
          </TouchableOpacity>
          <RNPickerSelect
            onValueChange={(value) => updateCustomTravelTimeInput('incident_count', value)}
            value={customTravelTimeInput.incident_count}
            items={[0, 1, 2, 3, 4, 5].map((val) => ({ label: val.toString(), value: val }))}
            style={{
              inputAndroid: styles.dropdownInput
            }}
            useNativeAndroidPickerStyle={false}
          />
        </View>

        {/* Max Event Severity */}
        <View style={styles.inputRowVertical}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.inputRowLabel}>Biggest Event Nearby</Text>
            <TouchableOpacity
                onPress={() =>
                  Alert.alert(
                    'Biggest Event Nearby',
                    'This is the severity of the most impactful event nearby. Ranges from 0 (none) to 3 (major).'
                  )
                }
              >
                <Ionicons name="information-circle-outline" size={16} color="#9de3d2" style={{ marginLeft: 6 }} />
              </TouchableOpacity>
          </View>
          <RNPickerSelect
            onValueChange={(value) => updateCustomTravelTimeInput('max_event_severity', value)}
            value={customTravelTimeInput.max_event_severity}
            items={[0, 1, 2, 3].map((val) => ({ label: val.toString(), value: val }))}
            style={{
              inputAndroid: styles.dropdownInput
            }}
            useNativeAndroidPickerStyle={false}
          />
        </View>

        {/* Sum Event Severity */}
        <View style={styles.inputRowVertical}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.inputRowLabel}>Total Event Effect</Text>
            <TouchableOpacity
                onPress={() =>
                  Alert.alert(
                    'Total Event Effect',
                    'Sum of severities for all events nearby. Higher values mean more disruptions.'
                  )
                }
              >
                <Ionicons name="information-circle-outline" size={16} color="#9de3d2" style={{ marginLeft: 6 }} />
              </TouchableOpacity>
          </View>
          <RNPickerSelect
            onValueChange={(value) => updateCustomTravelTimeInput('sum_event_severity', value)}
            value={customTravelTimeInput.sum_event_severity}
            items={[0, 1, 2, 3, 4, 5].map((val) => ({ label: val.toString(), value: val }))}
            style={{
              inputAndroid: styles.dropdownInput
            }}
            useNativeAndroidPickerStyle={false}
          />
        </View>

        {/* Mean Incident Severity */}
        <View style={styles.inputRowVertical}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.inputRowLabel}>Average Incidents Effect</Text>
            <TouchableOpacity
              onPress={() =>
                Alert.alert(
                  'Average Incidents Effect',
                  'The average severity of all nearby incidents. Values ranges from 0 (no impact) to 2.5 (major incients). A higher number indicates more serious disruptions.'
                )
              }
            >
              <Ionicons name="information-circle-outline" size={16} color="#9de3d2" style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          </View>
          <RNPickerSelect
            onValueChange={(value) => updateCustomTravelTimeInput('mean_incident_severity', value)}
            value={customTravelTimeInput.mean_incident_severity}
            items={[0, 0.5, 1.0, 1.5, 2.0, 2.5].map((val) => ({ label: val.toString(), value: val }))}
            style={{
              inputAndroid: styles.dropdownInput
            }}
            useNativeAndroidPickerStyle={false}
          />
        </View>

        {/* Max Incident Severity */}
        <View style={styles.inputRowVertical}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.inputRowLabel}>Worst Incidents Nearby</Text>
            <TouchableOpacity
              onPress={() =>
                Alert.alert(
                  'Worst Incidents Nearby',
                  'The severity level of the most serious incident near the route. Ranges from 0 (no incident) to 3 (critical incident).'
                )
              }
            >
              <Ionicons name="information-circle-outline" size={16} color="#9de3d2" style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          </View>
          <RNPickerSelect
            onValueChange={(value) => updateCustomTravelTimeInput('max_incident_severity', value)}
            value={customTravelTimeInput.max_incident_severity}
            items={[0, 1, 2, 3].map((val) => ({ label: val.toString(), value: val }))}
            style={{
              inputAndroid: styles.dropdownInput
            }}
            useNativeAndroidPickerStyle={false}
          />
        </View>

        {/* Sum Incident Severity */}
        <View style={styles.inputRowVertical}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.inputRowLabel}>Total Incidents Nearby</Text>
            <TouchableOpacity
              onPress={() =>
                Alert.alert(
                  'Total Incidents Nearby',
                  'The combined severity score of all incidents near the route. Higher values indicate more frequent or severe disruptions.'
                )
              }
            >
              <Ionicons name="information-circle-outline" size={16} color="#9de3d2" style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          </View>
          <RNPickerSelect
            onValueChange={(value) => updateCustomTravelTimeInput('sum_incident_severity', value)}
            value={customTravelTimeInput.sum_incident_severity}
            items={[0, 1, 2, 3].map((val) => ({ label: val.toString(), value: val }))}
            style={{
              inputAndroid: styles.dropdownInput
            }}
            useNativeAndroidPickerStyle={false}
          />
        </View>

        {/* Distance */}
        <View style={styles.inputRowVertical}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.inputRowLabel}>Distance</Text>
            <TouchableOpacity
              onPress={() =>
                Alert.alert(
                  'Distance',
                  'The total route length in kilometers based on the selected path between start and destination.'
                )
              }
            >
              <Ionicons name="information-circle-outline" size={16} color="#9de3d2" style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          </View>
          <RNPickerSelect
            onValueChange={(value) => updateCustomTravelTimeInput('distance_km', value)}
            value={customTravelTimeInput.distance_km}
            items={[5, 10, 15, 20, 25, 30, 35].map((val) => ({ label: val.toString(), value: val }))}
            style={{
              inputAndroid: styles.dropdownInput
            }}
            useNativeAndroidPickerStyle={false}
          />
        </View>

        {/* Apply + Cancel Buttons */}
        <TouchableOpacity
        style={styles.applyButton}
        onPress={applyCustomTravelTimeInput}
        >
        <Text style={styles.applyButtonText}>Apply Changes</Text>
        </TouchableOpacity>

        <TouchableOpacity
        style={styles.cancelButton}
        onPress={toggleEditCongestion}
        >
        <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
    </View>
    );


  const renderCongestionPrediction = () => (
    congestionPrediction && !editingCongestion ? (
      <View style={styles.predictionContainer}>
        <View style={styles.predictionTitleRow}>
          <Text style={styles.predictionTitle}>Traffic Congestion Prediction</Text>
          <TouchableOpacity 
            style={styles.editButton}
            onPress={() => {
              if (bothPredicted) {
                Alert.alert('Locked', 'You cannot edit after Predict Both. Please reset.');
              } else {
                toggleEditCongestion();
              }
            }}
            disabled={bothPredicted}
          >
            <Feather name="edit-2" size={20} color={bothPredicted ? '#555' : '#CCC'} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.congestionResultBox}>
          {congestionPrediction.predictions[0].prediction === 1 ? (
            <>
              <View style={styles.congestionIconRow}>
                <FontAwesome name="warning" size={24} color="#FF3B30" />
                <Text style={styles.congestionWarningText}>Congested</Text>
              </View>
              <View style={styles.congestionWarningBox}>
                <Feather name="alert-triangle" size={18} color="#FFD700" />
                <Text style={styles.congestionWarningMessage}>
                  Heavy traffic detected. High probability of congestion on this route.
                </Text>
              </View>
            </>
          ) : (
            <>
              <View style={styles.congestionIconRow}>
                <FontAwesome name="check-circle" size={24} color="#4CD964" />
                <Text style={styles.congestionClearText}>Clear Traffic</Text>
              </View>
              <View style={styles.congestionClearBox}>
                <Ionicons name="information-circle" size={18} color="#4CD964" />
                <Text style={styles.congestionClearMessage}>
                  Traffic is flowing normally on this route.
                </Text>
              </View>
            </>
          )}
          
          <View style={styles.probabilityContainer}>
            <Text style={styles.probabilityTitle}>Probability:</Text>
            <View style={styles.probabilityRow}>
              <View style={styles.probabilityItem}>
                <Text style={styles.probabilityLabel}>Clear Traffic</Text>
                <Text style={styles.probabilityValue}>
                  {Math.round(congestionPrediction.predictions[0].probabilities[0] * 100)}%
                </Text>
              </View>
              <View style={styles.probabilityItem}>
                <Text style={styles.probabilityLabel}>Congested</Text>
                <Text style={[styles.probabilityValue, {color: congestionPrediction.predictions[0].prediction === 1 ? '#FF3B30' : '#CCC'}]}>
                  {Math.round(congestionPrediction.predictions[0].probabilities[1] * 100)}%
                </Text>
              </View>
            </View>
          </View>
          
          <View style={styles.roadInfoRow}>
            <Text style={styles.roadInfoText}>
              Road: {routes[selectedRouteIndex]?.summary || 'Unknown Road'}
            </Text>
          </View>
        </View>
      </View>
    ) : editingCongestion && customCongestionInput ? renderEditableCongestionForm() : null
  );

  const renderTravelTimePrediction = () => (
    travelTimePrediction && !editingTravelTime ? (
      <View style={styles.predictionContainer}>
        <View style={styles.predictionTitleRow}>
          <Text style={styles.predictionTitle}>Travel Time Prediction</Text>
          <TouchableOpacity 
            style={styles.editButton}
            onPress={() => {
              if (bothPredicted) {
                  Alert.alert('Locked', 'You cannot edit after Predict Both. Please reset.');
                } else {
                  toggleEditTravelTime();
                }
              }}
          >
            <Feather name="edit-2" size={20} color={bothPredicted ? '#555' : '#CCC'} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.travelTimeResultBox}>
          <View style={styles.timeIconContainer}>
            <Ionicons name="stopwatch" size={32} color="#FFB300" />
            <Text style={styles.timeValue}>
              {Math.round(travelTimePrediction.predictions[0].prediction)} minutes
            </Text>
          </View>

          {routes[selectedRouteIndex] && (
            <Text style={styles.timeComparisonText}>
              {Math.round(
                travelTimePrediction.predictions[0].prediction -
                (routes[selectedRouteIndex].durationValue / 60)
              )} minutes{' '}
              {travelTimePrediction.predictions[0].prediction >
              (routes[selectedRouteIndex].durationValue / 60)
                ? 'slower'
                : 'faster'}{' '}
              than navigation estimate
            </Text>
          )}

          <View style={styles.timePredictionRange}>
            <Text style={styles.timePredictionRangeTitle}>Prediction Range:</Text>
            <View style={styles.timeRangeValues}>
              <View style={styles.timeRangeValue}>
                <AntDesign name="arrowdown" size={14} color="#4CD964" />
                <Text style={styles.timeRangeMinText}>
                  {Math.round(travelTimePrediction.predictions[0].probabilities[0])} min
                </Text>
              </View>

              <Text style={styles.timeRangeToText}>to</Text>

              <View style={styles.timeRangeValue}>
                <AntDesign name="arrowup" size={14} color="#FF3B30" />
                <Text style={styles.timeRangeMaxText}>
                  {Math.round(travelTimePrediction.predictions[0].probabilities[2])} min
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.probabilityContainer}>
            <Text style={styles.probabilityTitle}>Travel Time Estimates:</Text>
            <View style={styles.timeEstimatesRow}>
              {travelTimePrediction.predictions[0].classes.map((className, idx) => (
                <View key={idx} style={styles.timeEstimateItem}>
                  <Text style={styles.timeEstimateLabel}>
                    {className === 'low_estimate' ? 'Optimistic' :
                    className === 'point_estimate' ? 'Expected' : 'Pessimistic'}
                  </Text>
                  <Text style={[
                    styles.timeEstimateValue,
                    idx === 0 ? styles.optimisticValue : 
                    idx === 2 ? styles.pessimisticValue : {}
                  ]}>
                    {Math.round(travelTimePrediction.predictions[0].probabilities[idx])} min
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.routeDetails}>
            <Text style={styles.routeDetailsText}>
              Route: {startLocation.split(',')[0]} to {endLocation.split(',')[0]}
            </Text>
            <Text style={styles.routeDetailsText}>
              Distance: {routes[selectedRouteIndex]?.distance || 'Unknown'}
            </Text>
          </View>
        </View>
      </View>
    ) : editingTravelTime && customTravelTimeInput ? renderEditableTravelTimeForm() : null
  );

  const renderResetAndFeedbackButtons = () => (
    <View style={styles.predictionButtonsContainer}>
      {/* Reset Predictions Button */}
      <TouchableOpacity
        style={styles.resetButton}
        onPress={resetPredictions}
      >
        <Ionicons name="refresh" size={16} color="#FFF" style={styles.buttonIcon} />
        <Text style={styles.buttonText}>Reset Predictions</Text>
      </TouchableOpacity>

      {/* Give Feedback Button */}
      <TouchableOpacity
        style={[styles.resetButton, { backgroundColor: '#00cfb4', marginTop: 10 }]}
        onPress={goToFeedback}
      >
        <Text style={styles.buttonText}>Give Feedback</Text>
      </TouchableOpacity>
    </View>
  );

  const renderStartJourneyButton = () => (
    routes.length > 0 &&
    selectedRouteIndex !== null &&
    !editingCongestion &&
    !editingTravelTime &&
    (congestionPrediction || travelTimePrediction) && (
      <View style={{ paddingHorizontal: 16 }}>
        <TouchableOpacity
          style={styles.startJourneyButton}
          onPress={startJourney}
        >
          <Text style={styles.startJourneyText}>Start Journey</Text>
        </TouchableOpacity>
      </View>
    )
  );

  const renderLoadingIndicator = () => (
    isLoading && (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#9de3d2" />
        <Text style={styles.loadingText}>Processing request...</Text>
      </View>
    )
  );

    return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {renderDateBanner()}
        {renderRouteInput()}
        {renderRouteFound()}
        {routes.length > 0 && (
          <>
            {renderRouteMap()}
            {renderRouteTabs()}
            {renderPredictionButtons()}
            {renderCongestionPrediction()}
            {renderTravelTimePrediction()}
          </>
        )}
        {(congestionPrediction || travelTimePrediction) && !editingCongestion && !editingTravelTime && renderResetAndFeedbackButtons()}
      </ScrollView>
      {renderStartJourneyButton()}
      {renderLoadingIndicator()}
    </View>
  );
}

export default TrafficPredictionRendering;