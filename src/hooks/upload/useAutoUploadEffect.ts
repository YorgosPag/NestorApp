'use client';

import { useEffect, useRef } from 'react';
import type { FileUploadProgress, FileUploadResult } from '@/hooks/useFileUploadState';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('useAutoUploadEffect');

// ============================================================================
// REMOUNT-DURABLE UPLOAD GUARDS (module scope, όχι useRef)
// ----------------------------------------------------------------------------
// Τα per-component refs μηδενίζονται σε ΚΑΘΕ remount. Αν το slot ξαναστηθεί ενώ
// το `file` είναι ακόμη παρόν (π.χ. αλλαγή React key, cache-buster, re-render του
// γονέα), το effect το έβλεπε ως ολοκαίνουργιο αρχείο και ξανανέβαζε — δεύτερο
// Storage object + δεύτερο `files` doc + δεύτερο URL.
//
// Το κλειδί είναι η ΤΑΥΤΟΤΗΤΑ του `File` object: κάθε νέα επιλογή αρχείου από τον
// χρήστη παράγει νέο File, άρα δεν μπλοκάρεται ποτέ πραγματική νέα μεταφόρτωση.
// WeakSet → μηδενική διαρροή μνήμης (το entry φεύγει μαζί με το File).
//
// ⚠️ ΜΟΝΟ οι ΕΠΙΤΥΧΙΕΣ είναι durable. Οι αποτυχίες παραμένουν component-local,
// ώστε ένα remount να εξακολουθεί να επιτρέπει retry μετά από σφάλμα δικτύου.
// ============================================================================
const uploadedFiles = new WeakSet<File>();
const inFlightFiles = new WeakSet<File>();

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
  // 🏢 ENTERPRISE: Αποτυχημένα αρχεία — component-local ΕΠΙΤΗΔΕΣ, ώστε ένα
  // remount να δίνει στον χρήστη νέα ευκαιρία retry (σε αντίθεση με τις
  // επιτυχίες, που είναι durable στο module-level WeakSet).
  const failedFileRef = useRef<File | null>(null);

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

    // 🏢 ENTERPRISE: Prevent re-uploading the same file (post-upload guard).
    // Durable σε remount — αυτό είναι που σταματά το διπλό upload.
    if (uploadedFiles.has(file)) {
      if (debug) {
        logger.info('AUTO-UPLOAD: Skipping — same file already uploaded', { fileName: file.name });
      }
      return;
    }

    // Αποτυχημένο σε ΑΥΤΟ το instance → μην ξαναδοκιμάσεις σε loop.
    if (file === failedFileRef.current) {
      if (debug) {
        logger.info('AUTO-UPLOAD: Skipping — same file already failed here', { fileName: file.name });
      }
      return;
    }

    // 🏢 ENTERPRISE: Prevent duplicate in-flight upload (synchronous guard).
    // This catches cases where React re-renders trigger the effect before
    // upload.isUploading state has been committed (batching timing issue) —
    // και επιπλέον καλύπτει remount ΕΝΩ το upload είναι ακόμη σε πτήση.
    if (inFlightFiles.has(file)) {
      if (debug) {
        logger.info('AUTO-UPLOAD: Skipping — same file already in-flight', { fileName: file.name });
      }
      return;
    }

    // Mark as in-flight IMMEDIATELY (sync, before any async operation)
    inFlightFiles.add(file);

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
          // Mark file as uploaded to prevent re-upload loops (durable σε remount)
          uploadedFiles.add(file);

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
        // ΟΧΙ στο durable set — μια αποτυχία δεν πρέπει να αποκλείει το αρχείο
        // για πάντα· ένα remount ξαναδίνει ευκαιρία retry.
        failedFileRef.current = file;

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
      } finally {
        // Το in-flight guard αφορά ΑΥΤΟ το File — καθαρίζεται πάντα στο τέλος.
        // (Το uploadedFiles κρατά πλέον τη μόνιμη «έγινε» πληροφορία.)
        inFlightFiles.delete(file);
      }
    };

    startUpload();
    // 🏢 ENTERPRISE: Only re-fire when the FILE changes or upload state changes.
    // uploadHandler and onUploadComplete use refs — safe to exclude from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, upload.isUploading, upload.success, purpose, debug]);
}
