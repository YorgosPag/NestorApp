'use client';

import { useEffect } from 'react';
import type { FileUploadProgress, FileUploadResult } from '@/hooks/useFileUploadState';
import { createModuleLogger } from '@/lib/telemetry';

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

    if (debug) {
      logger.info('AUTO-UPLOAD: Starting upload', { fileName: file.name });
    }

    const startUpload = async () => {
      try {
        const result = await upload.uploadFile(file, uploadHandler);

        if (debug) {
          logger.info('AUTO-UPLOAD: Result received', {
            hasResult: !!result,
            hasSuccess: !!result?.success,
            hasUrl: !!result?.url,
            purpose,
          });
        }

        if (result?.success && onUploadComplete) {
          onUploadComplete(result);
        } else if (result?.url && onUploadComplete) {
          // No explicit success flag but has URL - assume success
          const enhancedResult: FileUploadResult = {
            ...result,
            success: true,
          };
          onUploadComplete(enhancedResult);
        } else if (debug) {
          logger.error('AUTO-UPLOAD: Callback NOT called', {
            hasResult: !!result,
            hasSuccess: !!result?.success,
            hasUrl: !!result?.url,
            hasCallback: !!onUploadComplete,
            purpose,
          });
        }
      } catch (err) {
        logger.error('AUTO-UPLOAD: Failed', { error: err, purpose, fileName: file?.name });

        // Call onUploadComplete even on failure to prevent hanging
        if (onUploadComplete) {
          const fallbackFileSize = file ? file.size : 0;
          const fallbackMimeType = file ? file.type : '';
          onUploadComplete({
            success: false,
            error: err instanceof Error ? err.message : 'Upload failed',
            url: '',
            fileName: file?.name ?? '',
            fileSize: fallbackFileSize,
            mimeType: fallbackMimeType,
          });
        }
      }
    };

    startUpload();
  }, [file, upload.isUploading, upload.success, uploadHandler, onUploadComplete, upload, purpose, debug]);
}
