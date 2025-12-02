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

  // ========================================================================
  // BASIC FIELD HANDLERS
  // ========================================================================

  /**
   * Handle input/textarea changes
   */
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
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
    console.log('🔥 handleFileChange called με:', file?.name);

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

    console.log('✅ handleFileChange: File updated in state');
  }, []);

  /**
   * Handle logo file changes
   */
  const handleLogoChange = useCallback((file: File | null) => {
    console.log('🔥 handleLogoChange called με:', file?.name);

    setFormData(prev => {
      // 🧹 CLEANUP: Revoke old blob URL if exists
      if (prev.logoPreview && prev.logoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(prev.logoPreview);
      }

      if (!file) {
        return {
          ...prev,
          logoFile: null,
          logoPreview: ''
        };
      }

      // Create temporary preview URL
      return {
        ...prev,
        logoFile: file,
        logoPreview: URL.createObjectURL(file)
      };
    });

    console.log('✅ handleLogoChange: File updated in state');
  }, []);

  /**
   * Handle multiple photos changes
   */
  const handleMultiplePhotosChange = useCallback((photos: PhotoSlot[]) => {
    console.log('🎯📸 MULTIPLE: Photos changed:', photos.length);
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
    console.log('🎯📸 UPLOAD COMPLETE: Updating photoPreview με uploaded URL:', photoURL);

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
    console.log('🎯🏢 UPLOAD COMPLETE: Updating logoPreview με uploaded URL:', logoURL);

    setFormData(prev => {
      // 🧹 CLEANUP: Revoke old blob URL if exists
      if (prev.logoPreview && prev.logoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(prev.logoPreview);
      }

      return {
        ...prev,
        logoFile: null, // Καθαρισμός του file μετά successful upload
        logoPreview: logoURL // Ενημέρωση με το uploaded URL
      };
    });
  }, []);

  /**
   * Handle single multiple photo upload completion
   */
  const handleMultiplePhotoUploadComplete = useCallback((index: number, result: any) => {
    console.log(`🎯📸 MULTIPLE: Photo ${index + 1} upload complete:`, result.url);

    setFormData(prev => {
      const newPhotos = [...prev.multiplePhotos];
      if (newPhotos[index]) {
        newPhotos[index] = {
          ...newPhotos[index],
          uploadUrl: result.url
        };
      }

      return {
        ...prev,
        multiplePhotos: newPhotos
      };
    });
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
    if (formData.photoPreview && formData.photoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(formData.photoPreview);
    }
    if (formData.logoPreview && formData.logoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(formData.logoPreview);
    }

    // Cleanup multiple photos blob URLs
    formData.multiplePhotos.forEach(photo => {
      if (photo.preview && photo.preview.startsWith('blob:')) {
        URL.revokeObjectURL(photo.preview);
      }
    });

    setFormData(initialFormData);
    console.log('✅ Form reset to initial state');
  }, [formData]);

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

    // Drag & drop handlers
    handleDrop,
    handleDragOver,

    // Reset
    resetForm
  };
}