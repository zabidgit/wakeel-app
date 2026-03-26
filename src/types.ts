export interface PairingData {
  url: string;
  token: string;
  name?: string;
}

export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'wakeel';
  timestamp: number;
  /** Local URI for image attachments (user-sent photos) */
  imageUri?: string;
}

export interface ChatInfo {
  id: string;
  name: string;
  emoji: string;
  sessionKey: string;
  createdAt: number;
}

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

export type RootStackParamList = {
  Pairing: undefined;
  Chat: { chatId?: string } | undefined;
  Settings: undefined;
};
