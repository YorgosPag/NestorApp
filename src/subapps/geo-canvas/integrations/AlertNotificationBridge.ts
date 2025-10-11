/**
 * 🌉 ALERT NOTIFICATION BRIDGE
 * Connects @geo-alert/core/alert-engine with existing notification system
 */

import { useNotificationCenter } from '@/stores/notificationCenter';
import type { Alert } from '@geo-alert/core/alert-engine';
import type { Notification, Severity } from '@/types/notification';

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

// ============================================================================
// ALERT NOTIFICATION BRIDGE
// ============================================================================

export class AlertNotificationBridge {
  private notificationCenter = useNotificationCenter.getState();

  /**
   * Converts alert engine alert to notification system notification
   */
  alertToNotification(alert: Alert): Notification {
    return {
      id: `alert-${alert.id}`,
      tenantId: alert.tenantId || 'geo-alert',
      userId: alert.userId || 'system',
      severity: mapAlertToNotificationSeverity(alert.severity),
      title: alert.title || 'Spatial Alert',
      body: alert.message || 'A spatial event has been detected',
      channel: 'inapp' as const,
      delivery: {
        state: 'delivered' as const,
        attempts: 1
      },
      actions: alert.actions || [],
      source: {
        service: 'geo-alert-engine',
        env: process.env.NODE_ENV || 'development'
      },
      timestamp: alert.timestamp || new Date(),
      read: false,
      data: {
        alertType: alert.type,
        coordinates: alert.coordinates,
        polygon: alert.polygon
      }
    };
  }

  /**
   * Sends alert to notification system
   */
  sendAlert(alert: Alert): void {
    const notification = this.alertToNotification(alert);
    this.notificationCenter.createNotification(notification);
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
  const { createNotification } = useNotificationCenter();

  const sendSpatialAlert = (alert: Alert) => {
    const notification = alertNotificationBridge.alertToNotification(alert);
    createNotification(notification);
  };

  return {
    sendSpatialAlert,
    sendAlerts: alertNotificationBridge.sendAlerts.bind(alertNotificationBridge)
  };
}