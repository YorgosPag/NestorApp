'use client';

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import WebSocketService, {
  WebSocketEventType,
  WebSocketMessage,
  WebSocketConnectionState
} from '@/services/websocket/WebSocketService';
import { useOptimizedUserRole } from './OptimizedUserRoleContext';
import { useCache } from './CacheProvider';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';

interface WebSocketContextType {
  connectionState: WebSocketConnectionState;
  isConnected: boolean;
  send: (type: WebSocketEventType, payload: any, options?: {
    targetUsers?: string[];
    metadata?: Record<string, any>;
  }) => boolean;
  addEventListener: (
    type: WebSocketEventType | '*',
    handler: (message: WebSocketMessage<any>) => void,
    options?: { once?: boolean }
  ) => string;
  removeEventListener: (listenerId: string) => boolean;
  getStats: () => any;
  reconnect: () => Promise<void>;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

interface WebSocketProviderProps {
  children: React.ReactNode;
  wsUrl?: string;
  enableDevtools?: boolean;
}

export function WebSocketProvider({
  children,
  wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080/ws',
  enableDevtools = process.env.NODE_ENV === 'development'
}: WebSocketProviderProps) {
  const { user, isAuthenticated } = useOptimizedUserRole();
  const cache = useCache();
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const wsRef = useRef<WebSocketService | null>(null);
  const [connectionState, setConnectionState] = useState<WebSocketConnectionState>('disconnected');
  const [connectionAttempts, setConnectionAttempts] = useState(0);

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

  // Handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!wsRef.current || !user) return;

      if (document.hidden) {
        // Page is hidden - send away status
        wsRef.current.send('user_status', {
          userId: user.email,
          status: 'away',
          timestamp: Date.now()
        });
      } else {
        // Page is visible - send online status
        wsRef.current.send('user_status', {
          userId: user.email,
          status: 'online',
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
    payload: any, 
    options?: {
      targetUsers?: string[];
      metadata?: Record<string, any>;
    }
  ) => {
    if (!wsRef.current) {
      console.warn('WebSocket not initialized');
      return false;
    }
    return wsRef.current.send(type, payload, options);
  }, []);

  const addEventListener = useCallback((
    type: WebSocketEventType | '*',
    handler: (message: WebSocketMessage<any>) => void,
    options?: { once?: boolean }
  ) => {
    if (!wsRef.current) {
      throw new Error('WebSocket not initialized');
    }
    return wsRef.current.addEventListener(type, handler, options);
  }, []);

  const removeEventListener = useCallback((listenerId: string) => {
    if (!wsRef.current) return false;
    return wsRef.current.removeEventListener(listenerId);
  }, []);

  const getStats = useCallback(() => {
    if (!wsRef.current) return null;
    return {
      ...wsRef.current.getStats(),
      connectionAttempts,
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
export function useWebSocketEvent<T = any>(
  eventType: WebSocketEventType,
  handler: (message: WebSocketMessage<any>) => void,
  dependencies: React.DependencyList = []
) {
  const { addEventListener, removeEventListener } = useWebSocket();

  useEffect(() => {
    const listenerId = addEventListener(eventType, handler);
    return () => removeEventListener(listenerId);
  }, [addEventListener, removeEventListener, eventType, ...dependencies]);
}

// Hook for real-time notifications
export function useRealTimeNotifications() {
  const [notifications, setNotifications] = useState<WebSocketMessage<any>[]>([]);
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

// Hook for user presence
export function useUserPresence() {
  const [onlineUsers, setOnlineUsers] = useState<Map<string, any>>(new Map());

  useWebSocketEvent('user_online', (message) => {
    setOnlineUsers(prev => new Map(prev.set(message.payload.userId, {
      ...message.payload,
      lastSeen: Date.now()
    })));
  });

  useWebSocketEvent('user_offline', (message) => {
    setOnlineUsers(prev => {
      const newMap = new Map(prev);
      newMap.delete(message.payload.userId);
      return newMap;
    });
  });

  useWebSocketEvent('user_status', (message) => {
    setOnlineUsers(prev => {
      const user = prev.get(message.payload.userId);
      if (user) {
        return new Map(prev.set(message.payload.userId, {
          ...user,
          status: message.payload.status,
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
  const [stats, setStats] = useState<any>(null);
  const [isOpen, setIsOpen] = useState(false);

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
      case 'connected': return 'text-green-600';
      case 'connecting': return 'text-yellow-600';
      case 'reconnecting': return 'text-orange-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-600';
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