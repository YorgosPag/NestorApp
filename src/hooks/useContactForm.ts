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
  isModalOpen?: boolean; // 🔧 FIX: Track modal state για clean form reset
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
export function useContactForm({ onContactAdded, onOpenChange, editContact, isModalOpen }: UseContactFormProps) {
  console.log('🚀 ORCHESTRATOR: Initializing contact form για edit mode:', Boolean(editContact), 'modal open:', isModalOpen);

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
    handleProfilePhotoSelection,
    handleDrop,
    handleDragOver,
    resetForm
  } = useContactFormState();

  // 2️⃣ Form submission logic
  const {
    loading,
    handleSubmit: submitFormData,
    validateFormData,
    getSubmissionState
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
   * Load contact data when editing OR reset form when modal opens for new contact
   */
  useEffect(() => {
    // 🔧 FIX: Track modal state για proper form reset
    if (isModalOpen === false) {
      // Modal closed - no action needed
      return;
    }

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

    } else if (isModalOpen === true) {
      // 🎯 FIX: Modal opens για νέα επαφή - reset form
      console.log('🆕 ORCHESTRATOR: New contact mode, resetting form (modal opened)');
      resetForm();
    }
  }, [editContact, isModalOpen]); // 🔧 FIX: Track both editContact and modal state

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
    [] // 🔧 FIX: Empty dependencies - handler is stable
  );

  // ========================================================================
  // LEGACY API COMPATIBILITY
  // ========================================================================

  // Για backward compatibility με existing components που χρησιμοποιούν το hook
  const legacyHandlers = {
    // File handlers (με enterprise validation)
    // 🔧 FIX: Removed dependencies to prevent unnecessary re-renders
    handleFileChange: useCallback((file: File | null) => {
      if (file) {
        photoHandlers.processPhotoFile(file);
      } else {
        photoHandlers.clearPhoto();
      }
    }, []), // 🔧 FIX: Empty dependencies - handlers are stable

    handleLogoChange: useCallback((file: File | null) => {
      if (file) {
        logoHandlers.processLogoFile(file);
      } else {
        logoHandlers.clearLogo();
      }
    }, []), // 🔧 FIX: Empty dependencies - handlers are stable

    // Drag & drop (enhanced με validation)
    handleDrop: useCallback((e: React.DragEvent) => {
      photoHandlers.handlePhotoDrop(e);
    }, []), // 🔧 FIX: Empty dependencies - handlers are stable

    handleDragOver: useCallback((e: React.DragEvent) => {
      photoHandlers.handlePhotoDragOver(e);
    }, []) // 🔧 FIX: Empty dependencies - handlers are stable
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

    // Profile photo selection
    handleProfilePhotoSelection,

    // Advanced handlers (για επέκταση)
    photoHandlers,
    logoHandlers,
    multiplePhotosHandlers,

    // Utilities
    validateFormData,
    resetForm,

    // 🏢 Enterprise Layer 3: UI/UX Coordination
    getSubmissionState
  };
}