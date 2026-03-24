import { useRef, useState, useCallback, useEffect } from 'react';
import { ConnectionStatus, PairingData } from './types';

// Device identity is optional — loaded in background
let deviceIdentityPromise: Promise<any> | null = null;
let deviceIdentityResult: any = null;

try {
  const { loadOrCreateDeviceIdentity, signPayload: sp, buildDeviceAuthPayloadV3: bap } = require('./deviceIdentity');
  // Start loading immediately on import
  deviceIdentityPromise = loadOrCreateDeviceIdentity()
    .then((d: any) => { deviceIdentityResult = d; return d; })
    .catch(() => null);
  // Export helpers for use below
  (globalThis as any).__wakeel_signPayload = sp;
  (globalThis as any).__wakeel_buildPayloadV3 = bap;
} catch {
  // deviceIdentity module not available — that's fine
}

interface UseWebSocketReturn {
  status: ConnectionStatus;
  send: (message: string) => void;
  connect: (pairing: PairingData) => void;
  disconnect: () => void;
  onMessage: (handler: (text: string, isFinal: boolean) => void) => void;
}

let reqIdCounter = 0;
function nextReqId(): string {
  return `wk-${Date.now()}-${++reqIdCounter}`;
}

// Module-level WebSocket management — no React state during connection
let activeWs: WebSocket | null = null;
let activePairing: PairingData | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempt = 0;
let messageHandler: ((text: string, isFinal: boolean) => void) | null = null;
let statusCallback: ((status: ConnectionStatus) => void) | null = null;
let streamText = '';

function cleanupWs() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (activeWs) {
    activeWs.onopen = null;
    activeWs.onclose = null;
    activeWs.onerror = null;
    activeWs.onmessage = null;
    try { activeWs.close(); } catch {}
    activeWs = null;
  }
}

function scheduleReconnect() {
  if (!activePairing) return;
  const delay = Math.min(1000 * Math.pow(2, reconnectAttempt), 30000);
  reconnectTimer = setTimeout(() => {
    reconnectAttempt++;
    doConnect(activePairing!);
  }, delay);
}

function doConnect(pairing: PairingData) {
  cleanupWs();

  const ws = new WebSocket(pairing.url);
  activeWs = ws;

  if (statusCallback) statusCallback('connecting');

  ws.onopen = () => {
    // Build connect params — SYNCHRONOUS, no async, no await
    const connectParams: any = {
      minProtocol: 3,
      maxProtocol: 3,
      role: 'operator',
      scopes: ['operator.read', 'operator.write', 'operator.admin'],
      auth: { token: pairing.token },
      client: {
        id: 'openclaw-ios',
        mode: 'webchat',
        platform: 'ios',
        version: '1.0.0',
        deviceFamily: 'phone',
      },
    };

    // Attach device identity if available
    const device = deviceIdentityResult;
    if (device) {
      try {
        const signPayload = (globalThis as any).__wakeel_signPayload;
        const buildDeviceAuthPayloadV3 = (globalThis as any).__wakeel_buildPayloadV3;
        if (signPayload && buildDeviceAuthPayloadV3) {
          const nonce = Math.random().toString(36).substring(2, 15);
          const signedAt = Date.now();
          const payloadString = buildDeviceAuthPayloadV3({
            deviceId: device.deviceId,
            clientId: 'openclaw-ios',
            clientMode: 'webchat',
            role: 'operator',
            scopes: ['operator.read', 'operator.write', 'operator.admin'],
            signedAtMs: signedAt,
            token: pairing.token,
            nonce,
            platform: 'ios',
            deviceFamily: 'phone',
          });
          const signature = signPayload(device, payloadString);
          connectParams.device = {
            id: device.deviceId,
            publicKey: device.publicKeyB64url,
            signature,
            signedAt,
            nonce,
          };
        }
      } catch {}
    }

    ws.send(JSON.stringify({
      type: 'req',
      id: nextReqId(),
      method: 'connect',
      params: connectParams,
    }));
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);

      // Handle response frames
      if (data.type === 'res') {
        if (data.ok === true) {
          if (statusCallback) statusCallback('connected');
          reconnectAttempt = 0;
        } else {
          console.warn('Server error:', data.error);
        }
        return;
      }

      // Handle connect acknowledgment (legacy)
      if (data.type === 'connected') {
        if (statusCallback) statusCallback('connected');
        reconnectAttempt = 0;
        return;
      }

      // Handle events
      if (data.type === 'event') {
        if (data.event === 'connect.challenge') {
          // Ignore — we already sent connect in onopen
          return;
        }

        if (data.event === 'chat') {
          const payload = data.payload;
          if (!payload) return;
          const state = payload.state;
          const msg = payload.message;
          if (!msg) return;

          let text = '';
          if (msg.text) {
            text = msg.text;
          } else if (msg.content && Array.isArray(msg.content)) {
            text = msg.content
              .filter((c: any) => c.type === 'text')
              .map((c: any) => c.text || '')
              .join('');
          }

          if (state === 'delta') {
            streamText += text;
            if (messageHandler) messageHandler(streamText, false);
          } else if (state === 'final') {
            streamText = '';
            if (messageHandler) messageHandler(text, true);
          }
          return;
        }

        // Ignore other events
        return;
      }
    } catch {}
  };

  ws.onclose = () => {
    if (statusCallback) statusCallback('disconnected');
    streamText = '';
    if (activePairing) {
      scheduleReconnect();
    }
  };

  ws.onerror = () => {};
}

// Health keepalive — module level
setInterval(() => {
  if (activeWs?.readyState === WebSocket.OPEN) {
    activeWs.send(JSON.stringify({
      type: 'req',
      id: nextReqId(),
      method: 'health',
      params: {},
    }));
  }
}, 30000);

export function useWebSocket(): UseWebSocketReturn {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');

  // Register status callback
  useEffect(() => {
    statusCallback = setStatus;
    return () => { statusCallback = null; };
  }, []);

  const connect = useCallback((pairing: PairingData) => {
    activePairing = pairing;
    reconnectAttempt = 0;
    doConnect(pairing);
  }, []);

  const disconnect = useCallback(() => {
    activePairing = null;
    reconnectAttempt = 0;
    cleanupWs();
    setStatus('disconnected');
  }, []);

  const send = useCallback((message: string) => {
    if (activeWs?.readyState === WebSocket.OPEN) {
      activeWs.send(JSON.stringify({
        type: 'req',
        id: nextReqId(),
        method: 'chat.send',
        params: {
          sessionKey: 'main',
          message,
          idempotencyKey: `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        },
      }));
    }
  }, []);

  const onMessage = useCallback((handler: (text: string, isFinal: boolean) => void) => {
    messageHandler = handler;
  }, []);

  return { status, send, connect, disconnect, onMessage };
}
