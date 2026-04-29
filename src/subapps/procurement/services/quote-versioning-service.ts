/**
 * @fileoverview Quote/RFQ Versioning Service — Optimistic Locking Primitives
 * @description Phase 5 partial: transaction helpers for §5.J.3 conflict-prone writes.
 *              Full revision logic (supersede / revertSupersede / createRevision) → Phase 9.
 * @adr ADR-328 §5.J Concurrent Collaboration
 */

import {
  doc,
  runTransaction,
  serverTimestamp,
  Timestamp,
  type DocumentData,
  type Transaction,
  type FieldValue,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS, type CollectionKey } from '@/config/firestore-collections';

// ============================================================================
// CONFLICT TYPES — §5.J.4 dialog title selector
// ============================================================================

export type ConflictType =
  | 'AWARD_CONFLICT'
  | 'PO_CREATE_CONFLICT'
  | 'LINE_EDIT_CONFLICT'
  | 'STATUS_CHANGE_CONFLICT';

// ============================================================================
// CONFLICT ERROR — thrown when version mismatch detected
// ============================================================================

export interface ConflictErrorPayload {
  readonly conflictType: ConflictType;
  readonly currentVersion: number;
  readonly attemptedVersion: number;
  readonly actor: string | null;
  readonly actorTime: Timestamp | null;
  readonly actualState: Readonly<Record<string, unknown>>;
}

export class ConflictError extends Error {
  readonly conflictType: ConflictType;
  readonly currentVersion: number;
  readonly attemptedVersion: number;
  readonly actor: string | null;
  readonly actorTime: Timestamp | null;
  readonly actualState: Readonly<Record<string, unknown>>;

  constructor(payload: ConflictErrorPayload) {
    super(`Version conflict (${payload.conflictType}): expected v${payload.attemptedVersion}, found v${payload.currentVersion}`);
    this.name = 'ConflictError';
    this.conflictType = payload.conflictType;
    this.currentVersion = payload.currentVersion;
    this.attemptedVersion = payload.attemptedVersion;
    this.actor = payload.actor;
    this.actorTime = payload.actorTime;
    this.actualState = payload.actualState;
  }
}

export function isConflictError(err: unknown): err is ConflictError {
  return err instanceof ConflictError;
}

// ============================================================================
// VERSIONED DOCUMENT SHAPE — §5.J.3 schema additions
// ============================================================================

export interface VersionedFields {
  version?: number;
  updatedAt?: Timestamp | null;
  updatedBy?: string | null;
}

/** Field bundle to merge into an update payload to bump the version. */
export interface NextVersionFields {
  version: number;
  updatedAt: FieldValue;
  updatedBy: string;
}

/**
 * Compute the next-version field bundle for a write that closes a transaction.
 * Treats missing `version` as 1 (legacy doc) so the first transactional write becomes v2.
 */
export function nextVersionFields(
  currentVersion: number | undefined,
  userId: string,
): NextVersionFields {
  return {
    version: (currentVersion ?? 1) + 1,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  };
}

// ============================================================================
// VERSION ASSERTION — throws ConflictError on mismatch
// ============================================================================

interface AssertVersionInput {
  data: (DocumentData & VersionedFields) | undefined;
  expectedVersion: number;
  conflictType: ConflictType;
}

/**
 * Assert the current document version matches the client-held expected version.
 * Treats missing `version` as 1 (first-write semantics for legacy docs).
 *
 * @throws {ConflictError} If versions do not match.
 * @throws {Error}         If the document does not exist.
 */
export function assertVersionMatches({
  data,
  expectedVersion,
  conflictType,
}: AssertVersionInput): void {
  if (!data) {
    throw new Error('Document not found');
  }
  const actualVersion = data.version ?? 1;
  if (actualVersion !== expectedVersion) {
    throw new ConflictError({
      conflictType,
      currentVersion: actualVersion,
      attemptedVersion: expectedVersion,
      actor: (data.updatedBy as string | null | undefined) ?? null,
      actorTime: (data.updatedAt as Timestamp | null | undefined) ?? null,
      actualState: data,
    });
  }
}

// ============================================================================
// HIGH-LEVEL: VERSIONED UPDATE TRANSACTION
// ============================================================================

interface RunVersionedUpdateInput<T extends DocumentData> {
  readonly collectionKey: CollectionKey;
  readonly docId: string;
  readonly expectedVersion: number;
  readonly conflictType: ConflictType;
  readonly userId: string;
  /**
   * Callback that receives the current document snapshot and the active
   * transaction. Returns the partial update payload to apply (the helper
   * automatically merges {version, updatedAt, updatedBy}).
   *
   * Throw inside the callback to abort the transaction.
   */
  readonly mutate: (
    current: T & VersionedFields,
    tx: Transaction,
  ) => Promise<Partial<T>> | Partial<T>;
}

export interface VersionedUpdateResult {
  readonly newVersion: number;
}

/**
 * Run a Firestore transaction that:
 *   1. Reads the target document
 *   2. Asserts its `version` matches the client-held expected version
 *   3. Invokes `mutate(current, tx)` to compute the update payload
 *   4. Applies the update + bumped version metadata atomically
 *
 * Throws `ConflictError` on stale version. The mutate callback may also
 * perform side reads/writes via `tx.get` / `tx.set` / `tx.update` for
 * sibling-document updates (e.g. award flow updating loser quotes).
 */
export async function runVersionedUpdate<T extends DocumentData>(
  input: RunVersionedUpdateInput<T>,
): Promise<VersionedUpdateResult> {
  const { collectionKey, docId, expectedVersion, conflictType, userId, mutate } = input;
  const colName = COLLECTIONS[collectionKey];
  const ref = doc(db, colName, docId);

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists() ? (snap.data() as T & VersionedFields) : undefined;

    assertVersionMatches({ data, expectedVersion, conflictType });

    const currentVersion = data?.version ?? 1;
    const partial = await mutate(data as T & VersionedFields, tx);

    const versionFields = nextVersionFields(currentVersion, userId);
    tx.update(ref, {
      ...(partial as Record<string, unknown>),
      ...versionFields,
    });

    return { newVersion: versionFields.version };
  });
}

// ============================================================================
// PHASE 9 PLACEHOLDERS — full revision logic
// ============================================================================
//
// The following operations are defined in ADR-328 §5.AA (Quote duplicate
// detection & versioning) but are NOT implemented in Phase 5. They will land
// in Phase 9 alongside the multi-signal duplicate detector.
//
//   - supersede(quoteId, newQuoteId)
//   - revertSupersede(quoteId)
//   - createRevision(baseQuoteId, mutator)
//
// Phase 5 ships only the transaction primitives that Phase 8 (award flow) and
// Phase 9 (revisions) will compose on top of.
