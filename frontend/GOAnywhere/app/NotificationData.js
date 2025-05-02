export let userAccountChanges = []; // Still empty for now
export let reportApprovals = [  // <-- Move example data here
  {
    id: 1,
    icon: 'car',
    iconColor: '#BC3535',
    title: 'Heavy Traffic Reported',
    message: 'Heavy traffic reported on PIE (Tuas bound)',
    timeCategory: 'today',
    read: false,
  },
  {
    id: 2,
    icon: 'car',
    iconColor: '#EEA039',
    title: 'Moderate Traffic Reported',
    message: 'Moderate traffic reported on PIE (Tuas bound)',
    timeCategory: 'today',
    read: false,
  },
  {
    id: 3,
    icon: 'rainy',
    iconColor: '#5C96E2',
    title: 'Bad Weather Reported',
    message: 'Flash Floods Reported along Upper Bukit Timah Road.',
    timeCategory: 'yesterday',
    read: false,
  },
  {
    id: 4,
    icon: 'alert-circle',
    iconColor: '#000000',
    title: 'Traffic Incident Reported',
    message: 'Accident reported along Upper Bukit Timah Road.',
    timeCategory: '2days',
    read: false,
  },
  {
    id: 5,
    icon: 'alert-circle',
    iconColor: '#000000',
    title: 'Traffic Incident Reported',
    message: 'Accident reported along Upper Bukit Timah Road.',
    timeCategory: '2days',
    read: true,
  },
  {
    id: 6,
    icon: 'alert-circle',
    iconColor: '#000000',
    title: 'Traffic Incident Reported',
    message: 'Accident reported along Upper Bukit Timah Road.',
    timeCategory: '2days',
    read: true,
  },
  {
    id: 7,
    icon: 'alert-circle',
    iconColor: '#000000',
    title: 'Traffic Incident Reported',
    message: 'Accident reported along Upper Bukit Timah Road.',
    timeCategory: '2days',
    read: true,
  },
];


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
  userAccountChanges.push({
    id,
    type: "User Account Change",
    message,
    time,
    read: false, 
  });
};

export const addReportNotification = (id, message, time) => {
  reportApprovals.push({
    id,
    type: "Report Update",
    message,
    time,
    read: false, 
  });
};

export const markAllReportNotificationsRead = () => {
  reportApprovals.forEach(n => n.read = true);
  userAccountChanges.forEach(n => n.read = true);
};

// Create a component to satisfy expo-router's default export requirement
const NotificationData = () => {
  return null;
};




export default NotificationData;
