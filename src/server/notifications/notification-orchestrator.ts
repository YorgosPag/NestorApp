/**
 * =============================================================================
 * SERVER-SIDE NOTIFICATION ORCHESTRATOR
 * =============================================================================
 *
 * Thin wrapper that:
 * - Uses Admin SDK for Firestore writes (server-only)
 * - Calls comms orchestrator as downstream adapter for email
 * - Uses centralized registries (ZERO DUPLICATES)
 * - Atomic idempotency with deterministic document IDs
 *
 * @module server/notifications/notification-orchestrator
 * @enterprise ADR-026 - Server-Side Notification Orchestrator
 */

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import {
  EVENT_CATEGORY_MAP,
  NOTIFICATION_CHANNELS,
  MESSAGE_PRIORITIES,
  DEFAULT_DELIVERY,
  NOTIFICATION_ENTITY_TYPES,
  FIREBASE_ERROR_CODES,
  SOURCE_SERVICES,
  getCurrentEnvironment,
  type NotificationEventType,
  type EventCategoryMapping,
  type NotificationEntityType,
  type SourceService,
  type DeploymentEnvironment,
} from '@/config/notification-events';
// Comms domain imports from canonical source (SSoT)
import {
  enqueueMessage,
  COMMUNICATION_CHANNELS,
  MESSAGE_CATEGORIES,
  type EnqueueMessageParams,
} from '@/server/comms/orchestrator';
import {
  type UserNotificationSettings,
  getDefaultNotificationSettings,
} from '@/services/user-notification-settings/user-notification-settings.types';
import type { Severity } from '@/types/notification';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Dispatch request
 */
export interface DispatchRequest {
  eventType: NotificationEventType;
  recipientId: string;
  tenantId: string;
  title: string;
  body?: string;
  severity?: Severity;
  source: { service: SourceService; feature?: string; env?: DeploymentEnvironment };
  eventId: string; // Required for idempotency
  entityId?: string;
  entityType?: NotificationEntityType;
  actions?: Array<{ id: string; label: string; url?: string; destructive?: boolean }>;
  /** i18n key for client-side translation (falls back to title if missing) */
  titleKey?: string;
  /** i18n interpolation params for titleKey (e.g. { sender: "John" }) */
  titleParams?: Record<string, string>;
}

/**
 * Dispatch result
 */
export interface DispatchResult {
  success: boolean;
  notificationId?: string;
  dedupeKey: string;
  skipped: boolean;
  reason?: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate deterministic dedupe key for idempotency
 * This becomes the document ID for atomic create
 */
function generateDedupeKey(eventType: NotificationEventType, recipientId: string, eventId: string): string {
  return `${eventType}:${recipientId}:${eventId}`;
}

/**
 * Load user notification settings from Firestore
 */
async function loadUserSettings(userId: string): Promise<UserNotificationSettings> {
  const docRef = getAdminFirestore().collection(COLLECTIONS.USER_NOTIFICATION_SETTINGS).doc(userId);
  const doc = await docRef.get();

  if (!doc.exists) {
    return getDefaultNotificationSettings(userId);
  }

  return doc.data() as UserNotificationSettings;
}

/**
 * Check if notification is allowed based on user settings
 */
function isNotificationAllowed(
  settings: UserNotificationSettings,
  mapping: EventCategoryMapping
): { allowed: boolean; reason?: string } {
  // Global toggle
  if (!settings.globalEnabled) {
    return { allowed: false, reason: 'Global notifications disabled' };
  }

  // In-app toggle (for mandatory, we still check but override later)
  if (!settings.inAppEnabled && !mapping.isMandatory) {
    return { allowed: false, reason: 'In-app notifications disabled' };
  }

  // Category-specific setting
  const categorySettings = settings.categories[mapping.category];
  if (!categorySettings) {
    return { allowed: false, reason: `Category ${mapping.category} not found` };
  }

  // Type-safe key access
  type CategorySettings = typeof categorySettings;
  const key = mapping.settingKey as keyof CategorySettings;
  const settingValue = categorySettings[key];

  if (typeof settingValue === 'boolean' && !settingValue && !mapping.isMandatory) {
    return { allowed: false, reason: `${mapping.category}.${String(mapping.settingKey)} disabled` };
  }

  return { allowed: true };
}

// ============================================================================
// MAIN DISPATCH FUNCTION
// ============================================================================

/**
 * Dispatch notification with preference checking and atomic idempotency
 *
 * Flow:
 * 1. Generate deterministic dedupe key (becomes doc ID)
 * 2. Load user settings
 * 3. Check permissions
 * 4. Atomic create with doc ID (fails if exists = idempotent)
 * 5. Queue email via comms orchestrator (if enabled)
 */
export async function dispatchNotification(request: DispatchRequest): Promise<DispatchResult> {
  const {
    eventType,
    recipientId,
    tenantId,
    title,
    body,
    source,
    eventId,
    entityId,
    entityType,
    actions,
  } = request;

  // 1. Get event mapping from central registry
  const mapping = EVENT_CATEGORY_MAP[eventType];
  if (!mapping) {
    return {
      success: false,
      dedupeKey: '',
      skipped: true,
      reason: `Unknown event type: ${eventType}`,
    };
  }

  // 2. Generate deterministic dedupe key (becomes document ID)
  const dedupeKey = generateDedupeKey(eventType, recipientId, eventId);

  // 3. Load user settings
  let settings: UserNotificationSettings;
  try {
    settings = await loadUserSettings(recipientId);
  } catch {
    // For mandatory notifications, use defaults on error
    if (mapping.isMandatory) {
      settings = getDefaultNotificationSettings(recipientId);
    } else {
      return {
        success: false,
        dedupeKey,
        skipped: true,
        reason: 'Failed to load user settings',
      };
    }
  }

  // 4. Check permissions (mandatory notifications override)
  const permission = isNotificationAllowed(settings, mapping);
  if (!permission.allowed && !mapping.isMandatory) {
    return {
      success: true,
      dedupeKey,
      skipped: true,
      reason: permission.reason,
    };
  }

  // 5. Use severity from request or default from mapping
  const severity = request.severity ?? mapping.defaultSeverity;

  // 6. Prepare notification data
  const notificationData = {
    tenantId,
    userId: recipientId,
    createdAt: FieldValue.serverTimestamp(),
    severity,
    title,
    body: body ?? null,
    channel: NOTIFICATION_CHANNELS.IN_APP,
    delivery: { ...DEFAULT_DELIVERY },
    source,
    ...(actions && actions.length > 0 ? { actions } : {}),
    // i18n: store translation key + params for client-side rendering
    ...(request.titleKey ? { titleKey: request.titleKey, titleParams: request.titleParams ?? {} } : {}),
    meta: {
      dedupeKey,
      eventType,
      eventId,
      entityId: entityId ?? null,
      entityType: entityType ?? null,
    },
  };

  // 7. ATOMIC CREATE - Use dedupeKey as document ID
  // This ensures idempotency: create() fails if doc already exists
  const docRef = getAdminFirestore().collection(COLLECTIONS.NOTIFICATIONS).doc(dedupeKey);

  try {
    await docRef.create(notificationData);
  } catch (error: unknown) {
    // Check if error is "document already exists" using structured error code (enterprise pattern)
    // Firebase Admin SDK returns error.code as number (gRPC) or string
    const firebaseError = error as { code?: number | string };
    const isAlreadyExists =
      firebaseError.code === FIREBASE_ERROR_CODES.ALREADY_EXISTS ||
      firebaseError.code === FIREBASE_ERROR_CODES.ALREADY_EXISTS_STRING;

    if (isAlreadyExists) {
      return {
        success: true,
        notificationId: dedupeKey,
        dedupeKey,
        skipped: true,
        reason: 'Duplicate notification - already exists (atomic check)',
      };
    }
    // Re-throw other errors
    throw error;
  }

  // 8. Queue email via comms orchestrator (if enabled)
  const emailEnabled = settings.globalEnabled &&
    settings.emailEnabled &&
    settings.emailFrequency !== 'disabled';

  if (emailEnabled) {
    const priority = mapping.isMandatory ? MESSAGE_PRIORITIES.URGENT : MESSAGE_PRIORITIES.NORMAL;

    // Use canonical constants from comms domain SSoT (COMMUNICATION_CHANNELS, MESSAGE_CATEGORIES)
    const emailChannel = COMMUNICATION_CHANNELS.EMAIL;
    const notificationCategory = MESSAGE_CATEGORIES.NOTIFICATION;

    const emailParams: EnqueueMessageParams = {
      channels: [emailChannel],
      to: recipientId,
      subject: title,
      content: body ?? title,
      priority,
      category: notificationCategory,
      entityType: entityType as EnqueueMessageParams['entityType'],
      entityId,
      idempotencyKey: `email:${dedupeKey}`,
    };

    await enqueueMessage(emailParams);
  }

  return {
    success: true,
    notificationId: dedupeKey,
    dedupeKey,
    skipped: false,
  };
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

// Re-export types from central registry
export type { NotificationEventType, NotificationEntityType };

/**
 * Dispatch CRM notification
 */
export async function dispatchCrmNotification(
  eventType: NotificationEventType,
  recipientId: string,
  tenantId: string,
  title: string,
  eventId: string,
  options?: { body?: string; entityId?: string }
): Promise<DispatchResult> {
  return dispatchNotification({
    eventType,
    recipientId,
    tenantId,
    title,
    body: options?.body,
    source: { service: SOURCE_SERVICES.CRM, env: getCurrentEnvironment() },
    eventId,
    entityId: options?.entityId,
    entityType: NOTIFICATION_ENTITY_TYPES.LEAD,
  });
}

/**
 * Dispatch security notification (always sent, mandatory)
 */
export async function dispatchSecurityNotification(
  eventType: NotificationEventType,
  recipientId: string,
  tenantId: string,
  title: string,
  eventId: string,
  options?: { body?: string }
): Promise<DispatchResult> {
  return dispatchNotification({
    eventType,
    recipientId,
    tenantId,
    title,
    body: options?.body,
    source: { service: SOURCE_SERVICES.SECURITY, env: getCurrentEnvironment() },
    eventId,
  });
}
