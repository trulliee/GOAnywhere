// TrafficIncidentsNav.js
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useRouter } from 'expo-router';
import TrafficIncidentReporting from './TrafficIncidentReporting';
import TrafficIncidentViewing from './TrafficIncidentViewing';

// This is the main navigation component for the Traffic Incidents feature
const TrafficIncidentsNav = () => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('view'); // 'view' or 'report'

  // Render the active tab content
  const renderContent = () => {
    switch (activeTab) {
      case 'report':
        return <TrafficIncidentReporting />;
      case 'view':
      default:
        return <TrafficIncidentViewing />;
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Navigation Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'view' && styles.activeTab]}
          onPress={() => setActiveTab('view')}
        >
          <Image
            source={require('./assets/view-icon.png')}
            style={styles.tabIcon}
            defaultSource={require('./assets/view-icon.png')}
          />
          <Text style={[styles.tabText, activeTab === 'view' && styles.activeTabText]}>
            View Incidents
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'report' && styles.activeTab]}
          onPress={() => setActiveTab('report')}
        >
          <Image
            source={require('./assets/report-icon.png')}
            style={styles.tabIcon}
            defaultSource={require('./assets/report-icon.png')}
          />
          <Text style={[styles.tabText, activeTab === 'report' && styles.activeTabText]}>
            Report Incident
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main Content Area */}
      <View style={styles.contentContainer}>
        {renderContent()}
      </View>

      {/* Back Button */}
      <TouchableOpacity 
        style={styles.backButton}
        onPress={() => router.navigate('dashboard')}
      >
        <Text style={styles.backButtonText}>Back to Dashboard</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e4e8',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  activeTab: {
    borderBottomWidth: 3,
    borderBottomColor: '#0066cc',
  },
  tabIcon: {
    width: 20,
    height: 20,
    marginRight: 6,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  activeTabText: {
    color: '#0066cc',
    fontWeight: 'bold',
  },
  contentContainer: {
    flex: 1,
  },
  backButton: {
    backgroundColor: '#f1f3f5',
    paddingVertical: 12,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e1e4e8',
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
});

export default TrafficIncidentsNav;