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

export interface ContactValidationResult {
  isValid: boolean;
  fieldErrors: Record<string, string>;
  firstErrorField?: string;
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * Το namespace που ΚΑΤΕΧΕΙ τα κλειδιά σφάλματος αυτού του validator (και του `communication-array-validation`).
 *
 * 🔴 Μετρημένο ζωντανά 2026-10-29 (ADR-327 §8.5.4): η φόρμα ΕΤΑΙΡΕΙΑΣ έδειχνε κάτω από το ΑΦΜ το ωμό
 * `validation.company.nameAndVatRequired` — ο `GenericFormRenderer` μεταφράζει στο `forms`, οι renderers προσώπου/
 * υπηρεσίας στο `contacts-form`. Το κλειδί ήταν σωστό· έλειπε **ποιανού** είναι. Το δηλώνει πλέον η πηγή του
 * (`ns:key`), ώστε να λύνεται ίδια σε κάθε renderer, toast ή ειδοποίηση.
 */
export const CONTACT_VALIDATION_NAMESPACE = 'contacts-form';

/** Κλειδί σφάλματος → πλήρες `contacts-form:…` (ιδεμποτικό: ήδη πλήρες κλειδί μένει ως έχει). */
function qualifyErrorKey(key: string): string {
  return key.includes(':') ? key : `${CONTACT_VALIDATION_NAMESPACE}:${key}`;
}

function buildValidationResult(fieldErrors: Record<string, string>): ContactValidationResult {
  const qualified = Object.fromEntries(Object.entries(fieldErrors).map(([field, key]) => [field, qualifyErrorKey(key)]));
  const errorFields = Object.keys(qualified);
  return {
    isValid: errorFields.length === 0,
    fieldErrors: qualified,
    firstErrorField: errorFields[0],
  };
}

function setFieldError(fieldErrors: Record<string, string>, fieldName: string, errorKey: string): void {
  if (!fieldErrors[fieldName]) {
    fieldErrors[fieldName] = errorKey;
  }
}

/**
 * Το κοινό τέλος των τριών validators: σφάλμα πινάκων επικοινωνίας (στο πεδίο του) + αποτέλεσμα με πλήρη κλειδιά.
 * Ήταν αντιγραμμένο αυτούσιο τρεις φορές (jscpd, 2026-10-29).
 */
function finishValidation(formData: ContactFormData, fieldErrors: Record<string, string>): ContactValidationResult {
  const arrayResult = validateCommunicationArrays(formData);
  if (!arrayResult.valid && arrayResult.errorKey) {
    const k = arrayResult.errorKey.toLowerCase();
    const field = k.includes('phone') ? 'phones'
      : k.includes('email') ? 'emails'
      : k.includes('url') ? 'websites'
      : 'communication';
    setFieldError(fieldErrors, field, arrayResult.errorKey);
  }
  return buildValidationResult(fieldErrors);
}

function validateIndividualField(formData: ContactFormData, fieldName: string): string | undefined {
  switch (fieldName) {
    case 'firstName':
      return formData.firstName.trim() ? undefined : 'validation.individual.firstNameRequired';
    case 'lastName':
      return formData.lastName.trim() ? undefined : 'validation.individual.lastNameRequired';
    case 'birthDate': {
      if (!formData.birthDate || formData.birthDate.trim() === '') return undefined;
      return isDatePastOrToday(formData.birthDate)
        ? undefined
        : 'validation.individual.birthDateFuture';
    }
    case 'documentIssueDate': {
      if (!formData.documentIssueDate || formData.documentIssueDate.trim() === '') return undefined;
      return isDatePastOrToday(formData.documentIssueDate)
        ? undefined
        : 'validation.individual.documentIssueDateFuture';
    }
    case 'documentExpiryDate': {
      const documentDatesValidation = validateDocumentDates({
        documentIssueDate: formData.documentIssueDate,
        documentExpiryDate: formData.documentExpiryDate,
      });
      return documentDatesValidation.isValid
        ? undefined
        : 'validation.individual.documentDatesInvalid';
    }
    case 'vatNumber': {
      const vatNumber = formData.vatNumber?.trim() ?? '';
      if (!vatNumber) return undefined;
      return isValidGreekVat(vatNumber) ? undefined : 'validation.vatInvalid';
    }
    default:
      return undefined;
  }
}

function validateCompanyField(formData: ContactFormData, fieldName: string): string | undefined {
  switch (fieldName) {
    case 'companyName':
      return formData.companyName.trim()
        ? undefined
        : 'validation.company.nameRequired';
    case 'vatNumber':
    case 'companyVatNumber': {
      const vatNumber = formData.companyVatNumber?.trim() || formData.vatNumber?.trim() || '';
      if (!vatNumber) return 'validation.company.nameAndVatRequired';
      return isValidGreekVat(vatNumber) ? undefined : 'validation.vatInvalid';
    }
    default:
      return undefined;
  }
}

function validateServiceField(formData: ContactFormData, fieldName: string): string | undefined {
  switch (fieldName) {
    case 'serviceName':
    case 'name': {
      const serviceName = formData.serviceName?.trim() || formData.name?.trim() || '';
      return serviceName ? undefined : 'validation.service.nameRequired';
    }
    default:
      return undefined;
  }
}

// ============================================================================
// PUBLIC FIELD-LEVEL VALIDATION
// ============================================================================

export function validateContactField(formData: ContactFormData, fieldName: string): string | undefined {
  const key = validateFieldByType(formData, fieldName);
  return key === undefined ? undefined : qualifyErrorKey(key);
}

function validateFieldByType(formData: ContactFormData, fieldName: string): string | undefined {
  switch (formData.type) {
    case 'individual':
      return validateIndividualField(formData, fieldName);
    case 'company':
      return validateCompanyField(formData, fieldName);
    case 'service':
      return validateServiceField(formData, fieldName);
    default:
      return undefined;
  }
}

// ============================================================================
// FULL-FORM VALIDATION
// ============================================================================

export function validateIndividualContact(formData: ContactFormData): ContactValidationResult {
  const fieldErrors: Record<string, string> = {};

  const firstNameError = validateIndividualField(formData, 'firstName');
  if (firstNameError) setFieldError(fieldErrors, 'firstName', firstNameError);

  const lastNameError = validateIndividualField(formData, 'lastName');
  if (lastNameError) setFieldError(fieldErrors, 'lastName', lastNameError);

  const vatError = validateIndividualField(formData, 'vatNumber');
  if (vatError) setFieldError(fieldErrors, 'vatNumber', vatError);

  const birthDateError = validateIndividualField(formData, 'birthDate');
  if (birthDateError) setFieldError(fieldErrors, 'birthDate', birthDateError);

  const issueDateError = validateIndividualField(formData, 'documentIssueDate');
  if (issueDateError) setFieldError(fieldErrors, 'documentIssueDate', issueDateError);

  const expiryDateError = validateIndividualField(formData, 'documentExpiryDate');
  if (expiryDateError) setFieldError(fieldErrors, 'documentExpiryDate', expiryDateError);

  return finishValidation(formData, fieldErrors);
}

export function validateCompanyContact(formData: ContactFormData): ContactValidationResult {
  const fieldErrors: Record<string, string> = {};

  const companyNameError = validateCompanyField(formData, 'companyName');
  if (companyNameError) setFieldError(fieldErrors, 'companyName', companyNameError);

  const vatError = validateCompanyField(formData, 'companyVatNumber');
  if (vatError) {
    setFieldError(fieldErrors, 'companyVatNumber', vatError);
    setFieldError(fieldErrors, 'vatNumber', vatError);
  }

  return finishValidation(formData, fieldErrors);
}

export function validateServiceContact(formData: ContactFormData): ContactValidationResult {
  const fieldErrors: Record<string, string> = {};

  const serviceNameError = validateServiceField(formData, 'serviceName');
  if (serviceNameError) {
    setFieldError(fieldErrors, 'serviceName', serviceNameError);
    setFieldError(fieldErrors, 'name', serviceNameError);
  }

  return finishValidation(formData, fieldErrors);
}
