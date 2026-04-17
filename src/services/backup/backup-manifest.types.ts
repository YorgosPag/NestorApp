/**
 * =============================================================================
 * ENTERPRISE BACKUP MANIFEST TYPES — ADR-313
 * =============================================================================
 *
 * Type definitions for the manifest-driven backup/restore system.
 * The manifest is the schema record — it captures the point-in-time
 * field inventory of every collection, enabling schema reconciliation
 * at restore time without requiring schemaVersion fields in documents.
 *
 * @module services/backup/backup-manifest.types
 * @see adrs/ADR-313-enterprise-backup-restore.md
 */

// ---------------------------------------------------------------------------
// Backup Manifest (root)
// ---------------------------------------------------------------------------

export interface BackupManifest {
  /** Unique backup ID — bkp_{uuid} from enterprise-id.service */
  id: string;

  /** Manifest schema version — for future manifest format evolution */
  version: '1.0.0';

  /** Full export or incremental delta */
  type: 'full' | 'incremental';

  /** ISO 8601 timestamp */
  createdAt: string;

  /** userId of the super-admin who triggered the backup */
  createdBy: string;

  /** Firebase project ID (e.g. 'pagonis-87766') */
  projectId: string;

  /** Environment tag */
  environment: 'development' | 'staging' | 'production';

  /** Exported top-level collections */
  collections: CollectionManifestEntry[];

  /** Exported subcollections */
  subcollections: SubcollectionManifestEntry[];

  /** Exported Storage files (Phase 3) */
  storageFiles: StorageManifestEntry[];

  /** Git hash or timestamp of firestore-collections.ts at backup time */
  firestoreCollectionsVersion: string;

  /** Aggregate counts */
  totalDocuments: number;
  totalStorageFiles: number;
  totalStorageBytes: number;

  /** SHA-256 of the manifest JSON (excluding this field) */
  checksum: string;

  /** For incremental backups (Phase 5) */
  parentBackupId?: string;

  /** ISO 8601 — delta changes since this timestamp (Phase 5) */
  deltaFrom?: string;

  /** Duration of the backup in milliseconds */
  durationMs: number;

  /** Warnings/notes from the backup process */
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Collection entry
// ---------------------------------------------------------------------------

export interface CollectionManifestEntry {
  /** COLLECTIONS key (e.g. 'CONTACTS') */
  collectionKey: string;

  /** Firestore collection name (e.g. 'contacts') */
  collectionName: string;

  /** Number of documents exported */
  documentCount: number;

  /** Union of all field names found across all documents */
  fieldInventory: string[];

  /** Immutable collections skip existing docs on restore */
  isImmutable: boolean;

  /** Relative path in backup: 'collections/contacts.ndjson.gz' */
  backupFile: string;

  /** SHA-256 of the NDJSON file */
  checksum: string;

  /** Document IDs deleted since parent backup (incremental only) */
  deletedDocumentIds?: string[];
}

// ---------------------------------------------------------------------------
// Subcollection entry
// ---------------------------------------------------------------------------

export interface SubcollectionManifestEntry {
  /** SUBCOLLECTIONS key (e.g. 'CONTACT_ACTIVITIES') */
  subcollectionKey: string;

  /** Subcollection name in Firestore (e.g. 'activities') */
  subcollectionName: string;

  /** Parent COLLECTIONS key (e.g. 'CONTACTS') */
  parentCollectionKey: string;

  /** Parent document IDs that contain this subcollection */
  parentDocumentIds: string[];

  /** Total documents across all parents */
  totalDocuments: number;

  /** Union of all field names found */
  fieldInventory: string[];

  /** Relative path: 'subcollections/contacts__activities.ndjson.gz' */
  backupFile: string;

  /** SHA-256 of the NDJSON file */
  checksum: string;
}

// ---------------------------------------------------------------------------
// Storage file entry (Phase 3)
// ---------------------------------------------------------------------------

export interface StorageManifestEntry {
  /** Full path in Firebase Storage bucket */
  storagePath: string;

  /** Linked FileRecord document ID (if exists) */
  firestoreDocId?: string;

  /** File size in bytes */
  sizeBytes: number;

  /** MIME content type */
  contentType: string;

  /** SHA-256 of the file */
  sha256: string;

  /** Relative path in backup */
  backupFile: string;
}

// ---------------------------------------------------------------------------
// Backup status (progress tracking in Firestore system/backup_status)
// ---------------------------------------------------------------------------

export type BackupPhase =
  | 'initializing'
  | 'exporting_collections'
  | 'exporting_subcollections'
  | 'exporting_storage'
  | 'finalizing_manifest'
  | 'completed'
  | 'failed';

export interface BackupStatus {
  /** Current backup ID */
  backupId: string;

  /** Current phase */
  phase: BackupPhase;

  /** Currently processing collection (if applicable) */
  currentCollection?: string;

  /** Collections already processed */
  processedCollections: number;

  /** Total collections to process */
  totalCollections: number;

  /** Documents exported so far */
  documentsExported: number;

  /** Storage files exported so far (Phase 3) */
  storageFilesExported: number;

  /** ISO 8601 — when backup started */
  startedAt: string;

  /** ISO 8601 — when backup completed/failed */
  completedAt?: string;

  /** Error message if failed */
  error?: string;

  /** Who triggered the backup */
  triggeredBy: string;
}

// ---------------------------------------------------------------------------
// Serialized document wrapper (NDJSON line format)
// ---------------------------------------------------------------------------

export interface SerializedDocument {
  /** Firestore document ID */
  _id: string;

  /** Document path (e.g. 'contacts/cont_abc123') */
  _path: string;

  /** Serialized document data (Firestore types converted to JSON-safe) */
  _data: Record<string, unknown>;

  /** Field types map for deserialization (field → FirestoreFieldType) */
  _fieldTypes: Record<string, FirestoreFieldType>;
}

/** Firestore field types that need special serialization */
export type FirestoreFieldType =
  | 'timestamp'
  | 'geopoint'
  | 'reference'
  | 'bytes';

// ---------------------------------------------------------------------------
// Backup configuration (system/backup_config — Phase 6)
// ---------------------------------------------------------------------------

export interface BackupConfig {
  /** Enable scheduled backups */
  scheduleEnabled: boolean;

  /** Cron expression (e.g. '0 2 * * *' for daily at 2 AM) */
  scheduleCron: string;

  /** Number of backups to retain */
  retentionCount: number;

  /** Last completed backup ID */
  lastBackupId?: string;

  /** ISO 8601 — last backup timestamp */
  lastBackupAt?: string;

  /** GCS bucket name for backups */
  bucketName: string;

  /** Enable incremental backups between full backups */
  incrementalEnabled?: boolean;

  /** Days between full backups (default 7). Other days run incremental. */
  fullBackupIntervalDays?: number;
}

// ---------------------------------------------------------------------------
// Restore types (Phase 4 — ADR-313)
// ---------------------------------------------------------------------------

export type RestorePhase =
  | 'validating'
  | 'creating_snapshot'
  | 'reconciling_schema'
  | 'restoring_collections'
  | 'restoring_subcollections'
  | 'restoring_storage'
  | 'completed'
  | 'failed';

export interface RestoreStatus {
  /** Restore operation ID */
  restoreId: string;

  /** Source backup ID */
  backupId: string;

  /** Current phase */
  phase: RestorePhase;

  /** Currently processing collection */
  currentCollection?: string;

  /** Collections already restored */
  processedCollections: number;

  /** Total collections to restore */
  totalCollections: number;

  /** Documents restored so far */
  documentsRestored: number;

  /** Documents skipped (immutable existing) */
  documentsSkipped: number;

  /** Storage files restored */
  storageFilesRestored?: number;

  /** ISO 8601 — when restore started */
  startedAt: string;

  /** ISO 8601 — when restore completed/failed */
  completedAt?: string;

  /** Error message if failed */
  error?: string;

  /** Who triggered the restore */
  triggeredBy: string;

  /** Pre-restore snapshot ID (for future rollback) */
  snapshotId?: string;
}

export interface RestoreOptions {
  /** Specific collection keys to restore (empty = all) */
  collections?: string[];

  /** Skip immutable collections entirely */
  skipImmutable?: boolean;

  /** Use merge: true on set() — preserves fields not in backup */
  mergeMode?: boolean;

  /** Dry run — preview only, no writes */
  dryRun?: boolean;
}

/** Result of schema reconciliation for a single collection */
export interface CollectionReconciliation {
  /** Collection key */
  collectionKey: string;

  /** Collection name */
  collectionName: string;

  /** Fields present in backup data */
  backupFields: string[];

  /** Whether collection is immutable */
  isImmutable: boolean;

  /** Documents in backup */
  documentCount: number;

  /** Documents that already exist in current DB (preview only) */
  existingCount: number;

  /** Documents that would be created (new) */
  newCount: number;

  /** Documents that would be updated (existing, non-immutable) */
  updateCount: number;

  /** Documents that would be skipped (existing, immutable) */
  skipCount: number;
}

export interface RestorePreview {
  /** Source backup metadata */
  backupId: string;
  backupCreatedAt: string;
  backupType: 'full' | 'incremental';

  /** Per-collection reconciliation */
  collections: CollectionReconciliation[];
  subcollections: CollectionReconciliation[];

  /** Aggregate counts */
  totalDocuments: number;
  totalNew: number;
  totalUpdate: number;
  totalSkip: number;

  /** Warnings */
  warnings: string[];
}

/** Pre-restore snapshot — saved to GCS before any writes */
export interface PreRestoreSnapshot {
  /** Snapshot ID */
  id: string;

  /** Restore operation this snapshot belongs to */
  restoreId: string;

  /** Source backup ID */
  backupId: string;

  /** ISO 8601 */
  createdAt: string;

  /** Per-collection: doc IDs that will be overwritten */
  collections: PreRestoreCollectionSnapshot[];
}

export interface PreRestoreCollectionSnapshot {
  /** Collection name */
  collectionName: string;

  /** Document IDs that exist and will be overwritten */
  existingDocIds: string[];

  /** Count of existing docs */
  existingCount: number;
}

// ---------------------------------------------------------------------------
// Shared callback type (SSoT — used by BackupService, StorageBackupService)
// ---------------------------------------------------------------------------

export type StatusCallback = (status: Partial<BackupStatus>) => Promise<void>;
