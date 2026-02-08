/**
 * 🌉 ALERT NOTIFICATION BRIDGE
 * Connects @geo-alert/core/alert-engine with existing notification system
 */

import { useNotificationCenter } from '@/stores/notificationCenter';
import type { Alert } from '@geo-alert/core/alert-engine';
import type { Notification, Severity } from '@/types/notification';
import type { NotificationAction } from '@/types/notification';

// ============================================================================
// SEVERITY MAPPING
// ============================================================================

/**
 * Maps alert engine severity to notification system severity
 */
function mapAlertToNotificationSeverity(alertSeverity: string): Severity {
  switch (alertSeverity) {
    case 'critical':
      return 'critical';
    case 'error':
      return 'error';
    case 'warning':
      return 'warning';
    case 'info':
      return 'info';
    default:
      return 'info';
  }
}

function resolveNotificationEnv(nodeEnv: string | undefined): Notification['source']['env'] {
  switch (nodeEnv) {
    case 'production':
      return 'prod';
    case 'staging':
      return 'staging';
    case 'development':
    case 'test':
    default:
      return 'dev';
  }
}

function toNotificationActions(value: unknown): NotificationAction[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const actions = value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const action = entry as Record<string, unknown>;
    const id = typeof action.id === 'string' ? action.id : undefined;
    const label = typeof action.label === 'string' ? action.label : undefined;
    if (!id || !label) return [];
    const url = typeof action.url === 'string' ? action.url : undefined;
    const method = action.method === 'GET' || action.method === 'POST' ? action.method : undefined;
    const destructive = typeof action.destructive === 'boolean' ? action.destructive : undefined;
    return [{ id, label, url, method, destructive }];
  });
  return actions.length > 0 ? actions : undefined;
}

// ============================================================================
// ALERT NOTIFICATION BRIDGE
// ============================================================================

export class AlertNotificationBridge {
  private notificationCenter = useNotificationCenter.getState();

  /**
   * Converts alert engine alert to notification system notification
   */
  alertToNotification(alert: Alert): Notification {
    const alertData = alert as Record<string, unknown>;
    const nowIso = new Date().toISOString();
    const alertTimestamp = alertData.timestamp instanceof Date
      ? alertData.timestamp
      : typeof alertData.timestamp === 'string'
        ? new Date(alertData.timestamp)
        : new Date();
    const createdAt = Number.isNaN(alertTimestamp.getTime()) ? nowIso : alertTimestamp.toISOString();

    return {
      id: `alert-${String(alert.id)}`,
      tenantId: typeof alertData.tenantId === 'string' ? alertData.tenantId : 'geo-alert',
      userId: typeof alertData.userId === 'string' ? alertData.userId : 'system',
      createdAt,
      updatedAt: nowIso,
      severity: mapAlertToNotificationSeverity(alert.severity),
      title: typeof alertData.title === 'string' ? alertData.title : 'Spatial Alert',
      body: typeof alertData.message === 'string' ? alertData.message : 'A spatial event has been detected',
      channel: 'inapp' as const,
      delivery: {
        state: 'delivered' as const,
        attempts: 1
      },
      actions: toNotificationActions(alertData.actions),
      source: {
        service: 'geo-alert-engine',
        env: resolveNotificationEnv(process.env.NODE_ENV)
      },
    };
  }

  /**
   * Sends alert to notification system
   */
  sendAlert(alert: Alert): void {
    const notification = this.alertToNotification(alert);
    this.notificationCenter.addOrUpdate(notification);
  }

  /**
   * Batch send multiple alerts
   */
  sendAlerts(alerts: Alert[]): void {
    alerts.forEach(alert => this.sendAlert(alert));
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const alertNotificationBridge = new AlertNotificationBridge();

// ============================================================================
// REACT HOOK INTEGRATION
// ============================================================================

/**
 * React hook for connecting alert engine with notifications
 */
export function useAlertNotifications() {
  const { addOrUpdate } = useNotificationCenter();

  const sendSpatialAlert = (alert: Alert) => {
    const notification = alertNotificationBridge.alertToNotification(alert);
    addOrUpdate(notification);
  };

  return {
    sendSpatialAlert,
    sendAlerts: alertNotificationBridge.sendAlerts.bind(alertNotificationBridge)
  };
}
