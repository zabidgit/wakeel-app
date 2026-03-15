import { useRef, useState, useCallback, useEffect } from 'react';
import { ConnectionStatus, PairingData } from './types';

interface UseWebSocketReturn {
  status: ConnectionStatus;
  send: (message: string) => void;
  connect: (pairing: PairingData) => void;
  disconnect: () => void;
  onMessage: (handler: (text: string) => void) => void;
}

export function useWebSocket(): UseWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const pairingRef = useRef<PairingData | null>(null);
  const messageHandlerRef = useRef<((text: string) => void) | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');

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
    const delay = Math.min(1000 * Math.pow(2, attempt), 30000); // Max 30s
    reconnectTimerRef.current = setTimeout(() => {
      reconnectAttemptRef.current = attempt + 1;
      connectInternal(pairingRef.current!);
    }, delay);
  }, []);

  const connectInternal = useCallback((pairing: PairingData) => {
    cleanup();
    setStatus('connecting');

    try {
      const ws = new WebSocket(pairing.url);
      wsRef.current = ws;

      ws.onopen = () => {
        // Send auth token
        ws.send(JSON.stringify({
          type: 'auth',
          token: pairing.token,
        }));
        setStatus('connected');
        reconnectAttemptRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // Handle different message types from OpenClaw
          if (data.type === 'message' || data.type === 'reply') {
            const text = data.text || data.message || data.content || '';
            if (text && messageHandlerRef.current) {
              messageHandlerRef.current(text);
            }
          } else if (data.type === 'error') {
            console.warn('WebSocket error from server:', data.message);
          }
        } catch {
          // Plain text message
          if (event.data && messageHandlerRef.current) {
            messageHandlerRef.current(event.data);
          }
        }
      };

      ws.onclose = () => {
        setStatus('disconnected');
        scheduleReconnect();
      };

      ws.onerror = (error) => {
        console.warn('WebSocket error:', error);
        setStatus('disconnected');
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
        type: 'message',
        text: message,
      }));
    }
  }, []);

  const onMessage = useCallback((handler: (text: string) => void) => {
    messageHandlerRef.current = handler;
  }, []);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  return { status, send, connect, disconnect, onMessage };
}
