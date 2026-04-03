/**
 * =============================================================================
 * 🏢 ENTERPRISE: Floorplan Upload Hook
 * =============================================================================
 *
 * Custom hook for uploading floorplan files (DXF/PDF) with automatic processing.
 * Follows EntityFilesManager pattern + adds FloorplanProcessor step.
 *
 * @module hooks/useFloorplanUpload
 * @enterprise ADR-033 - Floorplan Processing Pipeline
 *
 * Security Model (Storage Rules requirements):
 * - belongsToCompany() → User must have companyId custom claim matching path
 * - hasPendingFileRecord() → FileRecord must exist with status='pending'
 * - fileRecordMatchesPathWithProject() → FileRecord fields must match path
 * - storagePathEquals() → FileRecord.storagePath must match exactly
 */

'use client';

import { useState, useCallback } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage, auth } from '@/lib/firebase';
import {
  createPendingFileRecordWithPolicy,
  finalizeFileRecordWithPolicy,
} from '@/services/filesystem/file-mutation-gateway';
import { isFloorplanFile } from '@/services/floorplans/FloorplanProcessor';
import type { FileRecord } from '@/types/file-record';
import type { EntityType, FileDomain, FileCategory } from '@/config/domain-constants';
import { API_ROUTES } from '@/config/domain-constants';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('useFloorplanUpload');

// ============================================================================
// TYPES
// ============================================================================

export interface FloorplanUploadConfig {
  companyId: string;
  projectId?: string;
  entityType: EntityType;
  entityId: string;
  domain: FileDomain;
  category: FileCategory;
  userId: string;
  entityLabel?: string;
  purpose?: string;
  /** For multi-level units: which level/floor this floorplan belongs to (ADR-236) */
  levelFloorId?: string;
  /** Cross-entity visibility — parent entity links (e.g., 'floor:flr_xxx') */
  linkedTo?: string[];
}

export interface FloorplanUploadResult {
  success: boolean;
  fileRecord?: FileRecord;
  error?: string;
  errorCode?: UploadErrorCode;
}

export type UploadErrorCode =
  | 'AUTH_NOT_AUTHENTICATED'
  | 'AUTH_MISSING_COMPANY_CLAIM'
  | 'AUTH_COMPANY_MISMATCH'
  | 'FILE_INVALID_TYPE'
  | 'FILE_TOO_LARGE'
  | 'STORAGE_PERMISSION_DENIED'
  | 'STORAGE_NETWORK_ERROR'
  | 'FIRESTORE_ERROR'
  | 'PROCESSING_ERROR'
  | 'UNKNOWN_ERROR';

export interface UseFloorplanUploadReturn {
  uploadFloorplan: (file: File) => Promise<FloorplanUploadResult>;
  isUploading: boolean;
  progress: number;
  error: string | null;
  errorCode: UploadErrorCode | null;
  clearError: () => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

// Use canonical upload limit from file-upload-config (50MB for 'any' file type)
import { UPLOAD_LIMITS } from '@/config/file-upload-config';
const MAX_FILE_SIZE = UPLOAD_LIMITS.MAX_FILE_SIZE;

const ERROR_MESSAGES: Record<UploadErrorCode, string> = {
  AUTH_NOT_AUTHENTICATED: 'Πρέπει να είστε συνδεδεμένος για να ανεβάσετε αρχεία.',
  AUTH_MISSING_COMPANY_CLAIM: 'Ο λογαριασμός σας δεν έχει συνδεθεί με εταιρεία. Επικοινωνήστε με τον διαχειριστή.',
  AUTH_COMPANY_MISMATCH: 'Δεν έχετε δικαιώματα για αυτή την εταιρεία.',
  FILE_INVALID_TYPE: 'Μη υποστηριζόμενος τύπος αρχείου. Επιτρέπονται μόνο DXF και PDF.',
  FILE_TOO_LARGE: 'Το αρχείο είναι πολύ μεγάλο. Μέγιστο μέγεθος: 50MB.',
  STORAGE_PERMISSION_DENIED: 'Δεν έχετε δικαιώματα αποθήκευσης. Επικοινωνήστε με τον διαχειριστή.',
  STORAGE_NETWORK_ERROR: 'Σφάλμα δικτύου κατά τη μεταφόρτωση. Δοκιμάστε ξανά.',
  FIRESTORE_ERROR: 'Σφάλμα βάσης δεδομένων. Δοκιμάστε ξανά.',
  PROCESSING_ERROR: 'Σφάλμα κατά την επεξεργασία του αρχείου.',
  UNKNOWN_ERROR: 'Άγνωστο σφάλμα. Δοκιμάστε ξανά.',
};

// ============================================================================
// UTILITIES
// ============================================================================

function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  return lastDot > 0 ? filename.substring(lastDot + 1).toLowerCase() : '';
}

interface AuthValidationResult {
  valid: boolean;
  errorCode?: UploadErrorCode;
  companyId?: string;
  globalRole?: string;
}

async function validateAuthAndClaims(expectedCompanyId: string): Promise<AuthValidationResult> {
  const currentUser = auth.currentUser;

  if (!currentUser) {
    return { valid: false, errorCode: 'AUTH_NOT_AUTHENTICATED' };
  }

  try {
    const idTokenResult = await currentUser.getIdTokenResult(true);
    const claims = idTokenResult.claims;
    const companyIdFromClaim = typeof claims.companyId === 'string' ? claims.companyId : null;
    const globalRole = typeof claims.globalRole === 'string' ? claims.globalRole : null;

    if (!companyIdFromClaim) {
      logger.error('User missing companyId claim', { uid: currentUser.uid });
      return { valid: false, errorCode: 'AUTH_MISSING_COMPANY_CLAIM' };
    }

    const isSuperAdmin = globalRole === 'super_admin';
    if (!isSuperAdmin && companyIdFromClaim !== expectedCompanyId) {
      logger.error('Company mismatch', { claim: companyIdFromClaim, expected: expectedCompanyId });
      return { valid: false, errorCode: 'AUTH_COMPANY_MISMATCH' };
    }

    logger.info('Auth validated', { uid: currentUser.uid, companyId: companyIdFromClaim });
    return { valid: true, companyId: companyIdFromClaim, globalRole: globalRole || undefined };

  } catch {
    return { valid: false, errorCode: 'AUTH_NOT_AUTHENTICATED' };
  }
}

function getErrorCodeFromError(error: Error): UploadErrorCode {
  const msg = error.message.toLowerCase();
  if (msg.includes('permission') || msg.includes('unauthorized')) return 'STORAGE_PERMISSION_DENIED';
  if (msg.includes('network') || msg.includes('timeout')) return 'STORAGE_NETWORK_ERROR';
  if (msg.includes('firestore')) return 'FIRESTORE_ERROR';
  return 'UNKNOWN_ERROR';
}

// ============================================================================
// HOOK
// ============================================================================

export function useFloorplanUpload(config: FloorplanUploadConfig): UseFloorplanUploadReturn {
  const { companyId, projectId, entityType, entityId, domain, category, userId, entityLabel, purpose = 'floorplan', linkedTo } = config;

  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<UploadErrorCode | null>(null);

  const clearError = useCallback(() => {
    setError(null);
    setErrorCode(null);
  }, []);

  const uploadFloorplan = useCallback(async (file: File): Promise<FloorplanUploadResult> => {
    setIsUploading(true);
    setProgress(0);
    setError(null);
    setErrorCode(null);

    try {
      // Phase 1: Validate file
      const ext = getFileExtension(file.name);
      if (!isFloorplanFile(file.type, ext)) {
        setError(ERROR_MESSAGES.FILE_INVALID_TYPE);
        setErrorCode('FILE_INVALID_TYPE');
        return { success: false, error: ERROR_MESSAGES.FILE_INVALID_TYPE, errorCode: 'FILE_INVALID_TYPE' };
      }

      if (file.size > MAX_FILE_SIZE) {
        setError(ERROR_MESSAGES.FILE_TOO_LARGE);
        setErrorCode('FILE_TOO_LARGE');
        return { success: false, error: ERROR_MESSAGES.FILE_TOO_LARGE, errorCode: 'FILE_TOO_LARGE' };
      }

      // Phase 2: Validate auth (CRITICAL - checks custom claims)
      const authResult = await validateAuthAndClaims(companyId);
      if (!authResult.valid) {
        const code = authResult.errorCode!;
        setError(ERROR_MESSAGES[code]);
        setErrorCode(code);
        return { success: false, error: ERROR_MESSAGES[code], errorCode: code };
      }

      setProgress(10);
      logger.info('Creating FileRecord');

      // Phase 3: Create pending FileRecord
      const { fileId, storagePath, fileRecord } = await createPendingFileRecordWithPolicy({
        companyId, projectId, entityType, entityId, domain, category,
        entityLabel, purpose, originalFilename: file.name, ext,
        contentType: file.type, createdBy: userId,
        ...(linkedTo && linkedTo.length > 0 ? { linkedTo } : {}),
      });

      logger.info('FileRecord created', { fileId });
      setProgress(25);

      // Phase 4: Wait for Firestore propagation (2s for cross-service consistency)
      logger.info('Waiting for consistency');
      await new Promise(resolve => setTimeout(resolve, 2000));
      setProgress(30);

      // Phase 5: Upload to Storage
      logger.info('Uploading to Storage', { storagePath });
      const storageRef = ref(storage, storagePath);

      try {
        await uploadBytes(storageRef, file);
      } catch (uploadErr) {
        const err = uploadErr instanceof Error ? uploadErr : new Error(String(uploadErr));
        const code = getErrorCodeFromError(err);
        logger.error('Storage failed', { error: err.message });
        setError(ERROR_MESSAGES[code]);
        setErrorCode(code);
        return { success: false, error: ERROR_MESSAGES[code], errorCode: code };
      }

      logger.info('Uploaded to Storage');
      setProgress(50);

      // Phase 6: Get download URL
      const downloadUrl = await getDownloadURL(storageRef);
      setProgress(60);

      // Phase 7: Finalize FileRecord
      await finalizeFileRecordWithPolicy({ fileId, sizeBytes: file.size, downloadUrl });
      logger.info('FileRecord finalized');
      setProgress(90);

      // Phase 8: Trigger server-side DXF processing immediately (fire-and-forget)
      // Do NOT await — processing takes 15-60s. User can close wizard; API continues.
      auth.currentUser?.getIdToken().then((token) => {
        fetch(API_ROUTES.FLOORPLANS.PROCESS, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ fileId, forceReprocess: false }),
        })
          .then((res) => {
            if (res.ok) logger.info('Floorplan processing started successfully', { fileId });
            else logger.warn('Floorplan processing returned error', { fileId, status: res.status });
          })
          .catch((err) => logger.warn('Floorplan processing request failed', { fileId, error: String(err) }));
      }).catch((err: unknown) => {
        console.warn('[useFloorplanUpload] Failed to get token for processing', err);
      });

      setProgress(100);

      const finalFileRecord: FileRecord = { ...fileRecord, downloadUrl, sizeBytes: file.size, status: 'ready' };
      logger.info('Upload complete (processing delegated to useFloorplanFiles)', { fileId });

      return { success: true, fileRecord: finalFileRecord };

    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      const code = getErrorCodeFromError(error);
      logger.error('Upload error', { error: error.message });
      setError(error.message);
      setErrorCode(code);
      return { success: false, error: error.message, errorCode: code };

    } finally {
      setIsUploading(false);
    }
  }, [companyId, projectId, entityType, entityId, domain, category, userId, entityLabel, purpose, linkedTo]);

  return { uploadFloorplan, isUploading, progress, error, errorCode, clearError };
}

export default useFloorplanUpload;
