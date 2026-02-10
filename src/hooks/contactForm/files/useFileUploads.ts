// ============================================================================
// FILE UPLOADS HOOK - ENTERPRISE MODULE
// ============================================================================
//
// 📁 File upload state management and handlers
// Handles photo files, logo files, and multiple photos state updates
// Part of modular Enterprise contact form hooks architecture
//
// ============================================================================

import { useCallback } from 'react';
import type { ContactFormData } from '@/types/ContactFormTypes';
import type { PhotoSlot } from '@/components/ui/MultiplePhotosUpload';
import { useMemoryCleanup } from './useMemoryCleanup';
import { createModuleLogger } from '@/lib/telemetry';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface UseFileUploadsReturn {
  // File handlers
  handleFileChange: (
    file: File | null,
    formData: ContactFormData,
    setFormData: (data: ContactFormData) => void
  ) => void;
  handleLogoChange: (
    file: File | null,
    formData: ContactFormData,
    setFormData: (data: ContactFormData) => void
  ) => void;
  handleMultiplePhotosChange: (
    photos: PhotoSlot[],
    formData: ContactFormData,
    setFormData: (data: ContactFormData) => void
  ) => void;
}

const logger = createModuleLogger('useFileUploads');

// ============================================================================
// FILE UPLOADS HOOK
// ============================================================================

/**
 * File uploads management hook
 *
 * Handles file upload state changes and temporary preview URL creation.
 * Includes proper memory cleanup for blob URLs.
 *
 * Features:
 * - Photo file upload handling
 * - Logo file upload handling
 * - Multiple photos state management
 * - Automatic memory cleanup
 * - Blob URL creation and management
 */
export function useFileUploads(): UseFileUploadsReturn {
  const { revokePhotoPreview, revokeLogoPreview } = useMemoryCleanup();

  // ========================================================================
  // FILE HANDLERS
  // ========================================================================

  /**
   * Handle main photo file changes
   */
  const handleFileChange = useCallback((
    file: File | null,
    formData: ContactFormData,
    setFormData: (data: ContactFormData) => void
  ) => {
    logger.info('handleFileChange called', { fileName: file?.name });

    setFormData({
      ...formData,
      photoFile: file,
      photoPreview: file ? URL.createObjectURL(file) : ''
    });

    // 🧹 CLEANUP: Revoke old blob URL if exists
    if (file === null) {
      revokePhotoPreview(formData);
    }
  }, [revokePhotoPreview]);

  /**
   * Handle logo file changes
   */
  const handleLogoChange = useCallback((
    file: File | null,
    formData: ContactFormData,
    setFormData: (data: ContactFormData) => void
  ) => {
    logger.info('handleLogoChange called', { fileName: file?.name });

    // 🧹 CLEANUP: Revoke old blob URL if exists
    revokeLogoPreview(formData);

    if (!file) {
      setFormData({
        ...formData,
        logoFile: null,
        logoPreview: '',
        logoURL: '' // Καθαρισμός και του logoURL
      });
      return;
    }

    // Create temporary preview URL
    setFormData({
      ...formData,
      logoFile: file,
      logoPreview: URL.createObjectURL(file)
    });
  }, [revokeLogoPreview]);

  /**
   * Handle multiple photos changes
   */
  const handleMultiplePhotosChange = useCallback((
    photos: PhotoSlot[],
    formData: ContactFormData,
    setFormData: (data: ContactFormData) => void
  ) => {
    logger.info('handleMultiplePhotosChange called', {
      length: photos.length,
      isEmpty: photos.length === 0
    });

    const newFormData = {
      ...formData,
      multiplePhotos: photos,
      // 🔥 CRITICAL FIX: Clear photoPreview when no photos remain
      photoPreview: photos.length === 0 ? '' : formData.photoPreview
    };

    logger.info('Updated formData', {
      multiplePhotosLength: newFormData.multiplePhotos.length,
      photoPreviewCleared: photos.length === 0
    });

    setFormData(newFormData);
  }, []);

  // ========================================================================
  // RETURN API
  // ========================================================================

  return {
    handleFileChange,
    handleLogoChange,
    handleMultiplePhotosChange
  };
}