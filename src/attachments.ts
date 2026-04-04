import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
// @ts-ignore — expo-file-system/legacy exports are correct at runtime
import { readAsStringAsync } from 'expo-file-system/legacy';
import { fetchWithTimeout } from './fetchWithTimeout';

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
    base64: false, // Don't get base64 yet — we'll convert first
    exif: false,
  });

  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];

  // Force convert to JPEG via expo-image-manipulator — guarantees no HEIC
  const manipulated = await manipulateAsync(
    asset.uri,
    [], // no transforms, just re-encode
    { compress: 0.7, format: SaveFormat.JPEG, base64: true }
  );

  const fileName = (asset.fileName || `photo-${Date.now()}`)
    .replace(/\.(heic|heif)$/i, '.jpg')
    .replace(/(?<!\.\w+)$/, '.jpg'); // ensure .jpg extension

  return {
    uri: manipulated.uri,
    base64: manipulated.base64 || '',
    mimeType: 'image/jpeg',
    fileName,
  };
}

export async function takePhoto(): Promise<AttachmentResult | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') return null;

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: false,
    quality: 0.7,
    base64: false,
  });

  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];

  // Force convert to JPEG via expo-image-manipulator
  const manipulated = await manipulateAsync(
    asset.uri,
    [],
    { compress: 0.7, format: SaveFormat.JPEG, base64: true }
  );

  return {
    uri: manipulated.uri,
    base64: manipulated.base64 || '',
    mimeType: 'image/jpeg',
    fileName: asset.fileName || `camera-${Date.now()}.jpg`,
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
    
    const response = await fetchWithTimeout(uploadUrl, {
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
    }, 30000); // 30s — attachments can be large

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
