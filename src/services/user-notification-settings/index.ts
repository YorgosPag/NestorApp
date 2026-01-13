/**
 * =============================================================================
 * USER NOTIFICATION SETTINGS - EXPORTS
 * =============================================================================
 *
 * Centralized exports for user notification settings module
 *
 * @module services/user-notification-settings
 */

// Types
export * from './user-notification-settings.types';

// Service
export {
  userNotificationSettingsService,
  default as UserNotificationSettingsService,
} from './UserNotificationSettingsService';
