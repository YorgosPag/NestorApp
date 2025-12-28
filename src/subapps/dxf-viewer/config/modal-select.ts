/**
 * @fileoverview Enterprise Modal Select System
 * @description Centralized modal select configuration with modular architecture
 * @author Claude (Anthropic AI)
 * @date 2025-12-28
 * @version 3.0.0 - CLEANED & MODULAR
 * @compliance CLAUDE.md Enterprise Standards - MODULAR ARCHITECTURE
 */

// ====================================================================
// 🏢 ENTERPRISE IMPORTS - CENTRALIZED SOURCE OF TRUTH
// ====================================================================

import { componentSizes, semanticColors } from '../../../styles/design-tokens';
import { COLOR_BRIDGE } from '@/design-system/color-bridge';
import { PANEL_COLORS } from './panel-tokens';

// ====================================================================
// MODULAR SYSTEM RE-EXPORTS - BACKWARD COMPATIBILITY
// ====================================================================

// Styles & Patterns
import { MODAL_SELECT_STYLES as MIGRATED_MODAL_SELECT_STYLES } from './modal-select/core/styles/select-styles';
export const MODAL_SELECT_STYLES = MIGRATED_MODAL_SELECT_STYLES;

import { MODAL_SELECT_ITEM_PATTERNS as MIGRATED_MODAL_SELECT_ITEM_PATTERNS } from './modal-select/core/styles/patterns';
export const MODAL_SELECT_ITEM_PATTERNS = MIGRATED_MODAL_SELECT_ITEM_PATTERNS;

// Placeholders
export const MODAL_SELECT_PLACEHOLDERS = {
  default: 'Επιλέξτε...',
  search: 'Αναζήτηση...',
  loading: 'Φόρτωση...',
  noResults: 'Δεν βρέθηκαν αποτελέσματα',
  error: 'Σφάλμα φόρτωσης'
} as const;

// Encoding Options
import { MODAL_SELECT_ENCODING_OPTIONS as MIGRATED_ENCODING_OPTIONS } from './modal-select/core/options/encoding';
export const MODAL_SELECT_ENCODING_OPTIONS = MIGRATED_ENCODING_OPTIONS;

import { MODAL_SELECT_BOOLEAN_OPTIONS as MIGRATED_BOOLEAN_OPTIONS } from './modal-select/core/options/encoding';
export const MODAL_SELECT_BOOLEAN_OPTIONS = MIGRATED_BOOLEAN_OPTIONS;

// Company Options
import { MODAL_SELECT_LEGAL_FORMS as MIGRATED_LEGAL_FORMS } from './modal-select/core/options/company';
export const MODAL_SELECT_LEGAL_FORMS = MIGRATED_LEGAL_FORMS;

import { MODAL_SELECT_GEMI_STATUSES as MIGRATED_GEMI_STATUSES } from './modal-select/core/options/company';
export const MODAL_SELECT_GEMI_STATUSES = MIGRATED_GEMI_STATUSES;

import { MODAL_SELECT_SERVICE_CATEGORIES as MIGRATED_SERVICE_CATEGORIES } from './modal-select/core/options/company';
export const MODAL_SELECT_SERVICE_CATEGORIES = MIGRATED_SERVICE_CATEGORIES;

import { MODAL_SELECT_LEGAL_STATUSES as MIGRATED_LEGAL_STATUSES } from './modal-select/core/options/company';
export const MODAL_SELECT_LEGAL_STATUSES = MIGRATED_LEGAL_STATUSES;

// Individual Options
import { MODAL_SELECT_GENDER_OPTIONS as MIGRATED_GENDER_OPTIONS } from './modal-select/core/options/individual';
export const MODAL_SELECT_GENDER_OPTIONS = MIGRATED_GENDER_OPTIONS;

import { MODAL_SELECT_IDENTITY_TYPES as MIGRATED_IDENTITY_TYPES } from './modal-select/core/options/individual';
export const MODAL_SELECT_IDENTITY_TYPES = MIGRATED_IDENTITY_TYPES;

import { MODAL_SELECT_COUNTRY_OPTIONS as MIGRATED_COUNTRY_OPTIONS } from './modal-select/core/options/individual';
export const MODAL_SELECT_COUNTRY_OPTIONS = MIGRATED_COUNTRY_OPTIONS;

import { MODAL_SELECT_CURRENCY_OPTIONS as MIGRATED_CURRENCY_OPTIONS } from './modal-select/core/options/individual';
export const MODAL_SELECT_CURRENCY_OPTIONS = MIGRATED_CURRENCY_OPTIONS;

import { MODAL_SELECT_ACTIVITY_TYPES as MIGRATED_ACTIVITY_TYPES } from './modal-select/core/options/company';
export const MODAL_SELECT_ACTIVITY_TYPES = MIGRATED_ACTIVITY_TYPES;

import { MODAL_SELECT_ADDRESS_TYPES as MIGRATED_ADDRESS_TYPES } from './modal-select/core/options/company';
export const MODAL_SELECT_ADDRESS_TYPES = MIGRATED_ADDRESS_TYPES;

import { MODAL_SELECT_SHAREHOLDER_TYPES as MIGRATED_SHAREHOLDER_TYPES } from './modal-select/core/options/company';
export const MODAL_SELECT_SHAREHOLDER_TYPES = MIGRATED_SHAREHOLDER_TYPES;

// Status Labels
import { MODAL_SELECT_PROJECT_STATUS_LABELS as MIGRATED_PROJECT_STATUS_LABELS } from './modal-select/core/labels/status';
export const MODAL_SELECT_PROJECT_STATUS_LABELS = MIGRATED_PROJECT_STATUS_LABELS;

import { MODAL_SELECT_UNIT_STATUS_LABELS as MIGRATED_UNIT_STATUS_LABELS } from './modal-select/core/labels/status';
export const MODAL_SELECT_UNIT_STATUS_LABELS = MIGRATED_UNIT_STATUS_LABELS;

import { MODAL_SELECT_CONTACT_STATUS_LABELS as MIGRATED_CONTACT_STATUS_LABELS } from './modal-select/core/labels/status';
export const MODAL_SELECT_CONTACT_STATUS_LABELS = MIGRATED_CONTACT_STATUS_LABELS;

import { MODAL_SELECT_CONTACT_TYPE_LABELS as MIGRATED_CONTACT_TYPE_LABELS } from './modal-select/core/labels/status';
export const MODAL_SELECT_CONTACT_TYPE_LABELS = MIGRATED_CONTACT_TYPE_LABELS;

import { MODAL_SELECT_PROPERTY_MARKET_STATUS_LABELS as MIGRATED_PROPERTY_MARKET_STATUS_LABELS } from './modal-select/core/labels/status';
export const MODAL_SELECT_PROPERTY_MARKET_STATUS_LABELS = MIGRATED_PROPERTY_MARKET_STATUS_LABELS;

import { MODAL_SELECT_RENTAL_TYPE_LABELS as MIGRATED_RENTAL_TYPE_LABELS } from './modal-select/core/labels/status';
export const MODAL_SELECT_RENTAL_TYPE_LABELS = MIGRATED_RENTAL_TYPE_LABELS;

export const MODAL_SELECT_PROPERTY_SPECIAL_STATUS_LABELS = {
  under_construction: 'Υπό Κατασκευή',
  pre_construction: 'Προ-Κατασκευής',
  completed: 'Ολοκληρωμένο',
  renovation: 'Υπό Ανακαίνιση',
  demolished: 'Κατεδαφισμένο',
  pending_permit: 'Εκκρεμής Άδεια',
  on_hold: 'Σε Αναστολή',
  planning: 'Σε Σχεδίαση',
  approved: 'Εγκεκριμένο',
  rejected: 'Απορριφθέν',
  under_review: 'Υπό Εξέταση',
  expired: 'Ληγμένο'
} as const;

export const MODAL_SELECT_STORAGE_STATUS_LABELS = {
  active: 'Ενεργή',
  inactive: 'Ανενεργή',
  full: 'Πλήρης',
  available: 'Διαθέσιμη',
  maintenance: 'Συντήρηση',
  closed: 'Κλειστή',
  reserved: 'Κρατημένη',
  rented: 'Ενοικιασμένη'
} as const;

export const MODAL_SELECT_PRIORITY_LABELS = {
  low: 'Χαμηλή',
  medium: 'Μέση',
  high: 'Υψηλή',
  urgent: 'Επείγουσα',
  critical: 'Κρίσιμη'
} as const;

export const MODAL_SELECT_RECORD_STATE_LABELS = {
  active: 'Ενεργό',
  archived: 'Αρχειοθετημένο',
  draft: 'Πρόχειρο',
  pending: 'Εκκρεμές',
  deleted: 'Διαγραμμένο'
} as const;

export const MODAL_SELECT_ENTITY_TYPE_LABELS = {
  person: 'Φυσικό Πρόσωπο',
  company: 'Νομικό Πρόσωπο',
  organization: 'Οργανισμός',
  government: 'Κρατικός Φορέας'
} as const;

export const MODAL_SELECT_DOCUMENT_STATUS_LABELS = {
  draft: 'Πρόχειρο',
  pending: 'Εκκρεμές',
  approved: 'Εγκεκριμένο',
  rejected: 'Απορριφθέν',
  expired: 'Ληγμένο'
} as const;

export const MODAL_SELECT_PROPERTY_TYPE_LABELS = {
  residential: 'Κατοικία',
  commercial: 'Εμπορικό',
  industrial: 'Βιομηχανικό',
  agricultural: 'Αγροτικό',
  mixed: 'Μεικτή Χρήση',
  land: 'Οικόπεδο'
} as const;

// Helper Constants
export const MODAL_SELECT_NAVIGATION_SORT_OPTIONS = {
  name_asc: 'Όνομα (Α-Ω)',
  name_desc: 'Όνομα (Ω-Α)',
  date_asc: 'Παλαιότερα πρώτα',
  date_desc: 'Νεότερα πρώτα'
} as const;

export const MODAL_SELECT_COMPACT_TOOLBAR_SEARCH_PLACEHOLDERS = {
  buildings: 'Αναζήτηση κτιρίων...',
  projects: 'Αναζήτηση έργων...',
  contacts: 'Αναζήτηση επαφών...',
  units: 'Αναζήτηση μονάδων...',
  storages: 'Αναζήτηση αποθηκών...'
} as const;

export const MODAL_SELECT_COMPACT_TOOLBAR_NEW_ITEM_LABELS = {
  new_building: 'Νέο Κτίριο',
  new_project: 'Νέο Έργο',
  new_contact: 'Νέα Επαφή',
  new_unit: 'Νέα Μονάδα',
  new_storage: 'Νέα Αποθήκη'
} as const;

export const MODAL_SELECT_COMPACT_TOOLBAR_CONTEXT_LABELS = {
  favorites_feminine: 'Αγαπημένα',
  favorites_feminine_plural: 'Αγαπημένες',
  sorting_buildings: 'Ταξινόμηση κτιρίων',
  sorting_projects: 'Ταξινόμηση έργων',
  sorting_contacts: 'Ταξινόμηση επαφών',
  sorting_units: 'Ταξινόμηση μονάδων',
  sorting_storages: 'Ταξινόμηση αποθηκών',
  favorites_management: 'Διαχείριση αγαπημένων',
  share_alt: 'Κοινοποίηση',
  delete_items: 'Διαγραφή'
} as const;

export const MODAL_SELECT_COMPACT_TOOLBAR_TOOLTIPS = {
  new_building_tooltip: 'Νέο Κτίριο (Ctrl+N)',
  new_project_tooltip: 'Νέο Έργο (Ctrl+N)',
  new_contact_tooltip: 'Νέα Επαφή (Ctrl+N)',
  edit_building: 'Επεξεργασία επιλεγμένου',
  edit_project: 'Επεξεργασία επιλεγμένου έργου',
  edit_contact: 'Επεξεργασία επιλεγμένης επαφής',
  share_building: 'Κοινοποίηση κτιρίου',
  share_project: 'Κοινοποίηση έργου',
  share_contact: 'Κοινοποίηση επαφής',
  delete_building: 'Διαγραφή επιλεγμένου',
  delete_project: 'Διαγραφή επιλεγμένου έργου',
  delete_contact: 'Διαγραφή επιλεγμένης επαφής',
  manage_favorites: 'Διαχείριση αγαπημένων στοιχείων',
  bulk_actions: 'Μαζικές ενέργειες για επιλεγμένα στοιχεία'
} as const;

export const MODAL_SELECT_COMPACT_TOOLBAR_FILTER_CATEGORIES = {
  all_buildings: 'Όλα τα κτίρια',
  residential_buildings: 'Κατοικίες',
  commercial_buildings: 'Εμπορικά',
  mixed_buildings: 'Μεικτά',
  under_construction: 'Υπό κατασκευή',
  completed: 'Ολοκληρωμένα',
  all_projects: 'Όλα τα έργα',
  active_projects: 'Ενεργά έργα',
  completed_projects: 'Ολοκληρωμένα έργα',
  planning_projects: 'Σε σχεδίαση',
  construction_projects: 'Σε κατασκευή',
  on_hold_projects: 'Σε αναστολή',
  all_contacts: 'Όλες οι επαφές',
  individual_contacts: 'Φυσικά πρόσωπα',
  company_contacts: 'Εταιρείες',
  active_contacts: 'Ενεργές επαφές',
  favorite_contacts: 'Αγαπημένες επαφές',
  recent_contacts: 'Πρόσφατες επαφές',
  all_units: 'Όλες οι μονάδες',
  available_units: 'Διαθέσιμες μονάδες',
  sold_units: 'Πωληθείσες μονάδες',
  rented_units: 'Ενοικιασμένες μονάδες',
  reserved_units: 'Κρατημένες μονάδες',
  apartment_units: 'Διαμερίσματα',
  office_units: 'Γραφεία',
  retail_units: 'Καταστήματα',
  storage_units: 'Αποθήκες',
  parking_units: 'Θέσεις στάθμευσης',
  all_storages: 'Όλες οι αποθήκες',
  active_storages: 'Ενεργές αποθήκες',
  available_storages: 'Διαθέσιμες αποθήκες',
  full_storages: 'Πλήρεις αποθήκες',
  maintenance_storages: 'Σε συντήρηση'
} as const;

export const MODAL_SELECT_COMPACT_TOOLBAR_SORT_OPTIONS = {
  name_asc: 'Όνομα (Α-Ω)',
  name_desc: 'Όνομα (Ω-Α)',
  date_asc: 'Παλαιότερα πρώτα',
  date_desc: 'Νεότερα πρώτα',
  price_asc: 'Τιμή (Φθηνότερα πρώτα)',
  price_desc: 'Τιμή (Ακριβότερα πρώτα)',
  area_asc: 'Εμβαδόν (Μικρότερα πρώτα)',
  area_desc: 'Εμβαδόν (Μεγαλύτερα πρώτα)',
  status_asc: 'Κατάσταση (Α-Ω)',
  status_desc: 'Κατάσταση (Ω-Α)',
  progress_asc: 'Πρόοδος (Λίγη-Πολλή)',
  progress_desc: 'Πρόοδος (Πολλή-Λίγη)',
  priority_asc: 'Προτεραιότητα (Χαμηλή-Υψηλή)',
  priority_desc: 'Προτεραιότητα (Υψηλή-Χαμηλή)'
} as const;

export const MODAL_SELECT_MAIN_NAVIGATION_LABELS = {
  dashboard: 'Dashboard',
  buildings: 'Κτίρια',
  projects: 'Έργα',
  contacts: 'Επαφές',
  units: 'Μονάδες',
  documents: 'Έγγραφα',
  reports: 'Αναφορές',
  settings: 'Ρυθμίσεις',
  help: 'Βοήθεια',
  search: 'Αναζήτηση',
  notifications: 'Ειδοποιήσεις',
  profile: 'Προφίλ',
  logout: 'Αποσύνδεση',
  back: 'Πίσω',
  home: 'Αρχική',
  menu: 'Μενού',
  close: 'Κλείσιμο',
  open: 'Άνοιγμα',
  expand: 'Επέκταση',
  collapse: 'Σύμπτυξη',
  refresh: 'Ανανέωση',
  sync: 'Συγχρονισμός',
  export: 'Εξαγωγή',
  import: 'Εισαγωγή',
  print: 'Εκτύπωση',
  save: 'Αποθήκευση',
  cancel: 'Ακύρωση',
  delete: 'Διαγραφή',
  edit: 'Επεξεργασία',
  add: 'Προσθήκη',
  remove: 'Αφαίρεση',
  view: 'Προβολή',
  details: 'Λεπτομέρειες',
  properties: 'Ιδιότητες',
  history: 'Ιστορικό',
  archive: 'Αρχείο',
  restore: 'Επαναφορά',
  share: 'Διαμοιρασμός',
  copy: 'Αντιγραφή',
  paste: 'Επικόλληση',
  cut: 'Αποκοπή',
  undo: 'Αναίρεση',
  redo: 'Επανάληψη',
  filter: 'Φίλτρο',
  sort: 'Ταξινόμηση',
  group: 'Ομαδοποίηση',
  favorites: 'Αγαπημένα',
  recent: 'Πρόσφατα',
  all: 'Όλα',
  active: 'Ενεργά',
  inactive: 'Ανενεργά',
  pending: 'Εκκρεμή',
  completed: 'Ολοκληρωμένα',
  draft: 'Πρόχειρα',
  published: 'Δημοσιευμένα',
  private: 'Ιδιωτικά',
  public: 'Δημόσια',
  personal: 'Προσωπικά',
  shared: 'Κοινόχρηστα',
  team: 'Ομάδα',
  organization: 'Οργανισμός',
  global: 'Καθολικά'
} as const;

import { MODAL_SELECT_COMPANY_HELP_TEXTS as MIGRATED_COMPANY_HELP_TEXTS } from './modal-select/core/options/company';
export const MODAL_SELECT_COMPANY_HELP_TEXTS = MIGRATED_COMPANY_HELP_TEXTS;

// ====================================================================
// UTILITY FUNCTIONS
// ====================================================================

export function getSelectStyles(theme: keyof typeof MODAL_SELECT_STYLES = 'DXF_TECHNICAL') {
  return MODAL_SELECT_STYLES[theme];
}

export function getSelectItemPattern(pattern: keyof typeof MODAL_SELECT_ITEM_PATTERNS) {
  return MODAL_SELECT_ITEM_PATTERNS[pattern];
}

export function getSelectPlaceholder(context: keyof typeof MODAL_SELECT_PLACEHOLDERS) {
  return MODAL_SELECT_PLACEHOLDERS[context];
}

// Status label getters
export function getProjectStatusLabels() {
  return MODAL_SELECT_PROJECT_STATUS_LABELS;
}

export function getUnitStatusLabels() {
  return MODAL_SELECT_UNIT_STATUS_LABELS;
}

export function getContactStatusLabels() {
  return MODAL_SELECT_CONTACT_STATUS_LABELS;
}

export function getContactTypeLabels() {
  return MODAL_SELECT_CONTACT_TYPE_LABELS;
}

export function getPropertyMarketStatusLabels() {
  return MODAL_SELECT_PROPERTY_MARKET_STATUS_LABELS;
}

export function getRentalTypeLabels() {
  return MODAL_SELECT_RENTAL_TYPE_LABELS;
}

export function getPropertySpecialStatusLabels() {
  return MODAL_SELECT_PROPERTY_SPECIAL_STATUS_LABELS;
}

export function getStorageStatusLabels() {
  return MODAL_SELECT_STORAGE_STATUS_LABELS;
}

export function getPriorityLabels() {
  return MODAL_SELECT_PRIORITY_LABELS;
}

export function getRecordStateLabels() {
  return MODAL_SELECT_RECORD_STATE_LABELS;
}

export function getEntityTypeLabels() {
  return MODAL_SELECT_ENTITY_TYPE_LABELS;
}

export function getDocumentStatusLabels() {
  return MODAL_SELECT_DOCUMENT_STATUS_LABELS;
}

export function getPropertyTypeLabels() {
  return MODAL_SELECT_PROPERTY_TYPE_LABELS;
}

// Build select trigger classes
export function buildSelectTriggerClass(config: {
  theme?: keyof typeof MODAL_SELECT_STYLES;
  disabled?: boolean;
  error?: boolean;
  additional?: string;
}): string {
  const { theme = 'DXF_TECHNICAL', disabled = false, error = false, additional = '' } = config;

  let baseClass = MODAL_SELECT_STYLES[theme].trigger;

  if (disabled) {
    baseClass += ' opacity-50 cursor-not-allowed pointer-events-none';
  }

  if (error) {
    baseClass += ' border-red-500 focus:border-red-500 focus:ring-red-500';
  }

  if (additional) {
    baseClass += ' ' + additional;
  }

  return baseClass;
}

// Company option getters - Re-exported for convenience
export {
  getLegalFormOptions,
  getGemiStatusOptions,
  getServiceCategoryOptions,
  getLegalStatusOptions,
  getActivityTypeOptions,
  getAddressTypeOptions,
  getShareholderTypeOptions
} from './modal-select/core/options/company';

// Individual option getters - Re-exported for convenience
export {
  getGenderOptions,
  getIdentityTypeOptions,
  getCountryOptions,
  getCurrencyOptions
} from './modal-select/core/options/individual';

// Navigation getters
export function getNavigationLevelTitles() {
  return {
    companies: 'Εταιρείες',
    projects: 'Έργα',
    buildings: 'Κτίρια',
    floors: 'Όροφοι',
    units: 'Μονάδες'
  };
}

export function getNavigationBaseLabels() {
  return {
    add: 'Προσθήκη',
    connect: 'Σύνδεση',
    edit: 'Επεξεργασία',
    remove: 'Αφαίρεση',
    disconnect: 'Αποσύνδεση',
    filters: 'Φίλτρα',
    favorites: 'Αγαπημένα',
    archive: 'Αρχείο',
    export: 'Εξαγωγή',
    import: 'Εισαγωγή',
    refresh: 'Ανανέωση',
    preview: 'Προεπισκόπηση',
    copy: 'Αντιγραφή',
    share: 'Διαμοιρασμός',
    reports: 'Αναφορές',
    settings: 'Ρυθμίσεις',
    favorites_management: 'Διαχείριση Αγαπημένων',
    help: 'Βοήθεια',
    sorting: 'Ταξινόμηση'
  };
}

export function getNavigationSearchPlaceholders() {
  return {
    companies: 'Αναζήτηση εταιρείας...',
    projects: 'Αναζήτηση έργου...',
    buildings: 'Αναζήτηση κτιρίου...',
    floors: 'Αναζήτηση ορόφου...',
    units: 'Αναζήτηση μονάδας...'
  };
}

export function getNavigationTooltips() {
  return {
    add_company: 'Προσθήκη νέας εταιρείας',
    edit_company: 'Επεξεργασία εταιρείας',
    remove_company: 'Αφαίρεση εταιρείας',
    connect_project: 'Σύνδεση έργου με επιλεγμένη εταιρεία',
    edit_project: 'Επεξεργασία έργου',
    disconnect_project: 'Αποσύνδεση έργου'
  };
}

export function getNavigationFilterCategories() {
  return {
    company_type_label: 'Τύπος Εταιρείας',
    company_construction: 'Κατασκευαστική',
    company_development: 'Αναπτυξιακή',
    company_investment: 'Επενδυτική',
    company_management: 'Διαχειριστική'
  };
}

export function getNavigationSortOptions() {
  return MODAL_SELECT_NAVIGATION_SORT_OPTIONS;
}

export function getCompactToolbarSearchPlaceholders() {
  return MODAL_SELECT_COMPACT_TOOLBAR_SEARCH_PLACEHOLDERS;
}

export function getCompactToolbarNewItemLabels() {
  return MODAL_SELECT_COMPACT_TOOLBAR_NEW_ITEM_LABELS;
}

export function getCompactToolbarContextLabels() {
  return MODAL_SELECT_COMPACT_TOOLBAR_CONTEXT_LABELS;
}

export function getCompactToolbarTooltips() {
  return MODAL_SELECT_COMPACT_TOOLBAR_TOOLTIPS;
}

export function getCompactToolbarFilterCategories() {
  return MODAL_SELECT_COMPACT_TOOLBAR_FILTER_CATEGORIES;
}

export function getCompactToolbarSortOptions() {
  return MODAL_SELECT_COMPACT_TOOLBAR_SORT_OPTIONS;
}

export function getNavigationLabels() {
  return MODAL_SELECT_MAIN_NAVIGATION_LABELS;
}

export function getDesktopNavigationHeaders() {
  return {
    companies: 'Εταιρείες',
    projects: 'Έργα',
    buildings: 'Κτίρια',
    floors: 'Όροφοι',
    units: 'Μονάδες'
  };
}

export function getDesktopCounters() {
  return {
    total: 'Σύνολο',
    selected: 'Επιλεγμένα',
    filtered: 'Φιλτραρισμένα'
  };
}

export function getDesktopNavigationActions() {
  return {
    connect: 'Σύνδεση',
    disconnect: 'Αποσύνδεση',
    edit: 'Επεξεργασία',
    delete: 'Διαγραφή',
    view_details: 'Προβολή Λεπτομερειών'
  };
}

export function getDesktopStatusMessages() {
  return {
    loading: 'Φόρτωση...',
    empty: 'Δεν υπάρχουν δεδομένα',
    error: 'Σφάλμα φόρτωσης',
    success: 'Επιτυχής ολοκλήρωση'
  };
}

export function getDesktopConfirmationDialog() {
  return {
    title: 'Επιβεβαίωση Ενέργειας',
    message: 'Είστε βέβαιοι ότι θέλετε να προχωρήσετε;',
    confirmLabel: 'Επιβεβαίωση',
    cancelLabel: 'Ακύρωση'
  };
}

export function getNavigationExtendedLabels() {
  return MODAL_SELECT_MAIN_NAVIGATION_LABELS;
}

// ====================================================================
// BACKWARD COMPATIBILITY RE-EXPORTS
// ====================================================================

export { getActionButtons } from './modal-select/toolbar/configurations';

export {
  getBuildingTabLabels,
  getContactTabLabels,
  getProjectTabLabels,
  getCRMDashboardTabLabels,
  getUnitsTabLabels,
  getStorageTabLabels
} from './modal-select/core/labels/tabs';

export {
  getDocumentTypeOptions,
  getBoardTypeOptions,
  getRepresentativePositionOptions,
  getPropertyTypeOptions,
  getUnitFilterOptions
} from './modal-select/utils/accessors';