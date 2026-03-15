import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PairingData, Message } from './types';

const PAIRING_KEY = 'wakeel_pairing';
const MESSAGES_KEY = 'wakeel_messages';

export async function savePairing(data: PairingData): Promise<void> {
  await SecureStore.setItemAsync(PAIRING_KEY, JSON.stringify(data));
}

export async function getPairing(): Promise<PairingData | null> {
  const raw = await SecureStore.getItemAsync(PAIRING_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function clearPairing(): Promise<void> {
  await SecureStore.deleteItemAsync(PAIRING_KEY);
}

export async function saveMessages(messages: Message[]): Promise<void> {
  // Keep last 500 messages
  const trimmed = messages.slice(-500);
  await AsyncStorage.setItem(MESSAGES_KEY, JSON.stringify(trimmed));
}

export async function getMessages(): Promise<Message[]> {
  const raw = await AsyncStorage.getItem(MESSAGES_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function clearMessages(): Promise<void> {
  await AsyncStorage.removeItem(MESSAGES_KEY);
}
