'use client';

// ============================================================================
// USE PHOTOS TAB UPLOAD - UPLOAD LOGIC HOOK
// ============================================================================
//
// ADR-018: Upload Systems Centralization
// Thin wrapper around existing enterprise hooks for PhotosTabBase
//
// IMPORTANT: Uses existing centralized hooks - NO DUPLICATION!
// - useEnterpriseFileUpload: Enterprise orchestrator hook
// - useFileUploadState: Core state management
//
// This hook ONLY adds PhotosTab-specific logic (photos array management)
//
// ============================================================================

import { useCallback } from 'react';
import type { Photo } from '../../utils/PhotoItem';
import type {
  PhotosTabConfig,
  FileUploadResult,
  PhotoUploadProgress,
  UsePhotosTabUploadReturn,
} from '../config/photos-tab-types';
import { validatePhotoFile } from '../config/photos-tab-config';
import { useEnterpriseFileUpload } from '@/hooks/useEnterpriseFileUpload';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('usePhotosTabUpload');

// =============================================================================
// HOOK PROPS
// =============================================================================

export interface UsePhotosTabUploadProps {
  /** Current photos array */
  photos: Photo[];
  /** Set photos function */
  setPhotos: (photos: Photo[] | ((prev: Photo[]) => Photo[])) => void;
  /** Current file */
  currentFile: File | null;
  /** Set current file */
  setCurrentFile: (file: File | null) => void;
  /** Configuration */
  config: PhotosTabConfig;
  /** Entity ID for storage path */
  entityId: string;
  /** Entity name for file naming */
  entityName?: string;
}

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================

/**
 * Upload logic hook for PhotosTabBase
 *
 * THIN WRAPPER around useEnterpriseFileUpload - adds only PhotosTab-specific logic:
 * - Photos array management (add new photo on completion)
 * - Max photos limit check
 * - PhotosTab-specific validation
 *
 * Uses existing centralized hooks - NO DUPLICATION!
 *
 * @example
 * const uploadLogic = usePhotosTabUpload({
 *   photos,
 *   setPhotos,
 *   currentFile,
 *   setCurrentFile,
 *   config,
 *   entityId: storage.id,
 *   entityName: storage.name,
 * });
 *
 * // In component:
 * <EnterprisePhotoUpload
 *   onFileChange={uploadLogic.handleFileChange}
 *   onUploadComplete={uploadLogic.handleUploadComplete}
 * />
 */
export function usePhotosTabUpload({
  photos,
  setPhotos,
  currentFile,
  setCurrentFile,
  config,
  entityId,
  entityName,
}: UsePhotosTabUploadProps): UsePhotosTabUploadReturn {
  // ---------------------------------------------------------------------------
  // USE EXISTING ENTERPRISE HOOK - NO DUPLICATION!
  // ---------------------------------------------------------------------------
  const enterpriseUpload = useEnterpriseFileUpload({
    fileType: 'image',
    purpose: config.uploadPurpose === 'logo' ? 'logo' : 'photo',
    maxSize: config.maxFileSize,
    acceptedTypes: config.acceptedTypes,
    showToasts: true,
  });

  // ---------------------------------------------------------------------------
  // PhotosTab-specific: Handle file change with max photos check
  // ---------------------------------------------------------------------------
  const handleFileChange = useCallback(
    (file: File | null) => {
      if (!file) {
        setCurrentFile(null);
        return;
      }

      // PhotosTab-specific: Check max photos limit
      if (photos.length >= config.maxPhotos) {
        // Use enterprise hook's error handling
        logger.warn('Max photos limit reached', { maxPhotos: config.maxPhotos });
        return;
      }

      // PhotosTab-specific: Validate with config
      const validation = validatePhotoFile(file, config);
      if (!validation.valid) {
        logger.warn('Validation failed', { error: validation.error });
        return;
      }

      setCurrentFile(file);
    },
    [config, photos.length, setCurrentFile]
  );

  // ---------------------------------------------------------------------------
  // PhotosTab-specific: Handle upload completion - add to photos array
  // ---------------------------------------------------------------------------
  const handleUploadComplete = useCallback(
    (result: FileUploadResult) => {
      if (!currentFile) {
        logger.warn('handleUploadComplete called without currentFile');
        return;
      }

      // FileUploadResult has required url, fileName, fileSize, mimeType
      const { url, fileName } = result;

      if (url) {
        // Create new photo object
        const newPhoto: Photo = {
          id: `photo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          src: url,
          alt: `${entityName || 'Photo'} - ${currentFile.name}`,
          name: fileName || currentFile.name,
          aiHint: `${config.entityType} ${entityName || entityId} uploaded photo`,
        };

        // Add to photos array
        setPhotos((prev) => [...prev, newPhoto]);

        // Clear current file
        setCurrentFile(null);
      }
    },
    [currentFile, entityName, entityId, config.entityType, setPhotos, setCurrentFile]
  );

  // ---------------------------------------------------------------------------
  // Trigger file picker (uses enterprise hook pattern)
  // ---------------------------------------------------------------------------
  const triggerUpload = useCallback(() => {
    // Check max photos limit first
    if (photos.length >= config.maxPhotos) {
      logger.warn('Max photos limit reached', { maxPhotos: config.maxPhotos });
      return;
    }

    // Create and trigger file input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = config.acceptedTypes.join(',');
    input.onchange = (e) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (file) {
        handleFileChange(file);
      }
    };
    input.click();
  }, [photos.length, config.maxPhotos, config.acceptedTypes, handleFileChange]);

  // ---------------------------------------------------------------------------
  // Map enterprise hook progress to PhotosTab format
  // ---------------------------------------------------------------------------
  const progress: PhotoUploadProgress | null = enterpriseUpload.isUploading
    ? {
        phase: enterpriseUpload.uploadPhase as PhotoUploadProgress['phase'],
        progress: enterpriseUpload.progress,
      }
    : null;

  // ---------------------------------------------------------------------------
  // Return API (compatible with UsePhotosTabUploadReturn)
  // ---------------------------------------------------------------------------
  return {
    handleFileChange,
    handleUploadComplete,
    triggerUpload,
    isUploading: enterpriseUpload.isUploading,
    progress,
    error: enterpriseUpload.error,
    clearError: enterpriseUpload.clearError,
  };
}

export default usePhotosTabUpload;
