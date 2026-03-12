// ============================================================================
// UPLOAD COMPLETION HOOK - ENTERPRISE MODULE
// ============================================================================
//
// ✅ Upload completion handlers for successful file uploads
// Handles state updates after enterprise upload services complete
// Part of modular Enterprise contact form hooks architecture
//
// ============================================================================

import { useCallback } from 'react';
import { flushSync } from 'react-dom';
import type { ContactFormData } from '@/types/ContactFormTypes';
import { deepClone } from '@/lib/clone-utils';
import { useMemoryCleanup } from './useMemoryCleanup';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('useUploadCompletion');

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

// 🏢 ENTERPRISE: Type-safe upload result interface
export interface PhotoUploadResult {
  url?: string;
  fileName?: string;
  storagePath?: string;
  compressionInfo?: {
    wasCompressed: boolean;
    originalSize: number;
    compressedSize: number;
  };
}

export interface UseUploadCompletionReturn {
  // Upload completion handlers
  handleUploadedPhotoURL: (
    photoURL: string,
    formData: ContactFormData,
    setFormData: (data: ContactFormData) => void
  ) => void;
  handleUploadedLogoURL: (
    logoURL: string,
    formData: ContactFormData,
    setFormData: (data: ContactFormData) => void
  ) => void;
  handleMultiplePhotoUploadComplete: (
    index: number,
    result: PhotoUploadResult,
    formData: ContactFormData,
    setFormData: (data: ContactFormData) => void
  ) => void;
}

// ============================================================================
// UPLOAD COMPLETION HOOK
// ============================================================================

/**
 * Upload completion handlers hook
 *
 * Manages state updates after successful enterprise file uploads.
 * Includes proper memory cleanup and state synchronization.
 *
 * Features:
 * - Photo upload completion handling
 * - Logo upload completion handling
 * - Multiple photos upload completion
 * - Synchronous state updates with flushSync
 * - Automatic memory cleanup
 */
export function useUploadCompletion(): UseUploadCompletionReturn {
  const { revokePhotoPreview } = useMemoryCleanup();

  // ========================================================================
  // UPLOAD COMPLETION HANDLERS
  // ========================================================================

  /**
   * Handle uploaded photo URL update (after enterprise upload)
   */
  const handleUploadedPhotoURL = useCallback((
    photoURL: string,
    formData: ContactFormData,
    setFormData: (data: ContactFormData) => void
  ) => {
    logger.info('handleUploadedPhotoURL called', {
      isEmpty: photoURL === '' || photoURL == null,
      isFirebase: photoURL?.includes('firebasestorage.googleapis.com'),
      isBlobURL: photoURL?.startsWith('blob:'),
      photoURLLength: photoURL?.length,
    });

    // 🔥 CRITICAL FIX: Use flushSync for synchronous state update
    flushSync(() => {
      logger.info('Before update - previous formData', {
        prevPhotoFile: !!formData.photoFile,
        prevPhotoPreviewType: formData.photoPreview?.startsWith('blob:') ? 'BLOB' : 'OTHER'
      });

      // 🧹 CLEANUP: Revoke old blob URL if exists
      revokePhotoPreview(formData);

      const newFormData = {
        ...formData,
        photoFile: null, // Καθαρισμός του file μετά successful upload
        photoPreview: photoURL, // Ενημέρωση με το uploaded URL (legacy)
        photoURL: photoURL // 🔥 FIX: Also update photoURL field for UnifiedPhotoManager validation
      };

      logger.info('SYNCHRONOUSLY Updated formData', {
        newPhotoFile: !!newFormData.photoFile,
        bothFieldsSet: !!newFormData.photoPreview && !!newFormData.photoURL,
        bothFieldsMatch: newFormData.photoPreview === newFormData.photoURL,
        isFirebaseURL: newFormData.photoURL?.includes('firebasestorage.googleapis.com')
      });

      setFormData(newFormData);
    });

    logger.info('handleUploadedPhotoURL SYNCHRONOUS update completed successfully');
  }, [revokePhotoPreview]);

  /**
   * Handle uploaded logo URL update (after enterprise upload)
   */
  const handleUploadedLogoURL = useCallback((
    logoURL: string,
    formData: ContactFormData,
    setFormData: (data: ContactFormData) => void
  ) => {
    logger.info('handleUploadedLogoURL called', { isEmpty: logoURL === '' || logoURL == null });

    if (logoURL === '' || logoURL == null) {
      logger.info('Clearing logo URL');
      setFormData({
        ...formData,
        logoFile: null,
        logoPreview: '',
        logoURL: ''
      });
      return;
    }

    logger.info('Setting logo URL in formData');
    setFormData({
      ...formData,
      logoFile: null,
      logoPreview: logoURL,
      logoURL: logoURL
    });
  }, []);

  /**
   * Handle single multiple photo upload completion
   */
  const handleMultiplePhotoUploadComplete = useCallback((
    index: number,
    result: PhotoUploadResult,
    formData: ContactFormData,
    setFormData: (data: ContactFormData) => void
  ) => {
    logger.info('Multiple photo upload complete', { index, hasUrl: !!result.url });

    const newPhotos = deepClone([...formData.multiplePhotos]); // 🔥 Deep copy για να force re-render

    if (newPhotos[index]) {
      // ΑΝ ΕΙΝΑΙ ΚΕΝΟ URL → ΚΑΘΑΡΙΖΟΥΜΕ ΤΟ SLOT ΕΝΤΕΛΩΣ
      if (!result.url || result.url === '') {
        newPhotos[index] = {
          file: null,
          preview: undefined,
          uploadUrl: undefined,
          fileName: undefined,
          isUploading: false,
          uploadProgress: 0,
          error: undefined
        };
      } else {
        // ΚΑΝΟΝΙΚΟ UPLOAD
        newPhotos[index] = {
          ...newPhotos[index],
          uploadUrl: result.url,
          fileName: result.fileName // 🔥 ΔΙΟΡΘΩΣΗ: Αποθήκευση custom filename για UI εμφάνιση
        };
      }
    }

    // 🔧 ΚΡΙΣΙΜΗ ΔΙΟΡΘΩΣΗ: Reset του selectedProfilePhotoIndex αν χρειάζεται
    let newSelectedIndex = formData.selectedProfilePhotoIndex;

    // Αν το επιλεγμένο slot αφαιρέθηκε, reset στο πρώτο valid slot ή undefined
    if (newSelectedIndex !== undefined) {
      const selectedSlot = newPhotos[newSelectedIndex];
      if (!selectedSlot?.uploadUrl && !selectedSlot?.preview) {
        // Βρες το πρώτο valid slot
        const firstValidIndex = newPhotos.findIndex((photo: unknown) => {
          const p = photo as { uploadUrl?: string; preview?: string } | null | undefined;
          return p?.uploadUrl || p?.preview;
        });
        newSelectedIndex = firstValidIndex >= 0 ? firstValidIndex : undefined;
      }
    }

    setFormData({
      ...formData,
      multiplePhotos: newPhotos,
      selectedProfilePhotoIndex: newSelectedIndex
    });
  }, []);

  // ========================================================================
  // RETURN API
  // ========================================================================

  return {
    handleUploadedPhotoURL,
    handleUploadedLogoURL,
    handleMultiplePhotoUploadComplete
  };
}