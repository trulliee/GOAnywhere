// app/AdminHomeScreen.js
import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  SafeAreaView, 
  Alert,
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import AuthService from './authService';
import { API_URL } from './utils/apiConfig';

const GOOGLE_MAPS_API_KEY = 'AIzaSyDHIQoHjcVR0RsyKG-U5myMIpdPqK6n-m0';


// Get screen dimensions
const SCREEN_WIDTH = Dimensions.get('window').width;
const SIDEBAR_WIDTH = SCREEN_WIDTH * 0.8; // 80% of screen width

export default function AdminHomeScreen() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [userName, setUserName] = useState('ADMIN');
  const [isLoading, setIsLoading] = useState(true);
  const [mapRegion, setMapRegion] = useState({
    latitude: 1.290270, // Default to Singapore
    longitude: 103.851959,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });
  
  const [isDraggingSidebar, setIsDraggingSidebar] = useState(false);
  
  // Admin specific state
  const [pendingReports, setPendingReports] = useState(5);
  const [totalUsers, setTotalUsers] = useState(1258);
  const [activeUsers, setActiveUsers] = useState(347);
  
  // Recent users data
  const [recentUsers, setRecentUsers] = useState([]);

  // Admin notifications draft
  const [notificationDrafts, setNotificationDrafts] = useState([]);

  const [adminAlerts, setAdminAlerts] = useState([]);


  // Animated value for sidebar position
  const sidebarPosition = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);

  const [congestionFeedback, setCongestionFeedback] = useState(null);
  const [travelTimeFeedback, setTravelTimeFeedback] = useState(null);


  // Handle user status toggle
  const handleToggleUserStatus = async (userId, currentType) => {
    const action = currentType === 'banned' ? 'unban' : 'ban';

    try {
      const response = await fetch(`${API_URL}/admin/ban_user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, action }),
      });

      const data = await response.json();

      if (data.status === 'success') {
        // Update the user's type in the frontend state
        setRecentUsers(prevUsers =>
          prevUsers.map(user =>
            user.id === userId ? { ...user, user_type: data.new_user_type } : user
          )
        );
      } else {
        Alert.alert("Error", "Failed to update user status.");
      }
    } catch (error) {
      console.error("Ban/unban error:", error);
      Alert.alert("Error", "Server error while updating user.");
    }
  };

  // Handle logout
  const handleLogout = async () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        { 
          text: "Logout", 
          onPress: async () => {
            try {
              await AuthService.logout();
              // Navigate to the login screen
              router.replace("./");
            } catch (error) {
              console.error('Error logging out:', error);
              Alert.alert("Error", "Failed to logout. Please try again.");
            }
          } 
        }
      ]
    );
  };

  // Create pan responder for swipe gesture
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (event, gestureState) => {
        // Allow swipe if the touch starts within 50 pixels from the left edge
        return gestureState.x0 <= 50;
      },

      onPanResponderMove: (event, gestureState) => {
        let newPosition = sidebarPosition._value;

        if (gestureState.dx > 0 && !isSidebarVisible && gestureState.x0 <= 50) {
          // Swiping right when sidebar is hidden and started from the left edge
          setIsDraggingSidebar(true);
          sidebarPosition.setValue(Math.max(-SIDEBAR_WIDTH, -SIDEBAR_WIDTH + gestureState.dx));
          newPosition = Math.min(0, -SIDEBAR_WIDTH + gestureState.dx);

        } else if (gestureState.dx < 0 && isSidebarVisible) {
          // Swiping left when sidebar is visible
          setIsDraggingSidebar(true);
          sidebarPosition.setValue(Math.min(0, gestureState.dx));
          newPosition = Math.max(-SIDEBAR_WIDTH, gestureState.dx);
        }
        sidebarPosition.setValue(newPosition);
      },

      onPanResponderRelease: (event, gestureState) => {
        let finalPosition = isSidebarVisible ? 0 : -SIDEBAR_WIDTH;

        if (!isSidebarVisible && gestureState.dx > 50 && gestureState.x0 <= 50) {
          // Show sidebar if swiped right more than 50px and started from the left edge
          finalPosition = 0;
          showSidebar();
        } else if (isSidebarVisible && gestureState.dx < -50) {
          // Hide sidebar if swiped left more than 50px
          finalPosition = -SIDEBAR_WIDTH;
          hideSidebar();
        } else {
          // Reset position if swipe wasn't enough
          Animated.spring(sidebarPosition, {
            toValue: isSidebarVisible ? 0 : -SIDEBAR_WIDTH,
            useNativeDriver: false,
          }).start();
        }
        
        Animated.spring(sidebarPosition, {
          toValue: finalPosition,
          bounciness: 0, 
          speed: 15, 
          useNativeDriver: false,
        }).start();
        setIsDraggingSidebar(false);
      },
    })
  ).current;

  // Functions to show/hide the sidebar
  const showSidebar = () => {
    setIsSidebarVisible(true);
    Animated.spring(sidebarPosition, {
      toValue: 0,
      useNativeDriver: false,
    }).start();
  };

  const hideSidebar = () => {
    Animated.timing(sidebarPosition, {
      toValue: -SIDEBAR_WIDTH,
      duration: 200, 
      useNativeDriver: false,
    }).start(() => {
      setIsSidebarVisible(false);
    });
  };

  useEffect(() => {
    // Load user data
    async function loadUser() {
      setIsLoading(true);
      try {
        const storedName = await AuthService.getUserName();
        if (storedName && storedName !== 'User') {
          setUserName(storedName.toUpperCase());
        }

        const userData = await AuthService.getCurrentUser();
        setUser(userData);

        if (userData) {
          const displayName =
            userData.name ||
            userData.display_name ||
            userData.email?.split('@')[0] ||
            'ADMIN';
          setUserName(displayName.toUpperCase());
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      } finally {
        setIsLoading(false);
      }
    }


    async function fetchRecentUsers() {
      try {
        const res = await fetch(`${API_URL}/admin/users`);
        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Server returned ${res.status}: ${errText}`);
        }
        const contentType = res.headers.get('content-type') || '';
        let data;
        if (contentType.includes('application/json')) {
          data = await res.json();
        } else {
          const txt = await res.text();
          throw new Error(`Expected JSON but got: ${txt}`);
        }
        setRecentUsers(data.users || []);
      } catch (err) {
        console.error("Error fetching users:", err.message);
      }
    }

    loadUser();
    fetchRecentUsers();

  async function fetchStreetName(lat, lng) {
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`
      );
      const json  = await res.json();
      const comps = json.results?.[0]?.address_components || [];
      return (
        comps.find(c => c.types.includes('route'))?.long_name ||
        'Unknown Road'
      );
    } catch {
      return 'Unknown Road';
    }
  }

  async function fetchAdminAlerts() {
    try {
      const res = await fetch(`${API_URL}/crowd/get-crowd-data`);
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Server returned ${res.status}: ${errText}`);
      }

      const contentType = res.headers.get('content-type') || '';
      let data;
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const txt = await res.text();
        throw new Error(`Expected JSON but got: ${txt}`);
      }

      const notifications = await Promise.all(
        (data.reports || []).map(async item => {
          const roadName = await fetchStreetName(item.latitude, item.longitude);
          return {
            ...item,
            message: `${item.type} reported by ${item.username} at ${roadName} (${item.latitude}, ${item.longitude})`
          };
        })
      );

      notifications.sort(
        (a, b) => parseInt(b.timestamp, 10) - parseInt(a.timestamp, 10)
      );

      setAdminAlerts(notifications);
    } catch (err) {
      console.error("Error fetching admin alerts:", err.message);
    }
  }










    fetchAdminAlerts();

    async function fetchFeedbackSummaries() {
    try {
      const [congestionRes, travelTimeRes] = await Promise.all([
        fetch(`${API_URL}/prediction/feedback/summary?prediction_type=traffic_congestion`),
        fetch(`${API_URL}/prediction/feedback/summary?prediction_type=travel_time`)
      ]);

      if (congestionRes.ok) {
        const data = await congestionRes.json();
        setCongestionFeedback(data);
      }
      if (travelTimeRes.ok) {
        const data = await travelTimeRes.json();
        setTravelTimeFeedback(data);
      }
    } catch (error) {
      console.error("Error fetching feedback summary:", error.message);
    }
  }

  fetchFeedbackSummaries();


  }, []);


  const navigateTo = (screen) => {
    router.push(`./${screen}`);
    hideSidebar(); 
  };

  const overlayOpacity = sidebarPosition.interpolate({
    inputRange: [-SIDEBAR_WIDTH, 0],
    outputRange: [0, 0.5],
    extrapolate: 'clamp',
  });

  const renderUserItem = ({ item }) => {
    return (
      <View style={styles.userCard}>
        <View style={styles.userHeader}>
          <View style={styles.userIconContainer}>
            <Text style={styles.userInitial}>{item.name.charAt(0)}</Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{item.name}</Text>
            <Text style={styles.userEmail}>{item.email}</Text>
          </View>
          <View style={[
            styles.statusBadge,
            item.user_type === 'banned' ? styles.inactiveStatus : styles.activeStatus
          ]}>
            <Text style={styles.statusText}>
              {item.user_type === 'banned' ? 'INACTIVE' : 'ACTIVE'}
            </Text>
          </View>
        </View>
          
        <View style={styles.userActions}>
          <TouchableOpacity
            style={[
              styles.statusToggleButton,
              item.user_type !== 'banned' ? styles.deactivateButton : styles.activateButton,
            ]}
            onPress={() => handleToggleUserStatus(item.id, item.user_type)}
          >
            <Text style={styles.buttonText}>
              {item.user_type !== 'banned' ? 'Deactivate' : 'Activate'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Admin Dashboard</Text>
          {!isSidebarVisible && (
            <TouchableOpacity 
              style={styles.hamburgerButton}
              onPress={showSidebar}
            >
              <Ionicons name="menu" size={24} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
        
        {/* Main Content */}
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
          {/* Welcome message */}
          <View style={styles.welcomeMessageContainer}>
            <Text style={styles.welcomeMessageTitle}>Welcome to Admin Dashboard</Text>
            <Text style={styles.welcomeMessageText}>
              Manage users and send notifications from this control panel
            </Text>
          </View>

          <View style={styles.sectionTitle}>
            <FontAwesome5 name="comment-dots" size={20} color="#333" />
            <Text style={styles.sectionTitleText}>Feedback Summary</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Traffic Congestion</Text>
            {congestionFeedback ? (
              <>
                <Text style={styles.statValue}>{congestionFeedback.average_rating ?? "N/A"} ⭐</Text>
                <Text style={styles.statLabel}>
                  {congestionFeedback.feedback_count} feedbacks — {congestionFeedback.satisfaction_rate}% satisfied
                </Text>
              </>
            ) : (
              <Text style={styles.statLabel}>Loading...</Text>
            )}
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Travel Time</Text>
            {travelTimeFeedback ? (
              <>
                <Text style={styles.statValue}>{travelTimeFeedback.average_rating ?? "N/A"} ⭐</Text>
                <Text style={styles.statLabel}>
                  {travelTimeFeedback.feedback_count} feedbacks — {travelTimeFeedback.satisfaction_rate}% satisfied
                </Text>
              </>
            ) : (
              <Text style={styles.statLabel}>Loading...</Text>
            )}
          </View>

          
          {/* User Management Preview Section */}
          <View style={styles.sectionTitle}>
            <MaterialIcons name="people" size={24} color="#333" />
            <Text style={styles.sectionTitleText}>Recent Users</Text>
            <TouchableOpacity 
              style={styles.viewAllButton}
              onPress={() => navigateTo('UserManagement')}
            >
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          
          {recentUsers.slice(0, 3).map((item) => (
            <View key={item.id}>
              {renderUserItem({ item })}
            </View>
          ))}          
          {/* Notifications Section */}
          <View style={styles.sectionTitle}>
            <MaterialIcons name="warning" size={24} color="#333" />
            <Text style={styles.sectionTitleText}>Crowdsourced Alerts</Text>
            <TouchableOpacity 
              style={styles.viewAllButton}
              onPress={() => navigateTo('AdminNotification')}
            >
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>

          {adminAlerts.length === 0 ? (
            <Text style={{ marginBottom: 10, color: '#888' }}>No urgent reports.</Text>
          ) : (
            adminAlerts.slice(0, 3).map(alert => (
              <View key={alert.id} style={styles.notificationCard}>
                <Text style={styles.notificationTitle}>{alert.type}</Text>
                <Text style={styles.notificationContent}>{alert.message}</Text>
              </View>
            ))
          )}

        </ScrollView>

        {/* Dark overlay when sidebar is visible */}
        {isSidebarVisible && (
          <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
            <TouchableOpacity 
              style={styles.overlayTouchable} 
              activeOpacity={1} 
              onPress={hideSidebar} 
            />
          </Animated.View>
        )}

        {/* Sidebar - Simplified to focus on admin functions */}
        <Animated.View 
          style={[styles.sidebar, { transform: [{ translateX: sidebarPosition }] }]} 
          {...panResponder.panHandlers}
        >
          {/* User Profile Section */}
          <View style={styles.profileSection}>
            <View style={styles.profileImageContainer}>
              <View style={styles.profileImagePlaceholder}>
                <Text style={styles.profileInitial}>{userName.charAt(0)}</Text>
              </View>
            </View>
            <Text style={styles.welcomeText}>WELCOME {userName}!</Text>
            <View style={styles.adminBadge}>
              <Text style={styles.adminBadgeText}>ADMIN</Text>
            </View>
          </View>

          {/* App Title */}
          <Text style={styles.appTitle}>GOANYWHERE ADMIN</Text>

          {/* Menu Items - Focused on admin functions */}
          <ScrollView style={styles.menuContainer}>
            {/* Admin Dashboard */}
            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={() => navigateTo('AdminHomeScreen')}
            >
              <View style={styles.menuItemRow}>
                <MaterialIcons name="dashboard" size={24} color="#fff" style={styles.menuIcon} />
                <Text style={styles.menuText}>Dashboard</Text>
              </View>
            </TouchableOpacity>

            {/* User Management Section - Admin specific */}
            <TouchableOpacity 
              style={[styles.menuItem, styles.activeMenuItem]} 
              onPress={() => navigateTo('UserManagement')}
            >
              <View style={styles.menuItemRow}>
                <MaterialIcons name="people" size={24} color="#fff" style={styles.menuIcon} />
                <Text style={styles.menuText}>User Management</Text>
              </View>
            </TouchableOpacity>

            {/* Admin Notifications - Admin specific */}
            <TouchableOpacity 
              style={[styles.menuItem, styles.activeMenuItem]}
              onPress={() => navigateTo('AdminNotification')}
            >
              <View style={styles.menuItemRow}>
                <MaterialIcons name="notifications" size={24} color="#fff" style={styles.menuIcon} />
                <Text style={styles.menuText}>Admin Notifications</Text>
              </View>
            </TouchableOpacity>

            {/* Regular app sections - Available but not highlighted */}
            <View style={styles.menuSectionDivider}>
              <Text style={styles.menuSectionTitle}>App Navigation</Text>
            </View>

            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={() => navigateTo('HomeScreen')}
            >
              <View style={styles.menuItemRow}>
                <MaterialIcons name="home" size={24} color="#aaa" style={styles.menuIcon} />
                <Text style={[styles.menuText, {color: '#aaa'}]}>Home</Text>
              </View>
            </TouchableOpacity>

            {/* Logout Button */}
            <TouchableOpacity 
              style={styles.logoutMenuItem} 
              onPress={handleLogout}
            >
              <View style={styles.menuItemRow}>
                <Ionicons name="exit-outline" size={24} color="#fff" style={styles.menuIcon} />
                <Text style={styles.menuText}>Logout</Text>
              </View>
            </TouchableOpacity>
          </ScrollView>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 15,
    paddingBottom: 100, // Add extra padding at bottom for scrolling
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#393939',
    paddingVertical: 15,
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  hamburgerButton: {
    position: 'absolute',
    left: 20,
    padding: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  alertStatCard: {
    backgroundColor: '#FFECB3',
  },
  statValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
  },
  welcomeMessageContainer: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  welcomeMessageTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  welcomeMessageText: {
    fontSize: 14,
    color: '#666',
  },
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  sectionTitleText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
    flex: 1,
  },
  viewAllButton: {
    backgroundColor: '#eee',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 15,
  },
  viewAllText: {
    fontSize: 12,
    color: '#666',
  },
  userCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  userIconContainer: {
    backgroundColor: '#2196F3',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  userInitial: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  userEmail: {
    fontSize: 12,
    color: '#666',
  },
  statusBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  activeStatus: {
    backgroundColor: '#E8F5E9',
  },
  inactiveStatus: {
    backgroundColor: '#FFEBEE',
  },
  pendingStatus: {
    backgroundColor: '#FFF8E1',
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  userActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  statusToggleButton: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  activateButton: {
    backgroundColor: '#4CAF50',
  },
  deactivateButton: {
    backgroundColor: '#F44336',
  },
  editUserButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 5,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  notificationCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  notificationStatus: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  draftStatus: {
    backgroundColor: '#E0E0E0',
  },
  scheduledStatus: {
    backgroundColor: '#E3F2FD',
  },
  notificationStatusText: {
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  notificationContent: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  notificationActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  editButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  sendButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 5,
  },
  disabledButton: {
    backgroundColor: '#9E9E9E',
  },
  sidebar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    backgroundColor: '#393939',
    paddingTop: 40,
    zIndex: 10,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'black',
    zIndex: 5,
  },
  overlayTouchable: {
    flex: 1, 
    width: "100%", 
    height: "100%"
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 15,
  },
  profileImageContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
    marginBottom: 5,
  },
  profileImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#666',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInitial: {
    fontSize: 24,
    color: '#fff',
    fontWeight: 'bold',
  },
  welcomeText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  adminBadge: {
    backgroundColor: '#E53935',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginTop: 5,
  },
  adminBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  appTitle: {
    color: '#AAAAAA',
    fontSize: 14,
    fontWeight: 'bold',
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 10,
  },
  menuContainer: {
    flex: 1,
  },
  menuItem: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  activeMenuItem: {
    backgroundColor: '#4c4c4c',
    borderLeftWidth: 3,
    borderLeftColor: '#E53935',
  },
  menuItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIcon: {
    marginRight: 15,
  },
  menuText: {
    color: '#FFFFFF',
    fontSize: 16,
    flex: 1,
  },
  menuSectionDivider: {
    marginTop: 15,
    paddingHorizontal: 20,
    marginBottom: 5,
  },
  menuSectionTitle: {
    color: '#aaa',
    fontSize: 12,
    textTransform: 'uppercase',
  },
  logoutMenuItem: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#555',
  },
});