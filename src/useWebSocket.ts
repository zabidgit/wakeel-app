import { useRef, useState, useCallback, useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { ConnectionStatus, PairingData } from './types';

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

export function useWebSocket(): UseWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const healthTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const pairingRef = useRef<PairingData | null>(null);
  const messageHandlerRef = useRef<((text: string, isFinal: boolean) => void) | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const streamTextRef = useRef<string>('');
  const connectingRef = useRef(false);

  const cleanup = useCallback(() => {
    connectingRef.current = false;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (healthTimerRef.current) {
      clearInterval(healthTimerRef.current);
      healthTimerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;
      try { wsRef.current.close(); } catch {}
      wsRef.current = null;
    }
  }, []);

  const connectInternal = useCallback((pairing: PairingData) => {
    // Don't stomp an in-progress connection
    if (connectingRef.current && wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }
    cleanup();
    setStatus('connecting');
    connectingRef.current = true;

    const ws = new WebSocket(pairing.url);
    wsRef.current = ws;

    ws.onopen = () => {
      connectingRef.current = false;

      // Build connect params synchronously — no async in onopen
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

      // Attach device identity if already loaded
      try {
        const device = deviceIdentityCache;
        if (device) {
          const signPayload = cachedSignPayload;
          const buildPayloadV3 = cachedBuildPayloadV3;
          if (signPayload && buildPayloadV3) {
            const nonce = Math.random().toString(36).substring(2, 15);
            const signedAt = Date.now();
            const payloadString = buildPayloadV3({
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
        }
      } catch {}

      ws.send(JSON.stringify({
        type: 'req',
        id: nextReqId(),
        method: 'connect',
        params: connectParams,
      }));

      // Start health keepalive
      if (healthTimerRef.current) clearInterval(healthTimerRef.current);
      healthTimerRef.current = setInterval(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'req',
            id: nextReqId(),
            method: 'health',
            params: {},
          }));
        }
      }, 30000);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Handle response frames
        if (data.type === 'res') {
          if (data.ok === true) {
            setStatus('connected');
            reconnectAttemptRef.current = 0;
          } else {
            console.warn('Server error:', data.error);
          }
          return;
        }

        // Handle legacy connected frame
        if (data.type === 'connected') {
          setStatus('connected');
          reconnectAttemptRef.current = 0;
          return;
        }

        // Handle events
        if (data.type === 'event') {
          if (data.event === 'connect.challenge') {
            return; // Already sent connect in onopen
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
              streamTextRef.current += text;
              if (messageHandlerRef.current) {
                messageHandlerRef.current(streamTextRef.current, false);
              }
            } else if (state === 'final') {
              streamTextRef.current = '';
              if (messageHandlerRef.current) {
                messageHandlerRef.current(text, true);
              }
            }
            return;
          }
        }
      } catch {}
    };

    ws.onclose = () => {
      connectingRef.current = false;
      setStatus('disconnected');
      streamTextRef.current = '';
      // Only reconnect if we still want to be connected
      if (pairingRef.current) {
        const attempt = reconnectAttemptRef.current;
        const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
        reconnectTimerRef.current = setTimeout(() => {
          reconnectAttemptRef.current = attempt + 1;
          if (pairingRef.current) {
            connectInternal(pairingRef.current);
          }
        }, delay);
      }
    };

    ws.onerror = () => {
      // onclose will fire after this
    };
  }, [cleanup]);

  // Handle app state changes (background/foreground)
  useEffect(() => {
    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === 'active' && pairingRef.current && !wsRef.current) {
        // App came back to foreground with no active WS — reconnect
        reconnectAttemptRef.current = 0;
        connectInternal(pairingRef.current);
      }
    };
    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, [connectInternal]);

  const connect = useCallback((pairing: PairingData) => {
    pairingRef.current = pairing;
    reconnectAttemptRef.current = 0;
    connectInternal(pairing);
  }, [connectInternal]);

  const disconnect = useCallback(() => {
    pairingRef.current = null;
    reconnectAttemptRef.current = 0;
    cleanup();
    setStatus('disconnected');
  }, [cleanup]);

  const send = useCallback((message: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
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
    messageHandlerRef.current = handler;
  }, []);

  // Cleanup on unmount — but DON'T disconnect (we want persistence)
  useEffect(() => {
    return () => {
      // Only clean up timers, not the WS itself
      if (healthTimerRef.current) clearInterval(healthTimerRef.current);
    };
  }, []);

  return { status, send, connect, disconnect, onMessage };
}

// --- Device identity loading (module-level, starts on import) ---
let deviceIdentityCache: any = null;
let cachedSignPayload: any = null;
let cachedBuildPayloadV3: any = null;

try {
  const {
    loadOrCreateDeviceIdentity,
    signPayload,
    buildDeviceAuthPayloadV3,
  } = require('./deviceIdentity');

  cachedSignPayload = signPayload;
  cachedBuildPayloadV3 = buildDeviceAuthPayloadV3;

  // Start loading immediately — by the time user navigates to chat, it'll be ready
  loadOrCreateDeviceIdentity()
    .then((d: any) => { deviceIdentityCache = d; })
    .catch(() => { /* device identity unavailable — token auth still works */ });
} catch {
  // deviceIdentity module not available in this build
}
