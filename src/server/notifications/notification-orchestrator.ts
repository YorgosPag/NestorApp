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
import type { EnqueueMessageParams } from '@/server/comms/orchestrator';
import { queueNotificationEmail } from '@/server/notifications/notification-email-leg';
import {
  type UserNotificationSettings,
  getDefaultNotificationSettings,
} from '@/services/user-notification-settings/user-notification-settings.types';
import type { Severity } from '@/types/notification';
import { generateNotificationDedupeId } from '@/services/enterprise-id.service';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('NotificationOrchestrator');

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

// ADR-017: deterministic notification doc ID → enterprise-id.service.ts SSoT
const generateDedupeKey = generateNotificationDedupeId;

/**
 * Load user notification settings from Firestore
 *
 * 🔴 **ΤΟ ΩΜΟ `as` ΗΤΑΝ ΨΕΜΑ ΠΡΟΣ ΤΟΝ ΜΕΤΑΓΛΩΤΤΙΣΤΗ** (διορθώθηκε §8.28). Το
 * `doc.data() as UserNotificationSettings` υπόσχεται ότι **κάθε** πεδίο του τύπου
 * υπάρχει στο έγγραφο. Δεν υπάρχει: τα έγγραφα γράφτηκαν σε διαφορετικές εποχές του
 * σχήματος, και κάθε νέο πεδίο έρχεται εδώ ως `undefined` **με τον τύπο να λέει ότι
 * δεν γίνεται**.
 *
 * Ήταν λανθάνον, όχι θεωρητικό: το `insideQuietHours` διαβάζει `quietHours.enabled`
 * — έγγραφο χωρίς `quietHours` θα έριχνε `TypeError` **μέσα στον αγωγό που παραδίδει
 * αλληλογραφία για όλους**.
 *
 * ⚠️ **Ο ίδιος ο service έχει ήδη τη σωστή απάντηση** (`transformFromFirestore`,
 * merge με defaults)· αυτή η διαδρομή την **παρέκαμπτε**. Εδώ γίνεται το ελάχιστο
 * ισοδύναμο, στον διακομιστή: τα defaults **από κάτω**, το έγγραφο **από πάνω**.
 */
async function loadUserSettings(userId: string): Promise<UserNotificationSettings> {
  const docRef = getAdminFirestore().collection(COLLECTIONS.USER_NOTIFICATION_SETTINGS).doc(userId);
  const doc = await docRef.get();

  const defaults = getDefaultNotificationSettings(userId);
  if (!doc.exists) return defaults;

  const stored = (doc.data() ?? {}) as Partial<UserNotificationSettings>;

  return {
    ...defaults,
    ...stored,
    // Τα ένθετα αντικείμενα θέλουν **δικό τους** merge: ένα `...stored` από πάνω
    // αντικαθιστά ολόκληρο το `quietHours`, οπότε ένα έγγραφο που έχει μόνο
    // `{ enabled: true }` θα έχανε τις ώρες του.
    quietHours: { ...defaults.quietHours, ...(stored.quietHours ?? {}) },
    categories: { ...defaults.categories, ...(stored.categories ?? {}) },
    userId,
  };
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

  // 8. Queue email — απόφαση παραθύρου + διεύθυνση + ρητό αποτέλεσμα
  //
  // ⚠️ Ήταν δώδεκα γραμμές εδώ με **τέσσερα** ανεξάρτητα σιωπηλά σπασίματα (το
  // `to` ήταν userId· το αποτέλεσμα πεταγόταν· κανείς δεν άδειαζε την ουρά· ο
  // μόνος υποψήφιος αποστολέας διάβαζε άλλη συλλογή). Ζωντανή μέτρηση 19/08:
  // **77 ειδοποιήσεις, μηδέν εξερχόμενα email.** Δες `notification-email-leg.ts`.
  const emailOutcome = await queueNotificationEmail({
    recipientId,
    settings,
    isMandatory: mapping.isMandatory,
    subject: title,
    content: body ?? title,
    dedupeKey,
    entityId,
    entityType: entityType as EnqueueMessageParams['entityType'],
  });

  // Η ειδοποίηση **μέσα στην εφαρμογή** έχει ήδη γραφτεί επιτυχώς· ένα σπασμένο
  // σκέλος email δεν την ακυρώνει. Καταγράφεται όμως **ονομαστικά**, ώστε η
  // διαφορά «ο χρήστης το έκλεισε» / «δεν βρήκαμε διεύθυνση» να μη χαθεί ξανά.
  if (emailOutcome.kind === 'no-address' || emailOutcome.kind === 'enqueue-failed') {
    logger.warn('Η ειδοποίηση γράφτηκε αλλά το email ΔΕΝ μπήκε στην ουρά', {
      dedupeKey,
      data: { outcome: emailOutcome.kind },
    });
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

/** Τα προαιρετικά ενός βοηθού υπηρεσίας. */
export interface SourcedDispatchOptions {
  body?: string;
  entityId?: string;
  entityType?: NotificationEntityType;
  titleKey?: string;
  titleParams?: Record<string, string>;
}

/**
 * 🔑 **Ένα εργοστάσιο, τρεις υπηρεσίες** *(ADR-777 §8.23 · CHECK 3.28)*.
 *
 * Οι τρεις βοηθοί ήταν γραμμένοι **τρεις φορές** και διέφεραν σε **δύο** πράγματα:
 * ποια υπηρεσία υπογράφει, και ποιο είναι το προεπιλεγμένο `entityType`. Ο κλώνος
 * ήταν **προϋπάρχων** — φάνηκε μόλις το αρχείο ξαναγράφτηκε για το σκέλος email.
 *
 * ⚠️ **Οι υπογραφές των τριών ΔΕΝ αλλάζουν** — είναι δημόσιο API με ζωντανούς
 * καταναλωτές. Το εργοστάσιο παράγει **ακριβώς** την ίδια συνάρτηση· ο περιορισμός
 * ζει στον **τύπο** της κάθε σταθεράς, όχι σε `if` μέσα στο σώμα.
 *
 * ⚠️ **Τρεις καταναλωτές, όχι μηδέν**: ένα εργοστάσιο που δεν καλεί κανείς είναι ο
 * αδρανής φρουρός του ADR-749 §5. Εδώ παράγει και τους τρεις εξαγόμενους βοηθούς.
 */
function makeSourcedDispatcher(
  service: SourceService,
  defaultEntityType?: NotificationEntityType,
): (
  eventType: NotificationEventType,
  recipientId: string,
  tenantId: string,
  title: string,
  eventId: string,
  options?: SourcedDispatchOptions,
) => Promise<DispatchResult> {
  return (eventType, recipientId, tenantId, title, eventId, options) =>
    dispatchNotification({
      eventType,
      recipientId,
      tenantId,
      title,
      body: options?.body,
      source: { service, env: getCurrentEnvironment() },
      eventId,
      entityId: options?.entityId,
      entityType: options?.entityType ?? defaultEntityType,
      titleKey: options?.titleKey,
      titleParams: options?.titleParams,
    });
}

/**
 * Dispatch CRM notification
 */
export const dispatchCrmNotification: (
  eventType: NotificationEventType,
  recipientId: string,
  tenantId: string,
  title: string,
  eventId: string,
  options?: SourcedDispatchOptions,
) => Promise<DispatchResult> = makeSourcedDispatcher(
  SOURCE_SERVICES.CRM,
  NOTIFICATION_ENTITY_TYPES.LEAD,
);

/**
 * Dispatch security notification (always sent, mandatory).
 *
 * ⚠️ Η **στενή** υπογραφή είναι σκόπιμη και διατηρείται κατά λέξη: μια ειδοποίηση
 * ασφαλείας δεν κρέμεται από οντότητα τομέα, και ο τύπος το λέει αντί για σχόλιο.
 */
export const dispatchSecurityNotification: (
  eventType: NotificationEventType,
  recipientId: string,
  tenantId: string,
  title: string,
  eventId: string,
  options?: { body?: string },
) => Promise<DispatchResult> = makeSourcedDispatcher(SOURCE_SERVICES.SECURITY);

/**
 * Dispatch procurement notification (ADR-327 Phase 3 — vendor portal events).
 */
export const dispatchProcurementNotification: (
  eventType: NotificationEventType,
  recipientId: string,
  tenantId: string,
  title: string,
  eventId: string,
  options?: SourcedDispatchOptions,
) => Promise<DispatchResult> = makeSourcedDispatcher(SOURCE_SERVICES.PROCUREMENT);
