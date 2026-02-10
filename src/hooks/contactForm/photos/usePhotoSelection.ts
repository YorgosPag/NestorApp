// ============================================================================
// PHOTO SELECTION HOOK - ENTERPRISE MODULE
// ============================================================================
//
// 👤 Profile photo selection logic for individual contacts
// Handles which photo from multiple photos is selected as the main profile photo
// Part of modular Enterprise contact form hooks architecture
//
// ============================================================================

import { useCallback } from 'react';
import type { ContactFormData } from '@/types/ContactFormTypes';
import { createModuleLogger } from '@/lib/telemetry';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface UsePhotoSelectionReturn {
  // Profile photo selection
  handleProfilePhotoSelection: (
    index: number,
    formData: ContactFormData,
    setFormData: (data: ContactFormData) => void
  ) => void;
}

const logger = createModuleLogger('usePhotoSelection');

// ============================================================================
// PHOTO SELECTION HOOK
// ============================================================================

/**
 * Photo selection management hook
 *
 * Handles profile photo selection logic for individual contacts.
 * Manages which photo from the multiple photos array is the main profile photo.
 *
 * Features:
 * - Profile photo index selection
 * - State synchronization
 * - Individual contact focus
 */
export function usePhotoSelection(): UsePhotoSelectionReturn {
  // ========================================================================
  // SELECTION HANDLERS
  // ========================================================================

  /**
   * Handle profile photo selection (for Individual - selects which photo from multiplePhotos is the profile)
   */
  const handleProfilePhotoSelection = useCallback((
    index: number,
    formData: ContactFormData,
    setFormData: (data: ContactFormData) => void
  ) => {
    logger.info('Profile photo selected at index', { index });

    setFormData({
      ...formData,
      selectedProfilePhotoIndex: index
    });
  }, []);

  // ========================================================================
  // RETURN API
  // ========================================================================

  return {
    handleProfilePhotoSelection
  };
}