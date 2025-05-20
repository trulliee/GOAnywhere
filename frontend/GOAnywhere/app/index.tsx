// // app/index.tsx
// import React, { useEffect, useState } from 'react';
// import { Text, View, StyleSheet, Button, ActivityIndicator } from 'react-native';
// import { useRouter } from "expo-router";
// import { useNavigation } from '@react-navigation/native';
// import AuthService from './authService';

// export default function Index() {
//   const navigation = useNavigation();
//   const router = useRouter();
//   const [user, setUser] = useState(null);
//   const [loading, setLoading] = useState(true);

// //   useEffect(() => {
// //     // Simple redirection to the signup page
// //     const timer = setTimeout(() => {
// //       router.replace('./loginUser');
// //     }, 300);
    
// //     return () => clearTimeout(timer);
// //   }, [router]);

//   // Only show loading screen while preparing to redirect
//   return (
//     <View style={styles.container}>
//       <Text style={styles.text}>Welcome to GoAnywhere</Text>
//       <Button title="Login" onPress={() => router.push("./loginUser")} />
//       <Button title="Go to New Home Screen" onPress={() => router.push("./home")} /> 
//       <Button title="Go to P2P Navigation" onPress={()=> router.push("./P2PNavigation")} />
//       <Button title="Go to Traffic Incidents" onPress={() => router.push("./TrafficIncidents")} />
//       <Button title="Go to Traffic Prediction" onPress={() => router.push("./TrafficPrediction")} />
//       <Button title="Go to Notification" onPress={() => router.push("./Notification")} />
//       <Button title="Go to Hard Coded Admin Traffic Incident with Updated UI" onPress={() => router.push("./AdminNotification")} />

//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: '#25292e',
//     alignItems: 'center',
//     justifyContent: 'center',
//   },
//   centered: {
//     justifyContent: 'center',
//     alignItems: 'center',
//   },
//   text: {
//     color: '#fff',
//     fontSize: 18,
//     marginBottom: 10,
//   },
//   userInfo: {
//     marginTop: 20,
//     padding: 10,
//     backgroundColor: 'rgba(255,255,255,0.1)',
//     borderRadius: 5,
//     alignItems: 'center',
//   },
//   userText: {
//     color: '#fff',
//     marginBottom: 10,
//   }
// });