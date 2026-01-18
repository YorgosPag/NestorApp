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
  { value: 'ae', label: 'options.legalForms.ae' },
  { value: 'epe', label: 'options.legalForms.epe' },
  { value: 'ee', label: 'options.legalForms.ee' },
  { value: 'oe', label: 'options.legalForms.oe' },
  { value: 'ike', label: 'options.legalForms.ike' },
  { value: 'syndicate', label: 'options.legalForms.syndicate' },
  { value: 'sole_proprietorship', label: 'options.legalForms.soleProprietorship' },
  { value: 'civil_partnership', label: 'options.legalForms.civilPartnership' },
  { value: 'joint_venture', label: 'options.legalForms.jointVenture' },
  { value: 'other', label: 'options.legalForms.other' }
] as const;

/**
 * Standardized ΓΕΜΗ statuses
 * 🏢 ENTERPRISE: i18n keys for multilingual support
 */
export const MODAL_SELECT_GEMI_STATUSES = [
  { value: 'active', label: 'options.gemiStatuses.active' },
  { value: 'inactive', label: 'options.gemiStatuses.inactive' },
  { value: 'suspended', label: 'options.gemiStatuses.suspended' },
  { value: 'dissolution', label: 'options.gemiStatuses.dissolution' },
  { value: 'dissolved', label: 'options.gemiStatuses.dissolved' },
  { value: 'bankruptcy', label: 'options.gemiStatuses.bankruptcy' },
  { value: 'liquidation', label: 'options.gemiStatuses.liquidation' }
] as const;

/**
 * Standardized service categories
 * 🏢 ENTERPRISE: i18n keys for multilingual support
 */
export const MODAL_SELECT_SERVICE_CATEGORIES = [
  { value: 'ministry', label: 'options.serviceCategories.ministry' },
  { value: 'region', label: 'options.serviceCategories.region' },
  { value: 'municipality', label: 'options.serviceCategories.municipality' },
  { value: 'public_entity', label: 'options.serviceCategories.publicEntity' },
  { value: 'independent_authority', label: 'options.serviceCategories.independentAuthority' },
  { value: 'university', label: 'options.serviceCategories.university' },
  { value: 'hospital', label: 'options.serviceCategories.hospital' },
  { value: 'school', label: 'options.serviceCategories.school' },
  { value: 'other', label: 'options.serviceCategories.other' }
] as const;

/**
 * Standardized legal statuses για δημόσιες υπηρεσίες
 * 🏢 ENTERPRISE: i18n keys for multilingual support
 */
export const MODAL_SELECT_LEGAL_STATUSES = [
  { value: 'npdd', label: 'options.legalStatuses.npdd' },
  { value: 'npid', label: 'options.legalStatuses.npid' },
  { value: 'public_service', label: 'options.legalStatuses.publicService' },
  { value: 'independent_authority', label: 'options.legalStatuses.independentAuthority' },
  { value: 'decentralized_admin', label: 'options.legalStatuses.decentralizedAdmin' }
] as const;

/**
 * Standardized activity types
 * 🏢 ENTERPRISE: i18n keys for multilingual support
 */
export const MODAL_SELECT_ACTIVITY_TYPES = [
  { value: 'main', label: 'options.activityTypes.main' },
  { value: 'secondary', label: 'options.activityTypes.secondary' }
] as const;

/**
 * Standardized address types
 * 🏢 ENTERPRISE: i18n keys for multilingual support
 */
export const MODAL_SELECT_ADDRESS_TYPES = [
  { value: 'headquarters', label: 'options.addressTypes.headquarters' },
  { value: 'branch', label: 'options.addressTypes.branch' }
] as const;

/**
 * Standardized shareholder types
 * 🏢 ENTERPRISE: i18n keys for multilingual support
 */
export const MODAL_SELECT_SHAREHOLDER_TYPES = [
  { value: 'individual', label: 'options.shareholderTypes.individual' },
  { value: 'legal', label: 'options.shareholderTypes.legal' }
] as const;

// ====================================================================
// 🏢 COMPANY GEMI HELP TEXTS - ENTERPRISE CENTRALIZED
// ====================================================================

/**
 * ✅ ENTERPRISE: Centralized Help Text System για ΓΕΜΗ Fields
 * Single Source of Truth για όλα τα help texts των company fields
 * Αντικαθιστά διάσπαρτα help strings σε όλη την εφαρμογή
 */
export const MODAL_SELECT_COMPANY_HELP_TEXTS = {
  AFM: 'Το Α.Φ.Μ. (Αριθμός Φορολογικού Μητρώου) πρέπει να είναι 9 ψηφία',
  DOY: 'Η Δ.Ο.Υ. (Δημόσια Οικονομική Υπηρεσία) στην οποία ανήκει η εταιρεία',
  GEMI_NUMBER: 'Ο αριθμός Γ.Ε.ΜΗ. (Γενικό Εμπορικό Μητρώο) της εταιρείας',
  LEGAL_FORM: 'Η νομική μορφή της εταιρείας σύμφωνα με το Ελληνικό νομικό σύστημα',
  BUSINESS_NAME: 'Η επαγγελματική επωνυμία της εταιρείας',
  TRADE_NAME: 'Το εμπορικό όνομα της εταιρείας (εάν διαφέρει από την επωνυμία)',
  ACTIVITY_CODE: 'Ο κωδικός δραστηριότητας ΚΑΔ (Κλάδος Οικονομικής Δραστηριότητας)',
  CAPITAL: 'Το μετοχικό κεφάλαιο της εταιρείας σε ευρώ'
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