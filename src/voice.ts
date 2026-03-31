/**
 * Voice recording & transcription module for Wakeel.
 *
 * Uses expo-audio (SDK 55) for recording and sends audio to the server-side
 * Whisper transcription endpoint.
 */

import {
  AudioModule,
  RecordingPresets,
  type RecordingOptions,
} from 'expo-audio';
// @ts-ignore — expo-file-system/legacy exports are correct at runtime
import { readAsStringAsync } from 'expo-file-system/legacy';

// ─── Recording preset ────────────────────────────────────────────────────────
// Use the built-in HIGH_QUALITY preset directly — custom overrides were causing
// "Failed to prepare recorder" errors on iOS. HIGH_QUALITY produces m4a/AAC
// at 44.1kHz stereo which Whisper handles fine.
export const WHISPER_RECORDING_PRESET: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  android: {
    outputFormat: 'mpeg4',
    audioEncoder: 'aac',
  },
};

// ─── Permission ──────────────────────────────────────────────────────────────

export async function requestMicPermission(): Promise<boolean> {
  try {
    const status = await AudioModule.requestRecordingPermissionsAsync();
    return status.granted;
  } catch {
    return false;
  }
}

// ─── Read recorded file as base64 ───────────────────────────────────────────

export async function readRecordingAsBase64(
  uri: string,
): Promise<string | null> {
  try {
    const base64 = await readAsStringAsync(uri, { encoding: 'base64' as any });
    return base64 || null;
  } catch {
    return null;
  }
}

// ─── Transcription ───────────────────────────────────────────────────────────

export async function transcribeAudio(
  audioBase64: string,
  gatewayOrigin: string,
  authToken: string,
): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const url = `${gatewayOrigin.replace(/\/$/, '')}/api/transcribe`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ audio: audioBase64, mimeType: 'audio/m4a' }),
      signal: controller.signal,
    });

    if (!res.ok) return null;

    const data = await res.json();
    if (!data?.ok || !data?.text?.trim()) return null;

    return data.text.trim();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
