import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
// @ts-ignore — expo-file-system/legacy exports are correct at runtime
import { readAsStringAsync } from 'expo-file-system/legacy';

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
  });

  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  const fileName = asset.fileName || `photo-${Date.now()}.jpg`;
  const mimeType = asset.mimeType || 'image/jpeg';

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
