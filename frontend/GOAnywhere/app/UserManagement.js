import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  SafeAreaView,
  Modal,
  Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

// hard coded data first need connect to backend
const mockUsers = [
  { id: '1', name: 'Trippi Troppi', email: 'trippi.troppi@pastanation.it', isBanned: false, lastActive: '2023-11-01' },
  { id: '2', name: 'Tung Tung Tung Sahur', email: 'sahur.bird@tungtungmail.com', isBanned: true, lastActive: '2023-10-28' },
  { id: '3', name: 'Brr Brr Patapim', email: ' brr.patapim@zoomzoom.it', isBanned: false, lastActive: '2023-11-02' },
  { id: '4', name: 'Tralalero Tralala', email: 'TralaleroTralala@example.com', isBanned: false, lastActive: '2023-10-31' },
  { id: '5', name: 'Bombardiro Crocodilo', email: 'BombardiroCrocodilo@example.com', isBanned: true, lastActive: '2023-09-15' },
  { id: '6', name: 'Bombombini Gusini', email: 'Bombombini Gusini@example.com', isBanned: false, lastActive: '2023-11-03' },
  { id: '7', name: 'Trippi Troppi', email: 'trippi.troppi@pastanation.it', isBanned: false, lastActive: '2023-11-01' },
  { id: '8', name: 'Tung Tung Tung Sahur', email: 'sahur.bird@tungtungmail.com', isBanned: true, lastActive: '2023-10-28' },
  { id: '9', name: 'Brr Brr Patapim', email: ' brr.patapim@zoomzoom.it', isBanned: false, lastActive: '2023-11-02' },
  { id: '10', name: 'Tralalero Tralala', email: 'TralaleroTralala@example.com', isBanned: false, lastActive: '2023-10-31' },
  { id: '11', name: 'Bombardiro Crocodilo', email: 'BombardiroCrocodilo@example.com', isBanned: true, lastActive: '2023-09-15' },
  { id: '12', name: 'Bombombini Gusini', email: 'Bombombini Gusini@example.com', isBanned: false, lastActive: '2023-11-03' },
];

export default function UserManagement() {
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all'); // 'all', 'active', 'banned'
  const [selectedUser, setSelectedUser] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);

  useEffect(() => {
    // update with backend API call here
    setUsers(mockUsers);
    setFilteredUsers(mockUsers);
  }, []);

  useEffect(() => {
    applyFilters();
  }, [searchQuery, filter, users]);

  const applyFilters = () => {
    let result = [...users];
    
    // Apply status filter
    if (filter === 'active') {
      result = result.filter(user => !user.isBanned);
    } else if (filter === 'banned') {
      result = result.filter(user => user.isBanned);
    }
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        user => 
          user.name.toLowerCase().includes(query) || 
          user.email.toLowerCase().includes(query)
      );
    }
    
    setFilteredUsers(result);
  };

  const handleBanUser = (userId) => {
    // Update local state first for immediate UI feedback
    const updatedUsers = users.map(user => 
      user.id === userId ? { ...user, isBanned: true } : user
    );
    setUsers(updatedUsers);
    
    // backend api call here
    console.log(`User ${userId} banned`);
    
    // Close modal if open
    setIsModalVisible(false);
  };

  const handleUnbanUser = (userId) => {
    // Update local state first for immediate UI feedback
    const updatedUsers = users.map(user => 
      user.id === userId ? { ...user, isBanned: false } : user
    );
    setUsers(updatedUsers);
    
    // backend api call here
    console.log(`User ${userId} unbanned`);
    
    // Close modal if open
    setIsModalVisible(false);
  };

  const handleRemoveUser = (userId) => {
    Alert.alert(
      "Remove User",
      "Are you sure you want to permanently remove this user? This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        { 
          text: "Remove", 
          onPress: () => {
            // Update local state for immediate UI feedback
            const updatedUsers = users.filter(user => user.id !== userId);
            setUsers(updatedUsers);
            
            // backend api call here
            console.log(`User ${userId} removed`);
            
            // Close modal if open
            setIsModalVisible(false);
          },
          style: "destructive"
        }
      ]
    );
  };

  const openUserModal = (user) => {
    setSelectedUser(user);
    setIsModalVisible(true);
  };

  const handleGoBack = () => {
    router.back();
  };

  const renderUserItem = ({ item }) => (
    <TouchableOpacity style={styles.userItem} onPress={() => openUserModal(item)}>
      <View style={styles.userInfo}>
        <View style={styles.userAvatar}>
          <Text style={styles.userInitial}>{item.name.charAt(0)}</Text>
        </View>
        <View style={styles.userDetails}>
          <Text style={styles.userName}>{item.name}</Text>
          <Text style={styles.userEmail}>{item.email}</Text>
          <Text style={styles.userLastActive}>Last active: {item.lastActive}</Text>
        </View>
      </View>
      <View style={styles.statusContainer}>
        {item.isBanned ? (
          <View style={[styles.statusBadge, styles.bannedBadge]}>
            <Text style={styles.statusText}>Banned</Text>
          </View>
        ) : (
          <View style={[styles.statusBadge, styles.activeBadge]}>
            <Text style={styles.statusText}>Active</Text>
          </View>
        )}
        <TouchableOpacity 
          style={styles.moreButton}
          onPress={() => openUserModal(item)}
        >
          <MaterialIcons name="more-vert" size={24} color="#888" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>User Management</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Search Bar and Filters */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#888" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search users..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#888"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#888" />
            </TouchableOpacity>
          ) : null}
        </View>
        
        <View style={styles.filterContainer}>
          <TouchableOpacity 
            style={[styles.filterButton, filter === 'all' && styles.activeFilter]}
            onPress={() => setFilter('all')}
          >
            <Text style={[styles.filterText, filter === 'all' && styles.activeFilterText]}>All</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.filterButton, filter === 'active' && styles.activeFilter]}
            onPress={() => setFilter('active')}
          >
            <Text style={[styles.filterText, filter === 'active' && styles.activeFilterText]}>Active</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.filterButton, filter === 'banned' && styles.activeFilter]}
            onPress={() => setFilter('banned')}
          >
            <Text style={[styles.filterText, filter === 'banned' && styles.activeFilterText]}>Banned</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* User List */}
      <FlatList
        data={filteredUsers}
        renderItem={renderUserItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people" size={60} color="#555" />
            <Text style={styles.emptyText}>No users found</Text>
          </View>
        }
      />

      {/* User Actions Modal */}
      <Modal
        visible={isModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setIsModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <TouchableOpacity activeOpacity={1}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{selectedUser?.name}</Text>
                  <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                    <Ionicons name="close" size={24} color="#888" />
                  </TouchableOpacity>
                </View>
                
                <View style={styles.modalUserInfo}>
                  <Text style={styles.modalUserEmail}>{selectedUser?.email}</Text>
                  <Text style={styles.modalUserStatus}>
                    Status: {selectedUser?.isBanned ? 'Banned' : 'Active'}
                  </Text>
                  <Text style={styles.modalUserLastActive}>
                    Last active: {selectedUser?.lastActive}
                  </Text>
                </View>
                
                <View style={styles.modalActions}>
                  {selectedUser?.isBanned ? (
                    <TouchableOpacity 
                      style={[styles.actionButton, styles.unbanButton]}
                      onPress={() => handleUnbanUser(selectedUser.id)}
                    >
                      <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                      <Text style={styles.actionButtonText}>Unban User</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity 
                      style={[styles.actionButton, styles.banButton]}
                      onPress={() => handleBanUser(selectedUser.id)}
                    >
                      <Ionicons name="ban" size={20} color="#fff" />
                      <Text style={styles.actionButtonText}>Ban User</Text>
                    </TouchableOpacity>
                  )}
                  
                  <TouchableOpacity 
                    style={[styles.actionButton, styles.removeButton]}
                    onPress={() => handleRemoveUser(selectedUser.id)}
                  >
                    <Ionicons name="trash-outline" size={20} color="#fff" />
                    <Text style={styles.actionButtonText}>Remove User</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#333',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    paddingBottom: 15,
    paddingHorizontal: 20,
    backgroundColor: '#333',
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerRight: {
    width: 30,
  },
  searchContainer: {
    padding: 15,
    backgroundColor: '#444',
    borderBottomWidth: 1,
    borderBottomColor: '#555',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#333',
    borderRadius: 10,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 5,
    color: '#fff',
  },
  filterContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 5,
  },
  filterButton: {
    paddingVertical: 5,
    paddingHorizontal: 15,
    borderRadius: 20,
    backgroundColor: '#333',
  },
  activeFilter: {
    backgroundColor: '#9de3d2',
  },
  filterText: {
    color: '#ccc',
    fontWeight: '500',
  },
  activeFilterText: {
    color: '#333',
  },
  listContainer: {
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  userItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 10,
    backgroundColor: '#444',
    borderRadius: 10,
    marginBottom: 10,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#555',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  userInitial: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  userEmail: {
    color: '#ccc',
    fontSize: 14,
  },
  userLastActive: {
    color: '#999',
    fontSize: 12,
    marginTop: 3,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
    marginRight: 5,
  },
  activeBadge: {
    backgroundColor: '#4CD964',
  },
  bannedBadge: {
    backgroundColor: '#FF3B30',
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  moreButton: {
    padding: 5,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
  },
  emptyText: {
    color: '#888',
    marginTop: 10,
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#444',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  modalContent: {
    width: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  modalUserInfo: {
    marginBottom: 20,
  },
  modalUserEmail: {
    color: '#ccc',
    fontSize: 16,
    marginBottom: 5,
  },
  modalUserStatus: {
    color: '#ccc',
    fontSize: 14,
    marginBottom: 5,
  },
  modalUserLastActive: {
    color: '#999',
    fontSize: 14,
  },
  modalActions: {
    gap: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  banButton: {
    backgroundColor: '#FF9500',
  },
  unbanButton: {
    backgroundColor: '#4CD964',
  },
  removeButton: {
    backgroundColor: '#FF3B30',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
});