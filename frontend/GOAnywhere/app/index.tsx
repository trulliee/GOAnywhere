import { Text, View, StyleSheet, Button } from 'react-native';
import { useRouter } from "expo-router";

export default function Index() {
    const router = useRouter();

    return (
        <View style={styles.container}>
            <Text style={styles.text}>Welcome to GoAnywhere</Text>
            <Button title="Go to P2P Transport" onPress={() => router.push("/p2p-public-trans")} />
            <Button title="Login" onPress={() => router.push("/login")} />
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
    },
});