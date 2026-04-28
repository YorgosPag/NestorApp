/**
 * =============================================================================
 * USER NOTIFICATION SETTINGS - TYPES
 * =============================================================================
 *
 * Enterprise Pattern: User notification preferences management
 * Defines types for user-controlled notification settings
 *
 * @module services/user-notification-settings/types
 * @enterprise ADR-025 - Notification Settings Centralization
 */

// ============================================================================
// NOTIFICATION CATEGORY TYPES
// ============================================================================

/**
 * Available notification categories
 */
export type NotificationCategory = 'crm' | 'properties' | 'tasks' | 'security' | 'procurement';

/**
 * Email frequency preferences
 */
export type EmailFrequency = 'realtime' | 'daily' | 'weekly' | 'disabled';

// ============================================================================
// CATEGORY-SPECIFIC SETTINGS
// ============================================================================

/**
 * CRM notification settings
 */
export interface CrmNotificationSettings {
  /** Notify when new lead is created */
  newLead: boolean;
  /** Notify when lead status changes */
  leadStatusChange: boolean;
  /** Notify when task is assigned */
  taskAssigned: boolean;
  /** Notify when communication is received */
  newCommunication: boolean;
}

/**
 * Properties notification settings
 */
export interface PropertiesNotificationSettings {
  /** Notify when property status changes (available → reserved → sold) */
  statusChange: boolean;
  /** Notify when new property is added */
  newProperty: boolean;
  /** Notify when property price changes */
  priceChange: boolean;
  /** Notify when property viewing is scheduled */
  viewingScheduled: boolean;
  /** Notify when new building is created */
  newBuilding: boolean;
}

/**
 * Tasks notification settings
 */
export interface TasksNotificationSettings {
  /** Notify when task is due today */
  dueToday: boolean;
  /** Notify when task is overdue */
  overdue: boolean;
  /** Notify when task is assigned to me */
  assigned: boolean;
  /** Notify when task is completed */
  completed: boolean;
}

/**
 * Procurement notification settings (ADR-267 Phase B)
 */
export interface ProcurementNotificationSettings {
  /** Notify when PO requires approval */
  approvalNeeded: boolean;
  /** Notify when PO is approved */
  poApproved: boolean;
  /** Notify when PO is overdue (past dateNeeded) */
  poOverdue: boolean;
  /** ADR-327 — Notify when vendor submits a quote */
  quoteReceived: boolean;
  /** ADR-327 — Notify when RFQ deadline is approaching */
  quoteDeadlineApproaching: boolean;
  /** ADR-327 — Notify when vendor declines an invite */
  vendorDeclined: boolean;
  /** ADR-327 — Notify when vendor edits a submitted quote */
  quoteEdited: boolean;
  /** ADR-327 — Notify when AI extraction confidence is low (review needed) */
  aiLowConfidence: boolean;
}

/**
 * Security notification settings
 */
export interface SecurityNotificationSettings {
  /** Notify on new device login */
  newDeviceLogin: boolean;
  /** Notify on password change */
  passwordChange: boolean;
  /** Notify on 2FA status change */
  twoFactorChange: boolean;
  /** Notify on suspicious activity */
  suspiciousActivity: boolean;
}

// ============================================================================
// MAIN SETTINGS INTERFACE
// ============================================================================

/**
 * Complete user notification settings
 */
export interface UserNotificationSettings {
  /** User ID (document ID in Firestore) */
  userId: string;

  /** Global notification toggle */
  globalEnabled: boolean;

  /** In-app notifications enabled */
  inAppEnabled: boolean;

  /** Email notifications enabled */
  emailEnabled: boolean;

  /** Email frequency preference */
  emailFrequency: EmailFrequency;

  /** Push notifications enabled (browser) */
  pushEnabled: boolean;

  /** Category-specific settings */
  categories: {
    crm: CrmNotificationSettings;
    properties: PropertiesNotificationSettings;
    tasks: TasksNotificationSettings;
    security: SecurityNotificationSettings;
    procurement: ProcurementNotificationSettings;
  };

  /** Quiet hours settings */
  quietHours: {
    enabled: boolean;
    startTime: string; // HH:MM format
    endTime: string; // HH:MM format
  };

  /** Metadata */
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// DEFAULT SETTINGS
// ============================================================================

/**
 * Default CRM notification settings
 */
export const DEFAULT_CRM_SETTINGS: CrmNotificationSettings = {
  newLead: true,
  leadStatusChange: true,
  taskAssigned: true,
  newCommunication: false,
};

/**
 * Default Properties notification settings
 */
export const DEFAULT_PROPERTIES_SETTINGS: PropertiesNotificationSettings = {
  statusChange: true,
  newProperty: false,
  priceChange: false,
  viewingScheduled: true,
  newBuilding: true,
};

/**
 * Default Tasks notification settings
 */
export const DEFAULT_TASKS_SETTINGS: TasksNotificationSettings = {
  dueToday: true,
  overdue: true,
  assigned: true,
  completed: false,
};

/**
 * Default Procurement notification settings (ADR-267 Phase B)
 */
export const DEFAULT_PROCUREMENT_SETTINGS: ProcurementNotificationSettings = {
  approvalNeeded: true,
  poApproved: true,
  poOverdue: true,
  quoteReceived: true,
  quoteDeadlineApproaching: true,
  vendorDeclined: true,
  quoteEdited: false,
  aiLowConfidence: true,
};

/**
 * Default Security notification settings
 */
export const DEFAULT_SECURITY_SETTINGS: SecurityNotificationSettings = {
  newDeviceLogin: true,
  passwordChange: true,
  twoFactorChange: true,
  suspiciousActivity: true,
};

/**
 * Get default notification settings for a new user
 */
export function getDefaultNotificationSettings(userId: string): UserNotificationSettings {
  return {
    userId,
    globalEnabled: true,
    inAppEnabled: true,
    emailEnabled: true,
    emailFrequency: 'daily',
    pushEnabled: false,
    categories: {
      crm: { ...DEFAULT_CRM_SETTINGS },
      properties: { ...DEFAULT_PROPERTIES_SETTINGS },
      tasks: { ...DEFAULT_TASKS_SETTINGS },
      security: { ...DEFAULT_SECURITY_SETTINGS },
      procurement: { ...DEFAULT_PROCUREMENT_SETTINGS },
    },
    quietHours: {
      enabled: false,
      startTime: '22:00',
      endTime: '08:00',
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// ============================================================================
// UPDATE PAYLOAD TYPES
// ============================================================================

/**
 * Partial update payload for notification settings
 */
export type NotificationSettingsUpdate = Partial<Omit<UserNotificationSettings, 'userId' | 'createdAt'>>;

/**
 * Category toggle update
 */
export interface CategoryToggleUpdate {
  category: NotificationCategory;
  setting: string;
  enabled: boolean;
}
