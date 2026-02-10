'use client';

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { toast, Toaster } from 'sonner';
import { CheckCircle, AlertCircle, AlertTriangle, Info, Loader2 } from 'lucide-react';
import { useTranslation } from '@/i18n';
import { useIconSizes } from '@/hooks/useIconSizes';
import { COLOR_BRIDGE } from '@/design-system/color-bridge';
import { generateNotificationId } from '@/services/enterprise-id.service';
import type {
  NotificationContextValue,
  NotificationOptions,
  NotificationType,
  NotificationData,
  NotificationPosition
} from '@/types/notifications';

import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('NotificationProvider');

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
  const iconSizes = useIconSizes();
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [settings, setSettings] = useState<{
    defaultDuration: number;
    defaultPosition: NotificationPosition;
    maxNotifications: number;
    enableSounds: boolean;
  }>({
    defaultDuration,
    defaultPosition: 'top-right',
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
    switch (type) {
      case 'success':
        return <CheckCircle className={`${iconSizes.sm} ${COLOR_BRIDGE.text.success}`} />;  // ✅ SEMANTIC: green -> success
      case 'error':
        return <AlertCircle className={`${iconSizes.sm} ${COLOR_BRIDGE.text.error}`} />;    // ✅ SEMANTIC: red -> error
      case 'warning':
        return <AlertTriangle className={`${iconSizes.sm} ${COLOR_BRIDGE.text.warning}`} />; // ✅ SEMANTIC: yellow -> warning
      case 'info':
        return <Info className={`${iconSizes.sm} ${COLOR_BRIDGE.text.info}`} />;         // ✅ SEMANTIC: blue -> info
      case 'loading':
        return <Loader2 className={`${iconSizes.sm} text-gray-500 animate-spin`} />;
      default:
        return <Info className={iconSizes.sm} />;
    }
  }, [iconSizes.sm]);

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

    // Rate limiting - SKIP για μεγάλα μηνύματα (test results)
    const skipRateLimiting = message.length > 500; // Large messages are likely test results
    if (!skipRateLimiting && !canShowNotification(message)) {
      logger.info('RATE LIMITED: Skipping duplicate notification');
      return ''; // Return empty ID for rate-limited notifications
    }

    // Generate unique ID - 🏢 ENTERPRISE: Using centralized ID generation
    const notificationId = customId || generateNotificationId();

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
      description: content
        ? (
            <div className="max-h-[60vh] overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words">
              {content}
            </div>
          )
        : undefined,
      onDismiss: () => {
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
      }
    });

    // ❌ REMOVED: Custom positioning code was creating duplicate toasts
    // CSS handles all positioning and scrolling now (see `src/app/globals.css`)

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

  // Confirmation dialog
  const showConfirmDialog = useCallback(async (
    message: string,
    onConfirm: () => void,
    onCancel?: () => void,
    options?: {
      confirmText?: string;
      cancelText?: string;
      title?: string;
      type?: NotificationType;
    }
  ): Promise<boolean> => {
    return new Promise((resolve) => {
      const confirmText = options?.confirmText || t('confirm', 'Confirm');
      const cancelText = options?.cancelText || t('cancel', 'Cancel');
      const type = options?.type || 'warning';

      const id = notify(
        options?.title ? `${options.title}\n${message}` : message,
        {
          type,
          duration: 0, // Persistent
          actions: [
            {
              label: cancelText,
              onClick: () => {
                dismiss(id);
                onCancel?.();
                resolve(false);
              },
              variant: 'outline'
            },
            {
              label: confirmText,
              onClick: () => {
                dismiss(id);
                onConfirm();
                resolve(true);
              },
              variant: 'default'
            }
          ],
          dismissible: true,
          onCancel: () => {
            onCancel?.();
            resolve(false);
          }
        }
      );
    });
  }, [notify, t]);

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
    showConfirmDialog,
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
        }}
        closeButton
        richColors
        expand
        visibleToasts={settings.maxNotifications}
      />
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
