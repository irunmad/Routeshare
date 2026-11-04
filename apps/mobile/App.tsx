import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

export default function App() {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="auto" />
      <View style={styles.container}>
        <Text style={styles.brand}>RouteShare</Text>
        <Text style={styles.title}>Поездки, которые совпадают</Text>
        <Text style={styles.subtitle}>
          Находим попутчиков по маршруту, времени и свободным местам.
        </Text>
        <View style={styles.status}>
          <Text style={styles.statusText}>Основа приложения создана</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B1220' },
  container: { flex: 1, justifyContent: 'center', padding: 28 },
  brand: { color: '#55D6BE', fontSize: 18, fontWeight: '700', letterSpacing: 1 },
  title: { color: '#FFFFFF', fontSize: 32, fontWeight: '800', marginTop: 18 },
  subtitle: { color: '#AAB6C8', fontSize: 16, lineHeight: 24, marginTop: 12 },
  status: { alignSelf: 'flex-start', marginTop: 28, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: '#17263A' },
  statusText: { color: '#55D6BE', fontSize: 13, fontWeight: '600' },
});
