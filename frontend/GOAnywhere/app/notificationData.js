export let userAccountChanges = []; // Holds notifications related to user settings
export let reportApprovals = []; // Holds report approval/rejection notifications

// Function to get user account notifications
export const getUserAccountNotifications = () => {
  return userAccountChanges;
};

// Function to get report approval/disapproval notifications
export const getReportNotifications = () => {
  return reportApprovals;
};

// Function to add a user account change notification
export const addUserAccountNotification = (id, message, time) => {
  userAccountChanges.push([id, "User Account Change", message, time]);
};

// Function to add a report approval/rejection notification
export const addReportNotification = (id, message, time) => {
  reportApprovals.push([id, "Report Update", message, time]);
};

// Create a component to satisfy expo-router's default export requirement
const NotificationData = () => {
  return null;
};

export default NotificationData;
