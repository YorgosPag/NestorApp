/**
 * =============================================================================
 * ENTERPRISE BACKUP SERVICE — ADR-313
 * =============================================================================
 *
 * Core backup orchestrator. Exports Firestore collections and subcollections
 * using the SSoT collection registry (firestore-collections.ts) and the
 * Admin SDK batch processor (admin-batch-utils.ts).
 *
 * Architecture:
 * - COLLECTIONS/SUBCOLLECTIONS from firestore-collections.ts drive what to export
 * - processAdminBatch() for safe cursor-based pagination
 * - serializeDocument() converts Firestore types to JSON-safe NDJSON
 * - BackupGcsService handles writing to GCS bucket
 *
 * @module services/backup/backup.service
 * @see adrs/ADR-313-enterprise-backup-restore.md
 */

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { processAdminBatch, BATCH_SIZE_READ } from '@/lib/admin-batch-utils';
import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import { GCP_PROJECT_ID } from '@/config/gcs-buckets';
import {
  SUBCOLLECTION_PARENTS,
  IMMUTABLE_COLLECTIONS,
} from '@/config/firestore-collections';
import { enterpriseIdService } from '@/services/enterprise-id.service';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { serializeDocument, collectFieldInventory } from './backup-serializer';
import { StorageBackupService } from './storage-backup.service';
import type { BackupGcsService } from './backup-gcs.service';

import type { DocumentData, Firestore } from 'firebase-admin/firestore';
import type {
  BackupManifest,
  CollectionManifestEntry,
  SubcollectionManifestEntry,
  BackupStatus,
  BackupPhase,
  StatusCallback,
  SerializedDocument,
} from './backup-manifest.types';
import type { StorageExportResult } from './storage-backup.service';
import { nowISO } from '@/lib/date-local';

const logger = createModuleLogger('BackupService');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MANIFEST_VERSION = '1.0.0' as const;

// ---------------------------------------------------------------------------
// Export result for a single collection
// ---------------------------------------------------------------------------

export interface CollectionExportResult {
  entry: CollectionManifestEntry;
  documents: SerializedDocument[];
}

export interface SubcollectionExportResult {
  entry: SubcollectionManifestEntry;
  documents: SerializedDocument[];
}

// ---------------------------------------------------------------------------
// BackupService
// ---------------------------------------------------------------------------

export class BackupService {
  private db: Firestore;

  constructor() {
    this.db = getAdminFirestore();
  }

  /**
   * Export a single top-level collection.
   */
  async exportCollection(
    collectionKey: string,
    collectionName: string,
  ): Promise<CollectionExportResult> {
    logger.info(`Exporting collection: ${collectionKey} (${collectionName})`);

    const colRef = this.db.collection(collectionName);
    const documents: SerializedDocument[] = [];
    const fieldInventory = new Set<string>();

    const { totalProcessed } = await processAdminBatch(
      colRef,
      BATCH_SIZE_READ,
      (docs) => {
        for (const doc of docs) {
          const data = doc.data();
          const serialized = serializeDocument(doc.id, doc.ref.path, data);
          documents.push(serialized);

          const fields = collectFieldInventory(data);
          fields.forEach(f => fieldInventory.add(f));
        }
      },
    );

    const isImmutable = IMMUTABLE_COLLECTIONS.includes(collectionKey);

    const entry: CollectionManifestEntry = {
      collectionKey,
      collectionName,
      documentCount: totalProcessed,
      fieldInventory: Array.from(fieldInventory).sort(),
      isImmutable,
      backupFile: `collections/${collectionName}.ndjson.gz`,
      checksum: '', // Computed by GCS service after write
    };

    logger.info(`Exported ${collectionKey}: ${totalProcessed} documents, ${fieldInventory.size} unique fields`);

    return { entry, documents };
  }

  /**
   * Export all top-level collections from the COLLECTIONS registry.
   */
  async exportAllCollections(
    onProgress?: StatusCallback,
  ): Promise<CollectionExportResult[]> {
    const collectionEntries = Object.entries(COLLECTIONS) as [string, string][];
    const results: CollectionExportResult[] = [];
    let processed = 0;

    for (const [key, name] of collectionEntries) {
      if (onProgress) {
        await onProgress({
          phase: 'exporting_collections',
          currentCollection: key,
          processedCollections: processed,
          totalCollections: collectionEntries.length,
        });
      }

      try {
        const result = await this.exportCollection(key, name);
        results.push(result);
      } catch (error) {
        logger.error(`Failed to export collection ${key}: ${getErrorMessage(error)}`);
        throw new Error(`Failed to export collection ${key}: ${getErrorMessage(error)}`);
      }

      processed++;
    }

    return results;
  }

  /**
   * Export a single subcollection across all parent documents.
   */
  async exportSubcollection(
    subcollectionKey: string,
    subcollectionName: string,
    parentCollectionKey: string,
    parentCollectionName: string,
  ): Promise<SubcollectionExportResult> {
    logger.info(`Exporting subcollection: ${subcollectionKey} under ${parentCollectionKey}`);

    const parentColRef = this.db.collection(parentCollectionName);
    const documents: SerializedDocument[] = [];
    const fieldInventory = new Set<string>();
    const parentDocumentIds: string[] = [];

    // Enumerate all parent documents
    await processAdminBatch(
      parentColRef,
      BATCH_SIZE_READ,
      async (parentDocs) => {
        for (const parentDoc of parentDocs) {
          const subColRef = parentDoc.ref.collection(subcollectionName);
          const subSnapshot = await subColRef.get();

          if (subSnapshot.empty) continue;

          parentDocumentIds.push(parentDoc.id);

          for (const subDoc of subSnapshot.docs) {
            const data = subDoc.data();
            const serialized = serializeDocument(subDoc.id, subDoc.ref.path, data);
            documents.push(serialized);

            const fields = collectFieldInventory(data);
            fields.forEach(f => fieldInventory.add(f));
          }
        }
      },
    );

    const entry: SubcollectionManifestEntry = {
      subcollectionKey,
      subcollectionName,
      parentCollectionKey,
      parentDocumentIds,
      totalDocuments: documents.length,
      fieldInventory: Array.from(fieldInventory).sort(),
      backupFile: `subcollections/${parentCollectionName}__${subcollectionName}.ndjson.gz`,
      checksum: '', // Computed by GCS service after write
    };

    logger.info(`Exported subcollection ${subcollectionKey}: ${documents.length} documents across ${parentDocumentIds.length} parents`);

    return { entry, documents };
  }

  /**
   * Export all subcollections from the SUBCOLLECTIONS registry.
   */
  async exportAllSubcollections(
    onProgress?: StatusCallback,
  ): Promise<SubcollectionExportResult[]> {
    const subcollectionEntries = Object.entries(SUBCOLLECTION_PARENTS) as [string, string][];
    const results: SubcollectionExportResult[] = [];

    for (const [subKey, parentKey] of subcollectionEntries) {
      if (onProgress) {
        await onProgress({
          phase: 'exporting_subcollections',
          currentCollection: subKey,
        });
      }

      const subcollectionName = SUBCOLLECTIONS[subKey as keyof typeof SUBCOLLECTIONS];
      const parentCollectionName = COLLECTIONS[parentKey as keyof typeof COLLECTIONS];

      if (!subcollectionName || !parentCollectionName) {
        logger.warn(`Skipping unmapped subcollection: ${subKey} → ${parentKey}`);
        continue;
      }

      try {
        const result = await this.exportSubcollection(
          subKey,
          subcollectionName,
          parentKey,
          parentCollectionName,
        );
        results.push(result);
      } catch (error) {
        logger.error(`Failed to export subcollection ${subKey}: ${getErrorMessage(error)}`);
        throw new Error(`Failed to export subcollection ${subKey}: ${getErrorMessage(error)}`);
      }
    }

    return results;
  }

  /**
   * Build the full BackupManifest from export results.
   */
  buildManifest(
    backupId: string,
    collectionResults: CollectionExportResult[],
    subcollectionResults: SubcollectionExportResult[],
    storageResult: StorageExportResult | null,
    triggeredBy: string,
    startTime: number,
  ): BackupManifest {
    const totalDocuments =
      collectionResults.reduce((sum, r) => sum + r.entry.documentCount, 0) +
      subcollectionResults.reduce((sum, r) => sum + r.entry.totalDocuments, 0);

    return {
      id: backupId,
      version: MANIFEST_VERSION,
      type: 'full',
      createdAt: nowISO(),
      createdBy: triggeredBy,
      projectId: GCP_PROJECT_ID,
      environment: (process.env.NODE_ENV as 'development' | 'staging' | 'production') ?? 'development',
      collections: collectionResults.map(r => r.entry),
      subcollections: subcollectionResults.map(r => r.entry),
      storageFiles: storageResult?.entries ?? [],
      firestoreCollectionsVersion: nowISO(),
      totalDocuments,
      totalStorageFiles: storageResult?.entries.length ?? 0,
      totalStorageBytes: storageResult?.totalBytes ?? 0,
      checksum: '', // Computed after manifest is finalized
      durationMs: Date.now() - startTime,
      warnings: storageResult?.warnings ?? [],
    };
  }

  /**
   * Execute a full backup — collections + subcollections + manifest.
   *
   * Returns the manifest and all serialized documents organized by file path.
   * The caller (API route or GCS service) handles persisting the data.
   */
  async executeFullBackup(
    triggeredBy: string,
    onProgress?: StatusCallback,
    gcsService?: BackupGcsService,
  ): Promise<{
    manifest: BackupManifest;
    files: Map<string, SerializedDocument[]>;
  }> {
    const startTime = Date.now();
    const backupId = enterpriseIdService.generateBackupId();
    const files = new Map<string, SerializedDocument[]>();

    logger.info(`Starting full backup ${backupId}...`);

    if (onProgress) {
      await onProgress({
        backupId,
        phase: 'initializing',
        processedCollections: 0,
        totalCollections: Object.keys(COLLECTIONS).length,
        documentsExported: 0,
        storageFilesExported: 0,
        startedAt: nowISO(),
        triggeredBy,
      });
    }

    // Export all top-level collections
    const collectionResults = await this.exportAllCollections(onProgress);

    for (const result of collectionResults) {
      files.set(result.entry.backupFile, result.documents);
    }

    // Export all subcollections
    const subcollectionResults = await this.exportAllSubcollections(onProgress);

    for (const result of subcollectionResults) {
      files.set(result.entry.backupFile, result.documents);
    }

    // Export Storage files (Phase 3)
    // Requires gcsService because files are written directly to backup bucket
    let storageResult: StorageExportResult | null = null;

    if (gcsService) {
      if (onProgress) {
        await onProgress({ phase: 'exporting_storage', storageFilesExported: 0 });
      }

      const storageService = new StorageBackupService();
      storageResult = await storageService.exportAllFiles(
        backupId,
        gcsService,
        onProgress,
      );
    } else {
      logger.warn('No GCS service provided — skipping Storage export');
    }

    // Build manifest
    const manifest = this.buildManifest(
      backupId,
      collectionResults,
      subcollectionResults,
      storageResult,
      triggeredBy,
      startTime,
    );

    if (onProgress) {
      await onProgress({
        backupId: manifest.id,
        phase: 'completed',
        processedCollections: Object.keys(COLLECTIONS).length,
        totalCollections: Object.keys(COLLECTIONS).length,
        documentsExported: manifest.totalDocuments,
        storageFilesExported: manifest.totalStorageFiles,
        completedAt: nowISO(),
      });
    }

    logger.info(
      `Full backup completed: ${manifest.id} — ` +
      `${manifest.totalDocuments} documents, ${manifest.totalStorageFiles} storage files ` +
      `in ${manifest.durationMs}ms`,
    );

    return { manifest, files };
  }
}
