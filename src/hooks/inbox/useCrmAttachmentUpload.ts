/**
 * =============================================================================
 * useCrmAttachmentUpload — Canonical upload for CRM communication attachments
 * =============================================================================
 *
 * ADR-293 Phase 3: Replaces legacy PhotoUploadService.uploadPhoto() with
 * the canonical 3-step pipeline (file-mutation-gateway).
 *
 * Follows the same pattern as useFileUpload.ts but tailored for the
 * CRM communications context (conversation entity, ingestion domain).
 *
 * @module hooks/inbox/useCrmAttachmentUpload
 */

import { useCallback } from 'react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { createModuleLogger } from '@/lib/telemetry';
import {
  createPendingFileRecordWithPolicy,
  finalizeFileRecordWithPolicy,
  validateUploadAuth,
} from '@/services/filesystem/file-mutation-gateway';
import { getFileExtension } from '@/services/upload';
import { ENTITY_TYPES, FILE_DOMAINS, FILE_CATEGORIES } from '@/config/domain-constants';
import { generateUploadThumbnail, buildThumbnailPath } from '@/components/shared/files/utils/generate-upload-thumbnail';

const logger = createModuleLogger('CrmAttachmentUpload');

// ============================================================================
// TYPES
// ============================================================================

interface UseCrmAttachmentUploadParams {
  conversationId: string | null;
}

interface UseCrmAttachmentUploadReturn {
  handleUploadAttachment: (
    file: File,
    onProgress: (progress: number) => void,
  ) => Promise<{ url: string; thumbnailUrl?: string } | null>;
}

// ============================================================================
// HOOK
// ============================================================================

export function useCrmAttachmentUpload({
  conversationId,
}: UseCrmAttachmentUploadParams): UseCrmAttachmentUploadReturn {

  const handleUploadAttachment = useCallback(async (
    file: File,
    onProgress: (progress: number) => void,
  ): Promise<{ url: string; thumbnailUrl?: string } | null> => {
    if (!conversationId) {
      logger.warn('Upload attempted without conversationId');
      return null;
    }

    try {
      // =====================================================================
      // AUTH GATE — Get companyId from Firebase ID token claims (ADR-292)
      // =====================================================================
      const authContext = await validateUploadAuth();
      logger.info('Upload auth validated', {
        uid: authContext.uid,
        companyId: authContext.companyId,
        conversationId,
      });

      onProgress(5);

      // =====================================================================
      // STEP A: Create pending FileRecord (ADR-191 lifecycle)
      // =====================================================================
      const ext = getFileExtension(file.name);
      const { fileId, storagePath } = await createPendingFileRecordWithPolicy({
        companyId: authContext.companyId,
        entityType: ENTITY_TYPES.CONVERSATION,
        entityId: conversationId,
        domain: FILE_DOMAINS.INGESTION,
        category: file.type.startsWith('image/')
          ? FILE_CATEGORIES.PHOTOS
          : FILE_CATEGORIES.DOCUMENTS,
        originalFilename: file.name,
        ext,
        contentType: file.type,
        createdBy: authContext.uid,
      });

      onProgress(20);

      // Wait for Firestore propagation before Storage upload (same as useFileUpload)
      await new Promise((resolve) => setTimeout(resolve, 300));

      // =====================================================================
      // STEP B: Upload binary to Firebase Storage with progress tracking
      // =====================================================================
      const storageRef = ref(storage, storagePath);
      const uploadTask = uploadBytesResumable(storageRef, file);

      await new Promise<void>((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const percent = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            // Map upload progress to 20-80 range
            onProgress(20 + Math.round(percent * 0.6));
          },
          reject,
          resolve,
        );
      });

      const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
      onProgress(85);

      // =====================================================================
      // Thumbnail generation for images (non-blocking)
      // =====================================================================
      let thumbnailUrl: string | undefined;
      if (file.type.startsWith('image/')) {
        try {
          const thumbBlob = await generateUploadThumbnail(file, file.type);
          if (thumbBlob) {
            const thumbPath = buildThumbnailPath(storagePath);
            const thumbRef = ref(storage, thumbPath);
            await uploadBytesResumable(thumbRef, thumbBlob, { contentType: 'image/webp' });
            thumbnailUrl = await getDownloadURL(thumbRef);
          }
        } catch (thumbErr) {
          logger.warn('Thumbnail generation failed (non-blocking)', { error: String(thumbErr) });
        }
      }

      onProgress(90);

      // =====================================================================
      // STEP C: Finalize FileRecord — status: pending → ready
      // =====================================================================
      await finalizeFileRecordWithPolicy({
        fileId,
        sizeBytes: file.size,
        downloadUrl,
        thumbnailUrl,
      });

      onProgress(100);

      logger.info('Attachment uploaded via canonical pipeline', {
        fileId,
        storagePath,
        conversationId,
        sizeBytes: file.size,
      });

      return { url: downloadUrl, thumbnailUrl };
    } catch (error) {
      logger.error('CRM attachment upload failed', {
        error: error instanceof Error ? error.message : String(error),
        conversationId,
        fileName: file.name,
      });
      return null;
    }
  }, [conversationId]);

  return { handleUploadAttachment };
}
