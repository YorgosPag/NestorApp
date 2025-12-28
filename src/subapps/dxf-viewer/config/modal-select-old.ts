/**
 * @fileoverview Enterprise Modal Select Styling System
 * @description Centralized select component styling for 100% consistency
 * @author Claude (Anthropic AI)
 * @date 2025-12-23
 * @version 2.0.0 - ENTERPRISE REFACTORING
 * @compliance CLAUDE.md Enterprise Standards - 100% CENTRALIZATION
 * ⚡ MAJOR UPDATE: Eliminated hardcoded duplicates - imports from central source
 */

// ====================================================================
// 🏢 ENTERPRISE IMPORTS - CENTRALIZED SOURCE OF TRUTH
// ====================================================================

// Import color systems for consistency
// Typography handled by individual components using useTypography hook
// Import centralized icon sizes - 🔥 NO MORE DUPLICATES!
import { componentSizes, semanticColors } from '../../../styles/design-tokens';
import { COLOR_BRIDGE } from '@/design-system/color-bridge';
// 🏢 ENTERPRISE: Import centralized panel tokens
import { PANEL_COLORS } from './panel-tokens';

// ====================================================================
// SELECT STYLING CONSTANTS - 🚨 MOVED TO MODULAR SYSTEM
// ====================================================================

// ✅ MIGRATED: Moved to core/styles/select-styles.ts (2025-12-28)
// Import from modular system instead:
// import { MODAL_SELECT_STYLES } from './modal-select/core/styles/select-styles';

/**
 * @deprecated MODAL_SELECT_STYLES has been moved to modular system
 * Location: ./modal-select/core/styles/select-styles.ts
 * Use: import { MODAL_SELECT_STYLES } from './modal-select';
 *
 * TEMPORARY RE-EXPORT for backward compatibility
 * This will be removed in Phase 2 of migration
 */
import { MODAL_SELECT_STYLES as MIGRATED_MODAL_SELECT_STYLES } from './modal-select/core/styles/select-styles';
export const MODAL_SELECT_STYLES = MIGRATED_MODAL_SELECT_STYLES;

// ====================================================================
// SELECT ITEM PATTERNS - 🚨 MOVED TO MODULAR SYSTEM
// ====================================================================

// ✅ MIGRATED: Moved to core/styles/select-styles.ts (2025-12-28)
// Import from modular system instead:
// import { MODAL_SELECT_ITEM_PATTERNS } from './modal-select/core/styles/select-styles';

/**
 * @deprecated MODAL_SELECT_ITEM_PATTERNS has been moved to modular system
 * Location: ./modal-select/core/styles/select-styles.ts
 * Use: import { MODAL_SELECT_ITEM_PATTERNS } from './modal-select';
 *
 * TEMPORARY RE-EXPORT for backward compatibility
 * This will be removed in Phase 2 of migration
 */
import { MODAL_SELECT_ITEM_PATTERNS as MIGRATED_MODAL_SELECT_ITEM_PATTERNS } from './modal-select/core/styles/select-styles';
export const MODAL_SELECT_ITEM_PATTERNS = MIGRATED_MODAL_SELECT_ITEM_PATTERNS;

// ====================================================================
// SELECT PLACEHOLDER PATTERNS
// ====================================================================

// ============================================================================
// 🏢 ENTERPRISE CENTRALIZED PLACEHOLDERS (imported from central system)
// ============================================================================
// DEPRECATED: Use centralized DROPDOWN_PLACEHOLDERS from property-statuses-enterprise.ts
// This provides full consistency across entire application
import { DROPDOWN_PLACEHOLDERS } from '@/constants/property-statuses-enterprise';

/**
 * @deprecated Use DROPDOWN_PLACEHOLDERS from @/constants/property-statuses-enterprise instead
 * Backward compatibility wrapper - WILL BE REMOVED
 */
export const MODAL_SELECT_PLACEHOLDERS = {
  COMPANY: DROPDOWN_PLACEHOLDERS.SELECT_COMPANY,
  PROJECT: DROPDOWN_PLACEHOLDERS.SELECT_PROJECT,
  BUILDING: DROPDOWN_PLACEHOLDERS.SELECT_BUILDING,
  UNIT: DROPDOWN_PLACEHOLDERS.SELECT_UNIT,
  ENCODING: DROPDOWN_PLACEHOLDERS.SELECT_ENCODING,
  GENERAL: DROPDOWN_PLACEHOLDERS.GENERIC_SELECT,
  LOADING: 'Φόρτωση...',  // Keep this as modal-specific
  NO_OPTIONS: 'Δεν υπάρχουν επιλογές',  // Keep this as modal-specific
} as const;

// ====================================================================
// ENCODING OPTIONS - 🚨 MOVED TO MODULAR SYSTEM
// ====================================================================

// ✅ MIGRATED: Moved to core/options/encoding.ts (2025-12-28)
// Import from modular system instead:
// import { MODAL_SELECT_ENCODING_OPTIONS } from './modal-select/core/options/encoding';

/**
 * @deprecated MODAL_SELECT_ENCODING_OPTIONS has been moved to modular system
 * Location: ./modal-select/core/options/encoding.ts
 * Use: import { MODAL_SELECT_ENCODING_OPTIONS } from './modal-select';
 *
 * TEMPORARY RE-EXPORT for backward compatibility
 * This will be removed in Phase 2 of migration
 */
import { MODAL_SELECT_ENCODING_OPTIONS as MIGRATED_ENCODING_OPTIONS } from './modal-select/core/options/encoding';
export const MODAL_SELECT_ENCODING_OPTIONS = MIGRATED_ENCODING_OPTIONS;

// ====================================================================
// BOOLEAN OPTIONS - 🚨 MOVED TO MODULAR SYSTEM
// ====================================================================

// ✅ MIGRATED: Moved to core/options/encoding.ts (2025-12-28)
// Import from modular system instead:
// import { MODAL_SELECT_BOOLEAN_OPTIONS } from './modal-select/core/options/encoding';

/**
 * @deprecated MODAL_SELECT_BOOLEAN_OPTIONS has been moved to modular system
 * Location: ./modal-select/core/options/encoding.ts
 * Use: import { MODAL_SELECT_BOOLEAN_OPTIONS } from './modal-select';
 *
 * TEMPORARY RE-EXPORT for backward compatibility
 * This will be removed in Phase 2 of migration
 */
import { MODAL_SELECT_BOOLEAN_OPTIONS as MIGRATED_BOOLEAN_OPTIONS } from './modal-select/core/options/encoding';
export const MODAL_SELECT_BOOLEAN_OPTIONS = MIGRATED_BOOLEAN_OPTIONS;

// ====================================================================
// COMPANY & LEGAL FORMS - 🚨 MOVED TO MODULAR SYSTEM
// ====================================================================

// ✅ MIGRATED: Moved to core/options/company.ts (2025-12-28)
// Import from modular system instead:
// import {
//   MODAL_SELECT_LEGAL_FORMS,
//   MODAL_SELECT_GEMI_STATUSES,
//   MODAL_SELECT_SERVICE_CATEGORIES,
//   MODAL_SELECT_LEGAL_STATUSES
// } from './modal-select/core/options/company';

/**
 * @deprecated MODAL_SELECT_LEGAL_FORMS has been moved to modular system
 * Location: ./modal-select/core/options/company.ts
 * Use: import { MODAL_SELECT_LEGAL_FORMS } from './modal-select';
 *
 * TEMPORARY RE-EXPORT for backward compatibility
 * This will be removed in Phase 2 of migration
 */
import { MODAL_SELECT_LEGAL_FORMS as MIGRATED_LEGAL_FORMS } from './modal-select/core/options/company';
export const MODAL_SELECT_LEGAL_FORMS = MIGRATED_LEGAL_FORMS;

/**
 * @deprecated MODAL_SELECT_GEMI_STATUSES has been moved to modular system
 * Location: ./modal-select/core/options/company.ts
 * Use: import { MODAL_SELECT_GEMI_STATUSES } from './modal-select';
 *
 * TEMPORARY RE-EXPORT for backward compatibility
 * This will be removed in Phase 2 of migration
 */
import { MODAL_SELECT_GEMI_STATUSES as MIGRATED_GEMI_STATUSES } from './modal-select/core/options/company';
export const MODAL_SELECT_GEMI_STATUSES = MIGRATED_GEMI_STATUSES;

/**
 * @deprecated MODAL_SELECT_SERVICE_CATEGORIES has been moved to modular system
 * Location: ./modal-select/core/options/company.ts
 * Use: import { MODAL_SELECT_SERVICE_CATEGORIES } from './modal-select';
 *
 * TEMPORARY RE-EXPORT for backward compatibility
 * This will be removed in Phase 2 of migration
 */
import { MODAL_SELECT_SERVICE_CATEGORIES as MIGRATED_SERVICE_CATEGORIES } from './modal-select/core/options/company';
export const MODAL_SELECT_SERVICE_CATEGORIES = MIGRATED_SERVICE_CATEGORIES;

/**
 * @deprecated MODAL_SELECT_LEGAL_STATUSES has been moved to modular system
 * Location: ./modal-select/core/options/company.ts
 * Use: import { MODAL_SELECT_LEGAL_STATUSES } from './modal-select';
 *
 * TEMPORARY RE-EXPORT for backward compatibility
 * This will be removed in Phase 2 of migration
 */
import { MODAL_SELECT_LEGAL_STATUSES as MIGRATED_LEGAL_STATUSES } from './modal-select/core/options/company';
export const MODAL_SELECT_LEGAL_STATUSES = MIGRATED_LEGAL_STATUSES;

// ====================================================================
// INDIVIDUAL & PERSONAL DATA - 🚨 MOVED TO MODULAR SYSTEM
// ====================================================================

// ✅ MIGRATED: Moved to core/options/individual.ts (2025-12-28)
// Import from modular system instead:
// import {
//   MODAL_SELECT_GENDER_OPTIONS,
//   MODAL_SELECT_IDENTITY_TYPES,
//   MODAL_SELECT_COUNTRY_OPTIONS,
//   MODAL_SELECT_CURRENCY_OPTIONS
// } from './modal-select/core/options/individual';

/**
 * @deprecated MODAL_SELECT_GENDER_OPTIONS has been moved to modular system
 * Location: ./modal-select/core/options/individual.ts
 * Use: import { MODAL_SELECT_GENDER_OPTIONS } from './modal-select';
 *
 * TEMPORARY RE-EXPORT for backward compatibility
 * This will be removed in Phase 2 of migration
 */
import { MODAL_SELECT_GENDER_OPTIONS as MIGRATED_GENDER_OPTIONS } from './modal-select/core/options/individual';
export const MODAL_SELECT_GENDER_OPTIONS = MIGRATED_GENDER_OPTIONS;

/**
 * @deprecated MODAL_SELECT_IDENTITY_TYPES has been moved to modular system
 * Location: ./modal-select/core/options/individual.ts
 * Use: import { MODAL_SELECT_IDENTITY_TYPES } from './modal-select';
 *
 * TEMPORARY RE-EXPORT for backward compatibility
 * This will be removed in Phase 2 of migration
 */
import { MODAL_SELECT_IDENTITY_TYPES as MIGRATED_IDENTITY_TYPES } from './modal-select/core/options/individual';
export const MODAL_SELECT_IDENTITY_TYPES = MIGRATED_IDENTITY_TYPES;

/**
 * @deprecated MODAL_SELECT_COUNTRY_OPTIONS has been moved to modular system
 * Location: ./modal-select/core/options/individual.ts
 * Use: import { MODAL_SELECT_COUNTRY_OPTIONS } from './modal-select';
 *
 * TEMPORARY RE-EXPORT for backward compatibility
 * This will be removed in Phase 2 of migration
 */
import { MODAL_SELECT_COUNTRY_OPTIONS as MIGRATED_COUNTRY_OPTIONS } from './modal-select/core/options/individual';
export const MODAL_SELECT_COUNTRY_OPTIONS = MIGRATED_COUNTRY_OPTIONS;

/**
 * @deprecated MODAL_SELECT_CURRENCY_OPTIONS has been moved to modular system
 * Location: ./modal-select/core/options/individual.ts
 * Use: import { MODAL_SELECT_CURRENCY_OPTIONS } from './modal-select';
 *
 * TEMPORARY RE-EXPORT for backward compatibility
 * This will be removed in Phase 2 of migration
 */
import { MODAL_SELECT_CURRENCY_OPTIONS as MIGRATED_CURRENCY_OPTIONS } from './modal-select/core/options/individual';
export const MODAL_SELECT_CURRENCY_OPTIONS = MIGRATED_CURRENCY_OPTIONS;

/**
 * @deprecated MODAL_SELECT_ACTIVITY_TYPES has been moved to modular system
 * Location: ./modal-select/core/options/company.ts
 * Use: import { MODAL_SELECT_ACTIVITY_TYPES } from './modal-select';
 *
 * TEMPORARY RE-EXPORT for backward compatibility
 * This will be removed in Phase 2 of migration
 */
import { MODAL_SELECT_ACTIVITY_TYPES as MIGRATED_ACTIVITY_TYPES } from './modal-select/core/options/company';
export const MODAL_SELECT_ACTIVITY_TYPES = MIGRATED_ACTIVITY_TYPES;

/**
 * @deprecated MODAL_SELECT_ADDRESS_TYPES has been moved to modular system
 * Location: ./modal-select/core/options/company.ts
 * Use: import { MODAL_SELECT_ADDRESS_TYPES } from './modal-select';
 *
 * TEMPORARY RE-EXPORT for backward compatibility
 * This will be removed in Phase 2 of migration
 */
import { MODAL_SELECT_ADDRESS_TYPES as MIGRATED_ADDRESS_TYPES } from './modal-select/core/options/company';
export const MODAL_SELECT_ADDRESS_TYPES = MIGRATED_ADDRESS_TYPES;

/**
 * @deprecated MODAL_SELECT_SHAREHOLDER_TYPES has been moved to modular system
 * Location: ./modal-select/core/options/company.ts
 * Use: import { MODAL_SELECT_SHAREHOLDER_TYPES } from './modal-select';
 *
 * TEMPORARY RE-EXPORT for backward compatibility
 * This will be removed in Phase 2 of migration
 */
import { MODAL_SELECT_SHAREHOLDER_TYPES as MIGRATED_SHAREHOLDER_TYPES } from './modal-select/core/options/company';
export const MODAL_SELECT_SHAREHOLDER_TYPES = MIGRATED_SHAREHOLDER_TYPES;

/**
 * Standardized document types
 */
// export const MODAL_SELECT_DOCUMENT_TYPES = [ // ➜ MOVED TO ./utils/accessors.ts
//   { value: 'certificate', label: 'Πιστοποιητικό' },
//   { value: 'announcement', label: 'Ανακοίνωση' },
//   { value: 'registration', label: 'Έγγραφο Σύστασης' },
//   { value: 'amendment', label: 'Τροποποίηση Καταστατικού' }
// ] as const;

/**
 * Standardized board types για company decisions
 */
// export const MODAL_SELECT_BOARD_TYPES = [ // ➜ MOVED TO ./utils/accessors.ts
//   { value: 'general_assembly', label: 'Γενική Συνέλευση' },
//   { value: 'board_directors', label: 'Διοικητικό Συμβούλιο' },
//   { value: 'supervisory_board', label: 'Εποπτικό Συμβούλιο' }
// ] as const;

/**
 * Standardized representative positions
 */
// export const MODAL_SELECT_REPRESENTATIVE_POSITIONS = [ // ➜ MOVED TO ./utils/accessors.ts
//   { value: 'ceo', label: 'Διευθύνων Σύμβουλος' },
//   { value: 'president', label: 'Πρόεδρος Δ.Σ.' },
//   { value: 'manager', label: 'Διαχειριστής' },
//   { value: 'legal_rep', label: 'Νόμιμος Εκπρόσωπος' },
//   { value: 'secretary', label: 'Γραμματέας' }
// ] as const;

// ====================================================================
// STATUS LABEL CONSTANTS - 🏢 ENTERPRISE CENTRALIZED
// ====================================================================

/**
 * @deprecated MODAL_SELECT_PROJECT_STATUS_LABELS has been moved to modular system
 * Location: ./modal-select/core/labels/status.ts
 * Use: import { MODAL_SELECT_PROJECT_STATUS_LABELS } from './modal-select';
 *
 * TEMPORARY RE-EXPORT for backward compatibility
 * This will be removed in Phase 2 of migration
 */
import { MODAL_SELECT_PROJECT_STATUS_LABELS as MIGRATED_PROJECT_STATUS_LABELS } from './modal-select/core/labels/status';
export const MODAL_SELECT_PROJECT_STATUS_LABELS = MIGRATED_PROJECT_STATUS_LABELS;

/**
 * @deprecated MODAL_SELECT_UNIT_STATUS_LABELS has been moved to modular system
 * Location: ./modal-select/core/labels/status.ts
 * Use: import { MODAL_SELECT_UNIT_STATUS_LABELS } from './modal-select';
 *
 * TEMPORARY RE-EXPORT for backward compatibility
 * This will be removed in Phase 2 of migration
 */
import { MODAL_SELECT_UNIT_STATUS_LABELS as MIGRATED_UNIT_STATUS_LABELS } from './modal-select/core/labels/status';
export const MODAL_SELECT_UNIT_STATUS_LABELS = MIGRATED_UNIT_STATUS_LABELS;

/**
 * @deprecated MODAL_SELECT_CONTACT_STATUS_LABELS has been moved to modular system
 * Location: ./modal-select/core/labels/status.ts
 * Use: import { MODAL_SELECT_CONTACT_STATUS_LABELS } from './modal-select';
 */
import { MODAL_SELECT_CONTACT_STATUS_LABELS as MIGRATED_CONTACT_STATUS_LABELS } from './modal-select/core/labels/status';
export const MODAL_SELECT_CONTACT_STATUS_LABELS = MIGRATED_CONTACT_STATUS_LABELS;

/**
 * @deprecated MODAL_SELECT_CONTACT_TYPE_LABELS has been moved to modular system
 * Location: ./modal-select/core/labels/status.ts
 * Use: import { MODAL_SELECT_CONTACT_TYPE_LABELS } from './modal-select';
 */
import { MODAL_SELECT_CONTACT_TYPE_LABELS as MIGRATED_CONTACT_TYPE_LABELS } from './modal-select/core/labels/status';
export const MODAL_SELECT_CONTACT_TYPE_LABELS = MIGRATED_CONTACT_TYPE_LABELS;

/**
 * @deprecated MODAL_SELECT_PROPERTY_MARKET_STATUS_LABELS has been moved to modular system
 * Location: ./modal-select/core/labels/status.ts
 * Use: import { MODAL_SELECT_PROPERTY_MARKET_STATUS_LABELS } from './modal-select';
 */
import { MODAL_SELECT_PROPERTY_MARKET_STATUS_LABELS as MIGRATED_PROPERTY_MARKET_STATUS_LABELS } from './modal-select/core/labels/status';
export const MODAL_SELECT_PROPERTY_MARKET_STATUS_LABELS = MIGRATED_PROPERTY_MARKET_STATUS_LABELS;

/**
 * @deprecated MODAL_SELECT_RENTAL_TYPE_LABELS has been moved to modular system
 * Location: ./modal-select/core/labels/status.ts
 * Use: import { MODAL_SELECT_RENTAL_TYPE_LABELS } from './modal-select';
 */
import { MODAL_SELECT_RENTAL_TYPE_LABELS as MIGRATED_RENTAL_TYPE_LABELS } from './modal-select/core/labels/status';
export const MODAL_SELECT_RENTAL_TYPE_LABELS = MIGRATED_RENTAL_TYPE_LABELS;

/**
 * Centralized property special status labels
 */
export const MODAL_SELECT_PROPERTY_SPECIAL_STATUS_LABELS = {
  reserved_pending: 'Δεσμευμένο Εκκρεμές',
  contract_signed: 'Συμβόλαιο Υπογεγραμμένο',
  deposit_paid: 'Προκαταβολή Δεδομένη',
  corporate: 'Εταιρικό',
  not_for_sale: 'Δεν Πωλείται',
  family: 'Οικογενειακό',
  pre_launch: 'Προ-εκκίνηση',
  exclusive: 'Αποκλειστική Διάθεση',
  reduced_price: 'Μειωμένη Τιμή',
  urgent_sale: 'Επείγουσα Πώληση',
  under_renovation: 'Υπό Ανακαίνιση',
  legal_issues: 'Νομικά Προβλήματα',
  inspection_required: 'Απαιτείται Επιθεώρηση',
  pending_documents: 'Εκκρεμή Έγγραφα',
  for_sale: 'Προς Πώληση',
  for_rent: 'Προς Ενοικίαση',
  rented: 'Ενοικιασμένο',
  under_negotiation: 'Υπό Διαπραγμάτευση',
  available_soon: 'Σύντομα Διαθέσιμο',
  landowner: 'Ιδιοκτήτης Γης',
  off_market: 'Εκτός Αγοράς',
  unavailable: 'Μη Διαθέσιμο',
  // 🏢 ENTERPRISE: Added missing labels για property-hover/constants.ts complete coverage
  sold: 'Πουλημένο',
  reserved: 'Δεσμευμένο',
  unknown: 'Άγνωστο'
} as const;

/**
 * Centralized storage unit status labels
 */
export const MODAL_SELECT_STORAGE_STATUS_LABELS = {
  available: 'Διαθέσιμη',
  occupied: 'Κατειλημμένη',
  sold: 'Πωλήθηκε',
  maintenance: 'Συντήρηση',
  reserved: 'Κρατημένη'
} as const;

/**
 * Centralized priority/alert level labels
 */
export const MODAL_SELECT_PRIORITY_LABELS = {
  none: 'Χωρίς έργα',
  empty: 'Κενό',
  warning: 'Προειδοποίηση',
  attention: 'Προσοχή',
  success: 'Επιτυχία',
  info: 'Πληροφορία'
} as const;

/**
 * Centralized record state labels
 */
export const MODAL_SELECT_RECORD_STATE_LABELS = {
  new: 'Νέο',
  updated: 'Ενημερωμένο',
  deleted: 'Διαγραμμένο'
} as const;

/**
 * Centralized entity type labels
 */
export const MODAL_SELECT_ENTITY_TYPE_LABELS = {
  company: 'Εταιρεία',
  main: 'Κύριο',
  secondary: 'Δευτερεύον'
} as const;

/**
 * Centralized document status labels
 */
export const MODAL_SELECT_DOCUMENT_STATUS_LABELS = {
  draft: 'Προσχέδιο',
  completed: 'Ολοκληρωμένο',
  approved: 'Εγκεκριμένο'
} as const;

/**
 * Centralized property type labels
 */
export const MODAL_SELECT_PROPERTY_TYPE_LABELS = {
  studio: 'Στούντιο',
  garsoniera: 'Γκαρσονιέρα',
  apartment: 'Διαμέρισμα',
  maisonette: 'Μεζονέτα',
  warehouse: 'Αποθήκη',
  parking: 'Parking'
} as const;

/**
 * Property type options with categories
 */
// export const MODAL_SELECT_PROPERTY_TYPE_OPTIONS = [ // ➜ MOVED TO ./utils/accessors.ts
//   { value: 'studio', label: 'Στούντιο', category: 'residential' },
//   { value: 'garsoniera', label: 'Γκαρσονιέρα', category: 'residential' },
//   { value: 'apartment', label: 'Διαμέρισμα', category: 'residential' },
//   { value: 'maisonette', label: 'Μεζονέτα', category: 'residential' },
//   { value: 'warehouse', label: 'Αποθήκη', category: 'commercial' },
//   { value: 'parking', label: 'Parking', category: 'commercial' }
// ] as const;

/**
 * Centralized unit filter options for toolbar
 */
// export const MODAL_SELECT_UNIT_FILTER_OPTIONS = [ // ➜ MOVED TO ./utils/accessors.ts
//   { value: 'for-sale', label: 'Προς Πώληση' },
//   { value: 'sold', label: 'Πουλημένα' },
//   { value: 'reserved', label: 'Κρατημένα' }
// ] as const;

// ====================================================================
// UTILITY FUNCTIONS
// ====================================================================

/**
 * Get select styling by theme/context
 */
export function getSelectStyles(theme: keyof typeof MODAL_SELECT_STYLES = 'DXF_TECHNICAL') {
  return MODAL_SELECT_STYLES[theme];
}

/**
 * Get select item pattern classes
 */
export function getSelectItemPattern(pattern: keyof typeof MODAL_SELECT_ITEM_PATTERNS) {
  return MODAL_SELECT_ITEM_PATTERNS[pattern];
}

/**
 * Get placeholder text by context
 */
export function getSelectPlaceholder(context: keyof typeof MODAL_SELECT_PLACEHOLDERS) {
  return MODAL_SELECT_PLACEHOLDERS[context];
}

/**
 * @deprecated getEncodingOptions has been moved to modular system
 * Location: ./modal-select/core/options/encoding.ts
 * Use: import { getEncodingOptions } from './modal-select';
 *
 * TEMPORARY RE-EXPORT for backward compatibility
 */
import { getEncodingOptions as migratedGetEncodingOptions } from './modal-select/core/options/encoding';
export const getEncodingOptions = migratedGetEncodingOptions;

/**
 * @deprecated getBooleanOptions has been moved to modular system
 * Location: ./modal-select/core/options/encoding.ts
 * Use: import { getBooleanOptions } from './modal-select';
 *
 * TEMPORARY RE-EXPORT for backward compatibility
 */
import { getBooleanOptions as migratedGetBooleanOptions } from './modal-select/core/options/encoding';
export const getBooleanOptions = migratedGetBooleanOptions;

/**
 * @deprecated getLegalFormOptions has been moved to modular system
 * Location: ./modal-select/core/options/company.ts
 * Use: import { getLegalFormOptions } from './modal-select';
 *
 * TEMPORARY RE-EXPORT for backward compatibility
 */
import { getLegalFormOptions as MIGRATED_getLegalFormOptions } from './modal-select/core/options/company';
export const getLegalFormOptions = MIGRATED_getLegalFormOptions;

/**
 * @deprecated getGemiStatusOptions has been moved to modular system
 * Location: ./modal-select/core/options/company.ts
 * Use: import { getGemiStatusOptions } from './modal-select';
 *
 * TEMPORARY RE-EXPORT for backward compatibility
 */
import { getGemiStatusOptions as MIGRATED_getGemiStatusOptions } from './modal-select/core/options/company';
export const getGemiStatusOptions = MIGRATED_getGemiStatusOptions;

/**
 * @deprecated getServiceCategoryOptions has been moved to modular system
 * Location: ./modal-select/core/options/company.ts
 * Use: import { getServiceCategoryOptions } from './modal-select';
 *
 * TEMPORARY RE-EXPORT for backward compatibility
 */
import { getServiceCategoryOptions as MIGRATED_getServiceCategoryOptions } from './modal-select/core/options/company';
export const getServiceCategoryOptions = MIGRATED_getServiceCategoryOptions;

/**
 * @deprecated getLegalStatusOptions has been moved to modular system
 * Location: ./modal-select/core/options/company.ts
 * Use: import { getLegalStatusOptions } from './modal-select';
 *
 * TEMPORARY RE-EXPORT for backward compatibility
 */
import { getLegalStatusOptions as MIGRATED_getLegalStatusOptions } from './modal-select/core/options/company';
export const getLegalStatusOptions = MIGRATED_getLegalStatusOptions;

/**
 * @deprecated getGenderOptions has been moved to modular system
 * Location: ./modal-select/core/options/individual.ts
 * Use: import { getGenderOptions } from './modal-select';
 *
 * TEMPORARY RE-EXPORT for backward compatibility
 */
import { getGenderOptions as MIGRATED_getGenderOptions } from './modal-select/core/options/individual';
export const getGenderOptions = MIGRATED_getGenderOptions;

/**
 * @deprecated getIdentityTypeOptions has been moved to modular system
 * Location: ./modal-select/core/options/individual.ts
 * Use: import { getIdentityTypeOptions } from './modal-select';
 *
 * TEMPORARY RE-EXPORT for backward compatibility
 */
import { getIdentityTypeOptions as MIGRATED_getIdentityTypeOptions } from './modal-select/core/options/individual';
export const getIdentityTypeOptions = MIGRATED_getIdentityTypeOptions;

/**
 * @deprecated getCountryOptions has been moved to modular system
 * Location: ./modal-select/core/options/individual.ts
 * Use: import { getCountryOptions } from './modal-select';
 *
 * TEMPORARY RE-EXPORT for backward compatibility
 */
import { getCountryOptions as MIGRATED_getCountryOptions } from './modal-select/core/options/individual';
export const getCountryOptions = MIGRATED_getCountryOptions;

/**
 * @deprecated getCurrencyOptions has been moved to modular system
 * Location: ./modal-select/core/options/individual.ts
 * Use: import { getCurrencyOptions } from './modal-select';
 *
 * TEMPORARY RE-EXPORT for backward compatibility
 */
import { getCurrencyOptions as MIGRATED_getCurrencyOptions } from './modal-select/core/options/individual';
export const getCurrencyOptions = MIGRATED_getCurrencyOptions;

/**
 * @deprecated getActivityTypeOptions has been moved to modular system
 * Location: ./modal-select/core/options/company.ts
 * Use: import { getActivityTypeOptions } from './modal-select';
 *
 * TEMPORARY RE-EXPORT for backward compatibility
 */
import { getActivityTypeOptions as MIGRATED_getActivityTypeOptions } from './modal-select/core/options/company';
export const getActivityTypeOptions = MIGRATED_getActivityTypeOptions;

/**
 * @deprecated getAddressTypeOptions has been moved to modular system
 * Location: ./modal-select/core/options/company.ts
 * Use: import { getAddressTypeOptions } from './modal-select';
 *
 * TEMPORARY RE-EXPORT for backward compatibility
 */
import { getAddressTypeOptions as MIGRATED_getAddressTypeOptions } from './modal-select/core/options/company';
export const getAddressTypeOptions = MIGRATED_getAddressTypeOptions;

/**
 * @deprecated getShareholderTypeOptions has been moved to modular system
 * Location: ./modal-select/core/options/company.ts
 * Use: import { getShareholderTypeOptions } from './modal-select';
 *
 * TEMPORARY RE-EXPORT for backward compatibility
 */
import { getShareholderTypeOptions as MIGRATED_getShareholderTypeOptions } from './modal-select/core/options/company';
export const getShareholderTypeOptions = MIGRATED_getShareholderTypeOptions;

/**
 * Get document type options
 */
// export function getDocumentTypeOptions() { // ➜ MOVED TO ./utils/accessors.ts
//   return MODAL_SELECT_DOCUMENT_TYPES;
// }

/**
 * Get board type options
 */
// export function getBoardTypeOptions() { // ➜ MOVED TO ./utils/accessors.ts
//   return MODAL_SELECT_BOARD_TYPES;
// }

/**
 * Get representative position options
 */
// export function getRepresentativePositionOptions() { // ➜ MOVED TO ./utils/accessors.ts
//   return MODAL_SELECT_REPRESENTATIVE_POSITIONS;
// }

/**
 * Get centralized project status labels
 */
export function getProjectStatusLabels() {
  return MODAL_SELECT_PROJECT_STATUS_LABELS;
}

/**
 * Get centralized unit status labels
 */
export function getUnitStatusLabels() {
  return MODAL_SELECT_UNIT_STATUS_LABELS;
}

/**
 * Get centralized contact status labels
 */
export function getContactStatusLabels() {
  return MODAL_SELECT_CONTACT_STATUS_LABELS;
}

/**
 * Get centralized contact type labels
 */
export function getContactTypeLabels() {
  return MODAL_SELECT_CONTACT_TYPE_LABELS;
}

/**
 * Get centralized property market status labels
 */
export function getPropertyMarketStatusLabels() {
  return MODAL_SELECT_PROPERTY_MARKET_STATUS_LABELS;
}

/**
 * Get centralized rental type labels
 */
export function getRentalTypeLabels() {
  return MODAL_SELECT_RENTAL_TYPE_LABELS;
}

/**
 * Get centralized property special status labels
 */
export function getPropertySpecialStatusLabels() {
  return MODAL_SELECT_PROPERTY_SPECIAL_STATUS_LABELS;
}


/**
 * Get centralized storage status labels
 */
export function getStorageStatusLabels() {
  return MODAL_SELECT_STORAGE_STATUS_LABELS;
}

/**
 * Get centralized priority labels
 */
export function getPriorityLabels() {
  return MODAL_SELECT_PRIORITY_LABELS;
}

/**
 * Get centralized record state labels
 */
export function getRecordStateLabels() {
  return MODAL_SELECT_RECORD_STATE_LABELS;
}

/**
 * Get centralized entity type labels
 */
export function getEntityTypeLabels() {
  return MODAL_SELECT_ENTITY_TYPE_LABELS;
}

/**
 * Get centralized document status labels
 */
export function getDocumentStatusLabels() {
  return MODAL_SELECT_DOCUMENT_STATUS_LABELS;
}

/**
 * Get centralized property type labels
 */
export function getPropertyTypeLabels() {
  return MODAL_SELECT_PROPERTY_TYPE_LABELS;
}

/**
 * Get property type options with categories
 */
// export function getPropertyTypeOptions() { // ➜ MOVED TO ./utils/accessors.ts
//   return MODAL_SELECT_PROPERTY_TYPE_OPTIONS;
// }

/**
 * Get unit filter options for toolbar
 */
// export function getUnitFilterOptions() { // ➜ MOVED TO ./utils/accessors.ts
//   return MODAL_SELECT_UNIT_FILTER_OPTIONS;
// }

/**
 * Build complete select trigger classes
 */
export function buildSelectTriggerClass(config: {
  theme?: keyof typeof MODAL_SELECT_STYLES;
  disabled?: boolean;
  error?: boolean;
  additional?: string;
}): string {
  const { theme = 'DXF_TECHNICAL', disabled = false, error = false, additional = '' } = config;

  let baseClass = MODAL_SELECT_STYLES[theme].trigger;

  if (error && theme === 'DXF_TECHNICAL') {
    baseClass = MODAL_SELECT_STYLES.ERROR.trigger;
  }

  if (disabled) {
    baseClass += ' opacity-50 cursor-not-allowed';
  }

  return `${baseClass} ${additional}`.trim();
}

/**
 * Build complete select item classes
 */
export function buildSelectItemClass(config: {
  pattern: keyof typeof MODAL_SELECT_ITEM_PATTERNS;
  theme?: keyof typeof MODAL_SELECT_STYLES;
  additional?: string;
}): string {
  const { pattern, theme = 'DXF_TECHNICAL', additional = '' } = config;

  const patternClasses = MODAL_SELECT_ITEM_PATTERNS[pattern];
  const themeClasses = MODAL_SELECT_STYLES[theme];

  return `${patternClasses.container} ${themeClasses.item} ${additional}`.trim();
}

// ====================================================================
// TYPE EXPORTS
// ====================================================================

export type ModalSelectTheme = keyof typeof MODAL_SELECT_STYLES;
export type ModalSelectItemPattern = keyof typeof MODAL_SELECT_ITEM_PATTERNS;
export type ModalSelectPlaceholder = keyof typeof MODAL_SELECT_PLACEHOLDERS;

// ====================================================================
// ENTERPRISE STANDARDS COMPLIANCE - 100% CENTRALIZATION
// ====================================================================

/**
 * This select system achieves 100% centralization by:
 * ✅ Eliminating ALL hardcoded select styles
 * ✅ Standardizing ALL select patterns
 * ✅ Consistent placeholder text
 * ✅ Theme-aware styling
 * ✅ Complete type safety
 * ✅ Utility functions for composition
 * ✅ Enterprise-grade documentation
 */

// ====================================================================
// 🏢 COMPANY FIELD LABELS - CENTRALIZED
// ====================================================================

/**
 * ❌ DEPRECATED: Company Basic Information Field Labels
 * ✅ MIGRATED TO: ./core/labels/fields.ts - MODAL_SELECT_COMPANY_FIELD_LABELS
 * 📍 USE: import { MODAL_SELECT_COMPANY_FIELD_LABELS } from './modal-select'
 */
// export const MODAL_SELECT_COMPANY_FIELD_LABELS = { ... } // ➜ MOVED TO ./core/labels/fields.ts

/**
 * ❌ DEPRECATED: Get company field labels
 * ✅ MIGRATED TO: ./core/labels/fields.ts - getCompanyFieldLabels()
 * 📍 USE: import { getCompanyFieldLabels } from './modal-select'
 */
// export function getCompanyFieldLabels() { ... } // ➜ MOVED TO ./core/labels/fields.ts

// ====================================================================
// 🏢 TAB LABELS CONSTANTS - ENTERPRISE CENTRALIZED
// ====================================================================

/**
 * Units Tab Labels - Centralized από units-tabs-config.ts
 * ✅ ENTERPRISE: Single source of truth για όλες τις units tabs
 */
// export const MODAL_SELECT_UNITS_TAB_LABELS = { // ➜ MOVED TO ./core/labels/tabs.ts
//   info: 'Βασικές Πληροφορίες',
//   customer: 'Πελάτης',
//   floor_plan: 'Κάτοψη',
//   documents: 'Έγγραφα',
//   photos: 'Φωτογραφίες',
//   videos: 'Videos'
// } as const;

/**
 * Storage Tab Labels - Centralized από storage-tabs-config.ts
 * ✅ ENTERPRISE: Single source of truth για όλες τις storage tabs
 */
// export const MODAL_SELECT_STORAGE_TAB_LABELS = { // ➜ MOVED TO ./core/labels/tabs.ts
//   general: 'Γενικά',
//   statistics: 'Στατιστικά',
//   floorplans: 'Κατόψεις',
//   documents: 'Έγγραφα',
//   photos: 'Φωτογραφίες',
//   activity: 'Ιστορικό'
// } as const;

/**
 * ❌ DEPRECATED: Service Form Field Labels
 * ✅ MIGRATED TO: ./core/labels/fields.ts - MODAL_SELECT_SERVICE_FIELD_LABELS
 * 📍 USE: import { MODAL_SELECT_SERVICE_FIELD_LABELS } from './modal-select'
 */
// export const MODAL_SELECT_SERVICE_FIELD_LABELS = { ➜ MOVED TO ./core/labels/fields.ts
  // service_name: 'Επωνυμία Υπηρεσίας', ➜ MOVED TO ./core/labels/fields.ts
  // short_name: 'Συντομογραφία', ➜ MOVED TO ./core/labels/fields.ts
  // category: 'Κατηγορία Φορέα', ➜ MOVED TO ./core/labels/fields.ts
  // supervision_ministry: 'Εποπτεύον Υπουργείο', ➜ MOVED TO ./core/labels/fields.ts
  // legal_status: 'Νομικό Καθεστώς', ➜ MOVED TO ./core/labels/fields.ts
  // establishment_law: 'Νόμος Ίδρυσης', ➜ MOVED TO ./core/labels/fields.ts
  // head_title: 'Τίτλος Προϊσταμένου', ➜ MOVED TO ./core/labels/fields.ts
  // head_name: 'Όνομα Προϊσταμένου', ➜ MOVED TO ./core/labels/fields.ts
  // street: 'Οδός', ➜ MOVED TO ./core/labels/fields.ts
  // street_number: 'Αριθμός', ➜ MOVED TO ./core/labels/fields.ts
  // city: 'Πόλη', ➜ MOVED TO ./core/labels/fields.ts
  // postal_code: 'Τ.Κ.', ➜ MOVED TO ./core/labels/fields.ts
  // phone: 'Τηλέφωνο Κεντρικής', ➜ MOVED TO ./core/labels/fields.ts
  // email: 'E-mail Επικοινωνίας', ➜ MOVED TO ./core/labels/fields.ts
  // website: 'Ιστοσελίδα', ➜ MOVED TO ./core/labels/fields.ts
  // main_responsibilities: 'Κύριες Αρμοδιότητες', ➜ MOVED TO ./core/labels/fields.ts
  // citizen_services: 'Υπηρεσίες προς Πολίτες', ➜ MOVED TO ./core/labels/fields.ts
  // online_services: 'Ηλεκτρονικές Υπηρεσίες', ➜ MOVED TO ./core/labels/fields.ts
  // service_hours: 'Ώρες Εξυπηρέτησης', ➜ MOVED TO ./core/labels/fields.ts
  // basic_info_section: 'Βασικά Στοιχεία', ➜ MOVED TO ./core/labels/fields.ts
  // administrative_section: 'Διοικητικά Στοιχεία', ➜ MOVED TO ./core/labels/fields.ts
  // contact_section: 'Στοιχεία Επικοινωνίας', ➜ MOVED TO ./core/labels/fields.ts
  // services_section: 'Αρμοδιότητες & Υπηρεσίες', ➜ MOVED TO ./core/labels/fields.ts
  // logo_section: 'Λογότυπο', ➜ MOVED TO ./core/labels/fields.ts
  // relationships_section: 'Υπάλληλοι & Οργάνωση' ➜ MOVED TO ./core/labels/fields.ts
// } as const; ➜ MOVED TO ./core/labels/fields.ts

// ====================================================================
// 🏢 ADVANCED FILTERS LABELS - ENTERPRISE CENTRALIZED
// ====================================================================

/**
 * ❌ DEPRECATED: Filter Panel Titles
 * ✅ MIGRATED TO: ./core/labels/fields.ts - MODAL_SELECT_FILTER_PANEL_TITLES
 * 📍 USE: import { MODAL_SELECT_FILTER_PANEL_TITLES } from './modal-select'
 */
// export const MODAL_SELECT_FILTER_PANEL_TITLES = { ➜ MOVED TO ./core/labels/fields.ts
  // units: 'Φίλτρα Αναζήτησης', ➜ MOVED TO ./core/labels/fields.ts
  // contacts: 'Φίλτρα Επαφών', ➜ MOVED TO ./core/labels/fields.ts
  // buildings: 'Φίλτρα Κτιρίων', ➜ MOVED TO ./core/labels/fields.ts
  // projects: 'Φίλτρα Έργων', ➜ MOVED TO ./core/labels/fields.ts
  // advanced: 'Προηγμένα Φίλτρα' ➜ MOVED TO ./core/labels/fields.ts
// } as const; ➜ MOVED TO ./core/labels/fields.ts

/**
 * ❌ DEPRECATED: Search Placeholders
 * ✅ MIGRATED TO: ./core/labels/fields.ts - MODAL_SELECT_SEARCH_PLACEHOLDERS
 * 📍 USE: import { MODAL_SELECT_SEARCH_PLACEHOLDERS } from './modal-select'
 */
// export const MODAL_SELECT_SEARCH_PLACEHOLDERS = { ➜ MOVED TO ./core/labels/fields.ts
  // units_search: 'Όνομα, περιγραφή...', ➜ MOVED TO ./core/labels/fields.ts
  // contacts_search: 'Όνομα, εταιρεία, email...', ➜ MOVED TO ./core/labels/fields.ts
  // buildings_search: 'Όνομα, περιγραφή, διεύθυνση...', ➜ MOVED TO ./core/labels/fields.ts
  // projects_search: 'Όνομα, περιγραφή, εταιρεία, τοποθεσία...', ➜ MOVED TO ./core/labels/fields.ts
  // status_placeholder: 'Επιλογή κατάστασης...', ➜ MOVED TO ./core/labels/fields.ts
  // project_placeholder: 'Επιλογή Έργου', ➜ MOVED TO ./core/labels/fields.ts
  // building_placeholder: 'Επιλογή Κτιρίου', ➜ MOVED TO ./core/labels/fields.ts
  // floor_placeholder: 'Επιλογή Ορόφου', ➜ MOVED TO ./core/labels/fields.ts
  // type_placeholder: 'Επιλογή Τύπου', ➜ MOVED TO ./core/labels/fields.ts
  // priority_placeholder: 'Επιλέξτε προτεραιότητα', ➜ MOVED TO ./core/labels/fields.ts
  // location_placeholder: 'Επιλέξτε περιοχή', ➜ MOVED TO ./core/labels/fields.ts
  // company_placeholder: 'Επιλέξτε εταιρεία', ➜ MOVED TO ./core/labels/fields.ts
  // client_placeholder: 'Επιλέξτε πελάτη', ➜ MOVED TO ./core/labels/fields.ts
  // energy_class_placeholder: 'Επιλέξτε κλάση', ➜ MOVED TO ./core/labels/fields.ts
  // renovation_placeholder: 'Επιλέξτε κατάσταση', ➜ MOVED TO ./core/labels/fields.ts
  // risk_level_placeholder: 'Επιλέξτε επίπεδο', ➜ MOVED TO ./core/labels/fields.ts
  // complexity_placeholder: 'Επιλέξτε πολυπλοκότητα' ➜ MOVED TO ./core/labels/fields.ts
// } as const; ➜ MOVED TO ./core/labels/fields.ts

/**
 * ❌ DEPRECATED: Field Labels - Central Source
 * ✅ MIGRATED TO: ./core/labels/fields.ts - MODAL_SELECT_FIELD_LABELS
 * 📍 USE: import { MODAL_SELECT_FIELD_LABELS } from './modal-select'
 */
// export const MODAL_SELECT_FIELD_LABELS = { // ➜ MOVED TO ./core/labels/fields.ts
  // Common Field Labels
  // search: 'Αναζήτηση', // ➜ MOVED TO ./core/labels/fields.ts
  // status: 'Κατάσταση', // ➜ MOVED TO ./core/labels/fields.ts
  // type: 'Τύπος', // ➜ MOVED TO ./core/labels/fields.ts
  // priority: 'Προτεραιότητα', // ➜ MOVED TO ./core/labels/fields.ts
  // location: 'Περιοχή', // ➜ MOVED TO ./core/labels/fields.ts
  // company: 'Εταιρεία', // ➜ MOVED TO ./core/labels/fields.ts
  // client: 'Πελάτης', // ➜ MOVED TO ./core/labels/fields.ts
  // project: 'Έργο', // ➜ MOVED TO ./core/labels/fields.ts
  // building: 'Κτίριο', // ➜ MOVED TO ./core/labels/fields.ts
  // floor: 'Όροφος', // ➜ MOVED TO ./core/labels/fields.ts

  // Unit-specific Labels
  // price_range: 'Εύρος Τιμής (€)', // ➜ MOVED TO ./core/labels/fields.ts
  // area_range: 'Εύρος Εμβαδού (m²)', // ➜ MOVED TO ./core/labels/fields.ts
  // property_type: 'Τύπος Ακινήτου', // ➜ MOVED TO ./core/labels/fields.ts

  // Contact-specific Labels
  // contact_type: 'Τύπος Επαφής', // ➜ MOVED TO ./core/labels/fields.ts
  // units_count: 'Πλήθος Μονάδων', // ➜ MOVED TO ./core/labels/fields.ts
  // total_area: 'Συνολικό Εμβαδόν', // ➜ MOVED TO ./core/labels/fields.ts
  // has_properties: 'Μόνο με ιδιοκτησίες', // ➜ MOVED TO ./core/labels/fields.ts
  // is_favorite: 'Αγαπημένα', // ➜ MOVED TO ./core/labels/fields.ts
  // show_archived: 'Αρχειοθετημένα', // ➜ MOVED TO ./core/labels/fields.ts

  // Building-specific Labels
  // value_range: 'Αξία (€)', // ➜ MOVED TO ./core/labels/fields.ts
  // units_range: 'Αρ. Μονάδων', // ➜ MOVED TO ./core/labels/fields.ts
  // year_range: 'Έτος Κατασκευής', // ➜ MOVED TO ./core/labels/fields.ts
  // has_parking: 'Parking', // ➜ MOVED TO ./core/labels/fields.ts
  // has_elevator: 'Ασανσέρ', // ➜ MOVED TO ./core/labels/fields.ts
  // has_garden: 'Κήπος', // ➜ MOVED TO ./core/labels/fields.ts
  // has_pool: 'Πισίνα', // ➜ MOVED TO ./core/labels/fields.ts
  // energy_class: 'Ενεργειακή Κλάση', // ➜ MOVED TO ./core/labels/fields.ts
  // accessibility: 'Προσβασιμότητα ΑΜΕΑ', // ➜ MOVED TO ./core/labels/fields.ts
  // furnished: 'Επιπλωμένο', // ➜ MOVED TO ./core/labels/fields.ts
  // renovation: 'Κατάσταση', // ➜ MOVED TO ./core/labels/fields.ts

  // Project-specific Labels
  // budget_range: 'Προϋπολογισμός (€)', // ➜ MOVED TO ./core/labels/fields.ts
  // duration_range: 'Διάρκεια (μήνες)', // ➜ MOVED TO ./core/labels/fields.ts
  // progress_range: 'Πρόοδος (%)', // ➜ MOVED TO ./core/labels/fields.ts
  // start_year_range: 'Έτος Έναρξης', // ➜ MOVED TO ./core/labels/fields.ts
  // has_permits: 'Έχει άδειες', // ➜ MOVED TO ./core/labels/fields.ts
  // has_financing: 'Έχει χρηματοδότηση', // ➜ MOVED TO ./core/labels/fields.ts
  // is_ecological: 'Οικολογικό', // ➜ MOVED TO ./core/labels/fields.ts
  // has_subcontractors: 'Έχει υπεργολάβους', // ➜ MOVED TO ./core/labels/fields.ts
  // risk_level: 'Επίπεδο κινδύνου', // ➜ MOVED TO ./core/labels/fields.ts
  // complexity: 'Πολυπλοκότητα', // ➜ MOVED TO ./core/labels/fields.ts
  // is_active: 'Μόνο ενεργά', // ➜ MOVED TO ./core/labels/fields.ts
  // has_issues: 'Έχει προβλήματα' // ➜ MOVED TO ./core/labels/fields.ts
// } as const; // ➜ MOVED TO ./core/labels/fields.ts

/**
 * ❌ DEPRECATED: Advanced Filter Options
 * ✅ MIGRATED TO: ./core/labels/fields.ts - MODAL_SELECT_ADVANCED_FILTER_OPTIONS
 * 📍 USE: import { MODAL_SELECT_ADVANCED_FILTER_OPTIONS } from './modal-select'
 */
// export const MODAL_SELECT_ADVANCED_FILTER_OPTIONS = { // ➜ MOVED TO ./core/labels/fields.ts
  // Unit Features
  // parking: 'Parking', // ➜ MOVED TO ./core/labels/fields.ts
  // storage: 'Αποθήκη', // ➜ MOVED TO ./core/labels/fields.ts
  // fireplace: 'Τζάκι', // ➜ MOVED TO ./core/labels/fields.ts
  // view: 'Θέα', // ➜ MOVED TO ./core/labels/fields.ts
  // pool: 'Πισίνα', // ➜ MOVED TO ./core/labels/fields.ts

  // Contact Features
  // is_favorite_contacts: 'Αγαπημένες', // ➜ MOVED TO ./core/labels/fields.ts
  // has_email: 'Με Email', // ➜ MOVED TO ./core/labels/fields.ts
  // has_phone: 'Με Τηλέφωνο', // ➜ MOVED TO ./core/labels/fields.ts
  // recent_activity: 'Πρόσφατη Δραστηριότητα' // ➜ MOVED TO ./core/labels/fields.ts
// } as const; // ➜ MOVED TO ./core/labels/fields.ts

/**
 * ❌ DEPRECATED: Range Labels
 * ✅ MIGRATED TO: ./core/labels/fields.ts - MODAL_SELECT_RANGE_LABELS
 * 📍 USE: import { MODAL_SELECT_RANGE_LABELS } from './modal-select'
 */
// export const MODAL_SELECT_RANGE_LABELS = { // ➜ MOVED TO ./core/labels/fields.ts
  // Units Count Options
  // units_all: 'Όλες οι μονάδες', // ➜ MOVED TO ./core/labels/fields.ts
  // units_1_2: '1-2 μονάδες', // ➜ MOVED TO ./core/labels/fields.ts
  // units_3_5: '3-5 μονάδες', // ➜ MOVED TO ./core/labels/fields.ts
  // units_6_plus: '6+ μονάδες', // ➜ MOVED TO ./core/labels/fields.ts

  // Area Options
  // areas_all: 'Όλα τα εμβαδά', // ➜ MOVED TO ./core/labels/fields.ts
  // area_up_to_100: 'Έως 100 τ.μ.', // ➜ MOVED TO ./core/labels/fields.ts
  // area_101_300: '101 - 300 τ.μ.', // ➜ MOVED TO ./core/labels/fields.ts
  // area_301_plus: '301+ τ.μ.' // ➜ MOVED TO ./core/labels/fields.ts
// } as const; // ➜ MOVED TO ./core/labels/fields.ts

/**
 * ❌ DEPRECATED: Energy Class Labels
 * ✅ MIGRATED TO: ./core/labels/fields.ts - MODAL_SELECT_ENERGY_CLASS_LABELS
 * 📍 USE: import { MODAL_SELECT_ENERGY_CLASS_LABELS } from './modal-select'
 */
// export const MODAL_SELECT_ENERGY_CLASS_LABELS = { // ➜ MOVED TO ./core/labels/fields.ts
  // 'A+': 'A+', // ➜ MOVED TO ./core/labels/fields.ts
  // 'A': 'A', // ➜ MOVED TO ./core/labels/fields.ts
  // 'B+': 'B+', // ➜ MOVED TO ./core/labels/fields.ts
  // 'B': 'B', // ➜ MOVED TO ./core/labels/fields.ts
  // 'C': 'C', // ➜ MOVED TO ./core/labels/fields.ts
  // 'D': 'D', // ➜ MOVED TO ./core/labels/fields.ts
  // 'E': 'E', // ➜ MOVED TO ./core/labels/fields.ts
  // 'F': 'F', // ➜ MOVED TO ./core/labels/fields.ts
  // 'G': 'G' // ➜ MOVED TO ./core/labels/fields.ts
// } as const; // ➜ MOVED TO ./core/labels/fields.ts

// ====================================================================
// 🏢 TAB LABELS GETTERS - ENTERPRISE ACCESS FUNCTIONS
// ====================================================================

/**
 * Get units tab labels
 * ✅ CENTRALIZED: Getter function για units tabs
 */
// export function getUnitsTabLabels() { // ➜ MOVED TO ./core/labels/tabs.ts
//   return MODAL_SELECT_UNITS_TAB_LABELS;
// }

/**
 * Get storage tab labels
 * ✅ CENTRALIZED: Getter function για storage tabs
 */
// export function getStorageTabLabels() { // ➜ MOVED TO ./core/labels/tabs.ts
//   return MODAL_SELECT_STORAGE_TAB_LABELS;
// }

/**
 * ❌ DEPRECATED: Get service field labels
 * ✅ MIGRATED TO: ./core/labels/fields.ts - getServiceFieldLabels()
 * 📍 USE: import { getServiceFieldLabels } from './modal-select'
 */
// export function getServiceFieldLabels() { ... } // ➜ MOVED TO ./core/labels/fields.ts

/**
 * ❌ DEPRECATED: Get filter panel titles
 * ✅ MIGRATED TO: ./core/labels/fields.ts - getFilterPanelTitles()
 * 📍 USE: import { getFilterPanelTitles } from './modal-select'
 */
// export function getFilterPanelTitles() { ... } // ➜ MOVED TO ./core/labels/fields.ts

/**
 * ❌ DEPRECATED: Get search placeholders
 * ✅ MIGRATED TO: ./core/labels/fields.ts - getSearchPlaceholders()
 * 📍 USE: import { getSearchPlaceholders } from './modal-select'
 */
// export function getSearchPlaceholders() { ... } // ➜ MOVED TO ./core/labels/fields.ts

/**
 * ❌ DEPRECATED: Get field labels
 * ✅ MIGRATED TO: ./core/labels/fields.ts - getFieldLabels()
 * 📍 USE: import { getFieldLabels } from './modal-select'
 */
// export function getFieldLabels() { ... } // ➜ MOVED TO ./core/labels/fields.ts

/**
 * ❌ DEPRECATED: Get advanced filter options
 * ✅ MIGRATED TO: ./core/labels/fields.ts - getAdvancedFilterOptions()
 * 📍 USE: import { getAdvancedFilterOptions } from './modal-select'
 */
// export function getAdvancedFilterOptions() { ... } // ➜ MOVED TO ./core/labels/fields.ts

/**
 * ❌ DEPRECATED: Get range labels
 * ✅ MIGRATED TO: ./core/labels/fields.ts - getRangeLabels()
 * 📍 USE: import { getRangeLabels } from './modal-select'
 */
// export function getRangeLabels() { ... } // ➜ MOVED TO ./core/labels/fields.ts

/**
 * ❌ DEPRECATED: Get energy class labels
 * ✅ MIGRATED TO: ./core/labels/fields.ts - getEnergyClassLabels()
 * 📍 USE: import { getEnergyClassLabels } from './modal-select'
 */
// export function getEnergyClassLabels() { ... } // ➜ MOVED TO ./core/labels/fields.ts

// ====================================================================
// 🏢 NAVIGATION LABELS CONSTANTS - ENTERPRISE CENTRALIZED
// ====================================================================

/**
 * ❌ DEPRECATED: Navigation Level Titles
 * ✅ MIGRATED TO: ./core/labels/navigation.ts - MODAL_SELECT_NAVIGATION_LEVEL_TITLES
 * 📍 USE: import { MODAL_SELECT_NAVIGATION_LEVEL_TITLES } from './modal-select'
 */
// export const MODAL_SELECT_NAVIGATION_LEVEL_TITLES = { // ➜ MOVED TO ./core/labels/navigation.ts
  // companies: 'Εταιρείες', // ➜ MOVED TO ./core/labels/navigation.ts
  // projects: 'Έργα', // ➜ MOVED TO ./core/labels/navigation.ts
  // buildings: 'Κτίρια', // ➜ MOVED TO ./core/labels/navigation.ts
  // floors: 'Όροφοι', // ➜ MOVED TO ./core/labels/navigation.ts
  // units: 'Μονάδες' // ➜ MOVED TO ./core/labels/navigation.ts
// } as const; // ➜ MOVED TO ./core/labels/navigation.ts

/**
 * ❌ DEPRECATED: Navigation Base Labels
 * ✅ MIGRATED TO: ./core/labels/navigation.ts - MODAL_SELECT_NAVIGATION_BASE_LABELS
 * 📍 USE: import { MODAL_SELECT_NAVIGATION_BASE_LABELS } from './modal-select'
 */
// export const MODAL_SELECT_NAVIGATION_BASE_LABELS = { // ➜ MOVED TO ./core/labels/navigation.ts
  // Action Labels
  // add: 'Προσθήκη', // ➜ MOVED TO ./core/labels/navigation.ts
  // connect: 'Σύνδεση', // ➜ MOVED TO ./core/labels/navigation.ts
  // edit: 'Επεξεργασία', // ➜ MOVED TO ./core/labels/navigation.ts
  // remove: 'Αφαίρεση', // ➜ MOVED TO ./core/labels/navigation.ts
  // disconnect: 'Αποσύνδεση', // ➜ MOVED TO ./core/labels/navigation.ts
  // filters: 'Φίλτρα', // ➜ MOVED TO ./core/labels/navigation.ts
  // favorites: 'Αγαπημένα', // ➜ MOVED TO ./core/labels/navigation.ts
  // archive: 'Αρχείο', // ➜ MOVED TO ./core/labels/navigation.ts
  // export: 'Εξαγωγή', // ➜ MOVED TO ./core/labels/navigation.ts
  // import: 'Εισαγωγή', // ➜ MOVED TO ./core/labels/navigation.ts
  // refresh: 'Ανανέωση', // ➜ MOVED TO ./core/labels/navigation.ts
  // preview: 'Προεπισκόπηση', // ➜ MOVED TO ./core/labels/navigation.ts
  // copy: 'Αντιγραφή', // ➜ MOVED TO ./core/labels/navigation.ts
  // share: 'Διαμοιρασμός', // ➜ MOVED TO ./core/labels/navigation.ts
  // reports: 'Αναφορές', // ➜ MOVED TO ./core/labels/navigation.ts
  // settings: 'Ρυθμίσεις', // ➜ MOVED TO ./core/labels/navigation.ts
  // favorites_management: 'Διαχείριση Αγαπημένων', // ➜ MOVED TO ./core/labels/navigation.ts
  // help: 'Βοήθεια', // ➜ MOVED TO ./core/labels/navigation.ts
  // sorting: 'Ταξινόμηση', // ➜ MOVED TO ./core/labels/navigation.ts

  // Tooltip Labels
  // filtering: 'Φιλτράρισμα', // ➜ MOVED TO ./core/labels/navigation.ts
  // archiving: 'Αρχειοθέτηση', // ➜ MOVED TO ./core/labels/navigation.ts
  // export_data: 'Εξαγωγή δεδομένων', // ➜ MOVED TO ./core/labels/navigation.ts
  // import_data: 'Εισαγωγή δεδομένων', // ➜ MOVED TO ./core/labels/navigation.ts
  // refresh_data: 'Ανανέωση δεδομένων' // ➜ MOVED TO ./core/labels/navigation.ts
// } as const; // ➜ MOVED TO ./core/labels/navigation.ts

/**
 * ❌ DEPRECATED: Navigation Search Placeholders
 * ✅ MIGRATED TO: ./core/labels/navigation.ts - MODAL_SELECT_NAVIGATION_SEARCH_PLACEHOLDERS
 * 📍 USE: import { MODAL_SELECT_NAVIGATION_SEARCH_PLACEHOLDERS } from './modal-select'
 */
// export const MODAL_SELECT_NAVIGATION_SEARCH_PLACEHOLDERS = { // ➜ MOVED TO ./core/labels/navigation.ts
  // companies: 'Αναζήτηση εταιρείας...', // ➜ MOVED TO ./core/labels/navigation.ts
  // projects: 'Αναζήτηση έργου...', // ➜ MOVED TO ./core/labels/navigation.ts
  // buildings: 'Αναζήτηση κτιρίου...', // ➜ MOVED TO ./core/labels/navigation.ts
  // floors: 'Αναζήτηση ορόφου...', // ➜ MOVED TO ./core/labels/navigation.ts
  // units: 'Αναζήτηση μονάδας...' // ➜ MOVED TO ./core/labels/navigation.ts
// } as const; // ➜ MOVED TO ./core/labels/navigation.ts

/**
 * ❌ DEPRECATED: Navigation Tooltip Labels
 * ✅ MIGRATED TO: ./core/labels/navigation.ts - MODAL_SELECT_NAVIGATION_TOOLTIPS
 * 📍 USE: import { MODAL_SELECT_NAVIGATION_TOOLTIPS } from './modal-select'
 */
// export const MODAL_SELECT_NAVIGATION_TOOLTIPS = { // ➜ MOVED TO ./core/labels/navigation.ts
  // Companies Tooltips
  // add_company: 'Προσθήκη νέας εταιρείας', // ➜ MOVED TO ./core/labels/navigation.ts
  // edit_company: 'Επεξεργασία εταιρείας', // ➜ MOVED TO ./core/labels/navigation.ts
  // remove_company: 'Αφαίρεση εταιρείας', // ➜ MOVED TO ./core/labels/navigation.ts

  // Projects Tooltips
  // connect_project: 'Σύνδεση έργου με επιλεγμένη εταιρεία', // ➜ MOVED TO ./core/labels/navigation.ts
  // edit_project: 'Επεξεργασία έργου', // ➜ MOVED TO ./core/labels/navigation.ts
  // disconnect_project: 'Αποσύνδεση έργου', // ➜ MOVED TO ./core/labels/navigation.ts

  // Buildings Tooltips
  // connect_building: 'Σύνδεση κτιρίου με επιλεγμένο έργο', // ➜ MOVED TO ./core/labels/navigation.ts
  // edit_building: 'Επεξεργασία κτιρίου', // ➜ MOVED TO ./core/labels/navigation.ts
  // disconnect_building: 'Αποσύνδεση κτιρίου', // ➜ MOVED TO ./core/labels/navigation.ts

  // Floors Tooltips
  // connect_floor: 'Σύνδεση ορόφου με επιλεγμένο κτίριο', // ➜ MOVED TO ./core/labels/navigation.ts
  // edit_floor: 'Επεξεργασία ορόφου', // ➜ MOVED TO ./core/labels/navigation.ts
  // disconnect_floor: 'Αποσύνδεση ορόφου', // ➜ MOVED TO ./core/labels/navigation.ts

  // Units Tooltips
  // connect_unit: 'Σύνδεση μονάδας με επιλεγμένο όροφο', // ➜ MOVED TO ./core/labels/navigation.ts
  // edit_unit: 'Επεξεργασία μονάδας', // ➜ MOVED TO ./core/labels/navigation.ts
  // disconnect_unit: 'Αποσύνδεση μονάδας' // ➜ MOVED TO ./core/labels/navigation.ts
// } as const; // ➜ MOVED TO ./core/labels/navigation.ts

/**
 * ❌ DEPRECATED: Navigation Filter Categories
 * ✅ MIGRATED TO: ./core/labels/navigation.ts - MODAL_SELECT_NAVIGATION_FILTER_CATEGORIES
 * 📍 USE: import { MODAL_SELECT_NAVIGATION_FILTER_CATEGORIES } from './modal-select'
 */
// export const MODAL_SELECT_NAVIGATION_FILTER_CATEGORIES = { // ➜ MOVED TO ./core/labels/navigation.ts
  // Companies Filters
  // company_type_label: 'Τύπος Εταιρείας', // ➜ MOVED TO ./core/labels/navigation.ts
  // company_construction: 'Κατασκευαστική', // ➜ MOVED TO ./core/labels/navigation.ts
  // company_development: 'Αναπτυξιακή', // ➜ MOVED TO ./core/labels/navigation.ts
  // company_investment: 'Επενδυτική', // ➜ MOVED TO ./core/labels/navigation.ts
  // company_management: 'Διαχειριστική', // ➜ MOVED TO ./core/labels/navigation.ts
  // company_status_label: 'Κατάσταση', // ➜ MOVED TO ./core/labels/navigation.ts
  // company_active: 'Ενεργές', // ➜ MOVED TO ./core/labels/navigation.ts
  // company_with_projects: 'Με έργα', // ➜ MOVED TO ./core/labels/navigation.ts
  // company_without_projects: 'Χωρίς έργα', // ➜ MOVED TO ./core/labels/navigation.ts

  // Projects Filters
  // project_status_label: 'Κατάσταση Έργου', // ➜ MOVED TO ./core/labels/navigation.ts
  // project_planning: 'Σχεδίαση', // ➜ MOVED TO ./core/labels/navigation.ts
  // project_construction: 'Κατασκευή', // ➜ MOVED TO ./core/labels/navigation.ts
  // project_completed: 'Ολοκληρωμένα', // ➜ MOVED TO ./core/labels/navigation.ts
  // project_on_hold: 'Αναστολή', // ➜ MOVED TO ./core/labels/navigation.ts
  // project_type_label: 'Τύπος Έργου', // ➜ MOVED TO ./core/labels/navigation.ts
  // project_residential: 'Κατοικίες', // ➜ MOVED TO ./core/labels/navigation.ts
  // project_commercial: 'Εμπορικά', // ➜ MOVED TO ./core/labels/navigation.ts
  // project_mixed: 'Μεικτά', // ➜ MOVED TO ./core/labels/navigation.ts

  // Buildings Filters
  // building_type_label: 'Τύπος Κτιρίου', // ➜ MOVED TO ./core/labels/navigation.ts
  // building_residential: 'Κατοικίες', // ➜ MOVED TO ./core/labels/navigation.ts
  // building_commercial: 'Εμπορικό', // ➜ MOVED TO ./core/labels/navigation.ts
  // building_office: 'Γραφεία', // ➜ MOVED TO ./core/labels/navigation.ts
  // building_mixed: 'Μεικτό', // ➜ MOVED TO ./core/labels/navigation.ts
  // building_floors_label: 'Αριθμός Ορόφων', // ➜ MOVED TO ./core/labels/navigation.ts
  // building_floors_1_3: '1-3 όροφοι', // ➜ MOVED TO ./core/labels/navigation.ts
  // building_floors_4_6: '4-6 όροφοι', // ➜ MOVED TO ./core/labels/navigation.ts
  // building_floors_7_plus: '7+ όροφοι', // ➜ MOVED TO ./core/labels/navigation.ts

  // Floors Filters
  // floor_type_label: 'Τύπος Ορόφου', // ➜ MOVED TO ./core/labels/navigation.ts
  // floor_basement: 'Υπόγειο', // ➜ MOVED TO ./core/labels/navigation.ts
  // floor_ground: 'Ισόγειο', // ➜ MOVED TO ./core/labels/navigation.ts
  // floor_floor: 'Όροφος', // ➜ MOVED TO ./core/labels/navigation.ts
  // floor_penthouse: 'Ρετιρέ', // ➜ MOVED TO ./core/labels/navigation.ts
  // floor_units_label: 'Αριθμός Μονάδων', // ➜ MOVED TO ./core/labels/navigation.ts
  // floor_units_1_2: '1-2 μονάδες', // ➜ MOVED TO ./core/labels/navigation.ts
  // floor_units_3_5: '3-5 μονάδες', // ➜ MOVED TO ./core/labels/navigation.ts
  // floor_units_6_plus: '6+ μονάδες', // ➜ MOVED TO ./core/labels/navigation.ts

  // Units Filters
  // unit_type_label: 'Τύπος Μονάδας', // ➜ MOVED TO ./core/labels/navigation.ts
  // unit_apartment: 'Διαμέρισμα', // ➜ MOVED TO ./core/labels/navigation.ts
  // unit_office: 'Γραφείο', // ➜ MOVED TO ./core/labels/navigation.ts
  // unit_shop: 'Κατάστημα', // ➜ MOVED TO ./core/labels/navigation.ts
  // unit_storage: 'Αποθήκη', // ➜ MOVED TO ./core/labels/navigation.ts
  // unit_parking: 'Θέση Στάθμευσης', // ➜ MOVED TO ./core/labels/navigation.ts
  // unit_status_label: 'Κατάσταση', // ➜ MOVED TO ./core/labels/navigation.ts
  // unit_available: 'Διαθέσιμη', // ➜ MOVED TO ./core/labels/navigation.ts
  // unit_occupied: 'Κατειλημμένη', // ➜ MOVED TO ./core/labels/navigation.ts
  // unit_reserved: 'Κρατημένη', // ➜ MOVED TO ./core/labels/navigation.ts
  // unit_maintenance: 'Συντήρηση', // ➜ MOVED TO ./core/labels/navigation.ts
  // unit_rooms_label: 'Αριθμός Δωματίων', // ➜ MOVED TO ./core/labels/navigation.ts
  // unit_1_room: '1 δωμάτιο', // ➜ MOVED TO ./core/labels/navigation.ts
  // unit_2_rooms: '2 δωμάτια', // ➜ MOVED TO ./core/labels/navigation.ts
  // unit_3_rooms: '3 δωμάτια', // ➜ MOVED TO ./core/labels/navigation.ts
  // unit_4_plus_rooms: '4+ δωμάτια' // ➜ MOVED TO ./core/labels/navigation.ts
// } as const; // ➜ MOVED TO ./core/labels/navigation.ts

/**
 * Navigation Sort Options - Centralized από NavigationCardToolbar.tsx
 * ✅ ENTERPRISE: Single source of truth για όλες τις sort επιλογές
 */
export const MODAL_SELECT_NAVIGATION_SORT_OPTIONS = {
  // Common Sort Options
  name_asc: 'Όνομα (Α-Ω)',
  name_desc: 'Όνομα (Ω-Α)',
  date_asc: 'Παλαιότερα πρώτα',
  date_desc: 'Νεότερα πρώτα',
  companies_date_asc: 'Παλαιότερες πρώτα',
  companies_date_desc: 'Νεότερες πρώτα',

  // Projects Sort Options
  progress_asc: 'Πρόοδος (Λίγη-Πολλή)',
  progress_desc: 'Πρόοδος (Πολλή-Λίγη)',

  // Buildings & Floors Sort Options
  area_asc: 'Εμβαδόν (Μικρό-Μεγάλο)',
  area_desc: 'Εμβαδόν (Μεγάλο-Μικρό)',

  // Units Sort Options
  rooms_asc: 'Δωμάτια (Λίγα-Πολλά)',
  rooms_desc: 'Δωμάτια (Πολλά-Λίγα)'
} as const;

// ====================================================================
// 🏢 NAVIGATION LABELS GETTERS - ENTERPRISE ACCESS FUNCTIONS
// ====================================================================

/**
 * Get navigation level titles
 * ✅ CENTRALIZED: Getter function για navigation level titles
 */
export function getNavigationLevelTitles() {
  return MODAL_SELECT_NAVIGATION_LEVEL_TITLES;
}

/**
 * Get navigation base labels
 * ✅ CENTRALIZED: Getter function για navigation base labels
 */
export function getNavigationBaseLabels() {
  return MODAL_SELECT_NAVIGATION_BASE_LABELS;
}

/**
 * Get navigation search placeholders
 * ✅ CENTRALIZED: Getter function για navigation search placeholders
 */
export function getNavigationSearchPlaceholders() {
  return MODAL_SELECT_NAVIGATION_SEARCH_PLACEHOLDERS;
}

/**
 * Get navigation tooltips
 * ✅ CENTRALIZED: Getter function για navigation tooltips
 */
export function getNavigationTooltips() {
  return MODAL_SELECT_NAVIGATION_TOOLTIPS;
}

/**
 * Get navigation filter categories
 * ✅ CENTRALIZED: Getter function για navigation filter categories
 */
export function getNavigationFilterCategories() {
  return MODAL_SELECT_NAVIGATION_FILTER_CATEGORIES;
}

/**
 * Get navigation sort options
 * ✅ CENTRALIZED: Getter function για navigation sort options
 */
export function getNavigationSortOptions() {
  return MODAL_SELECT_NAVIGATION_SORT_OPTIONS;
}

// ====================================================================
// 🏢 COMPACT TOOLBAR LABELS CONSTANTS - ENTERPRISE CENTRALIZED
// ====================================================================

/**
 * Compact Toolbar Search Placeholders - Centralized από CompactToolbar/configs.ts
 * ✅ ENTERPRISE: Single source of truth για όλα τα compact toolbar search placeholders
 */
export const MODAL_SELECT_COMPACT_TOOLBAR_SEARCH_PLACEHOLDERS = {
  buildings: 'Αναζήτηση κτιρίων...',
  projects: 'Αναζήτηση έργων...',
  contacts: 'Αναζήτηση επαφών...',
  units: 'Αναζήτηση μονάδων...',
  storages: 'Αναζήτηση αποθηκών...'
} as const;

/**
 * Compact Toolbar New Item Labels - Centralized από CompactToolbar/configs.ts
 * ✅ ENTERPRISE: Single source of truth για όλα τα "New Item" labels
 */
export const MODAL_SELECT_COMPACT_TOOLBAR_NEW_ITEM_LABELS = {
  new_building: 'Νέο Κτίριο',
  new_project: 'Νέο Έργο',
  new_contact: 'Νέα Επαφή',
  new_unit: 'Νέα Μονάδα',
  new_storage: 'Νέα Αποθήκη'
} as const;

/**
 * Compact Toolbar Context Labels - Centralized από CompactToolbar/configs.ts
 * ✅ ENTERPRISE: Single source of truth για όλα τα context-specific labels
 */
export const MODAL_SELECT_COMPACT_TOOLBAR_CONTEXT_LABELS = {
  // Buildings Context
  favorites_feminine: 'Αγαπημένα', // For buildings
  favorites_feminine_plural: 'Αγαπημένες', // For contacts/units/storages

  // Sorting Context
  sorting_buildings: 'Ταξινόμηση κτιρίων',
  sorting_projects: 'Ταξινόμηση έργων',
  sorting_contacts: 'Ταξινόμηση επαφών',
  sorting_units: 'Ταξινόμηση μονάδων',
  sorting_storages: 'Ταξινόμηση αποθηκών',

  // Management Labels
  favorites_management: 'Διαχείριση αγαπημένων',

  // Action Labels που δεν υπάρχουν στα navigation labels
  share_alt: 'Κοινοποίηση', // Alternative to 'Διαμοιρασμός'
  delete_items: 'Διαγραφή'
} as const;

/**
 * Compact Toolbar Detailed Tooltips - Centralized από CompactToolbar/configs.ts
 * ✅ ENTERPRISE: Single source of truth για όλα τα detailed tooltips
 */
export const MODAL_SELECT_COMPACT_TOOLBAR_TOOLTIPS = {
  // New Item Tooltips
  new_building_tooltip: 'Νέο Κτίριο (Ctrl+N)',
  new_project_tooltip: 'Νέο Έργο (Ctrl+N)',
  new_contact_tooltip: 'Νέα Επαφή (Ctrl+N)',
  new_unit_tooltip: 'Νέα Μονάδα (Ctrl+N)',
  new_storage_tooltip: 'Νέα Αποθήκη (Ctrl+N)',

  // Edit Tooltips (context-specific)
  edit_building: 'Επεξεργασία επιλεγμένου',
  edit_project: 'Επεξεργασία επιλεγμένου έργου',
  edit_contact: 'Επεξεργασία επιλεγμένης επαφής',
  edit_unit: 'Επεξεργασία επιλεγμένης μονάδας',
  edit_storage: 'Επεξεργασία επιλεγμένης αποθήκης',

  // Delete Tooltips (context-specific)
  delete_buildings: 'Διαγραφή επιλεγμένων κτιρίων',
  delete_projects: 'Διαγραφή επιλεγμένων έργων',
  delete_contacts: 'Διαγραφή επιλεγμένων επαφών',
  delete_units: 'Διαγραφή επιλεγμένων μονάδων',
  delete_storages: 'Διαγραφή επιλεγμένων αποθηκών',

  // Filter Tooltips (context-specific)
  filters_buildings: 'Φίλτρα κτιρίων',
  filters_projects: 'Φίλτρα έργων',
  filters_contacts: 'Φίλτρα επαφών',
  filters_units: 'Φίλτρα μονάδων',
  filters_storages: 'Φίλτρα αποθηκών',

  // Favorites Tooltips
  add_to_favorites: 'Προσθήκη στα αγαπημένα',
  add_to_favorites_feminine: 'Προσθήκη στις αγαπημένες',

  // Archive Tooltips
  archive_selected: 'Αρχειοθέτηση επιλεγμένων',

  // Data Operation Tooltips
  export_data_tooltip: 'Εξαγωγή δεδομένων',
  import_data_tooltip: 'Εισαγωγή δεδομένων',
  refresh_data_tooltip: 'Ανανέωση δεδομένων (F5)',

  // Preview Tooltips (context-specific)
  preview_project: 'Προεπισκόπηση έργου',
  preview_contact: 'Προεπισκόπηση επαφής',
  preview_unit: 'Προεπισκόπηση μονάδας',
  preview_storage: 'Προεπισκόπηση αποθήκης',

  // Copy Tooltips
  copy_selected: 'Αντιγραφή επιλεγμένων',

  // Share Tooltips (context-specific)
  share_projects: 'Κοινοποίηση έργων',
  share_contacts: 'Κοινοποίηση επαφών',
  share_units: 'Κοινοποίηση μονάδων',
  share_storages: 'Κοινοποίηση αποθηκών',

  // Reports Tooltips (context-specific)
  create_reports: 'Δημιουργία αναφορών',
  create_contact_reports: 'Δημιουργία αναφορών επαφών',

  // Settings Tooltips (context-specific)
  settings_contacts: 'Ρυθμίσεις επαφών',
  settings_units: 'Ρυθμίσεις μονάδων',
  settings_storages: 'Ρυθμίσεις αποθηκών',

  // Help Tooltips
  help_and_instructions: 'Βοήθεια και οδηγίες (F1)'
} as const;

/**
 * Compact Toolbar Filter Category Labels - Centralized από CompactToolbar/configs.ts
 * ✅ ENTERPRISE: Single source of truth για όλα τα filter category labels
 */
export const MODAL_SELECT_COMPACT_TOOLBAR_FILTER_CATEGORIES = {
  // Building Status & Type
  building_status_label: 'Κατάσταση κτιρίου',
  building_type_label: 'Τύπος κτιρίου',

  // Project Status & Type
  project_status_label: 'Κατάσταση έργου',
  project_type_label: 'Τύπος έργου',

  // Contact Type & Status
  contact_type_label: 'Τύπος επαφής',
  contact_customers: 'Πελάτες',
  contact_suppliers: 'Προμηθευτές',
  contact_agents: 'Μεσίτες',
  contact_contractors: 'Εργολάβοι',

  // Unit Status & Type
  unit_status_label: 'Κατάσταση μονάδας',
  unit_type_label: 'Τύπος μονάδας',
  unit_apartment: 'Διαμέρισμα',
  unit_studio: 'Studio',
  unit_loft: 'Loft',
  unit_penthouse: 'Penthouse',
  unit_office: 'Γραφείο',
  unit_shop: 'Κατάστημα',
  unit_unavailable: 'Μη διαθέσιμες',

  // Storage Status & Type
  storage_status_label: 'Κατάσταση αποθήκης',
  storage_type_label: 'Τύπος αποθήκης',
  storage_large: 'Μεγάλες',
  storage_small: 'Μικρές',
  storage_basement: 'Υπόγειες',
  storage_ground: 'Ισόγειες',
  storage_special: 'Ειδικές',

  // Name Filters
  name_filters_label: 'Φίλτρα ονόματος',
  name_a_to_z: 'Όνομα A-Z',
  name_z_to_a: 'Όνομα Z-A',
  name_contains_tower: 'Περιέχει "Πύργο"',
  name_contains_complex: 'Περιέχει "Συγκρότημα"',

  // Progress Filters
  progress_label: 'Πρόοδος έργου',
  progress_0_25: '0-25% (Έναρξη)',
  progress_25_50: '25-50% (Εξέλιξη)',
  progress_50_75: '50-75% (Προχωρημένο)',
  progress_75_100: '75-100% (Ολοκλήρωση)',
  progress_completed: 'Ολοκληρωμένα (100%)',

  // Value Filters
  value_label: 'Αξία έργου',
  value_under_1m: '< 1M €',
  value_1m_5m: '1M - 5M €',
  value_5m_10m: '5M - 10M €',
  value_10m_50m: '10M - 50M €',
  value_over_50m: '> 50M €',
  value_premium: 'Premium (> 100M €)',

  // Area Filters
  total_area_label: 'Συνολική επιφάνεια',
  area_under_1k: '< 1.000 m²',
  area_1k_5k: '1.000 - 5.000 m²',
  area_5k_10k: '5.000 - 10.000 m²',
  area_10k_25k: '10.000 - 25.000 m²',
  area_25k_50k: '25.000 - 50.000 m²',
  area_over_50k: '> 50.000 m²',
  area_mega: 'Mega έργα (> 100.000 m²)',

  // Storage Specific
  storage_building_label: 'Κτίριο',
  building_a: 'Κτίριο Α',
  building_b: 'Κτίριο Β',
  building_c: 'Κτίριο Γ',
  building_d: 'Κτίριο Δ',

  // Storage Area Filters
  storage_area_label: 'Επιφάνεια',
  storage_area_under_10: '< 10 m²',
  storage_area_10_25: '10 - 25 m²',
  storage_area_25_50: '25 - 50 m²',
  storage_area_50_100: '50 - 100 m²',
  storage_area_over_100: '> 100 m²',

  // Storage Price Filters
  storage_price_label: 'Τιμή',
  storage_price_under_5k: '< 5.000 €',
  storage_price_5k_15k: '5.000 - 15.000 €',
  storage_price_15k_30k: '15.000 - 30.000 €',
  storage_price_30k_50k: '30.000 - 50.000 €',
  storage_price_over_50k: '> 50.000 €'
} as const;

/**
 * Compact Toolbar Sort Option Labels - Centralized από CompactToolbar/configs.ts
 * ✅ ENTERPRISE: Single source of truth για όλα τα sort option labels
 */
export const MODAL_SELECT_COMPACT_TOOLBAR_SORT_OPTIONS = {
  // Basic Sort Options
  name_asc_alt: 'Όνομα (Α-Ζ)',
  name_desc_alt: 'Όνομα (Ζ-Α)',

  // Progress Sort
  progress_asc: 'Πρόοδος (Αύξουσα)',
  progress_desc: 'Πρόοδος (Φθίνουσα)',

  // Value Sort
  value_low_to_high: 'Αξία (Χαμηλή → Υψηλή)',
  value_high_to_low: 'Αξία (Υψηλή → Χαμηλή)',

  // Area Sort
  area_small_to_large: 'Επιφάνεια (Μικρή → Μεγάλη)',
  area_large_to_small: 'Επιφάνεια (Μεγάλη → Μικρή)',

  // Date Sort
  date_old_to_new: 'Ημερομηνία (Παλιά → Νέα)',
  date_new_to_old: 'Ημερομηνία (Νέα → Παλιά)',

  // Priority Sort
  priority_low_to_high: 'Προτεραιότητα (Χαμηλή → Υψηλή)',
  priority_high_to_low: 'Προτεραιότητα (Υψηλή → Χαμηλή)',

  // Type Sort
  type_asc: 'Τύπος (Α-Ζ)',
  type_desc: 'Τύπος (Ζ-Α)',

  // Price Sort
  price_low_to_high: 'Τιμή (Χαμηλή → Υψηλή)',
  price_high_to_low: 'Τιμή (Υψηλή → Χαμηλή)',

  // Status Sort
  status_asc: 'Κατάσταση (Α-Ζ)',
  status_desc: 'Κατάσταση (Ζ-Α)',

  // Building Sort
  building_asc: 'Κτίριο (Α-Ζ)',
  building_desc: 'Κτίριο (Ζ-Α)'
} as const;

// ====================================================================
// 🏢 COMPACT TOOLBAR LABELS GETTERS - ENTERPRISE ACCESS FUNCTIONS
// ====================================================================

/**
 * Get compact toolbar search placeholders
 * ✅ CENTRALIZED: Getter function για compact toolbar search placeholders
 */
export function getCompactToolbarSearchPlaceholders() {
  return MODAL_SELECT_COMPACT_TOOLBAR_SEARCH_PLACEHOLDERS;
}

/**
 * Get compact toolbar new item labels
 * ✅ CENTRALIZED: Getter function για compact toolbar new item labels
 */
export function getCompactToolbarNewItemLabels() {
  return MODAL_SELECT_COMPACT_TOOLBAR_NEW_ITEM_LABELS;
}

/**
 * Get compact toolbar context labels
 * ✅ CENTRALIZED: Getter function για compact toolbar context labels
 */
export function getCompactToolbarContextLabels() {
  return MODAL_SELECT_COMPACT_TOOLBAR_CONTEXT_LABELS;
}

/**
 * Get compact toolbar tooltips
 * ✅ CENTRALIZED: Getter function για compact toolbar tooltips
 */
export function getCompactToolbarTooltips() {
  return MODAL_SELECT_COMPACT_TOOLBAR_TOOLTIPS;
}

/**
 * Get compact toolbar filter categories
 * ✅ CENTRALIZED: Getter function για compact toolbar filter categories
 */
export function getCompactToolbarFilterCategories() {
  return MODAL_SELECT_COMPACT_TOOLBAR_FILTER_CATEGORIES;
}

/**
 * Get compact toolbar sort options
 * ✅ CENTRALIZED: Getter function για compact toolbar sort options
 */
export function getCompactToolbarSortOptions() {
  return MODAL_SELECT_COMPACT_TOOLBAR_SORT_OPTIONS;
}

// NOTE: Unified Smart Factory tabs are handled by unified-tabs-factory.ts
// These functions are kept for backward compatibility only

// ====================================================================
// 🏢 MAIN NAVIGATION LABELS - ENTERPRISE CENTRALIZED
// ====================================================================

/**
 * Main Navigation Labels - Centralized για navigation.ts
 * ✅ ENTERPRISE: Single source of truth για όλα τα navigation labels
 */
export const MODAL_SELECT_MAIN_NAVIGATION_LABELS = {
  // Main menu labels
  home: 'Αρχική',
  properties_index: 'Ακίνητα',
  contacts: 'Επαφές',
  projects: 'Έργα',
  buildings: 'Κτίρια',
  spaces: 'Χώροι',
  sales: 'Πωλήσεις',

  // Badges
  badge_new: 'ΝΕΟ',

  // Spaces submenu
  apartments: 'Διαμερίσματα',
  storage: 'Αποθήκες',
  parking: 'Parking',
  common_areas: 'Κοινόχρηστοι',

  // Sales submenu
  available_apartments: 'Διαθέσιμα Διαμερίσματα',
  available_storage: 'Διαθέσιμες Αποθήκες',
  available_parking: 'Διαθέσιμα Parking',
  sold_properties: 'Πωλημένα Ακίνητα',

  // CRM submenu
  dashboard: 'Πίνακας Ελέγχου',
  customer_management: 'Διαχείριση Πελατών',
  communications: 'Επικοινωνία',
  leads_opportunities: 'Ευκαιρίες',
  tasks_appointments: 'Εργασίες',
  sales_pipeline: 'Πωλήσεις',
  teams_roles: 'Ομάδες',
  notifications: 'Ειδοποιήσεις',

  // Legal documents
  legal_documents: 'Νομικά Έγγραφα',
  obligations_writing: 'Σύνταξη Υποχρεώσεων',

  // Settings
  settings: 'Ρυθμίσεις',
  shortcuts: 'Συντομεύσεις'
} as const;

/**
 * Get navigation labels
 * ✅ CENTRALIZED: Main getter function για navigation labels
 */
export function getNavigationLabels() {
  return MODAL_SELECT_MAIN_NAVIGATION_LABELS;
}

// ====================================================================
// 🏢 ACTION BUTTONS LABELS - ENTERPRISE CENTRALIZED
// ====================================================================

/**
 * ❌ DEPRECATED: Action Buttons Labels
 * ✅ MIGRATED TO: ./toolbar/configurations.ts - MODAL_SELECT_ACTION_BUTTONS_LABELS
 * 📍 USE: import { MODAL_SELECT_ACTION_BUTTONS_LABELS } from './modal-select'
 */
// export const MODAL_SELECT_ACTION_BUTTONS_LABELS = { // ➜ MOVED TO ./toolbar/configurations.ts
  // Primary Actions
  // save: 'Αποθήκευση', // ➜ MOVED TO ./toolbar/configurations.ts
  // create: 'Δημιουργία', // ➜ MOVED TO ./toolbar/configurations.ts
  // add: 'Προσθήκη', // ➜ MOVED TO ./toolbar/configurations.ts
  // submit: 'Υποβολή', // ➜ MOVED TO ./toolbar/configurations.ts

  // Secondary Actions
  // edit: 'Επεξεργασία', // ➜ MOVED TO ./toolbar/configurations.ts
  // update: 'Ενημέρωση', // ➜ MOVED TO ./toolbar/configurations.ts
  // cancel: 'Ακύρωση', // ➜ MOVED TO ./toolbar/configurations.ts
  // close: 'Κλείσιμο', // ➜ MOVED TO ./toolbar/configurations.ts

  // Destructive Actions
  // delete: 'Διαγραφή', // ➜ MOVED TO ./toolbar/configurations.ts
  // remove: 'Αφαίρεση', // ➜ MOVED TO ./toolbar/configurations.ts
  // archive: 'Αρχειοθέτηση', // ➜ MOVED TO ./toolbar/configurations.ts

  // Utility Actions
  // refresh: 'Ανανέωση', // ➜ MOVED TO ./toolbar/configurations.ts
  // reset: 'Επαναφορά', // ➜ MOVED TO ./toolbar/configurations.ts
  // download: 'Λήψη', // ➜ MOVED TO ./toolbar/configurations.ts
  // upload: 'Μεταφόρτωση', // ➜ MOVED TO ./toolbar/configurations.ts
  // export: 'Εξαγωγή', // ➜ MOVED TO ./toolbar/configurations.ts
  // import: 'Εισαγωγή', // ➜ MOVED TO ./toolbar/configurations.ts

  // Communication Actions
  // call: 'Κλήση', // ➜ MOVED TO ./toolbar/configurations.ts
  // email: 'Email', // ➜ MOVED TO ./toolbar/configurations.ts
  // message: 'Μήνυμα', // ➜ MOVED TO ./toolbar/configurations.ts

  // Navigation Actions
  // back: 'Πίσω', // ➜ MOVED TO ./toolbar/configurations.ts
  // next: 'Επόμενο', // ➜ MOVED TO ./toolbar/configurations.ts
  // previous: 'Προηγούμενο', // ➜ MOVED TO ./toolbar/configurations.ts

  // State Actions
  // enable: 'Ενεργοποίηση', // ➜ MOVED TO ./toolbar/configurations.ts
  // disable: 'Απενεργοποίηση', // ➜ MOVED TO ./toolbar/configurations.ts
  // favorite: 'Αγαπημένο', // ➜ MOVED TO ./toolbar/configurations.ts

  // Sorting Actions
  // sort_asc: 'Αύξουσα Ταξινόμηση', // ➜ MOVED TO ./toolbar/configurations.ts
  // sort_desc: 'Φθίνουσα Ταξινόμηση', // ➜ MOVED TO ./toolbar/configurations.ts

  // Help Actions
  // help: 'Βοήθεια', // ➜ MOVED TO ./toolbar/configurations.ts
  // info: 'Πληροφορίες' // ➜ MOVED TO ./toolbar/configurations.ts
// } as const; // ➜ MOVED TO ./toolbar/configurations.ts

/**
 * ❌ DEPRECATED: Get action buttons labels
 * ✅ MIGRATED TO: ./toolbar/configurations.ts - getActionButtons()
 * 📍 USE: import { getActionButtons } from './modal-select'
 */
// export function getActionButtons() { // ➜ MOVED TO ./toolbar/configurations.ts
  // return MODAL_SELECT_ACTION_BUTTONS_LABELS; // ➜ MOVED TO ./toolbar/configurations.ts
// } // ➜ MOVED TO ./toolbar/configurations.ts

// ====================================================================
// 🏢 DESKTOP NAVIGATION FUNCTIONS - MISSING EXPORTS
// ====================================================================

/**
 * ❌ DEPRECATED: Desktop Connection Modals Configuration
 * ✅ MIGRATED TO: ./toolbar/configurations.ts - getDesktopConnectionModals()
 * 📍 USE: import { getDesktopConnectionModals } from './modal-select'
 */
// export function getDesktopConnectionModals() { // ➜ MOVED TO ./toolbar/configurations.ts
//   return {
//     company: {
//       title: 'Επιλογή Εταιρείας',
//       placeholder: 'Αναζήτηση εταιρείας...',
//       emptyMessage: 'Δεν βρέθηκαν εταιρείες'
//     },
//     project: {
//       title: 'Επιλογή Έργου',
//       placeholder: 'Αναζήτηση έργου...',
//       emptyMessage: 'Δεν βρέθηκαν έργα'
//     },
//     building: {
//       title: 'Επιλογή Κτιρίου',
//       placeholder: 'Αναζήτηση κτιρίου...',
//       emptyMessage: 'Δεν βρέθηκαν κτίρια'
//     },
//     floor: {
//       title: 'Επιλογή Ορόφου',
//       placeholder: 'Αναζήτηση ορόφου...',
//       emptyMessage: 'Δεν βρέθηκαν όροφοι'
//     }
//   };
// }

/**
 * Desktop Navigation Headers Configuration
 * ✅ CENTRALIZED: για DesktopMultiColumn headers
 */
export function getDesktopNavigationHeaders() {
  return {
    companies: 'Εταιρείες',
    projects: 'Έργα',
    buildings: 'Κτίρια',
    floors: 'Όροφοι',
    units: 'Μονάδες'
  };
}

/**
 * Desktop Counters Configuration
 * ✅ CENTRALIZED: για DesktopMultiColumn counters
 */
export function getDesktopCounters() {
  return {
    companies: (count: number) => `${count} εταιρεί${count === 1 ? 'α' : 'ες'}`,
    projects: (count: number) => `${count} έργ${count === 1 ? 'ο' : 'α'}`,
    buildings: (count: number) => `${count} κτίρι${count === 1 ? 'ο' : 'α'}`,
    floors: (count: number) => `${count} όροφ${count === 1 ? 'ος' : 'οι'}`,
    units: (count: number) => `${count} μονάδ${count === 1 ? 'α' : 'ες'}`
  };
}

/**
 * Desktop Navigation Actions Configuration
 * ✅ CENTRALIZED: για DesktopMultiColumn actions
 */
export function getDesktopNavigationActions() {
  return {
    add: 'Προσθήκη',
    edit: 'Επεξεργασία',
    remove: 'Αφαίρεση',
    connect: 'Σύνδεση',
    disconnect: 'Αποσύνδεση'
  };
}

/**
 * Desktop Status Messages Configuration
 * ✅ CENTRALIZED: για DesktopMultiColumn status messages
 */
export function getDesktopStatusMessages() {
  return {
    loading: 'Φόρτωση...',
    empty: 'Δεν υπάρχουν στοιχεία',
    error: 'Σφάλμα φόρτωσης',
    success: 'Επιτυχής ενέργεια'
  };
}

/**
 * Desktop Confirmation Dialog Configuration
 * ✅ CENTRALIZED: για DesktopMultiColumn confirmation dialogs
 */
export function getDesktopConfirmationDialog() {
  return {
    title: 'Επιβεβαίωση Ενέργειας',
    confirmText: 'Επιβεβαίωση',
    cancelText: 'Ακύρωση',
    messages: {
      deleteCompany: 'Είστε σίγουροι ότι θέλετε να αφαιρέσετε αυτήν την εταιρεία;',
      deleteProject: 'Είστε σίγουροι ότι θέλετε να αφαιρέσετε αυτό το έργο;',
      deleteBuilding: 'Είστε σίγουροι ότι θέλετε να αφαιρέσετε αυτό το κτίριο;',
      deleteFloor: 'Είστε σίγουροι ότι θέλετε να αφαιρέσετε αυτόν τον όροφο;'
    }
  };
}

/**
 * Navigation Extended Labels Configuration
 * ✅ CENTRALIZED: για NavigationCardToolbar extended labels
 */
export function getNavigationExtendedLabels() {
  return {
    // Extended action labels
    addNew: 'Προσθήκη Νέου',
    editSelected: 'Επεξεργασία Επιλεγμένου',
    removeSelected: 'Αφαίρεση Επιλεγμένου',
    connectNew: 'Σύνδεση Νέου',
    disconnectSelected: 'Αποσύνδεση Επιλεγμένου',

    // Extended tooltips
    addTooltip: 'Προσθήκη νέου στοιχείου (Ctrl+N)',
    editTooltip: 'Επεξεργασία επιλεγμένου στοιχείου (F2)',
    removeTooltip: 'Αφαίρεση επιλεγμένου στοιχείου (Delete)',
    connectTooltip: 'Σύνδεση νέου στοιχείου',
    disconnectTooltip: 'Αποσύνδεση επιλεγμένου στοιχείου',

    // Extended messages
    noSelection: 'Δεν έχει επιλεγεί στοιχείο',
    multipleSelection: 'Έχουν επιλεγεί πολλά στοιχεία',
    singleSelection: 'Ένα στοιχείο επιλεγμένο'
  };
}

// ====================================================================
// 🏢 COMPANY GEMI HELP TEXTS - ENTERPRISE CENTRALIZED
// ====================================================================

/**
 * @deprecated MODAL_SELECT_COMPANY_HELP_TEXTS has been moved to modular system
 * Location: ./modal-select/core/options/company.ts
 * Use: import { MODAL_SELECT_COMPANY_HELP_TEXTS } from './modal-select';
 *
 * TEMPORARY RE-EXPORT for backward compatibility
 * This will be removed in Phase 2 of migration
 */
import { MODAL_SELECT_COMPANY_HELP_TEXTS as MIGRATED_COMPANY_HELP_TEXTS } from './modal-select/core/options/company';
export const MODAL_SELECT_COMPANY_HELP_TEXTS = MIGRATED_COMPANY_HELP_TEXTS;

/**
 * @deprecated getGemiHelpTexts has been moved to modular system
 * Location: ./modal-select/core/options/company.ts
 * Use: import { getGemiHelpTexts } from './modal-select';
 *
 * TEMPORARY RE-EXPORT for backward compatibility
 */
import { getGemiHelpTexts as MIGRATED_getGemiHelpTexts } from './modal-select/core/options/company';
export const getGemiHelpTexts = MIGRATED_getGemiHelpTexts;

// ====================================================================
// 🏢 VALIDATION MESSAGES - ENTERPRISE CENTRALIZED
// ====================================================================

/**
 * ✅ ENTERPRISE: Centralized Validation Messages System
 * Single Source of Truth για όλα τα validation error messages
 * Αντικαθιστά διάσπαρτα error strings σε όλη την εφαρμογή
 */
// export const MODAL_SELECT_VALIDATION_MESSAGES = { // ➜ MOVED TO validation/messages.ts
//   // Required field messages
//   first_name_required: 'Το όνομα είναι υποχρεωτικό',
//   last_name_required: 'Το επώνυμο είναι υποχρεωτικό',
//   company_name_required: 'Η επωνυμία εταιρείας είναι υποχρεωτική',
//   service_name_required: 'Το όνομα υπηρεσίας είναι υποχρεωτικό',
//
//   // Format validation messages
//   vat_individual_format: 'Ο ΑΦΜ πρέπει να είναι ακριβώς 9 ψηφία',
//   vat_company_format: 'Ο ΑΦΜ εταιρείας πρέπει να είναι ακριβώς 9 ψηφία',
//   amka_format: 'Ο ΑΜΚΑ πρέπει να είναι ακριβώς 11 ψηφία',
//
//   // Date validation messages
//   birthdate_invalid: 'Μη έγκυρη ημερομηνία γέννησης',
//   birthdate_future_error: 'Η ημερομηνία γέννησης δεν μπορεί να είναι μελλοντική',
//   issue_date_future_error: 'Η ημερομηνία έκδοσης δεν μπορεί να είναι μελλοντική',
//   expiry_after_issue_error: 'Η ημερομηνία λήξης πρέπει να είναι μετά την ημερομηνία έκδοσης',
//   past_date_error: 'Η ημερομηνία δεν μπορεί να είναι παρελθούσα',
//   date_comparison_error: 'Μη έγκυρη σύγκριση ημερομηνιών',
//
//   // Generic validation messages
//   required: 'Αυτό το πεδίο είναι υποχρεωτικό',
//   minLength: 'Πρέπει να είναι τουλάχιστον {min} χαρακτήρες',
//   maxLength: 'Δεν μπορεί να ξεπερνά τους {max} χαρακτήρες',
//   exactLength: 'Πρέπει να είναι ακριβώς {length} χαρακτήρες',
//   invalidEmail: 'Μη έγκυρη διεύθυνση email',
//   invalidPhone: 'Μη έγκυρος αριθμός τηλεφώνου',
//   invalidUrl: 'Μη έγκυρη διεύθυνση URL',
//   invalidNumber: 'Πρέπει να είναι έγκυρος αριθμός',
//   notInteger: 'Πρέπει να είναι ακέραιος αριθμός',
//   positiveNumber: 'Πρέπει να είναι θετικός αριθμός',
//   nonNegativeNumber: 'Δεν μπορεί να είναι αρνητικός αριθμός',
//   minValue: 'Πρέπει να είναι τουλάχιστον {min}',
//   maxValue: 'Δεν μπορεί να ξεπερνά το {max}',
//   greaterThan: 'Πρέπει να είναι μεγαλύτερος από {value}',
//   lessThan: 'Πρέπει να είναι μικρότερος από {value}',
//   invalidDate: 'Μη έγκυρη ημερομηνία',
//   pastDate: 'Η ημερομηνία πρέπει να είναι παρελθούσα',
//   futureDate: 'Η ημερομηνία πρέπει να είναι μελλοντική',
//   invalidSelection: 'Μη έγκυρη επιλογή',
//   areaRequired: 'Το εμβαδόν πρέπει να είναι θετικός αριθμός',
//   priceRequired: 'Η τιμή πρέπει να είναι θετικός αριθμός',
//   invalidCode: 'Μη έγκυρος κωδικός',
//   confirmPassword: 'Οι κωδικοί δεν ταιριάζουν'
// } as const;

/**
 * ✅ ENTERPRISE: Get centralized validation messages
 * Accessor function για τα validation messages - διατηρεί consistency με τα άλλα get functions
 */
// export function getValidationMessages() { // ➜ MOVED TO validation/messages.ts
//   return MODAL_SELECT_VALIDATION_MESSAGES;
// }

// export function getBuildingTabLabels() { // ➜ MOVED TO ./core/labels/tabs.ts
//   return {
//     // ✅ ENTERPRISE: Πλήρης λίστα building tabs από backup configuration
//     general: "Γενικά",
//     floorplan: "Κάτοψη Κτιρίου",
//     timeline: "Timeline",
//     analytics: "Analytics",
//     storage: "Αποθήκες",
//     contracts: "Συμβόλαια",
//     protocols: "Πρωτόκολλα",
//     photos: "Φωτογραφίες",
//     customers: "Πελάτες",
//     videos: "Videos",
//
//     // 🔧 LEGACY: Παλιές ετικέτες για backward compatibility
//     details: "Λεπτομέρειες",
//     properties: "Ιδιότητες",
//     units: "Μονάδες",
//     floors: "Όροφοι",
//     amenities: "Ανέσεις",
//     documents: "Έγγραφα",
//     notes: "Σημειώσεις",
//     history: "Ιστορικό"
//   };
// }


// export function getContactTabLabels() { // ➜ MOVED TO ./core/labels/tabs.ts
//   return {
//     general: "Γενικά",
//     details: "Λεπτομέρειες",
//     properties: "Ιδιότητες",
//     units: "Μονάδες",
//     buildings: "Κτίρια",
//     projects: "Έργα",
//     documents: "Έγγραφα",
//     notes: "Σημειώσεις",
//     history: "Ιστορικό"
//   };
// }

// export function getProjectTabLabels() { // ➜ MOVED TO ./core/labels/tabs.ts
//   return {
//     general: "Γενικά",
//     details: "Λεπτομέρειες",
//     buildings: "Κτίρια",
//     units: "Μονάδες",
//     contacts: "Επαφές",
//     documents: "Έγγραφα",
//     photos: "Φωτογραφίες",
//     notes: "Σημειώσεις",
//     history: "Ιστορικό"
//   };
// }

// export function getCRMDashboardTabLabels() { // ➜ MOVED TO ./core/labels/tabs.ts
//   return {
//     dashboard: "Dashboard",
//     leads: "Leads",
//     opportunities: "Ευκαιρίες",
//     contacts: "Επαφές",
//     companies: "Εταιρείες",
//     tasks: "Εργασίες",
//     reports: "Αναφορές",
//     settings: "Ρυθμίσεις"
//   };
// }

// ====================================================================
// 🔄 BACKWARD COMPATIBILITY RE-EXPORTS
// ====================================================================

/**
 * ✅ BACKWARD COMPATIBILITY: Re-export των extracted functions
 * Εξασφαλίζει ότι τα υπάρχοντα imports συνεχίζουν να λειτουργούν
 */
export { getActionButtons } from './modal-select/toolbar/configurations';

// Tab Labels - Re-exports
export {
  getBuildingTabLabels,
  getContactTabLabels,
  getProjectTabLabels,
  getCRMDashboardTabLabels,
  getUnitsTabLabels,
  getStorageTabLabels
} from './modal-select/core/labels/tabs';

// Utility Accessors - Re-exports
export {
  getDocumentTypeOptions,
  getBoardTypeOptions,
  getRepresentativePositionOptions,
  getPropertyTypeOptions,
  getUnitFilterOptions
} from './modal-select/utils/accessors';