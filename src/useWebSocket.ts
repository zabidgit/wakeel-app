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

    // Pre-load device identity (non-blocking — connect works without it)
    if (!deviceRef.current) {
      loadOrCreateDeviceIdentity()
        .then(d => { deviceRef.current = d; })
        .catch(() => {}); // silently ignore — device auth is optional
    }

    try {
      const ws = new WebSocket(pairing.url);
      wsRef.current = ws;

      ws.onopen = () => {
        // SYNC onopen — no async, no await, guaranteed to execute
        try {
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

          const device = deviceRef.current;
          if (device) {
            try {
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
            } catch (e) {
              // Device auth failed — connect without it
            }
          }

          ws.send(JSON.stringify({
            type: 'req',
            id: nextReqId(),
            method: 'connect',
            params: connectParams,
          }));
        } catch (err) {
          // Last resort fallback
          try {
            ws.send(JSON.stringify({
              type: 'req',
              id: nextReqId(),
              method: 'connect',
              params: {
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
              },
            }));
          } catch {}
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Handle response frames (connect ack, chat.send ack, health ack)
          if (data.type === 'res') {
            if (data.ok === true) {
              // Successful response — check if it's the connect response
              if (data.result?.connected || data.method === 'connect') {
                setStatus('connected');
                reconnectAttemptRef.current = 0;
              }
              // Other successful responses (chat.send, health) — ignore
            } else if (data.ok === false) {
              console.warn('Server error response:', data.error);
            }
            return;
          }

          // Handle connect acknowledgment (legacy format)
          if (data.type === 'connected') {
            setStatus('connected');
            reconnectAttemptRef.current = 0;
            return;
          }

          // Handle pairing pending (device needs approval)
          if (data.type === 'event' && data.event === 'device.pairingPending') {
            setStatus('pairing_pending');
            return;
          }

          // Handle pairing approved
          if (data.type === 'event' && data.event === 'device.paired') {
            setStatus('connected');
            return;
          }

          // Handle error responses (legacy format)
          if (data.type === 'error') {
            console.warn('Server error:', data.message || data.error);
            if (data.id) return;
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
              // Accumulate streaming text
              streamTextRef.current += text;
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

  // Health keepalive
  useEffect(() => {
    const interval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'req',
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
