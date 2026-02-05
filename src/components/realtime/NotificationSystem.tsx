'use client';

import React, { useState } from 'react';
import { Bell, X, Check, AlertTriangle, Info, CheckCircle } from 'lucide-react';
import { useWebSocketEvent, useRealTimeNotifications } from '@/contexts/WebSocketContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useIconSizes } from '@/hooks/useIconSizes';

interface NotificationProps {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: number;
  actions?: Array<{
    label: string;
    action: () => void;
    variant?: 'default' | 'destructive';
  }>;
  autoClose?: boolean;
  closeable?: boolean;
}

const normalizeNotificationType = (value: unknown): NotificationProps['type'] => {
  if (value === 'success' || value === 'error' || value === 'warning' || value === 'info') {
    return value;
  }
  return 'info';
};

const normalizeNotificationText = (value: unknown, fallback: string): string => {
  return typeof value === 'string' ? value : fallback;
};

const NotificationIcon = ({ type }: { type: NotificationProps['type'] }) => {
  const iconSizes = useIconSizes();
  const icons = {
    info: <Info className={`${iconSizes.md} text-blue-600`} />,
    success: <CheckCircle className={`${iconSizes.md} text-green-600`} />,
    warning: <AlertTriangle className={`${iconSizes.md} text-yellow-600`} />,
    error: <AlertTriangle className={`${iconSizes.md} text-red-600`} />
  };
  return icons[type];
};

function NotificationItem({
  notification,
  onDismiss
}: {
  notification: NotificationProps;
  onDismiss: () => void;
}) {
  const iconSizes = useIconSizes();

  return (
    <div className={cn(
      "bg-card border rounded-lg shadow-lg p-4 max-w-sm w-full",
      "animate-in slide-in-from-top-2 duration-300"
    )}>
      <div className="flex items-start space-x-3">
        <NotificationIcon type={notification.type} />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">{notification.title}</p>
          <p className="text-sm text-muted-foreground">{notification.message}</p>
        </div>
        {notification.closeable !== false && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            className={`${iconSizes.lg} p-0`}
          >
            <X className={iconSizes.sm} />
          </Button>
        )}
      </div>
      
      {notification.actions && (
        <div className="flex space-x-2 mt-3">
          {notification.actions.map((action, index) => (
            <Button
              key={index}
              variant={action.variant || "default"}
              size="sm"
              onClick={() => {
                action.action();
                onDismiss();
              }}
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

export function NotificationCenter() {
  const iconSizes = useIconSizes();
  const { notifications, removeNotification, clearNotifications, unreadCount } = useRealTimeNotifications();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="relative"
      >
        <Bell className={iconSizes.md} />
        {unreadCount > 0 && (
          <span className={`absolute -top-1 -right-1 ${iconSizes.md} bg-red-500 text-white text-xs rounded-full flex items-center justify-center`}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <div className="absolute right-0 top-10 w-80 bg-card border rounded-lg shadow-xl z-50 max-h-96 overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-semibold">Notifications</h3>
            {notifications.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearNotifications}>
                Clear all
              </Button>
            )}
          </div>
          
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                No notifications
              </div>
            ) : (
              <div className="space-y-2 p-2">
                {notifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={{
                      id: notification.id,
                      // 🏢 ENTERPRISE: Safe type casting with fallback
                      type: normalizeNotificationType(notification.payload.type),
                      title: normalizeNotificationText(notification.payload.title, 'Notification'),
                      message: normalizeNotificationText(notification.payload.message, ''),
                      timestamp: notification.timestamp,
                      closeable: true
                    }}
                    onDismiss={() => removeNotification(notification.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Toast notifications that appear on screen
export function ToastNotifications() {
  const [toasts, setToasts] = useState<NotificationProps[]>([]);

  useWebSocketEvent('notification', (message) => {
    if (message.payload.showToast !== false) {
      const toast: NotificationProps = {
        id: message.id,
        type: normalizeNotificationType(message.payload.type),
        title: normalizeNotificationText(message.payload.title, 'Notification'),
        message: normalizeNotificationText(message.payload.message, ''),
        timestamp: message.timestamp,
        autoClose: message.payload.autoClose !== false,
        closeable: true
      };

      setToasts(prev => [...prev, toast]);

      // Auto-close after 5 seconds
      if (toast.autoClose) {
        setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== toast.id));
        }, 5000);
      }
    }
  });

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <NotificationItem
          key={toast.id}
          notification={toast}
          onDismiss={() => dismissToast(toast.id)}
        />
      ))}
    </div>
  );
}
