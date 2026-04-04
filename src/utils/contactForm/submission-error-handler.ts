/**
 * 🚨 Submission Error Handler — Intelligent error categorization
 *
 * Handles duplicate detection and standard errors with enterprise logging.
 *
 * @module utils/contactForm/submission-error-handler
 * @enterprise Duplicate Prevention + i18n Error Messages
 */

import type { Contact } from '@/types/contacts';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('SubmissionError');

interface ErrorNotifications {
  error: (msg: string, opts?: { duration?: number }) => void;
  warning: (msg: string, opts?: { duration?: number }) => void;
  info: (msg: string, opts?: { duration?: number }) => void;
}

/**
 * Handle submission errors with intelligent categorization.
 */
export function handleSubmissionError(
  error: unknown,
  formType: string,
  editContact: Contact | null | undefined,
  notifications: ErrorNotifications
): void {
  const errorMessage = getErrorMessage(error);

  if (errorMessage.startsWith('DUPLICATE_CONTACT_DETECTED')) {
    const confidenceMatch = errorMessage.match(/Confidence: ([\d.]+)%/);
    const contactIdMatch = errorMessage.match(/Contact ID: ([^\]]+)\]/);
    const confidence = confidenceMatch ? parseFloat(confidenceMatch[1]) : 0;

    if (confidence >= 95) {
      notifications.error('contacts.duplicate.exactMatch', { duration: 8000 });
    } else if (confidence >= 80) {
      notifications.warning('contacts.duplicate.similarMatch', { duration: 6000 });
    } else {
      notifications.info('contacts.duplicate.possibleMatch', { duration: 5000 });
    }

    logger.info('Duplicate handling applied', {
      confidence,
      hasExistingId: Boolean(contactIdMatch?.[1]),
    });
  } else {
    notifications.error(
      editContact ? 'contacts-form.submission.updateError' : 'contacts-form.submission.createError'
    );
    logger.error('Submission failed', { contactType: formType, isEdit: Boolean(editContact), errorMessage });
  }
}
