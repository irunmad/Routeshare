import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

const INSTALLATION_ID_KEY = 'routeshare.installation-id';

export async function getInstallationId(): Promise<string> {
  const existing = await AsyncStorage.getItem(INSTALLATION_ID_KEY);
  if (existing) return existing;

  const created = Crypto.randomUUID();
  await AsyncStorage.setItem(INSTALLATION_ID_KEY, created);
  return created;
}
