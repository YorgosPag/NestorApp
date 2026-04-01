/**
 * 📊 Submission State Calculator — UI/UX coordination for contact form
 *
 * Extracted from useContactSubmission to comply with 500-line hook limit.
 *
 * @module utils/contactForm/submission-state
 * @enterprise Google SRP — Single Responsibility Principle
 */

import type { Contact } from '@/types/contacts';
import type { ContactFormData } from '@/types/ContactFormTypes';
import { validateUploadState } from '@/utils/contactForm/formDataMapper';

// ============================================================================
// TYPES
// ============================================================================

export interface SubmissionState {
  canSubmit: boolean;
  isUploading: boolean;
  pendingUploads: number;
  buttonText: string;
  statusMessage?: string;
}

// ============================================================================
// CALCULATOR
// ============================================================================

/**
 * Calculate the submission state for UI coordination.
 * Pure function — no side effects.
 */
export function calculateSubmissionState(
  formData: ContactFormData,
  options: {
    loading: boolean;
    pendingSave: boolean;
    isValidForm: boolean;
    editContact?: Contact | null;
  }
): SubmissionState {
  const uploadValidation = validateUploadState(formData as unknown as Record<string, unknown>);

  const isUploading = uploadValidation.pendingUploads > 0;
  const hasFailed = uploadValidation.failedUploads > 0;

  let buttonText = options.editContact ? 'contacts.button.update' : 'contacts.button.create';
  let statusMessage: string | undefined;

  if (options.loading) {
    buttonText = options.editContact ? 'contacts.button.updating' : 'contacts.button.creating';
  } else if (options.pendingSave) {
    buttonText = 'contacts.button.waitingUploads';
    statusMessage = 'contacts.status.waitingPhotos';
  } else if (isUploading) {
    buttonText = 'contacts.button.waitingUploads';
    statusMessage = 'contacts.status.waitingPhotos';
  } else if (hasFailed) {
    buttonText = 'contacts.button.failedPhotos';
    statusMessage = 'contacts.status.fixPhotos';
  } else if (!options.isValidForm) {
    buttonText = 'contacts.button.fillRequired';
  }

  const canSubmit = !options.loading && !options.pendingSave && uploadValidation.isValid && options.isValidForm;

  return {
    canSubmit,
    isUploading,
    pendingUploads: uploadValidation.pendingUploads,
    buttonText,
    statusMessage,
  };
}
