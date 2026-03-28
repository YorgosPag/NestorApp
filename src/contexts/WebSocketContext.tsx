'use client';

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { generatePendingId } from '@/services/enterprise-id.service';
import WebSocketService, {
  WebSocketEventType,
  WebSocketMessage,
  WebSocketConnectionState
} from '@/services/websocket/WebSocketService';
import { useUserRole } from '@/auth';
import { useCache } from './CacheProvider';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { createModuleLogger } from '@/lib/telemetry';
import '@/lib/design-system';

const logger = createModuleLogger('WebSocketContext');

// ── Re-exports for backward compatibility ──────────
export {
  useWebSocketEvent,
  useRealTimeNotifications,
  useUserPresence,
  WebSocketDebugPanel,
} from './websocket-hooks';

// ============================================================================
// TYPES
// ============================================================================

type WebSocketPayload = Record<string, unknown>;

interface WebSocketStats {
  reconnectAttempts: number;
  queuedMessages: number;
  activeListeners: number;
  connectionAttempts: number;
  pendingListeners: number;
  user: { email: string; role: string } | null;
}

interface WebSocketContextType {
  connectionState: WebSocketConnectionState;
  isConnected: boolean;
  send: (type: WebSocketEventType, payload: WebSocketPayload, options?: {
    targetUsers?: string[];
    metadata?: Record<string, unknown>;
  }) => boolean;
  addEventListener: (
    type: WebSocketEventType | '*',
    handler: (message: WebSocketMessage<WebSocketPayload>) => void,
    options?: { once?: boolean }
  ) => string;
  removeEventListener: (listenerId: string) => boolean;
  getStats: () => WebSocketStats | null;
  reconnect: () => Promise<void>;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

interface WebSocketProviderProps {
  children: React.ReactNode;
  wsUrl?: string;
  enableDevtools?: boolean;
}

// ============================================================================
// TRANSPORT AVAILABILITY DETECTION
// ============================================================================

interface WebSocketTransportConfig {
  readonly isAvailable: boolean;
  readonly url: string;
  readonly disabledReason: string | null;
}

function resolveTransportConfig(): WebSocketTransportConfig {
  const explicitUrl = process.env.NEXT_PUBLIC_WS_URL || '';
  const explicitEnabled = process.env.NEXT_PUBLIC_WS_ENABLED === 'true';
  const isDevelopment = process.env.NODE_ENV === 'development';

  if (explicitEnabled && explicitUrl) {
    return { isAvailable: true, url: explicitUrl, disabledReason: null };
  }

  if (explicitUrl && isDevelopment) {
    return { isAvailable: true, url: explicitUrl, disabledReason: null };
  }

  if (explicitUrl && !isDevelopment && !explicitEnabled) {
    return {
      isAvailable: false,
      url: '',
      disabledReason: 'NEXT_PUBLIC_WS_URL set but NEXT_PUBLIC_WS_ENABLED is not "true" in production',
    };
  }

  if (isDevelopment) {
    return {
      isAvailable: false,
      url: '',
      disabledReason: 'No WebSocket configuration in development — using Firestore real-time listeners',
    };
  }

  return {
    isAvailable: false,
    url: '',
    disabledReason: 'No WebSocket configuration — using Firestore real-time listeners',
  };
}

const WS_TRANSPORT = resolveTransportConfig();

// ============================================================================
// PENDING LISTENER QUEUE
// ============================================================================

interface PendingListener {
  id: string;
  type: WebSocketEventType | '*';
  handler: (message: WebSocketMessage<WebSocketPayload>) => void;
  options?: { once?: boolean };
}

// ============================================================================
// PROVIDER
// ============================================================================

export function WebSocketProvider({
  children,
  wsUrl = WS_TRANSPORT.url,
  enableDevtools = process.env.NODE_ENV === 'development'
}: WebSocketProviderProps) {
  const { user, isAuthenticated } = useUserRole();
  const cache = useCache();
  const _iconSizes = useIconSizes();
  const { quick: _quick } = useBorderTokens();
  const wsRef = useRef<WebSocketService | null>(null);
  const [connectionState, setConnectionState] = useState<WebSocketConnectionState>('disconnected');
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const pendingListenersRef = useRef<PendingListener[]>([]);
  const listenerMapRef = useRef<Map<string, string>>(new Map());

  const initializeWebSocket = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.destroy();
    }

    const ws = new WebSocketService({
      url: wsUrl,
      reconnectAttempts: 5,
      reconnectInterval: 3000,
      heartbeatInterval: 30000,
      enableLogging: enableDevtools
    });

    ws.addMiddleware((message) => {
      if (user) {
        return {
          ...message,
          userId: user.email,
          metadata: { ...message.metadata, userRole: user.role, timestamp: Date.now() }
        };
      }
      return message;
    });

    ws.addMiddleware((message) => {
      const cachableTypes: WebSocketEventType[] = ['task_updated', 'property_updated'];
      if (cachableTypes.includes(message.type)) {
        cache.set(`ws_${message.type}_${message.id}`, message, { ttl: 300000 });
      }
      return message;
    });

    ws.onConnectionStateChange((state) => {
      setConnectionState(state);
      if (state === 'connected') {
        setConnectionAttempts(0);
        if (user) {
          ws.send('user_online', { userId: user.email, role: user.role, timestamp: Date.now() });
        }
      } else if (state === 'reconnecting') {
        setConnectionAttempts(prev => prev + 1);
      }
    });

    wsRef.current = ws;
    return ws;
  }, [wsUrl, enableDevtools, user, cache]);

  // Connect when authenticated AND transport is available
  useEffect(() => {
    if (!WS_TRANSPORT.isAvailable) {
      if (enableDevtools && WS_TRANSPORT.disabledReason) {
        logger.info(`[WebSocket] Transport disabled: ${WS_TRANSPORT.disabledReason}`);
      }
      return;
    }

    if (isAuthenticated && user) {
      const ws = initializeWebSocket();
      ws.connect().catch((error) => {
        logger.warn('[WebSocket] Connection failed', { error });
      });

      return () => {
        if (ws.isConnected()) {
          ws.send('user_offline', { userId: user.email, timestamp: Date.now() });
        }
        ws.destroy();
      };
    }
  }, [isAuthenticated, user, initializeWebSocket, enableDevtools]);

  // Flush pending listeners when WebSocket is ready
  useEffect(() => {
    if (wsRef.current && pendingListenersRef.current.length > 0) {
      const ws = wsRef.current;
      pendingListenersRef.current.forEach((pending) => {
        const realId = ws.addEventListener(pending.type, pending.handler, pending.options);
        listenerMapRef.current.set(pending.id, realId);
      });
      pendingListenersRef.current = [];
    }
  }, [wsRef.current, enableDevtools]);

  // Handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!wsRef.current || !user) return;
      const status = document.hidden ? 'away' : 'online';
      wsRef.current.send('user_status', { userId: user.email, status, timestamp: Date.now() });
    };

    const handleBeforeUnload = () => {
      if (wsRef.current && user) {
        wsRef.current.send('user_offline', { userId: user.email, timestamp: Date.now() });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [user]);

  // Context methods
  const send = useCallback((
    type: WebSocketEventType,
    payload: WebSocketPayload,
    options?: { targetUsers?: string[]; metadata?: Record<string, unknown> }
  ) => {
    if (!wsRef.current) {
      logger.warn('WebSocket not initialized');
      return false;
    }
    return wsRef.current.send(type, payload, options);
  }, []);

  const addEventListener = useCallback((
    type: WebSocketEventType | '*',
    handler: (message: WebSocketMessage<WebSocketPayload>) => void,
    options?: { once?: boolean }
  ) => {
    if (!wsRef.current) {
      const pendingId = generatePendingId();
      pendingListenersRef.current.push({ id: pendingId, type, handler, options });
      return pendingId;
    }
    return wsRef.current.addEventListener(type, handler, options);
  }, [enableDevtools]);

  const removeEventListener = useCallback((listenerId: string) => {
    if (listenerId.startsWith('pending-')) {
      const index = pendingListenersRef.current.findIndex((p) => p.id === listenerId);
      if (index !== -1) {
        pendingListenersRef.current.splice(index, 1);
        return true;
      }

      const realId = listenerMapRef.current.get(listenerId);
      if (realId && wsRef.current) {
        listenerMapRef.current.delete(listenerId);
        return wsRef.current.removeEventListener(realId);
      }

      return false;
    }

    if (!wsRef.current) return false;
    return wsRef.current.removeEventListener(listenerId);
  }, [enableDevtools]);

  const getStats = useCallback(() => {
    const baseStats = wsRef.current ? wsRef.current.getStats() : {
      reconnectAttempts: 0, queuedMessages: 0, activeListeners: 0
    };

    return {
      ...baseStats,
      connectionAttempts,
      pendingListeners: pendingListenersRef.current.length,
      user: user ? { email: user.email, role: user.role } : null
    };
  }, [connectionAttempts, user]);

  const reconnect = useCallback(async () => {
    if (!WS_TRANSPORT.isAvailable) {
      logger.info('[WebSocket] Reconnect skipped -- transport not available');
      return;
    }
    if (!wsRef.current) {
      initializeWebSocket();
    }
    if (wsRef.current) {
      await wsRef.current.connect();
    }
  }, [initializeWebSocket]);

  const value: WebSocketContextType = {
    connectionState,
    isConnected: connectionState === 'connected',
    send,
    addEventListener,
    removeEventListener,
    getStats,
    reconnect
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
}
