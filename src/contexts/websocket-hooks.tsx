'use client';

/**
 * =============================================================================
 * WebSocket Specialized Hooks & Debug Panel
 * =============================================================================
 *
 * Hooks for real-time notifications, user presence, and development debugging.
 *
 * @module contexts/websocket-hooks
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useInterval } from '@/hooks/useInterval';
import type { WebSocketEventType, WebSocketMessage } from '@/services/websocket/WebSocketService';
import { useWebSocket } from './WebSocketContext';
import { useCache } from './CacheProvider';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { COLOR_BRIDGE } from '@/design-system/color-bridge';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import '@/lib/design-system';

type WebSocketPayload = Record<string, unknown>;

// ============================================================================
// useWebSocketEvent
// ============================================================================

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

// ============================================================================
// useRealTimeNotifications
// ============================================================================

interface NotificationPayload {
  title?: string;
  message?: string;
  [key: string]: unknown;
}

export function useRealTimeNotifications() {
  const [notifications, setNotifications] = useState<WebSocketMessage<NotificationPayload>[]>([]);
  const cache = useCache();

  useWebSocketEvent<NotificationPayload>('notification', (message) => {
    setNotifications(prev => [message, ...prev.slice(0, 49)]);
    cache.set(`notification_${message.id}`, message, { ttl: 86400000 });

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

// ============================================================================
// useUserPresence
// ============================================================================

interface UserPresencePayload {
  userId: string;
  status?: 'online' | 'away' | 'offline';
  timestamp?: number;
  [key: string]: unknown;
}

interface UserPresenceData {
  userId: string;
  status?: 'online' | 'away' | 'offline';
  lastSeen: number;
  role?: string;
  [key: string]: unknown;
}

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
      newMap.delete(message.payload.userId);
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

// ============================================================================
// WebSocketDebugPanel (development only)
// ============================================================================

interface WebSocketStats {
  reconnectAttempts: number;
  queuedMessages: number;
  activeListeners: number;
  connectionAttempts: number;
  pendingListeners: number;
  user: { email: string; role: string } | null;
}

export function WebSocketDebugPanel() {
  const { connectionState, getStats, reconnect } = useWebSocket();
  const [stats, setStats] = useState<WebSocketStats | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();

  useInterval(() => setStats(getStats()), isOpen ? 1000 : null);

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  const getConnectionColor = () => {
    switch (connectionState) {
      case 'connected': return COLOR_BRIDGE.text.success;
      case 'connecting': return COLOR_BRIDGE.text.warning;
      case 'reconnecting': return COLOR_BRIDGE.text.warning;
      case 'error': return COLOR_BRIDGE.text.error;
      default: return COLOR_BRIDGE.text.secondary;
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
                  <div className={cn("text-xs", colors.text.muted)}>
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
