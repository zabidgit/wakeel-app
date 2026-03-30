export interface PairingData {
  url: string;
  token: string;
  name?: string;
  bootstrapToken?: string;
  deviceToken?: string;
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

export type OnboardingData = {
  wakeclName: string;
  userName: string;
  userNickname: string;
  userTimezone: string;
  partnerName?: string;
  familyMembers?: string[];
  personality: 'casual' | 'balanced' | 'professional';
  proactiveness: 'quiet' | 'moderate' | 'proactive';
};

export type RootStackParamList = {
  Auth: undefined;
  Welcome: undefined;
  OnboardingName: { accountToken?: string; account?: { provider: string; email?: string; plan?: string } } | undefined;
  OnboardingAbout: { wakeclName: string; accountToken?: string; account?: { provider: string; email?: string; plan?: string } };
  OnboardingPeople: {
    wakeclName: string;
    userName: string;
    userNickname: string;
    userTimezone: string;
    accountToken?: string;
    account?: { provider: string; email?: string; plan?: string };
  };
  OnboardingPersonality: {
    wakeclName: string;
    userName: string;
    userNickname: string;
    userTimezone: string;
    partnerName?: string;
    familyMembers?: string[];
    accountToken?: string;
    account?: { provider: string; email?: string; plan?: string };
  };
  OnboardingProvisioning: { data: OnboardingData; accountToken?: string; account?: { provider: string; email?: string; plan?: string } };
  OnboardingReady: { wakeclName: string };
  Pairing: undefined;
  Chat: { chatId?: string } | undefined;
  Settings: undefined;
};
