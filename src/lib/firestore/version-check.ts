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
import type { ConflictResponseBody, VersionCheckOptions, VersionCheckResult } from '@/types/versioning';
import { VERSION_FIELD, DEFAULT_VERSION, CONFLICT_STATUS, CONFLICT_CODE } from '@/config/versioning-config';

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
  const { db, collection, docId, expectedVersion, updates, userId } = options;

  const docRef = db.collection(collection).doc(docId);

  const result = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(docRef);

    // Document must exist (caller should have already checked)
    if (!snapshot.exists) {
      throw new Error(`Document ${collection}/${docId} not found in transaction`);
    }

    const data = snapshot.data();
    const currentVersion: number = typeof data?.[VERSION_FIELD] === 'number'
      ? data[VERSION_FIELD]
      : DEFAULT_VERSION;

    // Conflict check (skip if expectedVersion is undefined → force-write / backward compat)
    if (expectedVersion !== undefined && currentVersion !== expectedVersion) {
      const updatedAtRaw = data?.updatedAt;
      let updatedAtISO: string;
      if (updatedAtRaw && typeof updatedAtRaw === 'object' && 'toDate' in updatedAtRaw) {
        updatedAtISO = (updatedAtRaw as { toDate(): Date }).toDate().toISOString();
      } else {
        updatedAtISO = new Date().toISOString();
      }

      throw new ConflictError({
        code: CONFLICT_CODE,
        error: `Version conflict: expected ${expectedVersion}, current ${currentVersion}`,
        errorCode: CONFLICT_CODE,
        currentVersion,
        expectedVersion,
        updatedAt: updatedAtISO,
        updatedBy: (data?.updatedBy as string) ?? 'unknown',
      });
    }

    const newVersion = currentVersion + 1;

    // Write: updates + version bump + metadata
    transaction.update(docRef, {
      ...updates,
      [VERSION_FIELD]: newVersion,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: userId,
    });

    return { newVersion, docId };
  });

  return result;
}
