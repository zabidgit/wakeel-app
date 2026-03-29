import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
// @ts-ignore — expo-file-system/legacy exports are correct at runtime
import { readAsStringAsync } from 'expo-file-system/legacy';
import * as FileSystem from 'expo-file-system';

// Lazy-load expo-audio to prevent startup crashes if native module has issues
let _audioModule: typeof import('expo-audio') | null = null;
async function getAudioModule() {
  if (!_audioModule) {
    _audioModule = await import('expo-audio');
  }
  return _audioModule;
}

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
    const { AudioModule, RecordingPresets, setAudioModeAsync } = await getAudioModule();

    const status = await AudioModule.requestRecordingPermissionsAsync();
    if (!status.granted) return null;

    await setAudioModeAsync({
      playsInSilentMode: true,
      allowsRecording: true,
    });

    const recorder = new AudioModule.AudioRecorder(RecordingPresets.HIGH_QUALITY);
    await recorder.prepareToRecordAsync();
    recorder.record();

    return {
      stop: async () => {
        try {
          await recorder.stop();
          await setAudioModeAsync({ allowsRecording: false });
          const uri = recorder.uri;
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
          await recorder.stop();
          await setAudioModeAsync({ allowsRecording: false });
          const uri = recorder.uri;
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
