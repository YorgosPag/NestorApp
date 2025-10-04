'use client';

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { toast, Toaster } from 'sonner';
import { CheckCircle, AlertCircle, AlertTriangle, Info, Loader2, X } from 'lucide-react';
import { useTranslation } from '@/i18n';
import type { 
  NotificationContextValue, 
  NotificationOptions, 
  NotificationType, 
  NotificationData,
  NotificationQueue
} from '@/types/notifications';

const NotificationContext = createContext<NotificationContextValue | null>(null);

interface NotificationProviderProps {
  children: React.ReactNode;
  maxNotifications?: number;
  defaultDuration?: number;
  enableSounds?: boolean;
}

/**
 * Centralized notification provider with i18n support
 * Unifies all toast notifications across the application
 */
export function NotificationProvider({
  children,
  maxNotifications = 5,
  defaultDuration = 4000,
  enableSounds = false
}: NotificationProviderProps) {
  const { t } = useTranslation('common');
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [settings, setSettings] = useState({
    defaultDuration,
    defaultPosition: 'top-right' as const,
    maxNotifications,
    enableSounds
  });

  // Rate limiting and deduplication
  const recentNotifications = useRef<Map<string, number>>(new Map());
  const notificationQueue = useRef<NotificationData[]>([]);

  // Cleanup old rate limiting entries
  useEffect(() => {
    const cleanup = setInterval(() => {
      const now = Date.now();
      const fiveMinutesAgo = now - 5 * 60 * 1000;
      
      for (const [key, timestamp] of recentNotifications.current.entries()) {
        if (timestamp < fiveMinutesAgo) {
          recentNotifications.current.delete(key);
        }
      }
    }, 60000); // Cleanup every minute

    return () => clearInterval(cleanup);
  }, []);

  // Accessibility: Announce to screen readers
  const announceToScreenReader = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', priority);
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;
    
    document.body.appendChild(announcement);
    
    // Remove after announcement
    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  }, []);

  // Rate limiting check
  const canShowNotification = useCallback((message: string, timeWindow = 3000): boolean => {
    const key = message.trim().toLowerCase();
    const now = Date.now();
    const lastShown = recentNotifications.current.get(key);
    
    if (lastShown && (now - lastShown) < timeWindow) {
      return false; // Too recent, skip
    }
    
    recentNotifications.current.set(key, now);
    return true;
  }, []);

  // Get notification icon
  const getNotificationIcon = useCallback((type: NotificationType) => {
    const iconProps = { className: "w-4 h-4" };
    
    switch (type) {
      case 'success':
        return <CheckCircle {...iconProps} className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle {...iconProps} className="w-4 h-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle {...iconProps} className="w-4 h-4 text-yellow-500" />;
      case 'info':
        return <Info {...iconProps} className="w-4 h-4 text-blue-500" />;
      case 'loading':
        return <Loader2 {...iconProps} className="w-4 h-4 text-gray-500 animate-spin" />;
      default:
        return <Info {...iconProps} />;
    }
  }, []);

  // Core notification function
  const notify = useCallback((message: string, options: NotificationOptions = {}): string => {
    const {
      type = 'info',
      duration = settings.defaultDuration,
      id: customId,
      dismissible = true,
      ariaLabel,
      actions = [],
      content,
      showProgress = false,
      cancel,
      onCancel
    } = options;

    // Rate limiting
    if (!canShowNotification(message)) {
      return ''; // Return empty ID for rate-limited notifications
    }

    // Generate unique ID
    const notificationId = customId || `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create notification data
    const notificationData: NotificationData = {
      id: notificationId,
      message,
      type,
      timestamp: new Date(),
      options
    };

    // Add to internal state
    setNotifications(prev => {
      const updated = [...prev, notificationData];
      // Limit max notifications
      if (updated.length > settings.maxNotifications) {
        return updated.slice(-settings.maxNotifications);
      }
      return updated;
    });

    // Accessibility announcement
    announceToScreenReader(message, type === 'error' ? 'assertive' : 'polite');

    // Create toast with Sonner
    const toastId = toast(message, {
      id: notificationId,
      duration: duration === 0 ? Infinity : duration,
      icon: getNotificationIcon(type),
      action: actions.length > 0 ? {
        label: actions[0].label,
        onClick: actions[0].onClick
      } : undefined,
      cancel: dismissible ? (cancel || {
        label: t('buttons.close'),
        onClick: () => {
          onCancel?.();
          dismiss(notificationId);
        }
      }) : undefined,
      className: `notification-${type}`,
      description: content ? (typeof content === 'string' ? content : undefined) : undefined,
      onDismiss: () => {
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
      }
    });

    // 🎯 CAD-PRECISION RUNTIME POSITIONING - Force exact coordinates
    // Πολλαπλές προσπάθειες για να βρούμε το notification element
    const applyPositioning = () => {
      // Προσπαθούμε με διάφορους selectors
      const toastElement = (
        document.querySelector(`[data-sonner-toast][data-toast-id="${notificationId}"]`) ||
        document.querySelector(`[data-sonner-toast]`) ||
        document.querySelector(`[data-sonner-toast]:last-child`)
      ) as HTMLElement;

      if (toastElement) {
        console.log('🎯 APPLYING NOTIFICATION POSITIONING:', notificationId);
        // ΑΚΡΙΒΕΙΣ ΣΥΝΤΕΤΑΓΜΕΝΕΣ: Πάνω δεξιά γωνία στο (1756, 4)
        toastElement.style.position = 'fixed !important';
        toastElement.style.top = '4px !important';
        toastElement.style.left = '1756px !important';
        toastElement.style.right = 'auto !important';
        toastElement.style.bottom = 'auto !important';
        toastElement.style.transform = 'translateX(-100%) !important';
        toastElement.style.margin = '0 !important';
        return true;
      }
      return false;
    };

    // Προσπάθεια 1: Αμέσως
    setTimeout(() => {
      if (!applyPositioning()) {
        // Προσπάθεια 2: Μετά από 10ms
        setTimeout(() => {
          if (!applyPositioning()) {
            // Προσπάθεια 3: Μετά από 50ms
            setTimeout(applyPositioning, 50);
          }
        }, 10);
      }
    }, 0);

    return notificationId;
  }, [settings, canShowNotification, announceToScreenReader, getNotificationIcon, t]);

  // Convenience methods
  const success = useCallback((message: string, options?: Omit<NotificationOptions, 'type'>) => {
    return notify(message, { ...options, type: 'success' });
  }, [notify]);

  const error = useCallback((message: string, options?: Omit<NotificationOptions, 'type'>) => {
    return notify(message, { ...options, type: 'error', duration: 6000 }); // Longer for errors
  }, [notify]);

  const warning = useCallback((message: string, options?: Omit<NotificationOptions, 'type'>) => {
    return notify(message, { ...options, type: 'warning' });
  }, [notify]);

  const info = useCallback((message: string, options?: Omit<NotificationOptions, 'type'>) => {
    return notify(message, { ...options, type: 'info' });
  }, [notify]);

  const loading = useCallback((message: string, options?: Omit<NotificationOptions, 'type'>) => {
    return notify(message, { ...options, type: 'loading', duration: 0 }); // Persistent until dismissed
  }, [notify]);

  // Dismiss functions
  const dismiss = useCallback((id: string) => {
    toast.dismiss(id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    toast.dismiss();
    setNotifications([]);
  }, []);

  // Settings update
  const updateSettings = useCallback((newSettings: Partial<typeof settings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  const contextValue: NotificationContextValue = {
    notify,
    success,
    error,
    warning,
    info,
    loading,
    dismiss,
    dismissAll,
    notifications,
    settings,
    updateSettings
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          className: 'notification-toast',
          style: {
            background: 'hsl(var(--background))',
            border: '1px solid hsl(var(--border))',
            color: 'hsl(var(--foreground))',
          }
        }}
        closeButton
        richColors
        expand
        visibleToasts={settings.maxNotifications}
      />
      <style jsx global>{`
        /* 🎯 CAD-PRECISION POSITIONING - Όπως το Live Coordinates panel */
        /* Πάνω δεξιά γωνία του notification: (1756px, 4px) */

        [data-sonner-toaster][data-position="top-right"] {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          right: auto !important;
          bottom: auto !important;
          margin: 0 !important;
          padding: 0 !important;
          width: auto !important;
          height: auto !important;
          pointer-events: none !important;
          z-index: 2147483647 !important;
        }

        /* ΚΑΘΕ NOTIFICATION: ΑΚΡΙΒΕΙΣ ΣΥΝΤΕΤΑΓΜΕΝΕΣ χωρίς calc() */
        [data-sonner-toaster][data-position="top-right"] [data-sonner-toast] {
          position: absolute !important;
          top: 4px !important;
          right: auto !important;
          left: 1756px !important;
          bottom: auto !important;
          margin: 0 !important;
          padding: 16px !important;
          transform: translateX(-100%) !important; /* Εκτείνεται προς τα αριστερά */
          pointer-events: auto !important;
        }
      `}</style>
    </NotificationContext.Provider>
  );
}

/**
 * Hook to access notification system
 */
export function useNotifications(): NotificationContextValue {
  const context = useContext(NotificationContext);
  
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  
  return context;
}

/**
 * Hook for error handling with automatic i18n
 */
export function useErrorHandler() {
  const { error } = useNotifications();
  const { t } = useTranslation('errors');

  return useCallback((errorCode: string, fallbackMessage?: string) => {
    // Try to get translated error message
    const translatedMessage = t(errorCode, { defaultValue: fallbackMessage || errorCode });
    error(translatedMessage);
  }, [error, t]);
}