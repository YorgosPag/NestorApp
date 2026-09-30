/**
 * =============================================================================
 * STORAGE BACKUP SERVICE — ADR-313 Phase 3 (+ ADR-895 Α6)
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
 * 🌍 **ADR-895 Α6**: το backup δεν έχει πια «τον κάδο» — έχει έναν **κατάλογο**
 * (`originalStorageBuckets()`). Κάθε προβλεπόμενος κάδος σαρώνεται ξεχωριστά· ο μη-προβλεπόμενος
 * κάδος ΕΕ (Φ0: δεν υπάρχει ακόμη) παραλείπεται με σημείωση, ΔΕΝ σκάει το backup (§2.3 Ρ4).
 * Κάθε αντικείμενο γράφεται στο backup κάτω από `storage/{placement}/{storagePath}` — η θέση
 * στο όνομα αποκλείει σύγκρουση αν το ίδιο `storagePath` υπάρξει ΠΟΤΕ σε δύο κάδους. Το restore
 * δεν ξαναχτίζει αυτή τη διαδρομή — διαβάζει το `backupFile` που έγραψε αυτό το πέρασμα.
 *
 * SSoT:
 * - originalStorageBuckets() / getAdminFirestore() (server/files, lib/firebaseAdmin)
 * - COLLECTIONS.FILES from firestore-collections.ts
 * - StatusCallback from backup-manifest.types.ts (shared with BackupService)
 *
 * @module services/backup/storage-backup.service
 * @see adrs/ADR-313-enterprise-backup-restore.md §6 Phase 3
 * @see adrs/ADR-895-file-data-residency.md §5 Α6
 */

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { sha256PassThrough } from '@/lib/storage/sha256-pass-through';
import { pipeline } from 'stream/promises';

import { fileStoragePlacementOf, type FileStoragePlacement } from '@/lib/files/file-storage-placement';
import { originalStorageBuckets } from '@/server/files/file-record-bucket';

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

type BucketCatalogue = () => ReadonlyArray<{ readonly placement: FileStoragePlacement; readonly bucket: Bucket }>;

interface ProvisionedBucket {
  readonly placement: FileStoragePlacement;
  readonly bucket: Bucket;
}

type StoragePathIndex = ReadonlyMap<string, { readonly docId: string; readonly placement: FileStoragePlacement }>;

/** Ό,τι μαζεύει ένα πέρασμα εξαγωγής — συσσωρεύεται ανά κάδο (mutated in place). */
interface ExportTally {
  entries: StorageManifestEntry[];
  totalBytes: number;
  processed: number;
  skippedOversize: number;
  failedCount: number;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// StorageBackupService
// ---------------------------------------------------------------------------

export class StorageBackupService {
  private db: Firestore;
  private concurrency: number;
  private readonly catalogue: BucketCatalogue;

  constructor(concurrency = DEFAULT_CONCURRENCY, catalogue: BucketCatalogue = originalStorageBuckets) {
    this.db = getAdminFirestore();
    this.concurrency = concurrency;
    this.catalogue = catalogue;
  }

  /**
   * Build index: storagePath → {docId, placement} from FILES collection.
   * 🌍 ADR-895 Α6: ένα storage object ταιριάζει σε FileRecord μόνο όταν ΚΑΙ το storagePath ΚΑΙ η
   * θέση συμφωνούν — αλλιώς η υιοθεσία θα «έβρισκε» εγγραφή για bytes που δεν είναι δικά της.
   */
  private async buildStoragePathIndex(): Promise<StoragePathIndex> {
    const index = new Map<string, { readonly docId: string; readonly placement: FileStoragePlacement }>();
    const snapshot = await this.db.collection(COLLECTIONS.FILES).select('storagePath', 'storagePlacement').get();

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const storagePath = data.storagePath as string | undefined;
      if (!storagePath) continue;
      try {
        index.set(storagePath, { docId: doc.id, placement: fileStoragePlacementOf(data) });
      } catch (error) {
        logger.warn('Cross-reference skipped — unknown storagePlacement', { docId: doc.id, error: getErrorMessage(error) });
      }
    }

    logger.info(`Built storage path index: ${index.size} file records`);
    return index;
  }

  private async bucketExists(bucket: Bucket): Promise<boolean> {
    try {
      const [exists] = await bucket.exists();
      return exists;
    } catch (error) {
      logger.warn('Bucket existence check failed — treating as not provisioned', { error: getErrorMessage(error) });
      return false;
    }
  }

  /** Ο κατάλογος κάδων ΠΟΥ ΥΠΑΡΧΟΥΝ — ο μη-προβλεπόμενος κάδος ΕΕ παραλείπεται, ΔΕΝ σκάει (ADR-895 §2.3 Ρ4). */
  private async provisionedBuckets(warnings: string[]): Promise<ProvisionedBucket[]> {
    const candidates = this.catalogue();
    const checked = await Promise.all(candidates.map(async (c) => ({ candidate: c, exists: await this.bucketExists(c.bucket) })));
    const provisioned: ProvisionedBucket[] = [];
    for (const { candidate, exists } of checked) {
      if (exists) { provisioned.push(candidate); continue; }
      const msg = `Bucket for placement '${candidate.placement}' not provisioned yet — skipped (not a failure)`;
      logger.info(msg);
      warnings.push(msg);
    }
    return provisioned;
  }

  /**
   * Stream a single file: source → SHA-256 transform → backup destination.
   * Memory usage: O(chunk_size), not O(file_size).
   */
  private async processFile(
    file: GcsFile,
    backupId: string,
    placement: FileStoragePlacement,
    gcsService: BackupGcsService,
    storagePathIndex: StoragePathIndex,
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

    // 🌍 ADR-895 Α6: η θέση μπαίνει στο ΟΝΟΜΑ — αποκλείει σύγκρουση αν το storagePath υπάρξει σε δύο κάδους.
    const backupFilePath = `storage/${placement}/${storagePath}`;

    // Stream: source → SHA-256 transform → destination
    const hash = sha256PassThrough();
    const readStream = file.createReadStream();
    const writeStream = gcsService.createWriteStream(backupId, backupFilePath, contentType);
    await pipeline(readStream, hash.stream, writeStream);

    const indexed = storagePathIndex.get(storagePath);
    // 🌍 Α6: «γνωστό» μόνο όταν ΚΑΙ το storagePath ΚΑΙ η θέση ταιριάζουν με μια εγγραφή.
    const firestoreDocId = indexed && indexed.placement === placement ? indexed.docId : undefined;

    return { storagePath, firestoreDocId, sizeBytes, contentType, sha256: hash.digestHex(), backupFile: backupFilePath, placement };
  }

  /** Ένα αρχείο, χωρίς να ρίξει την παρτίδα — καταγράφει skip/failure στο tally. */
  private async exportOne(
    file: GcsFile,
    backupId: string,
    placement: FileStoragePlacement,
    gcsService: BackupGcsService,
    storagePathIndex: StoragePathIndex,
    tally: ExportTally,
  ): Promise<StorageManifestEntry | null> {
    try {
      const result = await this.processFile(file, backupId, placement, gcsService, storagePathIndex);
      if (!result) tally.skippedOversize++;
      return result;
    } catch (error) {
      const msg = `Failed to export ${file.name} (${placement}): ${getErrorMessage(error)}`;
      logger.warn(msg);
      tally.warnings.push(msg);
      tally.failedCount++;
      return null;
    }
  }

  /** Ένας κάδος: λίστα αρχείων + εξαγωγή σε παρτίδες (concurrency-limited). Συσσωρεύει στο tally. */
  private async exportBucket(
    target: ProvisionedBucket,
    backupId: string,
    gcsService: BackupGcsService,
    storagePathIndex: StoragePathIndex,
    onProgress: StatusCallback | undefined,
    tally: ExportTally,
  ): Promise<void> {
    const { placement, bucket } = target;
    const [files] = await bucket.getFiles();
    logger.info(`Found ${files.length} files in '${placement}' bucket`);

    for (let i = 0; i < files.length; i += this.concurrency) {
      const batch = files.slice(i, i + this.concurrency);
      const results = await Promise.all(batch.map((file) => this.exportOne(file, backupId, placement, gcsService, storagePathIndex, tally)));
      for (const result of results) {
        if (result) { tally.entries.push(result); tally.totalBytes += result.sizeBytes; }
      }
      tally.processed += batch.length;
      if (tally.processed % PROGRESS_LOG_INTERVAL === 0) logger.info(`Storage export progress: ${tally.processed} files`);
      if (onProgress) await onProgress({ phase: 'exporting_storage', storageFilesExported: tally.processed });
    }
  }

  /** Orphan + skip/failure summary lines — appended to tally.warnings. */
  private finalizeWarnings(tally: ExportTally): void {
    const orphanCount = tally.entries.filter((e) => !e.firestoreDocId).length;
    if (orphanCount > 0) tally.warnings.push(`${orphanCount} storage files have no matching FileRecord in Firestore`);
    if (tally.skippedOversize > 0) tally.warnings.push(`${tally.skippedOversize} files skipped (exceeded ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB limit)`);
    if (tally.failedCount > 0) tally.warnings.push(`${tally.failedCount} files failed to export`);
  }

  /**
   * Export all files from every provisioned original-file bucket to the backup GCS bucket.
   *
   * Steps:
   * 1. Build storagePath → {docId, placement} index from FILES collection
   * 2. Determine which catalogue buckets are provisioned (ADR-895 §2.3 Ρ4)
   * 3. Per bucket: list files, stream in concurrency-limited batches, SHA-256 per file
   * 4. Return StorageManifestEntry[] for the manifest, each entry carrying its `placement`
   */
  async exportAllFiles(
    backupId: string,
    gcsService: BackupGcsService,
    onProgress?: StatusCallback,
  ): Promise<StorageExportResult> {
    logger.info('Starting Storage export...');
    const storagePathIndex = await this.buildStoragePathIndex();

    const tally: ExportTally = { entries: [], totalBytes: 0, processed: 0, skippedOversize: 0, failedCount: 0, warnings: [] };
    const buckets = await this.provisionedBuckets(tally.warnings);
    if (buckets.length === 0) {
      logger.info('No provisioned original-file buckets — skipping Storage export');
      return { entries: [], totalBytes: 0, warnings: tally.warnings };
    }

    if (onProgress) await onProgress({ phase: 'exporting_storage', storageFilesExported: 0 });
    for (const target of buckets) {
      await this.exportBucket(target, backupId, gcsService, storagePathIndex, onProgress, tally);
    }

    this.finalizeWarnings(tally);
    logger.info(
      `Storage export completed: ${tally.entries.length} exported, ${(tally.totalBytes / 1024 / 1024).toFixed(2)} MB, ` +
      `${tally.skippedOversize} oversize skipped, ${tally.failedCount} failed`,
    );
    return { entries: tally.entries, totalBytes: tally.totalBytes, warnings: tally.warnings };
  }
}
