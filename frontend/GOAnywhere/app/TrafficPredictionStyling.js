import { StyleSheet, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

export default StyleSheet.create({
  // Main container
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  scrollContainer: {
    paddingBottom: 90,
  },
  
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#222',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 40, // Additional padding for status bar
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  
  // Date banner
  dateBanner: {
    backgroundColor: '#222',
    padding: 16,
    paddingTop: 8,
  },
  titleText: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  dateSubtitle: {
    color: '#CCC',
    fontSize: 14,
    marginBottom: 8,
  },
  dateSelector: {
    flexDirection: 'column',
  },
  dateText: {
    color: '#CCC',
    fontSize: 14,
  },
  dateBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  dateBadge: {
    backgroundColor: '#444',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
  },
  dateBadgeText: {
    color: '#CCC',
    fontSize: 12,
  },
  calendarIcon: {
    marginLeft: 4,
  },
  
  // Date picker modal
  datePickerOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  datePickerContainer: {
    backgroundColor: '#333',
    width: width * 0.8,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  datePickerTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  datePicker: {
    width: '100%',
    height: 200,
  },
  datePickerDoneButton: {
    backgroundColor: '#0066FF',
    paddingVertical: 10,
    paddingHorizontal: 30,
    borderRadius: 8,
    marginTop: 20,
  },
  datePickerDoneText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Input section
  inputContainer: {
    backgroundColor: '#2A2A2A',
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  inputLabel: {
    color: '#CCC',
    fontSize: 14,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#3A3A3A',
    color: '#FFF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 16,
  },
  findButton: {
    backgroundColor: '#00cfb4',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Route Map
  mapContainer: {
    backgroundColor: '#2A2A2A',
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  routeCountText: {
    color: '#CCC',
    fontSize: 14,
    marginBottom: 12,
  },
  mapImageContainer: {
    width: '100%',
    height: 200,
    backgroundColor: '#333',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 12,
  },
  mapImage: {
    width: '100%',
    height: '100%',
  },
  mapDistanceText: {
    color: '#CCC',
    fontSize: 14,
    marginBottom: 4,
  },
  mapTimeText: {
    color: '#CCC',
    fontSize: 14,
    marginBottom: 4,
  },
  mapRouteText: {
    color: '#CCC',
    fontSize: 14,
  },
  
  // Route tabs
  routeTabsContainer: {
    marginHorizontal: 16,
    marginVertical: 8,
  },
  routeTabsContent: {
    paddingVertical: 8,
  },
  routeTab: {
    backgroundColor: '#3A3A3A',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    marginRight: 10,
  },
  selectedRouteTab: {
    backgroundColor: '#00e7c8',
  },
  routeTabText: {
    color: '#CCC',
    fontSize: 14,
    fontWeight: '500',
  },
  selectedRouteTabText: {
    color: '#FFF',
    fontWeight: '600',
  },

  dropdownInput: {
  color: '#FFF',
  backgroundColor: '#2a2a2a',
  paddingVertical: 10,
  paddingHorizontal: 12,
  borderRadius: 8,
  borderWidth: 1,
  borderColor: '#555',
  fontSize: 16,
  marginTop: 6,
  marginBottom: 12,
  textAlign: 'center', // optional
  },

  dropdownContainer: {
  marginTop: 4,
  marginBottom: 12,
  },


  dropdown: {
    color: '#FFF',
    backgroundColor: '#2a2a2a',
    height: 42,
    paddingHorizontal: 8,
    borderRadius: 8,
  },

  
  // Prediction buttons
  predictionButtonsContainer: {
    marginHorizontal: 16,
    marginVertical: 16,
  },
  predictionButtonsRow: {
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  predictionButton: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    flexDirection: 'row',
  },
  congestionButton: {
    backgroundColor: '#FFF', // white background
  },

  timeButton: {
    backgroundColor: '#FFF', // white background
  },

  bothButton: {
    backgroundColor: '#555', // grey background
  },

  congestionButtonText: {
    color: '#000', // Black text for white button
    fontSize: 16,
    fontWeight: '600',
  },

  timeButtonText: {
    color: '#FFF', // White text for turquoise button
    fontSize: 16,
    fontWeight: '600',
  },

  bothButtonText: {
    color: '#FFF', // White text for dark grey button
    fontSize: 16,
    fontWeight: '600',
  },

  resetButton: {
    backgroundColor: '#555',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  buttonIcon: {
    marginRight: 8,
  },
  
  // Prediction containers
  predictionContainer: {
    backgroundColor: '#2A2A2A',
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  predictionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  predictionTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  editButton: {
    padding: 6,
  },
  
  // Congestion prediction
  congestionResultBox: {
    backgroundColor: '#333',
    borderRadius: 12,
    padding: 16,
  },
  congestionIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  congestionWarningText: {
    color: '#FF3B30',
    fontSize: 24,
    fontWeight: 'bold',
    marginLeft: 12,
  },
  congestionClearText: {
    color: '#4CD964',
    fontSize: 24,
    fontWeight: 'bold',
    marginLeft: 12,
  },
  congestionWarningBox: {
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  congestionWarningMessage: {
    color: '#FFD700',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  congestionClearBox: {
    backgroundColor: 'rgba(76, 217, 100, 0.15)',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  congestionClearMessage: {
    color: '#4CD964',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  roadInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roadInfoText: {
    color: '#CCC',
    fontSize: 14,
  },
  
  // Probability display
  probabilityContainer: {
    marginBottom: 16,
  },
  probabilityTitle: {
    color: '#CCC',
    fontSize: 14,
    marginBottom: 8,
  },
  probabilityRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#444',
    borderRadius: 8,
    padding: 12,
  },
  probabilityItem: {
    alignItems: 'center',
  },
  probabilityLabel: {
    color: '#CCC',
    fontSize: 12,
    marginBottom: 4,
  },
  probabilityValue: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  
  // Travel time prediction
  travelTimeResultBox: {
    backgroundColor: '#333',
    borderRadius: 12,
    padding: 16,
  },
  timeIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  timeValue: {
    color: '#FFB300',
    fontSize: 32,
    fontWeight: 'bold',
    marginLeft: 12,
  },
  timeComparisonText: {
    color: '#CCC',
    fontSize: 14,
    marginBottom: 16,
  },
  timePredictionRange: {
    marginBottom: 16,
  },
  timePredictionRangeTitle: {
    color: '#CCC',
    fontSize: 14,
    marginBottom: 8,
  },
  timeRangeValues: {
    backgroundColor: '#444',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeRangeValue: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeRangeMinText: {
    color: '#4CD964',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  timeRangeToText: {
    color: '#CCC',
    fontSize: 14,
  },
  timeRangeMaxText: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  
  // Time estimates
  timeEstimatesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#444',
    borderRadius: 8,
    padding: 12,
  },
  timeEstimateItem: {
    alignItems: 'center',
  },
  timeEstimateLabel: {
    color: '#CCC',
    fontSize: 12,
    marginBottom: 4,
  },
  timeEstimateValue: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  optimisticValue: {
    color: '#4CD964',
  },
  pessimisticValue: {
    color: '#FF3B30',
  },
  
  routeDetails: {
    marginTop: 16,
  },
  routeDetailsText: {
    color: '#CCC',
    fontSize: 14,
    marginBottom: 4,
  },
  
  // Edit form
  editFormContainer: {
    backgroundColor: '#2A2A2A',
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  editFormTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginBottom: 16,
  },
  inputRowLabel: {
    color: '#CCC',
    fontSize: 14,
    width: 100,
  },
  inputOption: {
    backgroundColor: '#444',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  inputOptionSelected: {
    backgroundColor: '#0066FF',
  },
  inputOptionText: {
    color: '#FFF',
    fontSize: 14,
  },
  applyButton: {
    backgroundColor: '#4CD964',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  applyButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: '#666',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  cancelButtonText: {
    color: '#FFF',
    fontSize: 14,
  },
  
  // Start journey button
  startJourneyButton: {
    backgroundColor: '#4CD964',
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startJourneyText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  
  // Loading indicator
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#FFF',
    fontSize: 16,
    marginTop: 12,
  },
  
  // Route found modal
  centeredModalView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalView: {
    width: width * 0.8,
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  modalText: {
    color: '#CCC',
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  modalDetail: {
    color: '#CCC',
    fontSize: 14,
    marginBottom: 4,
  },
  modalButton: {
    backgroundColor: '#0066FF',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 16,
  },
  modalButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  weatherInfoBanner: {
  backgroundColor: '#2A2A2A',
  marginHorizontal: 16,
  padding: 12,
  borderRadius: 10,
  alignItems: 'center',
  marginBottom: 12,
  },
  weatherInfoText: {
    color: '#9de3d2',
    fontSize: 14,
    fontWeight: '600',
  },
  tooltipOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tooltipBox: {
    backgroundColor: '#444',
    padding: 14,
    borderRadius: 8,
    maxWidth: 250,
  },
  tooltipText: {
    color: '#fff',
    fontSize: 13,
    textAlign: 'center',
  },


});