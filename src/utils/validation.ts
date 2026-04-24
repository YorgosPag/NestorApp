import { z } from 'zod';
import i18n from '@/i18n/config';
// ✅ ENTERPRISE: Import centralized validation messages
import { getValidationMessages } from '@/subapps/dxf-viewer/config/modal-select';
import { PHONE_REGEX } from '@/lib/validation/phone-validation';
import { parseDate } from './validation/date-validators';

import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('Validation');

// 🏢 ENTERPRISE: Validation messages config type
type ValidationMessagesConfig = Record<string, string>;

// 🏢 ENTERPRISE: Get centralized validation messages with i18n fallback
const getValidationMessagesOnce = (): ValidationMessagesConfig => {
  try {
    return getValidationMessages();
  } catch (error) {
    logger.warn('Failed to load validation messages, using i18n fallback', { error });
    // 🏢 ENTERPRISE: i18n-based fallback for validation messages
    return {
      // Required field messages
      first_name_required: i18n.t('validation.entities.firstNameRequired', { ns: 'forms' }),
      last_name_required: i18n.t('validation.entities.lastNameRequired', { ns: 'forms' }),
      company_name_required: i18n.t('validation.entities.companyNameRequired', { ns: 'forms' }),
      service_name_required: i18n.t('validation.entities.serviceNameRequired', { ns: 'forms' }),

      // Format validation messages
      vat_individual_format: i18n.t('validation.entities.vatIndividualFormat', { ns: 'forms' }),
      vat_company_format: i18n.t('validation.entities.vatCompanyFormat', { ns: 'forms' }),
      amka_format: i18n.t('validation.entities.amkaFormat', { ns: 'forms' }),

      // Date validation messages
      birthdate_invalid: i18n.t('validation.dates.birthdateInvalid', { ns: 'forms' }),
      birthdate_future_error: i18n.t('validation.dates.birthdateFutureError', { ns: 'forms' }),
      issue_date_future_error: i18n.t('validation.dates.issueDateFutureError', { ns: 'forms' }),
      expiry_after_issue_error: i18n.t('validation.dates.expiryAfterIssueError', { ns: 'forms' }),
      past_date_error: i18n.t('validation.dates.pastDateError', { ns: 'forms' }),
      date_comparison_error: i18n.t('validation.dates.dateComparisonError', { ns: 'forms' }),

      // Generic validation messages - required for ValidationMessagesConfig
      required: i18n.t('validation.required', { ns: 'forms' }),
      minLength: i18n.t('validation.minLength', { ns: 'forms' }),
      maxLength: i18n.t('validation.maxLength', { ns: 'forms' }),
      exactLength: i18n.t('validation.exactLength', { ns: 'forms' }),
      invalidEmail: i18n.t('validation.invalidEmail', { ns: 'forms' }),
      invalidPhone: i18n.t('validation.invalidPhone', { ns: 'forms' }),
      invalidUrl: i18n.t('validation.invalidUrl', { ns: 'forms' }),
      invalidNumber: i18n.t('validation.invalidNumber', { ns: 'forms' }),
      notInteger: i18n.t('validation.notInteger', { ns: 'forms' }),
      positiveNumber: i18n.t('validation.positiveNumber', { ns: 'forms' }),
      nonNegativeNumber: i18n.t('validation.nonNegativeNumber', { ns: 'forms' }),
      minValue: i18n.t('validation.minValue', { ns: 'forms' }),
      maxValue: i18n.t('validation.maxValue', { ns: 'forms' }),
      greaterThan: i18n.t('validation.greaterThan', { ns: 'forms' }),
      lessThan: i18n.t('validation.lessThan', { ns: 'forms' }),
      invalidDate: i18n.t('validation.invalidDate', { ns: 'forms' }),
      pastDate: i18n.t('validation.pastDate', { ns: 'forms' }),
      futureDate: i18n.t('validation.futureDate', { ns: 'forms' }),
      invalidSelection: i18n.t('validation.invalidSelection', { ns: 'forms' }),
      areaRequired: i18n.t('validation.areaRequired', { ns: 'forms' }),
      priceRequired: i18n.t('validation.priceRequired', { ns: 'forms' }),
      invalidCode: i18n.t('validation.invalidCode', { ns: 'forms' }),
      confirmPassword: i18n.t('validation.confirmPassword', { ns: 'forms' })
    };
  }
};

const validationMessages: ValidationMessagesConfig = getValidationMessagesOnce();

// Helper function to get validation message with i18n
export const getValidationMessage = (key: string, params?: Record<string, unknown>) => {
  return i18n.t(`forms.validation.${key}`, { ...params, ns: 'forms' });
};

// Common validation rules with i18n messages
export const validationRules = {
  // String validations
  required: (message?: string) => 
    z.string().min(1, message || getValidationMessage('required')),
  
  minLength: (min: number, message?: string) =>
    z.string().min(min, message || getValidationMessage('minLength', { min })),
  
  maxLength: (max: number, message?: string) =>
    z.string().max(max, message || getValidationMessage('maxLength', { max })),
  
  exactLength: (length: number, message?: string) =>
    z.string().length(length, message || getValidationMessage('exactLength', { length })),

  // Email validation
  email: (message?: string) =>
    z.string().email(message || getValidationMessage('invalidEmail')),

  // Phone validation — ADR-212: centralized
  phone: (message?: string) =>
    z.string().regex(PHONE_REGEX, message || getValidationMessage('invalidPhone')),

  // URL validation
  url: (message?: string) =>
    z.string().url(message || getValidationMessage('invalidUrl')),

  // Number validations
  number: (message?: string) =>
    z.number({ invalid_type_error: message || getValidationMessage('invalidNumber') }),

  integer: (message?: string) =>
    z.number().int(message || getValidationMessage('notInteger')),

  positiveNumber: (message?: string) =>
    z.number().positive(message || getValidationMessage('positiveNumber')),

  nonNegative: (message?: string) =>
    z.number().nonnegative(message || getValidationMessage('nonNegativeNumber')),

  minValue: (min: number, message?: string) =>
    z.number().min(min, message || getValidationMessage('minValue', { min })),

  maxValue: (max: number, message?: string) =>
    z.number().max(max, message || getValidationMessage('maxValue', { max })),

  greaterThan: (value: number, message?: string) =>
    z.number().gt(value, message || getValidationMessage('greaterThan', { value })),

  lessThan: (value: number, message?: string) =>
    z.number().lt(value, message || getValidationMessage('lessThan', { value })),

  // Date validations
  date: (message?: string) =>
    z.date({ invalid_type_error: message || getValidationMessage('invalidDate') }),

  pastDate: (message?: string) =>
    z.date().refine(date => date < new Date(), {
      message: message || getValidationMessage('pastDate')
    }),

  futureDate: (message?: string) =>
    z.date().refine(date => date > new Date(), {
      message: message || getValidationMessage('futureDate')
    }),

  // 🏢 ENTERPRISE DATE VALIDATION SYSTEM για όλη την εφαρμογή
  // ===============================================================

  /**
   * Ημερομηνία γέννησης - δεν μπορεί να είναι μελλοντική
   */
  birthDate: (message?: string) =>
    z.string()
      .optional()
      .refine(dateStr => {
        if (!dateStr || dateStr.trim() === '') return true; // Optional field
        const date = new Date(dateStr);
        return !isNaN(date.getTime()) && date <= new Date();
      }, {
        message: message || validationMessages.birthdate_future_error
      }),

  /**
   * Ημερομηνία έκδοσης εγγράφου - δεν μπορεί να είναι μελλοντική
   */
  documentIssueDate: (message?: string) =>
    z.string()
      .optional()
      .refine(dateStr => {
        if (!dateStr || dateStr.trim() === '') return true; // Optional field
        const date = new Date(dateStr);
        return !isNaN(date.getTime()) && date <= new Date();
      }, {
        message: message || validationMessages.issue_date_future_error
      }),

  /**
   * Ημερομηνία λήξης εγγράφου - πρέπει να είναι μετά την ημερομηνία έκδοσης
   */
  documentExpiryDate: (issueDate?: string, message?: string) =>
    z.string()
      .optional()
      .refine(dateStr => {
        if (!dateStr || dateStr.trim() === '') return true; // Optional field
        if (!issueDate || issueDate.trim() === '') return true; // No issue date to compare

        const expiryDate = new Date(dateStr);
        const issueDateObj = new Date(issueDate);

        if (isNaN(expiryDate.getTime()) || isNaN(issueDateObj.getTime())) return true;

        return expiryDate > issueDateObj;
      }, {
        message: message || validationMessages.expiry_after_issue_error
      }),

  /**
   * Μελλοντική ημερομηνία - για events, meetings, deadlines κλπ
   */
  futureOrTodayDate: (message?: string) =>
    z.string()
      .optional()
      .refine(dateStr => {
        if (!dateStr || dateStr.trim() === '') return true; // Optional field
        const date = new Date(dateStr);
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Start of today
        return !isNaN(date.getTime()) && date >= today;
      }, {
        message: message || validationMessages.past_date_error
      }),

  /**
   * Ημερομηνία εντός εύλογου παρελθόντος (π.χ. max 150 χρόνια πίσω για γεννήσεις)
   */
  reasonablePastDate: (maxYearsAgo: number = 150, message?: string) =>
    z.string()
      .optional()
      .refine(dateStr => {
        if (!dateStr || dateStr.trim() === '') return true; // Optional field
        const date = new Date(dateStr);
        const minDate = new Date();
        minDate.setFullYear(minDate.getFullYear() - maxYearsAgo);
        return !isNaN(date.getTime()) && date >= minDate && date <= new Date();
      }, {
        // 🌐 i18n: Converted to i18n key with interpolation - 2026-01-18
        message: message || `validation.dates.maxYearsAgo`
      }),

  /**
   * Ημερομηνία εντός εύλογου μέλλοντος (π.χ. max 10 χρόνια μπροστά για events)
   */
  reasonableFutureDate: (maxYearsAhead: number = 10, message?: string) =>
    z.string()
      .optional()
      .refine(dateStr => {
        if (!dateStr || dateStr.trim() === '') return true; // Optional field
        const date = new Date(dateStr);
        const maxDate = new Date();
        maxDate.setFullYear(maxDate.getFullYear() + maxYearsAhead);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return !isNaN(date.getTime()) && date >= today && date <= maxDate;
      }, {
        // 🌐 i18n: Converted to i18n key with interpolation - 2026-01-18
        message: message || `validation.dates.maxYearsAhead`
      }),

  // Selection validation
  selection: (options: string[], message?: string) =>
    z.enum(options as [string, ...string[]], {
      errorMap: () => ({ message: message || getValidationMessage('invalidSelection') })
    }),

  // Custom business logic validations
  area: (message?: string) =>
    z.number().positive(message || getValidationMessage('areaRequired')),

  price: (message?: string) =>
    z.number().positive(message || getValidationMessage('priceRequired')),

  code: (message?: string) =>
    z.string().min(1, message || getValidationMessage('invalidCode')),
};

// 🏢 ENTERPRISE DATE UTILITY FUNCTIONS
// Extracted to ./validation/date-validators.ts (ADR-314 Phase B — Google SRP file split)
// formatDateForDisplay alias REMOVED — canonical SSoT: '@/lib/intl-utils'
export {
  parseDate,
  isDatePastOrToday,
} from './validation/date-validators';


// Utility to convert Zod errors to form-friendly format
export const formatZodErrors = (error: z.ZodError) => {
  const formattedErrors: Record<string, string> = {};
  
  error.errors.forEach((err) => {
    const path = err.path.join('.');
    formattedErrors[path] = err.message;
  });
  
  return formattedErrors;
};

// 🏢 ENTERPRISE DATE VALIDATION FUNCTIONS
// =========================================
// Χρησιμοποίησε αυτές τις functions για custom validation logic

/**
 * Validates document expiry date against issue date
 * @param formData - Form data containing both dates
 * @returns validation result
 */
export const validateDocumentDates = (formData: {
  documentIssueDate?: string;
  documentExpiryDate?: string;
}) => {
  const { documentIssueDate, documentExpiryDate } = formData;

  // If either date is missing, skip validation
  if (!documentIssueDate || !documentExpiryDate) return { isValid: true };

  const issueDate = parseDate(documentIssueDate);
  const expiryDate = parseDate(documentExpiryDate);

  // If either date is invalid, skip validation (other validators will catch this)
  if (!issueDate || !expiryDate) return { isValid: true };

  const isValid = expiryDate > issueDate;

  return {
    isValid,
    error: isValid ? undefined : validationMessages.date_comparison_error
  };
};

