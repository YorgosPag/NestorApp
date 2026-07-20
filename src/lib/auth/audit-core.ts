/**
 * @fileoverview Audit Logging — Core Functions
 * @version 1.0.0
 *
 * Core audit logging to Firestore: logAuditEvent, logWebhookEvent,
 * extractRequestMetadata, and internal helpers.
 *
 * Extracted from audit.ts for SRP compliance (ADR-065 Phase 4).
 *
 * Firestore Path: /companies/{companyId}/audit_logs/{autoId}
 *
 * @see docs/rfc/authorization-rbac.md
 */

import 'server-only';

import { getAdminFirestore, isFirebaseAdminAvailable, FieldValue } from '@/lib/firebaseAdmin';
import type { Firestore } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import { generateAuditId } from '@/services/enterprise-id.service';
import { validateCompanyExists, ensureCompanyDocument } from '@/services/company-document.service';

import type {
  AuthContext,
  AuditAction,
  AuditTargetType,
  AuditLogEntry,
  AuditChangeValue,
  AuditMetadata,
} from './types';
import {
  buildAuditDedupKey,
  computeAuditExpiry,
  resolveAuditPolicy,
  resolveDedupWindowMs,
  shouldSuppressDuplicate,
} from './audit-policy';
import { createModuleLogger, sentryCaptureMessage } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
const logger = createModuleLogger('audit');

// =============================================================================
// CONSTANTS
// =============================================================================

// SSoT: Subcollection name from centralized config
// This writes to /companies/{companyId}/audit_logs/ (subcollection)
import { SUBCOLLECTIONS } from '@/config/firestore-collections';
import { nowISO } from '@/lib/date-local';

const AUDIT_COLLECTION = SUBCOLLECTIONS.COMPANY_AUDIT_LOGS;

// =============================================================================
// FIRESTORE DATA SANITIZATION
// =============================================================================

/**
 * Είναι «σκέτο» αντικείμενο ({...} ή Object.create(null)) — δηλαδή κάτι που έχει νόημα
 * να σαρωθεί αναδρομικά για `undefined`;
 *
 * ⚠️ ΜΗΝ το χαλαρώσεις σε `typeof v === 'object'`. Τα `Date` και τα `FieldValue`
 * sentinels (π.χ. `serverTimestamp()`) είναι μεν objects, αλλά **δεν έχουν own
 * enumerable properties**: `Object.entries(new Date())` → `[]`. Αναδρομή πάνω τους
 * παράγει `{}`, ο έλεγχος «κενό ⇒ πέτα το κλειδί» παρακάτω τα εξαφανίζει, και τα
 * documents γράφονται ΧΩΡΙΣ `expiresAt` και ΧΩΡΙΣ `timestamp` — δηλαδή το TTL policy
 * του ADR-438 δεν βρίσκει πεδίο να τηρήσει και το retention μένει άπειρο.
 * Αυτό ακριβώς συνέβη σιωπηλά από το v1 (2026-06-10) έως το v2 (2026-07-20).
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value) as unknown;
  return proto === Object.prototype || proto === null;
}

/**
 * Remove undefined values from object (Firestore compatibility).
 * Firestore throws error on undefined values. Recursively removes undefined
 * while preserving null values (which are valid).
 *
 * Μη-plain αντικείμενα (Date, Timestamp, FieldValue sentinel, GeoPoint, DocumentReference)
 * περνούν **αυτούσια** στον Admin SDK, που ξέρει να τα σειριοποιήσει.
 */
function removeUndefinedValues<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) {
      continue;
    }

    if (isPlainObject(value)) {
      const cleaned = removeUndefinedValues(value);
      if (Object.keys(cleaned).length > 0) {
        result[key] = cleaned;
      }
    } else {
      result[key] = value;
    }
  }

  return result as Partial<T>;
}

// =============================================================================
// FIRESTORE ACCESS
// =============================================================================

/**
 * Get Firestore instance for audit logging (ADR-077: Centralized via @/lib/firebaseAdmin).
 */
function getDb(): Firestore | null {
  if (!isFirebaseAdminAvailable()) {
    return null;
  }
  return getAdminFirestore();
}

// =============================================================================
// CORE AUDIT LOGGING
// =============================================================================

/** Το σχήμα που φτάνει πράγματι στο Firestore (server timestamp αντί για Date). */
type PersistableAuditEntry = Omit<AuditLogEntry, 'timestamp'> & { timestamp: FieldValue };

/**
 * Γράψε την εγγραφή στο /companies/{companyId}/audit_logs/{auditId}.
 *
 * Απομονωμένο από το `logAuditEvent` ώστε το ίδιο σώμα να μπορεί είτε να γίνει
 * `await` (blocking tiers) είτε να αφεθεί fire-and-forget (access tier).
 */
async function persistAuditEntry(
  db: Firestore,
  ctx: AuthContext,
  action: AuditAction,
  entry: PersistableAuditEntry
): Promise<void> {
  try {
    const companyExists = await validateCompanyExists(ctx.companyId);
    if (!companyExists) {
      logger.warn('[AUDIT] Company document not found — materializing to preserve audit trail', {
        companyId: ctx.companyId,
        action,
        actorId: ctx.uid,
      });
      try {
        await ensureCompanyDocument(ctx.companyId, undefined, ctx.uid);
      } catch (materializeError) {
        logger.error('[AUDIT] Failed to materialize company document — audit event lost', {
          companyId: ctx.companyId,
          error: getErrorMessage(materializeError),
        });
        return;
      }
    }

    const auditId = generateAuditId();
    await db
      .collection(COLLECTIONS.COMPANIES)
      .doc(ctx.companyId)
      .collection(AUDIT_COLLECTION)
      .doc(auditId)
      .set(entry);
  } catch (error) {
    logger.error('[AUDIT] Failed to write audit log:', { error });
    logger.info('[AUDIT] Fallback entry:', { entry: JSON.stringify(entry) });
  }
}

/**
 * Log an audit event to Firestore.
 *
 * Events are written to: /companies/{companyId}/audit_logs/{autoId}
 *
 * Το tier του `action` (βλ. `./audit-policy`) καθορίζει το retention (`expiresAt`) και
 * το αν ο caller περιμένει το write. Τα ~110 υπάρχοντα `await logAuditEvent(...)` call
 * sites μένουν ΑΜΕΤΑΒΛΗΤΑ — απλώς παύουν να μπλοκάρουν όταν το action ανήκει σε async tier.
 *
 * Η **καταστολή διπλοεγγραφών είναι opt-in** μέσω `options.dedupable` — βλ.
 * `resolveDedupWindowMs`. Προεπιλογή: κάθε κλήση γράφεται.
 *
 * @param ctx - Authenticated context (provides companyId and actorId)
 * @param action - Audit action type
 * @param targetId - Target entity ID
 * @param targetType - Target entity type
 * @param options - Additional audit options
 */
export async function logAuditEvent(
  ctx: AuthContext,
  action: AuditAction,
  targetId: string,
  targetType: AuditTargetType,
  options: {
    previousValue?: AuditChangeValue | null;
    newValue?: AuditChangeValue | null;
    metadata?: Partial<AuditMetadata>;
    /**
     * `true` ⇒ «διαδοχικές ταυτόσημες κλήσεις εδώ ΔΕΝ προσθέτουν πληροφορία».
     *
     * Βάλ' το ΜΟΝΟ όταν το γεγονός είναι **idempotent polling/refresh** (π.χ. λίστα που
     * ξαναζητιέται, cached aggregation). ΜΗΝ το βάλεις όταν κάθε κλήση είναι **διακριτό
     * γεγονός** (π.χ. αναζήτηση) — εκεί η διαφορά ζει εκτός του dedup key και θα χαθεί.
     *
     * @default false — καμία καταστολή.
     */
    dedupable?: boolean;
  } = {}
): Promise<void> {
  const db = getDb();
  if (!db) {
    logger.info('[AUDIT] Firestore not available, logging to console:', {
      companyId: ctx.companyId,
      action,
      actorId: ctx.uid,
      targetId,
      targetType,
      timestamp: nowISO(),
    });
    return;
  }

  // ADR-259D: Capture access denials in Sentry for security monitoring
  if (action === 'access_denied') {
    sentryCaptureMessage('Tenant isolation: access denied', 'warning', {
      tags: { component: 'tenant-isolation', targetType },
      extra: { actorId: ctx.uid, companyId: ctx.companyId, targetId, reason: options.metadata?.reason, path: options.metadata?.path },
    });
  }

  const policy = resolveAuditPolicy(action);

  // Opt-in dedup: το call site δήλωσε ότι διαδοχικές ταυτόσημες κλήσεις δεν προσθέτουν
  // πληροφορία, ΚΑΙ το tier επιτρέπει καταστολή (blocking tiers → 0 ⇒ ποτέ εδώ).
  const dedupWindowMs = resolveDedupWindowMs(action, options.dedupable);
  if (dedupWindowMs > 0) {
    const dedupKey = buildAuditDedupKey({
      companyId: ctx.companyId,
      actorId: ctx.uid,
      action,
      targetId,
      path: options.metadata?.path,
    });
    if (shouldSuppressDuplicate(dedupKey, dedupWindowMs, Date.now())) {
      return;
    }
  }

  const rawEntry = {
    companyId: ctx.companyId,
    action,
    actorId: ctx.uid,
    targetId,
    targetType,
    previousValue: options.previousValue ?? null,
    newValue: options.newValue ?? null,
    timestamp: FieldValue.serverTimestamp(),
    expiresAt: computeAuditExpiry(action), // ADR-438: TTL auto-deletes after the tier's retention window
    metadata: removeUndefinedValues({
      ipAddress: options.metadata?.ipAddress,
      userAgent: options.metadata?.userAgent,
      path: options.metadata?.path,
      reason: options.metadata?.reason,
    }),
  };

  const entry = removeUndefinedValues(rawEntry) as PersistableAuditEntry;

  if (!entry.metadata || Object.keys(entry.metadata).length === 0) {
    entry.metadata = {};
  }

  if (policy.delivery === 'async') {
    // Fire-and-forget: ο caller δεν πληρώνει το Firestore round-trip. Η συνάρτηση
    // επιστρέφει ήδη-resolved Promise ⇒ τα `await logAuditEvent(...)` δεν αλλάζουν.
    void persistAuditEntry(db, ctx, action, entry).catch((error: unknown) => {
      logger.error('[AUDIT] Async audit write failed:', { action, error: getErrorMessage(error) });
    });
    return;
  }

  await persistAuditEntry(db, ctx, action, entry);
}

// =============================================================================
// REQUEST METADATA EXTRACTION
// =============================================================================

/**
 * Extract audit metadata from a request.
 */
export function extractRequestMetadata(request: {
  headers: { get: (name: string) => string | null };
  url?: string;
}): AuditMetadata {
  return {
    ipAddress: request.headers.get('x-forwarded-for') ||
               request.headers.get('x-real-ip') ||
               undefined,
    userAgent: request.headers.get('user-agent') || undefined,
    path: request.url ? new URL(request.url).pathname : undefined,
  };
}

// =============================================================================
// WEBHOOK AUDIT LOGGING (Public Webhooks - No AuthContext)
// =============================================================================

/**
 * Log a webhook event from an external service.
 * Designed for public webhooks (Mailgun, Telegram, etc.) without AuthContext.
 */
export async function logWebhookEvent(
  webhookSource: string,
  webhookId: string,
  details: Record<string, unknown>,
  request: { headers: { get: (name: string) => string | null }; url?: string }
): Promise<void> {
  const db = getDb();
  if (!db) {
    logger.info('[AUDIT] [WEBHOOK] Firestore not available, logging to console:', {
      source: webhookSource,
      webhookId,
      timestamp: nowISO(),
      details,
    });
    return;
  }

  const metadata = extractRequestMetadata(request);

  const rawEntry = {
    companyId: 'system',
    action: 'webhook_received' as const,
    actorId: `webhook:${webhookSource}`,
    targetId: webhookId,
    targetType: 'webhook' as const,
    previousValue: null,
    newValue: {
      type: 'webhook' as const,
      value: {
        source: webhookSource,
        ...details,
      },
    },
    timestamp: FieldValue.serverTimestamp(),
    expiresAt: computeAuditExpiry('webhook_received'), // ADR-438: TTL auto-deletes after retention window
    metadata: removeUndefinedValues({
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      path: metadata.path,
      reason: `Webhook event received from ${webhookSource}`,
    }),
  };

  const entry = removeUndefinedValues(rawEntry) as PersistableAuditEntry;

  if (!entry.metadata || Object.keys(entry.metadata).length === 0) {
    entry.metadata = { reason: `Webhook event received from ${webhookSource}` };
  }

  try {
    const systemAuditId = generateAuditId();
    await db
      .collection(COLLECTIONS.SYSTEM_AUDIT_LOGS)
      .doc(systemAuditId)
      .set(entry);
  } catch (error) {
    logger.error('[AUDIT] [WEBHOOK] Failed to write webhook audit log:', { error });
    logger.info('[AUDIT] [WEBHOOK] Fallback entry:', { entry: JSON.stringify(entry) });
  }
}
