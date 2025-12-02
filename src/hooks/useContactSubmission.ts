import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import type { Contact } from '@/types/contacts';
import type { ContactFormData } from '@/types/ContactFormTypes';
import { ContactsService } from '@/services/contacts.service';
import { mapFormDataToContact } from '@/utils/contactForm/formDataMapper';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface UseContactSubmissionProps {
  editContact?: Contact | null;
  onContactAdded: () => void;
  onOpenChange: (open: boolean) => void;
  resetForm: () => void;
}

export interface UseContactSubmissionReturn {
  // State
  loading: boolean;

  // Handlers
  handleSubmit: (formData: ContactFormData) => Promise<void>;

  // Validation
  validateFormData: (formData: ContactFormData) => boolean;
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate individual contact form data
 *
 * @param formData - Form data to validate
 * @returns true if valid, false if invalid
 */
function validateIndividualContact(formData: ContactFormData): boolean {
  if (!formData.firstName.trim() || !formData.lastName.trim()) {
    toast.error("Συμπληρώστε όνομα και επώνυμο.");
    return false;
  }
  return true;
}

/**
 * Validate company contact form data
 *
 * @param formData - Form data to validate
 * @returns true if valid, false if invalid
 */
function validateCompanyContact(formData: ContactFormData): boolean {
  if (!formData.companyName.trim() || !formData.companyVatNumber.trim()) {
    toast.error("Συμπληρώστε επωνυμία και ΑΦΜ εταιρείας.");
    return false;
  }
  return true;
}

/**
 * Validate service contact form data
 *
 * @param formData - Form data to validate
 * @returns true if valid, false if invalid
 */
function validateServiceContact(formData: ContactFormData): boolean {
  if (!formData.serviceName.trim()) {
    toast.error("Συμπληρώστε όνομα υπηρεσίας.");
    return false;
  }
  return true;
}

// ============================================================================
// MAIN HOOK
// ============================================================================

/**
 * Contact Form Submission Hook
 *
 * Enterprise-class form submission logic για contact forms.
 * Χειρίζεται validation, data transformation και API calls.
 *
 * Features:
 * - Type-specific validation
 * - Form data mapping to Contact object
 * - Create/Update API calls
 * - Loading state management
 * - Error handling με enterprise logging
 * - Success notifications
 */
export function useContactSubmission({
  editContact,
  onContactAdded,
  onOpenChange,
  resetForm
}: UseContactSubmissionProps): UseContactSubmissionReturn {

  // ========================================================================
  // STATE
  // ========================================================================

  const [loading, setLoading] = useState(false);

  // ========================================================================
  // VALIDATION
  // ========================================================================

  /**
   * Validate form data based on contact type
   *
   * @param formData - Form data to validate
   * @returns true if valid, false if invalid
   */
  const validateFormData = useCallback((formData: ContactFormData): boolean => {
    console.log('🔍 SUBMISSION: Validating form data για type:', formData.type);

    switch (formData.type) {
      case 'individual':
        return validateIndividualContact(formData);

      case 'company':
        return validateCompanyContact(formData);

      case 'service':
        return validateServiceContact(formData);

      default:
        toast.error("Άγνωστος τύπος επαφής.");
        console.error('❌ SUBMISSION: Unknown contact type:', formData.type);
        return false;
    }
  }, []);

  // ========================================================================
  // SUBMISSION LOGIC
  // ========================================================================

  /**
   * Handle form submission
   *
   * @param formData - Complete form data
   */
  const handleSubmit = useCallback(async (formData: ContactFormData) => {
    if (loading) {
      console.warn('⚠️ SUBMISSION: Already submitting, ignoring duplicate request');
      return;
    }

    console.log('🚀 SUBMISSION: Starting form submission για type:', formData.type);

    // Validate form data
    if (!validateFormData(formData)) {
      console.warn('❌ SUBMISSION: Form validation failed');
      return;
    }

    setLoading(true);

    try {
      // Map form data to contact object
      const mappingResult = mapFormDataToContact(formData);

      if (mappingResult.warnings.length > 0) {
        console.warn('⚠️ SUBMISSION: Mapping warnings:', mappingResult.warnings);
      }

      const { contactData } = mappingResult;

      // Log submission details
      console.log('📊 SUBMISSION: Contact data prepared:', {
        type: contactData.type,
        hasPhoto: Boolean(mappingResult.photoURL),
        hasLogo: Boolean(mappingResult.logoURL),
        multiplePhotosCount: mappingResult.multiplePhotoURLs.length
      });

      // Submit to API
      if (editContact) {
        // Update existing contact
        console.log('🔄 SUBMISSION: Updating existing contact:', editContact.id);
        await ContactsService.updateContact(editContact.id, contactData);
        toast.success("Η επαφή ενημερώθηκε επιτυχώς.");
        console.log('✅ SUBMISSION: Contact updated successfully');

      } else {
        // Create new contact
        console.log('🆕 SUBMISSION: Creating new contact');
        await ContactsService.createContact(contactData);
        toast.success("Η νέα επαφή δημιουργήθηκε επιτυχώς.");
        console.log('✅ SUBMISSION: Contact created successfully');
      }

      // Success callbacks
      onContactAdded();
      onOpenChange(false);
      resetForm();

      console.log('🎉 SUBMISSION: Form submission completed successfully');

    } catch (error) {
      console.error('❌ SUBMISSION: Form submission failed:', error);

      // User-friendly error message
      const errorMessage = editContact
        ? "Δεν ήταν δυνατή η ενημέρωση της επαφής."
        : "Δεν ήταν δυνατή η δημιουργία της επαφής.";

      toast.error(errorMessage);

      // Log detailed error for debugging
      console.error('💥 SUBMISSION: Detailed error:', {
        contactType: formData.type,
        isEdit: Boolean(editContact),
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

    } finally {
      setLoading(false);
      console.log('🔄 SUBMISSION: Loading state cleared');
    }
  }, [loading, validateFormData, editContact, onContactAdded, onOpenChange]); // 🔧 FIX: Removed resetForm from dependencies to prevent infinite loop

  // ========================================================================
  // RETURN API
  // ========================================================================

  return {
    // State
    loading,

    // Handlers
    handleSubmit,

    // Validation
    validateFormData
  };
}