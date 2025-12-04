import { useState, useCallback } from 'react';
import type { ContactFormData } from '@/types/ContactFormTypes';
import { initialFormData } from '@/types/ContactFormTypes';
import type { PhotoSlot } from '@/components/ui/MultiplePhotosUpload';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface UseContactFormStateReturn {
  // State
  formData: ContactFormData;

  // Basic setters
  setFormData: (data: ContactFormData) => void;

  // Field handlers
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleSelectChange: (name: string, value: string) => void;
  handleNestedChange: (path: string, value: any) => void;

  // File handlers
  handleFileChange: (file: File | null) => void;
  handleLogoChange: (file: File | null) => void;
  handleMultiplePhotosChange: (photos: PhotoSlot[]) => void;

  // Upload completion handlers
  handleUploadedPhotoURL: (photoURL: string) => void;
  handleUploadedLogoURL: (logoURL: string) => void;
  handleMultiplePhotoUploadComplete: (index: number, result: any) => void;

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

  // ΒΡΩΜΙΚΟ FORCE UPDATE - ΜΟΝΟ ΓΙΑ ΔΗΜΟΣΙΕΣ ΥΠΗΡΕΣΙΕΣ
  const [forceUpdate, setForceUpdate] = useState(0);

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
  }, []);

  /**
   * Handle nested object field changes (π.χ. serviceAddress.street)
   */
  const handleNestedChange = useCallback((path: string, value: any) => {
    const keys = path.split('.');
    setFormData(prev => {
      const newFormData = { ...prev };
      let current: any = newFormData;

      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
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
    setFormData(prev => ({
      ...prev,
      multiplePhotos: photos
    }));
  }, []);

  // ========================================================================
  // UPLOAD COMPLETION HANDLERS
  // ========================================================================

  /**
   * Handle uploaded photo URL update (after enterprise upload)
   */
  const handleUploadedPhotoURL = useCallback((photoURL: string) => {

    setFormData(prev => {
      // 🧹 CLEANUP: Revoke old blob URL if exists
      if (prev.photoPreview && prev.photoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(prev.photoPreview);
      }

      return {
        ...prev,
        photoFile: null, // Καθαρισμός του file μετά successful upload
        photoPreview: photoURL // Ενημέρωση με το uploaded URL
      };
    });
  }, []);

  /**
   * Handle uploaded logo URL update (after enterprise upload)
   */
  const handleUploadedLogoURL = useCallback((logoURL: string) => {
    console.log('🟢 handleUploadedLogoURL called with:', logoURL);

    setFormData(prev => {
      if (logoURL === '' || logoURL == null) {
        console.log('🟢 CLEARING LOGO - EMPTY URL RECEIVED');
        return {
          ...prev,
          logoFile: null,
          logoPreview: '',
          logoURL: ''
        };
      }

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
  const handleMultiplePhotoUploadComplete = useCallback((index: number, result: any) => {
    setFormData(prev => {
      const newPhotos = JSON.parse(JSON.stringify([...prev.multiplePhotos])); // 🔥 Deep copy για να force re-render

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

      return {
        ...prev,
        multiplePhotos: newPhotos
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

  }, []); // 🔧 FIX: Empty dependencies - prevents infinite loop

  // ========================================================================
  // RETURN API
  // ========================================================================

  return {
    // State
    formData,

    // Basic setters
    setFormData,

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