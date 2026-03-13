/**
 * =============================================================================
 * ADMIN BATCH PROCESSING UTILITIES — ADR-214 Phase 8
 * =============================================================================
 *
 * Shared cursor-based pagination for admin routes that read entire Firestore
 * collections. Prevents timeout / memory exhaustion on large datasets.
 *
 * Two variants:
 *  - processClientBatch: Client SDK (firebase/firestore)
 *  - processAdminBatch:  Admin SDK  (firebase-admin/firestore)
 *
 * @module lib/admin-batch-utils
 * @see ADR-214 Phase 8 — Admin Routes Safety
 */

import {
  type QueryConstraint,
  type CollectionReference,
  type DocumentData,
  type DocumentSnapshot as ClientDocumentSnapshot,
  type QuerySnapshot as ClientQuerySnapshot,
  getDocs,
  query,
  limit,
  startAfter,
} from 'firebase/firestore';

import type {
  CollectionReference as AdminCollectionReference,
  DocumentData as AdminDocumentData,
  Query as AdminQuery,
  QuerySnapshot as AdminQuerySnapshot,
  DocumentSnapshot as AdminDocumentSnapshot,
} from 'firebase-admin/firestore';

// ---------------------------------------------------------------------------
// Batch size constants
// ---------------------------------------------------------------------------

/** Read-only analysis (GET endpoints) */
export const BATCH_SIZE_READ = 500;

/** Read + write operations (POST migrate/fix endpoints) */
export const BATCH_SIZE_WRITE = 200;

// ---------------------------------------------------------------------------
// Client SDK batch processor
// ---------------------------------------------------------------------------

export interface ClientBatchResult<T> {
  totalProcessed: number;
  results: T[];
}

/**
 * Paginate through a Client SDK collection in batches.
 *
 * @param colRef      - `collection(db, COLLECTIONS.XXX)`
 * @param constraints - Additional where/orderBy constraints (excl. limit/startAfter)
 * @param batchSize   - Documents per round-trip (default BATCH_SIZE_READ)
 * @param onBatch     - Called with each batch's docs. Return value is accumulated.
 */
export async function processClientBatch<T = void>(
  colRef: CollectionReference<DocumentData>,
  constraints: QueryConstraint[],
  batchSize: number,
  onBatch: (docs: ClientQuerySnapshot<DocumentData>['docs']) => T | Promise<T>,
): Promise<ClientBatchResult<T>> {
  let lastDoc: ClientDocumentSnapshot<DocumentData> | undefined;
  let totalProcessed = 0;
  const results: T[] = [];

  while (true) {
    const pageConstraints: QueryConstraint[] = [
      ...constraints,
      limit(batchSize),
      ...(lastDoc ? [startAfter(lastDoc)] : []),
    ];

    const snapshot = await getDocs(query(colRef, ...pageConstraints));

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
