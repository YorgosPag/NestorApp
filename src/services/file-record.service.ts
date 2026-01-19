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
  FILE_STATUS,
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
  buildStoragePath,
  generateFileId,
  getFileExtension,
} from '@/services/upload';
import {
  buildFileDisplayName,
  ensureFilesNamespaceLoaded,
} from '@/services/upload/utils/file-display-name';
import { createModuleLogger } from '@/lib/telemetry';

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
   * 🏢 ENTERPRISE: displayName is generated CENTRALLY by this function.
   * It does NOT accept raw displayName - only naming context (entityLabel, purpose, etc.)
   * This enforces SINGLE NAMING AUTHORITY (ADR-031).
   */
  static async createPendingFileRecord(
    input: CreateFileRecordInput
  ): Promise<CreateFileRecordResult> {
    // 🏢 ENTERPRISE: Ensure i18n namespace is loaded for naming
    await ensureFilesNamespaceLoaded();

    // Generate unique file ID
    const fileId = generateFileId();

    // Get extension from originalFilename if not provided
    const ext = input.ext || getFileExtension(input.originalFilename);

    // =========================================================================
    // 🏢 ENTERPRISE: CENTRALIZED NAMING - Single Authority
    // =========================================================================
    // displayName is generated here, NOT accepted from external input
    // This ensures consistent naming across ALL entry points
    const namingResult = buildFileDisplayName({
      entityType: input.entityType,
      entityId: input.entityId,
      domain: input.domain,
      category: input.category,
      entityLabel: input.entityLabel,
      purpose: input.purpose,
      descriptors: input.descriptors,
      occurredAt: input.occurredAt,
      revision: input.revision,
      ext,
      originalFilename: input.originalFilename,
      customTitle: input.customTitle, // 🏢 ENTERPRISE: Custom title για "Άλλο Έγγραφο" (ΤΕΛΕΙΩΤΙΚΗ ΕΝΤΟΛΗ)
    });

    const displayName = namingResult.displayName;

    logger.info('Creating pending FileRecord with centralized naming', {
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

    // Build canonical storage path (IDs only, no Greek names)
    const { path: storagePath } = buildStoragePath({
      companyId: input.companyId,
      projectId: input.projectId,
      entityType: input.entityType,
      entityId: input.entityId,
      domain: input.domain,
      category: input.category,
      fileId,
      ext,
    });

    // Create FileRecord document
    // 🏢 ENTERPRISE: Validate REQUIRED fields before creating object
    if (!input.companyId) {
      throw new Error('companyId is REQUIRED for creating FileRecord');
    }
    if (!input.createdBy) {
      throw new Error('createdBy is REQUIRED for creating FileRecord');
    }

    const fileRecord: FileRecord = {
      id: fileId,
      companyId: input.companyId, // 🏢 REQUIRED for multi-tenant isolation
      ...(input.projectId && { projectId: input.projectId }), // 🏢 ENTERPRISE: Only include if defined (Firestore rejects undefined)
      entityType: input.entityType,
      entityId: input.entityId,
      domain: input.domain,
      category: input.category,
      storagePath,
      displayName, // 🏢 ENTERPRISE: Generated centrally, not from input
      originalFilename: input.originalFilename,
      ext,
      contentType: input.contentType,
      status: FILE_STATUS.PENDING,
      isDeleted: false, // 🏢 ENTERPRISE: REQUIRED - Firestore queries with '!=' exclude docs without the field
      createdAt: new Date().toISOString(),
      createdBy: input.createdBy,
      ...(input.revision && { revision: input.revision }), // 🏢 ENTERPRISE: Only include if defined
    };

    // Write to Firestore
    const docRef = doc(db, COLLECTIONS.FILES, fileId);
    const docData = {
      ...fileRecord,
      createdAt: serverTimestamp(), // Use server timestamp for consistency
    };

    try {
      await setDoc(docRef, docData);

      logger.info('Pending FileRecord created', {
        fileId,
        storagePath,
        displayName,
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

    // Update with final data
    // 🏢 ENTERPRISE: Build update object without undefined fields (Firestore rejects undefined)
    const updateData: Record<string, unknown> = {
      status: FILE_STATUS.READY,
      sizeBytes: input.sizeBytes,
      downloadUrl: input.downloadUrl,
      updatedAt: serverTimestamp(),
    };

    // Only include hash if provided (optional field)
    if (input.hash !== undefined) {
      updateData.hash = input.hash;
    }

    await updateDoc(docRef, updateData);

    logger.info('FileRecord finalized successfully', {
      fileId: input.fileId,
      status: FILE_STATUS.READY,
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
  // DELETE OPERATIONS
  // ==========================================================================

  /**
   * Soft delete a FileRecord
   * Sets isDeleted flag but keeps the document for audit trail
   */
  static async softDeleteFileRecord(
    fileId: string,
    deletedBy: string
  ): Promise<void> {
    logger.info('Soft deleting FileRecord', { fileId, deletedBy });

    const docRef = doc(db, COLLECTIONS.FILES, fileId);

    await updateDoc(docRef, {
      isDeleted: true,
      deletedAt: serverTimestamp(),
      deletedBy,
      updatedAt: serverTimestamp(),
    });

    logger.info('FileRecord soft deleted');
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
