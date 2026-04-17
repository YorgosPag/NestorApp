'use client';

import { useCallback } from 'react';
import { useNotifications } from '@/providers/NotificationProvider';

// Centralized imports από τα νέα modules
import {
  PURPOSE_CONFIG,
  type FileType,
  type UploadPurpose
} from '@/config/file-upload-config';
import type { EntityType, FileDomain, FileCategory } from '@/config/domain-constants';
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
import { PhotoUploadService } from '@/services/photo-upload.service';
import type { UsageContext } from '@/config/photo-compression-config';
import type { ContactFormData } from '@/types/ContactFormTypes';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';

const logger = createModuleLogger('useEnterpriseFileUpload');

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

  // =========================================================================
  // 🏢 CANONICAL PIPELINE FIELDS (ADR-031 / ADR-292)
  // =========================================================================
  // When provided, PhotoUploadService routes to canonical pipeline
  // (createPendingFileRecord → upload → finalize) with tenant isolation.
  // Without these, uploads fall through to LEGACY pipeline (no FileRecord).
  // =========================================================================

  /** 🏢 CANONICAL: Company ID for multi-tenant isolation */
  companyId?: string;
  /** 🏢 CANONICAL: Entity ID for FileRecord linkage (e.g. contactId) */
  contactId?: string;
  /** 🏢 CANONICAL: User ID who is uploading */
  createdBy?: string;
  /** 🏢 CANONICAL: Entity name for display name generation */
  contactName?: string;

  // 🏢 ADR-293 Phase 5 — ENTITY-POLYMORPHIC (Batch 29)
  /** Target entity type (property, building, contact, ...). Defaults to CONTACT when absent. */
  entityType?: EntityType;
  /** Target entity ID; supersedes contactId when provided. */
  entityId?: string;
  /** File domain (sales, construction, admin, ...). Defaults to ADMIN when absent. */
  domain?: FileDomain;
  /** File category (photos, floorplans, ...). Defaults to PHOTOS. */
  category?: FileCategory;
  /** Human-readable entity label; supersedes contactName when provided. */
  entityLabel?: string;
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
// HELPER FUNCTIONS (Extracted to eliminate duplication - ADR-054)
// ============================================================================

/**
 * Resolves the purpose for FileNamingService
 * Maps UploadPurpose to FileNamingService purpose type
 */
function resolveFileNamingPurpose(purpose: UploadPurpose): 'logo' | 'photo' | 'representative' {
  switch (purpose) {
    case 'logo':
      return 'logo';
    case 'representative':
    case 'avatar':
      return 'representative';
    default:
      return 'photo';
  }
}

/**
 * Generates a properly named file using FileNamingService
 * Extracted from validateAndPreview and uploadFile to eliminate duplication
 *
 * @param file - Original file
 * @param config - Upload configuration
 * @returns Renamed file or original if generation fails
 */
function generateNamedFile(
  file: File,
  config: {
    contactData?: ContactFormData;
    fileType: FileType;
    purpose: UploadPurpose;
    photoIndex?: number;
  }
): File {
  if (!config.contactData || config.fileType !== 'image') {
    return file;
  }

  try {
    const purpose = resolveFileNamingPurpose(config.purpose);

    return FileNamingService.generateProperFilename(
      file,
      config.contactData,
      purpose,
      config.photoIndex
    );
  } catch (error) {
    logger.error('Filename generation failed', { error });
    return file;
  }
}

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
  const { t } = useTranslation(['files', 'files-media']);

  // ========================================================================
  // 🏢 CANONICAL PIPELINE DEPRECATION CHECK (ADR-292)
  // ========================================================================

  if (!config.companyId || !config.createdBy) {
    logger.warn('DEPRECATION: useEnterpriseFileUpload called without canonical fields (companyId/createdBy). Upload will use legacy pipeline without tenant isolation. Pass canonical fields for enterprise storage.', {
      hasCompanyId: !!config.companyId,
      hasCreatedBy: !!config.createdBy,
      hasContactId: !!config.contactId,
      purpose: config.purpose,
    });
  }

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
        notifications.error(`❌ ${validation.error || t('upload.toast.invalidFile')}`);

      }

      return validation;
    }

    // 🏷️ CENTRALIZED FILENAME GENERATION (ADR-054: Extracted helper function)
    const processedFile = generateNamedFile(file, {
      contactData: config.contactData,
      fileType: config.fileType,
      purpose: config.purpose,
      photoIndex: config.photoIndex,
    });
    const customFilename = processedFile.name;

    // Valid file - set με preview για images
    const createPreview = config.fileType === 'image' && processedFile.type.startsWith('image/');
    setFileWithPreview(processedFile, createPreview);

    if (config.showToasts !== false) {
      const displayName = customFilename !== file.name ? customFilename : PURPOSE_CONFIG[config.purpose]?.label || t('upload.toast.fileFallback');
      notifications.success(t('upload.toast.selectedSuccess', { name: displayName }));
    }

    return validation;
  }, [config, clearAllErrors, setFileWithPreview, notifications, t]);

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
      // 🏷️ ENTERPRISE: Apply filename transformation before upload (ADR-054: Using extracted helper)
      const fileToUpload = generateNamedFile(file, {
        contactData: config.contactData,
        fileType: config.fileType,
        purpose: config.purpose,
        photoIndex: config.photoIndex,
      });

      if (fileToUpload.name !== file.name) {
        logger.info('FILE RENAMED FOR UPLOAD', {
          original: file.name,
          renamed: fileToUpload.name,
          purpose: config.purpose,
          contactType: config.contactData?.type
        });
      }

      // Progress callback που συνδέει με το state management
      const onProgress = (progress: FileUploadProgress) => {
        setUploadProgress(progress);
      };

      let result: FileUploadResult;

      // Use provided upload handler or create default with compression
      if (uploadHandler) {
        result = await uploadHandler(fileToUpload, onProgress);  // ✅ Use renamed file
      } else {
        // 🏢 ENTERPRISE: Use PhotoUploadService με automatic compression
        logger.info('ENTERPRISE: Using PhotoUploadService with compression');

        // Map UploadPurpose to compression UsageContext
        let compressionUsage: UsageContext = 'profile-modal';
        switch (config.purpose) {
          case 'logo':
            compressionUsage = 'company-logo';
            break;
          case 'representative':
          case 'avatar':
            compressionUsage = 'avatar';
            break;
          case 'business-card':
            compressionUsage = 'business-card';
            break;
          case 'document':
            compressionUsage = 'document-scan';
            break;
          default:
            compressionUsage = 'profile-modal';
        }

        // 🏢 ADR-293: All uploads use canonical pipeline (legacy eliminated)
        // ADR-293 Phase 5 Batch 29: entity-polymorphic fields forwarded alongside
        // legacy contact aliases so PhotoUploadService routes to the correct
        // entityType/domain/category.
        result = await PhotoUploadService.uploadPhoto(fileToUpload, {
          onProgress,
          enableCompression: config.fileType === 'image',
          compressionUsage,
          contactData: config.contactData,
          purpose: config.purpose,
          photoIndex: config.photoIndex,
          companyId: config.companyId,
          contactId: config.contactId,
          createdBy: config.createdBy,
          contactName: config.contactName,
          entityType: config.entityType,
          entityId: config.entityId,
          domain: config.domain,
          category: config.category,
          entityLabel: config.entityLabel,
        });

        logger.info('ENTERPRISE: PhotoUploadService completed', {
          originalSize: fileToUpload.size,
          resultSize: result.fileSize,
          compressionApplied: result.compressionInfo?.wasCompressed || false,
          compressionRatio: result.compressionInfo?.compressionRatio || 0
        });
      }

      // Check if upload was cancelled
      if (uploadControllerRef.current?.signal.aborted) {
        failUpload('Upload cancelled');
        return null;
      }

      // Success
      completeUpload(result);

      if (config.showToasts !== false) {
        const uploadName = PURPOSE_CONFIG[config.purpose]?.label || t('upload.toast.fileFallback');
        const baseMessage = t('upload.toast.uploadSuccess', { name: uploadName });

        // Add compression info if available
        if (result.compressionInfo?.wasCompressed) {
          const originalKB = Math.round(result.compressionInfo.originalSize / 1024);
          const compressedKB = Math.round(result.compressionInfo.compressedSize / 1024);
          const savingsPercent = result.compressionInfo.compressionRatio;

          notifications.success(
            `${baseMessage}\n${t('upload.toast.compressed', { originalKB, compressedKB, savingsPercent })}`
          );
        } else {
          notifications.success(baseMessage);
        }
      }

      return result;

    } catch (error) {
      const errorMessage = getErrorMessage(error, t('upload.toast.uploadError'));

      failUpload(errorMessage);

      if (config.showToasts !== false) {
        notifications.error(t('upload.toast.errorPrefix', { message: errorMessage }));
      }

      return null;
    }
  }, [config, startUpload, setUploadProgress, completeUpload, failUpload, uploadControllerRef, notifications, t]);

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
      notifications.warning(t('upload.toast.uploadCancelled'));
    }
  }, [cancelUploadState, config.showToasts, notifications, t]);

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