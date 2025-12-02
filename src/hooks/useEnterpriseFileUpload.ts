'use client';

import { useCallback } from 'react';
import toast from 'react-hot-toast';

// Centralized imports από τα νέα modules
import {
  PURPOSE_CONFIG,
  type FileType,
  type UploadPurpose
} from '@/config/file-upload-config';
import {
  validateFile,
  type FileValidationResult
} from '@/utils/file-validation';
import {
  useFileUploadState,
  type FileUploadProgress,
  type FileUploadResult
} from '@/hooks/useFileUploadState';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface UseEnterpriseFileUploadConfig {
  /** Type of files to accept */
  fileType: FileType;
  /** Purpose of the upload for better UX */
  purpose: UploadPurpose;
  /** Maximum file size in bytes (default: 5MB) */
  maxSize?: number;
  /** Accepted MIME types (auto-generated if not provided) */
  acceptedTypes?: string[];
  /** Show toast notifications (default: true) */
  showToasts?: boolean;
}

export interface UseEnterpriseFileUploadActions {
  validateAndPreview: (file: File) => FileValidationResult;
  uploadFile: (file: File, uploadHandler?: (file: File, onProgress: (progress: FileUploadProgress) => void) => Promise<FileUploadResult>) => Promise<FileUploadResult | null>;
  clearState: () => void;
  clearError: () => void;
  cancelUpload: () => void;
  cleanup: () => void;
}

export interface UseEnterpriseFileUploadReturn extends UseEnterpriseFileUploadActions {
  // State (από useFileUploadState)
  isUploading: boolean;
  progress: number;
  error: string | null;
  success: boolean;
  validationError: string | null;
  previewUrl: string | null;
  currentFile: File | null;
  uploadPhase: FileUploadProgress['phase'];
}

// Re-export types για backward compatibility
export type { FileType, UploadPurpose, FileValidationResult, FileUploadProgress, FileUploadResult };

// ============================================================================
// MAIN HOOK
// ============================================================================

/**
 * Enterprise File Upload Hook (Refactored)
 *
 * Enterprise-class orchestrator hook που συνδυάζει:
 * - useFileUploadState: State management
 * - validateFile: File validation utilities
 * - Configuration: Centralized config από file-upload-config.ts
 *
 * Refactored από 458 γραμμές σε 4 specialized modules.
 * Maintains 100% backward compatibility.
 *
 * @param config Upload configuration
 * @returns Hook state and actions
 */
export function useEnterpriseFileUpload(config: UseEnterpriseFileUploadConfig): UseEnterpriseFileUploadReturn {

  // ========================================================================
  // CORE STATE MANAGEMENT
  // ========================================================================

  const {
    // State
    isUploading,
    progress,
    error,
    success,
    validationError,
    previewUrl,
    currentFile,
    uploadPhase,
    uploadControllerRef,

    // Actions από useFileUploadState
    setFileWithPreview,
    clearAllErrors,
    resetToInitialState,
    startUpload,
    completeUpload,
    failUpload,
    cancelUpload: cancelUploadState,
    setUploadProgress,
    cleanup: cleanupState
  } = useFileUploadState();

  // ========================================================================
  // VALIDATION & PREVIEW
  // ========================================================================

  /**
   * Validates file and creates preview URL (Refactored)
   */
  const validateAndPreview = useCallback((file: File): FileValidationResult => {
    // Clear previous errors
    clearAllErrors();

    // Validate file using centralized validation
    const validation = validateFile(file, {
      fileType: config.fileType,
      maxSize: config.maxSize,
      acceptedTypes: config.acceptedTypes
    });

    if (!validation.isValid) {
      // Set validation error
      setFileWithPreview(file, false); // File μόνο, όχι preview για invalid files

      if (config.showToasts !== false) {
        toast.error(validation.error || 'Μη έγκυρο αρχείο');
      }

      return validation;
    }

    // Valid file - set με preview για images
    const createPreview = config.fileType === 'image' && file.type.startsWith('image/');
    setFileWithPreview(file, createPreview);

    if (config.showToasts !== false) {
      toast.success(`${PURPOSE_CONFIG[config.purpose].label} επιλέχθηκε επιτυχώς`);
    }

    return validation;
  }, [config, clearAllErrors, setFileWithPreview]);

  // ========================================================================
  // FILE UPLOAD
  // ========================================================================

  /**
   * Uploads file with progress tracking (Refactored)
   */
  const uploadFile = useCallback(async (
    file: File,
    uploadHandler?: (file: File, onProgress: (progress: FileUploadProgress) => void) => Promise<FileUploadResult>
  ): Promise<FileUploadResult | null> => {

    // Start upload using state management
    startUpload();

    try {
      // Progress callback που συνδέει με το state management
      const onProgress = (progress: FileUploadProgress) => {
        setUploadProgress(progress);
      };

      let result: FileUploadResult;

      // Use provided upload handler or create default
      if (uploadHandler) {
        result = await uploadHandler(file, onProgress);
      } else {
        // Default upload simulation για demonstration
        onProgress({ progress: 25, phase: 'upload' });
        await new Promise(resolve => setTimeout(resolve, 500));

        onProgress({ progress: 75, phase: 'processing' });
        await new Promise(resolve => setTimeout(resolve, 500));

        result = {
          url: URL.createObjectURL(file),
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type
        };
      }

      // Check if upload was cancelled
      if (uploadControllerRef.current?.signal.aborted) {
        failUpload('Upload cancelled');
        return null;
      }

      // Success
      completeUpload(result);

      if (config.showToasts !== false) {
        toast.success(`${PURPOSE_CONFIG[config.purpose].label} ανέβηκε επιτυχώς!`);
      }

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Σφάλμα κατά το ανέβασμα';

      failUpload(errorMessage);

      if (config.showToasts !== false) {
        toast.error(`Σφάλμα: ${errorMessage}`);
      }

      return null;
    }
  }, [config, startUpload, setUploadProgress, completeUpload, failUpload, uploadControllerRef]);

  // ========================================================================
  // ACTION WRAPPERS (Backward Compatibility)
  // ========================================================================

  /**
   * Clears all state (Wrapper around resetToInitialState)
   */
  const clearState = useCallback(() => {
    resetToInitialState();
  }, [resetToInitialState]);

  /**
   * Clears only error state (Wrapper around clearAllErrors)
   */
  const clearError = useCallback(() => {
    clearAllErrors();
  }, [clearAllErrors]);

  /**
   * Cancels current upload (Enhanced με toast)
   */
  const cancelUpload = useCallback(() => {
    cancelUploadState();

    if (config.showToasts !== false) {
      toast.error('Το ανέβασμα ακυρώθηκε');
    }
  }, [cancelUploadState, config.showToasts]);

  /**
   * Cleanup wrapper (Delegates to state management)
   */
  const cleanup = useCallback(() => {
    cleanupState();
  }, [cleanupState]);

  // ========================================================================
  // RETURN API
  // ========================================================================

  return {
    // State (από useFileUploadState)
    isUploading,
    progress,
    error,
    success,
    validationError,
    previewUrl,
    currentFile,
    uploadPhase,

    // Actions
    validateAndPreview,
    uploadFile,
    clearState,
    clearError,
    cancelUpload,
    cleanup
  };
}