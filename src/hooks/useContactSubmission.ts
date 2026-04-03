import { useState, useCallback, useRef } from 'react';
import type React from 'react';
import { useNotifications } from '@/providers/NotificationProvider';
import type { Contact } from '@/types/contacts';
import type { ContactFormData } from '@/types/ContactFormTypes';
import { ContactsService } from '@/services/contacts.service';
import { createContactWithPolicy } from '@/services/contact-mutation-gateway';
import { mapFormDataToContact } from '@/utils/contactForm/modular/orchestrator';
import { validateUploadState } from '@/utils/contactForm/validators';
import { calculateSubmissionState } from '@/utils/contactForm/submission-state';
import { handleSubmissionError } from '@/utils/contactForm/submission-error-handler';
import {
  validateIndividualContact,
  validateCompanyContact,
  validateServiceContact,
} from '@/utils/contactForm/contact-validation';
import { createModuleLogger } from '@/lib/telemetry';
import { useGuardedContactMutation } from '@/hooks/useGuardedContactMutation';

const logger = createModuleLogger('useContactSubmission');

export interface UseContactSubmissionProps {
  editContact?: Contact | null;
  onContactAdded: () => void;
  onOpenChange: (open: boolean) => void;
  resetForm: () => void;
  setValidationErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setTouchedFields: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  formDataRef?: React.MutableRefObject<ContactFormData>;
}

export interface UseContactSubmissionReturn {
  loading: boolean;
  handleSubmit: (formData: ContactFormData) => Promise<void>;
  validateFormData: (formData: ContactFormData) => boolean;
  getSubmissionState: (formData: ContactFormData) => {
    canSubmit: boolean;
    isUploading: boolean;
    pendingUploads: number;
    buttonText: string;
    statusMessage?: string;
  };
  attemptPendingSave: (formData: ContactFormData) => void;
  clearPendingSave: () => void;
  isPendingSave: boolean;
  guardDialogs: React.ReactNode;
}

export function useContactSubmission({
  editContact,
  onContactAdded,
  onOpenChange,
  resetForm,
  setValidationErrors,
  setTouchedFields,
  formDataRef,
}: UseContactSubmissionProps): UseContactSubmissionReturn {
  const [loading, setLoading] = useState(false);
  const notifications = useNotifications();
  const [pendingSave, setPendingSave] = useState(false);
  const handleSubmitRef = useRef<((fd: ContactFormData) => Promise<void>) | null>(null);

  const { runExistingContactFormUpdate, guardDialogs } = useGuardedContactMutation({
    editContact,
    notifications,
    onUpdateSucceeded: onContactAdded,
    setLoading,
  });

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
      notifications.error('validation.unknownType');
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

  const handleSubmit = useCallback(async (formData: ContactFormData) => {
    if (loading) {
      logger.warn('SUBMISSION: Already submitting, ignoring duplicate request');
      return;
    }

    if (!validateFormData(formData)) {
      logger.warn('SUBMISSION: Form validation failed');
      return;
    }

    const uploadValidation = validateUploadState(formData);

    if (!uploadValidation.isValid) {
      if (uploadValidation.failedUploads > 0) {
        logger.error('SUBMISSION BLOCKED: Failed uploads detected', { uploadValidation });
        notifications.error('contacts.submission.failedUploads');
        return;
      }

      if (uploadValidation.pendingUploads > 0) {
        logger.info('SUBMISSION: Waiting for uploads to complete', {
          pendingUploads: uploadValidation.pendingUploads,
          errors: uploadValidation.errors,
        });

        notifications.info('contacts.submission.pendingUploads', { duration: 3000 });
        logger.info('DEFERRED SAVE: Uploads in progress — will auto-save on completion', {
          pendingUploads: uploadValidation.pendingUploads,
        });
        setPendingSave(true);
        return;
      }
    }

    setLoading(true);

    try {
      const mappingResult = mapFormDataToContact(formData);
      const { contactData } = mappingResult;

      if (editContact) {
        const editContactId = editContact.id;
        if (!editContactId) return;

        const updateCompleted = await runExistingContactFormUpdate(
          formData,
          'SUBMISSION',
          async () => {
            await ContactsService.updateExistingContactFromForm(editContact, formData);
            notifications.success('contacts.submission.updateSuccess');
          },
        );
        if (!updateCompleted) {
          return;
        }
      } else {
        logger.info('SUBMISSION: Creating new contact');
        await createContactWithPolicy({ contactData });
        notifications.success('contacts.submission.createSuccess');
      }

      setValidationErrors({});
      onContactAdded();

      logger.info('SUBMISSION: Triggering enterprise cache invalidation');
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('contactsUpdated', {
          detail: {
            contactId: editContact?.id || 'new',
            action: editContact ? 'updated' : 'created',
            affectedFields: Object.keys(formData).filter(key => formData[key as keyof typeof formData]),
          },
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
  }, [loading, validateFormData, editContact, notifications, runExistingContactFormUpdate, setValidationErrors, onContactAdded, onOpenChange, resetForm]);

  handleSubmitRef.current = handleSubmit;

  const attemptPendingSave = useCallback((formData: ContactFormData) => {
    if (!pendingSave || loading) return;

    const uploadValidation = validateUploadState(formData);
    if (uploadValidation.failedUploads > 0) {
      logger.info('DEFERRED SAVE: Cancelled — failed uploads detected');
      setPendingSave(false);
      notifications.error('contacts.submission.failedUploads');
      return;
    }

    if (uploadValidation.isValid) {
      logger.info('DEFERRED SAVE: All uploads complete — auto-submitting');
      setPendingSave(false);
      handleSubmitRef.current?.(formData);
    }
  }, [pendingSave, loading, notifications]);

  const clearPendingSave = useCallback(() => {
    setPendingSave(false);
  }, []);

  const getSubmissionState = useCallback((formData: ContactFormData) => {
    const validationResult = getValidationResult(formData);
    return calculateSubmissionState(formData, {
      loading,
      pendingSave,
      isValidForm: validationResult?.isValid ?? false,
      editContact,
    });
  }, [loading, pendingSave, getValidationResult, editContact]);

  return {
    loading,
    handleSubmit,
    validateFormData,
    getSubmissionState,
    attemptPendingSave,
    clearPendingSave,
    isPendingSave: pendingSave,
    guardDialogs,
  };
}
