/**
 * =============================================================================
 * useFileUpload — Canonical 3-step upload pipeline (ADR-031)
 * =============================================================================
 *
 * Enterprise upload handler implementing:
 * - Centralized auth preflight
 * - Step A: Create pending FileRecord
 * - Step B: Upload binary to Firebase Storage
 * - Step C: Finalize FileRecord with downloadUrl
 * - Persistent thumbnail generation (ADR-191 Phase 2.1)
 * - AI auto-classify fire-and-forget (ADR-191 Phase 2.2)
 * - Toast notifications for upload results
 * - Capture passthrough for Quick Capture (Procore/BIM360 pattern)
 *
 * Extracted from EntityFilesManager for Google SRP compliance.
 *
 * @module components/shared/files/hooks/useFileUpload
 */

import { useCallback, useState } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import app from '@/lib/firebase';
import { createModuleLogger } from '@/lib/telemetry';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useNotifications } from '@/providers/NotificationProvider';
import {
  classifyFileWithPolicy,
  createPendingFileRecordWithPolicy,
  finalizeFileRecordWithPolicy,
  validateUploadAuth,
} from '@/services/filesystem/file-mutation-gateway';
import { getFileExtension } from '@/services/upload';
import type { EntityType, FileDomain, FileCategory } from '@/config/domain-constants';
import type { UploadEntryPoint, CaptureMetadata } from '@/config/upload-entry-points';
import { generateUploadThumbnail, buildThumbnailPath } from '../utils/generate-upload-thumbnail';
import { isAIClassifiable } from './useFileClassification';

// ============================================================================
// TYPES
// ============================================================================

interface UseFileUploadParams {
  companyId: string;
  projectId?: string;
  entityType: EntityType;
  entityId: string;
  domain: FileDomain;
  category: FileCategory;
  entityLabel?: string;
  purpose?: string;
  /** ADR-236 Phase 3: Tag uploaded file with multi-level floor ID */
  levelFloorId?: string;
  currentUserId: string;
  selectedEntryPoint: UploadEntryPoint | null;
  customTitle: string;
  refetch: () => Promise<void> | void;
  recordFileActivity: (
    action: 'created',
    field: string,
    oldValue: string | null,
    newValue: string | null,
    label: string,
  ) => void;
  /** Callback after successful upload to reset UI state */
  onUploadComplete?: () => void;
}

interface UseFileUploadReturn {
  handleUpload: (files: File[]) => Promise<void>;
  handleCapture: (file: File, metadata: CaptureMetadata) => Promise<void>;
  uploading: boolean;
}

// ============================================================================
// MODULE LOGGER
// ============================================================================

const logger = createModuleLogger('FILE_UPLOAD');

// ============================================================================
// HOOK
// ============================================================================

export function useFileUpload({
  companyId,
  projectId,
  entityType,
  entityId,
  domain,
  category,
  entityLabel,
  purpose,
  levelFloorId,
  currentUserId,
  selectedEntryPoint,
  customTitle,
  refetch,
  recordFileActivity,
  onUploadComplete,
}: UseFileUploadParams): UseFileUploadReturn {
  const [uploading, setUploading] = useState(false);
  const { t } = useTranslation('files');
  const { success, error: showError, warning } = useNotifications();

  const handleUpload = useCallback(async (selectedFiles: File[]) => {
    if (!selectedFiles || selectedFiles.length === 0) return;

    // =========================================================================
    // AUTH GATE — Canonical upload auth with companyId validation (ADR-292)
    // =========================================================================
    let authContext: Awaited<ReturnType<typeof validateUploadAuth>>;

    try {
      authContext = await validateUploadAuth(companyId);
      logger.info('AUTH_VERIFIED', { uid: authContext.uid, companyId: authContext.companyId });
    } catch (authError) {
      logger.error('AUTH_PRECHECK_FAILED', { error: String(authError) });
      const errorMessage = authError instanceof Error ? authError.message : '';
      showError(
        errorMessage.includes('AUTH_REQUIRED')
          ? t('upload.errors.notAuthenticated')
          : errorMessage.includes('COMPANY')
            ? t('upload.errors.authFailed')
            : t('upload.errors.authFailed'),
      );
      return;
    }

    // Diagnostic logging
    logger.info('UPLOAD_DIAGNOSTIC', {
      projectId: app.options.projectId,
      storageBucket: app.options.storageBucket,
      authUid: authContext.uid,
      companyId,
      entityType,
      entityId,
      domain,
      category,
    });

    setUploading(true);

    try {
      // Entry point overrides for correct tree folder structure
      const uploadDomain = selectedEntryPoint?.domain || domain;
      const uploadCategory = selectedEntryPoint?.category || category;
      const uploadPurpose = selectedEntryPoint?.purpose || purpose;

      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];

        try {
          const ext = getFileExtension(file.name);

          // STEP A: Create pending FileRecord
          const { fileId, storagePath, displayName } = await createPendingFileRecordWithPolicy({
            companyId,
            projectId,
            entityType,
            entityId,
            domain: uploadDomain,
            category: uploadCategory,
            entityLabel,
            purpose: uploadPurpose,
            ...(levelFloorId ? { levelFloorId } : {}),
            originalFilename: file.name,
            ext,
            contentType: file.type,
            createdBy: currentUserId,
            customTitle: selectedEntryPoint?.requiresCustomTitle
              ? customTitle
              : selectedEntryPoint?.label?.el,
          });

          // Wait for Firestore propagation before Storage upload
          await new Promise((resolve) => setTimeout(resolve, 300));

          // STEP B: Upload binary to Storage
          const storageRef = ref(storage, storagePath);
          await uploadBytes(storageRef, file);
          const downloadUrl = await getDownloadURL(storageRef);

          // ADR-191 Phase 2.1: Generate persistent thumbnail
          let thumbnailUrl: string | undefined;
          try {
            const thumbBlob = await generateUploadThumbnail(file, file.type);
            if (thumbBlob) {
              const thumbPath = buildThumbnailPath(storagePath);
              const thumbRef = ref(storage, thumbPath);
              await uploadBytes(thumbRef, thumbBlob, { contentType: 'image/webp' });
              thumbnailUrl = await getDownloadURL(thumbRef);
            }
          } catch (thumbErr) {
            logger.warn('Thumbnail generation failed (non-blocking)', { error: String(thumbErr) });
          }

          // STEP C: Finalize FileRecord
          await finalizeFileRecordWithPolicy({
            fileId,
            sizeBytes: file.size,
            downloadUrl,
            thumbnailUrl,
          });

          // ADR-191 Phase 2.2: AI auto-classify (fire-and-forget)
          if (isAIClassifiable(file.type)) {
            classifyFileWithPolicy(fileId).catch(() => { /* non-blocking */ });
          }

          successCount++;
          recordFileActivity('created', 'file_upload', null, displayName ?? file.name, t('audit.fileUpload'));

          // Delay between uploads to avoid rate limiting
          if (i < selectedFiles.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 300));
          }
        } catch (fileError) {
          failCount++;
          logger.error(`Failed to upload file ${file.name}:`, { error: fileError });
        }
      }

      // Toast notifications
      if (failCount > 0 && successCount > 0) {
        warning(t('upload.errors.partialSuccess', { success: successCount, fail: failCount, total: selectedFiles.length }));
      } else if (failCount > 0) {
        showError(t('upload.errors.allFailed', { count: failCount }));
      } else if (successCount > 0) {
        success(t('upload.success', { count: successCount }));
      }

      await refetch();
      onUploadComplete?.();
    } catch (error) {
      logger.error('Upload failed:', { error });
      showError(t('upload.errors.generic'));
    } finally {
      setUploading(false);
    }
  }, [
    companyId, projectId, entityType, entityId, domain, category, entityLabel, purpose, levelFloorId,
    currentUserId, selectedEntryPoint, customTitle, refetch, recordFileActivity,
    onUploadComplete, success, showError, warning, t,
  ]);

  const handleCapture = useCallback(async (file: File, metadata: CaptureMetadata) => {
    logger.info('CAPTURE_RECEIVED', {
      source: metadata.source,
      captureMode: metadata.captureMode,
      mimeType: metadata.mimeType,
      filename: file.name,
      size: file.size,
    });
    await handleUpload([file]);
  }, [handleUpload]);

  return { handleUpload, handleCapture, uploading };
}
