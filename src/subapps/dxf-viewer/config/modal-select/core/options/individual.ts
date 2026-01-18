/**
 * @fileoverview Individual & Personal Data Options Module
 * @description Extracted from modal-select.ts - INDIVIDUAL & PERSONAL DATA
 * @author Claude (Anthropic AI)
 * @date 2025-12-28
 * @version 1.0.0 - ENTERPRISE MODULAR ARCHITECTURE
 * @compliance CLAUDE.md Enterprise Standards - MODULAR SPLITTING
 */

// ====================================================================
// INDIVIDUAL & PERSONAL DATA - 🏢 ENTERPRISE CENTRALIZED
// ====================================================================

/**
 * Standardized gender options
 */
export const MODAL_SELECT_GENDER_OPTIONS = [
  { value: 'male', label: 'Άντρας' },
  { value: 'female', label: 'Γυναίκα' },
  { value: 'other', label: 'Άλλο' },
  { value: 'prefer_not_to_say', label: 'Προτιμώ να μη το δηλώσω' }
] as const;

/**
 * Standardized identity document types
 */
export const MODAL_SELECT_IDENTITY_TYPES = [
  { value: 'identity_card', label: 'Δελτίο Ταυτότητας' },
  { value: 'passport', label: 'Διαβατήριο' },
  { value: 'drivers_license', label: 'Άδεια Οδήγησης' },
  { value: 'other', label: 'Άλλο' }
] as const;

/**
 * Standardized country options (common ones για Greece-focused app)
 */
export const MODAL_SELECT_COUNTRY_OPTIONS = [
  { value: 'GR', label: 'Ελλάδα' },
  { value: 'CY', label: 'Κύπρος' },
  { value: 'US', label: 'ΗΠΑ' },
  { value: 'DE', label: 'Γερμανία' },
  { value: 'FR', label: 'Γαλλία' },
  { value: 'IT', label: 'Ιταλία' },
  { value: 'ES', label: 'Ισπανία' },
  { value: 'UK', label: 'Ηνωμένο Βασίλειο' },
  { value: 'AU', label: 'Αυστραλία' },
  { value: 'CA', label: 'Καναδάς' },
  { value: 'OTHER', label: 'Άλλη χώρα' }
] as const;

/**
 * Standardized currency options
 * 🏢 ENTERPRISE: i18n keys for multilingual support
 */
export const MODAL_SELECT_CURRENCY_OPTIONS = [
  { value: 'EUR', label: 'options.currencies.eur' },
  { value: 'USD', label: 'options.currencies.usd' },
  { value: 'GBP', label: 'options.currencies.gbp' }
] as const;

// ====================================================================
// ACCESSOR FUNCTIONS - 🏢 ENTERPRISE CENTRALIZED
// ====================================================================

/**
 * Get gender options
 */
export function getGenderOptions() {
  return MODAL_SELECT_GENDER_OPTIONS;
}

/**
 * Get identity document type options
 */
export function getIdentityTypeOptions() {
  return MODAL_SELECT_IDENTITY_TYPES;
}

/**
 * Get country options
 */
export function getCountryOptions() {
  return MODAL_SELECT_COUNTRY_OPTIONS;
}

/**
 * Get currency options
 */
export function getCurrencyOptions() {
  return MODAL_SELECT_CURRENCY_OPTIONS;
}