import { useState, useCallback, useRef } from 'react';
import type React from 'react';
import { useNotifications } from '@/providers/NotificationProvider';
import type { Contact } from '@/types/contacts';
import type { ContactFormData } from '@/types/ContactFormTypes';
import { ContactsService } from '@/services/contacts.service';
import { mapFormDataToContact, validateUploadState } from '@/utils/contactForm/formDataMapper';
import {
  validateDocumentDates,
  isDatePastOrToday
} from '@/utils/validation';
import { isValidGreekVat } from '@/lib/validation/vat-validation';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('useContactSubmission');

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

  // 🏢 GOOGLE-STYLE: Deferred save — event-driven, zero polling
  attemptPendingSave: (formData: ContactFormData) => void;
  clearPendingSave: () => void;
  isPendingSave: boolean;
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
// 🌐 i18n: All validation messages converted to i18n keys - 2026-01-18
function validateIndividualContact(formData: ContactFormData, notifications: NotificationService): boolean {
  // 🔧 Βασικά πεδία (υπάρχουν ήδη)
  if (!formData.firstName.trim() || !formData.lastName.trim()) {
    notifications.error("validation.contacts.individual.nameRequired");
    return false;
  }

  // 🏢 VAT VALIDATION — exactly 9 digits if provided
  const vatNumber = formData.vatNumber?.trim() ?? '';
  if (vatNumber && !isValidGreekVat(vatNumber)) {
    notifications.error("validation.contacts.vatInvalid");
    return false;
  }

  // 🏢 ENTERPRISE DATE VALIDATIONS με User-Friendly Notifications
  // ============================================================

  // 1. Ημερομηνία γέννησης - δεν μπορεί να είναι μελλοντική
  if (formData.birthDate && formData.birthDate.trim() !== '') {
    if (!isDatePastOrToday(formData.birthDate)) {
      notifications.error(
        "validation.contacts.individual.birthDateFuture",
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
        "validation.contacts.individual.documentIssueDateFuture",
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
      "validation.contacts.individual.documentDatesInvalid",
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
    notifications.error("validation.contacts.company.nameAndVatRequired");
    return false;
  }

  // 🏢 VAT must be exactly 9 digits
  if (!isValidGreekVat(vatNumber)) {
    notifications.error("validation.contacts.vatInvalid");
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
    notifications.error("validation.contacts.service.nameRequired");
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

  // 🏢 GOOGLE-STYLE: Deferred save — event-driven, zero polling
  // When user presses Save but uploads are pending, we remember the intent.
  // Upload completion → formData change → effect in useContactForm → auto-submit.
  const [pendingSave, setPendingSave] = useState(false);
  const handleSubmitRef = useRef<((fd: ContactFormData) => Promise<void>) | null>(null);

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
        notifications.error("validation.contacts.unknownType");
        logger.error('SUBMISSION: Unknown contact type', { type: formData.type });
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
      logger.warn('SUBMISSION: Already submitting, ignoring duplicate request');
      return;
    }


    // Validate form data
    if (!validateFormData(formData)) {
      logger.warn('SUBMISSION: Form validation failed');
      return;
    }

    // 🔥 ENTERPRISE UPLOAD SYNCHRONIZATION: Block submission until all uploads complete
    const uploadValidation = validateUploadState(formData as unknown as Record<string, unknown>);

    if (!uploadValidation.isValid) {
      logger.info('SUBMISSION: Upload validation failed', { uploadValidation });

      // If we have failed uploads, block immediately
      if (uploadValidation.failedUploads > 0) {
        logger.error('SUBMISSION BLOCKED: Failed uploads detected', { uploadValidation });
        // 🌐 i18n key with count interpolation
        notifications.error("contacts.submission.failedUploads");
        return;
      }

      // If we have pending uploads, wait for completion
      if (uploadValidation.pendingUploads > 0) {
        logger.info('SUBMISSION: Waiting for uploads to complete', {
          pendingUploads: uploadValidation.pendingUploads,
          errors: uploadValidation.errors
        });

        // 🌐 i18n key with count interpolation
        notifications.info(
          "contacts.submission.pendingUploads",
          { duration: 3000 }
        );

        // 🏢 GOOGLE-STYLE: Deferred save — event-driven, zero polling
        // Remember user intent. When uploads complete → formData changes →
        // useEffect in useContactForm calls attemptPendingSave → auto-submit.
        // No setTimeout, no recursive retry, no stale closure, no notification spam.
        logger.info('DEFERRED SAVE: Uploads in progress — will auto-save on completion', {
          pendingUploads: uploadValidation.pendingUploads
        });
        setPendingSave(true);

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
        logger.warn('SUBMISSION: Mapping warnings', { warnings: mappingResult.warnings });
      }

      const { contactData } = mappingResult;

      // Log submission details

      // Submit to API
      if (editContact) {
        // 🏢✅ ENTERPRISE CLEANUP: LOGO & PHOTO DELETION - ΛΕΙΤΟΥΡΓΕΙ ΤΕΛΕΙΑ! ΜΗΝ ΑΛΛΑΞΕΙΣ ΤΙΠΟΤΑ!
        // Τελική διαμόρφωση που λειτουργεί 100% - Cleanup orphaned files από Firebase Storage
        // Ημερομηνία: 2025-12-05 - Status: WORKING PERFECTLY
        // 🔥 ΚΡΙΣΙΜΟ: Περιλαμβάνει logoURL, photoURL και multiplePhotoURLs cleanup!
        logger.info('ENTERPRISE CLEANUP: Starting photo comparison for contact update');

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

          logger.info('ENTERPRISE CLEANUP: Photo comparison result', {
            contactType: editContact.type,
            oldPhotosCount: oldPhotoUrls.length,
            newPhotosCount: newPhotoUrls.length,
            orphanedCount: orphanedUrls.length,
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
                logger.info('ENTERPRISE CLEANUP: Deleted orphaned file');
              } catch (error) {
                logger.warn('ENTERPRISE CLEANUP: Failed to delete orphaned file', { error });
                // Non-blocking - continue with other files
              }
            });

            await Promise.allSettled(cleanupPromises);
            logger.info('ENTERPRISE CLEANUP: Completed cleanup of orphaned files', { count: orphanedUrls.length });
          } else {
            logger.info('ENTERPRISE CLEANUP: No orphaned files to clean');
          }
        } catch (cleanupError) {
          logger.warn('ENTERPRISE CLEANUP: Photo cleanup failed, but continuing with contact update', { error: cleanupError });
          // Non-blocking - contact update continues
        }

        // Update existing contact
        const editContactId = editContact?.id;
        if (!editContactId) {
          return;
        }
        await ContactsService.updateContact(editContactId, contactData);
        notifications.success("contacts.submission.updateSuccess");

      } else {
        // Create new contact
        logger.info('SUBMISSION: Creating new contact');
        await ContactsService.createContact(contactData);
        notifications.success("contacts.submission.createSuccess");
      }

      // Success callbacks
      onContactAdded();

      // 🔥 ENTERPRISE CACHE INVALIDATION: Forced component refresh
      // Αυτό εξασφαλίζει ότι όλα τα cached UI components θα ενημερωθούν
      logger.info('SUBMISSION: Triggering enterprise cache invalidation');

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
        logger.info('SUBMISSION: Global cache invalidation event dispatched');
      }, 100);

      onOpenChange(false);
      resetForm();


    } catch (error) {
      logger.error('SUBMISSION: Form submission failed', { error });

      // 🏢 ENTERPRISE ERROR HANDLING με intelligent error categorization
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (errorMessage.startsWith('DUPLICATE_CONTACT_DETECTED')) {
        // 🚨 ENTERPRISE DUPLICATE PREVENTION - Smart UX handling
        logger.info('DUPLICATE PREVENTION: Intelligent duplicate detected, providing user guidance');

        // Extract useful information from error message
        const confidenceMatch = errorMessage.match(/Confidence: ([\d.]+)%/);
        const contactIdMatch = errorMessage.match(/Contact ID: ([^\]]+)\]/);

        const confidence = confidenceMatch ? parseFloat(confidenceMatch[1]) : 0;
        const existingContactId = contactIdMatch ? contactIdMatch[1] : null;

        // Smart user notification με actionable information
        // 🌐 i18n: Duplicate prevention messages
        if (confidence >= 95) {
          notifications.error(
            "contacts.duplicate.exactMatch",
            { duration: 8000 }
          );
        } else if (confidence >= 80) {
          notifications.warning(
            "contacts.duplicate.similarMatch",
            { duration: 6000 }
          );
        } else {
          notifications.info(
            "contacts.duplicate.possibleMatch",
            { duration: 5000 }
          );
        }

        // Log για debugging χωρίς sensitive information
        logger.info('DUPLICATE PREVENTION: Smart handling applied', {
          confidence,
          hasExistingId: Boolean(existingContactId),
          errorType: 'DUPLICATE_DETECTED'
        });

      } else {
        // 🏢 STANDARD ERROR HANDLING για other errors
        // 🌐 i18n: Generic error messages
        const userErrorMessage = editContact
          ? "contacts.submission.updateError"
          : "contacts.submission.createError";

        notifications.error(userErrorMessage);

        // Log detailed error for debugging
        logger.error('SUBMISSION: Detailed error', {
          contactType: formData.type,
          isEdit: Boolean(editContact),
          errorMessage,
        });
      }

    } finally {
      setLoading(false);
    }
  }, [loading, validateFormData, editContact, onContactAdded, onOpenChange, notifications]); // 🔧 FIX: Added notifications dependency

  // Keep ref in sync for deferred save (avoids circular useCallback dependency)
  handleSubmitRef.current = handleSubmit;

  // ========================================================================
  // 🏢 GOOGLE-STYLE: EVENT-DRIVEN DEFERRED SAVE
  // ========================================================================

  /**
   * Called by useContactForm's useEffect when formData changes.
   * If user had pressed Save (pendingSave=true) and all uploads are now complete → auto-submit.
   * Pure event-driven: upload complete → state change → effect → this function → save.
   */
  const attemptPendingSave = useCallback((formData: ContactFormData) => {
    if (!pendingSave || loading) return;

    const uploadValidation = validateUploadState(formData as unknown as Record<string, unknown>);

    // If uploads failed, cancel the deferred save
    if (uploadValidation.failedUploads > 0) {
      logger.info('DEFERRED SAVE: Cancelled — failed uploads detected');
      setPendingSave(false);
      notifications.error("contacts.submission.failedUploads");
      return;
    }

    // If all uploads complete, auto-submit
    if (uploadValidation.isValid) {
      logger.info('DEFERRED SAVE: All uploads complete — auto-submitting');
      setPendingSave(false);
      handleSubmitRef.current?.(formData);
    }
    // Otherwise: still pending — wait for next formData change
  }, [pendingSave, loading, notifications]);

  /**
   * Clear deferred save intent (modal close, form reset, etc.)
   */
  const clearPendingSave = useCallback(() => {
    setPendingSave(false);
  }, []);

  // ========================================================================
  // UI/UX COORDINATION (Layer 3)
  // ========================================================================

  /**
   * 🏢 Enterprise Layer 3: Get submission state for UI coordination
   * Provides comprehensive state information for optimal user experience
   */
  const getSubmissionState = useCallback((formData: ContactFormData) => {
    const uploadValidation = validateUploadState(formData as unknown as Record<string, unknown>);
    const isValidForm = validateFormData(formData);

    const isUploading = uploadValidation.pendingUploads > 0;
    const hasFailed = uploadValidation.failedUploads > 0;

    // 🌐 i18n: Button text converted to i18n keys - 2026-01-18
    let buttonText = editContact ? 'contacts.button.update' : 'contacts.button.create';
    let statusMessage: string | undefined;

    if (loading) {
      buttonText = editContact ? 'contacts.button.updating' : 'contacts.button.creating';
    } else if (pendingSave) {
      // 🏢 GOOGLE-STYLE: User pressed Save, waiting for uploads to finish
      buttonText = 'contacts.button.waitingUploads';
      statusMessage = 'contacts.status.waitingPhotos';
    } else if (isUploading) {
      buttonText = 'contacts.button.waitingUploads';
      statusMessage = 'contacts.status.waitingPhotos';
    } else if (hasFailed) {
      buttonText = 'contacts.button.failedPhotos';
      statusMessage = 'contacts.status.fixPhotos';
    } else if (!isValidForm) {
      buttonText = 'contacts.button.fillRequired';
    }

    const canSubmit = !loading && !pendingSave && uploadValidation.isValid && isValidForm;

    return {
      canSubmit,
      isUploading,
      pendingUploads: uploadValidation.pendingUploads,
      buttonText,
      statusMessage
    };
  }, [loading, pendingSave, validateFormData, editContact, notifications]);

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
    getSubmissionState,

    // 🏢 GOOGLE-STYLE: Deferred save — event-driven, zero polling
    attemptPendingSave,
    clearPendingSave,
    isPendingSave: pendingSave,
  };
}
