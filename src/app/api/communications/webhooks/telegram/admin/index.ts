// src/app/api/communications/webhooks/telegram/admin/index.ts

/**
 * This barrel file re-exports all the necessary functions and types
 * for the admin notification module, making it easy to import them
 * from a single location.
 */

export * from './types';
export { ADMIN_CONFIG, isConfigured } from './config';
export { sendMessageToTelegram } from './client';
export { formatAdminMessage, escapeHtml } from './format';
export { getAdminKeyboard } from './keyboard';
export {
  sendAdminNotification,
  notifyNewMessage,
  notifySecurityAlert,
  notifySystemEvent,
  sendDailySummary,
  testAdminNotifications,
} from './service';
