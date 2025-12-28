/**
 * @fileoverview Navigation Labels Module
 * @description Extracted from modal-select.ts - NAVIGATION LABELS
 * @author Claude (Anthropic AI)
 * @date 2025-12-28
 * @version 1.0.0 - ENTERPRISE MODULAR ARCHITECTURE
 * @compliance CLAUDE.md Enterprise Standards - MODULAR SPLITTING
 */

// ====================================================================
// NAVIGATION LABELS - 🏢 ENTERPRISE CENTRALIZED
// ====================================================================

/**
 * Navigation Level Titles - Centralized από NavigationCardToolbar.tsx
 * ✅ ENTERPRISE: Single source of truth για όλους τους navigation level titles
 */
export const MODAL_SELECT_NAVIGATION_LEVEL_TITLES = {
  companies: 'Εταιρείες',
  projects: 'Έργα',
  buildings: 'Κτίρια',
  floors: 'Όροφοι',
  units: 'Μονάδες'
} as const;

/**
 * Navigation Base Labels - Centralized από NavigationCardToolbar.tsx
 * ✅ ENTERPRISE: Single source of truth για όλα τα base navigation labels
 */
export const MODAL_SELECT_NAVIGATION_BASE_LABELS = {
  // Action Labels
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
  sorting: 'Ταξινόμηση',

  // Tooltip Labels
  filtering: 'Φιλτράρισμα',
  archiving: 'Αρχειοθέτηση',
  export_data: 'Εξαγωγή δεδομένων',
  import_data: 'Εισαγωγή δεδομένων',
  refresh_data: 'Ανανέωση δεδομένων'
} as const;

/**
 * Navigation Search Placeholders - Centralized από NavigationCardToolbar.tsx
 * ✅ ENTERPRISE: Single source of truth για όλα τα search placeholders
 */
export const MODAL_SELECT_NAVIGATION_SEARCH_PLACEHOLDERS = {
  companies: 'Αναζήτηση εταιρείας...',
  projects: 'Αναζήτηση έργου...',
  buildings: 'Αναζήτηση κτιρίου...',
  floors: 'Αναζήτηση ορόφου...',
  units: 'Αναζήτηση μονάδας...'
} as const;

/**
 * Navigation Tooltip Labels - Centralized από NavigationCardToolbar.tsx
 * ✅ ENTERPRISE: Single source of truth για όλα τα navigation tooltips
 */
export const MODAL_SELECT_NAVIGATION_TOOLTIPS = {
  // Companies Tooltips
  add_company: 'Προσθήκη νέας εταιρείας',
  edit_company: 'Επεξεργασία εταιρείας',
  remove_company: 'Αφαίρεση εταιρείας',

  // Projects Tooltips
  connect_project: 'Σύνδεση έργου με επιλεγμένη εταιρεία',
  edit_project: 'Επεξεργασία έργου',
  disconnect_project: 'Αποσύνδεση έργου',

  // Buildings Tooltips
  connect_building: 'Σύνδεση κτιρίου με επιλεγμένο έργο',
  edit_building: 'Επεξεργασία κτιρίου',
  disconnect_building: 'Αποσύνδεση κτιρίου',

  // Floors Tooltips
  connect_floor: 'Σύνδεση ορόφου με επιλεγμένο κτίριο',
  edit_floor: 'Επεξεργασία ορόφου',
  disconnect_floor: 'Αποσύνδεση ορόφου',

  // Units Tooltips
  connect_unit: 'Σύνδεση μονάδας με επιλεγμένο όροφο',
  edit_unit: 'Επεξεργασία μονάδας',
  disconnect_unit: 'Αποσύνδεση μονάδας'
} as const;

/**
 * Navigation Filter Categories - Centralized από NavigationCardToolbar.tsx
 * ✅ ENTERPRISE: Single source of truth για όλες τις filter κατηγορίες
 */
export const MODAL_SELECT_NAVIGATION_FILTER_CATEGORIES = {
  // Companies Filters
  company_type_label: 'Τύπος Εταιρείας',
  company_construction: 'Κατασκευαστική',
  company_development: 'Αναπτυξιακή',
  company_investment: 'Επενδυτική',
  company_management: 'Διαχειριστική',
  company_status_label: 'Κατάσταση',
  company_active: 'Ενεργές',
  company_with_projects: 'Με έργα',
  company_without_projects: 'Χωρίς έργα',

  // Projects Filters
  project_status_label: 'Κατάσταση Έργου',
  project_planning: 'Σχεδίαση',
  project_construction: 'Κατασκευή',
  project_completed: 'Ολοκληρωμένα',
  project_on_hold: 'Αναστολή',
  project_type_label: 'Τύπος Έργου',
  project_residential: 'Κατοικίες',
  project_commercial: 'Εμπορικά',
  project_mixed: 'Μεικτά',

  // Buildings Filters
  building_type_label: 'Τύπος Κτιρίου',
  building_residential: 'Κατοικίες',
  building_commercial: 'Εμπορικό',
  building_office: 'Γραφεία',
  building_mixed: 'Μεικτό',
  building_floors_label: 'Αριθμός Ορόφων',
  building_floors_1_3: '1-3 όροφοι',
  building_floors_4_6: '4-6 όροφοι',
  building_floors_7_plus: '7+ όροφοι',

  // Floors Filters
  floor_type_label: 'Τύπος Ορόφου',
  floor_basement: 'Υπόγειο',
  floor_ground: 'Ισόγειο',
  floor_floor: 'Όροφος',
  floor_penthouse: 'Ρετιρέ',
  floor_units_label: 'Αριθμός Μονάδων',
  floor_units_1_2: '1-2 μονάδες',
  floor_units_3_5: '3-5 μονάδες',
  floor_units_6_plus: '6+ μονάδες',

  // Units Filters
  unit_type_label: 'Τύπος Μονάδας',
  unit_apartment: 'Διαμέρισμα',
  unit_office: 'Γραφείο',
  unit_shop: 'Κατάστημα',
  unit_storage: 'Αποθήκη',
  unit_parking: 'Θέση Στάθμευσης',
  unit_status_label: 'Κατάσταση',
  unit_available: 'Διαθέσιμη',
  unit_occupied: 'Κατειλημμένη',
  unit_reserved: 'Κρατημένη',
  unit_maintenance: 'Συντήρηση',
  unit_rooms_label: 'Αριθμός Δωματίων',
  unit_1_room: '1 δωμάτιο',
  unit_2_rooms: '2 δωμάτια',
  unit_3_rooms: '3 δωμάτια',
  unit_4_plus_rooms: '4+ δωμάτια'
} as const;

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

  // Share Tooltips
  share_building: 'Κοινοποίηση κτιρίου',
  share_project: 'Κοινοποίηση έργου',
  share_contact: 'Κοινοποίηση επαφής',

  // Delete Tooltips
  delete_building: 'Διαγραφή επιλεγμένου',
  delete_project: 'Διαγραφή επιλεγμένου έργου',
  delete_contact: 'Διαγραφή επιλεγμένης επαφής',

  // Management Tooltips
  manage_favorites: 'Διαχείριση αγαπημένων στοιχείων',
  bulk_actions: 'Μαζικές ενέργειες για επιλεγμένα στοιχεία'
} as const;

// ====================================================================
// ACCESSOR FUNCTIONS - 🏢 ENTERPRISE CENTRALIZED
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
 * Get compact toolbar detailed tooltips
 * ✅ CENTRALIZED: Getter function για compact toolbar detailed tooltips
 */
export function getCompactToolbarTooltips() {
  return MODAL_SELECT_COMPACT_TOOLBAR_TOOLTIPS;
}