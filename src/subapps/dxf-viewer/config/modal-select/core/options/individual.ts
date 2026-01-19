/**
 * @fileoverview Individual & Personal Data Options Module
 * @description Extracted from modal-select.ts - INDIVIDUAL & PERSONAL DATA
 * @author Claude (Anthropic AI)
 * @date 2025-12-28
 * @version 1.0.0 - ENTERPRISE MODULAR ARCHITECTURE
 * @compliance CLAUDE.md Enterprise Standards - MODULAR SPLITTING
 * 🌐 i18n: All labels converted to i18n keys - 2026-01-18
 */

// ====================================================================
// INDIVIDUAL & PERSONAL DATA - 🏢 ENTERPRISE CENTRALIZED
// 🌐 i18n: Uses keys from contacts.json namespace
// ====================================================================

/**
 * Standardized gender options
 * 🌐 i18n: Uses keys from contacts.json namespace
 */
export const MODAL_SELECT_GENDER_OPTIONS = [
  { value: 'male', label: 'contacts.options.gender.male' },
  { value: 'female', label: 'contacts.options.gender.female' },
  { value: 'other', label: 'contacts.options.gender.other' },
  { value: 'prefer_not_to_say', label: 'contacts.options.gender.preferNotToSay' }
] as const;

/**
 * Standardized identity document types
 * 🌐 i18n: Uses keys from contacts.json namespace
 */
export const MODAL_SELECT_IDENTITY_TYPES = [
  { value: 'identity_card', label: 'contacts.options.identity.identityCard' },
  { value: 'passport', label: 'contacts.options.identity.passport' },
  { value: 'drivers_license', label: 'contacts.options.identity.driversLicense' },
  { value: 'other', label: 'contacts.options.identity.other' }
] as const;

/**
 * Standardized country options (common ones για Greece-focused app)
 * 🌐 i18n: Uses keys from common.json namespace
 */
export const MODAL_SELECT_COUNTRY_OPTIONS = [
  { value: 'GR', label: 'common.countries.greece' },
  { value: 'CY', label: 'common.countries.cyprus' },
  { value: 'US', label: 'common.countries.usa' },
  { value: 'DE', label: 'common.countries.germany' },
  { value: 'FR', label: 'common.countries.france' },
  { value: 'IT', label: 'common.countries.italy' },
  { value: 'ES', label: 'common.countries.spain' },
  { value: 'UK', label: 'common.countries.uk' },
  { value: 'AU', label: 'common.countries.australia' },
  { value: 'CA', label: 'common.countries.canada' },
  { value: 'OTHER', label: 'common.countries.other' }
] as const;

/**
 * Standardized currency options
 * 🏢 ENTERPRISE: i18n keys for multilingual support
 */
export const MODAL_SELECT_CURRENCY_OPTIONS = [
  { value: 'EUR', label: 'contacts.options.currencies.eur' },
  { value: 'USD', label: 'contacts.options.currencies.usd' },
  { value: 'GBP', label: 'contacts.options.currencies.gbp' }
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