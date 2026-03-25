import { useRef, useState, useCallback, useEffect } from 'react';
import { ConnectionStatus, PairingData } from './types';

/**
 * Minimal WebSocket hook — stripped to absolute basics.
 * No device identity, no health keepalive, no fancy reconnect.
 * Goal: prove the connection works, then add features back.
 */

interface UseWebSocketReturn {
  status: ConnectionStatus;
  send: (message: string) => void;
  connect: (pairing: PairingData) => void;
  disconnect: () => void;
  onMessage: (handler: (text: string, isFinal: boolean) => void) => void;
}

let reqId = 0;

export function useWebSocket(): UseWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const pairingRef = useRef<PairingData | null>(null);
  const handlerRef = useRef<((text: string, isFinal: boolean) => void) | null>(null);
  const streamRef = useRef('');
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);
  const mountedRef = useRef(true);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');

  // Track mount state
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const healthRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const doConnect = useCallback((pairing: PairingData) => {
    // Clean up any existing connection
    if (reconnectRef.current) {
      clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
    }
    if (healthRef.current) {
      clearInterval(healthRef.current);
      healthRef.current = null;
    }
    if (wsRef.current) {
      const old = wsRef.current;
      wsRef.current = null;
      old.onopen = null;
      old.onclose = null;
      old.onerror = null;
      old.onmessage = null;
      try { old.close(); } catch {}
    }

    if (mountedRef.current) setStatus('connecting');

    const ws = new WebSocket(pairing.url);
    wsRef.current = ws;

    ws.onopen = () => {
      // Send connect frame — completely synchronous, no async
      const id = `r${++reqId}`;
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

      // Attach device identity if loaded
      try {
        if (deviceIdentityCache && cachedSignPayload && cachedBuildPayloadV3) {
          const d = deviceIdentityCache;
          const nonce = Math.random().toString(36).substring(2, 15);
          const signedAt = Date.now();
          const payload = cachedBuildPayloadV3({
            deviceId: d.deviceId,
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
          connectParams.device = {
            id: d.deviceId,
            publicKey: d.publicKeyB64url,
            signature: cachedSignPayload(d, payload),
            signedAt,
            nonce,
          };
        }
      } catch {}

      ws.send(JSON.stringify({ type: 'req', id, method: 'connect', params: connectParams }));

      // Start health keepalive every 25s (server expects within 30s)
      if (healthRef.current) clearInterval(healthRef.current);
      healthRef.current = setInterval(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'req',
            id: `r${++reqId}`,
            method: 'health',
            params: {},
          }));
        }
      }, 25000);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'res' && data.ok === true) {
          if (mountedRef.current) setStatus('connected');
          attemptRef.current = 0;
          return;
        }

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
            streamRef.current += text;
            handlerRef.current?.(streamRef.current, false);
          } else if (p.state === 'final') {
            streamRef.current = '';
            handlerRef.current?.(text, true);
          }
        }
      } catch {}
    };

    ws.onerror = () => {};

    ws.onclose = () => {
      if (mountedRef.current) setStatus('disconnected');
      streamRef.current = '';
      wsRef.current = null;
      // Reconnect if we still have a pairing
      if (pairingRef.current) {
        const delay = Math.min(1000 * Math.pow(2, attemptRef.current), 30000);
        attemptRef.current++;
        reconnectRef.current = setTimeout(() => {
          if (pairingRef.current) doConnect(pairingRef.current);
        }, delay);
      }
    };
  }, []);

  const connect = useCallback((pairing: PairingData) => {
    pairingRef.current = pairing;
    attemptRef.current = 0;
    doConnect(pairing);
  }, [doConnect]);

  const disconnect = useCallback(() => {
    pairingRef.current = null;
    if (reconnectRef.current) {
      clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
    }
    if (healthRef.current) {
      clearInterval(healthRef.current);
      healthRef.current = null;
    }
    if (wsRef.current) {
      const ws = wsRef.current;
      wsRef.current = null;
      ws.onopen = null;
      ws.onclose = null;
      ws.onerror = null;
      ws.onmessage = null;
      try { ws.close(); } catch {}
    }
    if (mountedRef.current) setStatus('disconnected');
  }, []);

  const send = useCallback((message: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'req',
        id: `r${++reqId}`,
        method: 'chat.send',
        params: {
          sessionKey: 'main',
          message,
          idempotencyKey: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        },
      }));
    }
  }, []);

  const onMessage = useCallback((handler: (text: string, isFinal: boolean) => void) => {
    handlerRef.current = handler;
  }, []);

  return { status, send, connect, disconnect, onMessage };
}
