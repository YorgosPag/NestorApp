/**
 * =============================================================================
 * 🏢 ENTERPRISE FILE RECORD SERVICE
 * =============================================================================
 *
 * Firestore service for managing FileRecord documents.
 * This is the Source of Truth for file metadata - Storage holds binaries only.
 *
 * @module services/file-record.service
 * @enterprise ADR-031 - Canonical File Storage System
 *
 * Upload Flow:
 * 1. createPendingFileRecord() → Creates Firestore doc (status: pending)
 * 2. Upload binary to Storage at storagePath
 * 3. finalizeFileRecord() → Updates status: ready, adds downloadUrl/sizeBytes
 */

import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import {
  type EntityType,
  type FileDomain,
  type FileCategory,
  type HoldType,
  FILE_STATUS,
  FILE_LIFECYCLE_STATES,
  DEFAULT_RETENTION_POLICIES,
  RETENTION_BY_CATEGORY,
  HOLD_TYPES,
} from '@/config/domain-constants';
import type {
  FileRecord,
  CreateFileRecordInput,
  CreateFileRecordResult,
  FinalizeFileRecordInput,
  FileRecordQuery,
} from '@/types/file-record';
import { isFileRecord } from '@/types/file-record';


import {
  ensureFilesNamespaceLoaded,
} from '@/services/upload/utils/file-display-name';
// 🏢 ENTERPRISE: SSoT Core module for FileRecord schema
import {
  buildPendingFileRecordData,
  buildFinalizeFileRecordUpdate,
  type BuildPendingFileRecordInput,
} from '@/services/file-record';
import { createModuleLogger } from '@/lib/telemetry';
// 🏢 ENTERPRISE: Centralized real-time service for cross-page sync
import { RealtimeService } from '@/services/realtime';

// ============================================================================
// MODULE LOGGER
// ============================================================================

/**
 * 🏢 ENTERPRISE: Centralized logger for FileRecordService
 * Uses canonical logger from src/lib/telemetry
 */
const logger = createModuleLogger('FILE_RECORD');

// ============================================================================
// FILE RECORD SERVICE
// ============================================================================

/**
 * 🏢 ENTERPRISE: FileRecord Service
 *
 * Manages FileRecord documents in Firestore.
 * These documents are the Source of Truth for file metadata.
 *
 * @example
 * ```typescript
 * // Step 1: Create pending record (displayName generated centrally)
 * const { fileId, storagePath, displayName, fileRecord } = await FileRecordService.createPendingFileRecord({
 *   companyId: 'company_xyz',
 *   entityType: 'contact',
 *   entityId: 'contact_123',
 *   domain: 'admin',
 *   category: 'photos',
 *   // Naming context - displayName is generated automatically
 *   entityLabel: 'Γιώργος Παπαδόπουλος',
 *   purpose: 'profile',
 *   // File metadata
 *   originalFilename: 'IMG_20240115.jpg',
 *   contentType: 'image/jpeg',
 *   createdBy: 'user_abc',
 * });
 * // displayName is automatically: "Φωτογραφία Προφίλ - Γιώργος Παπαδόπουλος"
 *
 * // Step 2: Upload binary to Storage at storagePath
 * const downloadUrl = await uploadToStorage(file, storagePath);
 *
 * // Step 3: Finalize record
 * await FileRecordService.finalizeFileRecord({
 *   fileId,
 *   sizeBytes: file.size,
 *   downloadUrl,
 * });
 * ```
 */
export class FileRecordService {
  // ==========================================================================
  // CREATE OPERATIONS
  // ==========================================================================

  /**
   * Step A: Create pending FileRecord (before binary upload)
   *
   * Creates a Firestore document with status: 'pending'.
   * Returns the generated fileId and storagePath for binary upload.
   *
   * 🏢 ENTERPRISE: Uses SSoT core module for schema construction.
   * displayName is generated CENTRALLY - enforces SINGLE NAMING AUTHORITY (ADR-031).
   */
  static async createPendingFileRecord(
    input: CreateFileRecordInput
  ): Promise<CreateFileRecordResult> {
    // 🏢 ENTERPRISE: Ensure i18n namespace is loaded for naming
    await ensureFilesNamespaceLoaded();

    // =========================================================================
    // 🏢 ENTERPRISE: USE SSoT CORE MODULE FOR SCHEMA CONSTRUCTION
    // =========================================================================
    // All FileRecord schema logic lives in file-record-core.ts
    // This adapter only handles client SDK specifics (timestamps, Firestore write)
    const coreInput: BuildPendingFileRecordInput = {
      companyId: input.companyId,
      entityType: input.entityType,
      entityId: input.entityId,
      domain: input.domain,
      category: input.category,
      originalFilename: input.originalFilename,
      contentType: input.contentType,
      createdBy: input.createdBy,
      projectId: input.projectId,
      ext: input.ext,
      entityLabel: input.entityLabel,
      purpose: input.purpose,
      descriptors: input.descriptors,
      occurredAt: input.occurredAt,
      revision: input.revision,
      customTitle: input.customTitle,
      language: 'el', // 🏢 ENTERPRISE: Always use Greek for stored displayNames
    };

    const { fileId, storagePath, displayNameResult, recordBase } =
      buildPendingFileRecordData(coreInput);

    const displayName = displayNameResult.displayName;

    logger.info('Creating pending FileRecord with SSoT core', {
      entityType: input.entityType,
      entityId: input.entityId,
      domain: input.domain,
      category: input.category,
      generatedDisplayName: displayName,
      namingContext: {
        entityLabel: input.entityLabel,
        purpose: input.purpose,
        revision: input.revision,
      },
    });

    // =========================================================================
    // 🏢 ENTERPRISE: CLIENT SDK ADAPTER - Add timestamps and write
    // =========================================================================
    // Core provides schema, adapter provides SDK-specific operations
    const fileRecord: FileRecord = {
      ...recordBase,
      createdAt: new Date().toISOString(), // Will be overwritten by serverTimestamp
    };

    // Write to Firestore with server timestamp
    const docRef = doc(db, COLLECTIONS.FILES, fileId);
    const docData = {
      ...recordBase,
      createdAt: serverTimestamp(), // Use server timestamp for consistency
    };

    try {
      await setDoc(docRef, docData);

      logger.info('Pending FileRecord created', {
        fileId,
        storagePath,
        displayName,
      });

      // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
      RealtimeService.dispatch('FILE_CREATED',{
        fileId,
        file: {
          displayName,
          category: input.category,
          entityType: input.entityType,
          entityId: input.entityId,
          status: FILE_STATUS.PENDING,
        },
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error('Failed to write FileRecord to Firestore', {
        fileId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error; // Re-throw to stop upload pipeline
    }

    return {
      fileId,
      storagePath,
      displayName,
      fileRecord,
    };
  }

  // ==========================================================================
  // FINALIZE OPERATIONS
  // ==========================================================================

  /**
   * Step C: Finalize FileRecord (after successful binary upload)
   *
   * Updates the FileRecord with final metadata and sets status to 'ready'.
   *
   * 🏢 ENTERPRISE: Uses SSoT core module for update construction.
   */
  static async finalizeFileRecord(input: FinalizeFileRecordInput): Promise<void> {
    logger.info('Finalizing FileRecord', {
      fileId: input.fileId,
      sizeBytes: input.sizeBytes,
      hasDownloadUrl: !!input.downloadUrl,
    });

    const docRef = doc(db, COLLECTIONS.FILES, input.fileId);

    // Verify document exists
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      throw new Error(`FileRecord not found: ${input.fileId}`);
    }

    // =========================================================================
    // 🏢 ENTERPRISE: USE SSoT CORE MODULE FOR UPDATE CONSTRUCTION
    // =========================================================================
    // Core provides update schema, adapter adds timestamp and executes
    const coreUpdate = buildFinalizeFileRecordUpdate({
      sizeBytes: input.sizeBytes,
      downloadUrl: input.downloadUrl,
      hash: input.hash,
      nextStatus: FILE_STATUS.READY, // Default for client uploads
    });

    // Build update with server timestamp (client SDK specific)
    const updateData: Record<string, unknown> = {
      ...coreUpdate,
      updatedAt: serverTimestamp(),
    };

    await updateDoc(docRef, updateData);

    logger.info('FileRecord finalized successfully', {
      fileId: input.fileId,
      status: coreUpdate.status,
    });

    // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
    RealtimeService.dispatch('FILE_UPDATED',{
      fileId: input.fileId,
      updates: {
        status: coreUpdate.status,
        sizeBytes: input.sizeBytes,
        hasDownloadUrl: !!input.downloadUrl,
      },
      timestamp: Date.now(),
    });
  }

  /**
   * Mark FileRecord as failed (if upload fails)
   */
  static async markFileRecordFailed(
    fileId: string,
    errorMessage?: string
  ): Promise<void> {
    logger.warn('Marking FileRecord as failed', {
      fileId,
      errorMessage,
    });

    const docRef = doc(db, COLLECTIONS.FILES, fileId);

    await updateDoc(docRef, {
      status: FILE_STATUS.FAILED,
      updatedAt: serverTimestamp(),
      // Store error message in metadata if needed
    });

    logger.info('FileRecord marked as failed');
  }

  // ==========================================================================
  // READ OPERATIONS
  // ==========================================================================

  /**
   * Get a single FileRecord by ID
   * 🏢 ENTERPRISE: Uses isFileRecord() type guard for boundary validation
   */
  static async getFileRecord(fileId: string): Promise<FileRecord | null> {
    const docRef = doc(db, COLLECTIONS.FILES, fileId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const data = docSnap.data();
    const record = {
      ...data,
      id: docSnap.id,
      // Convert Firestore Timestamp to ISO string if needed
      createdAt: data.createdAt instanceof Object && 'toDate' in data.createdAt
        ? (data.createdAt as Timestamp).toDate().toISOString()
        : data.createdAt,
      updatedAt: data.updatedAt instanceof Object && 'toDate' in data.updatedAt
        ? (data.updatedAt as Timestamp).toDate().toISOString()
        : data.updatedAt,
    };

    // 🏢 ENTERPRISE: Validate data shape at Firestore boundary
    if (!isFileRecord(record)) {
      logger.warn('Invalid FileRecord data from Firestore', { fileId, data: record });
      return null;
    }

    return record;
  }

  /**
   * Query FileRecords by entity
   */
  static async getFilesByEntity(
    entityType: EntityType,
    entityId: string,
    options?: {
      domain?: FileDomain;
      category?: FileCategory;
      purpose?: string; // 🏢 ENTERPRISE: Filter by purpose (e.g., 'project-floorplan' vs 'parking-floorplan')
      includeDeleted?: boolean;
      companyId?: string; // 🏢 ENTERPRISE: Required for Firestore Rules query authorization
    }
  ): Promise<FileRecord[]> {
    const constraints = [
      where('entityType', '==', entityType),
      where('entityId', '==', entityId),
      where('status', '==', FILE_STATUS.READY),
    ];

    // 🏢 ENTERPRISE: Add companyId constraint for Firestore Rules authorization
    // This enables query execution - without it, Firestore Rules block the query
    if (options?.companyId) {
      constraints.push(where('companyId', '==', options.companyId));
    }

    if (options?.domain) {
      constraints.push(where('domain', '==', options.domain));
    }

    if (options?.category) {
      constraints.push(where('category', '==', options.category));
    }

    // 🏢 ENTERPRISE: Filter by purpose (critical for Floorplan tab separation)
    // Requires Firestore composite index (standard enterprise practice)
    if (options?.purpose) {
      constraints.push(where('purpose', '==', options.purpose));
    }

    if (!options?.includeDeleted) {
      constraints.push(where('isDeleted', '!=', true));
    }

    const q = query(collection(db, COLLECTIONS.FILES), ...constraints);
    const querySnapshot = await getDocs(q);

    // 🏢 ENTERPRISE: Filter out invalid records with type guard validation
    const validRecords: FileRecord[] = [];
    for (const docSnap of querySnapshot.docs) {
      const data = docSnap.data();
      const record = {
        ...data,
        id: docSnap.id,
        createdAt: data.createdAt instanceof Object && 'toDate' in data.createdAt
          ? (data.createdAt as Timestamp).toDate().toISOString()
          : data.createdAt,
        updatedAt: data.updatedAt instanceof Object && 'toDate' in data.updatedAt
          ? (data.updatedAt as Timestamp).toDate().toISOString()
          : data.updatedAt,
      };

      if (isFileRecord(record)) {
        validRecords.push(record);
      } else {
        logger.warn('Skipping invalid FileRecord in query results', { docId: docSnap.id });
      }
    }

    return validRecords;
  }

  /**
   * Query FileRecords with flexible parameters
   * 🏢 ENTERPRISE: Uses isFileRecord() type guard for boundary validation
   */
  static async queryFileRecords(
    queryParams: FileRecordQuery
  ): Promise<FileRecord[]> {
    const constraints = [];

    if (queryParams.companyId) {
      constraints.push(where('companyId', '==', queryParams.companyId));
    }

    if (queryParams.projectId) {
      constraints.push(where('projectId', '==', queryParams.projectId));
    }

    if (queryParams.entityType) {
      constraints.push(where('entityType', '==', queryParams.entityType));
    }

    if (queryParams.entityId) {
      constraints.push(where('entityId', '==', queryParams.entityId));
    }

    if (queryParams.domain) {
      constraints.push(where('domain', '==', queryParams.domain));
    }

    if (queryParams.category) {
      constraints.push(where('category', '==', queryParams.category));
    }

    if (queryParams.status) {
      constraints.push(where('status', '==', queryParams.status));
    }

    if (!queryParams.includeDeleted) {
      constraints.push(where('isDeleted', '!=', true));
    }

    const q = query(collection(db, COLLECTIONS.FILES), ...constraints);
    const querySnapshot = await getDocs(q);

    // 🏢 ENTERPRISE: Filter out invalid records with type guard validation
    const validRecords: FileRecord[] = [];
    for (const docSnap of querySnapshot.docs) {
      const data = docSnap.data();
      const record = {
        ...data,
        id: docSnap.id,
        createdAt: data.createdAt instanceof Object && 'toDate' in data.createdAt
          ? (data.createdAt as Timestamp).toDate().toISOString()
          : data.createdAt,
        updatedAt: data.updatedAt instanceof Object && 'toDate' in data.updatedAt
          ? (data.updatedAt as Timestamp).toDate().toISOString()
          : data.updatedAt,
      };

      if (isFileRecord(record)) {
        validRecords.push(record);
      } else {
        logger.warn('Skipping invalid FileRecord in queryFileRecords', { docId: docSnap.id });
      }
    }

    return validRecords;
  }

  // ==========================================================================
  // 🗑️ ENTERPRISE TRASH SYSTEM - LIFECYCLE OPERATIONS
  // ==========================================================================
  // 3-tier lifecycle: Active → Trashed → Archived → Purged
  // @enterprise ADR-032 - Enterprise Trash System
  // ==========================================================================

  /**
   * Calculate purge date based on category retention policy
   * @enterprise Uses RETENTION_BY_CATEGORY from domain-constants
   */
  private static calculatePurgeDate(category: FileCategory): Date {
    const retentionDays = RETENTION_BY_CATEGORY[category] ?? DEFAULT_RETENTION_POLICIES.TRASH_RETENTION_DAYS;
    const purgeDate = new Date();
    purgeDate.setDate(purgeDate.getDate() + retentionDays);
    return purgeDate;
  }

  /**
   * 🗑️ Move file to Trash (soft delete)
   * @enterprise Replaces hard delete with 3-tier lifecycle
   *
   * What this does:
   * - Sets lifecycleState = 'trashed'
   * - Sets isDeleted = true (for backward compatibility)
   * - Records trashedAt, trashedBy
   * - Calculates purgeAt based on category retention policy
   *
   * File remains in Firestore and Storage until server-side purge runs.
   * User can restore from Trash view.
   *
   * @example
   * ```typescript
   * await FileRecordService.moveToTrash('file_123', 'user_abc');
   * ```
   */
  static async moveToTrash(fileId: string, trashedBy: string): Promise<void> {
    logger.info('Moving FileRecord to trash', { fileId, trashedBy });

    const docRef = doc(db, COLLECTIONS.FILES, fileId);

    // Get current record to determine retention policy
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      throw new Error(`FileRecord not found: ${fileId}`);
    }

    const data = docSnap.data();
    const category = data.category as FileCategory;
    const purgeDate = this.calculatePurgeDate(category);

    // 🏢 ENTERPRISE: Check if file has hold - cannot trash files with active holds
    if (data.hold && data.hold !== HOLD_TYPES.NONE) {
      throw new Error(`Cannot trash file ${fileId}: Active hold (${data.hold}) prevents deletion. Contact administrator.`);
    }

    await updateDoc(docRef, {
      // Lifecycle state
      lifecycleState: FILE_LIFECYCLE_STATES.TRASHED,
      // Trash metadata
      trashedAt: serverTimestamp(),
      trashedBy,
      purgeAt: purgeDate.toISOString(),
      // Legacy compatibility
      isDeleted: true,
      deletedAt: serverTimestamp(),
      deletedBy: trashedBy,
      // Audit
      updatedAt: serverTimestamp(),
    });

    logger.info('FileRecord moved to trash', {
      fileId,
      purgeAt: purgeDate.toISOString(),
      retentionDays: RETENTION_BY_CATEGORY[category] ?? DEFAULT_RETENTION_POLICIES.TRASH_RETENTION_DAYS,
    });

    // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
    RealtimeService.dispatch('FILE_TRASHED',{
      fileId,
      trashedBy,
      purgeAt: purgeDate.toISOString(),
      timestamp: Date.now(),
    });
  }

  /**
   * ♻️ Restore file from Trash
   * @enterprise Returns file to active state
   *
   * What this does:
   * - Sets lifecycleState = 'active'
   * - Clears isDeleted, trashedAt, trashedBy, purgeAt
   * - Records restoration in audit trail
   *
   * @example
   * ```typescript
   * await FileRecordService.restoreFromTrash('file_123', 'user_abc');
   * ```
   */
  static async restoreFromTrash(fileId: string, restoredBy: string): Promise<void> {
    logger.info('Restoring FileRecord from trash', { fileId, restoredBy });

    const docRef = doc(db, COLLECTIONS.FILES, fileId);

    // Verify file is in trash
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      throw new Error(`FileRecord not found: ${fileId}`);
    }

    const data = docSnap.data();
    if (data.lifecycleState !== FILE_LIFECYCLE_STATES.TRASHED && data.isDeleted !== true) {
      throw new Error(`FileRecord ${fileId} is not in trash`);
    }

    await updateDoc(docRef, {
      // Restore to active state
      lifecycleState: FILE_LIFECYCLE_STATES.ACTIVE,
      // Clear trash fields
      isDeleted: false,
      trashedAt: null,
      trashedBy: null,
      purgeAt: null,
      // Clear legacy fields
      deletedAt: null,
      deletedBy: null,
      // Audit
      restoredAt: serverTimestamp(),
      restoredBy,
      updatedAt: serverTimestamp(),
    });

    logger.info('FileRecord restored from trash', { fileId, restoredBy });

    // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
    RealtimeService.dispatch('FILE_RESTORED',{
      fileId,
      restoredBy,
      timestamp: Date.now(),
    });
  }

  /**
   * 📂 Get files in Trash for an entity
   * @enterprise Used in Trash view component
   */
  static async getTrashedFiles(options: {
    companyId: string;
    entityType?: EntityType;
    entityId?: string;
  }): Promise<FileRecord[]> {
    const constraints = [
      where('companyId', '==', options.companyId),
      where('isDeleted', '==', true),
    ];

    if (options.entityType) {
      constraints.push(where('entityType', '==', options.entityType));
    }

    if (options.entityId) {
      constraints.push(where('entityId', '==', options.entityId));
    }

    const q = query(collection(db, COLLECTIONS.FILES), ...constraints);
    const querySnapshot = await getDocs(q);

    const trashedFiles: FileRecord[] = [];
    for (const docSnap of querySnapshot.docs) {
      const data = docSnap.data();
      const record = {
        ...data,
        id: docSnap.id,
        createdAt: data.createdAt instanceof Object && 'toDate' in data.createdAt
          ? (data.createdAt as Timestamp).toDate().toISOString()
          : data.createdAt,
        trashedAt: data.trashedAt instanceof Object && 'toDate' in data.trashedAt
          ? (data.trashedAt as Timestamp).toDate().toISOString()
          : data.trashedAt,
      };

      if (isFileRecord(record)) {
        trashedFiles.push(record);
      }
    }

    return trashedFiles;
  }

  /**
   * 📋 Get files eligible for purge
   * @enterprise Used by server-side scheduler (Cloud Function)
   *
   * Returns files where:
   * - lifecycleState = 'trashed' OR isDeleted = true
   * - purgeAt <= now
   * - hold = 'none' OR hold is null
   * - retentionUntil <= now OR retentionUntil is null
   */
  static async getFilesEligibleForPurge(): Promise<FileRecord[]> {
    const now = new Date().toISOString();

    // Query trashed files with expired purgeAt
    // Note: Firestore doesn't support complex OR queries, so we use isDeleted
    const constraints = [
      where('isDeleted', '==', true),
      where('purgeAt', '<=', now),
    ];

    const q = query(collection(db, COLLECTIONS.FILES), ...constraints);
    const querySnapshot = await getDocs(q);

    const eligibleFiles: FileRecord[] = [];
    for (const docSnap of querySnapshot.docs) {
      const data = docSnap.data();

      // Additional filtering in code (Firestore limitations)
      // Check hold status
      if (data.hold && data.hold !== HOLD_TYPES.NONE) {
        logger.info('Skipping file with active hold', { fileId: docSnap.id, hold: data.hold });
        continue;
      }

      // Check retention policy
      if (data.retentionUntil) {
        const retentionDate = new Date(data.retentionUntil);
        if (retentionDate > new Date()) {
          logger.info('Skipping file with active retention', { fileId: docSnap.id, retentionUntil: data.retentionUntil });
          continue;
        }
      }

      const record = {
        ...data,
        id: docSnap.id,
      };

      if (isFileRecord(record)) {
        eligibleFiles.push(record);
      }
    }

    logger.info('Found files eligible for purge', { count: eligibleFiles.length });
    return eligibleFiles;
  }

  /**
   * 🔒 Place hold on file (prevents deletion)
   * @enterprise For legal/regulatory compliance
   */
  static async placeHold(
    fileId: string,
    holdType: HoldType,
    placedBy: string,
    reason: string
  ): Promise<void> {
    logger.info('Placing hold on FileRecord', { fileId, holdType, placedBy, reason });

    const docRef = doc(db, COLLECTIONS.FILES, fileId);

    await updateDoc(docRef, {
      hold: holdType,
      holdPlacedBy: placedBy,
      holdPlacedAt: serverTimestamp(),
      holdReason: reason,
      updatedAt: serverTimestamp(),
    });

    logger.info('Hold placed on FileRecord', { fileId, holdType });
  }

  /**
   * 🔓 Release hold on file
   * @enterprise Allows file to be deleted again
   */
  static async releaseHold(fileId: string, releasedBy: string): Promise<void> {
    logger.info('Releasing hold on FileRecord', { fileId, releasedBy });

    const docRef = doc(db, COLLECTIONS.FILES, fileId);

    await updateDoc(docRef, {
      hold: HOLD_TYPES.NONE,
      holdReleasedBy: releasedBy,
      holdReleasedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    logger.info('Hold released on FileRecord', { fileId });
  }

  // ==========================================================================
  // LEGACY DELETE OPERATIONS (deprecated - use moveToTrash)
  // ==========================================================================

  /**
   * @deprecated Use moveToTrash() instead for enterprise trash lifecycle
   * Kept for backward compatibility
   */
  static async softDeleteFileRecord(
    fileId: string,
    deletedBy: string
  ): Promise<void> {
    logger.warn('softDeleteFileRecord is deprecated, use moveToTrash instead', { fileId });
    return this.moveToTrash(fileId, deletedBy);
  }

  // ==========================================================================
  // UTILITY OPERATIONS
  // ==========================================================================

  /**
   * Check if a file with the same hash already exists
   * Useful for deduplication
   * 🏢 ENTERPRISE: Uses isFileRecord() type guard for boundary validation
   */
  static async findByHash(
    hash: string,
    companyId?: string
  ): Promise<FileRecord | null> {
    const constraints = [
      where('hash', '==', hash),
      where('status', '==', FILE_STATUS.READY),
      where('isDeleted', '!=', true),
    ];

    if (companyId) {
      constraints.push(where('companyId', '==', companyId));
    }

    const q = query(collection(db, COLLECTIONS.FILES), ...constraints);
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return null;
    }

    const docSnap = querySnapshot.docs[0];
    const data = docSnap.data();
    const record = {
      ...data,
      id: docSnap.id,
    };

    // 🏢 ENTERPRISE: Validate data shape at Firestore boundary
    if (!isFileRecord(record)) {
      logger.warn('Invalid FileRecord data from findByHash', { hash, docId: docSnap.id });
      return null;
    }

    return record;
  }

  /**
   * Get total storage used by an entity
   */
  static async getStorageUsedByEntity(
    entityType: EntityType,
    entityId: string
  ): Promise<number> {
    const files = await this.getFilesByEntity(entityType, entityId);
    return files.reduce((total, file) => total + (file.sizeBytes || 0), 0);
  }
}
