import { useEffect, useCallback } from 'react';
import type { Contact } from '@/types/contacts';
import { mapContactToFormData } from '@/utils/contactForm/contactMapper';
import { useContactFormState } from './useContactFormState';
import { useContactSubmission } from './useContactSubmission';
import { useContactPhotoHandlers } from './useContactPhotoHandlers';
import { useContactLogoHandlers } from './useContactLogoHandlers';
import { useMultiplePhotosHandlers } from './useMultiplePhotosHandlers';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface UseContactFormProps {
  onContactAdded: () => void;
  onOpenChange: (open: boolean) => void;
  editContact?: Contact | null;
}

// ============================================================================
// MAIN ORCHESTRATOR HOOK
// ============================================================================

/**
 * Contact Form Orchestrator Hook (Enterprise Refactored)
 *
 * Enterprise-class orchestrator που συνδυάζει όλους τους specialized hooks.
 * Αποτελεί το κεντρικό API για το contact form functionality.
 *
 * Architecture:
 * - useContactFormState: Core state management
 * - useContactSubmission: Form submission logic
 * - useContactPhotoHandlers: Photo upload handling
 * - useContactLogoHandlers: Logo upload handling
 * - useMultiplePhotosHandlers: Multiple photos handling
 * - Contact/FormData mappers: Data transformation utilities
 *
 * Benefits:
 * - Single Responsibility Principle
 * - Modular & testable components
 * - Enterprise code organization
 * - Reusable specialized handlers
 */
export function useContactForm({ onContactAdded, onOpenChange, editContact }: UseContactFormProps) {
  console.log('🚀 ORCHESTRATOR: Initializing contact form για edit mode:', Boolean(editContact));

  // ========================================================================
  // CORE HOOKS
  // ========================================================================

  // 1️⃣ Core form state management
  const {
    formData,
    setFormData,
    handleChange,
    handleSelectChange,
    handleNestedChange,
    handleFileChange,
    handleLogoChange,
    handleMultiplePhotosChange,
    handleUploadedPhotoURL,
    handleUploadedLogoURL,
    handleMultiplePhotoUploadComplete,
    handleDrop,
    handleDragOver,
    resetForm
  } = useContactFormState();

  // 2️⃣ Form submission logic
  const {
    loading,
    handleSubmit: submitFormData,
    validateFormData
  } = useContactSubmission({
    editContact,
    onContactAdded,
    onOpenChange,
    resetForm
  });

  // 3️⃣ Photo upload handlers
  const photoHandlers = useContactPhotoHandlers({
    onFileChange: handleFileChange,
    onUploadComplete: handleUploadedPhotoURL
  });

  // 4️⃣ Logo upload handlers
  const logoHandlers = useContactLogoHandlers({
    onLogoChange: handleLogoChange,
    onUploadComplete: handleUploadedLogoURL
  });

  // 5️⃣ Multiple photos handlers
  const multiplePhotosHandlers = useMultiplePhotosHandlers({
    onMultiplePhotosChange: handleMultiplePhotosChange,
    onPhotoUploadComplete: handleMultiplePhotoUploadComplete
  });

  // ========================================================================
  // CONTACT DATA LOADING (Edit Mode)
  // ========================================================================

  /**
   * Load contact data when editing
   */
  useEffect(() => {
    if (editContact) {
      console.log('🔄 ORCHESTRATOR: Loading contact data για edit mode');

      try {
        const mappingResult = mapContactToFormData(editContact);

        if (mappingResult.warnings.length > 0) {
          console.warn('⚠️ ORCHESTRATOR: Contact mapping warnings:', mappingResult.warnings);
        }

        setFormData(mappingResult.formData);
        console.log('✅ ORCHESTRATOR: Contact data loaded successfully');

      } catch (error) {
        console.error('❌ ORCHESTRATOR: Failed to load contact data:', error);
        resetForm();
      }

    } else {
      console.log('🆕 ORCHESTRATOR: New contact mode, resetting form');
      resetForm();
    }
  }, [editContact, setFormData, resetForm]);

  // ========================================================================
  // FORM SUBMISSION WRAPPER
  // ========================================================================

  /**
   * Handle form submission (wraps submission hook)
   */
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('📝 ORCHESTRATOR: Form submission initiated');
    await submitFormData(formData);
  }, [submitFormData, formData]);

  // ========================================================================
  // ENTERPRISE UPLOAD WRAPPER
  // ========================================================================

  /**
   * Enterprise upload handler για multiple photos
   * Wrapper γύρω από το specialized handler
   */
  const handleEnterpriseMultiplePhotoUpload = useCallback(
    multiplePhotosHandlers.handleEnterpriseMultiplePhotoUpload,
    [multiplePhotosHandlers]
  );

  // ========================================================================
  // LEGACY API COMPATIBILITY
  // ========================================================================

  // Για backward compatibility με existing components που χρησιμοποιούν το hook
  const legacyHandlers = {
    // File handlers (με enterprise validation)
    handleFileChange: useCallback((file: File | null) => {
      if (file) {
        photoHandlers.processPhotoFile(file);
      } else {
        photoHandlers.clearPhoto();
      }
    }, [photoHandlers]),

    handleLogoChange: useCallback((file: File | null) => {
      if (file) {
        logoHandlers.processLogoFile(file);
      } else {
        logoHandlers.clearLogo();
      }
    }, [logoHandlers]),

    // Drag & drop (enhanced με validation)
    handleDrop: useCallback((e: React.DragEvent) => {
      photoHandlers.handlePhotoDrop(e);
    }, [photoHandlers]),

    handleDragOver: useCallback((e: React.DragEvent) => {
      photoHandlers.handlePhotoDragOver(e);
    }, [photoHandlers])
  };

  // ========================================================================
  // RETURN API
  // ========================================================================

  console.log('✅ ORCHESTRATOR: Contact form initialized successfully');

  return {
    // Core state
    formData,
    setFormData,
    loading,

    // Form handlers
    handleSubmit,
    handleChange,
    handleSelectChange,
    handleNestedChange,

    // Legacy file handlers (enhanced)
    handleFileChange: legacyHandlers.handleFileChange,
    handleLogoChange: legacyHandlers.handleLogoChange,
    handleDrop: legacyHandlers.handleDrop,
    handleDragOver: legacyHandlers.handleDragOver,

    // Enterprise upload handlers
    handleUploadedPhotoURL,
    handleUploadedLogoURL,
    handleMultiplePhotosChange,
    handleMultiplePhotoUploadComplete,
    handleEnterpriseMultiplePhotoUpload,

    // Advanced handlers (για επέκταση)
    photoHandlers,
    logoHandlers,
    multiplePhotosHandlers,

    // Utilities
    validateFormData,
    resetForm
  };
}