'use client';

import { useEffect, useRef } from 'react';
import type { FileUploadProgress, FileUploadResult } from '@/hooks/useFileUploadState';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('useAutoUploadEffect');

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Upload instance interface (subset of useEnterpriseFileUpload return)
 */
export interface UploadInstance {
  isUploading: boolean;
  success: boolean;
  uploadFile: (
    file: File,
    handler: (file: File, onProgress: (progress: FileUploadProgress) => void) => Promise<FileUploadResult>
  ) => Promise<FileUploadResult | null>;
}

/**
 * Upload handler function signature
 */
export type UploadHandler = (
  file: File,
  onProgress: (progress: FileUploadProgress) => void
) => Promise<FileUploadResult>;

/**
 * Configuration for useAutoUploadEffect hook
 */
export interface UseAutoUploadEffectConfig {
  /** Current file to upload */
  file: File | null | undefined;
  /** Upload instance from useEnterpriseFileUpload or similar */
  upload: UploadInstance;
  /** Upload handler function */
  uploadHandler: UploadHandler;
  /** Callback when upload completes */
  onUploadComplete?: (result: FileUploadResult) => void;
  /** Purpose for logging */
  purpose?: string;
  /** Enable debug logging */
  debug?: boolean;
}

// ============================================================================
// MAIN HOOK
// ============================================================================

/**
 * Auto-Upload Effect Hook
 *
 * Extracted from usePhotoUploadLogic (ADR-054) for reusability.
 * Automatically starts upload when a valid file is provided.
 *
 * Features:
 * - Automatic upload trigger when file changes
 * - Skip conditions (already uploading, already successful)
 * - Enhanced file validation
 * - Error handling with callback support
 * - Debug logging support
 *
 * @param config - Hook configuration
 *
 * @example
 * ```typescript
 * useAutoUploadEffect({
 *   file: selectedFile,
 *   upload: enterpriseUpload,
 *   uploadHandler: defaultUploadHandler,
 *   onUploadComplete: (result) => {
 *     if (result.success) {
 *       setPhotoUrl(result.url);
 *     }
 *   },
 *   purpose: 'representative',
 * });
 * ```
 */
export function useAutoUploadEffect({
  file,
  upload,
  uploadHandler,
  onUploadComplete,
  purpose = 'photo',
  debug = false,
}: UseAutoUploadEffectConfig): void {
  // 🏢 ENTERPRISE: Track the last successfully uploaded file to prevent re-upload loops.
  // When uploadHandler or formData changes after a successful upload, the effect re-fires
  // but we must NOT re-upload the same file — that causes flickering + repeated notifications.
  const uploadedFileRef = useRef<File | null>(null);

  // 🏢 ENTERPRISE: Stable refs for callbacks to prevent re-trigger on handler recreation
  const uploadHandlerRef = useRef(uploadHandler);
  uploadHandlerRef.current = uploadHandler;
  const onUploadCompleteRef = useRef(onUploadComplete);
  onUploadCompleteRef.current = onUploadComplete;

  useEffect(() => {
    if (debug) {
      logger.info('AUTO-UPLOAD EFFECT TRIGGERED', {
        hasFile: !!file,
        fileName: file?.name,
        isUploading: upload.isUploading,
        uploadSuccess: upload.success,
        purpose,
      });
    }

    // Enhanced validation to prevent undefined uploads
    const isValidFile =
      file &&
      file instanceof File &&
      file.name &&
      file.size > 0;

    if (!isValidFile || upload.isUploading || upload.success) {
      if (debug) {
        logger.info('AUTO-UPLOAD: Skipping upload', {
          reason: !file
            ? 'No file'
            : !(file instanceof File)
              ? 'Not a File object'
              : !file.name
                ? 'File has no name'
                : file.size <= 0
                  ? 'File is empty'
                  : upload.isUploading
                    ? 'Already uploading'
                    : 'Already successful',
        });
      }
      return;
    }

    // 🏢 ENTERPRISE: Prevent re-uploading the same file (breaks flickering loop)
    if (file === uploadedFileRef.current) {
      if (debug) {
        logger.info('AUTO-UPLOAD: Skipping — same file already uploaded', { fileName: file.name });
      }
      return;
    }

    if (debug) {
      logger.info('AUTO-UPLOAD: Starting upload', { fileName: file.name });
    }

    const startUpload = async () => {
      try {
        const result = await upload.uploadFile(file, uploadHandlerRef.current);

        if (debug) {
          logger.info('AUTO-UPLOAD: Result received', {
            hasResult: !!result,
            hasSuccess: !!result?.success,
            hasUrl: !!result?.url,
            purpose,
          });
        }

        if (result?.success || result?.url) {
          // Mark file as uploaded to prevent re-upload loops
          uploadedFileRef.current = file;

          if (onUploadCompleteRef.current) {
            const finalResult: FileUploadResult = result.success
              ? result
              : { ...result, success: true };
            onUploadCompleteRef.current(finalResult);
          }
        } else if (debug) {
          logger.error('AUTO-UPLOAD: Callback NOT called', {
            hasResult: !!result,
            hasSuccess: !!result?.success,
            hasUrl: !!result?.url,
            hasCallback: !!onUploadCompleteRef.current,
            purpose,
          });
        }
      } catch (err) {
        // 🏢 ENTERPRISE: Mark file as attempted to prevent infinite retry loop.
        // Without this, the effect re-fires on the same file → same error → browser freeze.
        uploadedFileRef.current = file;

        logger.error('AUTO-UPLOAD: Failed', { error: err, purpose, fileName: file?.name });

        // Call onUploadComplete even on failure to prevent hanging
        if (onUploadCompleteRef.current) {
          const fallbackFileSize = file ? file.size : 0;
          const fallbackMimeType = file ? file.type : '';
          onUploadCompleteRef.current({
            success: false,
            error: getErrorMessage(err, 'Upload failed'),
            url: '',
            fileName: file?.name ?? '',
            fileSize: fallbackFileSize,
            mimeType: fallbackMimeType,
          });
        }
      }
    };

    startUpload();
    // 🏢 ENTERPRISE: Only re-fire when the FILE changes or upload state changes.
    // uploadHandler and onUploadComplete use refs — safe to exclude from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, upload.isUploading, upload.success, purpose, debug]);
}
