'use client';

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import WebSocketService, {
  WebSocketEventType,
  WebSocketMessage,
  WebSocketConnectionState
} from '@/services/websocket/WebSocketService';
import { useUserRole } from '@/auth';
import { useCache } from './CacheProvider';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { COLOR_BRIDGE } from '@/design-system/color-bridge';

/** WebSocket payload type for type-safe messaging */
type WebSocketPayload = Record<string, unknown>;

/** WebSocket statistics interface */
interface WebSocketStats {
  reconnectAttempts: number;
  queuedMessages: number;
  activeListeners: number;
  connectionAttempts: number;
  pendingListeners: number; // 🆕 ENTERPRISE: Pending listeners count
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

// 🏢 ENTERPRISE: Pending Listener Queue System (SAP/Google/Microsoft Pattern)
interface PendingListener {
  id: string;
  type: WebSocketEventType | '*';
  handler: (message: WebSocketMessage<WebSocketPayload>) => void;
  options?: { once?: boolean };
}

export function WebSocketProvider({
  children,
  wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080/ws',
  enableDevtools = process.env.NODE_ENV === 'development'
}: WebSocketProviderProps) {
  const { user, isAuthenticated } = useUserRole();
  const cache = useCache();
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const wsRef = useRef<WebSocketService | null>(null);
  const [connectionState, setConnectionState] = useState<WebSocketConnectionState>('disconnected');
  const [connectionAttempts, setConnectionAttempts] = useState(0);

  // 🏢 ENTERPRISE: Queue for pending listeners (attached before WebSocket initialization)
  const pendingListenersRef = useRef<PendingListener[]>([]);
  // 🏢 ENTERPRISE: Map pending IDs to real IDs (for cleanup)
  const listenerMapRef = useRef<Map<string, string>>(new Map());

  // Initialize WebSocket service
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

    // Add authentication middleware
    ws.addMiddleware((message) => {
      if (user) {
        return {
          ...message,
          userId: user.email,
          metadata: {
            ...message.metadata,
            userRole: user.role,
            timestamp: Date.now()
          }
        };
      }
      return message;
    });

    // Add caching middleware for certain message types
    ws.addMiddleware((message) => {
      const cachableTypes: WebSocketEventType[] = ['task_updated', 'property_updated'];
      
      if (cachableTypes.includes(message.type)) {
        // Cache the message for offline access
        cache.set(`ws_${message.type}_${message.id}`, message, { ttl: 300000 }); // 5 minutes
      }
      
      return message;
    });

    // Connection state listener
    ws.onConnectionStateChange((state) => {
      setConnectionState(state);
      
      if (state === 'connected') {
        setConnectionAttempts(0);
        // Send user presence
        if (user) {
          ws.send('user_online', {
            userId: user.email,
            role: user.role,
            timestamp: Date.now()
          });
        }
      } else if (state === 'reconnecting') {
        setConnectionAttempts(prev => prev + 1);
      }
    });

    wsRef.current = ws;
    return ws;
  }, [wsUrl, enableDevtools, user, cache]);

  // Connect when authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      const ws = initializeWebSocket();

      ws.connect().catch((error) => {
        console.warn('WebSocket connection failed:', error);
      });

      return () => {
        // Send offline status before disconnect
        if (ws.isConnected()) {
          ws.send('user_offline', {
            userId: user.email,
            timestamp: Date.now()
          });
        }
        ws.destroy();
      };
    }
  }, [isAuthenticated, user, initializeWebSocket]);

  // 🏢 ENTERPRISE: Flush Pending Listeners when WebSocket is Ready
  useEffect(() => {
    if (wsRef.current && pendingListenersRef.current.length > 0) {
      const ws = wsRef.current;
      const pendingCount = pendingListenersRef.current.length;

      if (enableDevtools) {
        console.log(`[WebSocket] 🚀 Flushing ${pendingCount} pending listeners...`);
      }

      // Attach all pending listeners to the now-ready WebSocket
      pendingListenersRef.current.forEach((pending) => {
        const realId = ws.addEventListener(pending.type, pending.handler, pending.options);
        // Map pending ID → real ID (for cleanup later)
        listenerMapRef.current.set(pending.id, realId);

        if (enableDevtools) {
          console.log(`[WebSocket] ✅ Attached "${pending.type}" (${pending.id} → ${realId})`);
        }
      });

      // Clear the pending queue
      pendingListenersRef.current = [];

      if (enableDevtools) {
        console.log(`[WebSocket] ✅ All pending listeners attached successfully!`);
      }
    }
  }, [wsRef.current, enableDevtools]);

  // Handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!wsRef.current || !user) return;

      if (document.hidden) {
        // Page is hidden - send away status
        wsRef.current.send('user_status', {
          userId: user.email,
          status: 'away' as const,
          timestamp: Date.now()
        });
      } else {
        // Page is visible - send online status
        wsRef.current.send('user_status', {
          userId: user.email,
          status: 'online' as const,
          timestamp: Date.now()
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Handle page unload
    const handleBeforeUnload = () => {
      if (wsRef.current && user) {
        wsRef.current.send('user_offline', {
          userId: user.email,
          timestamp: Date.now()
        });
      }
    };

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
    options?: {
      targetUsers?: string[];
      metadata?: Record<string, unknown>;
    }
  ) => {
    if (!wsRef.current) {
      console.warn('WebSocket not initialized');
      return false;
    }
    return wsRef.current.send(type, payload, options);
  }, []);

  // 🏢 ENTERPRISE: addEventListener with Pending Queue Support
  const addEventListener = useCallback((
    type: WebSocketEventType | '*',
    handler: (message: WebSocketMessage<WebSocketPayload>) => void,
    options?: { once?: boolean }
  ) => {
    // Case 1: WebSocket not ready → Queue the listener
    if (!wsRef.current) {
      const pendingId = 'pending-' + Math.random().toString(36).substr(2, 9);
      pendingListenersRef.current.push({
        id: pendingId,
        type,
        handler,
        options
      });

      if (enableDevtools) {
        console.log(`[WebSocket] 📋 Queued listener for "${type}" (ID: ${pendingId})`);
      }

      return pendingId;
    }

    // Case 2: WebSocket ready → Attach immediately
    return wsRef.current.addEventListener(type, handler, options);
  }, [enableDevtools]);

  // 🏢 ENTERPRISE: removeEventListener with Pending Queue Support
  const removeEventListener = useCallback((listenerId: string) => {
    // Case 1: Pending listener (not yet attached)
    if (listenerId.startsWith('pending-')) {
      // Remove from pending queue
      const index = pendingListenersRef.current.findIndex((p) => p.id === listenerId);
      if (index !== -1) {
        const removed = pendingListenersRef.current.splice(index, 1)[0];
        if (enableDevtools) {
          console.log(`[WebSocket] 🗑️ Removed pending listener "${removed.type}" (ID: ${listenerId})`);
        }
        return true;
      }

      // Check if it was already flushed and mapped to a real ID
      const realId = listenerMapRef.current.get(listenerId);
      if (realId && wsRef.current) {
        listenerMapRef.current.delete(listenerId);
        const success = wsRef.current.removeEventListener(realId);
        if (enableDevtools && success) {
          console.log(`[WebSocket] 🗑️ Removed mapped listener (${listenerId} → ${realId})`);
        }
        return success;
      }

      return false;
    }

    // Case 2: Regular listener (already attached)
    if (!wsRef.current) return false;
    return wsRef.current.removeEventListener(listenerId);
  }, [enableDevtools]);

  // 🏢 ENTERPRISE: getStats with Pending Listeners Count
  const getStats = useCallback(() => {
    const baseStats = wsRef.current ? wsRef.current.getStats() : {
      reconnectAttempts: 0,
      queuedMessages: 0,
      activeListeners: 0
    };

    return {
      ...baseStats,
      connectionAttempts,
      pendingListeners: pendingListenersRef.current.length, // 🆕 ENTERPRISE: Track pending listeners
      user: user ? { email: user.email, role: user.role } : null
    };
  }, [connectionAttempts, user]);

  const reconnect = useCallback(async () => {
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

// Specialized hooks for different event types
export function useWebSocketEvent<T = WebSocketPayload>(
  eventType: WebSocketEventType,
  handler: (message: WebSocketMessage<T>) => void,
  dependencies: React.DependencyList = []
) {
  const { addEventListener, removeEventListener } = useWebSocket();

  useEffect(() => {
    const listenerId = addEventListener(eventType, handler as (message: WebSocketMessage<WebSocketPayload>) => void);
    return () => {
      removeEventListener(listenerId);
    };
  }, [addEventListener, removeEventListener, eventType, ...dependencies]);
}

/** User Presence payload interfaces */
interface UserPresencePayload {
  userId: string;
  status?: 'online' | 'away' | 'offline';
  timestamp?: number;
  [key: string]: unknown;
}

/** Notification payload interface */
interface NotificationPayload {
  title?: string;
  message?: string;
  [key: string]: unknown;
}

// Hook for real-time notifications
export function useRealTimeNotifications() {
  const [notifications, setNotifications] = useState<WebSocketMessage<NotificationPayload>[]>([]);
  const cache = useCache();

  useWebSocketEvent('notification', (message) => {
    setNotifications(prev => [message, ...prev.slice(0, 49)]); // Keep last 50
    
    // Cache notification
    cache.set(`notification_${message.id}`, message, { ttl: 86400000 }); // 24 hours
    
    // Show browser notification if permission granted
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(message.payload.title || 'New Notification', {
        body: message.payload.message || 'You have a new notification',
        icon: '/favicon.ico',
        tag: message.id
      });
    }
  });

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const removeNotification = useCallback((messageId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== messageId));
  }, []);

  return {
    notifications,
    clearNotifications,
    removeNotification,
    unreadCount: notifications.length
  };
}

/** User presence data interface */
interface UserPresenceData {
  userId: string;
  status?: 'online' | 'away' | 'offline';
  lastSeen: number;
  role?: string;
  [key: string]: unknown;
}

// Hook for user presence
export function useUserPresence() {
  const [onlineUsers, setOnlineUsers] = useState<Map<string, UserPresenceData>>(new Map());

  useWebSocketEvent<UserPresencePayload>('user_online', (message) => {
    const userId = message.payload.userId;
    setOnlineUsers(prev => new Map(prev.set(userId, {
      ...message.payload,
      lastSeen: Date.now()
    } as UserPresenceData)));
  });

  useWebSocketEvent<UserPresencePayload>('user_offline', (message) => {
    setOnlineUsers(prev => {
      const newMap = new Map(prev);
      const userId = message.payload.userId;
      newMap.delete(userId);
      return newMap;
    });
  });

  useWebSocketEvent<UserPresencePayload>('user_status', (message) => {
    setOnlineUsers(prev => {
      const userId = message.payload.userId;
      const user = prev.get(userId);
      if (user) {
        return new Map(prev.set(userId, {
          ...user,
          status: message.payload.status || 'online',
          lastSeen: Date.now()
        }));
      }
      return prev;
    });
  });

  return {
    onlineUsers: Array.from(onlineUsers.values()),
    isUserOnline: (userId: string) => onlineUsers.has(userId),
    getUserStatus: (userId: string) => onlineUsers.get(userId)?.status || 'offline'
  };
}

// Development debug component
export function WebSocketDebugPanel() {
  const { connectionState, getStats, reconnect } = useWebSocket();
  const [stats, setStats] = useState<WebSocketStats | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();

  useEffect(() => {
    if (isOpen) {
      const interval = setInterval(() => {
        setStats(getStats());
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isOpen, getStats]);

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  const getConnectionColor = () => {
    switch (connectionState) {
      case 'connected': return COLOR_BRIDGE.text.success;      // ✅ SEMANTIC: text-green-600 -> success
      case 'connecting': return COLOR_BRIDGE.text.warning;     // ✅ SEMANTIC: text-yellow-600 -> warning
      case 'reconnecting': return COLOR_BRIDGE.text.warning;   // ✅ SEMANTIC: text-orange-600 -> warning
      case 'error': return COLOR_BRIDGE.text.error;            // ✅ SEMANTIC: text-red-600 -> error
      default: return COLOR_BRIDGE.text.secondary;             // ✅ SEMANTIC: text-gray-600 -> secondary
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`${iconSizes.xs} rounded-full ${getConnectionColor()}`}
        title={`WebSocket: ${connectionState}`}
      >
        <span className="sr-only">WebSocket Status</span>
      </button>
      
      {isOpen && (
        <div className={`absolute top-6 right-0 w-80 bg-card ${quick.card} rounded-lg shadow-xl p-4 text-sm`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold">WebSocket Status</h3>
            <button onClick={() => setIsOpen(false)}>×</button>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>State:</span>
              <span className={getConnectionColor()}>{connectionState}</span>
            </div>
            
            {stats && (
              <>
                <div className="flex justify-between">
                  <span>Reconnect Attempts:</span>
                  <span>{stats.reconnectAttempts}</span>
                </div>
                <div className="flex justify-between">
                  <span>Queued Messages:</span>
                  <span>{stats.queuedMessages}</span>
                </div>
                <div className="flex justify-between">
                  <span>Active Listeners:</span>
                  <span>{stats.activeListeners}</span>
                </div>
                <div className="flex justify-between">
                  <span>Pending Listeners:</span>
                  <span className={stats.pendingListeners > 0 ? COLOR_BRIDGE.text.warning : ''}>{stats.pendingListeners}</span>
                </div>
                {stats.user && (
                  <div className="text-xs text-muted-foreground">
                    User: {stats.user.email} ({stats.user.role})
                  </div>
                )}
              </>
            )}
            
            {connectionState !== 'connected' && (
              <button
                onClick={() => reconnect()}
                className="w-full mt-2 px-3 py-1 bg-primary text-primary-foreground rounded text-xs"
              >
                Reconnect
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}