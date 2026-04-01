/**
 * 📋 Contact Form Validation — Type-specific validation functions
 *
 * Extracted from useContactSubmission to comply with 500-line hook limit.
 *
 * @module utils/contactForm/contact-validation
 * @enterprise Google SRP — Single Responsibility Principle
 */

import type { ContactFormData } from '@/types/ContactFormTypes';
import { validateDocumentDates, isDatePastOrToday } from '@/utils/validation';
import { isValidGreekVat } from '@/lib/validation/vat-validation';
import { validateCommunicationArrays } from '@/utils/contactForm/communication-array-validation';

// ============================================================================
// TYPES
// ============================================================================

/** Notification service interface for validation feedback */
export interface ValidationNotificationService {
  error: (message: string, options?: { duration?: number }) => void;
  success: (message: string, options?: { duration?: number }) => void;
  warning: (message: string, options?: { duration?: number }) => void;
  info: (message: string, options?: { duration?: number }) => void;
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate individual contact form data with Enterprise Date Validation
 */
export function validateIndividualContact(
  formData: ContactFormData,
  notifications: ValidationNotificationService
): boolean {
  if (!formData.firstName.trim() || !formData.lastName.trim()) {
    notifications.error('validation.contacts.individual.nameRequired');
    return false;
  }

  const vatNumber = formData.vatNumber?.trim() ?? '';
  if (vatNumber && !isValidGreekVat(vatNumber)) {
    notifications.error('validation.contacts.vatInvalid');
    return false;
  }

  if (formData.birthDate && formData.birthDate.trim() !== '') {
    if (!isDatePastOrToday(formData.birthDate)) {
      notifications.error('validation.contacts.individual.birthDateFuture', { duration: 6000 });
      return false;
    }
  }

  if (formData.documentIssueDate && formData.documentIssueDate.trim() !== '') {
    if (!isDatePastOrToday(formData.documentIssueDate)) {
      notifications.error('validation.contacts.individual.documentIssueDateFuture', { duration: 6000 });
      return false;
    }
  }

  const documentDatesValidation = validateDocumentDates({
    documentIssueDate: formData.documentIssueDate,
    documentExpiryDate: formData.documentExpiryDate,
  });
  if (!documentDatesValidation.isValid && documentDatesValidation.error) {
    notifications.error('validation.contacts.individual.documentDatesInvalid', { duration: 6000 });
    return false;
  }

  const arrayResult = validateCommunicationArrays(formData);
  if (!arrayResult.valid && arrayResult.errorKey) {
    notifications.error(arrayResult.errorKey);
    return false;
  }

  return true;
}

/**
 * Validate company contact form data
 */
export function validateCompanyContact(
  formData: ContactFormData,
  notifications: ValidationNotificationService
): boolean {
  const vatNumber = formData.companyVatNumber?.trim() || formData.vatNumber?.trim() || '';

  if (!formData.companyName.trim() || !vatNumber) {
    notifications.error('validation.contacts.company.nameAndVatRequired');
    return false;
  }

  if (!isValidGreekVat(vatNumber)) {
    notifications.error('validation.contacts.vatInvalid');
    return false;
  }

  const arrayResult = validateCommunicationArrays(formData);
  if (!arrayResult.valid && arrayResult.errorKey) {
    notifications.error(arrayResult.errorKey);
    return false;
  }

  return true;
}

/**
 * Validate service contact form data
 */
export function validateServiceContact(
  formData: ContactFormData,
  notifications: ValidationNotificationService
): boolean {
  const serviceName = formData.serviceName?.trim() || formData.name?.trim() || '';

  if (!serviceName) {
    notifications.error('validation.contacts.service.nameRequired');
    return false;
  }

  const arrayResult = validateCommunicationArrays(formData);
  if (!arrayResult.valid && arrayResult.errorKey) {
    notifications.error(arrayResult.errorKey);
    return false;
  }

  return true;
}
