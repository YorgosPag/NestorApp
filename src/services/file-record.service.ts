/**
 * =============================================================================
 * 🏢 ENTERPRISE FILE RECORD SERVICE
 * =============================================================================
 *
 * Firestore service for managing FileRecord documents.
 * This is the Source of Truth for file metadata - Storage holds binaries only.
 *
 * Lifecycle operations: ./file-record-lifecycle.ts
 * Link & update operations: ./file-record-links.ts
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
  where,
  serverTimestamp,
  type DocumentData,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { fieldToISO } from '@/lib/date-local';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import {
  type EntityType,
  type FileDomain,
  type FileCategory,
  FILE_LIFECYCLE_STATES,
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
  ensureFilesNamespaceLoaded,
} from '@/services/upload/utils/file-display-name';
import {
  buildPendingFileRecordData,
  buildFinalizeFileRecordUpdate,
  type BuildPendingFileRecordInput,
} from '@/services/file-record';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { RealtimeService } from '@/services/realtime';

// 🏢 ENTERPRISE: SRP-compliant modules (ADR-065)
import {
  moveToTrash,
  restoreFromTrash,
  getTrashedFiles,
  getFilesEligibleForPurge,
  placeHold,
  releaseHold,
} from '@/services/file-record-lifecycle';
import {
  linkFileToEntity,
  unlinkFileFromEntity,
  getLinkedFiles,
  renameFile,
  updateDescription,
  findByHash,
} from '@/services/file-record-links';

const logger = createModuleLogger('FILE_RECORD');

// ============================================================================
// POST-QUERY NORMALIZATION HELPER (ADR-214 Phase 3)
// ============================================================================

function toFileRecord(raw: DocumentData): FileRecord | null {
  const record = {
    ...raw,
    id: raw.id as string,
    createdAt: fieldToISO(raw as Record<string, unknown>, 'createdAt') || raw.createdAt,
    updatedAt: fieldToISO(raw as Record<string, unknown>, 'updatedAt') || raw.updatedAt,
  };
  return isFileRecord(record) ? record : null;
}

// ============================================================================
// FILE RECORD SERVICE
// ============================================================================

export class FileRecordService {
  static isVisibleInActiveLists(file: Pick<FileRecord, 'lifecycleState' | 'isDeleted'>): boolean {
    if (file.isDeleted) return false;
    return (file.lifecycleState ?? FILE_LIFECYCLE_STATES.ACTIVE) === FILE_LIFECYCLE_STATES.ACTIVE;
  }

  // ==========================================================================
  // CREATE OPERATIONS
  // ==========================================================================

  /**
   * Step A: Create pending FileRecord (before binary upload)
   * 🏢 ENTERPRISE: Uses SSoT core module for schema construction.
   */
  static async createPendingFileRecord(
    input: CreateFileRecordInput
  ): Promise<CreateFileRecordResult> {
    await ensureFilesNamespaceLoaded();

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
      linkedTo: input.linkedTo,
      levelFloorId: input.levelFloorId,
      language: 'el',
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

    const fileRecord: FileRecord = {
      ...recordBase,
      createdAt: new Date().toISOString(),
    };

    const docRef = doc(db, COLLECTIONS.FILES, fileId);
    const docData = {
      ...recordBase,
      createdAt: serverTimestamp(),
    };

    try {
      await setDoc(docRef, docData);

      logger.info('Pending FileRecord created', { fileId, storagePath, displayName });

      RealtimeService.dispatch('FILE_CREATED', {
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
        error: getErrorMessage(error),
      });
      throw error;
    }

    return { fileId, storagePath, displayName, fileRecord };
  }

  // ==========================================================================
  // FINALIZE OPERATIONS
  // ==========================================================================

  /**
   * Step C: Finalize FileRecord (after successful binary upload)
   * 🏢 ENTERPRISE: Uses SSoT core module for update construction.
   */
  static async finalizeFileRecord(input: FinalizeFileRecordInput): Promise<void> {
    logger.info('Finalizing FileRecord', {
      fileId: input.fileId,
      sizeBytes: input.sizeBytes,
      hasDownloadUrl: !!input.downloadUrl,
    });

    const docRef = doc(db, COLLECTIONS.FILES, input.fileId);

    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      throw new Error(`FileRecord not found: ${input.fileId}`);
    }

    const coreUpdate = buildFinalizeFileRecordUpdate({
      sizeBytes: input.sizeBytes,
      downloadUrl: input.downloadUrl,
      hash: input.hash,
      thumbnailUrl: input.thumbnailUrl,
      nextStatus: FILE_STATUS.READY,
    });

    const updateData: Record<string, unknown> = {
      ...coreUpdate,
      updatedAt: serverTimestamp(),
    };

    await updateDoc(docRef, updateData);

    logger.info('FileRecord finalized successfully', {
      fileId: input.fileId,
      status: coreUpdate.status,
    });

    RealtimeService.dispatch('FILE_UPDATED', {
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
    logger.warn('Marking FileRecord as failed', { fileId, errorMessage });

    const docRef = doc(db, COLLECTIONS.FILES, fileId);

    await updateDoc(docRef, {
      status: FILE_STATUS.FAILED,
      updatedAt: serverTimestamp(),
    });

    logger.info('FileRecord marked as failed');
  }

  // ==========================================================================
  // READ OPERATIONS
  // ==========================================================================

  /**
   * Get a single FileRecord by ID
   * 🏢 ADR-214 Phase 3: via FirestoreQueryService
   */
  static async getFileRecord(fileId: string): Promise<FileRecord | null> {
    const raw = await firestoreQueryService.getById<DocumentData>('FILES', fileId);
    if (!raw) return null;

    const record = toFileRecord(raw);
    if (!record) {
      logger.warn('Invalid FileRecord data from Firestore', { fileId });
      return null;
    }

    return record;
  }

  /**
   * Query FileRecords by entity
   * 🏢 ADR-214 Phase 3: via FirestoreQueryService
   */
  static async getFilesByEntity(
    entityType: EntityType,
    entityId: string,
    options?: {
      domain?: FileDomain;
      category?: FileCategory;
      purpose?: string;
      levelFloorId?: string;
      includeDeleted?: boolean;
      companyId?: string;
    }
  ): Promise<FileRecord[]> {
    const constraints = [
      where('entityType', '==', entityType),
      where('entityId', '==', entityId),
      where('status', '==', FILE_STATUS.READY),
    ];

    // 🔒 SECURITY: companyId constraint required for Firestore Security Rules
    // Rules enforce belongsToCompany(resource.data.companyId) — without this
    // filter, queries fail with PERMISSION_DENIED for non-super-admin users.
    if (options?.companyId) {
      constraints.push(where('companyId', '==', options.companyId));
    }

    if (options?.domain) {
      constraints.push(where('domain', '==', options.domain));
    }

    if (options?.category) {
      constraints.push(where('category', '==', options.category));
    }

    if (options?.purpose) {
      constraints.push(where('purpose', '==', options.purpose));
    }

    if (options?.levelFloorId) {
      constraints.push(where('levelFloorId', '==', options.levelFloorId));
    }

    if (!options?.includeDeleted) {
      constraints.push(where('isDeleted', '==', false));
      constraints.push(where('lifecycleState', '==', FILE_LIFECYCLE_STATES.ACTIVE));
    }

    const result = await firestoreQueryService.getAll<DocumentData>('FILES', { constraints });

    const validRecords: FileRecord[] = [];
    for (const raw of result.documents) {
      const record = toFileRecord(raw);
      if (record) {
        validRecords.push(record);
      } else {
        logger.warn('Skipping invalid FileRecord in query results', { docId: raw.id });
      }
    }

    return validRecords;
  }

  /**
   * Query FileRecords with flexible parameters
   * 🏢 ADR-214 Phase 3: via FirestoreQueryService
   */
  static async queryFileRecords(
    queryParams: FileRecordQuery
  ): Promise<FileRecord[]> {
    const constraints = [];

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
      constraints.push(where('isDeleted', '==', false));
      constraints.push(where('lifecycleState', '==', FILE_LIFECYCLE_STATES.ACTIVE));
    }

    const result = await firestoreQueryService.getAll<DocumentData>('FILES', { constraints });

    const validRecords: FileRecord[] = [];
    for (const raw of result.documents) {
      const record = toFileRecord(raw);
      if (record) {
        validRecords.push(record);
      } else {
        logger.warn('Skipping invalid FileRecord in queryFileRecords', { docId: raw.id });
      }
    }

    return validRecords;
  }

  // ==========================================================================
  // DELEGATED OPERATIONS (SRP modules — ADR-065)
  // ==========================================================================

  /** 🗑️ Move file to Trash (soft delete) — @see file-record-lifecycle.ts */
  static moveToTrash = moveToTrash;

  /** ♻️ Restore file from Trash — @see file-record-lifecycle.ts */
  static restoreFromTrash = restoreFromTrash;

  /** 📂 Get files in Trash — @see file-record-lifecycle.ts */
  static getTrashedFiles = getTrashedFiles;

  /** 📋 Get files eligible for purge — @see file-record-lifecycle.ts */
  static getFilesEligibleForPurge = getFilesEligibleForPurge;

  /** 🔒 Place hold on file — @see file-record-lifecycle.ts */
  static placeHold = placeHold;

  /** 🔓 Release hold on file — @see file-record-lifecycle.ts */
  static releaseHold = releaseHold;

  /** 🔗 Link file to entity — @see file-record-links.ts */
  static linkFileToEntity = linkFileToEntity;

  /** 🔗 Unlink file from entity — @see file-record-links.ts */
  static unlinkFileFromEntity = unlinkFileFromEntity;

  /** 🔗 Get linked files — @see file-record-links.ts */
  static getLinkedFiles = getLinkedFiles;

  /** Rename file display name — @see file-record-links.ts */
  static renameFile = renameFile;

  /** Update file description — @see file-record-links.ts */
  static updateDescription = updateDescription;

  /** Find file by hash — @see file-record-links.ts */
  static findByHash = findByHash;

  /** @deprecated Use moveToTrash() instead */
  static async softDeleteFileRecord(fileId: string, deletedBy: string): Promise<void> {
    logger.warn('softDeleteFileRecord is deprecated, use moveToTrash instead', { fileId });
    return moveToTrash(fileId, deletedBy);
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
