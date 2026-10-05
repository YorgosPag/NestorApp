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
  SetOptions as AdminSetOptions,
  UpdateData as AdminUpdateData,
  WriteResult as AdminWriteResult,
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

// ---------------------------------------------------------------------------
// Δηλωμένο πεδίο γραφής — «μια δήλωση που δεν μπορεί να πει ψέματα» (CHECK 3.17, ADR-195)
// ---------------------------------------------------------------------------

/**
 * Οι συλλογές στις οποίες **επιτρέπεται** να γράψει μια κλήση — γραμμένες ως κυριολεκτικά
 * `COLLECTIONS.X` (ή `SUBCOLLECTIONS.X`) **στο σημείο κλήσης**.
 *
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ: ένας γραφέας παρτίδων δέχεται έτοιμες αναφορές, άρα στο σημείο κλήσης δεν φαίνεται
 * **πού** γράφει. Η πύλη ιστορικού (CHECK 3.17) αποδίδει γραφή σε συλλογή μόνο από κυριολεκτικό κοντά στη
 * γραφή ⇒ οι τέσσερις αλυσίδες ορόφου ήταν **αόρατες**, και μια αλυσίδα που θα έχανε τη γραμμή ιστορικού
 * της θα έμενε πράσινη. Η δήλωση:
 *   - **επιβάλλεται** από τον τύπο (χωρίς αυτήν δεν μεταγλωττίζεται, και δεν είναι ποτέ κενή)·
 *   - **επαληθεύεται** την ώρα της γραφής (`assertDeclaredRef`) — δήλωση που δεν συμφωνεί με ό,τι γράφεται πετάει·
 *   - **διαβάζεται** στατικά από την πύλη (`scripts/check-entity-audit-coverage.js`).
 *
 * ⚠️ ΜΗΝ περάσεις εδώ υπολογισμένη λίστα (`targets.map((t) => t.collection)`): τρέχει, αλλά η πύλη δεν τη
 * διαβάζει — το κοκκινίζει η άγκυρα **Σ6** του `check-entity-audit-coverage.test.js`.
 */
export type DeclaredCollections = readonly [string, ...string[]];

/** Το πεδίο γραφής του `flushInBatches`: πού γράφει, και (προαιρετικά) ανά πόσες πράξεις κάνει commit. */
export interface DeclaredWriteScope {
  readonly collections: DeclaredCollections;
  /** Πράξεις ανά commit (προεπιλογή `BATCH_WRITE_LIMIT` = 450). */
  readonly batchSize?: number;
}

type AdminRef = AdminDocumentReference<AdminDocumentData>;

/** Το σύνολο των δηλωμένων συλλογών· κενή δήλωση δεν δηλώνει τίποτα, άρα δεν είναι δήλωση. */
function declaredSet(collections: readonly string[]): ReadonlySet<string> {
  if (collections.length === 0) throw new Error('Declared write scope is empty: declare at least one collection');
  return new Set(collections);
}

/**
 * Η αναφορά ανήκει σε δηλωμένη συλλογή, αλλιώς πετάει. Συγκρίνεται το **αναγνωριστικό της συλλογής**
 * (`ref.parent.id`, το τελευταίο τμήμα της διαδρομής) — το ίδιο για συλλογή κορυφής και για υποσυλλογή,
 * και ακριβώς ό,τι κρατούν οι τιμές των `COLLECTIONS` / `SUBCOLLECTIONS`.
 */
function assertDeclaredRef(ref: AdminRef, declared: ReadonlySet<string>): void {
  const collectionId = ref.parent?.id;
  if (collectionId !== undefined && declared.has(collectionId)) return;
  throw new Error(
    `Undeclared write: "${ref.path ?? ref.id}" belongs to collection "${collectionId ?? '?'}", ` +
    `declared: [${[...declared].join(', ')}]`,
  );
}

/**
 * Μία ατομική παρτίδα με δηλωμένο πεδίο γραφής — χρησιμοποιείται όπως το `WriteBatch`.
 * Κάθε πράξη ελέγχεται **πριν** μπει στην παρτίδα, άρα μια αδήλωτη γραφή δεν φτάνει ποτέ στο commit.
 */
export interface DeclaredBatch {
  update(ref: AdminRef, data: AdminUpdateData<AdminDocumentData>): DeclaredBatch;
  set(ref: AdminRef, data: AdminDocumentData, options?: AdminSetOptions): DeclaredBatch;
  delete(ref: AdminRef): DeclaredBatch;
  commit(): Promise<AdminWriteResult[]>;
}

/**
 * Ανοίγει **μία** παρτίδα (όλα ή τίποτα) που γράφει μόνο στις δηλωμένες συλλογές.
 *
 * @param db          - Admin Firestore instance
 * @param collections - Κυριολεκτικά `COLLECTIONS.X` — το πεδίο γραφής της παρτίδας
 */
export function openDeclaredBatch(db: AdminFirestore, collections: DeclaredCollections): DeclaredBatch {
  const declared = declaredSet(collections);
  const batch = db.batch();
  const guarded: DeclaredBatch = {
    update(ref, data) { assertDeclaredRef(ref, declared); batch.update(ref, data); return guarded; },
    set(ref, data, options) {
      assertDeclaredRef(ref, declared);
      if (options) batch.set(ref, data, options); else batch.set(ref, data);
      return guarded;
    },
    delete(ref) { assertDeclaredRef(ref, declared); batch.delete(ref); return guarded; },
    commit: () => batch.commit(),
  };
  return guarded;
}

/**
 * Commit an array of `batch.update()` operations in chunks, flushing at
 * `batchSize`. A failed chunk is recorded and skipped — one bad batch does not
 * abort the whole migration (belt-and-suspenders resilience).
 *
 * Η δήλωση ελέγχεται για **όλες** τις ενημερώσεις πριν από το πρώτο commit: μια αδήλωτη γραφή δεν είναι
 * «αποτυχημένη παρτίδα» που προσπερνιέται — είναι σφάλμα του καλούντος, και δεν γράφεται τίποτα.
 *
 * @param db      - Admin Firestore instance
 * @param updates - Queued `{ ref, data }` updates
 * @param scope   - Πού γράφει (κυριολεκτικά `COLLECTIONS.X`) + προαιρετικό `batchSize`
 */
export async function flushInBatches(
  db: AdminFirestore,
  updates: BatchUpdate[],
  scope: DeclaredWriteScope,
): Promise<FlushResult> {
  const declared = declaredSet(scope.collections);
  for (const { ref } of updates) assertDeclaredRef(ref, declared);

  const batchSize = scope.batchSize ?? BATCH_WRITE_LIMIT;
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
