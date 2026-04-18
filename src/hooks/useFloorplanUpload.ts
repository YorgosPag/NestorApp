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
import { uploadFileWithPolicy } from '@/services/filesystem/upload-orchestrator-gateway';
import { isFloorplanFile } from '@/services/floorplans/FloorplanProcessor';
import { processFloorplanWithPolicy } from '@/services/floorplans/floorplan-processing-mutation-gateway';
import type { FileRecord } from '@/types/file-record';
import type { EntityType, FileDomain, FileCategory } from '@/config/domain-constants';
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

// 🏢 ADR-292: Auth validation extracted to validateUploadAuth() in file-mutation-gateway.ts (SSoT)

function getErrorCodeFromError(error: Error): UploadErrorCode {
  const msg = error.message;
  // Auth errors from validateUploadAuth (thrown by orchestrator)
  if (msg.includes('COMPANY_MISMATCH')) return 'AUTH_COMPANY_MISMATCH';
  if (msg.includes('MISSING_COMPANY')) return 'AUTH_MISSING_COMPANY_CLAIM';
  if (msg.includes('AUTH_REQUIRED')) return 'AUTH_NOT_AUTHENTICATED';
  // Storage/network errors
  const lower = msg.toLowerCase();
  if (lower.includes('permission') || lower.includes('unauthorized')) return 'STORAGE_PERMISSION_DENIED';
  if (lower.includes('network') || lower.includes('timeout')) return 'STORAGE_NETWORK_ERROR';
  if (lower.includes('firestore')) return 'FIRESTORE_ERROR';
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
      // Phase 1: Validate file (pre-check before any network calls)
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

      // Phase 2: Upload via orchestrator (auth → create → delay → upload → finalize)
      const result = await uploadFileWithPolicy(file, {
        companyId, projectId, entityType, entityId, domain, category,
        entityLabel, purpose, originalFilename: file.name, ext,
        contentType: file.type, createdBy: userId,
        ...(linkedTo && linkedTo.length > 0 ? {
          linkedTo: linkedTo.flatMap((s) => {
            const [et, ...rest] = s.split(':');
            const id = rest.join(':');
            return et && id ? [{ entityType: et as EntityType, entityId: id }] : [];
          }),
        } : {}),
        firestoreDelayMs: 2000,
        onProgress: (p) => setProgress(p.percent),
      });

      // Phase 3: Fire-and-forget DXF/PDF processing
      processFloorplanWithPolicy({ fileId: result.fileId, forceReprocess: false })
        .then(() => logger.info('Floorplan processing started', { fileId: result.fileId }))
        .catch((err) => logger.warn('Processing request failed', { fileId: result.fileId, error: String(err) }));

      const finalFileRecord: FileRecord = {
        ...result.fileRecord,
        downloadUrl: result.downloadUrl,
        sizeBytes: file.size,
        status: 'ready',
      };

      return { success: true, fileRecord: finalFileRecord };

    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      const code = getErrorCodeFromError(error);
      logger.error('Upload error', { error: error.message });
      setError(ERROR_MESSAGES[code]);
      setErrorCode(code);
      return { success: false, error: ERROR_MESSAGES[code], errorCode: code };

    } finally {
      setIsUploading(false);
    }
  }, [companyId, projectId, entityType, entityId, domain, category, userId, entityLabel, purpose, linkedTo]);

  return { uploadFloorplan, isUploading, progress, error, errorCode, clearError };
}

export default useFloorplanUpload;
