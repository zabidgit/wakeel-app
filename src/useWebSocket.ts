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

  const doConnect = useCallback((pairing: PairingData) => {
    // Clean up any existing connection
    if (reconnectRef.current) {
      clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
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
      const frame = JSON.stringify({
        type: 'req',
        id,
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
      });
      ws.send(frame);
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
