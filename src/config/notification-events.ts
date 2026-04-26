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
  ProcurementNotificationSettings,
} from '@/services/user-notification-settings/user-notification-settings.types';
import type { Channel, Severity } from '@/types/notification';
import { DEPARTMENT_CODES, type DepartmentCode } from '@/config/department-codes';

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
  // Procurement Events (ADR-267 Phase B)
  PROCUREMENT_APPROVAL_NEEDED: 'procurement.approvalNeeded',
  PROCUREMENT_PO_APPROVED: 'procurement.poApproved',
  PROCUREMENT_PO_OVERDUE: 'procurement.poOverdue',
  // Procurement Quote Events (ADR-327 Phase 3 — Vendor Portal)
  PROCUREMENT_QUOTE_RECEIVED: 'procurement.quoteReceived',
  PROCUREMENT_VENDOR_DECLINED: 'procurement.vendorDeclined',
  PROCUREMENT_QUOTE_EDITED: 'procurement.quoteEdited',
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
  settingKey: keyof CrmNotificationSettings | keyof PropertiesNotificationSettings | keyof TasksNotificationSettings | keyof SecurityNotificationSettings | keyof ProcurementNotificationSettings;
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
  // Procurement (ADR-267 Phase B)
  [NOTIFICATION_EVENT_TYPES.PROCUREMENT_APPROVAL_NEEDED]: {
    category: 'procurement',
    settingKey: 'approvalNeeded',
    isMandatory: false,
    defaultSeverity: NOTIFICATION_SEVERITIES.WARNING,
  },
  [NOTIFICATION_EVENT_TYPES.PROCUREMENT_PO_APPROVED]: {
    category: 'procurement',
    settingKey: 'poApproved',
    isMandatory: false,
    defaultSeverity: NOTIFICATION_SEVERITIES.SUCCESS,
  },
  [NOTIFICATION_EVENT_TYPES.PROCUREMENT_PO_OVERDUE]: {
    category: 'procurement',
    settingKey: 'poOverdue',
    isMandatory: false,
    defaultSeverity: NOTIFICATION_SEVERITIES.WARNING,
  },
  // ADR-327 Phase 3 — Vendor Portal
  [NOTIFICATION_EVENT_TYPES.PROCUREMENT_QUOTE_RECEIVED]: {
    category: 'procurement',
    settingKey: 'quoteReceived',
    isMandatory: false,
    defaultSeverity: NOTIFICATION_SEVERITIES.INFO,
  },
  [NOTIFICATION_EVENT_TYPES.PROCUREMENT_VENDOR_DECLINED]: {
    category: 'procurement',
    settingKey: 'vendorDeclined',
    isMandatory: false,
    defaultSeverity: NOTIFICATION_SEVERITIES.WARNING,
  },
  [NOTIFICATION_EVENT_TYPES.PROCUREMENT_QUOTE_EDITED]: {
    category: 'procurement',
    settingKey: 'quoteEdited',
    isMandatory: false,
    defaultSeverity: NOTIFICATION_SEVERITIES.INFO,
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
  USER: 'user',
  PURCHASE_ORDER: 'purchase_order',
  QUOTE: 'quote',
  RFQ: 'rfq',
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
  PROCUREMENT: 'procurement',
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
// ORG ROUTING EVENTS — ADR-326 (departmental email routing)
// Distinct from NOTIFICATION_EVENT_TYPES (per-user prefs): these are
// tenant-level routing events that map to departments, not per-user toggles.
// ============================================================================

export const NOTIFICATION_EVENTS = {
  RESERVATION_CREATED:     'reservation.created',
  RESERVATION_CANCELLED:   'reservation.cancelled',
  SALE_DEPOSIT_INVOICE:    'sale.deposit_invoice',
  SALE_FINAL_INVOICE:      'sale.final_invoice',
  SALE_CREDIT_INVOICE:     'sale.credit_invoice',
  PROFESSIONAL_ASSIGNED:   'professional.assigned',
  PROJECT_STUDY_DELIVERED: 'project.study_delivered',
  PROCUREMENT_PO_APPROVED: 'procurement.po_approved',
  HR_ATTENDANCE_ANOMALY:   'hr.attendance_anomaly',
  CONTRACT_READY_TO_SIGN:  'contract.ready_to_sign',
} as const;

export type NotificationEventCode = typeof NOTIFICATION_EVENTS[keyof typeof NOTIFICATION_EVENTS];

/** Default department per event — used when tenant has no NotificationRoutingRule for the event. */
export const DEFAULT_EVENT_TO_DEPARTMENT: Record<NotificationEventCode, DepartmentCode> = {
  [NOTIFICATION_EVENTS.RESERVATION_CREATED]:     DEPARTMENT_CODES.ACCOUNTING,
  [NOTIFICATION_EVENTS.RESERVATION_CANCELLED]:   DEPARTMENT_CODES.ACCOUNTING,
  [NOTIFICATION_EVENTS.SALE_DEPOSIT_INVOICE]:    DEPARTMENT_CODES.ACCOUNTING,
  [NOTIFICATION_EVENTS.SALE_FINAL_INVOICE]:      DEPARTMENT_CODES.ACCOUNTING,
  [NOTIFICATION_EVENTS.SALE_CREDIT_INVOICE]:     DEPARTMENT_CODES.ACCOUNTING,
  [NOTIFICATION_EVENTS.PROFESSIONAL_ASSIGNED]:   DEPARTMENT_CODES.LEGAL,
  [NOTIFICATION_EVENTS.PROJECT_STUDY_DELIVERED]: DEPARTMENT_CODES.ARCHITECTURE_STUDIES,
  [NOTIFICATION_EVENTS.PROCUREMENT_PO_APPROVED]: DEPARTMENT_CODES.PROCUREMENT,
  [NOTIFICATION_EVENTS.HR_ATTENDANCE_ANOMALY]:   DEPARTMENT_CODES.HR,
  [NOTIFICATION_EVENTS.CONTRACT_READY_TO_SIGN]:  DEPARTMENT_CODES.LEGAL,
};

