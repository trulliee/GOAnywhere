import React from 'react';
import { View, StyleSheet } from 'react-native';
import P2PNavigation from './P2PNavigation'; // ✅ Make sure this matches the actual file name

export default function Index() {
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
