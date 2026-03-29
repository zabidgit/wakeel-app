import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
// @ts-ignore — expo-file-system/legacy exports are correct at runtime
import { readAsStringAsync } from 'expo-file-system/legacy';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

export interface AttachmentResult {
  uri: string;
  base64: string;
  mimeType: string;
  fileName: string;
}

export async function pickImage(): Promise<AttachmentResult | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 0.7,
    base64: true,
    // Force JPEG output — avoids HEIC which servers can't decode
    exif: false,
  });

  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  // Always normalize to JPEG — Expo converts HEIC to JPEG for base64 but keeps the original mimeType
  const isHEIC = (asset.mimeType || '').toLowerCase().includes('heic') ||
                 (asset.fileName || '').toLowerCase().endsWith('.heic');
  const fileName = isHEIC
    ? (asset.fileName || `photo-${Date.now()}`).replace(/\.heic$/i, '.jpg')
    : (asset.fileName || `photo-${Date.now()}.jpg`);
  const mimeType = isHEIC ? 'image/jpeg' : (asset.mimeType || 'image/jpeg');

  return {
    uri: asset.uri,
    base64: asset.base64 || '',
    mimeType,
    fileName,
  };
}

export async function takePhoto(): Promise<AttachmentResult | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') return null;

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: false,
    quality: 0.7,
    base64: true,
  });

  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  const fileName = asset.fileName || `camera-${Date.now()}.jpg`;
  const mimeType = asset.mimeType || 'image/jpeg';

  return {
    uri: asset.uri,
    base64: asset.base64 || '',
    mimeType,
    fileName,
  };
}

/**
 * Upload an attachment to the gateway's media upload server.
 * Returns the server-side file path for use in [media attached] tags.
 */
export async function uploadAttachment(
  attachment: AttachmentResult,
  gatewayOrigin: string,
  authToken: string,
): Promise<{ path: string; mimeType: string } | null> {
  try {
    const uploadUrl = `${gatewayOrigin.replace(/\/$/, '')}/upload`;
    
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        data: attachment.base64,
        mimeType: attachment.mimeType,
        fileName: attachment.fileName,
      }),
    });

    if (!response.ok) {
      console.error('Upload failed:', response.status);
      return null;
    }

    const result = await response.json();
    return {
      path: result.path,
      mimeType: result.mimeType,
    };
  } catch (error) {
    console.error('Upload error:', error);
    return null;
  }
}

// ─── Voice Recording ──────────────────────────────────────────────────────────

export interface RecordingHandle {
  stop: () => Promise<{ uri: string; base64: string; mimeType: string } | null>;
  cancel: () => Promise<void>;
}

export async function startRecording(): Promise<RecordingHandle | null> {
  try {
    const { status } = await Audio.requestPermissionsAsync();
    if (status !== 'granted') return null;

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    const recording = new Audio.Recording();
    await recording.prepareToRecordAsync({
      android: {
        extension: '.m4a',
        outputFormat: 2, // MPEG_4
        audioEncoder: 3, // AAC
        sampleRate: 16000,
        numberOfChannels: 1,
        bitRate: 64000,
      },
      ios: {
        extension: '.m4a',
        outputFormat: 'aac',
        audioQuality: 96,
        sampleRate: 16000,
        numberOfChannels: 1,
        bitRate: 64000,
        linearPCMBitDepth: 16,
        linearPCMIsBigEndian: false,
        linearPCMIsFloat: false,
      },
      web: {},
    });
    await recording.startAsync();

    return {
      stop: async () => {
        try {
          await recording.stopAndUnloadAsync();
          await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
          const uri = recording.getURI();
          if (!uri) return null;
          const base64 = await FileSystem.readAsStringAsync(uri, {
            encoding: 'base64' as any,
          });
          // Clean up temp file
          try { await FileSystem.deleteAsync(uri, { idempotent: true }); } catch {}
          return { uri, base64, mimeType: 'audio/m4a' };
        } catch (e) {
          console.error('Stop recording error:', e);
          return null;
        }
      },
      cancel: async () => {
        try {
          await recording.stopAndUnloadAsync();
          await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
          const uri = recording.getURI();
          if (uri) await FileSystem.deleteAsync(uri, { idempotent: true });
        } catch {}
      },
    };
  } catch (e) {
    console.error('Start recording error:', e);
    return null;
  }
}

export async function transcribeAudio(
  audio: { base64: string; mimeType: string },
  gatewayOrigin: string,
  authToken: string,
): Promise<string | null> {
  try {
    const response = await fetch(`${gatewayOrigin.replace(/\/$/, '')}/api/transcribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({ audio: audio.base64, mimeType: audio.mimeType }),
    });
    if (!response.ok) return null;
    const result = await response.json();
    return result.ok ? result.text : null;
  } catch (e) {
    console.error('Transcribe error:', e);
    return null;
  }
}

export async function pickDocument(): Promise<AttachmentResult | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];

  // Read file as base64
  let base64 = '';
  try {
    base64 = await readAsStringAsync(asset.uri, {
      encoding: 'base64' as any,
    });
  } catch (error) {
    console.error('Failed to read document:', error);
    return null;
  }

  return {
    uri: asset.uri,
    base64,
    mimeType: asset.mimeType || 'application/octet-stream',
    fileName: asset.name || `file-${Date.now()}`,
  };
}
