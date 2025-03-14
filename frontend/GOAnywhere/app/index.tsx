import React from 'react';
import { Text, View, StyleSheet, Button } from 'react-native';
import { useRouter } from "expo-router";
import { useNavigation } from '@react-navigation/native';

export default function Index() {
  const navigation = useNavigation();
  const router = useRouter();

  React.useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Welcome to GoAnywhere</Text>
      <Button title="Login" onPress={() => router.push("./login")} />
      <Button title="Go to P2P Navigation" onPress={() => router.push("./P2PNavigation")} />
      <Button title="Go to Dashboard" onPress={() => router.push("./Dashboard")} />
      <Button title="Go to Traffic Incidents" onPress={() => router.push("./TrafficIncident")} /> 
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#25292e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#fff',
    fontSize: 18,
    marginBottom: 10,
  },
});
