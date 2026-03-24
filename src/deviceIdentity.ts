import * as SecureStore from 'expo-secure-store';
import { getRandomBytes, CryptoDigestAlgorithm, digest as cryptoDigest } from 'expo-crypto';
import nacl from 'tweetnacl';

// Polyfill PRNG for tweetnacl in React Native (Hermes doesn't expose crypto.getRandomValues)
nacl.setPRNG((x: Uint8Array, n: number) => {
  const randomBytes = getRandomBytes(n);
  for (let i = 0; i < n; i++) {
    x[i] = randomBytes[i];
  }
});

const DEVICE_IDENTITY_KEY = 'wakeel_device_identity';

export interface DeviceIdentity {
  deviceId: string;
  publicKeyB64url: string;
  secretKeyB64: string; // stored as base64 in secure store
}

// --- Pure byte-level helpers (no TextEncoder/btoa dependency) ---

function uint8ToBase64(bytes: Uint8Array): string {
  // React Native compatible base64 encoding
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const a = bytes[i];
    const b = i + 1 < len ? bytes[i + 1] : 0;
    const c = i + 2 < len ? bytes[i + 2] : 0;
    result += chars[a >> 2];
    result += chars[((a & 3) << 4) | (b >> 4)];
    result += i + 1 < len ? chars[((b & 15) << 2) | (c >> 6)] : '=';
    result += i + 2 < len ? chars[c & 63] : '=';
  }
  return result;
}

function base64ToUint8(b64: string): Uint8Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/-_';
  // Normalize base64url to base64
  let str = b64.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';

  const len = str.length;
  let bufLen = (len * 3) / 4;
  if (str[len - 1] === '=') bufLen--;
  if (str[len - 2] === '=') bufLen--;

  const bytes = new Uint8Array(bufLen);
  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const a = chars.indexOf(str[i]);
    const b = chars.indexOf(str[i + 1]);
    const c = chars.indexOf(str[i + 2]);
    const d = chars.indexOf(str[i + 3]);
    bytes[p++] = (a << 2) | (b >> 4);
    if (c !== -1 && c !== 64) bytes[p++] = ((b & 15) << 4) | (c >> 2);
    if (d !== -1 && d !== 64) bytes[p++] = ((c & 3) << 6) | d;
  }
  return bytes;
}

function base64ToBase64url(b64: string): string {
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function uint8ToBase64url(bytes: Uint8Array): string {
  return base64ToBase64url(uint8ToBase64(bytes));
}

function stringToUint8(str: string): Uint8Array {
  // Simple UTF-8 encoding for ASCII strings (covers our payload format)
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    bytes[i] = str.charCodeAt(i);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// --- Pure JS SHA-256 (no native dependency) ---

const SHA256_K = new Uint32Array([
  0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
]);

function sha256(data: Uint8Array): Uint8Array {
  const len = data.length;
  // Pre-processing: padding
  const bitLen = len * 8;
  const padLen = ((len + 8) >> 6 << 6) + 64; // next multiple of 64 after len+1+8
  const padded = new Uint8Array(padLen > len + 9 ? padLen : padLen + 64);
  padded.set(data);
  padded[len] = 0x80;
  // Length in bits as 64-bit big-endian (we only support up to 2^32 bits)
  const dv = new DataView(padded.buffer);
  dv.setUint32(padded.length - 4, bitLen, false);

  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
  const w = new Uint32Array(64);

  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(offset + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = ((w[i-15] >>> 7) | (w[i-15] << 25)) ^ ((w[i-15] >>> 18) | (w[i-15] << 14)) ^ (w[i-15] >>> 3);
      const s1 = ((w[i-2] >>> 17) | (w[i-2] << 15)) ^ ((w[i-2] >>> 19) | (w[i-2] << 13)) ^ (w[i-2] >>> 10);
      w[i] = (w[i-16] + s0 + w[i-7] + s1) | 0;
    }
    let a=h0, b=h1, c=h2, d=h3, e=h4, f=h5, g=h6, h=h7;
    for (let i = 0; i < 64; i++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + SHA256_K[i] + w[i]) | 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      h=g; g=f; f=e; e=(d+t1)|0; d=c; c=b; b=a; a=(t1+t2)|0;
    }
    h0=(h0+a)|0; h1=(h1+b)|0; h2=(h2+c)|0; h3=(h3+d)|0;
    h4=(h4+e)|0; h5=(h5+f)|0; h6=(h6+g)|0; h7=(h7+h)|0;
  }
  const out = new Uint8Array(32);
  const ov = new DataView(out.buffer);
  ov.setUint32(0,h0,false); ov.setUint32(4,h1,false); ov.setUint32(8,h2,false); ov.setUint32(12,h3,false);
  ov.setUint32(16,h4,false); ov.setUint32(20,h5,false); ov.setUint32(24,h6,false); ov.setUint32(28,h7,false);
  return out;
}

// --- Device identity management ---

/**
 * Load existing device identity from secure storage, or create a new one.
 * The Ed25519 keypair is persisted so the same device ID is used across sessions.
 */
export async function loadOrCreateDeviceIdentity(): Promise<DeviceIdentity> {
  // Try to load existing identity
  try {
    const stored = await SecureStore.getItemAsync(DEVICE_IDENTITY_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as DeviceIdentity;
      if (parsed.publicKeyB64url && parsed.secretKeyB64) {
        // Always re-derive deviceId from publicKey using native crypto
        // (pure JS SHA-256 may produce wrong results on Hermes)
        const rawKey = base64ToUint8(parsed.publicKeyB64url);
        const hashBuffer = await cryptoDigest(CryptoDigestAlgorithm.SHA256, rawKey);
        const correctDeviceId = bytesToHex(new Uint8Array(hashBuffer));

        if (parsed.deviceId !== correctDeviceId) {
          // Fix stored identity with correct device ID
          parsed.deviceId = correctDeviceId;
          await SecureStore.setItemAsync(DEVICE_IDENTITY_KEY, JSON.stringify(parsed));
        }
        return parsed;
      }
    }
  } catch {
    // Corrupted or missing, regenerate
  }

  // Generate new Ed25519 keypair using tweetnacl
  // tweetnacl uses its own RNG internally
  const keyPair = nacl.sign.keyPair();
  const publicKeyRaw = keyPair.publicKey; // 32 bytes
  const publicKeyB64url = uint8ToBase64url(publicKeyRaw);

  // Device ID = SHA256(raw public key bytes) as hex
  // Must hash raw bytes (not hex string) to match gateway's computation
  // Use native expo-crypto digest for reliable cross-platform hashing
  const hashBuffer = await cryptoDigest(CryptoDigestAlgorithm.SHA256, publicKeyRaw);
  const deviceId = bytesToHex(new Uint8Array(hashBuffer));

  const identity: DeviceIdentity = {
    deviceId,
    publicKeyB64url,
    secretKeyB64: uint8ToBase64(keyPair.secretKey), // 64 bytes (secret + public)
  };

  // Persist to secure storage
  await SecureStore.setItemAsync(DEVICE_IDENTITY_KEY, JSON.stringify(identity));

  return identity;
}

/**
 * Sign the v3 device auth payload with the device's private key.
 */
export function signPayload(identity: DeviceIdentity, payload: string): string {
  const secretKey = base64ToUint8(identity.secretKeyB64);
  const messageBytes = stringToUint8(payload);
  const signature = nacl.sign.detached(messageBytes, secretKey);
  return uint8ToBase64url(signature);
}

/**
 * Build the v3 device auth payload string.
 *
 * Format: v3|deviceId|clientId|clientMode|role|scopes|signedAtMs|token|nonce|platform|deviceFamily
 */
export function buildDeviceAuthPayloadV3(params: {
  deviceId: string;
  clientId: string;
  clientMode: string;
  role: string;
  scopes: string[];
  signedAtMs: number;
  token: string;
  nonce: string;
  platform: string;
  deviceFamily: string;
}): string {
  return [
    'v3',
    params.deviceId,
    params.clientId,
    params.clientMode,
    params.role,
    params.scopes.join(','),
    String(params.signedAtMs),
    params.token,
    params.nonce,
    params.platform,
    params.deviceFamily,
  ].join('|');
}

/**
 * Clear stored device identity (for testing/reset).
 */
export async function clearDeviceIdentity(): Promise<void> {
  await SecureStore.deleteItemAsync(DEVICE_IDENTITY_KEY);
}
