/**
 * =============================================================================
 * STORAGE BACKUP SERVICE — ADR-313 Phase 3
 * =============================================================================
 *
 * Exports Firebase Storage files to the backup GCS bucket.
 * Lists all files recursively, downloads with concurrency limit,
 * computes SHA-256, and cross-references with the FILES collection.
 *
 * Architecture:
 * - getAdminStorage() for Firebase Storage access
 * - COLLECTIONS.FILES for cross-referencing storagePath → FileRecord
 * - Parallel download with configurable concurrency (default 10)
 * - SHA-256 integrity hash per file
 *
 * @module services/backup/storage-backup.service
 * @see adrs/ADR-313-enterprise-backup-restore.md §6 Phase 3
 */

import { getAdminStorage, getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { createHash } from 'crypto';

import type { Bucket, File as GcsFile } from '@google-cloud/storage';
import type { Firestore } from 'firebase-admin/firestore';
import type { StorageManifestEntry, BackupStatus } from './backup-manifest.types';
import type { BackupGcsService } from './backup-gcs.service';

const logger = createModuleLogger('StorageBackupService');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_CONCURRENCY = 10;
const PROGRESS_LOG_INTERVAL = 50;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StorageExportResult {
  entries: StorageManifestEntry[];
  totalBytes: number;
  warnings: string[];
}

export type StorageProgressCallback = (
  status: Partial<BackupStatus>,
) => Promise<void>;

// ---------------------------------------------------------------------------
// File record index (storagePath → docId)
// ---------------------------------------------------------------------------

type StoragePathIndex = Map<string, string>;

// ---------------------------------------------------------------------------
// StorageBackupService
// ---------------------------------------------------------------------------

export class StorageBackupService {
  private sourceBucket: Bucket;
  private db: Firestore;
  private concurrency: number;

  constructor(concurrency = DEFAULT_CONCURRENCY) {
    this.sourceBucket = getAdminStorage().bucket();
    this.db = getAdminFirestore();
    this.concurrency = concurrency;
  }

  /**
   * Build an index of storagePath → Firestore doc ID from the FILES collection.
   * Used to cross-reference Storage files with their FileRecord documents.
   */
  private async buildStoragePathIndex(): Promise<StoragePathIndex> {
    const index: StoragePathIndex = new Map();
    const filesRef = this.db.collection(COLLECTIONS.FILES);
    const snapshot = await filesRef.select('storagePath').get();

    for (const doc of snapshot.docs) {
      const storagePath = doc.data().storagePath as string | undefined;
      if (storagePath) {
        index.set(storagePath, doc.id);
      }
    }

    logger.info(`Built storage path index: ${index.size} file records`);
    return index;
  }

  /**
   * List all files in the Firebase Storage bucket recursively.
   */
  private async listAllFiles(): Promise<GcsFile[]> {
    const [files] = await this.sourceBucket.getFiles();
    logger.info(`Found ${files.length} files in Storage bucket`);
    return files;
  }

  /**
   * Process a single file: download, compute SHA-256, write to backup bucket.
   */
  private async processFile(
    file: GcsFile,
    backupId: string,
    gcsService: BackupGcsService,
    storagePathIndex: StoragePathIndex,
  ): Promise<StorageManifestEntry> {
    const storagePath = file.name;
    const [metadata] = await file.getMetadata();

    const sizeBytes = Number(metadata.size ?? 0);
    const contentType = metadata.contentType ?? 'application/octet-stream';

    // Download file content
    const [content] = await file.download();

    // Compute SHA-256
    const sha256 = createHash('sha256').update(content).digest('hex');

    // Write to backup bucket
    const backupFilePath = `storage/${storagePath}`;
    await gcsService.writeRawFile(backupId, backupFilePath, content, contentType);

    // Cross-reference with FILES collection
    const firestoreDocId = storagePathIndex.get(storagePath);

    return {
      storagePath,
      firestoreDocId,
      sizeBytes,
      contentType,
      sha256,
      backupFile: backupFilePath,
    };
  }

  /**
   * Export all files from Firebase Storage to the backup GCS bucket.
   *
   * Steps:
   * 1. Build storagePath → docId index from FILES collection
   * 2. List all files in Storage bucket
   * 3. Download files in parallel (concurrency limited)
   * 4. Compute SHA-256 per file
   * 5. Write to backup bucket under {backupId}/storage/...
   * 6. Return StorageManifestEntry[] for the manifest
   */
  async exportAllFiles(
    backupId: string,
    gcsService: BackupGcsService,
    onProgress?: StorageProgressCallback,
  ): Promise<StorageExportResult> {
    const warnings: string[] = [];

    logger.info('Starting Storage export...');

    // Step 1: Build cross-reference index
    const storagePathIndex = await this.buildStoragePathIndex();

    // Step 2: List all files
    const allFiles = await this.listAllFiles();

    if (allFiles.length === 0) {
      logger.info('No files in Storage bucket — skipping');
      return { entries: [], totalBytes: 0, warnings };
    }

    if (onProgress) {
      await onProgress({
        phase: 'exporting_storage',
        storageFilesExported: 0,
      });
    }

    // Step 3-5: Process files with concurrency limit
    const entries: StorageManifestEntry[] = [];
    let totalBytes = 0;
    let processed = 0;

    // Process in batches for concurrency control + progress reporting
    const batchSize = this.concurrency;
    for (let i = 0; i < allFiles.length; i += batchSize) {
      const batch = allFiles.slice(i, i + batchSize);

      const batchResults = await Promise.all(
        batch.map(async (file) => {
          try {
            return await this.processFile(
              file,
              backupId,
              gcsService,
              storagePathIndex,
            );
          } catch (error) {
            const msg = `Failed to export storage file ${file.name}: ${getErrorMessage(error)}`;
            logger.warn(msg);
            warnings.push(msg);
            return null;
          }
        }),
      );

      for (const result of batchResults) {
        if (result) {
          entries.push(result);
          totalBytes += result.sizeBytes;
        }
      }

      processed += batch.length;

      if (processed % PROGRESS_LOG_INTERVAL === 0 || processed === allFiles.length) {
        logger.info(`Storage export progress: ${processed}/${allFiles.length} files`);
      }

      if (onProgress) {
        await onProgress({
          phase: 'exporting_storage',
          storageFilesExported: processed,
        });
      }
    }

    // Log orphan stats
    const orphanCount = entries.filter(e => !e.firestoreDocId).length;
    if (orphanCount > 0) {
      const msg = `${orphanCount} storage files have no matching FileRecord in Firestore`;
      logger.warn(msg);
      warnings.push(msg);
    }

    logger.info(
      `Storage export completed: ${entries.length} files, ` +
      `${(totalBytes / 1024 / 1024).toFixed(2)} MB, ` +
      `${orphanCount} orphans`,
    );

    return { entries, totalBytes, warnings };
  }
}
