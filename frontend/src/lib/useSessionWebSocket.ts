import { useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export interface WebSocketEvent {
  type: string;
  session_id: string;
  data: Record<string, any>;
}

export function useSessionWebSocket(
  sessionId?: string | null,
  onEvent?: (event: WebSocketEvent) => void
) {
  const queryClient = useQueryClient();
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);
  const pingIntervalRef = useRef<any>(null);
  const [isConnected, setIsConnected] = useState(false);

  const connect = useCallback(() => {
    if (!sessionId) return;

    // Determine WebSocket URL based on current host & protocol
    const isHttps = window.location.protocol === 'https:';
    const wsProto = isHttps ? 'wss:' : 'ws:';
    
    // Check if API base URL has a distinct host (e.g. Render vs localhost)
    let wsUrl = '';
    const apiBase = import.meta.env.VITE_API_URL || '';
    if (apiBase.startsWith('http')) {
      const parsed = new URL(apiBase);
      const hostProto = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${hostProto}//${parsed.host}/ws/sessions/${sessionId}`;
    } else {
      wsUrl = `${wsProto}//${window.location.host}/ws/sessions/${sessionId}`;
    }

    try {
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        // Start 25s ping keepalive
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send('ping');
          }
        }, 25000);
      };

      ws.onmessage = (event) => {
        if (event.data === 'pong') return;
        try {
          const parsed: WebSocketEvent = JSON.parse(event.data);
          
          // Instant automated TanStack Query Invalidation
          if (parsed.session_id) {
            queryClient.invalidateQueries({ queryKey: ['hyperbuild-details', parsed.session_id] });
            queryClient.invalidateQueries({ queryKey: ['student-hyperbuild', parsed.session_id] });
          }
          if (parsed.data?.activity_id) {
            queryClient.invalidateQueries({ queryKey: ['hyperbuild-roster', parsed.data.activity_id] });
            queryClient.invalidateQueries({ queryKey: ['hyperbuild-audit', parsed.data.activity_id] });
          }
          queryClient.invalidateQueries({ queryKey: ['sessions'] });

          if (onEvent) {
            onEvent(parsed);
          }
        } catch {
          // Non-JSON message ignore
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        // Reconnect after 3s
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      // Reconnect fallback
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 3000);
    }
  }, [sessionId, queryClient, onEvent]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [connect]);

  return { isConnected };
}
