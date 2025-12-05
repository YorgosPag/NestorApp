import { useCallback, useRef } from 'react';
import React from 'react';
import type { Contact } from '@/types/contacts';
import type { ContactFormData } from '@/types/ContactFormTypes';
import { useContactFormState } from './useContactFormState';
import { useContactSubmission } from './useContactSubmission';
import { useMultiplePhotosHandlers } from './useMultiplePhotosHandlers';
import { useContactLivePreview } from './useContactLivePreview';
import { useContactDataLoader } from './useContactDataLoader';
import { useContactFormHandlers } from './useContactFormHandlers';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface UseContactFormProps {
  onContactAdded: () => void;
  onOpenChange: (open: boolean) => void;
  editContact?: Contact | null;
  isModalOpen?: boolean; // 🔧 FIX: Track modal state για clean form reset
  onLiveChange?: (updatedContact: Contact) => void; // 🔥 NEW: For real-time preview
}

// ============================================================================
// MAIN ORCHESTRATOR HOOK
// ============================================================================

/**
 * Contact Form Orchestrator Hook (Enterprise Refactored & Modularized)
 *
 * 🏗️ MODULAR ARCHITECTURE: Διασπασμένο σε specialized hooks για better maintainability
 *
 * Enterprise-class orchestrator που συνδυάζει όλους τους specialized hooks.
 * Αποτελεί το κεντρικό API για το contact form functionality.
 *
 * Architecture:
 * - useContactFormState: Core state management
 * - useContactSubmission: Form submission logic
 * - useContactLivePreview: Real-time preview functionality
 * - useContactDataLoader: Contact loading/editing/resetting
 * - useContactFormHandlers: Legacy compatibility & handlers
 * - useMultiplePhotosHandlers: Multiple photos handling
 *
 * Benefits:
 * - Single Responsibility Principle ✅
 * - Modular & testable components ✅
 * - Reduced file complexity (100-120 lines vs 362 lines) ✅
 * - Better separation of concerns ✅
 * - Easier maintenance & debugging ✅
 */
export function useContactForm({ onContactAdded, onOpenChange, editContact, isModalOpen, onLiveChange }: UseContactFormProps) {

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

  // 🔥 CRITICAL FIX: FormData ref to prevent stale closure in handleSubmit
  const formDataRef = useRef<ContactFormData>(formData);
  formDataRef.current = formData;

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
    resetForm,
    formDataRef // 🔥 CRITICAL FIX: Pass formDataRef for fresh state access
  });

  // 3️⃣ Live preview functionality (extracted)
  useContactLivePreview({
    formData,
    editContact,
    isModalOpen,
    onLiveChange
  });

  // 4️⃣ Contact data loading (extracted)
  useContactDataLoader({
    editContact,
    isModalOpen,
    setFormData,
    handleMultiplePhotosChange,
    resetForm
  });

  // 5️⃣ Legacy handlers compatibility (extracted)
  const legacyHandlers = useContactFormHandlers({
    handleFileChange,
    handleLogoChange,
    handleUploadedLogoURL,
    handleDrop,
    handleDragOver
  });

  // 6️⃣ Multiple photos handlers
  const multiplePhotosHandlers = useMultiplePhotosHandlers({
    onMultiplePhotosChange: handleMultiplePhotosChange,
    onPhotoUploadComplete: handleMultiplePhotoUploadComplete
  });

  // ========================================================================
  // MODULAR HOOKS ORCHESTRATION
  // ========================================================================
  // All complex logic extracted to specialized hooks above ☝️


  // ========================================================================
  // FORM SUBMISSION WRAPPER
  // ========================================================================

  /**
   * Handle form submission (wraps submission hook)
   * 🔥 CRITICAL FIX: Use formDataRef.current to get fresh formData and prevent stale closure
   */
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('🔥 HANDLE SUBMIT: Using fresh formData via ref:', {
      refValue: formDataRef.current.photoURL?.substring(0, 50) + '...',
      refPhotoPreview: formDataRef.current.photoPreview?.substring(0, 50) + '...',
      formDataInClosure: formData.photoURL?.substring(0, 50) + '...',
      areTheSame: formDataRef.current === formData,
      timestamp: new Date().toISOString()
    });
    await submitFormData(formDataRef.current); // 🔥 Use ref instead of closure variable!
  }, [submitFormData]); // 🔥 Remove formData from dependencies to prevent stale closure

  // ========================================================================
  // ENTERPRISE UPLOAD WRAPPER
  // ========================================================================

  // 🚀 CENTRALIZATION: Removed duplicate enterprise upload handler - now using centralized defaultUploadHandler

  // ========================================================================
  // LEGACY API COMPATIBILITY (Now handled by useContactFormHandlers)
  // ========================================================================
  // All legacy handlers moved to dedicated hook ☝️

  // ========================================================================
  // RETURN API
  // ========================================================================


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
    // handleEnterpriseMultiplePhotoUpload removed - using centralized handler

    // Profile photo selection
    handleProfilePhotoSelection,

    // Advanced handlers (για επέκταση)
    logoHandlers: legacyHandlers.logoHandlers,
    multiplePhotosHandlers,

    // Utilities
    validateFormData,
    resetForm,

    // 🏢 Enterprise Layer 3: UI/UX Coordination
    getSubmissionState
  };
}