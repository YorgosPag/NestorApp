/**
 * =============================================================================
 * STORAGE RESTORE SERVICE — ADR-313 (+ ADR-895 Α6)
 * =============================================================================
 *
 * Restores Firebase Storage files from backup GCS bucket.
 * Reverse of StorageBackupService: reads from backup, writes to source bucket.
 *
 * Google-level patterns:
 * - Stream-to-stream copy (O(chunk_size) memory)
 * - SHA-256 verification after restore
 * - Concurrency-limited parallel processing
 * - Skip existing files with matching SHA-256 (idempotent)
 *
 * 🌍 **ADR-895 backup layout — decided here, ONE rule for old and new manifests**: the `backupFile`
 * recorded in the manifest is the AUTHORITY for where bytes live inside the backup bucket. We never
 * reconstruct that path. Backups written after Φ0 store it as `storage/{placement}/{storagePath}`
 * (StorageBackupService); backups written before ADR-895 stored `storage/{storagePath}` with no
 * placement segment. Both are read identically here — `gcsService.createReadStream(\`${backupId}/${entry.backupFile}\`)`.
 * The only thing this file decides is a SEPARATE question — the RESTORE TARGET bucket — from
 * `entry.placement`: absent ⇒ `legacy-default` (`fileStoragePlacementOf`, ADR-895 Α1), unknown value
 * ⇒ this entry fails (caught per-entry by the batch loop), never guessed.
 *
 * @module services/backup/storage-restore.service
 * @see adrs/ADR-313-enterprise-backup-restore.md
 * @see adrs/ADR-895-file-data-residency.md §5 Α6
 */

import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { sha256PassThrough } from '@/lib/storage/sha256-pass-through';
import { pipeline } from 'stream/promises';

import { fileStoragePlacementOf } from '@/lib/files/file-storage-placement';
import { fileStorageBucket } from '@/server/files/file-record-bucket';

import type { BackupGcsService } from './backup-gcs.service';
import type { StorageManifestEntry } from './backup-manifest.types';

const logger = createModuleLogger('StorageRestoreService');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_CONCURRENCY = 10;
const PROGRESS_LOG_INTERVAL = 50;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StorageRestoreResult {
  /** Files successfully restored */
  restored: number;
  /** Files skipped (already exist with matching hash) */
  skipped: number;
  /** Files that failed to restore */
  failed: number;
  /** Total bytes restored */
  totalBytes: number;
  /** Warnings */
  warnings: string[];
}

// ---------------------------------------------------------------------------
// StorageRestoreService
// ---------------------------------------------------------------------------

export class StorageRestoreService {
  private concurrency: number;

  constructor(concurrency = DEFAULT_CONCURRENCY) {
    this.concurrency = concurrency;
  }

  /**
   * Restore all Storage files from a backup.
   *
   * For each StorageManifestEntry:
   * 1. Check if file exists in target bucket with matching SHA-256
   * 2. If match → skip (idempotent)
   * 3. If missing/different → stream from backup → target with SHA-256 verify
   */
  async restoreAllFiles(
    backupId: string,
    storageEntries: StorageManifestEntry[],
    gcsService: BackupGcsService,
    onProgress?: (restored: number, total: number) => Promise<void>,
  ): Promise<StorageRestoreResult> {
    const warnings: string[] = [];
    let restored = 0;
    let skipped = 0;
    let failed = 0;
    let totalBytes = 0;
    let processed = 0;

    if (storageEntries.length === 0) {
      logger.info('No storage files to restore');
      return { restored: 0, skipped: 0, failed: 0, totalBytes: 0, warnings };
    }

    logger.info(`Restoring ${storageEntries.length} storage files from backup ${backupId}`);

    for (let i = 0; i < storageEntries.length; i += this.concurrency) {
      const batch = storageEntries.slice(i, i + this.concurrency);

      const batchResults = await Promise.all(
        batch.map(async (entry) => {
          try {
            return await this.restoreFile(backupId, entry, gcsService);
          } catch (error) {
            const msg = `Failed to restore ${entry.storagePath}: ${getErrorMessage(error)}`;
            logger.warn(msg);
            warnings.push(msg);
            return { status: 'failed' as const, bytes: 0 };
          }
        }),
      );

      for (const result of batchResults) {
        switch (result.status) {
          case 'restored':
            restored++;
            totalBytes += result.bytes;
            break;
          case 'skipped':
            skipped++;
            break;
          case 'failed':
            failed++;
            break;
        }
      }

      processed += batch.length;

      if (processed % PROGRESS_LOG_INTERVAL === 0 || processed === storageEntries.length) {
        logger.info(`Storage restore progress: ${processed}/${storageEntries.length}`);
      }

      if (onProgress) {
        await onProgress(processed, storageEntries.length);
      }
    }

    logger.info(
      `Storage restore completed: ${restored} restored, ${skipped} skipped, ` +
      `${failed} failed, ${(totalBytes / 1024 / 1024).toFixed(2)} MB`,
    );

    return { restored, skipped, failed, totalBytes, warnings };
  }

  /**
   * Restore a single file from backup to Firebase Storage.
   * Skips if target file exists with matching SHA-256.
   */
  private async restoreFile(
    backupId: string,
    entry: StorageManifestEntry,
    gcsService: BackupGcsService,
  ): Promise<{ status: 'restored' | 'skipped' | 'failed'; bytes: number }> {
    // 🌍 ADR-895 Α1/Α3: ΠΟΙΟΣ κάδος γράφεται — απόν ⇒ legacy, άγνωστο ⇒ πέτα (ο καλών το πιάνει ως 'failed').
    const placement = fileStoragePlacementOf({ storagePlacement: entry.placement });
    const targetBucket = fileStorageBucket(placement);
    const targetFile = targetBucket.file(entry.storagePath);

    // Check if file exists with matching hash
    const [exists] = await targetFile.exists();
    if (exists) {
      const [metadata] = await targetFile.getMetadata();
      const customMeta = (metadata.metadata ?? {}) as Record<string, unknown>;
      const existingHash = customMeta.sha256 as string | undefined;

      if (existingHash === entry.sha256) {
        return { status: 'skipped', bytes: 0 };
      }
    }

    // Stream from backup GCS → target bucket with SHA-256 verification
    const hash = sha256PassThrough();

    const backupGcsPath = `${backupId}/${entry.backupFile}`;
    const readStream = gcsService.createReadStream(backupGcsPath);
    const writeStream = targetFile.createWriteStream({
      contentType: entry.contentType,
      resumable: false,
      metadata: {
        metadata: { sha256: entry.sha256 },
      },
    });

    await pipeline(readStream, hash.stream, writeStream);

    // Verify SHA-256
    const computedHash = hash.digestHex();
    if (computedHash !== entry.sha256) {
      logger.error(
        `SHA-256 mismatch for ${entry.storagePath}: ` +
        `expected ${entry.sha256}, got ${computedHash}`,
      );
      // Delete corrupted file
      await targetFile.delete({ ignoreNotFound: true });
      return { status: 'failed', bytes: 0 };
    }

    return { status: 'restored', bytes: hash.bytes() };
  }
}
