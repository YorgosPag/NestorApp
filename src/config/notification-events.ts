/**
 * =============================================================================
 * NOTIFICATION EVENTS REGISTRY - SINGLE SOURCE OF TRUTH
 * =============================================================================
 *
 * Central registry for notification event types and mappings.
 * Used by both server orchestrator and client settings UI.
 *
 * @module config/notification-events
 * @enterprise ADR-026 - Notification Events Registry
 */

import type {
  NotificationCategory,
  CrmNotificationSettings,
  PropertiesNotificationSettings,
  TasksNotificationSettings,
  SecurityNotificationSettings,
} from '@/services/user-notification-settings/user-notification-settings.types';
import type { Channel, Severity } from '@/types/notification';

// ============================================================================
// CHANNEL CONSTANTS
// ============================================================================

/**
 * Notification channels - centralized constants
 */
export const NOTIFICATION_CHANNELS = {
  IN_APP: 'inapp' as Channel,
  EMAIL: 'email' as Channel,
  PUSH: 'push' as Channel,
  SMS: 'sms' as Channel,
} as const;

/**
 * Notification severities - centralized constants
 */
export const NOTIFICATION_SEVERITIES = {
  INFO: 'info' as Severity,
  SUCCESS: 'success' as Severity,
  WARNING: 'warning' as Severity,
  ERROR: 'error' as Severity,
  CRITICAL: 'critical' as Severity,
} as const;

// ============================================================================
// EVENT TYPES - SINGLE SOURCE OF TRUTH
// ============================================================================

/**
 * All notification event types
 * Derived from user-notification-settings category keys
 */
export const NOTIFICATION_EVENT_TYPES = {
  // CRM Events
  CRM_NEW_LEAD: 'crm.newLead',
  CRM_LEAD_STATUS_CHANGE: 'crm.leadStatusChange',
  CRM_TASK_ASSIGNED: 'crm.taskAssigned',
  CRM_NEW_COMMUNICATION: 'crm.newCommunication',
  // Properties Events
  PROPERTIES_STATUS_CHANGE: 'properties.statusChange',
  PROPERTIES_NEW_PROPERTY: 'properties.newProperty',
  PROPERTIES_PRICE_CHANGE: 'properties.priceChange',
  PROPERTIES_VIEWING_SCHEDULED: 'properties.viewingScheduled',
  // Tasks Events
  TASKS_DUE_TODAY: 'tasks.dueToday',
  TASKS_OVERDUE: 'tasks.overdue',
  TASKS_ASSIGNED: 'tasks.assigned',
  TASKS_COMPLETED: 'tasks.completed',
  // Security Events (MANDATORY)
  SECURITY_NEW_DEVICE_LOGIN: 'security.newDeviceLogin',
  SECURITY_PASSWORD_CHANGE: 'security.passwordChange',
  SECURITY_TWO_FACTOR_CHANGE: 'security.twoFactorChange',
  SECURITY_SUSPICIOUS_ACTIVITY: 'security.suspiciousActivity',
} as const;

export type NotificationEventType = typeof NOTIFICATION_EVENT_TYPES[keyof typeof NOTIFICATION_EVENT_TYPES];

// ============================================================================
// EVENT MAPPING - CATEGORY/SETTING LOOKUP
// ============================================================================

/**
 * Event category mapping interface
 */
export interface EventCategoryMapping {
  category: NotificationCategory;
  settingKey: keyof CrmNotificationSettings | keyof PropertiesNotificationSettings | keyof TasksNotificationSettings | keyof SecurityNotificationSettings;
  isMandatory: boolean;
  defaultSeverity: Severity;
}

/**
 * Event to category/setting mapping
 * Single source of truth for orchestrator preference lookup
 */
export const EVENT_CATEGORY_MAP: Record<NotificationEventType, EventCategoryMapping> = {
  // CRM
  [NOTIFICATION_EVENT_TYPES.CRM_NEW_LEAD]: {
    category: 'crm',
    settingKey: 'newLead',
    isMandatory: false,
    defaultSeverity: NOTIFICATION_SEVERITIES.INFO,
  },
  [NOTIFICATION_EVENT_TYPES.CRM_LEAD_STATUS_CHANGE]: {
    category: 'crm',
    settingKey: 'leadStatusChange',
    isMandatory: false,
    defaultSeverity: NOTIFICATION_SEVERITIES.INFO,
  },
  [NOTIFICATION_EVENT_TYPES.CRM_TASK_ASSIGNED]: {
    category: 'crm',
    settingKey: 'taskAssigned',
    isMandatory: false,
    defaultSeverity: NOTIFICATION_SEVERITIES.INFO,
  },
  [NOTIFICATION_EVENT_TYPES.CRM_NEW_COMMUNICATION]: {
    category: 'crm',
    settingKey: 'newCommunication',
    isMandatory: false,
    defaultSeverity: NOTIFICATION_SEVERITIES.INFO,
  },
  // Properties
  [NOTIFICATION_EVENT_TYPES.PROPERTIES_STATUS_CHANGE]: {
    category: 'properties',
    settingKey: 'statusChange',
    isMandatory: false,
    defaultSeverity: NOTIFICATION_SEVERITIES.INFO,
  },
  [NOTIFICATION_EVENT_TYPES.PROPERTIES_NEW_PROPERTY]: {
    category: 'properties',
    settingKey: 'newProperty',
    isMandatory: false,
    defaultSeverity: NOTIFICATION_SEVERITIES.INFO,
  },
  [NOTIFICATION_EVENT_TYPES.PROPERTIES_PRICE_CHANGE]: {
    category: 'properties',
    settingKey: 'priceChange',
    isMandatory: false,
    defaultSeverity: NOTIFICATION_SEVERITIES.INFO,
  },
  [NOTIFICATION_EVENT_TYPES.PROPERTIES_VIEWING_SCHEDULED]: {
    category: 'properties',
    settingKey: 'viewingScheduled',
    isMandatory: false,
    defaultSeverity: NOTIFICATION_SEVERITIES.INFO,
  },
  // Tasks
  [NOTIFICATION_EVENT_TYPES.TASKS_DUE_TODAY]: {
    category: 'tasks',
    settingKey: 'dueToday',
    isMandatory: false,
    defaultSeverity: NOTIFICATION_SEVERITIES.WARNING,
  },
  [NOTIFICATION_EVENT_TYPES.TASKS_OVERDUE]: {
    category: 'tasks',
    settingKey: 'overdue',
    isMandatory: false,
    defaultSeverity: NOTIFICATION_SEVERITIES.WARNING,
  },
  [NOTIFICATION_EVENT_TYPES.TASKS_ASSIGNED]: {
    category: 'tasks',
    settingKey: 'assigned',
    isMandatory: false,
    defaultSeverity: NOTIFICATION_SEVERITIES.INFO,
  },
  [NOTIFICATION_EVENT_TYPES.TASKS_COMPLETED]: {
    category: 'tasks',
    settingKey: 'completed',
    isMandatory: false,
    defaultSeverity: NOTIFICATION_SEVERITIES.SUCCESS,
  },
  // Security (MANDATORY - in-app always enabled)
  [NOTIFICATION_EVENT_TYPES.SECURITY_NEW_DEVICE_LOGIN]: {
    category: 'security',
    settingKey: 'newDeviceLogin',
    isMandatory: true,
    defaultSeverity: NOTIFICATION_SEVERITIES.WARNING,
  },
  [NOTIFICATION_EVENT_TYPES.SECURITY_PASSWORD_CHANGE]: {
    category: 'security',
    settingKey: 'passwordChange',
    isMandatory: true,
    defaultSeverity: NOTIFICATION_SEVERITIES.WARNING,
  },
  [NOTIFICATION_EVENT_TYPES.SECURITY_TWO_FACTOR_CHANGE]: {
    category: 'security',
    settingKey: 'twoFactorChange',
    isMandatory: true,
    defaultSeverity: NOTIFICATION_SEVERITIES.WARNING,
  },
  [NOTIFICATION_EVENT_TYPES.SECURITY_SUSPICIOUS_ACTIVITY]: {
    category: 'security',
    settingKey: 'suspiciousActivity',
    isMandatory: true,
    defaultSeverity: NOTIFICATION_SEVERITIES.ERROR,
  },
};

// ============================================================================
// ENTITY TYPES - CENTRALIZED
// ============================================================================

/**
 * Entity types for notification context
 */
export const NOTIFICATION_ENTITY_TYPES = {
  LEAD: 'lead',
  CONTACT: 'contact',
  PROPERTY: 'property',
  TASK: 'task',
  PROJECT: 'project',
  BUILDING: 'building',
  UNIT: 'unit',
  USER: 'user',
} as const;

export type NotificationEntityType = typeof NOTIFICATION_ENTITY_TYPES[keyof typeof NOTIFICATION_ENTITY_TYPES];

// ============================================================================
// PRIORITY CONSTANTS - RE-EXPORTED FROM CANONICAL SSoT
// ============================================================================

/**
 * Message priority levels are defined in canonical types layer
 * @see src/types/communications.ts (CANONICAL)
 * Re-exported below in COMMS CHANNEL CONSTANTS section
 */

// ============================================================================
// DELIVERY STATE CONSTANTS
// ============================================================================

/**
 * Notification delivery states
 */
export const DELIVERY_STATES = {
  PENDING: 'pending',
  DELIVERED: 'delivered',
  FAILED: 'failed',
  READ: 'read',
} as const;

export type DeliveryState = typeof DELIVERY_STATES[keyof typeof DELIVERY_STATES];

/**
 * Default delivery configuration
 */
export const DEFAULT_DELIVERY = {
  state: DELIVERY_STATES.DELIVERED,
  attempts: 1,
} as const;

// ============================================================================
// COMMS CHANNEL CONSTANTS - RE-EXPORTED FROM CANONICAL SSoT
// ============================================================================

/**
 * Re-export from canonical types layer (SSoT)
 * Config files should NOT depend on server code - import from shared layer instead
 * @see src/types/communications.ts (CANONICAL)
 */
export {
  COMMUNICATION_CHANNELS,
  MESSAGE_CATEGORIES,
  MESSAGE_PRIORITIES,
  type CommunicationChannel,
  type MessageCategory,
  type MessagePriority,
} from '@/types/communications';

// ============================================================================
// SOURCE SERVICE CONSTANTS
// ============================================================================

/**
 * Source services that can dispatch notifications
 */
export const SOURCE_SERVICES = {
  CRM: 'crm',
  SECURITY: 'security',
  PROPERTIES: 'properties',
  TASKS: 'tasks',
  SYSTEM: 'system',
} as const;

export type SourceService = typeof SOURCE_SERVICES[keyof typeof SOURCE_SERVICES];

// ============================================================================
// DEPLOYMENT ENVIRONMENT CONSTANTS
// ============================================================================

/**
 * Deployment environments
 */
export const DEPLOYMENT_ENVIRONMENTS = {
  DEV: 'dev',
  STAGING: 'staging',
  PROD: 'prod',
} as const;

export type DeploymentEnvironment = typeof DEPLOYMENT_ENVIRONMENTS[keyof typeof DEPLOYMENT_ENVIRONMENTS];

/**
 * Get current deployment environment from NODE_ENV
 */
export function getCurrentEnvironment(): DeploymentEnvironment {
  const env = process.env.NODE_ENV;
  if (env === 'production') return DEPLOYMENT_ENVIRONMENTS.PROD;
  if (env === 'test') return DEPLOYMENT_ENVIRONMENTS.STAGING;
  return DEPLOYMENT_ENVIRONMENTS.DEV;
}

// ============================================================================
// FIREBASE ERROR CODES
// ============================================================================

/**
 * Firebase/gRPC error codes for structured error handling
 */
export const FIREBASE_ERROR_CODES = {
  /** gRPC status code 6 - Document already exists */
  ALREADY_EXISTS: 6,
  /** Firebase Admin SDK string code */
  ALREADY_EXISTS_STRING: 'already-exists',
} as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get event mapping by event type
 */
export function getEventMapping(eventType: NotificationEventType): EventCategoryMapping | undefined {
  return EVENT_CATEGORY_MAP[eventType];
}

/**
 * Check if event is mandatory (security)
 */
export function isEventMandatory(eventType: NotificationEventType): boolean {
  const mapping = EVENT_CATEGORY_MAP[eventType];
  return mapping?.isMandatory ?? false;
}

/**
 * Get all events for a category
 */
export function getEventsForCategory(category: NotificationCategory): NotificationEventType[] {
  return Object.entries(EVENT_CATEGORY_MAP)
    .filter(([, mapping]) => mapping.category === category)
    .map(([eventType]) => eventType as NotificationEventType);
}
