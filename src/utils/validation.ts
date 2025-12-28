import { z } from 'zod';
import i18n from '@/i18n/config';
// ✅ ENTERPRISE: Import centralized validation messages
import { getValidationMessages } from '@/subapps/dxf-viewer/config/modal-select';

// ✅ ENTERPRISE: Get centralized validation messages ONCE
const validationMessages = getValidationMessages();

// Helper function to get validation message with i18n
export const getValidationMessage = (key: string, params?: Record<string, any>) => {
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

  // Phone validation (international format)
  phone: (message?: string) =>
    z.string().regex(/^\+?[1-9]\d{1,14}$/, message || getValidationMessage('invalidPhone')),

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
        message: message || `Η ημερομηνία δεν μπορεί να είναι πάνω από ${maxYearsAgo} χρόνια πίσω`
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
        message: message || `Η ημερομηνία δεν μπορεί να είναι πάνω από ${maxYearsAhead} χρόνια μπροστά`
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
// ========================================

/**
 * Converts date string to Date object safely
 */
export const parseDate = (dateStr?: string): Date | null => {
  if (!dateStr || dateStr.trim() === '') return null;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
};

/**
 * Checks if date string is valid
 */
export const isValidDate = (dateStr?: string): boolean => {
  return parseDate(dateStr) !== null;
};

/**
 * Compare two dates for validation (returns true if firstDate <= secondDate)
 */
export const isDateBeforeOrEqual = (firstDate?: string, secondDate?: string): boolean => {
  const date1 = parseDate(firstDate);
  const date2 = parseDate(secondDate);
  if (!date1 || !date2) return true; // Skip validation if either date is invalid/empty
  return date1 <= date2;
};

/**
 * Check if date is in the future (including today)
 */
export const isDateFutureOrToday = (dateStr?: string): boolean => {
  const date = parseDate(dateStr);
  if (!date) return true; // Skip validation if date is empty/invalid
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date >= today;
};

/**
 * Check if date is in the past or today
 */
export const isDatePastOrToday = (dateStr?: string): boolean => {
  const date = parseDate(dateStr);
  if (!date) return true; // Skip validation if date is empty/invalid
  return date <= new Date();
};

/**
 * Format date for user display (ΗΗ/ΜΜ/ΕΕΕΕ)
 */
// ⚠️ DEPRECATED: Use formatDateForDisplay from intl-utils.ts for enterprise date formatting
// 🔄 BACKWARD COMPATIBILITY: This function is maintained for legacy support
// 📍 MIGRATION: import { formatDateForDisplay } from '@/lib/intl-utils'
export const formatDateForDisplay = (dateStr?: string): string => {
  // Re-export centralized function for backward compatibility
  const { formatDateForDisplay: centralizedFormatter } = require('../lib/intl-utils');
  return centralizedFormatter(dateStr);
};

// Common validation schemas
export const commonSchemas = {
  // Contact information
  email: validationRules.email(),
  phone: validationRules.phone(),

  // Property information
  area: validationRules.area(),
  price: validationRules.price(),

  // Financial fields
  salePricePerSqm: validationRules.price(),
  costPerSqm: validationRules.price(),
  realizedValue: validationRules.nonNegative(),
  financing: validationRules.nonNegative(),

  // Basic fields
  name: validationRules.required().pipe(validationRules.minLength(2)),
  description: validationRules.maxLength(1000),
  code: validationRules.required().pipe(validationRules.minLength(1)),

  // Numbers
  floor: validationRules.integer(),
  percentage: validationRules.number().pipe(validationRules.minValue(0)).pipe(validationRules.maxValue(100)),

  // 🏢 ENTERPRISE DATE SCHEMAS
  birthDate: validationRules.birthDate(),
  documentIssueDate: validationRules.documentIssueDate(),
  // Note: documentExpiryDate requires dynamic validation with issue date
};

// Password validation
export const passwordSchema = {
  password: validationRules.required().pipe(validationRules.minLength(8)),
  confirmPassword: validationRules.required(),
};

// Password confirmation validation
export const createPasswordConfirmSchema = () => 
  z.object(passwordSchema).refine(
    (data) => data.password === data.confirmPassword,
    {
      message: getValidationMessage('confirmPassword'),
      path: ['confirmPassword'],
    }
  );

// Utility to create form schema from field definitions
export const createFormSchema = (fields: Record<string, z.ZodType>) => {
  return z.object(fields);
};

// Utility to convert Zod errors to form-friendly format
export const formatZodErrors = (error: z.ZodError) => {
  const formattedErrors: Record<string, string> = {};
  
  error.errors.forEach((err) => {
    const path = err.path.join('.');
    formattedErrors[path] = err.message;
  });
  
  return formattedErrors;
};

// Form validation hook for React Hook Form integration
export const createValidationResolver = <T>(schema: z.ZodSchema<T>) => {
  return (values: unknown) => {
    try {
      schema.parse(values);
      return { values, errors: {} };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          values: {},
          errors: formatZodErrors(error)
        };
      }
      throw error;
    }
  };
};

// Export common field validations
export const fieldValidations = {
  // Storage/Property fields
  storageUnit: {
    code: commonSchemas.code,
    area: commonSchemas.area,
    price: commonSchemas.price,
    floor: commonSchemas.floor,
  },

  // Contact fields
  contact: {
    name: commonSchemas.name,
    email: commonSchemas.email,
    phone: commonSchemas.phone,
  },

  // 🏢 INDIVIDUAL CONTACT DATE VALIDATIONS
  individual: {
    // Basic info
    firstName: validationRules.required(validationMessages.first_name_required),
    lastName: validationRules.required(validationMessages.last_name_required),

    // Date validations
    birthDate: validationRules.reasonablePastDate(150, validationMessages.birthdate_invalid),
    documentIssueDate: validationRules.documentIssueDate(),

    // Contact info
    email: validationRules.email().optional(),
    phone: validationRules.phone().optional(),

    // VAT/AMKA numbers
    vatNumber: validationRules.exactLength(9, validationMessages.vat_individual_format).optional(),
    amka: validationRules.exactLength(11, validationMessages.amka_format).optional(),
  },

  // 🏢 COMPANY CONTACT VALIDATIONS
  company: {
    companyName: validationRules.required(validationMessages.company_name_required),
    vatNumber: validationRules.exactLength(9, validationMessages.vat_company_format),
    email: validationRules.email().optional(),
    phone: validationRules.phone().optional(),
  },

  // 🏢 SERVICE CONTACT VALIDATIONS
  service: {
    serviceName: validationRules.required(validationMessages.service_name_required),
    email: validationRules.email().optional(),
    phone: validationRules.phone().optional(),
  },

  // Financial fields
  financial: {
    salePricePerSqm: commonSchemas.salePricePerSqm,
    costPerSqm: commonSchemas.costPerSqm,
    realizedValue: commonSchemas.realizedValue,
    financing: commonSchemas.financing,
  },
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

/**
 * Creates a validation schema for contact forms with date validation
 * @param contactType - Type of contact (individual, company, service)
 * @returns Zod schema with appropriate validations
 */
export const createContactValidationSchema = (contactType: 'individual' | 'company' | 'service') => {
  const baseFields = {
    email: fieldValidations.contact.email,
    phone: fieldValidations.contact.phone,
  };

  switch (contactType) {
    case 'individual':
      return createFormSchema({
        ...baseFields,
        firstName: fieldValidations.individual.firstName,
        lastName: fieldValidations.individual.lastName,
        birthDate: fieldValidations.individual.birthDate,
        documentIssueDate: fieldValidations.individual.documentIssueDate,
        vatNumber: fieldValidations.individual.vatNumber,
        amka: fieldValidations.individual.amka,
      });

    case 'company':
      return createFormSchema({
        ...baseFields,
        companyName: fieldValidations.company.companyName,
        vatNumber: fieldValidations.company.vatNumber,
      });

    case 'service':
      return createFormSchema({
        ...baseFields,
        serviceName: fieldValidations.service.serviceName,
      });

    default:
      return createFormSchema(baseFields);
  }
};