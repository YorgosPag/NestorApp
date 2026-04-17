/**
 * =============================================================================
 * SCHEMA RECONCILER — ADR-313 Phase 4
 * =============================================================================
 *
 * Compares backup field inventory against current Firestore state and produces
 * a reconciliation plan for each collection. Uses Approach B (Google pattern):
 *
 * - Restore writes only what the backup contains
 * - merge: true preserves fields in current DB not present in backup
 * - No extra scan of current schema needed
 * - Pre-restore snapshot captures existing doc IDs for future rollback
 *
 * The reconciler's job:
 * 1. For each collection in the manifest, check which docs already exist
 * 2. Classify each doc as: NEW (create), UPDATE (overwrite), SKIP (immutable+exists)
 * 3. Build a PreRestoreSnapshot of docs that will be overwritten
 *
 * @module services/backup/schema-reconciler
 * @see adrs/ADR-313-enterprise-backup-restore.md §5
 */

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { processAdminBatch, BATCH_SIZE_READ } from '@/lib/admin-batch-utils';
import { createModuleLogger } from '@/lib/telemetry';

import type { Firestore } from 'firebase-admin/firestore';
import type {
  BackupManifest,
  CollectionManifestEntry,
  SubcollectionManifestEntry,
  CollectionReconciliation,
  SerializedDocument,
} from './backup-manifest.types';

const logger = createModuleLogger('SchemaReconciler');

// ---------------------------------------------------------------------------
// Reconciliation for a single collection
// ---------------------------------------------------------------------------

interface ReconcileCollectionParams {
  collectionKey: string;
  collectionName: string;
  isImmutable: boolean;
  backupFields: string[];
  documentCount: number;
  documents: SerializedDocument[];
  /** Firestore collection path (for subcollections: parent/docId/subName) */
  firestorePath: string;
}

/**
 * Reconcile a single collection: check which backup docs already exist in DB.
 */
async function reconcileCollection(
  db: Firestore,
  params: ReconcileCollectionParams,
): Promise<{ reconciliation: CollectionReconciliation; existingDocIds: string[] }> {
  const { collectionKey, collectionName, isImmutable, backupFields, documentCount, documents, firestorePath } = params;

  // Collect backup doc IDs
  const backupDocIds = new Set(documents.map(doc => doc._id));

  // Check which docs already exist in current DB
  const existingDocIds: string[] = [];
  const colRef = db.collection(firestorePath);

  await processAdminBatch(colRef, BATCH_SIZE_READ, (docs) => {
    for (const doc of docs) {
      if (backupDocIds.has(doc.id)) {
        existingDocIds.push(doc.id);
      }
    }
  });

  const existingSet = new Set(existingDocIds);
  const newCount = documents.filter(d => !existingSet.has(d._id)).length;

  let updateCount = 0;
  let skipCount = 0;

  if (isImmutable) {
    skipCount = existingDocIds.length;
    updateCount = 0;
  } else {
    updateCount = existingDocIds.length;
    skipCount = 0;
  }

  const reconciliation: CollectionReconciliation = {
    collectionKey,
    collectionName,
    backupFields,
    isImmutable,
    documentCount,
    existingCount: existingDocIds.length,
    newCount,
    updateCount,
    skipCount,
  };

  return { reconciliation, existingDocIds };
}

// ---------------------------------------------------------------------------
// Public: Reconcile all collections from manifest
// ---------------------------------------------------------------------------

export interface ReconciliationResult {
  collections: CollectionReconciliation[];
  subcollections: CollectionReconciliation[];

  /** Doc IDs per collection that will be overwritten (for pre-restore snapshot) */
  existingDocsMap: Map<string, string[]>;

  /** Aggregate counts */
  totalDocuments: number;
  totalNew: number;
  totalUpdate: number;
  totalSkip: number;

  warnings: string[];
}

/**
 * Reconcile all collections and subcollections in a backup manifest.
 *
 * @param manifest - Backup manifest from GCS
 * @param collectionDocs - Map of backupFile path → SerializedDocument[]
 * @param options - Filter by specific collection keys, skip immutable
 */
export async function reconcileBackup(
  manifest: BackupManifest,
  collectionDocs: Map<string, SerializedDocument[]>,
  options?: { collections?: string[]; skipImmutable?: boolean },
): Promise<ReconciliationResult> {
  const db = getAdminFirestore();
  const warnings: string[] = [];
  const existingDocsMap = new Map<string, string[]>();

  const collectionResults: CollectionReconciliation[] = [];
  const subcollectionResults: CollectionReconciliation[] = [];

  // --- Top-level collections ---
  for (const entry of manifest.collections) {
    if (options?.collections?.length && !options.collections.includes(entry.collectionKey)) {
      continue;
    }
    if (options?.skipImmutable && entry.isImmutable) {
      continue;
    }

    const documents = collectionDocs.get(entry.backupFile) ?? [];
    if (documents.length === 0) {
      warnings.push(`Collection ${entry.collectionKey}: backup file empty or missing`);
      continue;
    }

    const { reconciliation, existingDocIds } = await reconcileCollection(db, {
      collectionKey: entry.collectionKey,
      collectionName: entry.collectionName,
      isImmutable: entry.isImmutable,
      backupFields: entry.fieldInventory,
      documentCount: entry.documentCount,
      documents,
      firestorePath: entry.collectionName,
    });

    collectionResults.push(reconciliation);
    if (existingDocIds.length > 0) {
      existingDocsMap.set(entry.collectionName, existingDocIds);
    }
  }

  // --- Subcollections ---
  for (const entry of manifest.subcollections) {
    if (options?.collections?.length && !options.collections.includes(entry.subcollectionKey)) {
      continue;
    }

    const documents = collectionDocs.get(entry.backupFile) ?? [];
    if (documents.length === 0) {
      warnings.push(`Subcollection ${entry.subcollectionKey}: backup file empty or missing`);
      continue;
    }

    // Subcollection docs have paths like "parentCol/parentId/subCol/docId"
    // Group by parent to check existence per parent
    const byParent = groupDocsByParent(documents);
    let totalExisting = 0;
    let totalNew = 0;
    let totalSkip = 0;
    const allExistingIds: string[] = [];

    for (const [parentDocId, parentDocs] of byParent) {
      const parentColName = getParentCollectionName(entry, manifest);
      if (!parentColName) {
        warnings.push(`Subcollection ${entry.subcollectionKey}: parent collection not found`);
        continue;
      }

      const subPath = `${parentColName}/${parentDocId}/${entry.subcollectionName}`;
      const subDocIds = new Set(parentDocs.map(d => d._id));

      const subColRef = db.collection(subPath);
      const existingIds: string[] = [];

      await processAdminBatch(subColRef, BATCH_SIZE_READ, (docs) => {
        for (const doc of docs) {
          if (subDocIds.has(doc.id)) {
            existingIds.push(doc.id);
          }
        }
      });

      totalExisting += existingIds.length;
      totalNew += parentDocs.length - existingIds.length;
      allExistingIds.push(...existingIds);
    }

    const reconciliation: CollectionReconciliation = {
      collectionKey: entry.subcollectionKey,
      collectionName: entry.subcollectionName,
      backupFields: entry.fieldInventory,
      isImmutable: false,
      documentCount: entry.totalDocuments,
      existingCount: totalExisting,
      newCount: totalNew,
      updateCount: totalExisting,
      skipCount: totalSkip,
    };

    subcollectionResults.push(reconciliation);
    if (allExistingIds.length > 0) {
      existingDocsMap.set(`sub:${entry.subcollectionKey}`, allExistingIds);
    }
  }

  // Aggregate
  const allResults = [...collectionResults, ...subcollectionResults];
  const totalDocuments = allResults.reduce((s, r) => s + r.documentCount, 0);
  const totalNew = allResults.reduce((s, r) => s + r.newCount, 0);
  const totalUpdate = allResults.reduce((s, r) => s + r.updateCount, 0);
  const totalSkip = allResults.reduce((s, r) => s + r.skipCount, 0);

  logger.info(`Reconciliation complete: ${totalDocuments} docs — ${totalNew} new, ${totalUpdate} update, ${totalSkip} skip`);

  return {
    collections: collectionResults,
    subcollections: subcollectionResults,
    existingDocsMap,
    totalDocuments,
    totalNew,
    totalUpdate,
    totalSkip,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Group subcollection docs by parent document ID (extracted from _path) */
function groupDocsByParent(
  documents: SerializedDocument[],
): Map<string, SerializedDocument[]> {
  const grouped = new Map<string, SerializedDocument[]>();

  for (const doc of documents) {
    // Path: "parentCol/parentId/subCol/docId"
    const parts = doc._path.split('/');
    if (parts.length >= 4) {
      const parentId = parts[1];
      const existing = grouped.get(parentId) ?? [];
      existing.push(doc);
      grouped.set(parentId, existing);
    }
  }

  return grouped;
}

/** Get parent collection Firestore name from manifest */
function getParentCollectionName(
  subEntry: SubcollectionManifestEntry,
  manifest: BackupManifest,
): string | null {
  const parent = manifest.collections.find(
    c => c.collectionKey === subEntry.parentCollectionKey,
  );
  return parent?.collectionName ?? null;
}
