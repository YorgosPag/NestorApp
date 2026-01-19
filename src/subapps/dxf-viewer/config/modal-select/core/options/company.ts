/**
 * @fileoverview Company & Legal Forms Options Module
 * @description Extracted from modal-select.ts - COMPANY & LEGAL FORMS
 * @author Claude (Anthropic AI)
 * @date 2025-12-28
 * @version 1.0.0 - ENTERPRISE MODULAR ARCHITECTURE
 * @compliance CLAUDE.md Enterprise Standards - MODULAR SPLITTING
 */

// ====================================================================
// COMPANY & LEGAL FORMS - 🏢 ENTERPRISE CENTRALIZED
// ====================================================================

/**
 * Standardized company legal forms για Ελληνικό νομικό σύστημα
 * 🏢 ENTERPRISE: i18n keys for multilingual support
 * Labels are translated at runtime by GenericFormRenderer
 */
export const MODAL_SELECT_LEGAL_FORMS = [
  { value: 'ae', label: 'contacts.company.legalForms.ae' },
  { value: 'epe', label: 'contacts.company.legalForms.epe' },
  { value: 'ee', label: 'contacts.company.legalForms.ee' },
  { value: 'oe', label: 'contacts.company.legalForms.oe' },
  { value: 'ike', label: 'contacts.company.legalForms.ike' },
  { value: 'syndicate', label: 'contacts.company.legalForms.smpc' },
  { value: 'sole_proprietorship', label: 'contacts.company.legalForms.mono' },
  { value: 'civil_partnership', label: 'contacts.company.legalForms.other' },
  { value: 'joint_venture', label: 'contacts.company.legalForms.other' },
  { value: 'other', label: 'contacts.company.legalForms.other' }
] as const;

/**
 * Standardized ΓΕΜΗ statuses
 * 🏢 ENTERPRISE: i18n keys for multilingual support
 */
export const MODAL_SELECT_GEMI_STATUSES = [
  { value: 'active', label: 'contacts.options.gemiStatuses.active' },
  { value: 'inactive', label: 'contacts.options.gemiStatuses.inactive' },
  { value: 'suspended', label: 'contacts.options.gemiStatuses.suspended' },
  { value: 'dissolution', label: 'contacts.options.gemiStatuses.dissolution' },
  { value: 'dissolved', label: 'contacts.options.gemiStatuses.dissolved' },
  { value: 'bankruptcy', label: 'contacts.options.gemiStatuses.bankruptcy' },
  { value: 'liquidation', label: 'contacts.options.gemiStatuses.liquidation' }
] as const;

/**
 * Standardized service categories
 * 🏢 ENTERPRISE: i18n keys for multilingual support
 */
export const MODAL_SELECT_SERVICE_CATEGORIES = [
  { value: 'ministry', label: 'contacts.options.serviceCategories.ministry' },
  { value: 'region', label: 'contacts.options.serviceCategories.region' },
  { value: 'municipality', label: 'contacts.options.serviceCategories.municipality' },
  { value: 'public_entity', label: 'contacts.options.serviceCategories.publicEntity' },
  { value: 'independent_authority', label: 'contacts.options.serviceCategories.independentAuthority' },
  { value: 'university', label: 'contacts.options.serviceCategories.university' },
  { value: 'hospital', label: 'contacts.options.serviceCategories.hospital' },
  { value: 'school', label: 'contacts.options.serviceCategories.school' },
  { value: 'other', label: 'contacts.options.serviceCategories.other' }
] as const;

/**
 * Standardized legal statuses για δημόσιες υπηρεσίες
 * 🏢 ENTERPRISE: i18n keys for multilingual support
 */
export const MODAL_SELECT_LEGAL_STATUSES = [
  { value: 'npdd', label: 'contacts.options.legalStatuses.npdd' },
  { value: 'npid', label: 'contacts.options.legalStatuses.npid' },
  { value: 'public_service', label: 'contacts.options.legalStatuses.publicService' },
  { value: 'independent_authority', label: 'contacts.options.legalStatuses.independentAuthority' },
  { value: 'decentralized_admin', label: 'contacts.options.legalStatuses.decentralizedAdmin' }
] as const;

/**
 * Standardized activity types
 * 🏢 ENTERPRISE: i18n keys for multilingual support
 */
export const MODAL_SELECT_ACTIVITY_TYPES = [
  { value: 'main', label: 'contacts.options.activityTypes.main' },
  { value: 'secondary', label: 'contacts.options.activityTypes.secondary' }
] as const;

/**
 * Standardized address types
 * 🏢 ENTERPRISE: i18n keys for multilingual support
 */
export const MODAL_SELECT_ADDRESS_TYPES = [
  { value: 'headquarters', label: 'contacts.options.addressTypes.headquarters' },
  { value: 'branch', label: 'contacts.options.addressTypes.branch' }
] as const;

/**
 * Standardized shareholder types
 * 🏢 ENTERPRISE: i18n keys for multilingual support
 */
export const MODAL_SELECT_SHAREHOLDER_TYPES = [
  { value: 'individual', label: 'contacts.options.shareholderTypes.individual' },
  { value: 'legal', label: 'contacts.options.shareholderTypes.legal' }
] as const;

// ====================================================================
// 🏢 COMPANY GEMI HELP TEXTS - ENTERPRISE CENTRALIZED
// 🌐 i18n: Uses keys from contacts.json namespace - 2026-01-18
// ====================================================================

/**
 * ✅ ENTERPRISE: Centralized Help Text System για ΓΕΜΗ Fields
 * Single Source of Truth για όλα τα help texts των company fields
 * Αντικαθιστά διάσπαρτα help strings σε όλη την εφαρμογή
 * 🌐 i18n: All help texts converted to i18n keys
 */
export const MODAL_SELECT_COMPANY_HELP_TEXTS = {
  AFM: 'contacts.company.helpTexts.afm',
  DOY: 'contacts.company.helpTexts.doy',
  GEMI_NUMBER: 'contacts.company.helpTexts.gemiNumber',
  LEGAL_FORM: 'contacts.company.helpTexts.legalForm',
  BUSINESS_NAME: 'contacts.company.helpTexts.businessName',
  TRADE_NAME: 'contacts.company.helpTexts.tradeName',
  ACTIVITY_CODE: 'contacts.company.helpTexts.activityCode',
  CAPITAL: 'contacts.company.helpTexts.capital'
} as const;

// ====================================================================
// ACCESSOR FUNCTIONS - 🏢 ENTERPRISE CENTRALIZED
// ====================================================================

/**
 * Get legal forms για Ελληνικές εταιρείες
 */
export function getLegalFormOptions() {
  return MODAL_SELECT_LEGAL_FORMS;
}

/**
 * Get ΓΕΜΉ status options
 */
export function getGemiStatusOptions() {
  return MODAL_SELECT_GEMI_STATUSES;
}

/**
 * Get service category options
 */
export function getServiceCategoryOptions() {
  return MODAL_SELECT_SERVICE_CATEGORIES;
}

/**
 * Get legal status options για δημόσιες υπηρεσίες
 */
export function getLegalStatusOptions() {
  return MODAL_SELECT_LEGAL_STATUSES;
}

/**
 * Get activity type options
 */
export function getActivityTypeOptions() {
  return MODAL_SELECT_ACTIVITY_TYPES;
}

/**
 * Get address type options
 */
export function getAddressTypeOptions() {
  return MODAL_SELECT_ADDRESS_TYPES;
}

/**
 * Get shareholder type options
 */
export function getShareholderTypeOptions() {
  return MODAL_SELECT_SHAREHOLDER_TYPES;
}

/**
 * ✅ ENTERPRISE: Get centralized GEMI help texts
 * Accessor function για τα help texts - διατηρεί consistency με το getCompanyFieldLabels pattern
 */
export function getGemiHelpTexts() {
  return MODAL_SELECT_COMPANY_HELP_TEXTS;
}