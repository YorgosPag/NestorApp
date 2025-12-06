// ============================================================================
// MEMORY CLEANUP HOOK - ENTERPRISE MODULE
// ============================================================================
//
// 🧹 Memory management utilities for blob URLs and file objects
// Handles proper cleanup of temporary URLs to prevent memory leaks
// Part of modular Enterprise contact form hooks architecture
//
// ============================================================================

import { useCallback } from 'react';
import type { ContactFormData } from '@/types/ContactFormTypes';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface UseMemoryCleanupReturn {
  // Cleanup functions
  revokePhotoPreview: (formData: ContactFormData) => void;
  revokeLogoPreview: (formData: ContactFormData) => void;
  revokeMultiplePhotoPreviews: (formData: ContactFormData) => void;
  revokeAllBlobUrls: (formData: ContactFormData) => void;
}

// ============================================================================
// MEMORY CLEANUP HOOK
// ============================================================================

/**
 * Memory cleanup utilities hook
 *
 * Provides utilities for proper cleanup of blob URLs and file objects
 * to prevent memory leaks in file upload scenarios.
 *
 * Features:
 * - Photo preview URL cleanup
 * - Logo preview URL cleanup
 * - Multiple photos preview cleanup
 * - Bulk cleanup utilities
 */
export function useMemoryCleanup(): UseMemoryCleanupReturn {
  // ========================================================================
  // CLEANUP FUNCTIONS
  // ========================================================================

  /**
   * Revoke photo preview blob URL if it exists
   */
  const revokePhotoPreview = useCallback((formData: ContactFormData) => {
    if (formData.photoPreview && formData.photoPreview.startsWith('blob:')) {
      console.log('🧹 MEMORY: Revoking photo preview blob URL:', formData.photoPreview.substring(0, 50));
      URL.revokeObjectURL(formData.photoPreview);
    }
  }, []);

  /**
   * Revoke logo preview blob URL if it exists
   */
  const revokeLogoPreview = useCallback((formData: ContactFormData) => {
    if (formData.logoPreview && formData.logoPreview.startsWith('blob:')) {
      console.log('🧹 MEMORY: Revoking logo preview blob URL:', formData.logoPreview.substring(0, 50));
      URL.revokeObjectURL(formData.logoPreview);
    }
  }, []);

  /**
   * Revoke all multiple photos preview blob URLs
   */
  const revokeMultiplePhotoPreviews = useCallback((formData: ContactFormData) => {
    formData.multiplePhotos.forEach((photo, index) => {
      if (photo.preview && photo.preview.startsWith('blob:')) {
        console.log(`🧹 MEMORY: Revoking multiple photo[${index}] blob URL:`, photo.preview.substring(0, 50));
        URL.revokeObjectURL(photo.preview);
      }
    });
  }, []);

  /**
   * Revoke all blob URLs in form data
   */
  const revokeAllBlobUrls = useCallback((formData: ContactFormData) => {
    console.log('🧹 MEMORY: Starting complete blob URL cleanup');
    revokePhotoPreview(formData);
    revokeLogoPreview(formData);
    revokeMultiplePhotoPreviews(formData);
    console.log('🧹 MEMORY: Complete blob URL cleanup finished');
  }, [revokePhotoPreview, revokeLogoPreview, revokeMultiplePhotoPreviews]);

  // ========================================================================
  // RETURN API
  // ========================================================================

  return {
    revokePhotoPreview,
    revokeLogoPreview,
    revokeMultiplePhotoPreviews,
    revokeAllBlobUrls
  };
}