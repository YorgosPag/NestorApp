import { useState, useCallback, useRef } from 'react';
import type React from 'react';
import { useNotifications } from '@/providers/NotificationProvider';
import type { Contact } from '@/types/contacts';
import type { ContactFormData } from '@/types/ContactFormTypes';
import { ContactsService } from '@/services/contacts.service';
import { mapFormDataToContact } from '@/utils/contactForm/modular/orchestrator';
import { validateUploadState } from '@/utils/contactForm/validators';
import { calculateSubmissionState } from '@/utils/contactForm/submission-state';
import { cleanupOrphanedPhotos } from '@/utils/contactForm/photo-cleanup';
import { runGuardChain } from '@/utils/contactForm/submission-guard-chain';
import { handleSubmissionError } from '@/utils/contactForm/submission-error-handler';
import {
  validateIndividualContact,
  validateCompanyContact,
  validateServiceContact,
} from '@/utils/contactForm/contact-validation';
import { createModuleLogger } from '@/lib/telemetry';
import { createGuardHandlers } from '@/utils/contactForm/guard-confirm-factory';
import { useContactIdentityImpactGuard } from '@/hooks/useContactIdentityImpactGuard';
import type { NameCascadeDialogState, AddressImpactDialogState, CompanyIdentityDialogState, CommunicationImpactDialogState } from '@/types/contact-submission-dialog.types';

const logger = createModuleLogger('useContactSubmission');

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface UseContactSubmissionProps {
  editContact?: Contact | null;
  onContactAdded: () => void;
  onOpenChange: (open: boolean) => void;
  resetForm: () => void;
  setValidationErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setTouchedFields: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
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

  // 🔗 Name cascade confirmation (ADR-249 Safety)
  nameCascadeDialog: NameCascadeDialogState | null;
  confirmNameCascade: () => void;
  cancelNameCascade: () => void;

  // 📍 Address impact confirmation (ADR-277 Safety)
  addressImpactDialog: AddressImpactDialogState | null;
  confirmAddressImpact: () => void;
  cancelAddressImpact: () => void;

  // 🏢 Company identity confirmation (ADR-278 Safety)
  companyIdentityDialog: CompanyIdentityDialogState | null;
  confirmCompanyIdentity: () => void;
  cancelCompanyIdentity: () => void;

  // 📧 Communication impact confirmation (ADR-280 Safety)
  communicationImpactDialog: CommunicationImpactDialogState | null;
  confirmCommunicationImpact: () => void;
  cancelCommunicationImpact: () => void;

  // 👤 Individual identity impact confirmation
  individualIdentityImpactDialog: React.ReactNode;
}

// Re-export dialog state types for backward compatibility
export type { NameCascadeDialogState, AddressImpactDialogState, CompanyIdentityDialogState, CommunicationImpactDialogState } from '@/types/contact-submission-dialog.types';

// ============================================================================
// MAIN HOOK
// ============================================================================

/** Contact Form Submission Hook — validation, mapping, guards, API calls. */
export function useContactSubmission({
  editContact,
  onContactAdded,
  onOpenChange,
  resetForm,
  setValidationErrors,
  setTouchedFields,
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

  // 🔗 Name cascade confirmation state (ADR-249 Safety)
  const [nameCascadeDialog, setNameCascadeDialog] = useState<NameCascadeDialogState | null>(null);
  const deferredSubmitRef = useRef<(() => Promise<void>) | null>(null);
  const nameCascadeConfirmedRef = useRef(false);

  // 📍 Address impact confirmation state (ADR-277 Safety)
  const [addressImpactDialog, setAddressImpactDialog] = useState<AddressImpactDialogState | null>(null);
  const deferredAddressSubmitRef = useRef<(() => Promise<void>) | null>(null);
  const addressImpactConfirmedRef = useRef(false);

  // 🏢 Company identity impact confirmation state (ADR-278 Safety)
  const [companyIdentityDialog, setCompanyIdentityDialog] = useState<CompanyIdentityDialogState | null>(null);
  const deferredIdentitySubmitRef = useRef<(() => Promise<void>) | null>(null);
  const companyIdentityConfirmedRef = useRef(false);

  // 📧 Communication impact confirmation state (ADR-280 Safety)
  const [communicationImpactDialog, setCommunicationImpactDialog] = useState<CommunicationImpactDialogState | null>(null);
  const deferredCommunicationSubmitRef = useRef<(() => Promise<void>) | null>(null);
  const communicationImpactConfirmedRef = useRef(false);

  const {
    previewBeforeMutate: previewIdentityImpactBeforeMutate,
    ImpactDialog: individualIdentityImpactDialog,
  } = useContactIdentityImpactGuard(editContact);

  const focusField = useCallback((fieldName?: string) => {
    if (!fieldName || typeof document === 'undefined') return;

    window.setTimeout(() => {
      const selector = `[name="${fieldName}"], #${fieldName}`;
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement)) return;

      element.focus();
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 0);
  }, []);

  // ========================================================================
  // VALIDATION
  // ========================================================================

  /**
   * Validate form data based on contact type
   *
   * @param formData - Form data to validate
   * @returns true if valid, false if invalid
   */
  const getValidationResult = useCallback((formData: ContactFormData) => {
    switch (formData.type) {
      case 'individual':
        return validateIndividualContact(formData);

      case 'company':
        return validateCompanyContact(formData);

      case 'service':
        return validateServiceContact(formData);

      default:
        logger.error('SUBMISSION: Unknown contact type', { type: formData.type });
        return null;
    }
  }, []);

  const validateFormData = useCallback((formData: ContactFormData): boolean => {
    const validationResult = getValidationResult(formData);
    if (!validationResult) {
      notifications.error("validation.unknownType");
      return false;
    }

    setValidationErrors(validationResult.fieldErrors);
    setTouchedFields(prev => ({
      ...prev,
      ...Object.fromEntries(Object.keys(validationResult.fieldErrors).map((fieldName) => [fieldName, true])),
    }));

    if (!validationResult.isValid) {
      notifications.error('validation.individual.reviewHighlightedFields');
      focusField(validationResult.firstErrorField);
      return false;
    }

    return true;
  }, [focusField, getValidationResult, notifications, setTouchedFields, setValidationErrors]);

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
    const uploadValidation = validateUploadState(formData);

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
        const editContactId = editContact?.id;
        if (!editContactId) return;

        const performUpdate = async () => {
          // 📸 Enterprise photo cleanup (non-blocking)
          await cleanupOrphanedPhotos(editContact, contactData);

          // 🛡️ Run guard chain (ADR-249, ADR-277, ADR-278, ADR-280)
          const guardResult = await runGuardChain({
            editContact, editContactId, contactData, formData,
            nameCascadeConfirmedRef, addressImpactConfirmedRef,
            companyIdentityConfirmedRef, communicationImpactConfirmedRef,
            deferredSubmitRef, deferredAddressSubmitRef,
            deferredIdentitySubmitRef, deferredCommunicationSubmitRef,
            setNameCascadeDialog, setAddressImpactDialog,
            setCompanyIdentityDialog, setCommunicationImpactDialog,
            notifications,
          });

          if (guardResult.blocked) {
            notifications.error(guardResult.errorKey);
            return;
          }
          if (guardResult.deferred) {
            return;
          }

          await ContactsService.updateContact(editContactId, contactData);
          notifications.success("contacts.submission.updateSuccess");
        };

        const completed = await previewIdentityImpactBeforeMutate(formData, performUpdate);
        if (!completed) {
          setLoading(false);
          return;
        }
      } else {
        // Create new contact
        logger.info('SUBMISSION: Creating new contact');
        await ContactsService.createContact(contactData);
        notifications.success("contacts.submission.createSuccess");
      }

      // Success callbacks
      setValidationErrors({});
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
      handleSubmissionError(error, formData.type, editContact, notifications);

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

    const uploadValidation = validateUploadState(formData);

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

  /** 🏢 Enterprise Layer 3: Get submission state for UI coordination */
  const getSubmissionState = useCallback((formData: ContactFormData) => {
    const validationResult = getValidationResult(formData);
    return calculateSubmissionState(formData, {
      loading,
      pendingSave,
      isValidForm: validationResult?.isValid ?? false,
      editContact,
    });
  }, [loading, pendingSave, getValidationResult, editContact]);

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

    // 🔗 Name cascade confirmation (ADR-249 Safety)
    nameCascadeDialog,
    ...(() => {
      const h = createGuardHandlers({
        setDialogState: () => setNameCascadeDialog(null),
        deferredSubmitRef, confirmedRef: nameCascadeConfirmedRef,
        setLoading, onContactAdded, notifyError: notifications.error,
      });
      return { confirmNameCascade: h.confirm, cancelNameCascade: h.cancel };
    })(),

    // 📍 Address impact confirmation (ADR-277 Safety)
    addressImpactDialog,
    ...(() => {
      const h = createGuardHandlers({
        setDialogState: () => setAddressImpactDialog(null),
        deferredSubmitRef: deferredAddressSubmitRef, confirmedRef: addressImpactConfirmedRef,
        setLoading, onContactAdded, notifyError: notifications.error,
      });
      return { confirmAddressImpact: h.confirm, cancelAddressImpact: h.cancel };
    })(),

    // 🏢 Company identity confirmation (ADR-278 Safety)
    companyIdentityDialog,
    ...(() => {
      const h = createGuardHandlers({
        setDialogState: () => setCompanyIdentityDialog(null),
        deferredSubmitRef: deferredIdentitySubmitRef, confirmedRef: companyIdentityConfirmedRef,
        setLoading, onContactAdded, notifyError: notifications.error,
      });
      return { confirmCompanyIdentity: h.confirm, cancelCompanyIdentity: h.cancel };
    })(),

    // 📧 Communication impact confirmation (ADR-280 Safety)
    communicationImpactDialog,
    ...(() => {
      const h = createGuardHandlers({
        setDialogState: () => setCommunicationImpactDialog(null),
        deferredSubmitRef: deferredCommunicationSubmitRef, confirmedRef: communicationImpactConfirmedRef,
        setLoading, onContactAdded, notifyError: notifications.error,
      });
      return { confirmCommunicationImpact: h.confirm, cancelCommunicationImpact: h.cancel };
    })(),

    // 👤 Individual identity impact confirmation
    individualIdentityImpactDialog,
  };
}

// Address impact helpers extracted to utils/contactForm/address-impact-helpers.ts
