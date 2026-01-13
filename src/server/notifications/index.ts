/**
 * Server-Side Notification Module
 * @module server/notifications
 */

export {
  dispatchNotification,
  dispatchCrmNotification,
  dispatchSecurityNotification,
  type NotificationEventType,
  type DispatchRequest,
  type DispatchResult,
} from './notification-orchestrator';
