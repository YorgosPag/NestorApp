import { useEffect } from 'react';
import type { Contact } from '@/types/contacts';
import type { ContactFormData } from '@/types/ContactFormTypes';
import { mapContactToFormData } from '@/utils/contactForm/contactMapper';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/** Photo slot structure for multiple photos */
interface PhotoSlotData {
  uploadUrl?: string;
  url?: string;
  fileName?: string;
  [key: string]: unknown;
}

interface UseContactDataLoaderProps {
  editContact?: Contact | null;
  isModalOpen?: boolean;
  setFormData: (data: ContactFormData) => void;
  handleMultiplePhotosChange: (photos: PhotoSlotData[]) => void;
  resetForm: () => void;
}

// ============================================================================
// 🔥 EXTRACTED: CONTACT DATA LOADING FUNCTIONALITY
// ============================================================================

/**
 * Contact Data Loader Hook - Specialized για contact data management
 *
 * Extracted από useContactForm για Single Responsibility Principle.
 * Χειρίζεται μόνο το loading/editing/resetting των contact data.
 *
 * Features:
 * - Contact-to-FormData mapping
 * - Edit mode initialization
 * - Form reset για νέες επαφές
 * - Empty photos array handling
 * - Error handling με fallback
 */
export function useContactDataLoader({
  editContact,
  isModalOpen,
  setFormData,
  handleMultiplePhotosChange,
  resetForm
}: UseContactDataLoaderProps) {

  // ========================================================================
  // CONTACT DATA LOADING (Edit Mode)
  // ========================================================================

  /**
   * Load contact data when editing OR reset form when modal opens for new contact
   */
  useEffect(() => {
    // 🔧 FIX: Track modal state για proper form reset
    if (isModalOpen === false) {
      // Modal closed - no action needed
      return;
    }

    if (editContact) {
      // ========================================================================
      // EDIT MODE: Load existing contact data
      // ========================================================================

      try {
        const mappingResult = mapContactToFormData(editContact);

        if (mappingResult.warnings.length > 0) {
          console.warn('⚠️ DATA LOADER: Contact mapping warnings:', mappingResult.warnings);
        }

        setFormData({
          ...mappingResult.formData,
          // 🔥 ΚΡΙΣΙΜΗ ΔΙΟΡΘΩΣΗ: Force clear photos array όταν η βάση έχει κενό array
          multiplePhotos: Array.isArray(mappingResult.formData.multiplePhotos) &&
                          mappingResult.formData.multiplePhotos.length === 0
                          ? []
                          : mappingResult.formData.multiplePhotos || []
        });

        // Επιπλέον: Force update το UI state για φωτογραφίες
        setTimeout(() => {
          if (Array.isArray(mappingResult.formData.multiplePhotos) &&
              mappingResult.formData.multiplePhotos.length === 0) {
            console.log('🛠️ DATA LOADER: Database has empty photos array - forcing UI update');
            // Καλεί την συνάρτηση που ενημερώνει τα photos στο UI
            if (typeof handleMultiplePhotosChange === 'function') {
              handleMultiplePhotosChange([]);
            }
          }
        }, 50);

      } catch (error) {
        console.error('❌ DATA LOADER: Failed to load contact data:', error);
        resetForm();
      }

    } else if (isModalOpen === true) {
      // ========================================================================
      // NEW CONTACT MODE: Reset form
      // ========================================================================

      console.log('🆕 DATA LOADER: New contact mode, resetting form (modal opened)');
      resetForm();
    }
  }, [
    editContact?.id,
    isModalOpen,
    editContact?.updatedAt, // 🔥 FINAL FIX: Force refresh on every edit - track ID + timestamp
    setFormData,
    handleMultiplePhotosChange,
    resetForm
  ]);

  // ========================================================================
  // RETURN API (Read-only information)
  // ========================================================================

  return {
    isEditMode: Boolean(editContact),
    contactId: editContact?.id,
    contactType: editContact?.type
  };
}