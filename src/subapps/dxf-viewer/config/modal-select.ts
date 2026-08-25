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

import { PANEL_LAYOUT } from './panel-tokens';
// 🏢 ENTERPRISE: Import centralized building features registry
import {
  BUILDING_FEATURES,
  BUILDING_FEATURE_KEYS,
  getBuildingFeaturesForUI,
  type BuildingFeatureKey,
} from '@/types/building/features';

// ====================================================================
// MODULAR SYSTEM RE-EXPORTS - BACKWARD COMPATIBILITY
// ====================================================================

// Styles & Patterns
import { MODAL_SELECT_STYLES as MIGRATED_MODAL_SELECT_STYLES } from './modal-select/core/styles/select-styles';
export const MODAL_SELECT_STYLES = MIGRATED_MODAL_SELECT_STYLES;

import { MODAL_SELECT_ITEM_PATTERNS as MIGRATED_MODAL_SELECT_ITEM_PATTERNS } from './modal-select/core/styles/patterns';
export const MODAL_SELECT_ITEM_PATTERNS = MIGRATED_MODAL_SELECT_ITEM_PATTERNS;

// Encoding Options
import { MODAL_SELECT_ENCODING_OPTIONS as MIGRATED_ENCODING_OPTIONS } from './modal-select/core/options/encoding';
export const MODAL_SELECT_ENCODING_OPTIONS = MIGRATED_ENCODING_OPTIONS;

import { MODAL_SELECT_BOOLEAN_OPTIONS as MIGRATED_BOOLEAN_OPTIONS } from './modal-select/core/options/encoding';
export const MODAL_SELECT_BOOLEAN_OPTIONS = MIGRATED_BOOLEAN_OPTIONS;

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
    baseClass += ` ${PANEL_LAYOUT.OPACITY['50']} ${PANEL_LAYOUT.CURSOR.NOT_ALLOWED} ${PANEL_LAYOUT.POINTER_EVENTS.NONE}`;
  }

  if (error) {
    baseClass += ' border-destructive focus:border-destructive focus:ring-destructive';
  }

  if (additional) {
    baseClass += ' ' + additional;
  }

  return baseClass;
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

export function getNavigationExtendedLabels() {
  return MODAL_SELECT_MAIN_NAVIGATION_LABELS;
}

// Function exports που λείπουν
export function getBooleanOptions() {
  return MODAL_SELECT_BOOLEAN_OPTIONS;
}

export function getEncodingOptions() {
  return MODAL_SELECT_ENCODING_OPTIONS;
}

// ====================================================================
// BUILDING DATA EXPORTS - ENTERPRISE DATABASE POPULATION
// ====================================================================

/**
 * 🏢 ENTERPRISE: Building Features - Re-export from centralized registry
 * Returns array of { key, i18nKey } for UI rendering.
 *
 * @returns Array of building feature definitions with keys and i18n paths
 */
export function getBuildingFeatures(): Array<{ key: BuildingFeatureKey; i18nKey: string }> {
  return getBuildingFeaturesForUI();
}

/**
 * 🏢 ENTERPRISE: Get all valid building feature keys.
 * Use this for validation and DB operations.
 */
export function getBuildingFeatureKeys(): readonly BuildingFeatureKey[] {
  return BUILDING_FEATURE_KEYS;
}

/**
 * 🏢 ENTERPRISE: Re-export types and constants for consumers
 */
export { BUILDING_FEATURES, BUILDING_FEATURE_KEYS, type BuildingFeatureKey };

/**
 * Building Descriptions - Centralized building descriptions
 */
export function getBuildingDescriptions() {
  return {
    luxury_apartments_main: 'Πολυτελή Διαμερίσματα',
    commercial_building_shops: 'Εμπορικό Κτίριο με Καταστήματα',
    underground_parking: 'Υπόγειο Πάρκινγκ',
    main_factory_building: 'Κύριο Εργοστασιακό Κτίριο',
    warehouse_building: 'Κτίριο Αποθήκευσης',
    administration_building: 'Κτίριο Διοίκησης',
    commercial_building_main: 'Κύριο Εμπορικό Κτίριο',
    parking_tower: 'Πύργος Στάθμευσης'
  } as const;
}

/**
 * Building Technical Terms - Centralized technical terminology
 */
export function getBuildingTechnicalTerms() {
  return {
    industrial_area_thermi: 'Βιομηχανική Περιοχή Θέρμης',
    avenue_megalou_alexandrou: 'Λεωφόρος Μεγάλου Αλεξάνδρου',
    industrial_zone: 'Βιομηχανική Ζώνη',
    commercial_zone: 'Εμπορική Ζώνη',
    residential_zone: 'Οικιστική Ζώνη',
    reinforced_concrete: 'Οπλισμένο Σκυρόδεμα',
    energy_class_a_plus_label: 'Ενεργειακή Κλάση Α+',
    energy_class_a_label: 'Ενεργειακή Κλάση Α',
    seismic_zone_2: 'Σεισμική Ζώνη ΙΙ'
  } as const;
}