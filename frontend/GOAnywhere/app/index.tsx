import React from 'react';
import { View, StyleSheet } from 'react-native';
import P2PNavigation from '../P2PPublicTransport';
import { useNavigation } from '@react-navigation/native';

export default function Index() {
  const navigation = useNavigation();

  React.useEffect(() => {
    navigation.setOptions({ headerShown: false }); // Hide the header
  }, [navigation]);

  return (
    <View style={styles.container}>
      <P2PNavigation />
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
});
