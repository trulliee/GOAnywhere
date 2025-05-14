import React from 'react';
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
  startJourney,
  formatMinutes,
  isHoliday,
  getDayType
}) => {
  const navigation = useNavigation();
  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity 
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Ionicons name="arrow-back" size={24} color="#FFF" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>TrafficPrediction</Text>
      <View style={{width: 24}} />
    </View>
  );

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
          <View style={styles.mapInfoItem}>
            <Text style={styles.mapInfoLabel}>Distance:</Text>
            <Text style={[styles.mapInfoValue, { color: '#FFF' }]}>{routes[selectedRouteIndex].distance}</Text>
          </View>
          
          <View style={styles.mapInfoItem}>
            <Text style={styles.mapInfoLabel}>Est. Travel Time:</Text>
            <Text style={[styles.mapInfoValue, { color: '#FFF' }]}>{routes[selectedRouteIndex].duration}</Text>
          </View>
        </View>
        
        {routes[selectedRouteIndex].summary && (
          <Text style={[styles.mapInfoValue, { color: '#FFF' }]}>Via: {routes[selectedRouteIndex].summary}</Text>
        )}
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
    routes.length > 0 && selectedRouteIndex !== null && (
      <View style={styles.predictionButtonsContainer}>
        {congestionPrediction || travelTimePrediction ? (
          <TouchableOpacity
            style={styles.resetButton}
            onPress={resetPredictions}
          >
            <Ionicons name="refresh" size={16} color="#FFF" style={styles.buttonIcon} />
            <Text style={styles.buttonText}>Reset Predictions</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.predictionButtonsRow}>
            <TouchableOpacity
              style={[styles.predictionButton, styles.congestionButton]}
              onPress={predictCongestion}
              disabled={isLoading || selectedRouteIndex === null}
            >
              <MaterialIcons name="traffic" size={16} color="#FFF" style={styles.buttonIcon} />
              <Text style={styles.buttonText}>Predict Traffic Congestion</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.predictionButton, styles.timeButton]}
              onPress={predictTravelTime}
              disabled={isLoading || selectedRouteIndex === null}
            >
              <Ionicons name="time" size={16} color="#FFF" style={styles.buttonIcon} />
              <Text style={styles.buttonText}>Predict Travel Time</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.predictionButton, styles.bothButton]}
              onPress={predictBoth}
              disabled={isLoading || selectedRouteIndex === null}
            >
              <MaterialIcons name="all-inclusive" size={16} color="#FFF" style={styles.buttonIcon} />
              <Text style={styles.buttonText}>Predict Both</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    )
  );

  const renderEditableCongestionForm = () => (
    <View style={styles.editFormContainer}>
      <Text style={styles.editFormTitle}>Edit Congestion Prediction Input</Text>
      
      <View style={styles.inputRow}>
        <Text style={styles.inputRowLabel}>Road Type:</Text>
        <TouchableOpacity
          style={[
            styles.inputOption,
            customCongestionInput.road_type === 'normal' && styles.inputOptionSelected
          ]}
          onPress={() => updateCustomCongestionInput('road_type', 'normal')}
        >
          <Text style={styles.inputOptionText}>Normal</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.inputOption,
            customCongestionInput.road_type === 'major' && styles.inputOptionSelected
          ]}
          onPress={() => updateCustomCongestionInput('road_type', 'major')}
        >
          <Text style={styles.inputOptionText}>Major</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.inputOption,
            customCongestionInput.road_type === 'expressway' && styles.inputOptionSelected
          ]}
          onPress={() => updateCustomCongestionInput('road_type', 'expressway')}
        >
          <Text style={styles.inputOptionText}>Expressway</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.inputRow}>
        <Text style={styles.inputRowLabel}>Day Type:</Text>
        <TouchableOpacity
          style={[
            styles.inputOption,
            customCongestionInput.day_type === 'weekday' && styles.inputOptionSelected
          ]}
          onPress={() => updateCustomCongestionInput('day_type', 'weekday')}
        >
          <Text style={styles.inputOptionText}>Weekday</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.inputOption,
            customCongestionInput.day_type === 'weekend' && styles.inputOptionSelected
          ]}
          onPress={() => updateCustomCongestionInput('day_type', 'weekend')}
        >
          <Text style={styles.inputOptionText}>Weekend</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.inputRow}>
        <Text style={styles.inputRowLabel}>Peak Hour:</Text>
        <TouchableOpacity
          style={[
            styles.inputOption,
            customCongestionInput.peak_hour_flag === 0 && styles.inputOptionSelected
          ]}
          onPress={() => updateCustomCongestionInput('peak_hour_flag', 0)}
        >
          <Text style={styles.inputOptionText}>No</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.inputOption,
            customCongestionInput.peak_hour_flag === 1 && styles.inputOptionSelected
          ]}
          onPress={() => updateCustomCongestionInput('peak_hour_flag', 1)}
        >
          <Text style={styles.inputOptionText}>Yes</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.inputRow}>
        <Text style={styles.inputRowLabel}>Holiday:</Text>
        <TouchableOpacity
          style={[
            styles.inputOption,
            customCongestionInput.is_holiday === 0 && styles.inputOptionSelected
          ]}
          onPress={() => updateCustomCongestionInput('is_holiday', 0)}
        >
          <Text style={styles.inputOptionText}>No</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.inputOption,
            customCongestionInput.is_holiday === 1 && styles.inputOptionSelected
          ]}
          onPress={() => updateCustomCongestionInput('is_holiday', 1)}
        >
          <Text style={styles.inputOptionText}>Yes</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.inputRow}>
        <Text style={styles.inputRowLabel}>Recent Incident:</Text>
        <TouchableOpacity
          style={[
            styles.inputOption,
            customCongestionInput.recent_incident_flag === 0 && styles.inputOptionSelected
          ]}
          onPress={() => updateCustomCongestionInput('recent_incident_flag', 0)}
        >
          <Text style={styles.inputOptionText}>No</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.inputOption,
            customCongestionInput.recent_incident_flag === 1 && styles.inputOptionSelected
          ]}
          onPress={() => updateCustomCongestionInput('recent_incident_flag', 1)}
        >
          <Text style={styles.inputOptionText}>Yes</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.inputRow}>
        <Text style={styles.inputRowLabel}>Rain:</Text>
        <TouchableOpacity
          style={[
            styles.inputOption,
            customCongestionInput.rain_flag === 0 && styles.inputOptionSelected
          ]}
          onPress={() => updateCustomCongestionInput('rain_flag', 0)}
        >
          <Text style={styles.inputOptionText}>No</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.inputOption,
            customCongestionInput.rain_flag === 1 && styles.inputOptionSelected
          ]}
          onPress={() => updateCustomCongestionInput('rain_flag', 1)}
        >
          <Text style={styles.inputOptionText}>Yes</Text>
        </TouchableOpacity>
      </View>
      
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
      
      <View style={styles.inputRow}>
        <Text style={styles.inputRowLabel}>Road Type:</Text>
        <TouchableOpacity
          style={[
            styles.inputOption,
            customTravelTimeInput.road_type === 'minor' && styles.inputOptionSelected
          ]}
          onPress={() => updateCustomTravelTimeInput('road_type', 'minor')}
        >
          <Text style={styles.inputOptionText}>Minor</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.inputOption,
            customTravelTimeInput.road_type === 'major' && styles.inputOptionSelected
          ]}
          onPress={() => updateCustomTravelTimeInput('road_type', 'major')}
        >
          <Text style={styles.inputOptionText}>Major</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.inputRow}>
        <Text style={styles.inputRowLabel}>Day Type:</Text>
        <TouchableOpacity
          style={[
            styles.inputOption,
            customTravelTimeInput.day_type === 'weekday' && styles.inputOptionSelected
          ]}
          onPress={() => updateCustomTravelTimeInput('day_type', 'weekday')}
        >
          <Text style={styles.inputOptionText}>Weekday</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.inputOption,
            customTravelTimeInput.day_type === 'weekend' && styles.inputOptionSelected
          ]}
          onPress={() => updateCustomTravelTimeInput('day_type', 'weekend')}
        >
          <Text style={styles.inputOptionText}>Weekend</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.inputRow}>
        <Text style={styles.inputRowLabel}>Peak Hour:</Text>
        <TouchableOpacity
          style={[
            styles.inputOption,
            customTravelTimeInput.peak_hour_flag === 0 && styles.inputOptionSelected
          ]}
          onPress={() => updateCustomTravelTimeInput('peak_hour_flag', 0)}
        >
          <Text style={styles.inputOptionText}>No</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.inputOption,
            customTravelTimeInput.peak_hour_flag === 1 && styles.inputOptionSelected
          ]}
          onPress={() => updateCustomTravelTimeInput('peak_hour_flag', 1)}
        >
          <Text style={styles.inputOptionText}>Yes</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.inputRow}>
        <Text style={styles.inputRowLabel}>Holiday:</Text>
        <TouchableOpacity
          style={[
            styles.inputOption,
            customTravelTimeInput.is_holiday === 0 && styles.inputOptionSelected
          ]}
          onPress={() => updateCustomTravelTimeInput('is_holiday', 0)}
        >
          <Text style={styles.inputOptionText}>No</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.inputOption,
            customTravelTimeInput.is_holiday === 1 && styles.inputOptionSelected
          ]}
          onPress={() => updateCustomTravelTimeInput('is_holiday', 1)}
        >
          <Text style={styles.inputOptionText}>Yes</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.inputRow}>
        <Text style={styles.inputRowLabel}>Recent Incident:</Text>
        <TouchableOpacity
          style={[
            styles.inputOption,
            customTravelTimeInput.recent_incident_flag === 0 && styles.inputOptionSelected
          ]}
          onPress={() => updateCustomTravelTimeInput('recent_incident_flag', 0)}
        >
          <Text style={styles.inputOptionText}>No</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.inputOption,
            customTravelTimeInput.recent_incident_flag === 1 && styles.inputOptionSelected
          ]}
          onPress={() => updateCustomTravelTimeInput('recent_incident_flag', 1)}
        >
          <Text style={styles.inputOptionText}>Yes</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.inputRow}>
        <Text style={styles.inputRowLabel}>Rain:</Text>
        <TouchableOpacity
          style={[
            styles.inputOption,
            customTravelTimeInput.rain_flag === 0 && styles.inputOptionSelected
          ]}
          onPress={() => updateCustomTravelTimeInput('rain_flag', 0)}
        >
          <Text style={styles.inputOptionText}>No</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.inputOption,
            customTravelTimeInput.rain_flag === 1 && styles.inputOptionSelected
          ]}
          onPress={() => updateCustomTravelTimeInput('rain_flag', 1)}
        >
          <Text style={styles.inputOptionText}>Yes</Text>
        </TouchableOpacity>
      </View>
      
      <TouchableOpacity 
        style={styles.applyButton}
        onPress={applyCustomTravelTimeInput}
      >
        <Text style={styles.applyButtonText}>Apply Changes</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.cancelButton}
        onPress={toggleEditTravelTime}
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
            onPress={toggleEditCongestion}
          >
            <Feather name="edit-2" size={20} color="#CCC" />
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
            onPress={toggleEditTravelTime}
          >
            <Feather name="edit-2" size={20} color="#CCC" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.travelTimeResultBox}>
          <View style={styles.timeIconContainer}>
            <Ionicons name="stopwatch" size={32} color="#FFB300" />
            <Text style={styles.timeValue}>
              {Math.round(travelTimePrediction.predictions[0])} min
            </Text>
          </View>
          
          {routes[selectedRouteIndex] && (
            <Text style={styles.timeComparisonText}>
              {Math.round(travelTimePrediction.predictions[0] - (routes[selectedRouteIndex].durationValue / 60))} min {' '}
              {travelTimePrediction.predictions[0] > (routes[selectedRouteIndex].durationValue / 60) 
                ? 'slower' 
                : 'faster'} than navigation estimate
            </Text>
          )}
          
          <View style={styles.timePredictionRange}>
            <Text style={styles.timePredictionRangeTitle}>Prediction Range:</Text>
            <View style={styles.timeRangeValues}>
              <View style={styles.timeRangeValue}>
                <AntDesign name="arrowdown" size={14} color="#4CD964" />
                <Text style={styles.timeRangeMinText}>
                  {Math.round(travelTimePrediction.probabilities[0][0])} min
                </Text>
              </View>
              
              <Text style={styles.timeRangeToText}>to</Text>
              
              <View style={styles.timeRangeValue}>
                <AntDesign name="arrowup" size={14} color="#FF3B30" />
                <Text style={styles.timeRangeMaxText}>
                  {Math.round(travelTimePrediction.probabilities[0][2])} min
                </Text>
              </View>
            </View>
          </View>
          
          <View style={styles.probabilityContainer}>
            <Text style={styles.probabilityTitle}>Travel Time Estimates:</Text>
            <View style={styles.timeEstimatesRow}>
              {travelTimePrediction.classes.map((className, idx) => (
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
                    {Math.round(travelTimePrediction.probabilities[0][idx])} min
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

  const renderStartJourneyButton = () => (
    routes.length > 0 && selectedRouteIndex !== null && !editingCongestion && !editingTravelTime && (
      <TouchableOpacity
        style={styles.startJourneyButton}
        onPress={startJourney}
      >
        <Text style={styles.startJourneyText}>Start Journey!</Text>
      </TouchableOpacity>
    )
  );

  const renderLoadingIndicator = () => (
    isLoading && (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0066FF" />
        <Text style={styles.loadingText}>Processing request...</Text>
      </View>
    )
  );

  return (
    <View style={styles.container}>
      {renderHeader()}
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
      </ScrollView>
      {renderStartJourneyButton()}
      {renderLoadingIndicator()}
    </View>
  );
};

export default TrafficPredictionRendering;