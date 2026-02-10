/**
 * =============================================================================
 * 🔔 NOTIFICATION API CLIENT
 * =============================================================================
 *
 * Enterprise client-side API for notifications.
 * Provides a thin wrapper over the server API and Firestore services.
 *
 * 🏢 ENTERPRISE NOTE:
 * For real-time notifications, use the `useNotifications` hook instead.
 * This module is for backward compatibility with existing components.
 *
 * @see src/hooks/useNotifications.ts - Enterprise real-time hook
 * @see src/services/notificationService.ts - Firestore operations
 *
 * @enterprise SAP/Salesforce-class API abstraction
 * @updated 2026-01-24 - Replaced mock with real Firestore integration
 */

import { apiClient } from '@/lib/api/enterprise-api-client';
import type { Notification, Severity } from '@/types/notification';

import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('NotificationApi');

// =============================================================================
// TYPES
// =============================================================================

/** Notification item structure for UI components */
export interface NotificationItem {
  id: string;
  title: string;
  body?: string;
  kind: 'success' | 'error' | 'warning' | 'info';
  createdAt: string;
  read: boolean;
  // Extended fields from Firestore
  severity?: Severity;
  source?: { service: string; feature?: string };
  actions?: Array<{ id: string; label: string; url?: string }>;
  tags?: string[];
  meta?: { correlationId?: string };
}

/** API response from /api/notifications */
interface NotificationsApiResponse {
  success: boolean;
  items?: Notification[];
  stats?: { total: number; unseen?: number };
  error?: string;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Map severity to kind for UI compatibility
 */
function mapSeverityToKind(severity: Severity): NotificationItem['kind'] {
  switch (severity) {
    case 'success':
      return 'success';
    case 'error':
    case 'critical':
      return 'error';
    case 'warning':
      return 'warning';
    case 'info':
    default:
      return 'info';
  }
}

/**
 * Transform Notification to NotificationItem for UI
 */
function transformToNotificationItem(notification: Notification): NotificationItem {
  return {
    id: notification.id,
    title: notification.title,
    body: notification.body,
    kind: mapSeverityToKind(notification.severity),
    createdAt: notification.createdAt,
    read: notification.delivery.state === 'seen',
    severity: notification.severity,
    source: notification.source,
    actions: notification.actions,
    tags: notification.tags,
    meta: notification.meta
  };
}

// =============================================================================
// API FUNCTIONS
// =============================================================================

/**
 * Fetch notifications from server API
 * Requires authenticated user
 *
 * @deprecated Use `useNotifications` hook for real-time updates
 */
export async function fetchNotifications(): Promise<NotificationItem[]> {
  try {
    logger.info('[NotificationApi] Fetching notifications from API...');

    const response = await apiClient.get<NotificationsApiResponse>(
      '/api/notifications?limit=50'
    );

    if (!response.success || !response.items) {
      logger.warn('[NotificationApi] Failed to fetch', { error: response.error });
      return [];
    }

    const items = response.items.map(transformToNotificationItem);
    logger.info(`[NotificationApi] Fetched ${items.length} notifications`);

    return items;
  } catch (error) {
    logger.error('[NotificationApi] Error fetching notifications', { error });
    return [];
  }
}

/**
 * Mark notifications as read via API
 */
export async function markNotificationsRead(notificationIds: string[]): Promise<boolean> {
  if (notificationIds.length === 0) return true;

  try {
    const response = await apiClient.post<{ success: boolean }>('/api/notifications/read', {
      ids: notificationIds
    });

    return response.success;
  } catch (error) {
    logger.error('[NotificationApi] Error marking as read', { error });
    return false;
  }
}

/**
 * Legacy WebSocket connection placeholder
 * @deprecated Use `useNotifications` hook for real-time updates
 */
export function connectSampleWS(onEvent: (n: NotificationItem) => void): () => void {
  logger.warn('[NotificationApi] connectSampleWS is deprecated. Use useNotifications hook.');

  // No-op - the useNotifications hook handles real-time subscriptions
  // This is kept for backward compatibility only
  return () => {
    // Cleanup - nothing to do
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export { transformToNotificationItem, mapSeverityToKind };
export default { fetchNotifications, markNotificationsRead, connectSampleWS };
