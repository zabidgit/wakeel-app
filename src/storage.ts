import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PairingData, Message, ChatInfo } from './types';

const PAIRING_KEY = 'wakeel_pairing';
const MESSAGES_KEY = 'wakeel_messages';
const CHATS_KEY = 'wakeel_chats';

// ─── Pairing ──────────────────────────────────────────────────────────────────

export async function savePairing(data: PairingData): Promise<void> {
  await SecureStore.setItemAsync(PAIRING_KEY, JSON.stringify(data));
}

export async function getPairing(): Promise<PairingData | null> {
  const raw = await SecureStore.getItemAsync(PAIRING_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    console.error('[storage] Corrupted pairing data — clearing');
    await SecureStore.deleteItemAsync(PAIRING_KEY);
    return null;
  }
}

export async function clearPairing(): Promise<void> {
  await SecureStore.deleteItemAsync(PAIRING_KEY);
}

// ─── Legacy Messages (backward compat) ───────────────────────────────────────

export async function saveMessages(messages: Message[]): Promise<void> {
  const trimmed = messages.slice(-500);
  await AsyncStorage.setItem(MESSAGES_KEY, JSON.stringify(trimmed));
}

export async function getMessages(): Promise<Message[]> {
  const raw = await AsyncStorage.getItem(MESSAGES_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    console.error('[storage] Corrupted messages — clearing');
    await AsyncStorage.removeItem(MESSAGES_KEY);
    return [];
  }
}

export async function clearMessages(): Promise<void> {
  await AsyncStorage.removeItem(MESSAGES_KEY);
}

// ─── Chat-scoped Messages ─────────────────────────────────────────────────────

function chatMessagesKey(sessionKey: string): string {
  return `wakeel_messages_${sessionKey}`;
}

export async function getChatMessages(sessionKey: string): Promise<Message[]> {
  const raw = await AsyncStorage.getItem(chatMessagesKey(sessionKey));
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    console.error(`[storage] Corrupted chat messages for ${sessionKey} — clearing`);
    await AsyncStorage.removeItem(chatMessagesKey(sessionKey));
    return [];
  }
}

export async function saveChatMessages(sessionKey: string, messages: Message[]): Promise<void> {
  const trimmed = messages.slice(-500);
  await AsyncStorage.setItem(chatMessagesKey(sessionKey), JSON.stringify(trimmed));
}

export async function clearChatMessages(sessionKey: string): Promise<void> {
  await AsyncStorage.removeItem(chatMessagesKey(sessionKey));
}

// ─── Chats ────────────────────────────────────────────────────────────────────

const DEFAULT_CHAT: ChatInfo = {
  id: 'general',
  name: 'General',
  emoji: '💬',
  sessionKey: 'main',
  createdAt: 0,
};

export async function getChats(): Promise<ChatInfo[]> {
  const raw = await AsyncStorage.getItem(CHATS_KEY);
  if (!raw) {
    // First load — create default chat and migrate legacy messages
    const defaultChats = [{ ...DEFAULT_CHAT, createdAt: Date.now() }];
    await AsyncStorage.setItem(CHATS_KEY, JSON.stringify(defaultChats));

    // Migrate legacy messages to the default chat
    const legacyMessages = await getMessages();
    if (legacyMessages.length > 0) {
      await saveChatMessages('main', legacyMessages);
    }

    return defaultChats;
  }
  try {
    const chats: ChatInfo[] = JSON.parse(raw);
    // Ensure General always exists
    if (!chats.find(c => c.sessionKey === 'main')) {
      chats.unshift({ ...DEFAULT_CHAT, createdAt: Date.now() });
      await AsyncStorage.setItem(CHATS_KEY, JSON.stringify(chats));
    }
    return chats;
  } catch {
    console.error('[storage] Corrupted chats data — resetting to defaults');
    const defaultChats = [{ ...DEFAULT_CHAT, createdAt: Date.now() }];
    await AsyncStorage.setItem(CHATS_KEY, JSON.stringify(defaultChats));
    return defaultChats;
  }
}

export async function saveChats(chats: ChatInfo[]): Promise<void> {
  await AsyncStorage.setItem(CHATS_KEY, JSON.stringify(chats));
}
