/**
 * =============================================================================
 * RESTORE CHAIN SERVICE — ADR-313 Phase 5 (Incremental Restore)
 * =============================================================================
 *
 * Resolves incremental backup chains for restore operations.
 *
 * When restoring from an incremental backup, the full state must be
 * reconstructed by applying the chain: full backup → incremental 1 → ... → target.
 *
 * Strategy:
 * 1. Walk parentBackupId until a 'full' backup is found
 * 2. Read all backup files in chain order (oldest first)
 * 3. Merge documents: latest version wins (by backupId order)
 * 4. Apply deletedDocumentIds as tombstones (remove from merged set)
 * 5. Return unified manifest + merged documents map
 *
 * @module services/backup/restore-chain.service
 * @see adrs/ADR-313-enterprise-backup-restore.md §6 Phase 5
 */

import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

import type { BackupGcsService } from './backup-gcs.service';
import type {
  BackupManifest,
  CollectionManifestEntry,
  SerializedDocument,
} from './backup-manifest.types';

const logger = createModuleLogger('RestoreChainService');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Max chain depth to prevent infinite loops from corrupted manifests */
const MAX_CHAIN_DEPTH = 50;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ResolvedChain {
  /** All manifests in order: full (first) → incrementals → target (last) */
  manifests: BackupManifest[];

  /** Merged document map: backupFile → documents (latest version wins) */
  mergedFiles: Map<string, SerializedDocument[]>;

  /** Unified collection entries (union of all collections in chain) */
  mergedCollections: CollectionManifestEntry[];

  /** The target manifest (last in chain) */
  targetManifest: BackupManifest;

  /** The full backup manifest (first in chain) */
  fullManifest: BackupManifest;

  /** Warnings accumulated during chain resolution */
  warnings: string[];
}

// ---------------------------------------------------------------------------
// RestoreChainService
// ---------------------------------------------------------------------------

export class RestoreChainService {
  private gcsService: BackupGcsService;

  constructor(gcsService: BackupGcsService) {
    this.gcsService = gcsService;
  }

  /**
   * Resolve the backup chain for a given backupId.
   *
   * If the backup is 'full', returns it directly.
   * If 'incremental', walks the chain to the full backup, reads all
   * files, and merges documents (latest wins, tombstones applied).
   */
  async resolveChain(backupId: string): Promise<ResolvedChain> {
    const warnings: string[] = [];

    // Step 1: Walk the chain to collect all manifests
    const manifests = await this.walkChain(backupId);
    const fullManifest = manifests[0];
    const targetManifest = manifests[manifests.length - 1];

    logger.info(
      `Chain resolved: ${manifests.length} backup(s) — ` +
      `full: ${fullManifest.id} → target: ${targetManifest.id}`,
    );

    if (manifests.length === 1 && fullManifest.type === 'full') {
      // Simple case: single full backup, no merge needed
      const files = await this.readBackupFiles(fullManifest);
      return {
        manifests,
        mergedFiles: files,
        mergedCollections: fullManifest.collections,
        targetManifest: fullManifest,
        fullManifest,
        warnings,
      };
    }

    // Step 2: Read and merge all backups in order
    const mergedDocs = new Map<string, Map<string, SerializedDocument>>();
    const deletedDocs = new Set<string>();

    for (const manifest of manifests) {
      const files = await this.readBackupFiles(manifest);

      // Merge documents (latest version wins)
      for (const [backupFile, documents] of files) {
        if (!mergedDocs.has(backupFile)) {
          mergedDocs.set(backupFile, new Map());
        }
        const collectionMap = mergedDocs.get(backupFile)!;

        for (const doc of documents) {
          // Remove from deleted set if re-created
          deletedDocs.delete(`${backupFile}:${doc._id}`);
          collectionMap.set(doc._id, doc);
        }
      }

      // Apply tombstones from incremental manifests
      for (const entry of manifest.collections) {
        if (entry.deletedDocumentIds?.length) {
          for (const deletedId of entry.deletedDocumentIds) {
            const key = `${entry.backupFile}:${deletedId}`;
            deletedDocs.add(key);

            // Remove from merged docs
            const collectionMap = mergedDocs.get(entry.backupFile);
            if (collectionMap) {
              collectionMap.delete(deletedId);
            }
          }
        }
      }
    }

    // Step 3: Convert merged maps to arrays
    const mergedFiles = new Map<string, SerializedDocument[]>();
    for (const [backupFile, docMap] of mergedDocs) {
      const docs = Array.from(docMap.values());
      if (docs.length > 0) {
        mergedFiles.set(backupFile, docs);
      }
    }

    // Step 4: Build unified collection entries
    const mergedCollections = this.buildMergedCollections(manifests, mergedFiles);

    if (deletedDocs.size > 0) {
      warnings.push(
        `${deletedDocs.size} documents removed via tombstones across the chain`,
      );
    }

    logger.info(
      `Chain merge completed: ${mergedFiles.size} collection files, ` +
      `${Array.from(mergedFiles.values()).reduce((s, d) => s + d.length, 0)} documents`,
    );

    return {
      manifests,
      mergedFiles,
      mergedCollections,
      targetManifest,
      fullManifest,
      warnings,
    };
  }

  /**
   * Walk parentBackupId chain until a full backup is found.
   * Returns manifests in order: full (first) → incrementals → target (last).
   */
  private async walkChain(backupId: string): Promise<BackupManifest[]> {
    const chain: BackupManifest[] = [];
    let currentId: string | undefined = backupId;
    let depth = 0;

    while (currentId) {
      if (depth >= MAX_CHAIN_DEPTH) {
        throw new Error(
          `Backup chain exceeds max depth (${MAX_CHAIN_DEPTH}). ` +
          `Possible circular reference at ${currentId}`,
        );
      }

      try {
        const manifest = await this.gcsService.readManifest(currentId);
        chain.unshift(manifest); // prepend — oldest first

        if (manifest.type === 'full') {
          break; // Found the root
        }

        if (!manifest.parentBackupId) {
          throw new Error(
            `Incremental backup ${currentId} has no parentBackupId`,
          );
        }

        currentId = manifest.parentBackupId;
        depth++;
      } catch (error) {
        throw new Error(
          `Failed to read manifest in chain at ${currentId}: ${getErrorMessage(error)}`,
        );
      }
    }

    if (chain.length === 0) {
      throw new Error(`Empty backup chain for ${backupId}`);
    }

    if (chain[0].type !== 'full') {
      throw new Error(
        `Backup chain does not start with a full backup. ` +
        `Root backup ${chain[0].id} is type '${chain[0].type}'`,
      );
    }

    return chain;
  }

  /**
   * Read all backup files from a single manifest.
   */
  private async readBackupFiles(
    manifest: BackupManifest,
  ): Promise<Map<string, SerializedDocument[]>> {
    const files = new Map<string, SerializedDocument[]>();

    for (const entry of manifest.collections) {
      if (entry.documentCount > 0) {
        try {
          const docs = await this.gcsService.readBackupFile(
            manifest.id,
            entry.backupFile,
          );
          files.set(entry.backupFile, docs);
        } catch (error) {
          logger.warn(
            `Failed to read ${entry.backupFile} from ${manifest.id}: ` +
            `${getErrorMessage(error)}`,
          );
        }
      }
    }

    for (const entry of manifest.subcollections) {
      if (entry.totalDocuments > 0) {
        try {
          const docs = await this.gcsService.readBackupFile(
            manifest.id,
            entry.backupFile,
          );
          files.set(entry.backupFile, docs);
        } catch (error) {
          logger.warn(
            `Failed to read ${entry.backupFile} from ${manifest.id}: ` +
            `${getErrorMessage(error)}`,
          );
        }
      }
    }

    return files;
  }

  /**
   * Build unified collection entries from all manifests in the chain.
   * Uses the latest manifest's entry per collection, updated with merged doc counts.
   */
  private buildMergedCollections(
    manifests: BackupManifest[],
    mergedFiles: Map<string, SerializedDocument[]>,
  ): CollectionManifestEntry[] {
    const collectionMap = new Map<string, CollectionManifestEntry>();

    // Process in order — latest version of each collection entry wins
    for (const manifest of manifests) {
      for (const entry of manifest.collections) {
        collectionMap.set(entry.collectionKey, { ...entry });
      }
    }

    // Update document counts from merged files
    for (const entry of collectionMap.values()) {
      const docs = mergedFiles.get(entry.backupFile);
      entry.documentCount = docs?.length ?? 0;
      // Clear tombstones — already applied during merge
      entry.deletedDocumentIds = undefined;
    }

    return Array.from(collectionMap.values());
  }
}
