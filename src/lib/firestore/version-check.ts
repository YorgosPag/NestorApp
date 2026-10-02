/**
 * @file Version Check — Server-side Optimistic Concurrency Transaction
 * @module lib/firestore/version-check
 *
 * 🏢 ENTERPRISE: SPEC-256A — Google-level conflict detection.
 *
 * Uses Firestore `runTransaction` to atomically:
 * 1. Read current `_v`
 * 2. Compare with client's expected version
 * 3. Write incremented `_v` + updates on match
 * 4. Throw `ConflictError` on mismatch
 *
 * Lazy migration: documents without `_v` are treated as version 0.
 * Backward compat: `expectedVersion === undefined` → force-write (no conflict check).
 *
 * @see src/types/versioning.ts (types)
 * @see src/config/versioning-config.ts (constants)
 */

import { FieldValue } from 'firebase-admin/firestore';
import type {
  ConflictResponseBody,
  VersionCheckOnCurrentOptions,
  VersionCheckOnCurrentResult,
  VersionCheckOptions,
  VersionCheckResult,
} from '@/types/versioning';
import { VERSION_FIELD, DEFAULT_VERSION, CONFLICT_STATUS, CONFLICT_CODE } from '@/config/versioning-config';
import { nowISO } from '@/lib/date-local';

// ============================================
// CONFLICT ERROR
// ============================================

/**
 * Thrown when a version conflict is detected during a transactional update.
 * API routes catch this and return 409 with the structured body.
 */
export class ConflictError extends Error {
  readonly statusCode = CONFLICT_STATUS;
  readonly body: ConflictResponseBody;

  constructor(body: ConflictResponseBody) {
    super(`Version conflict: expected ${body.expectedVersion}, current ${body.currentVersion}`);
    this.name = 'ConflictError';
    this.body = body;

    // V8 stack trace optimization
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ConflictError);
    }
  }
}

// ============================================
// VERSION-CHECKED WRITE
// ============================================

/**
 * Perform a version-checked Firestore update inside a transaction.
 *
 * @throws {ConflictError} when expectedVersion !== current document version
 * @returns The new version number and document ID
 *
 * @example
 * ```ts
 * try {
 *   const result = await withVersionCheck({
 *     db: adminDb,
 *     collection: COLLECTIONS.BUILDINGS,
 *     docId: 'bld_abc123',
 *     expectedVersion: 3,
 *     updates: { name: 'New Name' },
 *     userId: ctx.uid,
 *   });
 *   // result.newVersion === 4
 * } catch (error) {
 *   if (error instanceof ConflictError) {
 *     return NextResponse.json(error.body, { status: error.statusCode });
 *   }
 *   throw error;
 * }
 * ```
 */
export async function withVersionCheck(options: VersionCheckOptions): Promise<VersionCheckResult> {
  const { updates, ...rest } = options;
  const { newVersion, docId } = await runVersionedUpdate(rest, () => updates);
  return { newVersion, docId };
}

/**
 * **Ίδια συναλλαγή, οι ενημερώσεις παράγονται από το ΦΡΕΣΚΟ έγγραφο** (ADR-898 Φ3β-3).
 *
 * 🔑 Για μερική διόρθωση εμφωλευμένου πεδίου: το `derive` εφαρμόζει τη διόρθωση πάνω σε ό,τι **υπάρχει τώρα** — και το
 * Firestore το ξανατρέχει σε σύγκρουση, οπότε καμία απάντηση που γράφτηκε στο μεταξύ δεν χάνεται. Ίδιο `_v` ·
 * `updatedAt` · `updatedBy` με το {@link withVersionCheck}: ένας τρόπος να γράφεις, όχι δεύτερη μηχανή.
 */
export async function withVersionCheckOnCurrent(options: VersionCheckOnCurrentOptions): Promise<VersionCheckOnCurrentResult> {
  const { derive, ...rest } = options;
  return runVersionedUpdate(rest, derive);
}

type VersionedTarget = Omit<VersionCheckOptions, 'updates'>;

/** Ο σημερινός χρόνος τελευταίας εγγραφής, για το σώμα της σύγκρουσης. */
function updatedAtOf(data: Readonly<Record<string, unknown>>): string {
  const raw = data.updatedAt;
  return raw && typeof raw === 'object' && 'toDate' in raw ? (raw as { toDate(): Date }).toDate().toISOString() : nowISO();
}

function conflictOf(data: Readonly<Record<string, unknown>>, currentVersion: number, expectedVersion: number): ConflictError {
  return new ConflictError({
    code: CONFLICT_CODE,
    error: `Version conflict: expected ${expectedVersion}, current ${currentVersion}`,
    errorCode: CONFLICT_CODE,
    currentVersion,
    expectedVersion,
    updatedAt: updatedAtOf(data),
    updatedBy: (data.updatedBy as string) ?? 'unknown',
  });
}

async function runVersionedUpdate(
  target: VersionedTarget,
  derive: (current: Readonly<Record<string, unknown>>) => Record<string, unknown>,
): Promise<VersionCheckOnCurrentResult> {
  const { db, collection, docId, expectedVersion, userId } = target;
  const docRef = db.collection(collection).doc(docId);

  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(docRef);
    // Document must exist (caller should have already checked)
    if (!snapshot.exists) throw new Error(`Document ${collection}/${docId} not found in transaction`);

    const before: Readonly<Record<string, unknown>> = snapshot.data() ?? {};
    const currentVersion: number = typeof before[VERSION_FIELD] === 'number' ? (before[VERSION_FIELD] as number) : DEFAULT_VERSION;
    // Conflict check (skip if expectedVersion is undefined → force-write / backward compat)
    if (expectedVersion !== undefined && currentVersion !== expectedVersion) {
      throw conflictOf(before, currentVersion, expectedVersion);
    }

    const applied = derive(before);
    const newVersion = currentVersion + 1;
    // Write: updates + version bump + metadata
    transaction.update(docRef, { ...applied, [VERSION_FIELD]: newVersion, updatedAt: FieldValue.serverTimestamp(), updatedBy: userId });
    return { newVersion, docId, before, applied };
  });
}
