/**
 * @fileoverview Validation Messages Module
 * @description Extracted from modal-select.ts - VALIDATION MESSAGES
 * @author Claude (Anthropic AI)
 * @date 2025-12-28
 * @version 1.0.0 - ENTERPRISE MODULAR ARCHITECTURE
 * @compliance CLAUDE.md Enterprise Standards - MODULAR SPLITTING
 */

// ====================================================================
// VALIDATION MESSAGES - 🏢 ENTERPRISE CENTRALIZED
// ====================================================================

/**
 * Validation Messages Configuration Type - Required Fields
 * ✅ ENTERPRISE: Type-safe required field messages
 */
export interface ValidationRequiredMessagesConfig {
  readonly first_name_required: string;
  readonly last_name_required: string;
  readonly company_name_required: string;
  readonly service_name_required: string;
}

/**
 * Validation Messages Configuration Type - Format Validation
 * ✅ ENTERPRISE: Type-safe format validation messages
 */
export interface ValidationFormatMessagesConfig {
  readonly vat_individual_format: string;
  readonly vat_company_format: string;
  readonly amka_format: string;
}

/**
 * Validation Messages Configuration Type - Date Validation
 * ✅ ENTERPRISE: Type-safe date validation messages
 */
export interface ValidationDateMessagesConfig {
  readonly birthdate_invalid: string;
  readonly birthdate_future_error: string;
  readonly issue_date_future_error: string;
  readonly expiry_after_issue_error: string;
  readonly past_date_error: string;
  readonly date_comparison_error: string;
}

/**
 * Validation Messages Configuration Type - Generic Validation
 * ✅ ENTERPRISE: Type-safe generic validation messages
 */
export interface ValidationGenericMessagesConfig {
  readonly required: string;
  readonly minLength: string;
  readonly maxLength: string;
  readonly exactLength: string;
  readonly invalidEmail: string;
  readonly invalidPhone: string;
  readonly invalidUrl: string;
  readonly invalidNumber: string;
  readonly notInteger: string;
  readonly positiveNumber: string;
  readonly nonNegativeNumber: string;
  readonly minValue: string;
  readonly maxValue: string;
  readonly greaterThan: string;
  readonly lessThan: string;
  readonly invalidDate: string;
  readonly pastDate: string;
  readonly futureDate: string;
  readonly invalidSelection: string;
  readonly areaRequired: string;
  readonly priceRequired: string;
  readonly invalidCode: string;
  readonly confirmPassword: string;
}

/**
 * Complete Validation Messages Configuration Type
 * ✅ ENTERPRISE: Complete validation messages interface
 */
export interface ValidationMessagesConfig
  extends ValidationRequiredMessagesConfig,
          ValidationFormatMessagesConfig,
          ValidationDateMessagesConfig,
          ValidationGenericMessagesConfig {}

/**
 * Validation Messages - Centralized για όλα τα validation messages
 * ✅ ENTERPRISE: Single source of truth για όλα τα validation messages
 */
export const MODAL_SELECT_VALIDATION_MESSAGES: ValidationMessagesConfig = {
  // Required field messages
  first_name_required: 'Το όνομα είναι υποχρεωτικό',
  last_name_required: 'Το επώνυμο είναι υποχρεωτικό',
  company_name_required: 'Η επωνυμία εταιρείας είναι υποχρεωτική',
  service_name_required: 'Το όνομα υπηρεσίας είναι υποχρεωτικό',

  // Format validation messages
  vat_individual_format: 'Ο ΑΦΜ πρέπει να είναι ακριβώς 9 ψηφία',
  vat_company_format: 'Ο ΑΦΜ εταιρείας πρέπει να είναι ακριβώς 9 ψηφία',
  amka_format: 'Ο ΑΜΚΑ πρέπει να είναι ακριβώς 11 ψηφία',

  // Date validation messages
  birthdate_invalid: 'Μη έγκυρη ημερομηνία γέννησης',
  birthdate_future_error: 'Η ημερομηνία γέννησης δεν μπορεί να είναι μελλοντική',
  issue_date_future_error: 'Η ημερομηνία έκδοσης δεν μπορεί να είναι μελλοντική',
  expiry_after_issue_error: 'Η ημερομηνία λήξης πρέπει να είναι μετά την ημερομηνία έκδοσης',
  past_date_error: 'Η ημερομηνία δεν μπορεί να είναι παρελθούσα',
  date_comparison_error: 'Μη έγκυρη σύγκριση ημερομηνιών',

  // Generic validation messages
  required: 'Αυτό το πεδίο είναι υποχρεωτικό',
  minLength: 'Πρέπει να είναι τουλάχιστον {min} χαρακτήρες',
  maxLength: 'Δεν μπορεί να ξεπερνά τους {max} χαρακτήρες',
  exactLength: 'Πρέπει να είναι ακριβώς {length} χαρακτήρες',
  invalidEmail: 'Μη έγκυρη διεύθυνση email',
  invalidPhone: 'Μη έγκυρος αριθμός τηλεφώνου',
  invalidUrl: 'Μη έγκυρη διεύθυνση URL',
  invalidNumber: 'Πρέπει να είναι έγκυρος αριθμός',
  notInteger: 'Πρέπει να είναι ακέραιος αριθμός',
  positiveNumber: 'Πρέπει να είναι θετικός αριθμός',
  nonNegativeNumber: 'Δεν μπορεί να είναι αρνητικός αριθμός',
  minValue: 'Πρέπει να είναι τουλάχιστον {min}',
  maxValue: 'Δεν μπορεί να ξεπερνά το {max}',
  greaterThan: 'Πρέπει να είναι μεγαλύτερος από {value}',
  lessThan: 'Πρέπει να είναι μικρότερος από {value}',
  invalidDate: 'Μη έγκυρη ημερομηνία',
  pastDate: 'Η ημερομηνία πρέπει να είναι παρελθούσα',
  futureDate: 'Η ημερομηνία πρέπει να είναι μελλοντική',
  invalidSelection: 'Μη έγκυρη επιλογή',
  areaRequired: 'Το εμβαδόν πρέπει να είναι θετικός αριθμός',
  priceRequired: 'Η τιμή πρέπει να είναι θετικός αριθμός',
  invalidCode: 'Μη έγκυρος κωδικός',
  confirmPassword: 'Οι κωδικοί δεν ταιριάζουν'
} as const;

// ====================================================================
// ACCESSOR FUNCTIONS - 🏢 ENTERPRISE CENTRALIZED
// ====================================================================

/**
 * Get validation messages
 * ✅ CENTRALIZED: Getter function για validation messages
 */
export function getValidationMessages(): ValidationMessagesConfig {
  return MODAL_SELECT_VALIDATION_MESSAGES;
}

/**
 * Get required field validation messages
 * ✅ CENTRALIZED: Getter function για required field messages
 */
export function getRequiredFieldMessages(): ValidationRequiredMessagesConfig {
  const messages = MODAL_SELECT_VALIDATION_MESSAGES;
  return {
    first_name_required: messages.first_name_required,
    last_name_required: messages.last_name_required,
    company_name_required: messages.company_name_required,
    service_name_required: messages.service_name_required
  };
}

/**
 * Get format validation messages
 * ✅ CENTRALIZED: Getter function για format validation messages
 */
export function getFormatValidationMessages(): ValidationFormatMessagesConfig {
  const messages = MODAL_SELECT_VALIDATION_MESSAGES;
  return {
    vat_individual_format: messages.vat_individual_format,
    vat_company_format: messages.vat_company_format,
    amka_format: messages.amka_format
  };
}

/**
 * Get date validation messages
 * ✅ CENTRALIZED: Getter function για date validation messages
 */
export function getDateValidationMessages(): ValidationDateMessagesConfig {
  const messages = MODAL_SELECT_VALIDATION_MESSAGES;
  return {
    birthdate_invalid: messages.birthdate_invalid,
    birthdate_future_error: messages.birthdate_future_error,
    issue_date_future_error: messages.issue_date_future_error,
    expiry_after_issue_error: messages.expiry_after_issue_error,
    past_date_error: messages.past_date_error,
    date_comparison_error: messages.date_comparison_error
  };
}

/**
 * Get generic validation messages
 * ✅ CENTRALIZED: Getter function για generic validation messages
 */
export function getGenericValidationMessages(): ValidationGenericMessagesConfig {
  const messages = MODAL_SELECT_VALIDATION_MESSAGES;
  return {
    required: messages.required,
    minLength: messages.minLength,
    maxLength: messages.maxLength,
    exactLength: messages.exactLength,
    invalidEmail: messages.invalidEmail,
    invalidPhone: messages.invalidPhone,
    invalidUrl: messages.invalidUrl,
    invalidNumber: messages.invalidNumber,
    notInteger: messages.notInteger,
    positiveNumber: messages.positiveNumber,
    nonNegativeNumber: messages.nonNegativeNumber,
    minValue: messages.minValue,
    maxValue: messages.maxValue,
    greaterThan: messages.greaterThan,
    lessThan: messages.lessThan,
    invalidDate: messages.invalidDate,
    pastDate: messages.pastDate,
    futureDate: messages.futureDate,
    invalidSelection: messages.invalidSelection,
    areaRequired: messages.areaRequired,
    priceRequired: messages.priceRequired,
    invalidCode: messages.invalidCode,
    confirmPassword: messages.confirmPassword
  };
}