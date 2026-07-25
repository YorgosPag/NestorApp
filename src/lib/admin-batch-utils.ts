/**
 * =============================================================================
 * ADMIN BATCH PROCESSING UTILITIES — ADR-214 Phase 8
 * =============================================================================
 *
 * Shared cursor-based pagination for admin routes that read entire Firestore
 * collections. Prevents timeout / memory exhaustion on large datasets.
 *
 * Variant: processAdminBatch (Admin SDK, firebase-admin/firestore)
 *
 * @module lib/admin-batch-utils
 * @see ADR-214 Phase 8 — Admin Routes Safety
 */

import type {
  CollectionReference as AdminCollectionReference,
  DocumentData as AdminDocumentData,
  DocumentReference as AdminDocumentReference,
  Firestore as AdminFirestore,
  Query as AdminQuery,
  QuerySnapshot as AdminQuerySnapshot,
  DocumentSnapshot as AdminDocumentSnapshot,
  UpdateData as AdminUpdateData,
} from 'firebase-admin/firestore';
import { getErrorMessage } from '@/lib/error-utils';

// ---------------------------------------------------------------------------
// Batch size constants
// ---------------------------------------------------------------------------

/** Read-only analysis (GET endpoints) */
export const BATCH_SIZE_READ = 500;

/** Read + write operations (POST migrate/fix endpoints) */
export const BATCH_SIZE_WRITE = 200;

/** Batched writes — conservative flush size (Firestore hard max is 500) */
export const BATCH_WRITE_LIMIT = 450;


// ---------------------------------------------------------------------------
// Admin SDK batch processor
// ---------------------------------------------------------------------------

export interface AdminBatchResult<T> {
  totalProcessed: number;
  results: T[];
}

/**
 * Paginate through an Admin SDK collection/query in batches.
 *
 * @param queryRef  - `adminDb.collection(...)` or `.where(...)` chain
 * @param batchSize - Documents per round-trip (default BATCH_SIZE_READ)
 * @param onBatch   - Called with each batch's docs. Return value is accumulated.
 */
export async function processAdminBatch<T = void>(
  queryRef: AdminCollectionReference<AdminDocumentData> | AdminQuery<AdminDocumentData>,
  batchSize: number,
  onBatch: (docs: AdminQuerySnapshot<AdminDocumentData>['docs']) => T | Promise<T>,
): Promise<AdminBatchResult<T>> {
  let lastDoc: AdminDocumentSnapshot<AdminDocumentData> | undefined;
  let totalProcessed = 0;
  const results: T[] = [];

  while (true) {
    let pageQuery = queryRef.limit(batchSize);
    if (lastDoc) {
      pageQuery = pageQuery.startAfter(lastDoc);
    }

    const snapshot = await pageQuery.get();

    if (snapshot.empty) break;

    const result = await onBatch(snapshot.docs);
    results.push(result);
    totalProcessed += snapshot.size;
    lastDoc = snapshot.docs[snapshot.docs.length - 1];

    // If we got fewer than batchSize, we've reached the end
    if (snapshot.size < batchSize) break;
  }

  return { totalProcessed, results };
}


// ---------------------------------------------------------------------------
// Lookup-cache builder (paginated .select → Map)
// ---------------------------------------------------------------------------

/**
 * Build an in-memory `Map<docId, value>` from a collection/query by scanning a
 * single projected field across all documents, cursor-paginated.
 *
 * Replaces the hand-rolled "load whole collection into a Map" loops that admin
 * backfills copy-paste (e.g. file → companyId resolution).
 *
 * @param queryRef    - `adminDb.collection(...)` or a `.where(...)` chain
 * @param valueField  - Field projected + used as the map value (skipped if falsy)
 * @param batchSize   - Documents per round-trip (default BATCH_SIZE_READ)
 * @returns Map keyed by document id, valued by `valueField`
 */
export async function buildLookupCache(
  queryRef: AdminCollectionReference<AdminDocumentData> | AdminQuery<AdminDocumentData>,
  valueField: string,
  batchSize: number = BATCH_SIZE_READ,
): Promise<Map<string, string>> {
  const cache = new Map<string, string>();

  await processAdminBatch(
    queryRef.select(valueField).orderBy('__name__'),
    batchSize,
    (docs) => {
      for (const doc of docs) {
        const value = doc.get(valueField) as string | undefined;
        if (value) {
          cache.set(doc.id, value);
        }
      }
    },
  );

  return cache;
}


// ---------------------------------------------------------------------------
// Batched writer (chunked batch.update with per-batch resilience)
// ---------------------------------------------------------------------------

/** One queued `batch.update()` operation. */
export interface BatchUpdate {
  ref: AdminDocumentReference<AdminDocumentData>;
  data: AdminUpdateData<AdminDocumentData>;
}

export interface FlushResult {
  /** Documents successfully committed. */
  written: number;
  /** One message per failed batch (failed batches are skipped, not fatal). */
  errors: string[];
}

/**
 * Commit an array of `batch.update()` operations in chunks, flushing at
 * `batchSize`. A failed chunk is recorded and skipped — one bad batch does not
 * abort the whole migration (belt-and-suspenders resilience).
 *
 * @param db        - Admin Firestore instance
 * @param updates   - Queued `{ ref, data }` updates
 * @param batchSize - Ops per commit (default BATCH_WRITE_LIMIT = 450)
 */
export async function flushInBatches(
  db: AdminFirestore,
  updates: BatchUpdate[],
  batchSize: number = BATCH_WRITE_LIMIT,
): Promise<FlushResult> {
  const result: FlushResult = { written: 0, errors: [] };

  for (let i = 0; i < updates.length; i += batchSize) {
    const chunk = updates.slice(i, i + batchSize);
    const batch = db.batch();

    for (const { ref, data } of chunk) {
      batch.update(ref, data);
    }

    try {
      await batch.commit();
      result.written += chunk.length;
    } catch (error) {
      result.errors.push(
        `Batch ${Math.floor(i / batchSize) + 1} (${chunk.length} docs) failed: ${getErrorMessage(error)}`,
      );
    }
  }

  return result;
}
