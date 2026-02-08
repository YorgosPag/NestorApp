/**
 * =============================================================================
 * CRM NOTIFICATIONS HOOK - FIRESTORE REAL-TIME INTEGRATION
 * =============================================================================
 *
 * Enterprise Pattern: React hook with real-time Firestore subscription
 * Uses centralized notificationService for data access
 *
 * @module app/crm/notifications/useNotifications
 * @enterprise ADR-027 - CRM Notifications Integration (2026-01-13)
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/auth/contexts/AuthContext';
import { subscribeToNotifications, markNotificationsAsRead } from '@/services/notificationService';
import type { Notification, Severity } from '@/types/notification';
import i18n from '@/i18n/config';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('crm/notifications');

// ============================================================================
// TYPES
// ============================================================================

/** CRM Notification types for UI display */
export type CrmNotificationType =
  | 'new_lead'
  | 'task_due'
  | 'meeting_reminder'
  | 'contract_signed'
  | 'system'
  | 'info';

/** CRM Notification data structure for UI components */
export interface CrmNotificationData {
  id: string;
  type: CrmNotificationType;
  title: string;
  description: string;
  time: string;
  read: boolean;
  /** Original notification for advanced operations */
  _original?: Notification;
}

/** Hook return type */
export interface UseNotificationsResult {
  notifications: CrmNotificationData[];
  loading: boolean;
  error: string | null;
  unreadCount: number;
  markAsRead: (ids: string[]) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refresh: () => void;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Map severity to CRM notification type
 * @enterprise Maps enterprise severity to CRM-specific types
 */
function mapSeverityToCrmType(notification: Notification): CrmNotificationType {
  // Check source.feature for specific CRM types
  const feature = notification.source?.feature?.toLowerCase() ?? '';

  if (feature.includes('lead')) return 'new_lead';
  if (feature.includes('task')) return 'task_due';
  if (feature.includes('meeting') || feature.includes('appointment')) return 'meeting_reminder';
  if (feature.includes('contract') || feature.includes('sale')) return 'contract_signed';

  // Fallback based on severity
  const severityMap: Record<Severity, CrmNotificationType> = {
    info: 'info',
    success: 'contract_signed',
    warning: 'task_due',
    error: 'system',
    critical: 'system',
  };

  return severityMap[notification.severity] || 'info';
}

/**
 * Format relative time in Greek
 * @enterprise Formats ISO timestamp to human-readable Greek relative time
 */
function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return i18n.t('notifications.time.justNow', { ns: 'crm' });
  if (diffMinutes < 60) {
    return diffMinutes === 1
      ? i18n.t('notifications.time.minute', { ns: 'crm', count: diffMinutes })
      : i18n.t('notifications.time.minutes', { ns: 'crm', count: diffMinutes });
  }
  if (diffHours < 24) {
    return diffHours === 1
      ? i18n.t('notifications.time.hour', { ns: 'crm', count: diffHours })
      : i18n.t('notifications.time.hours', { ns: 'crm', count: diffHours });
  }
  if (diffDays < 7) {
    return diffDays === 1
      ? i18n.t('notifications.time.day', { ns: 'crm', count: diffDays })
      : i18n.t('notifications.time.days', { ns: 'crm', count: diffDays });
  }

  // Format as date for older notifications
  return date.toLocaleDateString('el-GR', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

/**
 * Transform enterprise Notification to CRM NotificationData
 * @enterprise Pure transformation function
 */
function transformNotification(notification: Notification): CrmNotificationData {
  return {
    id: notification.id,
    type: mapSeverityToCrmType(notification),
    title: notification.title,
    description: notification.body ?? '',
    time: formatRelativeTime(notification.createdAt),
    read: notification.delivery.state === 'seen' || notification.delivery.state === 'acted',
    _original: notification,
  };
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * CRM Notifications Hook with real-time Firestore integration
 *
 * @returns Notifications state and actions
 * @enterprise Real-time subscription with automatic cleanup
 *
 * @example
 * ```tsx
 * const { notifications, loading, unreadCount, markAsRead } = useNotifications();
 * ```
 */
export function useNotifications(): UseNotificationsResult {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<CrmNotificationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Subscribe to real-time notifications
  useEffect(() => {
    if (!user?.uid) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToNotifications(
      user.uid,
      (firestoreNotifications: Notification[]) => {
        const transformed = firestoreNotifications.map(transformNotification);
        setNotifications(transformed);
        setLoading(false);
      },
      (err: Error) => {
        logger.error('Subscription error', { error: err.message });
        setError(i18n.t('notifications.errors.loadFailed', { ns: 'crm' }));
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [user?.uid, refreshKey]);

  // Calculate unread count
  const unreadCount = notifications.filter((n) => !n.read).length;

  // Mark specific notifications as read
  const markAsRead = useCallback(async (ids: string[]): Promise<void> => {
    if (ids.length === 0) return;

    try {
      await markNotificationsAsRead(ids);
      // Optimistic update - real-time subscription will sync
      setNotifications((prev) =>
        prev.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n))
      );
    } catch (err) {
      logger.error('Mark as read error', { error: err instanceof Error ? err.message : 'Unknown error' });
      setError(i18n.t('notifications.errors.updateFailed', { ns: 'crm' }));
    }
  }, []);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async (): Promise<void> => {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    await markAsRead(unreadIds);
  }, [notifications, markAsRead]);

  // Manual refresh trigger
  const refresh = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  return {
    notifications,
    loading,
    error,
    unreadCount,
    markAsRead,
    markAllAsRead,
    refresh,
  };
}

// ============================================================================
// LEGACY EXPORT (backward compatibility)
// ============================================================================

/**
 * @deprecated Use `useNotifications()` instead - this returns the hook result
 */
export { useNotifications as default };
