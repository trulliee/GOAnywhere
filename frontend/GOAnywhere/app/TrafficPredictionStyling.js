import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000', // Black background
  },
  scrollContainer: {
    flex: 1,
    backgroundColor: '#000', // Black background for ScrollView
  },
  headerContainer: {
    padding: 20,
    backgroundColor: '#111', // Dark background for header
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  header: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff', // White text for dark background
  },
  subheader: {
    fontSize: 16,
    color: '#aaa', // Light gray text for dark background
    marginTop: 5,
  },
  card: {
    backgroundColor: '#111', // Dark card background
    borderRadius: 10,
    padding: 16,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#222', // Subtle border for cards
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#fff', // White text for card titles
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    color: '#ccc', // Light gray labels
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#333', // Darker border for inputs
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    backgroundColor: '#222', // Dark input background
    color: '#fff', // White text in inputs
  },
  searchButton: {
    backgroundColor: '#16a085', // Teal button
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
  routeSelectionContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#222', // Dark background for route selection
    borderRadius: 8,
  },
  routeSelectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#fff', // White text for route title
  },
  routeButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  routeButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: '#333', // Dark button background
  },
  selectedRouteButton: {
    backgroundColor: '#3498db', // Blue for selected route
  },
  disabledRouteButton: {
    backgroundColor: '#333',
    opacity: 0.6,
  },
  routeButtonText: {
    fontSize: 14,
    color: '#ccc', // Light gray text
  },
  selectedRouteButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  disabledRouteButtonText: {
    color: '#555', // Dark gray for disabled
  },
  actionButtonsContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 12,
  },
  predictionButton: {
    backgroundColor: '#3498db', // Same blue color for both prediction buttons
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    width: '90%',
  },
  resetButton: {
    backgroundColor: '#7f8c8d', // Gray reset button
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    width: '90%',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#ccc', // Light gray loading text
    fontSize: 16,
  },
  resultsContainer: {
    marginBottom: 20,
  },
  resultBox: {
    marginTop: 16,
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#222', // Dark background for result boxes
    borderLeftWidth: 4,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  resultTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginLeft: 12,
  },
  resultDetail: {
    fontSize: 16,
    color: '#ccc', // Light gray for details
    marginTop: 6,
  },
  probabilityContainer: {
    marginVertical: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#333', // Darker border
  },
  probabilityTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#fff', // White title text
  },
  probabilityBar: {
    height: 30,
    backgroundColor: '#333', // Dark background for bars
    borderRadius: 4,
    marginBottom: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  probabilityFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    opacity: 0.7,
  },
  probabilityLabel: {
    position: 'absolute',
    top: 0,
    left: 8,
    right: 0,
    bottom: 0,
    textAlignVertical: 'center',
    color: '#fff', // White text for probability labels
    fontWeight: 'bold',
  },
  rangeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#333', // Dark background for range container
    borderRadius: 8,
    marginTop: 8,
  },
  rangeText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff', // White text for range
  },
  rangeSeparator: {
    fontSize: 14,
    color: '#777', // Gray separator text
  },
  map: {
    height: 220,
    borderRadius: 8,
    marginBottom: 16,
  },
  routeDetails: {
    backgroundColor: '#222', // Dark background for route details
    padding: 12,
    borderRadius: 8,
  },
  routeDetail: {
    fontSize: 16,
    color: '#ccc', // Light gray text for route details
    marginBottom: 6,
  },
  footer: {
    padding: 16,
    backgroundColor: '#111', // Dark background for footer
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  footerText: {
    fontSize: 12,
    color: '#777', // Gray text for footer
  },
  
  // Styles for severity indicators
  highSeverityBox: {
    borderLeftWidth: 4,
    borderLeftColor: '#e74c3c', // Red for high severity
  },
  mediumSeverityBox: {
    borderLeftWidth: 4,
    borderLeftColor: '#f39c12', // Orange for medium severity
  },
  lowSeverityBox: {
    borderLeftWidth: 4,
    borderLeftColor: '#2ecc71', // Green for low severity
  },
  
  // Warning container and text
  warningContainer: {
    backgroundColor: 'rgba(40, 40, 40, 0.7)', // Dark semi-transparent
    padding: 12,
    borderRadius: 6,
    marginVertical: 10,
  },
  warningText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#ccc', // Light gray text
  },
  highSeverityText: {
    color: '#e74c3c', // Red for high severity
  },
  mediumSeverityText: {
    color: '#f39c12', // Orange for medium severity
  },
  lowSeverityText: {
    color: '#2ecc71', // Green for low severity
  },
});

export default styles;