import { useEffect, useCallback, useMemo, useRef } from 'react';
import React from 'react';
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
  onLiveChange?: (updatedContact: Contact) => void; // 🔥 NEW: For real-time preview
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

      try {
        const mappingResult = mapContactToFormData(editContact);

        if (mappingResult.warnings.length > 0) {
          console.warn('⚠️ ORCHESTRATOR: Contact mapping warnings:', mappingResult.warnings);
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
            console.log('🛠️ USECONTACTFORM: Database has empty photos array - forcing UI update');
            // Καλεί την συνάρτηση που ενημερώνει τα photos στο UI
            if (typeof handleMultiplePhotosChange === 'function') {
              handleMultiplePhotosChange([]);
            }
          }
        }, 50);

      } catch (error) {
        console.error('❌ ORCHESTRATOR: Failed to load contact data:', error);
        resetForm();
      }

    } else if (isModalOpen === true) {
      // 🎯 FIX: Modal opens για νέα επαφή - reset form
      console.log('🆕 ORCHESTRATOR: New contact mode, resetting form (modal opened)');
      resetForm();
    }
  }, [editContact?.id, isModalOpen, editContact?.updatedAt]); // 🔥 FINAL FIX: Force refresh on every edit - track ID + timestamp

  // ========================================================================
  // 🔥 NEW: LIVE PREVIEW FUNCTIONALITY (Fixed Infinite Loop)
  // ========================================================================

  /**
   * Handle live preview updates - convert formData to Contact and call onLiveChange
   * Uses useMemo to prevent infinite loops by comparing only relevant form fields
   */
  // 🔧 FIX: Create a ref to track if we should enable live preview
  const shouldEnableLivePreview = Boolean(onLiveChange && editContact && isModalOpen);

  const livePreviewContact = useMemo(() => {
    if (!shouldEnableLivePreview) {
      return null;
    }

    try {
      // Create a temporary contact with updated data
      const updatedContact: Contact = {
        ...editContact!,
        // Map form data back to contact properties
        type: formData.type,
        firstName: formData.firstName,
        lastName: formData.lastName,
        companyName: formData.companyName,
        serviceName: formData.serviceName,

        // 🏢 ΓΕΜΗ & Company Information
        vatNumber: formData.vatNumber,
        afm: formData.afm,
        gemhNumber: formData.gemhNumber,
        legalForm: formData.legalForm,
        gemhStatus: formData.gemhStatus,
        distintiveTitle: formData.distintiveTitle,
        kadCode: formData.kadCode,
        activityDescription: formData.activityDescription,
        activityType: formData.activityType,
        chamber: formData.chamber,

        // 💰 Capital & Financial
        capital: formData.capital,
        currency: formData.currency,
        extrabalanceCapital: formData.extrabalanceCapital,

        // 📧 Contact Information
        emails: editContact!.emails, // Keep existing structure
        phones: editContact!.phones, // Keep existing structure

        // Other fields that should be updated live...
      };

      return updatedContact;
    } catch (error) {
      console.error('❌ LIVE PREVIEW: Failed to create live contact:', error);
      return null;
    }
  }, [
    // 🎯 Only track form fields and essential flags
    shouldEnableLivePreview,
    formData.type,
    formData.firstName,
    formData.lastName,
    formData.companyName,
    formData.serviceName,
    formData.vatNumber,
    formData.afm,
    formData.gemhNumber,
    formData.legalForm,
    formData.gemhStatus,
    formData.distintiveTitle,
    formData.kadCode,
    formData.activityDescription,
    formData.activityType,
    formData.chamber,
    formData.capital,
    formData.currency,
    formData.extrabalanceCapital,
    editContact?.id // Track only ID to prevent deep comparison
  ]);

  // 🔧 FIX: Use ref to store onLiveChange to prevent it from changing dependencies
  const onLiveChangeRef = useRef(onLiveChange);
  onLiveChangeRef.current = onLiveChange;

  /**
   * Call onLiveChange when livePreviewContact changes (with debounce to prevent excessive calls)
   */
  useEffect(() => {
    if (!livePreviewContact || !onLiveChangeRef.current) {
      return;
    }

    // Debounce the onLiveChange call to prevent excessive updates
    const timeoutId = setTimeout(() => {
      onLiveChangeRef.current!(livePreviewContact);
    }, 100); // 100ms debounce for stability

    return () => {
      clearTimeout(timeoutId);
    };
  }, [livePreviewContact]); // 🎯 Only depend on livePreviewContact, not onLiveChange

  // ========================================================================
  // FORM SUBMISSION WRAPPER
  // ========================================================================

  /**
   * Handle form submission (wraps submission hook)
   */
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
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