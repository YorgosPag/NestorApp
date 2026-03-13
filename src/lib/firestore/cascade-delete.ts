/**
 * =============================================================================
 * 🏢 ENTERPRISE: CASCADE DELETE UTILITY
 * =============================================================================
 *
 * Reusable server-only utility for cascading hard deletes across
 * Firestore collections. Queries children by foreign key and batch-deletes
 * them in Firestore-compliant batches (max 500 ops/batch).
 *
 * @module lib/firestore/cascade-delete
 * @see ADR-210
 */

import { FIRESTORE_LIMITS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('CascadeDelete');

// ============================================================================
// TYPES
// ============================================================================

/** Definition of a child collection to cascade-delete */
export interface CascadeChild {
  /** Firestore collection name (use COLLECTIONS constants) */
  collection: string;
  /** Foreign key field that references the parent document */
  foreignKey: string;
  /** Human-readable label for logging */
  label: string;
}

/** Result of a cascade delete operation */
export interface CascadeDeleteResult {
  /** Count of deleted documents per collection label */
  deleted: Record<string, number>;
  /** Total number of documents deleted across all collections */
  total: number;
}

// ============================================================================
// CORE FUNCTION
// ============================================================================

/**
 * Cascade-deletes all children of a parent document across multiple collections.
 *
 * Queries each child collection by `foreignKey == parentId`, then batch-deletes
 * all matching documents. Respects Firestore's 500 ops/batch limit.
 *
 * @param db - Firestore Admin instance (injected, not imported)
 * @param parentId - The ID of the parent document being deleted
 * @param childDefs - Array of child collection definitions to cascade into
 * @returns Summary of what was deleted
 *
 * @example
 * ```typescript
 * const result = await cascadeDeleteChildren(db, buildingId, [
 *   { collection: COLLECTIONS.UNITS, foreignKey: 'buildingId', label: 'units' },
 *   { collection: COLLECTIONS.PARKING_SPACES, foreignKey: 'buildingId', label: 'parking' },
 * ]);
 * // result = { deleted: { units: 5, parking: 3 }, total: 8 }
 * ```
 */
export async function cascadeDeleteChildren(
  db: FirebaseFirestore.Firestore,
  parentId: string,
  childDefs: readonly CascadeChild[]
): Promise<CascadeDeleteResult> {
  const deleted: Record<string, number> = {};
  let total = 0;

  for (const child of childDefs) {
    const snapshot = await db
      .collection(child.collection)
      .where(child.foreignKey, '==', parentId)
      .get();

    if (snapshot.empty) {
      deleted[child.label] = 0;
      continue;
    }

    const docs = snapshot.docs;
    const count = docs.length;

    // Batch delete in chunks of BATCH_WRITE_LIMIT (500)
    for (let i = 0; i < docs.length; i += FIRESTORE_LIMITS.BATCH_WRITE_LIMIT) {
      const batch = db.batch();
      const chunk = docs.slice(i, i + FIRESTORE_LIMITS.BATCH_WRITE_LIMIT);
      for (const docSnap of chunk) {
        batch.delete(docSnap.ref);
      }
      await batch.commit();
    }

    deleted[child.label] = count;
    total += count;

    logger.info(`[CascadeDelete] Deleted ${count} ${child.label}`, {
      parentId,
      collection: child.collection,
      count,
    });
  }

  return { deleted, total };
}
