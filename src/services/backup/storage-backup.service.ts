/**
 * =============================================================================
 * STORAGE BACKUP SERVICE — ADR-313 Phase 3
 * =============================================================================
 *
 * Exports Firebase Storage files to the backup GCS bucket using streaming.
 *
 * Google-level patterns:
 * - Stream-to-stream copy: source → SHA-256 transform → destination
 *   Memory: O(chunk_size) not O(file_size) — safe for any file size
 * - Concurrency-limited parallel processing (default 10)
 * - Cross-reference with FILES collection for manifest enrichment
 * - Size guard: skip files > MAX_FILE_SIZE_BYTES with warning
 *
 * SSoT:
 * - getAdminStorage() / getAdminFirestore() from firebaseAdmin
 * - COLLECTIONS.FILES from firestore-collections.ts
 * - StatusCallback from backup-manifest.types.ts (shared with BackupService)
 *
 * @module services/backup/storage-backup.service
 * @see adrs/ADR-313-enterprise-backup-restore.md §6 Phase 3
 */

import { getAdminStorage, getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { createHash } from 'crypto';
import { Transform } from 'stream';
import { pipeline } from 'stream/promises';

import type { Bucket, File as GcsFile } from '@google-cloud/storage';
import type { Firestore } from 'firebase-admin/firestore';
import type { StorageManifestEntry, StatusCallback } from './backup-manifest.types';
import type { BackupGcsService } from './backup-gcs.service';

const logger = createModuleLogger('StorageBackupService');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_CONCURRENCY = 10;
const PROGRESS_LOG_INTERVAL = 50;

/** Files larger than 500 MB are skipped with a warning */
const MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024;

/** Files larger than 50 MB log a warning (but still export) */
const LARGE_FILE_WARN_BYTES = 50 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StorageExportResult {
  entries: StorageManifestEntry[];
  totalBytes: number;
  warnings: string[];
}

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
   * Build index: storagePath → Firestore doc ID from FILES collection.
   * Projection query — fetches only storagePath field per doc.
   */
  private async buildStoragePathIndex(): Promise<Map<string, string>> {
    const index = new Map<string, string>();
    const snapshot = await this.db
      .collection(COLLECTIONS.FILES)
      .select('storagePath')
      .get();

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
   * Stream a single file: source → SHA-256 transform → backup destination.
   * Memory usage: O(chunk_size), not O(file_size).
   */
  private async processFile(
    file: GcsFile,
    backupId: string,
    gcsService: BackupGcsService,
    storagePathIndex: Map<string, string>,
  ): Promise<StorageManifestEntry | null> {
    const storagePath = file.name;
    const [metadata] = await file.getMetadata();
    const sizeBytes = Number(metadata.size ?? 0);
    const contentType = (metadata.contentType as string) ?? 'application/octet-stream';

    // Size guard — skip files that would timeout or crash
    if (sizeBytes > MAX_FILE_SIZE_BYTES) {
      logger.warn(`Skipping oversized file: ${storagePath} (${(sizeBytes / 1024 / 1024).toFixed(0)} MB)`);
      return null;
    }

    if (sizeBytes > LARGE_FILE_WARN_BYTES) {
      logger.warn(`Large file: ${storagePath} (${(sizeBytes / 1024 / 1024).toFixed(0)} MB)`);
    }

    const backupFilePath = `storage/${storagePath}`;

    // Stream: source → SHA-256 transform → destination
    const hash = createHash('sha256');
    const hashTransform = new Transform({
      transform(chunk, _encoding, callback) {
        hash.update(chunk);
        callback(null, chunk);
      },
    });

    const readStream = file.createReadStream();
    const writeStream = gcsService.createWriteStream(backupId, backupFilePath, contentType);

    await pipeline(readStream, hashTransform, writeStream);

    const sha256 = hash.digest('hex');
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
   * 3. Stream files in parallel batches (concurrency limited)
   * 4. Compute SHA-256 per file via streaming transform
   * 5. Return StorageManifestEntry[] for the manifest
   */
  async exportAllFiles(
    backupId: string,
    gcsService: BackupGcsService,
    onProgress?: StatusCallback,
  ): Promise<StorageExportResult> {
    const warnings: string[] = [];

    logger.info('Starting Storage export...');

    // Step 1: Build cross-reference index
    const storagePathIndex = await this.buildStoragePathIndex();

    // Step 2: List all files
    const [allFiles] = await this.sourceBucket.getFiles();
    logger.info(`Found ${allFiles.length} files in Storage bucket`);

    if (allFiles.length === 0) {
      logger.info('No files in Storage bucket — skipping');
      return { entries: [], totalBytes: 0, warnings };
    }

    if (onProgress) {
      await onProgress({ phase: 'exporting_storage', storageFilesExported: 0 });
    }

    // Step 3-4: Stream files in concurrency-limited batches
    const entries: StorageManifestEntry[] = [];
    let totalBytes = 0;
    let processed = 0;
    let skippedOversize = 0;
    let failedCount = 0;

    for (let i = 0; i < allFiles.length; i += this.concurrency) {
      const batch = allFiles.slice(i, i + this.concurrency);

      const batchResults = await Promise.all(
        batch.map(async (file) => {
          try {
            const result = await this.processFile(file, backupId, gcsService, storagePathIndex);
            if (!result) skippedOversize++;
            return result;
          } catch (error) {
            const msg = `Failed to export ${file.name}: ${getErrorMessage(error)}`;
            logger.warn(msg);
            warnings.push(msg);
            failedCount++;
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
        await onProgress({ phase: 'exporting_storage', storageFilesExported: processed });
      }
    }

    // Orphan detection
    const orphanCount = entries.filter(e => !e.firestoreDocId).length;
    if (orphanCount > 0) {
      const msg = `${orphanCount} storage files have no matching FileRecord in Firestore`;
      logger.warn(msg);
      warnings.push(msg);
    }

    if (skippedOversize > 0) {
      warnings.push(`${skippedOversize} files skipped (exceeded ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB limit)`);
    }

    if (failedCount > 0) {
      warnings.push(`${failedCount} files failed to export`);
    }

    logger.info(
      `Storage export completed: ${entries.length} exported, ` +
      `${(totalBytes / 1024 / 1024).toFixed(2)} MB, ` +
      `${orphanCount} orphans, ${skippedOversize} oversize skipped, ${failedCount} failed`,
    );

    return { entries, totalBytes, warnings };
  }
}
