import { useState, useCallback } from 'react';
import { useNotifications } from '@/providers/NotificationProvider';
import type { Contact } from '@/types/contacts';
import type { ContactFormData } from '@/types/ContactFormTypes';
import { ContactsService } from '@/services/contacts.service';
import { mapFormDataToContact, validateUploadState } from '@/utils/contactForm/formDataMapper';
import {
  validateDocumentDates,
  isDatePastOrToday,
  formatDateForDisplay
} from '@/utils/validation';

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

  // 🏢 Enterprise Layer 3: UI/UX Coordination
  getSubmissionState: (formData: ContactFormData) => {
    canSubmit: boolean;
    isUploading: boolean;
    pendingUploads: number;
    buttonText: string;
    statusMessage?: string;
  };
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate individual contact form data με Enterprise Date Validation
 *
 * @param formData - Form data to validate
 * @param notifications - Notification service για user feedback
 * @returns true if valid, false if invalid
 */
function validateIndividualContact(formData: ContactFormData, notifications: any): boolean {
  // 🔧 Βασικά πεδία (υπάρχουν ήδη)
  if (!formData.firstName.trim() || !formData.lastName.trim()) {
    notifications.error("Συμπληρώστε όνομα και επώνυμο.");
    return false;
  }

  // 🏢 ENTERPRISE DATE VALIDATIONS με User-Friendly Notifications
  // ============================================================

  // 1. Ημερομηνία γέννησης - δεν μπορεί να είναι μελλοντική
  if (formData.birthDate && formData.birthDate.trim() !== '') {
    if (!isDatePastOrToday(formData.birthDate)) {
      notifications.error(
        "📅 Η ημερομηνία γέννησης δεν μπορεί να είναι μελλοντική. Παρακαλώ ελέγξτε την ημερομηνία.",
        {
          duration: 6000
        }
      );
      return false;
    }
  }

  // 2. Ημερομηνία έκδοσης εγγράφου - δεν μπορεί να είναι μελλοντική
  if (formData.documentIssueDate && formData.documentIssueDate.trim() !== '') {
    if (!isDatePastOrToday(formData.documentIssueDate)) {
      notifications.error(
        "🆔 Η ημερομηνία έκδοσης εγγράφου δεν μπορεί να είναι μελλοντική. Παρακαλώ επιλέξτε σωστή ημερομηνία.",
        {
          duration: 6000
        }
      );
      return false;
    }
  }

  // 3. Σχέση ημερομηνιών έκδοσης - λήξης
  const documentDatesValidation = validateDocumentDates({
    documentIssueDate: formData.documentIssueDate,
    documentExpiryDate: formData.documentExpiryDate
  });

  if (!documentDatesValidation.isValid && documentDatesValidation.error) {
    notifications.error(
      `⚠️ ${documentDatesValidation.error} Παρακαλώ ελέγξτε τις ημερομηνίες.`,
      {
        duration: 6000
      }
    );
    return false;
  }

  return true;
}

/**
 * Validate company contact form data
 *
 * @param formData - Form data to validate
 * @param notifications - Notification service για user feedback
 * @returns true if valid, false if invalid
 */
function validateCompanyContact(formData: ContactFormData, notifications: any): boolean {
  if (!formData.companyName.trim() || !formData.companyVatNumber.trim()) {
    notifications.error("Συμπληρώστε επωνυμία και ΑΦΜ εταιρείας.");
    return false;
  }
  return true;
}

/**
 * Validate service contact form data
 *
 * @param formData - Form data to validate
 * @param notifications - Notification service για user feedback
 * @returns true if valid, false if invalid
 */
function validateServiceContact(formData: ContactFormData, notifications: any): boolean {
  // 🔧 FIX: Support both serviceName (old) and name (service-config) fields
  const serviceName = formData.serviceName?.trim() || formData.name?.trim() || '';

  if (!serviceName) {
    notifications.error("Συμπληρώστε όνομα υπηρεσίας.");
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
  // STATE & DEPENDENCIES
  // ========================================================================

  const [loading, setLoading] = useState(false);
  const notifications = useNotifications();

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

    switch (formData.type) {
      case 'individual':
        return validateIndividualContact(formData, notifications);

      case 'company':
        return validateCompanyContact(formData, notifications);

      case 'service':
        return validateServiceContact(formData, notifications);

      default:
        notifications.error("Άγνωστος τύπος επαφής.");
        console.error('❌ SUBMISSION: Unknown contact type:', formData.type);
        return false;
    }
  }, [notifications]);

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


    // Validate form data
    if (!validateFormData(formData)) {
      console.warn('❌ SUBMISSION: Form validation failed');
      return;
    }

    // 🔧 HYBRID DEBUG: Upload state validation (temporarily relaxed για Base64 testing)
    const uploadValidation = validateUploadState(formData);

    // 🔧 TEMPORARY: Relaxed validation για Base64 testing
    if (!uploadValidation.isValid && uploadValidation.failedUploads > 0) {
      // Only block για failed uploads, όχι για pending (που μπορεί να είναι Base64)
      console.error('🚫 SUBMISSION BLOCKED: Failed uploads detected:', uploadValidation);

      const errorMessage = `Υπάρχουν αποτυχημένες φωτογραφίες (${uploadValidation.failedUploads} αποτυχίες)`;
      notifications.error(errorMessage);

      uploadValidation.errors.forEach(error => {
        if (error.includes('failed') || error.includes('αποτυχία')) {
          console.warn('📸 UPLOAD ERROR:', error);
        }
      });

      return;
    }

    // Base64 uploads are considered completed - no warning needed
    // Removed false warning for base64 uploads


    setLoading(true);

    try {
      // Map form data to contact object
      const mappingResult = mapFormDataToContact(formData);

      if (mappingResult.warnings.length > 0) {
        console.warn('⚠️ SUBMISSION: Mapping warnings:', mappingResult.warnings);
      }

      const { contactData } = mappingResult;

      // Log submission details

      // Submit to API
      if (editContact) {
        // 🏢 ENTERPRISE CLEANUP: Compare old vs new photos and delete orphaned Firebase Storage files
        console.log('🧹 ENTERPRISE CLEANUP: Starting photo comparison for contact update...');

        try {
          // Collect old photo URLs
          const oldPhotoUrls: string[] = [];
          if (editContact.photoURL) oldPhotoUrls.push(editContact.photoURL);
          if (editContact.multiplePhotoURLs) oldPhotoUrls.push(...editContact.multiplePhotoURLs);

          // Collect new photo URLs
          const newPhotoUrls: string[] = [];
          if (contactData.photoURL) newPhotoUrls.push(contactData.photoURL);
          if (contactData.multiplePhotoURLs) newPhotoUrls.push(...contactData.multiplePhotoURLs);

          // Find orphaned URLs (in old but not in new)
          const orphanedUrls = oldPhotoUrls.filter(oldUrl =>
            oldUrl &&
            oldUrl.trim() !== '' &&
            !newPhotoUrls.includes(oldUrl)
          );

          console.log('🧹 ENTERPRISE CLEANUP: Photo comparison result:', {
            oldPhotosCount: oldPhotoUrls.length,
            newPhotosCount: newPhotoUrls.length,
            orphanedCount: orphanedUrls.length,
            orphanedUrls: orphanedUrls.map(url => url.substring(0, 50) + '...')
          });

          // Cleanup orphaned Firebase Storage files
          if (orphanedUrls.length > 0) {
            const { PhotoUploadService } = await import('@/services/photo-upload.service');
            const cleanupPromises = orphanedUrls.map(async (url) => {
              try {
                await PhotoUploadService.deletePhotoByURL(url);
                console.log('✅ ENTERPRISE CLEANUP: Deleted orphaned file:', url.substring(0, 50) + '...');
              } catch (error) {
                console.warn('⚠️ ENTERPRISE CLEANUP: Failed to delete orphaned file:', url.substring(0, 50) + '...', error);
                // Non-blocking - continue with other files
              }
            });

            await Promise.allSettled(cleanupPromises);
            console.log('✅ ENTERPRISE CLEANUP: Completed cleanup of', orphanedUrls.length, 'orphaned files');
          } else {
            console.log('✅ ENTERPRISE CLEANUP: No orphaned files to clean');
          }
        } catch (cleanupError) {
          console.warn('⚠️ ENTERPRISE CLEANUP: Photo cleanup failed, but continuing with contact update:', cleanupError);
          // Non-blocking - contact update continues
        }

        // Update existing contact
        await ContactsService.updateContact(editContact.id, contactData);
        notifications.success("Η επαφή ενημερώθηκε επιτυχώς.");

      } else {
        // Create new contact
        console.log('🆕 SUBMISSION: Creating new contact');
        await ContactsService.createContact(contactData);
        notifications.success("Η νέα επαφή δημιουργήθηκε επιτυχώς.");
      }

      // Success callbacks
      onContactAdded();

      // 🔥 ENTERPRISE CACHE INVALIDATION: Forced component refresh
      // Αυτό εξασφαλίζει ότι όλα τα cached UI components θα ενημερωθούν
      console.log('🔄 SUBMISSION: Triggering enterprise cache invalidation...');

      // Small delay για να ολοκληρωθεί το database update
      setTimeout(() => {
        // Trigger ενός custom event για global cache invalidation
        window.dispatchEvent(new CustomEvent('contactsUpdated', {
          detail: {
            contactId: editContact?.id || 'new',
            action: editContact ? 'updated' : 'created',
            affectedFields: Object.keys(formData).filter(key => formData[key as keyof typeof formData])
          }
        }));
        console.log('📡 SUBMISSION: Global cache invalidation event dispatched');
      }, 100);

      onOpenChange(false);
      resetForm();


    } catch (error) {
      console.error('❌ SUBMISSION: Form submission failed:', error);

      // User-friendly error message
      const errorMessage = editContact
        ? "Δεν ήταν δυνατή η ενημέρωση της επαφής."
        : "Δεν ήταν δυνατή η δημιουργία της επαφής.";

      notifications.error(errorMessage);

      // Log detailed error for debugging
      console.error('💥 SUBMISSION: Detailed error:', {
        contactType: formData.type,
        isEdit: Boolean(editContact),
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

    } finally {
      setLoading(false);
    }
  }, [loading, validateFormData, editContact, onContactAdded, onOpenChange, notifications]); // 🔧 FIX: Added notifications dependency

  // ========================================================================
  // UI/UX COORDINATION (Layer 3)
  // ========================================================================

  /**
   * 🏢 Enterprise Layer 3: Get submission state for UI coordination
   * Provides comprehensive state information for optimal user experience
   */
  const getSubmissionState = useCallback((formData: ContactFormData) => {
    const uploadValidation = validateUploadState(formData);
    const isValidForm = validateFormData(formData);

    const isUploading = uploadValidation.pendingUploads > 0;
    const hasFailed = uploadValidation.failedUploads > 0;

    let buttonText = editContact ? 'Ενημέρωση Επαφής' : 'Δημιουργία Επαφής';
    let statusMessage: string | undefined;

    if (loading) {
      buttonText = editContact ? 'Ενημερώνεται...' : 'Δημιουργείται...';
    } else if (isUploading) {
      buttonText = `Περιμένετε uploads (${uploadValidation.pendingUploads}/${uploadValidation.totalSlots})`;
      statusMessage = `Περιμένετε να ολοκληρωθούν όλες οι φωτογραφίες πριν την αποθήκευση`;
    } else if (hasFailed) {
      buttonText = 'Υπάρχουν αποτυχημένες φωτογραφίες';
      statusMessage = 'Διορθώστε τις αποτυχημένες φωτογραφίες πριν την αποθήκευση';
    } else if (!isValidForm) {
      buttonText = 'Συμπληρώστε τα απαιτούμενα πεδία';
    }

    const canSubmit = !loading && uploadValidation.isValid && isValidForm;

    return {
      canSubmit,
      isUploading,
      pendingUploads: uploadValidation.pendingUploads,
      buttonText,
      statusMessage
    };
  }, [loading, validateFormData, editContact, notifications]);

  // ========================================================================
  // RETURN API
  // ========================================================================

  return {
    // State
    loading,

    // Handlers
    handleSubmit,

    // Validation
    validateFormData,

    // UI/UX Coordination
    getSubmissionState
  };
}