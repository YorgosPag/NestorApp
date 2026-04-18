'use client';

/**
 * =============================================================================
 * 🏢 ADR-292: Upload Orchestrator Gateway
 * =============================================================================
 *
 * Encapsulates the canonical 4-step upload pattern:
 *   validateAuth → createPending → [delay] → upload → getDownloadURL → [thumbnail] → finalize
 *
 * This eliminates 3x duplication of the upload pipeline across hooks.
 * Hooks become thin UI-state wrappers; all upload logic lives here.
 *
 * Does NOT handle: compression (photo-specific), processing delegation
 * (floorplan-specific), AI classification (entity-file-specific).
 *
 * @module services/filesystem/upload-orchestrator-gateway
 * @enterprise ADR-292 — Floorplan Upload Consolidation Map
 */

import { ref, uploadBytes, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import {
  validateUploadAuth,
  createPendingFileRecordWithPolicy,
  finalizeFileRecordWithPolicy,
  markFileRecordFailedWithPolicy,
} from '@/services/filesystem/file-mutation-gateway';
import {
  generateUploadThumbnail,
  buildThumbnailPath,
} from '@/components/shared/files/utils/generate-upload-thumbnail';
import type { EntityType, FileDomain, FileCategory } from '@/config/domain-constants';
import type { FileRecord } from '@/types/file-record';
import { getErrorMessage } from '@/lib/error-utils';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('upload-orchestrator-gateway');

// ============================================================================
// Types
// ============================================================================

export interface UploadFileConfig {
  // Required: FileRecord creation
  companyId: string;
  entityType: EntityType;
  entityId: string;
  domain: FileDomain;
  category: FileCategory;
  originalFilename: string;
  ext: string;
  contentType: string;
  createdBy: string;

  // Optional: FileRecord creation
  projectId?: string;
  entityLabel?: string;
  purpose?: string;
  descriptors?: string[];
  revision?: number;
  linkedTo?: Array<{ entityType: EntityType; entityId: string }>;

  // Optional: upload behavior
  firestoreDelayMs?: number;
  generateThumbnail?: boolean;
  useResumable?: boolean;
  onProgress?: (progress: UploadProgress) => void;
}

export interface UploadProgress {
  percent: number;
  phase: 'auth' | 'creating' | 'uploading' | 'finalizing' | 'complete';
  bytesTransferred?: number;
  totalBytes?: number;
}

export interface UploadFileResult {
  fileId: string;
  storagePath: string;
  downloadUrl: string;
  thumbnailUrl?: string;
  fileRecord: FileRecord;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_FIRESTORE_DELAY_MS = 300;

// ============================================================================
// Core Upload Function
// ============================================================================

/**
 * Canonical file upload — SSoT for the 4-step pattern (ADR-292).
 *
 * Steps:
 * 1. Validate auth (companyId claim check)
 * 2. Create pending FileRecord via gateway
 * 3. Upload binary to Firebase Storage
 * 4. Finalize FileRecord with downloadUrl
 *
 * On failure: auto-marks FileRecord as failed.
 */
export async function uploadFileWithPolicy(
  file: File | Blob,
  config: UploadFileConfig,
): Promise<UploadFileResult> {
  const { onProgress } = config;

  // Step 1: Auth validation
  await validateUploadAuth(config.companyId);
  onProgress?.({ percent: 5, phase: 'auth' });

  // Step 2: Create pending FileRecord
  const { fileId, storagePath, fileRecord } = await createPendingFileRecordWithPolicy({
    companyId: config.companyId,
    projectId: config.projectId,
    entityType: config.entityType,
    entityId: config.entityId,
    domain: config.domain,
    category: config.category,
    entityLabel: config.entityLabel,
    purpose: config.purpose,
    descriptors: config.descriptors,
    revision: config.revision,
    linkedTo: config.linkedTo?.map((l) => `${l.entityType}:${l.entityId}`),
    originalFilename: config.originalFilename,
    ext: config.ext,
    contentType: config.contentType,
    createdBy: config.createdBy,
  });

  onProgress?.({ percent: 10, phase: 'creating' });
  logger.info('Pending FileRecord created', { fileId, storagePath });

  // Step 2.5: Optional Firestore propagation delay
  const delay = config.firestoreDelayMs ?? DEFAULT_FIRESTORE_DELAY_MS;
  if (delay > 0) {
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  try {
    // Step 3: Upload binary to Storage
    const storageRef = ref(storage, storagePath);
    let downloadUrl: string;

    if (config.useResumable) {
      downloadUrl = await uploadResumable(storageRef, file, config);
    } else {
      await uploadBytes(storageRef, file);
      onProgress?.({ percent: 80, phase: 'uploading' });
      downloadUrl = await getDownloadURL(storageRef);
    }

    logger.info('Binary uploaded', { fileId, storagePath });

    // Step 3.5: Optional thumbnail
    let thumbnailUrl: string | undefined;
    if (config.generateThumbnail && file instanceof File) {
      thumbnailUrl = await generateAndUploadThumbnail(
        file, config.contentType, storagePath,
      );
    }

    // Step 4: Finalize FileRecord
    onProgress?.({ percent: 90, phase: 'finalizing' });
    await finalizeFileRecordWithPolicy({
      fileId,
      sizeBytes: file.size,
      downloadUrl,
      thumbnailUrl,
    });

    logger.info('FileRecord finalized', { fileId });
    onProgress?.({ percent: 100, phase: 'complete' });

    return { fileId, storagePath, downloadUrl, thumbnailUrl, fileRecord };
  } catch (error) {
    logger.error('Upload failed, marking FileRecord as failed', {
      fileId, error: getErrorMessage(error),
    });
    await markFileRecordFailedWithPolicy(fileId, getErrorMessage(error));
    throw error;
  }
}

// ============================================================================
// Internal Helpers
// ============================================================================

/** Resumable upload with progress tracking */
async function uploadResumable(
  storageRef: ReturnType<typeof ref>,
  file: File | Blob,
  config: UploadFileConfig,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const pct = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        const overallPercent = 10 + (pct * 0.7); // 10-80% range
        config.onProgress?.({
          percent: Math.round(overallPercent),
          phase: 'uploading',
          bytesTransferred: snapshot.bytesTransferred,
          totalBytes: snapshot.totalBytes,
        });
      },
      (error) => reject(error),
      async () => {
        try {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(url);
        } catch (error) {
          reject(error);
        }
      },
    );
  });
}

/** Generate thumbnail and upload — non-blocking on failure */
async function generateAndUploadThumbnail(
  file: File,
  contentType: string,
  storagePath: string,
): Promise<string | undefined> {
  try {
    const thumbBlob = await generateUploadThumbnail(file, contentType);
    if (!thumbBlob) return undefined;

    const thumbPath = buildThumbnailPath(storagePath);
    const thumbRef = ref(storage, thumbPath);
    await uploadBytes(thumbRef, thumbBlob, { contentType: 'image/webp' });
    return await getDownloadURL(thumbRef);
  } catch {
    logger.warn('Thumbnail generation failed (non-blocking)', { storagePath });
    return undefined;
  }
}
