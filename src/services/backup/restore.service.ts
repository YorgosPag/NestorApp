/**
 * ENTERPRISE RESTORE SERVICE — ADR-313 Phase 4
 *
 * Restores Firestore data from manifest-driven backup. Approach B (Google):
 * merge mode, tier-ordered import, pre-restore snapshot, immutable skip.
 *
 * @module services/backup/restore.service
 * @see adrs/ADR-313-enterprise-backup-restore.md §6 Phase 4
 */

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { BATCH_SIZE_WRITE } from '@/lib/admin-batch-utils';
import { enterpriseIdService } from '@/services/enterprise-id.service';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { deserializeDocument } from './backup-serializer';
import { BackupGcsService } from './backup-gcs.service';
import { reconcileBackup } from './schema-reconciler';
import { orderByTier, resolveReferences } from './restore-helpers';
import { RestoreChainService } from './restore-chain.service';
import { StorageRestoreService } from './storage-restore.service';

import type { Firestore, WriteBatch } from 'firebase-admin/firestore';
import type {
  BackupManifest,
  SubcollectionManifestEntry,
  RestoreStatus,
  RestoreOptions,
  RestorePreview,
  PreRestoreSnapshot,
  PreRestoreCollectionSnapshot,
  SerializedDocument,
} from './backup-manifest.types';
import type { ReconciliationResult } from './schema-reconciler';
import { nowISO } from '@/lib/date-local';

const logger = createModuleLogger('RestoreService');

type RestoreStatusCallback = (status: Partial<RestoreStatus>) => Promise<void>;

export class RestoreService {
  private db: Firestore;
  private gcsService: BackupGcsService;

  constructor(gcsService?: BackupGcsService) {
    this.db = getAdminFirestore();
    this.gcsService = gcsService ?? new BackupGcsService();
  }

  /**
   * Read and validate a backup manifest from GCS.
   * Checks: manifest exists, version compatible, collections non-empty.
   */
  async validateManifest(backupId: string): Promise<{
    valid: boolean;
    manifest: BackupManifest | null;
    errors: string[];
  }> {
    const errors: string[] = [];

    try {
      const manifest = await this.gcsService.readManifest(backupId);

      if (manifest.version !== '1.0.0') {
        errors.push(`Unsupported manifest version: ${manifest.version}`);
      }

      if (manifest.collections.length === 0 && manifest.subcollections.length === 0) {
        errors.push('Manifest contains no collections or subcollections');
      }

      if (manifest.id !== backupId) {
        errors.push(`Manifest ID mismatch: expected ${backupId}, got ${manifest.id}`);
      }

      return {
        valid: errors.length === 0,
        manifest: errors.length === 0 ? manifest : null,
        errors,
      };
    } catch (error) {
      errors.push(`Failed to read manifest: ${getErrorMessage(error)}`);
      return { valid: false, manifest: null, errors };
    }
  }

  /**
   * Preview what a restore would do without writing anything.
   * Reads all backup files, runs schema reconciliation, returns summary.
   */
  async previewRestore(
    backupId: string,
    options?: RestoreOptions,
  ): Promise<RestorePreview> {
    const { valid, manifest, errors } = await this.validateManifest(backupId);
    if (!manifest) {
      throw new Error(`Invalid manifest: ${errors.join(', ')}`);
    }

    // Resolve chain (handles incremental → full chain merge)
    const chainService = new RestoreChainService(this.gcsService);
    const chain = await chainService.resolveChain(backupId);
    const effectiveManifest = {
      ...chain.fullManifest,
      collections: chain.mergedCollections,
    };

    // Run reconciliation
    const reconciliation = await reconcileBackup(effectiveManifest, chain.mergedFiles, {
      collections: options?.collections,
      skipImmutable: options?.skipImmutable,
    });

    return {
      backupId: manifest.id,
      backupCreatedAt: manifest.createdAt,
      backupType: manifest.type,
      collections: reconciliation.collections,
      subcollections: reconciliation.subcollections,
      totalDocuments: reconciliation.totalDocuments,
      totalNew: reconciliation.totalNew,
      totalUpdate: reconciliation.totalUpdate,
      totalSkip: reconciliation.totalSkip,
      warnings: [...reconciliation.warnings, ...chain.warnings],
    };
  }

  /**
   * Execute a full restore from backup.
   *
   * Flow:
   * 1. Validate manifest
   * 2. Read all backup files from GCS
   * 3. Run schema reconciliation
   * 4. Create pre-restore snapshot (doc IDs of docs that will be overwritten)
   * 5. Restore collections in tier order
   * 6. Restore subcollections
   */
  async executeRestore(
    backupId: string,
    triggeredBy: string,
    options?: RestoreOptions,
    onProgress?: RestoreStatusCallback,
  ): Promise<{
    restoreId: string;
    documentsRestored: number;
    documentsSkipped: number;
    storageRestored: number;
    storageSkipped: number;
    snapshotId: string;
    durationMs: number;
  }> {
    const startTime = Date.now();
    const restoreId = enterpriseIdService.generateRestoreId();

    logger.info(`Starting restore ${restoreId} from backup ${backupId}`);

    // Phase 1: Validate
    await this.updateProgress(onProgress, {
      restoreId,
      backupId,
      phase: 'validating',
      processedCollections: 0,
      totalCollections: 0,
      documentsRestored: 0,
      documentsSkipped: 0,
      startedAt: nowISO(),
      triggeredBy,
    });

    const { valid, manifest, errors } = await this.validateManifest(backupId);
    if (!manifest) {
      throw new Error(`Invalid manifest: ${errors.join(', ')}`);
    }

    // Phase 2: Resolve chain (handles incremental → full chain merge)
    const chainService = new RestoreChainService(this.gcsService);
    const chain = await chainService.resolveChain(backupId);
    const collectionDocs = chain.mergedFiles;
    const effectiveManifest = {
      ...chain.fullManifest,
      collections: chain.mergedCollections,
      subcollections: chain.fullManifest.subcollections,
      storageFiles: chain.fullManifest.storageFiles,
    };

    // Phase 3: Reconcile schema
    await this.updateProgress(onProgress, {
      restoreId,
      phase: 'reconciling_schema',
    });

    const reconciliation = await reconcileBackup(effectiveManifest, collectionDocs, {
      collections: options?.collections,
      skipImmutable: options?.skipImmutable,
    });

    // Phase 4: Pre-restore snapshot
    await this.updateProgress(onProgress, {
      restoreId,
      phase: 'creating_snapshot',
    });

    const snapshot = await this.createPreRestoreSnapshot(
      restoreId,
      backupId,
      reconciliation,
    );

    await this.updateProgress(onProgress, {
      restoreId,
      snapshotId: snapshot.id,
    });

    // Phase 5: Restore collections in tier order
    const totalCollections = reconciliation.collections.length + reconciliation.subcollections.length;
    let processedCollections = 0;
    let documentsRestored = 0;
    let documentsSkipped = 0;

    await this.updateProgress(onProgress, {
      restoreId,
      phase: 'restoring_collections',
      totalCollections,
    });

    const orderedCollections = orderByTier(effectiveManifest.collections, options?.collections);

    for (const entry of orderedCollections) {
      const documents = collectionDocs.get(entry.backupFile) ?? [];
      if (documents.length === 0) continue;

      const existingIds = reconciliation.existingDocsMap.get(entry.collectionName) ?? [];
      const existingSet = new Set(existingIds);
      const mergeMode = options?.mergeMode ?? true;

      const result = await this.restoreCollectionDocs(
        entry.collectionName,
        documents,
        existingSet,
        entry.isImmutable,
        mergeMode,
      );

      documentsRestored += result.restored;
      documentsSkipped += result.skipped;
      processedCollections++;

      await this.updateProgress(onProgress, {
        restoreId,
        currentCollection: entry.collectionKey,
        processedCollections,
        documentsRestored,
        documentsSkipped,
      });
    }

    // Phase 6: Restore subcollections
    await this.updateProgress(onProgress, {
      restoreId,
      phase: 'restoring_subcollections',
    });

    for (const entry of effectiveManifest.subcollections) {
      if (options?.collections?.length && !options.collections.includes(entry.subcollectionKey)) {
        continue;
      }

      const documents = collectionDocs.get(entry.backupFile) ?? [];
      if (documents.length === 0) continue;

      const parentColName = this.getParentCollectionName(entry, effectiveManifest);
      if (!parentColName) continue;

      const result = await this.restoreSubcollectionDocs(
        parentColName,
        entry.subcollectionName,
        documents,
      );

      documentsRestored += result.restored;
      documentsSkipped += result.skipped;
      processedCollections++;

      await this.updateProgress(onProgress, {
        restoreId,
        currentCollection: entry.subcollectionKey,
        processedCollections,
        documentsRestored,
        documentsSkipped,
      });
    }

    // Phase 7: Restore Storage files
    let storageRestored = 0;
    let storageSkipped = 0;

    if (effectiveManifest.storageFiles.length > 0) {
      await this.updateProgress(onProgress, { restoreId, phase: 'restoring_storage' });
      logger.info(`Restoring ${effectiveManifest.storageFiles.length} storage files...`);
      const storageService = new StorageRestoreService();
      const storageResult = await storageService.restoreAllFiles(
        chain.fullManifest.id,
        effectiveManifest.storageFiles,
        this.gcsService,
      );
      storageRestored = storageResult.restored;
      storageSkipped = storageResult.skipped;
    }

    // Complete
    const durationMs = Date.now() - startTime;

    await this.updateProgress(onProgress, {
      restoreId,
      phase: 'completed',
      processedCollections: totalCollections,
      documentsRestored,
      documentsSkipped,
      completedAt: nowISO(),
    });

    logger.info(
      `Restore ${restoreId} completed: ${documentsRestored} docs restored, ` +
      `${documentsSkipped} skipped, ${storageRestored} storage files in ${durationMs}ms`,
    );

    return {
      restoreId,
      documentsRestored,
      documentsSkipped,
      storageRestored,
      storageSkipped,
      snapshotId: snapshot.id,
      durationMs,
    };
  }

  private async restoreCollectionDocs(
    collectionName: string,
    documents: SerializedDocument[],
    existingIds: Set<string>,
    isImmutable: boolean,
    mergeMode: boolean,
  ): Promise<{ restored: number; skipped: number }> {
    let restored = 0;
    let skipped = 0;

    // Process in batches of BATCH_SIZE_WRITE
    for (let i = 0; i < documents.length; i += BATCH_SIZE_WRITE) {
      const batch: WriteBatch = this.db.batch();
      const chunk = documents.slice(i, i + BATCH_SIZE_WRITE);
      let batchOps = 0;

      for (const serializedDoc of chunk) {
        const { id, data } = deserializeDocument(serializedDoc);

        // Resolve DocumentReference paths back to actual references
        const resolvedData = resolveReferences(this.db, data, serializedDoc._fieldTypes);
        const docRef = this.db.collection(collectionName).doc(id);

        if (isImmutable && existingIds.has(id)) {
          skipped++;
          continue;
        }

        if (mergeMode) {
          batch.set(docRef, resolvedData, { merge: true });
        } else {
          batch.set(docRef, resolvedData);
        }
        batchOps++;
      }

      if (batchOps > 0) {
        await batch.commit();
        restored += batchOps;
      }
    }

    logger.info(`Restored ${collectionName}: ${restored} written, ${skipped} skipped`);
    return { restored, skipped };
  }

  private async restoreSubcollectionDocs(
    parentCollectionName: string,
    subcollectionName: string,
    documents: SerializedDocument[],
  ): Promise<{ restored: number; skipped: number }> {
    let restored = 0;
    const skipped = 0;

    // Group by parent doc ID
    const byParent = new Map<string, SerializedDocument[]>();
    for (const doc of documents) {
      const parts = doc._path.split('/');
      if (parts.length >= 4) {
        const parentId = parts[1];
        const existing = byParent.get(parentId) ?? [];
        existing.push(doc);
        byParent.set(parentId, existing);
      }
    }

    for (const [parentDocId, parentDocs] of byParent) {
      for (let i = 0; i < parentDocs.length; i += BATCH_SIZE_WRITE) {
        const batch: WriteBatch = this.db.batch();
        const chunk = parentDocs.slice(i, i + BATCH_SIZE_WRITE);
        let batchOps = 0;

        for (const serializedDoc of chunk) {
          const { id, data } = deserializeDocument(serializedDoc);
          const resolvedData = resolveReferences(this.db, data, serializedDoc._fieldTypes);

          const docRef = this.db
            .collection(parentCollectionName)
            .doc(parentDocId)
            .collection(subcollectionName)
            .doc(id);

          batch.set(docRef, resolvedData, { merge: true });
          batchOps++;
        }

        if (batchOps > 0) {
          await batch.commit();
          restored += batchOps;
        }
      }
    }

    logger.info(`Restored subcollection ${parentCollectionName}/*/${subcollectionName}: ${restored} written`);
    return { restored, skipped };
  }

  /**
   * Save a snapshot of existing doc IDs that will be overwritten.
   * Stored in GCS alongside the backup for future rollback capability.
   */
  private async createPreRestoreSnapshot(
    restoreId: string,
    backupId: string,
    reconciliation: ReconciliationResult,
  ): Promise<PreRestoreSnapshot> {
    const snapshotId = `snapshot_${restoreId}`;

    const collections: PreRestoreCollectionSnapshot[] = [];

    for (const [collectionName, docIds] of reconciliation.existingDocsMap) {
      collections.push({
        collectionName,
        existingDocIds: docIds,
        existingCount: docIds.length,
      });
    }

    const snapshot: PreRestoreSnapshot = {
      id: snapshotId,
      restoreId,
      backupId,
      createdAt: nowISO(),
      collections,
    };

    // Save to GCS via public API
    const gcsPath = `${backupId}/snapshots/${snapshotId}.json`;
    await this.gcsService.writeJsonFile(
      gcsPath,
      snapshot as unknown as Record<string, unknown>,
      { restoreId, backupId },
    );

    logger.info(`Pre-restore snapshot saved: ${gcsPath} — ${collections.length} collections, ${collections.reduce((s, c) => s + c.existingCount, 0)} existing docs`);

    return snapshot;
  }

  private getParentCollectionName(
    subEntry: SubcollectionManifestEntry,
    manifest: BackupManifest,
  ): string | null {
    const parent = manifest.collections.find(
      c => c.collectionKey === subEntry.parentCollectionKey,
    );
    return parent?.collectionName ?? null;
  }

  private async updateProgress(
    callback: RestoreStatusCallback | undefined,
    status: Partial<RestoreStatus>,
  ): Promise<void> {
    if (!callback) return;
    try {
      await callback(status);
    } catch (error) {
      logger.warn(`Failed to update restore progress: ${getErrorMessage(error)}`);
    }
  }
}
