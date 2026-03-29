import { useRef, useState, useCallback, useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import { ConnectionStatus, PairingData } from './types';

export interface Attachment {
  data: string;      // base64
  mimeType: string;
  fileName: string;
}

interface UseWebSocketReturn {
  status: ConnectionStatus;
  send: (message: string, attachments?: Attachment[], sessionKey?: string) => void;
  sendPushToken: (token: string) => void;
  connect: (pairing: PairingData) => void;
  disconnect: () => void;
  onMessage: (handler: (text: string, isFinal: boolean) => void) => void;
}

let reqId = 0;
function nextId(): string { return `r${++reqId}`; }

export function useWebSocket(): UseWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const pairingRef = useRef<PairingData | null>(null);
  const handlerRef = useRef<((text: string, isFinal: boolean) => void) | null>(null);
  const streamRef = useRef('');
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const healthRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const attemptRef = useRef(0);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');

  // --- Throttle for streaming deltas (Issue 2) ---
  const throttleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDeltaRef = useRef<string | null>(null);

  const flushDelta = useCallback(() => {
    if (pendingDeltaRef.current !== null && handlerRef.current) {
      handlerRef.current(pendingDeltaRef.current, false);
      pendingDeltaRef.current = null;
    }
    throttleTimerRef.current = null;
  }, []);

  const throttledDeltaHandler = useCallback((text: string) => {
    pendingDeltaRef.current = text;
    if (!throttleTimerRef.current) {
      // Fire immediately on first delta, then throttle at ~16ms (~60fps)
      flushDelta();
      throttleTimerRef.current = setTimeout(flushDelta, 16);
    }
  }, [flushDelta]);

  // --- AppState tracking for background notifications (Issue 3) ---
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      // Clear badge when app returns to foreground
      if (nextState === 'active' && appStateRef.current !== 'active') {
        Notifications.setBadgeCountAsync(0).catch(() => {});
      }
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  }, []);

  const cleanup = useCallback(() => {
    if (reconnectRef.current) { clearTimeout(reconnectRef.current); reconnectRef.current = null; }
    if (healthRef.current) { clearInterval(healthRef.current); healthRef.current = null; }
    if (throttleTimerRef.current) { clearTimeout(throttleTimerRef.current); throttleTimerRef.current = null; }
    pendingDeltaRef.current = null;
    if (wsRef.current) {
      const ws = wsRef.current;
      wsRef.current = null;
      ws.onopen = null; ws.onclose = null; ws.onerror = null; ws.onmessage = null;
      try { ws.close(); } catch {}
    }
  }, []);

  const doConnect = useCallback((pairing: PairingData) => {
    cleanup();
    setStatus('connecting');

    const ws = new WebSocket(pairing.url);
    wsRef.current = ws;

    ws.onopen = () => {
      // type: 'req' + method: 'connect' — confirmed working with gateway 2026.3.13
      ws.send(JSON.stringify({
        type: 'req',
        id: nextId(),
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

      // Health keepalive every 25s
      if (healthRef.current) clearInterval(healthRef.current);
      healthRef.current = setInterval(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'req', id: nextId(), method: 'health', params: {} }));
        }
      }, 25000);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Connect success
        if (data.type === 'res' && data.ok === true) {
          setStatus('connected');
          attemptRef.current = 0;
          return;
        }

        // Chat events (streaming)
        if (data.type === 'event' && data.event === 'chat') {
          const p = data.payload;
          if (!p?.message) return;
          const msg = p.message;
          let text = '';
          if (msg.text) text = msg.text;
          else if (Array.isArray(msg.content)) {
            text = msg.content.filter((c: any) => c.type === 'text').map((c: any) => c.text || '').join('');
          }
          if (p.state === 'delta') {
            // Gateway sends accumulated text, not chunks — use = not +=
            streamRef.current = text;
            // Throttled: batch rapid deltas into ~50ms UI updates
            throttledDeltaHandler(streamRef.current);
          } else if (p.state === 'final') {
            // Flush any pending delta before delivering final
            if (throttleTimerRef.current) {
              clearTimeout(throttleTimerRef.current);
              throttleTimerRef.current = null;
            }
            pendingDeltaRef.current = null;
            streamRef.current = '';
            handlerRef.current?.(text, true);

            // --- Background local notification (Issue 3) ---
            if (appStateRef.current !== 'active') {
              Notifications.scheduleNotificationAsync({
                content: {
                  title: 'Wakeel',
                  body: text.length > 200 ? text.slice(0, 200) + '…' : text,
                  sound: 'default',
                },
                trigger: null, // fire immediately
              }).catch(() => {});
            }
          }
        }
      } catch {}
    };

    ws.onerror = () => {};
    ws.onclose = () => {
      setStatus('disconnected');
      streamRef.current = '';
      wsRef.current = null;
      if (healthRef.current) { clearInterval(healthRef.current); healthRef.current = null; }
      if (throttleTimerRef.current) { clearTimeout(throttleTimerRef.current); throttleTimerRef.current = null; }
      pendingDeltaRef.current = null;
      if (pairingRef.current) {
        const delay = Math.min(1000 * Math.pow(2, attemptRef.current), 30000);
        attemptRef.current++;
        reconnectRef.current = setTimeout(() => {
          if (pairingRef.current) doConnect(pairingRef.current);
        }, delay);
      }
    };
  }, [cleanup, throttledDeltaHandler]);

  const connect = useCallback((pairing: PairingData) => {
    pairingRef.current = pairing;
    attemptRef.current = 0;
    doConnect(pairing);
  }, [doConnect]);

  const disconnect = useCallback(() => {
    pairingRef.current = null;
    cleanup();
    setStatus('disconnected');
  }, [cleanup]);

  const send = useCallback((message: string, attachments?: Attachment[], sessionKey?: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const params: Record<string, unknown> = {
        sessionKey: sessionKey || 'main',
        message,
        idempotencyKey: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      };
      if (attachments && attachments.length > 0) {
        params.attachments = attachments;
      }
      wsRef.current.send(JSON.stringify({
        type: 'req',
        id: nextId(),
        method: 'chat.send',
        params,
      }));
    }
  }, []);

  const sendPushToken = useCallback((token: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      // Store Expo push token on gateway via operator.meta.set
      // so the server can use it for push notifications later
      wsRef.current.send(JSON.stringify({
        type: 'req',
        id: nextId(),
        method: 'operator.meta.set',
        params: {
          pushToken: token,
          pushPlatform: 'expo',
        },
      }));
    }
  }, []);

  const onMessage = useCallback((handler: (text: string, isFinal: boolean) => void) => {
    handlerRef.current = handler;
  }, []);

  useEffect(() => { return () => cleanup(); }, [cleanup]);

  return { status, send, sendPushToken, connect, disconnect, onMessage };
}
