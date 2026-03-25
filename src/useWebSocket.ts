import { useRef, useState, useCallback, useEffect } from 'react';
import { ConnectionStatus, PairingData } from './types';
import {
  loadOrCreateDeviceIdentity,
  signPayload,
  buildDeviceAuthPayloadV3,
  DeviceIdentity,
} from './deviceIdentity';

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
  const reconnectAttemptRef = useRef(0);
  const pairingRef = useRef<PairingData | null>(null);
  const deviceRef = useRef<DeviceIdentity | null>(null);
  const messageHandlerRef = useRef<((text: string, isFinal: boolean) => void) | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  // Track accumulated streaming text per message
  const streamTextRef = useRef<string>('');

  const cleanup = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (!pairingRef.current) return;
    const attempt = reconnectAttemptRef.current;
    const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
    reconnectTimerRef.current = setTimeout(() => {
      reconnectAttemptRef.current = attempt + 1;
      connectInternal(pairingRef.current!);
    }, delay);
  }, []);

  const connectInternal = useCallback(async (pairing: PairingData) => {
    cleanup();
    setStatus('connecting');

    try {
      // Load or create device identity
      if (!deviceRef.current) {
        try {
          deviceRef.current = await loadOrCreateDeviceIdentity();
        } catch (err) {
          console.warn('Failed to load device identity:', err);
        }
      }
      const device = deviceRef.current;

      const ws = new WebSocket(pairing.url);
      wsRef.current = ws;

      ws.onopen = async () => {
        try {
          if (device) {
            // Build device auth payload
            const nonce = Math.random().toString(36).substring(2, 15);
            const signedAt = Date.now();
            const role = 'operator';
            const scopes = ['operator.read', 'operator.write', 'operator.admin'];

            const payloadString = buildDeviceAuthPayloadV3({
              deviceId: device.deviceId,
              clientId: 'openclaw-ios',
              clientMode: 'webchat',
              role,
              scopes,
              signedAtMs: signedAt,
              token: pairing.token,
              nonce,
              platform: 'ios',
              deviceFamily: 'phone',
            });

            const signature = signPayload(device, payloadString);

            // Send connect frame with device identity
            ws.send(JSON.stringify({
              type: 'connect',
              token: pairing.token,
              minProtocol: 3,
              maxProtocol: 3,
              role,
              scopes,
              mode: 'webchat',
              client: {
                id: 'openclaw-ios',
                platform: 'ios',
                version: '1.0.0',
                deviceFamily: 'phone',
              },
              device: {
                id: device.deviceId,
                publicKey: device.publicKeyB64url,
                signature,
                signedAt,
                nonce,
              },
            }));
          } else {
            // Fallback: connect without device identity
            ws.send(JSON.stringify({
              type: 'connect',
              token: pairing.token,
              minProtocol: 3,
              maxProtocol: 3,
              role: 'operator',
              scopes: ['operator.read', 'operator.write', 'operator.admin'],
              mode: 'webchat',
              client: {
                id: 'openclaw-ios',
                platform: 'ios',
                version: '1.0.0',
                deviceFamily: 'phone',
              },
            }));
          }
        } catch (err) {
          console.warn('Failed to build auth payload:', err);
          // Fallback: send simple connect without device
          ws.send(JSON.stringify({
            type: 'connect',
            token: pairing.token,
            minProtocol: 3,
            maxProtocol: 3,
            role: 'operator',
            scopes: ['operator.read', 'operator.write', 'operator.admin'],
            mode: 'webchat',
            client: {
              id: 'openclaw-ios',
              platform: 'ios',
              version: '1.0.0',
              deviceFamily: 'phone',
            },
          }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Handle connect acknowledgment
          if (data.type === 'connected') {
            setStatus('connected');
            reconnectAttemptRef.current = 0;
            return;
          }

          // Handle pairing pending (device needs approval)
          if (data.type === 'connected' && data.pairingPending) {
            setStatus('pairing_pending');
            return;
          }

          // Handle pairing approved
          if (data.type === 'event' && data.event === 'device.paired') {
            setStatus('connected');
            return;
          }

          // Handle error responses
          if (data.type === 'error') {
            console.warn('Server error:', data.message || data.error);
            if (data.id) return; // Response to a request — ignore
            return;
          }

          // Handle chat events (streaming)
          if (data.type === 'event' && data.event === 'chat') {
            const payload = data.payload;
            if (!payload) return;

            const state = payload.state; // 'delta' or 'final'
            const msg = payload.message;
            if (!msg) return;

            // Extract text from message
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
              // Gateway sends full accumulated text in each delta, not just new chunks
              streamTextRef.current = text;
              if (messageHandlerRef.current) {
                messageHandlerRef.current(streamTextRef.current, false);
              }
            } else if (state === 'final') {
              // Final message — use the full text from final payload
              streamTextRef.current = '';
              if (messageHandlerRef.current) {
                messageHandlerRef.current(text, true);
              }
            }
            return;
          }

          // Handle response to requests (chat.send ack, health ack, etc.)
          if (data.type === 'response') {
            // Ignore acks
            return;
          }

        } catch {
          // Ignore unparseable messages
        }
      };

      ws.onclose = () => {
        setStatus('disconnected');
        streamTextRef.current = '';
        if (pairingRef.current) {
          scheduleReconnect();
        }
      };

      ws.onerror = (error) => {
        console.warn('WebSocket error:', error);
      };
    } catch (error) {
      console.warn('Failed to create WebSocket:', error);
      setStatus('disconnected');
      scheduleReconnect();
    }
  }, [cleanup, scheduleReconnect]);

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
        type: 'request',
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

  // Health keepalive
  useEffect(() => {
    const interval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'request',
          id: nextReqId(),
          method: 'health',
          params: {},
        }));
      }
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  return { status, send, connect, disconnect, onMessage };
}
