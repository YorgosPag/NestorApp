import React, { useState, useCallback } from 'react';
import { flushSync } from 'react-dom';
import type { ContactFormData } from '@/types/ContactFormTypes';
import { initialFormData } from '@/types/ContactFormTypes';
import type { PhotoSlot } from '@/components/ui/MultiplePhotosUpload';
import { deepClone } from '@/lib/clone-utils';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('useContactFormState');

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/** Result from multiple photo upload operation */
interface MultiplePhotoUploadResult {
  url?: string;
  fileName?: string;
}

export interface UseContactFormStateReturn {
  // State
  formData: ContactFormData;
  validationErrors: Record<string, string>;
  touchedFields: Record<string, boolean>;

  // Basic setters
  setFormData: React.Dispatch<React.SetStateAction<ContactFormData>>;
  setValidationErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setTouchedFields: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;

  // Field handlers
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleSelectChange: (name: string, value: string) => void;
  handleNestedChange: (path: string, value: unknown) => void;

  // File handlers
  handleFileChange: (file: File | null) => void;
  handleLogoChange: (file: File | null) => void;
  handleMultiplePhotosChange: (photos: PhotoSlot[]) => void;

  // Upload completion handlers
  handleUploadedPhotoURL: (photoURL: string) => void;
  handleUploadedLogoURL: (logoURL: string) => void;
  handleMultiplePhotoUploadComplete: (index: number, result: MultiplePhotoUploadResult) => void;

  // Profile photo selection
  handleProfilePhotoSelection: (index: number) => void;

  // Drag & drop handlers
  handleDrop: (e: React.DragEvent) => void;
  handleDragOver: (e: React.DragEvent) => void;

  // Reset
  resetForm: () => void;
}

// ============================================================================
// MAIN HOOK
// ============================================================================

/**
 * Contact Form State Management Hook
 *
 * Enterprise-class state management για contact forms.
 * Διαχειρίζεται όλο το form state και τους βασικούς handlers.
 *
 * Features:
 * - Centralized form state management
 * - Type-safe field handlers
 * - File upload state tracking
 * - Nested object field updates
 * - Drag & drop support
 * - Memory cleanup για blob URLs
 */
export function useContactFormState(): UseContactFormStateReturn {
  // ========================================================================
  // STATE
  // ========================================================================

  const [formData, setFormData] = useState<ContactFormData>(initialFormData);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});


  // ========================================================================
  // BASIC FIELD HANDLERS
  // ========================================================================

  /**
   * Handle input/textarea changes
   */
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    setFormData(prev => {
      const newFormData = { ...prev, [name]: value };

      // 🔧 FIX: Service contact serviceName/name field synchronization
      // Το service-config χρησιμοποιεί 'name' ενώ η βάση δεδομένων αποθηκεύει 'serviceName'
      // Συγχρονίζουμε και τα δύο πεδία για compatibility
      if (name === 'serviceName' && prev.type === 'service') {
        newFormData.name = value; // Sync serviceName → name για service-config
      } else if (name === 'name' && prev.type === 'service') {
        newFormData.serviceName = value; // Sync name → serviceName για database
      }

      return newFormData;
    });

    setValidationErrors(prev => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      if (name === 'serviceName') delete next.name;
      if (name === 'name') delete next.serviceName;
      return next;
    });
  }, []);

  /**
   * Handle select field changes
   */
  const handleSelectChange = useCallback((name: string, value: string) => {
    if (name === 'isBranch') {
      setFormData(prev => ({ ...prev, [name]: value === 'true' }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }

    setValidationErrors(prev => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }, []);

  /**
   * Handle nested object field changes (π.χ. serviceAddress.street)
   */
  const handleNestedChange = useCallback((path: string, value: unknown) => {
    const keys = path.split('.');
    setFormData(prev => {
      const newFormData = { ...prev };
      let current: Record<string, unknown> = newFormData as Record<string, unknown>;

      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]] as Record<string, unknown>;
      }
      current[keys[keys.length - 1]] = value;

      return newFormData;
    });
  }, []);

  // ========================================================================
  // FILE UPLOAD HANDLERS
  // ========================================================================

  /**
   * Handle main photo file changes
   */
  const handleFileChange = useCallback((file: File | null) => {

    setFormData(prev => {
      // 🧹 CLEANUP: Revoke old blob URL if exists
      if (prev.photoPreview && prev.photoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(prev.photoPreview);
      }

      if (!file) {
        return {
          ...prev,
          photoFile: null,
          photoPreview: ''
        };
      }

      // Create temporary preview URL
      return {
        ...prev,
        photoFile: file,
        photoPreview: URL.createObjectURL(file)
      };
    });

  }, []);

  /**
   * Handle logo file changes
   */
  const handleLogoChange = useCallback((file: File | null) => {

    setFormData(prev => {
      // 🧹 CLEANUP: Revoke old blob URL if exists
      if (prev.logoPreview && prev.logoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(prev.logoPreview);
      }

      if (!file) {
        return {
          ...prev,
          logoFile: null,
          logoPreview: '',
          logoURL: '' // Καθαρισμός και του logoURL
        };
      }

      // Create temporary preview URL
      return {
        ...prev,
        logoFile: file,
        logoPreview: URL.createObjectURL(file)
      };
    });

  }, []);

  /**
   * Handle multiple photos changes
   */
  const handleMultiplePhotosChange = useCallback((photos: PhotoSlot[]) => {
    logger.info('handleMultiplePhotosChange called', {
      length: photos.length,
      isEmpty: photos.length === 0
    });

    // 🔥 CRITICAL FIX: Use flushSync for synchronous state update
    flushSync(() => {
      setFormData(prev => {
        const newFormData = {
          ...prev,
          multiplePhotos: photos,
          // 🔥 CRITICAL FIX: Clear photoPreview when no photos remain
          photoPreview: photos.length === 0 ? '' : prev.photoPreview
        };
        logger.info('SYNCHRONOUSLY Updated formData', {
          multiplePhotosLength: newFormData.multiplePhotos.length,
          photoPreviewCleared: photos.length === 0
        });
        return newFormData;
      });
    });

    logger.info('Synchronous update completed');
  }, []);

  // ========================================================================
  // UPLOAD COMPLETION HANDLERS
  // ========================================================================

  /**
   * Handle uploaded photo URL update (after enterprise upload)
   */
  const handleUploadedPhotoURL = useCallback((photoURL: string) => {
    logger.info('handleUploadedPhotoURL called', {
      isEmpty: photoURL === '' || photoURL == null,
      isFirebase: photoURL?.includes('firebasestorage.googleapis.com'),
      photoURLLength: photoURL?.length
    });

    // 🔥 CRITICAL FIX: Use flushSync for synchronous state update (same as handleMultiplePhotosChange)
    flushSync(() => {
      setFormData(prev => {
        logger.info('Before update - previous formData', {
          prevPhotoFile: !!prev.photoFile,
          prevPhotoPreviewType: prev.photoPreview?.startsWith('blob:') ? 'BLOB' : 'OTHER'
        });

        // 🧹 CLEANUP: Revoke old blob URL if exists
        if (prev.photoPreview && prev.photoPreview.startsWith('blob:')) {
          logger.info('Revoking old blob URL');
          URL.revokeObjectURL(prev.photoPreview);
        }

        const newFormData = {
          ...prev,
          photoFile: null, // Καθαρισμός του file μετά successful upload
          photoPreview: photoURL, // Ενημέρωση με το uploaded URL (legacy)
          photoURL: photoURL // 🔥 FIX: Also update photoURL field for UnifiedPhotoManager validation
        };

        logger.info('SYNCHRONOUSLY Updated formData', {
          newPhotoFile: !!newFormData.photoFile,
          bothFieldsMatch: newFormData.photoPreview === newFormData.photoURL,
          isFirebaseURL: newFormData.photoURL?.includes('firebasestorage.googleapis.com')
        });

        return newFormData;
      });
    });

    logger.info('handleUploadedPhotoURL SYNCHRONOUS update completed successfully');
  }, []);

  /**
   * Handle uploaded logo URL update (after enterprise upload)
   */
  const handleUploadedLogoURL = useCallback((logoURL: string) => {
    logger.info('handleUploadedLogoURL called', { logoURL, isEmpty: logoURL === '' || logoURL == null });

    setFormData(prev => {
      if (logoURL === '' || logoURL == null) {
        logger.info('Clearing logo URL');
        return {
          ...prev,
          logoFile: null,
          logoPreview: '',
          logoURL: ''
        };
      }

      logger.info('Setting logo URL in formData');
      return {
        ...prev,
        logoFile: null,
        logoPreview: logoURL,
        logoURL: logoURL
      };
    });
  }, [setFormData]);

  /**
   * Handle single multiple photo upload completion
   */
  const handleMultiplePhotoUploadComplete = useCallback((index: number, result: MultiplePhotoUploadResult) => {
    setFormData(prev => {
      const newPhotos = deepClone([...prev.multiplePhotos]); // 🔥 Deep copy για να force re-render

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
      let newSelectedIndex = prev.selectedProfilePhotoIndex;

      // Αν το επιλεγμένο slot αφαιρέθηκε, reset στο πρώτο valid slot ή undefined
      if (newSelectedIndex !== undefined) {
        const selectedSlot = newPhotos[newSelectedIndex];
        if (!selectedSlot?.uploadUrl && !selectedSlot?.preview) {
          // Βρες το πρώτο valid slot
          const firstValidIndex = newPhotos.findIndex((photo: PhotoSlot) =>
            photo?.uploadUrl || photo?.preview
          );
          newSelectedIndex = firstValidIndex >= 0 ? firstValidIndex : undefined;
        }
      }

      return {
        ...prev,
        multiplePhotos: newPhotos,
        selectedProfilePhotoIndex: newSelectedIndex
      };
    });
  }, []);

  // ========================================================================
  // PROFILE PHOTO SELECTION
  // ========================================================================

  /**
   * Handle profile photo selection (for Individual - selects which photo from multiplePhotos is the profile)
   */
  const handleProfilePhotoSelection = useCallback((index: number) => {

    setFormData(prev => ({
      ...prev,
      selectedProfilePhotoIndex: index
    }));
  }, []);

  // ========================================================================
  // DRAG & DROP HANDLERS
  // ========================================================================

  /**
   * Handle file drop
   */
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileChange(files[0]);
    }
  }, [handleFileChange]);

  /**
   * Handle drag over
   */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  // ========================================================================
  // UTILITY FUNCTIONS
  // ========================================================================

  /**
   * Reset form to initial state
   */
  const resetForm = useCallback(() => {

    // 🧹 CLEANUP: Revoke any blob URLs before reset
    setFormData(prevFormData => {
      // Cleanup photo preview URL
      if (prevFormData.photoPreview && prevFormData.photoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(prevFormData.photoPreview);
      }

      // Cleanup logo preview URL
      if (prevFormData.logoPreview && prevFormData.logoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(prevFormData.logoPreview);
      }

      // Cleanup multiple photos blob URLs
      prevFormData.multiplePhotos.forEach(photo => {
        if (photo.preview && photo.preview.startsWith('blob:')) {
          URL.revokeObjectURL(photo.preview);
        }
      });

      return initialFormData;
    });

    setValidationErrors({});
    setTouchedFields({});
  }, []); // 🔧 FIX: Empty dependencies - prevents infinite loop

  // ========================================================================
  // RETURN API
  // ========================================================================

  return {
    // State
    formData,
    validationErrors,
    touchedFields,

    // Basic setters
    setFormData,
    setValidationErrors,
    setTouchedFields,

    // Field handlers
    handleChange,
    handleSelectChange,
    handleNestedChange,

    // File handlers
    handleFileChange,
    handleLogoChange,
    handleMultiplePhotosChange,

    // Upload completion handlers
    handleUploadedPhotoURL,
    handleUploadedLogoURL,
    handleMultiplePhotoUploadComplete,

    // Profile photo selection
    handleProfilePhotoSelection,

    // Drag & drop handlers
    handleDrop,
    handleDragOver,

    // Reset
    resetForm
  };
}