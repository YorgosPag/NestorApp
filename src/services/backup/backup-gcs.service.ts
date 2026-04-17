/**
 * =============================================================================
 * BACKUP GCS STORAGE SERVICE — ADR-313
 * =============================================================================
 *
 * Handles writing and reading backup data to/from Google Cloud Storage.
 * Backup files are stored as GZIP-compressed NDJSON (one JSON line per document).
 *
 * Bucket structure:
 *   gs://{projectId}-backups/{backupId}/
 *     ├── manifest.json
 *     ├── collections/{name}.ndjson.gz
 *     └── subcollections/{parent}__{name}.ndjson.gz
 *
 * @module services/backup/backup-gcs.service
 * @see adrs/ADR-313-enterprise-backup-restore.md §8
 */

import { getAdminStorage } from '@/lib/firebaseAdmin';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { createHash } from 'crypto';
import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';

import type { Bucket } from '@google-cloud/storage';
import type { BackupManifest, SerializedDocument } from './backup-manifest.types';

const logger = createModuleLogger('BackupGcsService');

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_BUCKET_SUFFIX = '-backups';

// ---------------------------------------------------------------------------
// BackupGcsService
// ---------------------------------------------------------------------------

export class BackupGcsService {
  private bucket: Bucket;
  private bucketName: string;

  constructor(bucketName?: string) {
    const projectId = process.env.FIREBASE_PROJECT_ID ?? 'pagonis-87766';
    this.bucketName = bucketName ?? `${projectId}${DEFAULT_BUCKET_SUFFIX}`;
    this.bucket = getAdminStorage().bucket(this.bucketName);
  }

  /**
   * Serialize documents to NDJSON, GZIP compress, and compute SHA-256.
   */
  private async compressDocuments(
    documents: SerializedDocument[],
  ): Promise<{ compressed: Buffer; checksum: string }> {
    const ndjson = documents
      .map(doc => JSON.stringify(doc))
      .join('\n');

    const compressed = await gzipAsync(Buffer.from(ndjson, 'utf-8'));
    const checksum = createHash('sha256').update(compressed).digest('hex');

    return { compressed: Buffer.from(compressed), checksum };
  }

  /**
   * Write a single backup file to GCS.
   */
  async writeBackupFile(
    backupId: string,
    relativePath: string,
    documents: SerializedDocument[],
  ): Promise<string> {
    const gcsPath = `${backupId}/${relativePath}`;
    const { compressed, checksum } = await this.compressDocuments(documents);

    const file = this.bucket.file(gcsPath);
    await file.save(compressed, {
      contentType: 'application/gzip',
      metadata: {
        documentCount: String(documents.length),
        checksum,
      },
    });

    logger.info(`Written ${gcsPath}: ${documents.length} docs, ${compressed.length} bytes compressed`);

    return checksum;
  }

  /**
   * Write the manifest JSON to GCS.
   */
  async writeManifest(manifest: BackupManifest): Promise<void> {
    const gcsPath = `${manifest.id}/manifest.json`;
    const content = JSON.stringify(manifest, null, 2);

    const file = this.bucket.file(gcsPath);
    await file.save(content, {
      contentType: 'application/json',
      metadata: {
        backupId: manifest.id,
        type: manifest.type,
        totalDocuments: String(manifest.totalDocuments),
      },
    });

    logger.info(`Written manifest: ${gcsPath}`);
  }

  /**
   * Read and decompress a backup file from GCS.
   */
  async readBackupFile(
    backupId: string,
    relativePath: string,
  ): Promise<SerializedDocument[]> {
    const gcsPath = `${backupId}/${relativePath}`;

    try {
      const file = this.bucket.file(gcsPath);
      const [compressed] = await file.download();
      const decompressed = await gunzipAsync(compressed);
      const ndjson = decompressed.toString('utf-8');

      return ndjson
        .split('\n')
        .filter(line => line.trim().length > 0)
        .map(line => JSON.parse(line) as SerializedDocument);
    } catch (error) {
      throw new Error(`Failed to read backup file ${gcsPath}: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Read the manifest from GCS.
   */
  async readManifest(backupId: string): Promise<BackupManifest> {
    const gcsPath = `${backupId}/manifest.json`;

    try {
      const file = this.bucket.file(gcsPath);
      const [content] = await file.download();
      return JSON.parse(content.toString('utf-8')) as BackupManifest;
    } catch (error) {
      throw new Error(`Failed to read manifest ${gcsPath}: ${getErrorMessage(error)}`);
    }
  }

  /**
   * List all backup IDs in the bucket (sorted by date descending).
   */
  async listBackups(): Promise<string[]> {
    const [files] = await this.bucket.getFiles({ prefix: '', delimiter: '/' });

    // Extract unique backup IDs from file prefixes
    const backupIds = new Set<string>();
    for (const file of files) {
      const parts = file.name.split('/');
      if (parts.length > 1 && parts[0]) {
        backupIds.add(parts[0]);
      }
    }

    return Array.from(backupIds).sort().reverse();
  }

  /**
   * Delete a backup and all its files from GCS.
   */
  async deleteBackup(backupId: string): Promise<number> {
    const [files] = await this.bucket.getFiles({ prefix: `${backupId}/` });

    let deleted = 0;
    for (const file of files) {
      await file.delete();
      deleted++;
    }

    logger.info(`Deleted backup ${backupId}: ${deleted} files`);
    return deleted;
  }

  /**
   * Write all backup data — collections, subcollections, and manifest.
   * Updates checksums in the manifest entries.
   */
  async writeFullBackup(
    manifest: BackupManifest,
    files: Map<string, SerializedDocument[]>,
  ): Promise<BackupManifest> {
    // Write collection files + update checksums
    for (const entry of manifest.collections) {
      const documents = files.get(entry.backupFile);
      if (documents && documents.length > 0) {
        entry.checksum = await this.writeBackupFile(
          manifest.id,
          entry.backupFile,
          documents,
        );
      }
    }

    // Write subcollection files + update checksums
    for (const entry of manifest.subcollections) {
      const documents = files.get(entry.backupFile);
      if (documents && documents.length > 0) {
        entry.checksum = await this.writeBackupFile(
          manifest.id,
          entry.backupFile,
          documents,
        );
      }
    }

    // Compute manifest checksum
    const manifestForChecksum = { ...manifest, checksum: '' };
    manifest.checksum = createHash('sha256')
      .update(JSON.stringify(manifestForChecksum))
      .digest('hex');

    // Write manifest
    await this.writeManifest(manifest);

    return manifest;
  }

  /**
   * Get the bucket name (for status/config reporting).
   */
  getBucketName(): string {
    return this.bucketName;
  }
}
