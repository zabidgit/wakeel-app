import * as SecureStore from 'expo-secure-store';
import { PairingData } from './types';
import { fetchWithTimeout } from './fetchWithTimeout';

const PROVISION_API_URL = 'https://app.getwakeel.app';
const ACCOUNT_TOKEN_KEY = 'wakeel_account_token';
const ACCOUNT_INFO_KEY = 'wakeel_account_info';

export interface AccountInfo {
  email: string | null;
  name: string | null;
  plan: 'free' | 'pro' | 'household';
  provider: 'apple' | 'google';
}

// ── Storage ───────────────────────────────────────────────────────────────────

export async function saveAccountToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(ACCOUNT_TOKEN_KEY, token);
}

export async function getAccountToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCOUNT_TOKEN_KEY);
}

export async function clearAccountToken(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCOUNT_TOKEN_KEY);
  await SecureStore.deleteItemAsync(ACCOUNT_INFO_KEY);
}

export async function saveAccountInfo(info: AccountInfo): Promise<void> {
  await SecureStore.setItemAsync(ACCOUNT_INFO_KEY, JSON.stringify(info));
}

export async function getAccountInfo(): Promise<AccountInfo | null> {
  const raw = await SecureStore.getItemAsync(ACCOUNT_INFO_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ── Network ───────────────────────────────────────────────────────────────────

export async function signInWithAppleOnServer(
  identityToken: string,
  fullName?: string | null,
  email?: string | null,
): Promise<{ ok: boolean; accountToken: string; isNewUser: boolean; account: AccountInfo }> {
  const res = await fetchWithTimeout(`${PROVISION_API_URL}/api/auth/apple`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identityToken, fullName: fullName || undefined, email: email || undefined }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'Apple sign-in failed');
  return data;
}

export async function signInWithGoogleOnServer(
  idToken: string,
): Promise<{ ok: boolean; accountToken: string; isNewUser: boolean; account: AccountInfo }> {
  const res = await fetchWithTimeout(`${PROVISION_API_URL}/api/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'Google sign-in failed');
  return data;
}

export async function fetchAccountAndPairing(
  accountToken: string,
): Promise<{ pairing: PairingData | null; account: AccountInfo }> {
  const res = await fetchWithTimeout(`${PROVISION_API_URL}/api/auth/account`, {
    headers: { Authorization: `Bearer ${accountToken}` },
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'Account fetch failed');
  return data;
}

export async function provisionWithAccountToken(
  accountToken: string,
  onboardingData: Record<string, unknown>,
): Promise<PairingData> {
  const res = await fetchWithTimeout(`${PROVISION_API_URL}/api/auth/provision`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accountToken}`,
    },
    body: JSON.stringify(onboardingData),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'Provisioning failed');
  return data.pairing as PairingData;
}

export async function deleteAccount(accountToken: string): Promise<void> {
  await fetchWithTimeout(`${PROVISION_API_URL}/api/auth/account`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accountToken}` },
  });
}

export async function createInvite(
  accountToken: string,
): Promise<{ inviteCode: string; expiresAt: string }> {
  const res = await fetchWithTimeout(`${PROVISION_API_URL}/api/auth/invite`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accountToken}`,
    },
    body: '{}',
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'Failed to create invite');
  return data;
}

export async function acceptInvite(
  accountToken: string,
  inviteCode: string,
  onboardingData: Record<string, unknown>,
): Promise<PairingData> {
  const res = await fetchWithTimeout(`${PROVISION_API_URL}/api/auth/invite/accept`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accountToken}`,
    },
    body: JSON.stringify({ inviteCode, ...onboardingData }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'Invalid invite code');
  return data.pairing as PairingData;
}
