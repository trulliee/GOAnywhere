// import React, { useState } from "react";
// import { 
//   View, 
//   Text, 
//   TextInput, 
//   TouchableOpacity, 
//   StyleSheet, 
//   ImageBackground,
//   ActivityIndicator,
//   SafeAreaView,
//   KeyboardAvoidingView,
//   Platform,
//   Alert
// } from "react-native";
// import { useRouter } from "expo-router";
// import { LinearGradient } from "expo-linear-gradient";
// import AuthService from "./authService";

// export default function LoginScreen() {
//     const router = useRouter();
//     const [email, setEmail] = useState("");
//     const [password, setPassword] = useState("");
//     const [isLoading, setIsLoading] = useState(false);

//     const handleLogin = async () => {
//         if (!email.trim() || !password.trim()) {
//             Alert.alert("Error", "Please enter both email and password");
//             return;
//         }

//         setIsLoading(true);
//         try {
//             await AuthService.login(email, password);
//             router.replace("/home");
//         } catch (error) {
//             console.error("Login error:", error);
//             // AuthService already shows an alert on error
//         } finally {
//             setIsLoading(false);
//         }
//     };

//     const handleAnonymousLogin = async () => {
//         setIsLoading(true);
//         try {
//             await AuthService.loginAnonymously();
//             router.replace("/home");
//         } catch (error) {
//             console.error("Anonymous login error:", error);
//             // AuthService already shows an alert on error
//         } finally {
//             setIsLoading(false);
//         }
//     };

//     return (
//         <ImageBackground 
//             source={{ uri: "https://source.unsplash.com/featured/?city,traffic" }} 
//             style={styles.background}
//         >
//             <LinearGradient 
//                 colors={["rgba(0, 0, 0, 0.7)", "rgba(0, 0, 0, 0.5)"]} 
//                 style={styles.overlay}
//             >
//                 <SafeAreaView style={styles.safeArea}>
//                     <KeyboardAvoidingView
//                         behavior={Platform.OS === "ios" ? "padding" : "height"}
//                         style={styles.keyboardAvoid}
//                     >
//                         <View style={styles.container}>
//                             <Text style={styles.title}>Welcome to GoAnywhere</Text>
//                             <Text style={styles.subtitle}>Your Smart Traffic Companion</Text>

//                             <TextInput
//                                 style={styles.input}
//                                 placeholder="Email"
//                                 placeholderTextColor="#aaa"
//                                 value={email}
//                                 onChangeText={setEmail}
//                                 keyboardType="email-address"
//                                 autoCapitalize="none"
//                                 editable={!isLoading}
//                             />
//                             <TextInput
//                                 style={styles.input}
//                                 placeholder="Password"
//                                 placeholderTextColor="#aaa"
//                                 value={password}
//                                 onChangeText={setPassword}
//                                 secureTextEntry
//                                 editable={!isLoading}
//                             />

//                             <TouchableOpacity 
//                                 style={[styles.loginButton, isLoading && styles.disabledButton]} 
//                                 onPress={handleLogin}
//                                 disabled={isLoading}
//                             >
//                                 {isLoading ? (
//                                     <ActivityIndicator color="#fff" size="small" />
//                                 ) : (
//                                     <Text style={styles.buttonText}>Login</Text>
//                                 )}
//                             </TouchableOpacity>

//                             <TouchableOpacity 
//                                 onPress={() => router.push("/loginUser")}
//                                 disabled={isLoading}
//                             >
//                                 <Text style={styles.link}>Don't have an account? Sign up</Text>
//                             </TouchableOpacity>

//                             <TouchableOpacity 
//                                 style={[styles.anonymousButton, isLoading && styles.disabledButton]} 
//                                 onPress={handleAnonymousLogin}
//                                 disabled={isLoading}
//                             >
//                                 <Text style={styles.anonymousText}>Continue as Guest</Text>
//                             </TouchableOpacity>
//                         </View>
//                     </KeyboardAvoidingView>
//                 </SafeAreaView>
//             </LinearGradient>
//         </ImageBackground>
//     );
// }

// const styles = StyleSheet.create({
//     background: {
//         flex: 1,
//         resizeMode: "cover",
//     },
//     overlay: {
//         flex: 1,
//         justifyContent: "center",
//     },
//     safeArea: {
//         flex: 1,
//     },
//     keyboardAvoid: {
//         flex: 1,
//         justifyContent: "center",
//         alignItems: "center",
//     },
//     container: {
//         width: "90%",
//         padding: 20,
//         backgroundColor: "rgba(255, 255, 255, 0.9)",
//         borderRadius: 10,
//         alignItems: "center",
//     },
//     title: {
//         fontSize: 24,
//         fontWeight: "bold",
//         marginBottom: 8,
//     },
//     subtitle: {
//         fontSize: 16,
//         color: "#555",
//         marginBottom: 20,
//     },
//     input: {
//         width: "100%",
//         padding: 15,
//         borderWidth: 1,
//         borderColor: "#ddd",
//         borderRadius: 8,
//         marginBottom: 15,
//         backgroundColor: "#fff",
//     },
//     loginButton: {
//         width: "100%",
//         backgroundColor: "#3498db",
//         padding: 15,
//         borderRadius: 8,
//         alignItems: "center",
//         marginTop: 10,
//     },
//     disabledButton: {
//         backgroundColor: "#95c4e8",
//     },
//     buttonText: {
//         color: "#fff",
//         fontWeight: "bold",
//         fontSize: 16,
//     },
//     link: {
//         marginTop: 15,
//         color: "#3498db",
//     },
//     anonymousButton: {
//         width: "100%",
//         backgroundColor: "transparent",
//         padding: 15,
//         borderRadius: 8,
//         alignItems: "center",
//         marginTop: 20,
//         borderWidth: 1,
//         borderColor: "#ddd",
//     },
//     anonymousText: {
//         color: "#555",
//     }
// });