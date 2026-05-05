/**
 * 📍 Address Corrections Telemetry Service (Server-Only)
 *
 * Records every meaningful address-correction action a user takes inside the
 * AddressEditor coordinator (ADR-332 Layer 6) into the
 * `address_corrections_log/` collection.
 *
 * The data feeds two downstream consumers:
 *   1. Internal analytics — per-tenant accuracy of the resolver, common error
 *      patterns, suggestion-acceptance ratios.
 *   2. AI-pipeline learning loop (ADR-173) — corrected pairs become
 *      training signals for ranking-rule tuning over time.
 *
 * Tenant isolation is enforced at three layers:
 *   - Firestore rules (`address_corrections_log` block) — server-only writes,
 *     tenant-scoped reads (CHECK 3.10 compliant).
 *   - This service — every write carries `companyId` from the auth context.
 *   - Enterprise IDs (`acl_<ulid>` via N.6) — collision-resistant doc ids.
 *
 * Writes are fire-and-forget at the API layer — telemetry must never block
 * the user's correction action (Google "fast & loose telemetry" pattern,
 * see ADR-145 §4 for the analogous super-admin command logger).
 *
 * @module services/geocoding/address-corrections-telemetry.service
 * @enterprise ADR-332 §3.7 Phase 9
 */

import 'server-only';

import { getAdminFirestore, FieldValue } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { generateAddressCorrectionLogId } from '@/services/enterprise-id.service';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import type { ResolvedAddressFields } from '@/lib/geocoding/geocoding-types';

const logger = createModuleLogger('AddressCorrectionsTelemetry');

// =============================================================================
// TYPES
// =============================================================================

/** Source entity that hosts the address being corrected. */
export type CorrectionContextEntityType =
  | 'contact'
  | 'project'
  | 'building'
  | 'procurement'
  | 'showcase';

/** Action taken by the user when finalizing the correction step. */
export type CorrectionAction =
  | 'accepted-top'           // user kept the top Nominatim hit unchanged
  | 'accepted-suggestion'    // user picked an alternative (rank 1..4)
  | 'kept-user'              // user discarded Nominatim, kept their typed values
  | 'mixed-correction'       // user partially merged: some fields from each side
  | 'used-drag';             // user moved the pin → reverse-geocoded

/** Per-field decision when the user finalised. */
export type FieldAction =
  | 'kept'                       // user value preserved
  | 'corrected-to-resolved'      // user value overwritten with top hit
  | 'corrected-to-suggestion';   // user value overwritten with rank ≥1 alternative

export type FieldActionsMap = Partial<{
  [K in keyof ResolvedAddressFields]: FieldAction;
}>;

/** Public payload — what the API route receives from the client hook. */
export interface RecordCorrectionInput {
  contextEntityType: CorrectionContextEntityType;
  contextEntityId: string;
  userInput: ResolvedAddressFields;
  nominatimResolved: ResolvedAddressFields;
  confidence: number;
  variantUsed: number;
  partialMatch: boolean;
  action: CorrectionAction;
  acceptedSuggestionRank?: number;
  fieldActions: FieldActionsMap;
  durationFromInputToActionMs: number;
  undoOccurred: boolean;
  finalAddress: ResolvedAddressFields;
}

/** Auth context fields the service needs (subset of `AuthContext`). */
export interface RecordCorrectionAuthContext {
  uid: string;
  companyId: string;
}

// =============================================================================
// HELPERS
// =============================================================================

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) result[key] = value;
  }
  return result as T;
}

const VALID_CONTEXT_TYPES: ReadonlySet<CorrectionContextEntityType> = new Set([
  'contact',
  'project',
  'building',
  'procurement',
  'showcase',
]);

const VALID_ACTIONS: ReadonlySet<CorrectionAction> = new Set([
  'accepted-top',
  'accepted-suggestion',
  'kept-user',
  'mixed-correction',
  'used-drag',
]);

const VALID_FIELD_ACTIONS: ReadonlySet<FieldAction> = new Set([
  'kept',
  'corrected-to-resolved',
  'corrected-to-suggestion',
]);

/** Validate the public payload — throws on malformed input. Server-side guard. */
export function validateRecordCorrectionInput(raw: unknown): RecordCorrectionInput {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Telemetry payload must be an object');
  }
  const r = raw as Record<string, unknown>;

  if (!VALID_CONTEXT_TYPES.has(r.contextEntityType as CorrectionContextEntityType)) {
    throw new Error('Invalid contextEntityType');
  }
  if (typeof r.contextEntityId !== 'string' || r.contextEntityId.length === 0) {
    throw new Error('Missing contextEntityId');
  }
  if (!VALID_ACTIONS.has(r.action as CorrectionAction)) {
    throw new Error('Invalid action');
  }
  if (typeof r.confidence !== 'number' || r.confidence < 0 || r.confidence > 1) {
    throw new Error('confidence must be in [0,1]');
  }
  if (typeof r.variantUsed !== 'number') {
    throw new Error('variantUsed must be a number');
  }
  if (typeof r.partialMatch !== 'boolean') {
    throw new Error('partialMatch must be a boolean');
  }
  if (typeof r.durationFromInputToActionMs !== 'number' || r.durationFromInputToActionMs < 0) {
    throw new Error('durationFromInputToActionMs must be a non-negative number');
  }
  if (typeof r.undoOccurred !== 'boolean') {
    throw new Error('undoOccurred must be a boolean');
  }

  const fieldActions = r.fieldActions as Record<string, unknown> | undefined;
  if (!fieldActions || typeof fieldActions !== 'object') {
    throw new Error('fieldActions must be an object');
  }
  for (const v of Object.values(fieldActions)) {
    if (typeof v !== 'string' || !VALID_FIELD_ACTIONS.has(v as FieldAction)) {
      throw new Error('Invalid fieldActions entry');
    }
  }

  return {
    contextEntityType: r.contextEntityType as CorrectionContextEntityType,
    contextEntityId: r.contextEntityId,
    userInput: (r.userInput as ResolvedAddressFields) ?? {},
    nominatimResolved: (r.nominatimResolved as ResolvedAddressFields) ?? {},
    confidence: r.confidence,
    variantUsed: r.variantUsed,
    partialMatch: r.partialMatch,
    action: r.action as CorrectionAction,
    acceptedSuggestionRank:
      typeof r.acceptedSuggestionRank === 'number' ? r.acceptedSuggestionRank : undefined,
    fieldActions: fieldActions as FieldActionsMap,
    durationFromInputToActionMs: r.durationFromInputToActionMs,
    undoOccurred: r.undoOccurred,
    finalAddress: (r.finalAddress as ResolvedAddressFields) ?? {},
  };
}

// =============================================================================
// PUBLIC API
// =============================================================================

export interface RecordCorrectionResult {
  success: boolean;
  id?: string;
  error?: string;
}

/**
 * Record a single correction event. Server-only.
 * The id is generated via N.6 enterprise-id (`acl_<ulid>`); the document is
 * written via Admin SDK with `companyId` and `userId` taken from the auth ctx,
 * never from the client payload.
 */
export async function recordCorrection(
  input: RecordCorrectionInput,
  ctx: RecordCorrectionAuthContext,
): Promise<RecordCorrectionResult> {
  try {
    const db = getAdminFirestore();
    if (!db) {
      logger.error('Firestore admin not initialised');
      return { success: false, error: 'firestore-unavailable' };
    }

    const id = generateAddressCorrectionLogId();
    const doc = stripUndefined({
      companyId: ctx.companyId,
      userId: ctx.uid,
      contextEntityType: input.contextEntityType,
      contextEntityId: input.contextEntityId,
      timestamp: FieldValue.serverTimestamp(),
      userInput: input.userInput,
      nominatimResolved: input.nominatimResolved,
      confidence: input.confidence,
      variantUsed: input.variantUsed,
      partialMatch: input.partialMatch,
      action: input.action,
      acceptedSuggestionRank: input.acceptedSuggestionRank ?? null,
      fieldActions: input.fieldActions,
      durationFromInputToActionMs: input.durationFromInputToActionMs,
      undoOccurred: input.undoOccurred,
      finalAddress: input.finalAddress,
    });

    await db.collection(COLLECTIONS.ADDRESS_CORRECTIONS_LOG).doc(id).set(doc);
    return { success: true, id };
  } catch (error) {
    const message = getErrorMessage(error, 'Failed to record address correction');
    logger.error('recordCorrection failed', { error: message });
    return { success: false, error: message };
  }
}

/**
 * Read corrections for the calling tenant. Always filters by `companyId` from
 * the auth context (CHECK 3.10 — pre-commit blocks Firestore queries that
 * use `where()` without a `companyId` filter).
 */
export async function listRecentCorrections(
  ctx: RecordCorrectionAuthContext,
  options: { contextEntityType?: CorrectionContextEntityType; limit?: number } = {},
): Promise<Array<Record<string, unknown>>> {
  const db = getAdminFirestore();
  if (!db) return [];
  const limit = Math.min(options.limit ?? 50, 200);

  // CHECK 3.10: companyId filter is mandatory for tenant isolation.
  let query = db
    .collection(COLLECTIONS.ADDRESS_CORRECTIONS_LOG)
    .where('companyId', '==', ctx.companyId);
  if (options.contextEntityType) {
    query = query.where('contextEntityType', '==', options.contextEntityType);
  }
  query = query.orderBy('timestamp', 'desc').limit(limit);

  const snapshot = await query.get();
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}
