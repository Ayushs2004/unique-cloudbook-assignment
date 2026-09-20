import { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { ConnectionStatus, Lead } from '../types/lead';
import { getServerUrl } from '../services/api';

export interface UseLeadSocketOptions {
  serverUrl?: string;
  onNewLead?: (lead: Lead) => void;
  onReconnect?: () => void;
}

export interface UseLeadSocketResult {
  connectionStatus: ConnectionStatus;
  socket: Socket | null;
}

/**
 * Manages Socket.IO lifecycle, tracks connection status, subscribes to "new-lead" events,
 * and notifies on reconnect to allow incremental resync.
 */
export function useLeadSocket(options: UseLeadSocketOptions = {}): UseLeadSocketResult {
  const { serverUrl, onNewLead, onReconnect } = options;
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const socketRef = useRef<Socket | null>(null);

  // Keep references to latest callbacks without triggering reconnects
  const onNewLeadRef = useRef(onNewLead);
  onNewLeadRef.current = onNewLead;

  const onReconnectRef = useRef(onReconnect);
  onReconnectRef.current = onReconnect;

  useEffect(() => {
    const targetUrl = serverUrl || getServerUrl();
    setConnectionStatus('connecting');

    const socketInstance: Socket = io(targetUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socketInstance;

    socketInstance.on('connect', () => {
      setConnectionStatus('connected');
    });

    socketInstance.on('disconnect', () => {
      setConnectionStatus('disconnected');
    });

    socketInstance.on('connect_error', () => {
      setConnectionStatus('disconnected');
    });

    socketInstance.io.on('reconnect_attempt', () => {
      setConnectionStatus('reconnecting');
    });

    socketInstance.io.on('reconnect', () => {
      setConnectionStatus('connected');
      if (onReconnectRef.current) {
        onReconnectRef.current();
      }
    });

    socketInstance.on('new-lead', (lead: Lead) => {
      if (onNewLeadRef.current && lead && lead.id) {
        onNewLeadRef.current(lead);
      }
    });

    return () => {
      socketInstance.removeAllListeners();
      socketInstance.disconnect();
      socketRef.current = null;
    };
  }, [serverUrl]);

  return {
    connectionStatus,
    socket: socketRef.current,
  };
}
