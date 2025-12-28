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
 */
export const MODAL_SELECT_LEGAL_FORMS = [
  { value: 'ae', label: 'Α.Ε. (Ανώνυμη Εταιρεία)' },
  { value: 'epe', label: 'Ε.Π.Ε. (Εταιρεία Περιορισμένης Ευθύνης)' },
  { value: 'ee', label: 'Ε.Ε. (Ετερόρρυθμη Εταιρεία)' },
  { value: 'oe', label: 'Ο.Ε. (Ομόρρυθμη Εταιρεία)' },
  { value: 'ike', label: 'Ι.Κ.Ε. (Ιδιωτική Κεφαλαιουχική Εταιρεία)' },
  { value: 'syndicate', label: 'Συνεταιρισμός' },
  { value: 'sole_proprietorship', label: 'Ατομική Επιχείρηση' },
  { value: 'civil_partnership', label: 'Αστική Εταιρεία' },
  { value: 'joint_venture', label: 'Κοινοπραξία' },
  { value: 'other', label: 'Άλλο' }
] as const;

/**
 * Standardized ΓΕΜΗ statuses
 */
export const MODAL_SELECT_GEMI_STATUSES = [
  { value: 'active', label: 'Ενεργή' },
  { value: 'inactive', label: 'Ανενεργή' },
  { value: 'suspended', label: 'Αναστολή Λειτουργίας' },
  { value: 'dissolution', label: 'Σε Διαδικασία Λύσης' },
  { value: 'dissolved', label: 'Λυθείσα' },
  { value: 'bankruptcy', label: 'Σε Πτώχευση' },
  { value: 'liquidation', label: 'Υπό Εκκαθάριση' }
] as const;

/**
 * Standardized service categories
 */
export const MODAL_SELECT_SERVICE_CATEGORIES = [
  { value: 'ministry', label: 'Υπουργείο' },
  { value: 'region', label: 'Περιφέρεια' },
  { value: 'municipality', label: 'Δήμος' },
  { value: 'public_entity', label: 'Δημόσιος Οργανισμός' },
  { value: 'independent_authority', label: 'Ανεξάρτητη Αρχή' },
  { value: 'university', label: 'Πανεπιστήμιο' },
  { value: 'hospital', label: 'Νοσοκομείο' },
  { value: 'school', label: 'Εκπαιδευτικό Ίδρυμα' },
  { value: 'other', label: 'Άλλο' }
] as const;

/**
 * Standardized legal statuses για δημόσιες υπηρεσίες
 */
export const MODAL_SELECT_LEGAL_STATUSES = [
  { value: 'npdd', label: 'Νομικό Πρόσωπο Δημοσίου Δικαίου (Ν.Π.Δ.Δ.)' },
  { value: 'npid', label: 'Νομικό Πρόσωπο Ιδιωτικού Δικαίου (Ν.Π.Ι.Δ.)' },
  { value: 'public_service', label: 'Δημόσια Υπηρεσία' },
  { value: 'independent_authority', label: 'Ανεξάρτητη Αρχή' },
  { value: 'decentralized_admin', label: 'Αποκεντρωμένη Διοίκηση' }
] as const;

/**
 * Standardized activity types
 */
export const MODAL_SELECT_ACTIVITY_TYPES = [
  { value: 'main', label: 'Κύρια' },
  { value: 'secondary', label: 'Δευτερεύουσα' }
] as const;

/**
 * Standardized address types
 */
export const MODAL_SELECT_ADDRESS_TYPES = [
  { value: 'headquarters', label: 'Έδρα' },
  { value: 'branch', label: 'Υποκατάστημα' }
] as const;

/**
 * Standardized shareholder types
 */
export const MODAL_SELECT_SHAREHOLDER_TYPES = [
  { value: 'individual', label: 'Φυσικό Πρόσωπο' },
  { value: 'legal', label: 'Νομικό Πρόσωπο' }
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