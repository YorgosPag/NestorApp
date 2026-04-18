/**
 * =============================================================================
 * INCREMENTAL BACKUP SERVICE — ADR-313 Phase 5
 * =============================================================================
 *
 * Delta backup using entity_audit_trail as CDC (Change Data Capture).
 *
 * Strategy:
 * 1. Read parent backup manifest from GCS
 * 2. Query entity_audit_trail for entries after parent's createdAt
 * 3. Map AuditEntityType → COLLECTIONS key → collection name
 * 4. Re-fetch only changed documents from Firestore (current state)
 * 5. Track deleted document IDs as tombstones
 * 6. Build incremental manifest with parentBackupId + deltaFrom
 *
 * Limitations:
 * - Only collections covered by EntityAuditService are tracked
 * - Collections without audit coverage get a warning in the manifest
 * - Storage files are NOT included in incremental (full backup only)
 *
 * @module services/backup/incremental-backup.service
 * @see adrs/ADR-313-enterprise-backup-restore.md §6 Phase 5
 */

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS, IMMUTABLE_COLLECTIONS } from '@/config/firestore-collections';
import { GCP_PROJECT_ID } from '@/config/gcs-buckets';
import { enterpriseIdService } from '@/services/enterprise-id.service';
import { EntityAuditService } from '@/services/entity-audit.service';
import type { AuditCdcEntry } from '@/services/entity-audit.service';
import { createModuleLogger } from '@/lib/telemetry';
import { serializeDocument } from './backup-serializer';

import type { Firestore } from 'firebase-admin/firestore';
import type { BackupGcsService } from './backup-gcs.service';
import type {
  BackupManifest,
  CollectionManifestEntry,
  StatusCallback,
  SerializedDocument,
} from './backup-manifest.types';
import type { AuditEntityType } from '@/types/audit-trail';
import { nowISO } from '@/lib/date-local';

const logger = createModuleLogger('IncrementalBackupService');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MANIFEST_VERSION = '1.0.0' as const;

/** Max audit entries to process per query batch */
const AUDIT_QUERY_BATCH_SIZE = 500;

/** AuditEntityType → COLLECTIONS key mapping */
const ENTITY_TYPE_TO_COLLECTION_KEY: Record<AuditEntityType, string> = {
  contact: 'CONTACTS',
  building: 'BUILDINGS',
  property: 'PROPERTIES',
  floor: 'FLOORS',
  project: 'PROJECTS',
  company: 'COMPANIES',
  parking: 'PARKING_SPACES',
  storage: 'STORAGE',
  purchase_order: 'PURCHASE_ORDERS',
};

/** Actions that indicate a document was removed */
const DELETE_ACTIONS = new Set(['deleted', 'soft_deleted']);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChangedEntity {
  entityType: AuditEntityType;
  entityId: string;
  collectionKey: string;
  collectionName: string;
  isDeleted: boolean;
}

export interface IncrementalBackupResult {
  manifest: BackupManifest;
  files: Map<string, SerializedDocument[]>;
}

// ---------------------------------------------------------------------------
// IncrementalBackupService
// ---------------------------------------------------------------------------

export class IncrementalBackupService {
  private db: Firestore;

  constructor() {
    this.db = getAdminFirestore();
  }

  /**
   * Query entity_audit_trail for all changes after deltaFrom.
   * Uses EntityAuditService.queryChangesAfter() (SSoT — centralized access).
   * Groups results by collection, separating modified vs deleted.
   */
  private async queryChangedEntities(
    deltaFrom: string,
  ): Promise<ChangedEntity[]> {
    const seenEntities = new Map<string, ChangedEntity>();

    let lastDoc: FirebaseFirestore.DocumentSnapshot | null = null;
    let hasMore = true;

    while (hasMore) {
      const result = await EntityAuditService.queryChangesAfter(
        deltaFrom,
        AUDIT_QUERY_BATCH_SIZE,
        lastDoc ?? undefined,
      );

      for (const entry of result.entries) {
        const collectionKey = ENTITY_TYPE_TO_COLLECTION_KEY[entry.entityType];
        if (!collectionKey) {
          logger.warn(`Unknown audit entity type: ${entry.entityType}`);
          continue;
        }

        const collectionName = COLLECTIONS[collectionKey as keyof typeof COLLECTIONS];
        if (!collectionName) {
          logger.warn(`No collection found for key: ${collectionKey}`);
          continue;
        }

        const key = `${collectionKey}:${entry.entityId}`;
        const isDeleted = DELETE_ACTIONS.has(entry.action);

        // Last action wins (chronological order)
        seenEntities.set(key, {
          entityType: entry.entityType,
          entityId: entry.entityId,
          collectionKey,
          collectionName,
          isDeleted,
        });
      }

      lastDoc = result.lastDoc;
      hasMore = result.hasMore;
    }

    const entities = Array.from(seenEntities.values());

    logger.info(
      `Found ${entities.length} changed entities since ${deltaFrom} ` +
      `(${entities.filter(e => e.isDeleted).length} deleted)`,
    );

    return entities;
  }

  /**
   * Fetch specific documents by ID from a collection.
   * Returns only documents that still exist.
   */
  private async fetchDocumentsByIds(
    collectionName: string,
    documentIds: string[],
  ): Promise<SerializedDocument[]> {
    const documents: SerializedDocument[] = [];

    // Firestore getAll() supports up to 500 refs at once
    const batchSize = 500;
    for (let i = 0; i < documentIds.length; i += batchSize) {
      const batch = documentIds.slice(i, i + batchSize);
      const refs = batch.map(id => this.db.collection(collectionName).doc(id));
      const snapshots = await this.db.getAll(...refs);

      for (const snap of snapshots) {
        if (snap.exists) {
          const data = snap.data()!;
          documents.push(serializeDocument(snap.id, snap.ref.path, data));
        }
      }
    }

    return documents;
  }

  /**
   * Execute an incremental backup based on a parent backup.
   *
   * @param parentBackupId - ID of the parent (full or incremental) backup
   * @param triggeredBy - userId or 'scheduled-cron'
   * @param gcsService - GCS service for reading parent manifest + writing backup
   * @param onProgress - Optional progress callback
   */
  async executeIncrementalBackup(
    parentBackupId: string,
    triggeredBy: string,
    gcsService: BackupGcsService,
    onProgress?: StatusCallback,
  ): Promise<IncrementalBackupResult> {
    const startTime = Date.now();
    const backupId = enterpriseIdService.generateBackupId();

    logger.info(`Starting incremental backup ${backupId} (parent: ${parentBackupId})`);

    if (onProgress) {
      await onProgress({
        backupId,
        phase: 'initializing',
        processedCollections: 0,
        totalCollections: 0,
        documentsExported: 0,
        storageFilesExported: 0,
        startedAt: nowISO(),
        triggeredBy,
      });
    }

    // Step 1: Read parent manifest
    const parentManifest = await gcsService.readManifest(parentBackupId);
    const deltaFrom = parentManifest.createdAt;

    logger.info(`Parent backup: ${parentBackupId}, deltaFrom: ${deltaFrom}`);

    // Step 2: Query audit trail for changes
    const changedEntities = await this.queryChangedEntities(deltaFrom);

    if (changedEntities.length === 0) {
      logger.info('No changes since parent backup — creating empty incremental manifest');

      const manifest = this.buildIncrementalManifest(
        backupId,
        parentBackupId,
        deltaFrom,
        [],
        triggeredBy,
        startTime,
        ['No changes detected since parent backup'],
      );

      return { manifest, files: new Map() };
    }

    // Step 3: Group by collection
    const collectionGroups = new Map<string, {
      collectionKey: string;
      collectionName: string;
      modifiedIds: string[];
      deletedIds: string[];
    }>();

    for (const entity of changedEntities) {
      const existing = collectionGroups.get(entity.collectionKey);

      if (existing) {
        if (entity.isDeleted) {
          existing.deletedIds.push(entity.entityId);
        } else {
          existing.modifiedIds.push(entity.entityId);
        }
      } else {
        collectionGroups.set(entity.collectionKey, {
          collectionKey: entity.collectionKey,
          collectionName: entity.collectionName,
          modifiedIds: entity.isDeleted ? [] : [entity.entityId],
          deletedIds: entity.isDeleted ? [entity.entityId] : [],
        });
      }
    }

    // Step 4: Fetch changed documents and build manifest entries
    const collectionEntries: CollectionManifestEntry[] = [];
    const files = new Map<string, SerializedDocument[]>();
    let totalDocuments = 0;
    let processed = 0;
    const totalCollections = collectionGroups.size;

    for (const [, group] of collectionGroups) {
      if (onProgress) {
        await onProgress({
          phase: 'exporting_collections',
          currentCollection: group.collectionKey,
          processedCollections: processed,
          totalCollections,
        });
      }

      const documents = group.modifiedIds.length > 0
        ? await this.fetchDocumentsByIds(group.collectionName, group.modifiedIds)
        : [];

      const fieldInventory = new Set<string>();
      for (const doc of documents) {
        const fields = Object.keys(doc._data);
        fields.forEach(f => fieldInventory.add(f));
      }

      const backupFile = `collections/${group.collectionName}.ndjson.gz`;
      const isImmutable = IMMUTABLE_COLLECTIONS.includes(group.collectionKey);

      const entry: CollectionManifestEntry = {
        collectionKey: group.collectionKey,
        collectionName: group.collectionName,
        documentCount: documents.length,
        fieldInventory: Array.from(fieldInventory).sort(),
        isImmutable,
        backupFile,
        checksum: '',
        deletedDocumentIds: group.deletedIds.length > 0 ? group.deletedIds : undefined,
      };

      collectionEntries.push(entry);

      if (documents.length > 0) {
        files.set(backupFile, documents);
      }

      totalDocuments += documents.length;
      processed++;
    }

    if (onProgress) {
      await onProgress({
        phase: 'exporting_collections',
        processedCollections: totalCollections,
        totalCollections,
        documentsExported: totalDocuments,
      });
    }

    // Step 5: Build warnings for uncovered collections
    const warnings = this.buildCoverageWarnings(parentManifest);

    // Step 6: Build manifest
    const manifest = this.buildIncrementalManifest(
      backupId,
      parentBackupId,
      deltaFrom,
      collectionEntries,
      triggeredBy,
      startTime,
      warnings,
    );

    if (onProgress) {
      await onProgress({
        backupId: manifest.id,
        phase: 'completed',
        processedCollections: totalCollections,
        totalCollections,
        documentsExported: manifest.totalDocuments,
        storageFilesExported: 0,
        completedAt: nowISO(),
      });
    }

    logger.info(
      `Incremental backup completed: ${manifest.id} — ` +
      `${manifest.totalDocuments} documents in ${manifest.durationMs}ms ` +
      `(${collectionEntries.length} collections affected)`,
    );

    return { manifest, files };
  }

  /**
   * Build warnings about collections not covered by entity audit trail.
   */
  private buildCoverageWarnings(parentManifest: BackupManifest): string[] {
    const warnings: string[] = [];
    const coveredKeys = new Set(Object.values(ENTITY_TYPE_TO_COLLECTION_KEY));

    const uncoveredCollections = parentManifest.collections
      .filter(c => !coveredKeys.has(c.collectionKey))
      .map(c => c.collectionKey);

    if (uncoveredCollections.length > 0) {
      warnings.push(
        `${uncoveredCollections.length} collections not covered by entity audit trail ` +
        `(changes not tracked): ${uncoveredCollections.join(', ')}`,
      );
    }

    if (parentManifest.subcollections.length > 0) {
      warnings.push(
        'Subcollection changes not tracked in incremental backups. ' +
        'Run a full backup periodically to capture subcollection changes.',
      );
    }

    return warnings;
  }

  /**
   * Build the incremental BackupManifest.
   */
  private buildIncrementalManifest(
    backupId: string,
    parentBackupId: string,
    deltaFrom: string,
    collections: CollectionManifestEntry[],
    triggeredBy: string,
    startTime: number,
    warnings: string[],
  ): BackupManifest {
    const totalDocuments = collections.reduce(
      (sum, c) => sum + c.documentCount,
      0,
    );

    return {
      id: backupId,
      version: MANIFEST_VERSION,
      type: 'incremental',
      createdAt: nowISO(),
      createdBy: triggeredBy,
      projectId: GCP_PROJECT_ID,
      environment: (process.env.NODE_ENV as 'development' | 'staging' | 'production') ?? 'development',
      collections,
      subcollections: [],
      storageFiles: [],
      firestoreCollectionsVersion: nowISO(),
      totalDocuments,
      totalStorageFiles: 0,
      totalStorageBytes: 0,
      checksum: '',
      parentBackupId,
      deltaFrom,
      durationMs: Date.now() - startTime,
      warnings,
    };
  }
}
