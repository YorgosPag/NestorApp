'use client';

import { useCallback } from 'react';
import { useNotifications } from '@/providers/NotificationProvider';

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
import { FileNamingService } from '@/services/FileNamingService';
import type { ContactFormData } from '@/types/ContactFormTypes';

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
  /** Contact form data for filename generation (optional) */
  contactData?: ContactFormData;
  /** Photo index for multiple photos (optional) */
  photoIndex?: number;
  /** Custom filename override (optional) */
  customFileName?: string;
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
  // DEPENDENCIES
  // ========================================================================

  const notifications = useNotifications();

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
   * Validates file and creates preview URL (Refactored + Filename Generation)
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
        notifications.error(`❌ ${validation.error || 'Μη έγκυρο αρχείο'}`);
      }

      return validation;
    }

    // 🏷️ CENTRALIZED FILENAME GENERATION WITH NEW FileNamingService
    let processedFile = file;
    let customFilename = file.name;

    if (config.contactData && config.fileType === 'image') {
      try {
        // Map UploadPurpose to FileNamingService purpose
        let purpose: 'logo' | 'photo' | 'representative' = 'photo';

        switch (config.purpose) {
          case 'logo':
            purpose = 'logo';
            break;
          case 'representative':
          case 'avatar':
            purpose = 'representative';
            break;
          default:
            purpose = 'photo';
        }

        // Use new FileNamingService for automatic renaming
        processedFile = FileNamingService.generateProperFilename(
          file,
          config.contactData,
          purpose,
          config.photoIndex
        );

        customFilename = processedFile.name;
      } catch (error) {
        console.error('Filename generation failed:', error);
        // Fallback to original file if generation fails
      }
    }

    // Valid file - set με preview για images
    const createPreview = config.fileType === 'image' && processedFile.type.startsWith('image/');
    setFileWithPreview(processedFile, createPreview);

    if (config.showToasts !== false) {
      const displayName = customFilename !== file.name ? customFilename : PURPOSE_CONFIG[config.purpose]?.label || 'Αρχείο';
      notifications.success(`✅ ${displayName} επιλέχθηκε επιτυχώς`);
    }

    return validation;
  }, [config, clearAllErrors, setFileWithPreview, notifications]);

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
      // 🏷️ ENTERPRISE: Apply filename transformation before upload
      let fileToUpload = file;

      // Check if this file needs proper naming (from contact form)
      if (config.contactData && config.fileType === 'image') {
        try {
          let purpose: 'logo' | 'photo' | 'representative' = 'photo';

          if (config.purpose === 'logo') {
            purpose = 'logo';
          } else if (config.purpose === 'representative') {
            purpose = 'representative';
          } else {
            purpose = 'photo';
          }

          // Generate proper filename using FileNamingService
          fileToUpload = FileNamingService.generateProperFilename(
            file,
            config.contactData,
            purpose,
            config.photoIndex
          );

          console.log('🏷️ FILE RENAMED FOR UPLOAD:', {
            original: file.name,
            renamed: fileToUpload.name,
            purpose: purpose,
            contactType: config.contactData.type
          });

        } catch (error) {
          console.error('Filename generation failed during upload:', error);
          // Fallback to original file if generation fails
        }
      }

      // Progress callback που συνδέει με το state management
      const onProgress = (progress: FileUploadProgress) => {
        setUploadProgress(progress);
      };

      let result: FileUploadResult;

      // Use provided upload handler or create default
      if (uploadHandler) {
        result = await uploadHandler(fileToUpload, onProgress);  // ✅ Use renamed file
      } else {
        // Default upload simulation για demonstration
        onProgress({ progress: 25, phase: 'upload' });
        await new Promise(resolve => setTimeout(resolve, 500));

        onProgress({ progress: 75, phase: 'processing' });
        await new Promise(resolve => setTimeout(resolve, 500));

        result = {
          url: URL.createObjectURL(fileToUpload),
          fileName: fileToUpload.name,  // ✅ Use renamed file
          fileSize: fileToUpload.size,
          mimeType: fileToUpload.type
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
        notifications.success(`🎉 ${PURPOSE_CONFIG[config.purpose]?.label || 'Αρχείο'} ανέβηκε επιτυχώς!`);
      }

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Σφάλμα κατά το ανέβασμα';

      failUpload(errorMessage);

      if (config.showToasts !== false) {
        notifications.error(`❌ Σφάλμα: ${errorMessage}`);
      }

      return null;
    }
  }, [config, startUpload, setUploadProgress, completeUpload, failUpload, uploadControllerRef, notifications]);

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
      notifications.warning('⚠️ Το ανέβασμα ακυρώθηκε');
    }
  }, [cancelUploadState, config.showToasts, notifications]);

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