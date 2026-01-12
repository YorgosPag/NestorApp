import { useState, useCallback } from 'react';
import type React from 'react';
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
  formDataRef?: React.MutableRefObject<ContactFormData>; // 🔥 CRITICAL FIX: Fresh formData access
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

/** Notification service interface */
interface NotificationService {
  error: (message: string, options?: { duration?: number }) => void;
  success: (message: string, options?: { duration?: number }) => void;
  warning: (message: string, options?: { duration?: number }) => void;
  info: (message: string, options?: { duration?: number }) => void;
}

/**
 * Validate individual contact form data με Enterprise Date Validation
 *
 * @param formData - Form data to validate
 * @param notifications - Notification service για user feedback
 * @returns true if valid, false if invalid
 */
function validateIndividualContact(formData: ContactFormData, notifications: NotificationService): boolean {
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
function validateCompanyContact(formData: ContactFormData, notifications: NotificationService): boolean {
  // 🔧 FIX: Support both vatNumber and companyVatNumber field names
  const vatNumber = formData.companyVatNumber?.trim() || formData.vatNumber?.trim() || '';

  if (!formData.companyName.trim() || !vatNumber) {
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
function validateServiceContact(formData: ContactFormData, notifications: NotificationService): boolean {
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
  resetForm,
  formDataRef
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

    // 🔥 ENTERPRISE UPLOAD SYNCHRONIZATION: Block submission until all uploads complete
    const uploadValidation = validateUploadState(formData);

    if (!uploadValidation.isValid) {
      console.log('🚫 SUBMISSION: Upload validation failed:', uploadValidation);

      // If we have failed uploads, block immediately
      if (uploadValidation.failedUploads > 0) {
        console.error('🚫 SUBMISSION BLOCKED: Failed uploads detected:', uploadValidation);
        const errorMessage = `Υπάρχουν αποτυχημένες φωτογραφίες (${uploadValidation.failedUploads} αποτυχίες)`;
        notifications.error(errorMessage);
        return;
      }

      // If we have pending uploads, wait for completion
      if (uploadValidation.pendingUploads > 0) {
        console.log('⏳ SUBMISSION: Waiting for uploads to complete...', {
          pendingUploads: uploadValidation.pendingUploads,
          errors: uploadValidation.errors
        });

        notifications.info(
          `⏳ Περιμένετε να ολοκληρωθούν τα uploads... (${uploadValidation.pendingUploads} εκκρεμής)`,
          { duration: 3000 }
        );

        // 🔥✅ ENTERPRISE SOLUTION: Auto-retry submission after uploads complete
        // 🎯 CRITICAL SUCCESS: formDataRef fix για Representative Photo upload - 2025-12-05
        // ⚠️ WARNING: ΜΗΝ ΑΛΛΑΞΕΙΣ αυτό το setTimeout logic! Λύνει stale closure race condition
        setTimeout(() => {
          console.log('🔄 SUBMISSION: Auto-retrying after upload delay...');
          // 🎯 CRITICAL FIX: Use formDataRef to get FRESH formData and avoid stale closure
          const freshFormData = formDataRef?.current || formData;
          console.log('🔄 RETRY: Using fresh formData from ref to avoid stale closure', {
            hasRef: !!formDataRef,
            freshPhotoURL: freshFormData.photoURL?.substring(0, 50) + '...',
            freshPhotoPreview: freshFormData.photoPreview?.substring(0, 50) + '...',
            isRefFresh: formDataRef ? freshFormData !== formData : 'No ref available'
          });
          handleSubmit(freshFormData); // Recursive retry with FRESH data
        }, 500);

        return;
      }
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
        // 🏢✅ ENTERPRISE CLEANUP: LOGO & PHOTO DELETION - ΛΕΙΤΟΥΡΓΕΙ ΤΕΛΕΙΑ! ΜΗΝ ΑΛΛΑΞΕΙΣ ΤΙΠΟΤΑ!
        // Τελική διαμόρφωση που λειτουργεί 100% - Cleanup orphaned files από Firebase Storage
        // Ημερομηνία: 2025-12-05 - Status: WORKING PERFECTLY
        // 🔥 ΚΡΙΣΙΜΟ: Περιλαμβάνει logoURL, photoURL και multiplePhotoURLs cleanup!
        console.log('🧹 ENTERPRISE CLEANUP: Starting photo comparison for contact update...');

        try {
          // 🏢✅ COLLECT OLD PHOTO URLs - ΜΗΝ ΑΛΛΑΞΕΙΣ! Λειτουργεί τέλεια!
          const oldPhotoUrls: string[] = [];
          if (editContact.photoURL) oldPhotoUrls.push(editContact.photoURL);
          if (editContact.multiplePhotoURLs) oldPhotoUrls.push(...editContact.multiplePhotoURLs);
          // 🔥✅ FIX LOGO CLEANUP: Include logoURL for company/service contacts - WORKING!
          if ('logoURL' in editContact && editContact.logoURL) oldPhotoUrls.push(editContact.logoURL);

          // Collect new photo URLs (including logo)
          const newPhotoUrls: string[] = [];
          if (contactData.photoURL) newPhotoUrls.push(contactData.photoURL);
          if (contactData.logoURL) newPhotoUrls.push(contactData.logoURL); // 🔥 FIX: Include logo URL
          if (contactData.multiplePhotoURLs) newPhotoUrls.push(...contactData.multiplePhotoURLs);

          // Find orphaned URLs (in old but not in new)
          const orphanedUrls = oldPhotoUrls.filter(oldUrl =>
            oldUrl &&
            oldUrl.trim() !== '' &&
            !newPhotoUrls.includes(oldUrl)
          );

          console.log('🧹 ENTERPRISE CLEANUP: Photo comparison result:', {
            contactType: editContact.type,
            oldPhotosCount: oldPhotoUrls.length,
            oldPhotoUrls: oldPhotoUrls.map(url => ({ type: getUrlType(url), url: url.substring(0, 50) + '...' })),
            newPhotosCount: newPhotoUrls.length,
            newPhotoUrls: newPhotoUrls.map(url => ({ type: getUrlType(url), url: url.substring(0, 50) + '...' })),
            orphanedCount: orphanedUrls.length,
            orphanedUrls: orphanedUrls.map(url => ({ type: getUrlType(url), url: url.substring(0, 50) + '...' }))
          });

          // 🔍 Helper function για να δούμε τι τύπος είναι κάθε URL
          function getUrlType(url: string): string {
            if (url.includes('logo')) return 'LOGO';
            if (url.includes('photo') || url.includes('representative')) return 'PHOTO';
            return 'UNKNOWN';
          }

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

      // 🏢 ENTERPRISE ERROR HANDLING με intelligent error categorization
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (errorMessage.startsWith('DUPLICATE_CONTACT_DETECTED')) {
        // 🚨 ENTERPRISE DUPLICATE PREVENTION - Smart UX handling
        console.log('🛡️ DUPLICATE PREVENTION: Intelligent duplicate detected, providing user guidance...');

        // Extract useful information from error message
        const confidenceMatch = errorMessage.match(/Confidence: ([\d.]+)%/);
        const contactIdMatch = errorMessage.match(/Contact ID: ([^\]]+)\]/);

        const confidence = confidenceMatch ? parseFloat(confidenceMatch[1]) : 0;
        const existingContactId = contactIdMatch ? contactIdMatch[1] : null;

        // Smart user notification με actionable information
        if (confidence >= 95) {
          notifications.error(
            "🚨 Η επαφή αυτή υπάρχει ήδη στο σύστημα. " +
            "Παρακαλούμε ελέγξτε τη λίστα επαφών πριν δημιουργήσετε νέα.",
            { duration: 8000 }
          );
        } else if (confidence >= 80) {
          notifications.warning(
            "⚠️ Εντοπίστηκε παρόμοια επαφή στο σύστημα. " +
            "Παρακαλούμε επαληθεύστε ότι δεν δημιουργείτε διπλή καταχώρηση.",
            { duration: 6000 }
          );
        } else {
          notifications.info(
            "ℹ️ Πιθανή διπλή προσπάθεια δημιουργίας επαφής. " +
            "Παρακαλούμε περιμένετε λίγα δευτερόλεπτα και δοκιμάστε ξανά.",
            { duration: 5000 }
          );
        }

        // Log για debugging χωρίς sensitive information
        console.log('🛡️ DUPLICATE PREVENTION: Smart handling applied', {
          confidence: confidence,
          hasExistingId: Boolean(existingContactId),
          errorType: 'DUPLICATE_DETECTED'
        });

      } else {
        // 🏢 STANDARD ERROR HANDLING για other errors
        const userErrorMessage = editContact
          ? "Δεν ήταν δυνατή η ενημέρωση της επαφής."
          : "Δεν ήταν δυνατή η δημιουργία της επαφής.";

        notifications.error(userErrorMessage);

        // Log detailed error for debugging
        console.error('💥 SUBMISSION: Detailed error:', {
          contactType: formData.type,
          isEdit: Boolean(editContact),
          error: errorMessage,
          stack: error instanceof Error ? error.stack : undefined
        });
      }

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