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
}

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

export type RootStackParamList = {
  Pairing: undefined;
  Chat: undefined;
  Settings: undefined;
};
