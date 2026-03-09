/**
 * =============================================================================
 * 🏢 ENTERPRISE: File Version Service
 * =============================================================================
 *
 * Manages file version history using Firestore subcollections.
 * Each file can have multiple versions stored in `files/{fileId}/versions`.
 *
 * Architecture:
 * - FileRecord holds current/latest version data
 * - On new version upload, previous state is saved to subcollection
 * - Rollback restores a previous version to the main FileRecord
 *
 * @module services/file-version.service
 * @enterprise ADR-191 - Enterprise Document Management System (Phase 2.3)
 */

import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  collection,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { FileRecord } from '@/types/file-record';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('FileVersionService');

// ============================================================================
// TYPES
// ============================================================================

/** Snapshot of a file version stored in subcollection */
export interface FileVersionSnapshot {
  /** Version ID (auto-generated) */
  id: string;
  /** Version number (1-based, sequential) */
  versionNumber: number;
  /** Firebase Storage download URL for this version */
  downloadUrl: string;
  /** Firebase Storage path for this version */
  storagePath: string;
  /** File size in bytes */
  sizeBytes: number;
  /** Content type */
  contentType: string;
  /** Original filename at time of upload */
  originalFilename: string;
  /** File extension */
  ext: string;
  /** Optional content hash */
  hash?: string;
  /** Who uploaded this version */
  createdBy: string;
  /** When this version was created */
  createdAt: Date | string;
  /** Optional note describing the change */
  changeNote?: string;
}

/** Input for creating a new version */
export interface CreateVersionInput {
  /** File ID to version */
  fileId: string;
  /** New download URL */
  downloadUrl: string;
  /** New storage path */
  storagePath: string;
  /** New file size */
  sizeBytes: number;
  /** New content type */
  contentType: string;
  /** New original filename */
  originalFilename: string;
  /** New extension */
  ext: string;
  /** Optional content hash */
  hash?: string;
  /** Who is uploading */
  createdBy: string;
  /** Optional change note */
  changeNote?: string;
}

// ============================================================================
// SUBCOLLECTION NAME
// ============================================================================

const VERSIONS_SUBCOLLECTION = 'versions';

// ============================================================================
// SERVICE
// ============================================================================

export class FileVersionService {
  /**
   * Create a new version of a file.
   *
   * Flow:
   * 1. Read current FileRecord state
   * 2. Save current state as version snapshot in subcollection
   * 3. Update FileRecord with new file data + increment revision
   *
   * @returns The new version number
   */
  static async createNewVersion(input: CreateVersionInput): Promise<number> {
    const { fileId } = input;

    // 1. Read current FileRecord
    const fileRef = doc(db, COLLECTIONS.FILES, fileId);
    const fileSnap = await getDoc(fileRef);

    if (!fileSnap.exists()) {
      throw new Error(`FileRecord not found: ${fileId}`);
    }

    const currentData = fileSnap.data() as FileRecord;
    const currentRevision = currentData.revision ?? 1;
    const newRevision = currentRevision + 1;

    // 2. Save current state as version snapshot
    const versionId = `v${String(currentRevision).padStart(4, '0')}`;
    const versionsRef = collection(db, COLLECTIONS.FILES, fileId, VERSIONS_SUBCOLLECTION);
    const versionDocRef = doc(versionsRef, versionId);

    const snapshot: Omit<FileVersionSnapshot, 'id'> = {
      versionNumber: currentRevision,
      downloadUrl: currentData.downloadUrl ?? '',
      storagePath: currentData.storagePath,
      sizeBytes: currentData.sizeBytes ?? 0,
      contentType: currentData.contentType,
      originalFilename: currentData.originalFilename,
      ext: currentData.ext,
      hash: currentData.hash ?? undefined,
      createdBy: currentData.createdBy,
      createdAt: currentData.createdAt,
    };

    // Remove undefined values for Firestore
    const cleanSnapshot: Record<string, unknown> = { id: versionId };
    for (const [key, value] of Object.entries(snapshot)) {
      if (value !== undefined) {
        cleanSnapshot[key] = value;
      }
    }

    await setDoc(versionDocRef, cleanSnapshot);

    logger.info('Saved version snapshot', { fileId, versionId, revision: currentRevision });

    // 3. Update FileRecord with new data
    const updateData: Record<string, unknown> = {
      downloadUrl: input.downloadUrl,
      storagePath: input.storagePath,
      sizeBytes: input.sizeBytes,
      contentType: input.contentType,
      originalFilename: input.originalFilename,
      ext: input.ext,
      revision: newRevision,
      updatedAt: serverTimestamp(),
    };

    if (input.hash) {
      updateData.hash = input.hash;
    }

    await updateDoc(fileRef, updateData);

    logger.info('FileRecord updated to new version', { fileId, newRevision });

    return newRevision;
  }

  /**
   * Get all version snapshots for a file, ordered by version number.
   */
  static async getVersionHistory(fileId: string): Promise<FileVersionSnapshot[]> {
    const versionsRef = collection(db, COLLECTIONS.FILES, fileId, VERSIONS_SUBCOLLECTION);
    const q = query(versionsRef, orderBy('versionNumber', 'asc'));
    const snap = await getDocs(q);

    return snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as FileVersionSnapshot[];
  }

  /**
   * Get version count for a file (without fetching all data).
   */
  static async getVersionCount(fileId: string): Promise<number> {
    const versionsRef = collection(db, COLLECTIONS.FILES, fileId, VERSIONS_SUBCOLLECTION);
    const snap = await getDocs(versionsRef);
    return snap.size;
  }

  /**
   * Rollback a file to a specific version.
   *
   * Flow:
   * 1. Read the target version snapshot
   * 2. Save current state as a new version (so rollback is reversible)
   * 3. Restore target version data to FileRecord
   */
  static async rollbackToVersion(
    fileId: string,
    targetVersionNumber: number,
    performedBy: string,
  ): Promise<number> {
    // 1. Find target version
    const versionsRef = collection(db, COLLECTIONS.FILES, fileId, VERSIONS_SUBCOLLECTION);
    const versionId = `v${String(targetVersionNumber).padStart(4, '0')}`;
    const versionDocRef = doc(versionsRef, versionId);
    const versionSnap = await getDoc(versionDocRef);

    if (!versionSnap.exists()) {
      throw new Error(`Version ${targetVersionNumber} not found for file ${fileId}`);
    }

    const targetVersion = versionSnap.data() as FileVersionSnapshot;

    // 2. Save current state as new version (rollback is reversible)
    const fileRef = doc(db, COLLECTIONS.FILES, fileId);
    const currentSnap = await getDoc(fileRef);

    if (!currentSnap.exists()) {
      throw new Error(`FileRecord not found: ${fileId}`);
    }

    const currentData = currentSnap.data() as FileRecord;
    const currentRevision = currentData.revision ?? 1;
    const rollbackRevision = currentRevision + 1;

    // Save current as version before rollback
    const saveVersionId = `v${String(currentRevision).padStart(4, '0')}`;
    const saveVersionRef = doc(versionsRef, saveVersionId);

    const saveSnapshot: Record<string, unknown> = {
      id: saveVersionId,
      versionNumber: currentRevision,
      downloadUrl: currentData.downloadUrl ?? '',
      storagePath: currentData.storagePath,
      sizeBytes: currentData.sizeBytes ?? 0,
      contentType: currentData.contentType,
      originalFilename: currentData.originalFilename,
      ext: currentData.ext,
      createdBy: currentData.createdBy,
      createdAt: currentData.createdAt,
      changeNote: `Before rollback to v${targetVersionNumber}`,
    };

    await setDoc(saveVersionRef, saveSnapshot);

    // 3. Restore target version
    const restoreData: Record<string, unknown> = {
      downloadUrl: targetVersion.downloadUrl,
      storagePath: targetVersion.storagePath,
      sizeBytes: targetVersion.sizeBytes,
      contentType: targetVersion.contentType,
      originalFilename: targetVersion.originalFilename,
      ext: targetVersion.ext,
      revision: rollbackRevision,
      updatedAt: serverTimestamp(),
    };

    await updateDoc(fileRef, restoreData);

    logger.info('Rolled back file to version', {
      fileId,
      targetVersion: targetVersionNumber,
      newRevision: rollbackRevision,
      performedBy,
    });

    return rollbackRevision;
  }
}
