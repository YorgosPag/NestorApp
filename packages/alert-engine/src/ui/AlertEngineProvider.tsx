/**
 * 🔗 ALERT ENGINE UI PROVIDER
 * Connects spatial alert engine with global app notifications
 */

'use client';

import React, { createContext, useContext, useEffect, useRef } from 'react';
import { AlertDetectionSystem } from '../detection/AlertDetectionSystem';
import { NotificationDispatchEngine } from '../notifications/NotificationDispatchEngine';
import type { Alert } from '../detection/AlertDetectionSystem';

// ============================================================================
// CONTEXT TYPES
// ============================================================================

interface AlertEngineContextValue {
  alertDetector: AlertDetectionSystem | null;
  notificationEngine: NotificationDispatchEngine | null;
  isInitialized: boolean;
}

interface AlertEngineProviderProps {
  children: React.ReactNode;
  config?: {
    enableSpatialDetection?: boolean;
    enableNotifications?: boolean;
    integrationMode?: 'ui-only' | 'full-stack' | 'external-only';
  };
  onAlertTriggered?: (alert: Alert) => void;
  onNotificationSent?: (notificationId: string, channels: string[]) => void;
}

// ============================================================================
// CONTEXT CREATION
// ============================================================================

const AlertEngineContext = createContext<AlertEngineContextValue>({
  alertDetector: null,
  notificationEngine: null,
  isInitialized: false
});

// ============================================================================
// PROVIDER COMPONENT
// ============================================================================

export function AlertEngineProvider({
  children,
  config = {},
  onAlertTriggered,
  onNotificationSent
}: AlertEngineProviderProps) {
  const alertDetectorRef = useRef<AlertDetectionSystem | null>(null);
  const notificationEngineRef = useRef<NotificationDispatchEngine | null>(null);
  const [isInitialized, setIsInitialized] = React.useState(false);

  const {
    enableSpatialDetection = true,
    enableNotifications = true,
    integrationMode = 'full-stack'
  } = config;

  useEffect(() => {
    if (typeof window === 'undefined') {
      console.warn('AlertEngineProvider: SSR detected, skipping initialization');
      return;
    }

    console.log('🚨 Initializing Alert Engine...');

    // Initialize Alert Detection System
    if (enableSpatialDetection && !alertDetectorRef.current) {
      try {
        alertDetectorRef.current = new AlertDetectionSystem();
        console.log('✅ Spatial detection system initialized');

        // Connect alert callbacks
        if (onAlertTriggered) {
          // Note: This would need to be implemented in AlertDetectionSystem
          // alertDetectorRef.current.onAlert(onAlertTriggered);
        }
      } catch (error) {
        console.error('❌ Failed to initialize spatial detection:', error);
      }
    }

    // Initialize Notification Engine
    if (enableNotifications && !notificationEngineRef.current) {
      try {
        notificationEngineRef.current = new NotificationDispatchEngine();
        notificationEngineRef.current.startDispatch();
        console.log('✅ Notification engine initialized');

        // Connect notification callbacks
        if (onNotificationSent) {
          // Custom callback integration would be implemented here
        }
      } catch (error) {
        console.error('❌ Failed to initialize notification engine:', error);
      }
    }

    setIsInitialized(true);

    // Cleanup function
    return () => {
      console.log('🧹 Cleaning up Alert Engine...');

      if (notificationEngineRef.current) {
        notificationEngineRef.current.stopDispatch();
        notificationEngineRef.current = null;
      }

      if (alertDetectorRef.current) {
        // Cleanup would be implemented in AlertDetectionSystem
        alertDetectorRef.current = null;
      }

      setIsInitialized(false);
    };
  }, [enableSpatialDetection, enableNotifications, onAlertTriggered, onNotificationSent]);

  // Integration modes for different deployment scenarios
  useEffect(() => {
    if (!isInitialized) return;

    switch (integrationMode) {
      case 'ui-only':
        console.log('🎨 Alert Engine: UI-only mode (no external notifications)');
        // Disable external notifications, only UI feedback
        break;

      case 'external-only':
        console.log('📡 Alert Engine: External-only mode (no UI notifications)');
        // Disable UI notifications, only external channels
        break;

      case 'full-stack':
      default:
        console.log('🌐 Alert Engine: Full-stack mode (UI + external notifications)');
        // Enable both UI and external notifications
        break;
    }
  }, [integrationMode, isInitialized]);

  const contextValue: AlertEngineContextValue = {
    alertDetector: alertDetectorRef.current,
    notificationEngine: notificationEngineRef.current,
    isInitialized
  };

  return (
    <AlertEngineContext.Provider value={contextValue}>
      {children}
    </AlertEngineContext.Provider>
  );
}

// ============================================================================
// CONTEXT HOOK
// ============================================================================

export function useAlertEngineContext(): AlertEngineContextValue {
  const context = useContext(AlertEngineContext);

  if (!context) {
    throw new Error('useAlertEngineContext must be used within AlertEngineProvider');
  }

  return context;
}

// ============================================================================
// INTEGRATION HELPERS
// ============================================================================

/**
 * Helper για integration με Global App Notifications
 * Αυτό θα καλείται όταν ένα spatial alert χρειάζεται UI notification
 */
export function sendUINotification(
  alertData: {
    title: string;
    body: string;
    severity: 'info' | 'success' | 'warning' | 'error' | 'critical';
    actions?: Array<{
      id: string;
      label: string;
      url?: string;
      destructive?: boolean;
    }>;
  }
): void {
  // This would integrate with the global notification service
  // For example: notificationService.createNotification(alertData)

  console.log('📱 UI Notification triggered:', alertData);

  // Example integration (would be implemented based on the global notification service API):
  /*
  if (typeof window !== 'undefined' && window.globalNotificationService) {
    window.globalNotificationService.createNotification({
      tenantId: 'geo-alert',
      userId: getCurrentUser()?.id || 'system',
      severity: alertData.severity,
      title: alertData.title,
      body: alertData.body,
      channel: 'inapp',
      delivery: { state: 'delivered', attempts: 1 },
      actions: alertData.actions || [],
      source: {
        service: 'geo-alert-engine',
        env: process.env.NODE_ENV || 'development'
      }
    });
  }
  */
}

/**
 * Helper για integration με External Notifications (Email, SMS, etc.)
 */
export async function sendExternalAlert(
  alert: Alert,
  recipients: string[],
  channels: Array<'email' | 'sms' | 'webhook' | 'slack'>
): Promise<void> {
  console.log('📧 External alert triggered:', { alert, recipients, channels });

  // This would use the NotificationDispatchEngine
  // Example integration code would be implemented here
}

export default AlertEngineProvider;