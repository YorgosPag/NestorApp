/**
 * @fileoverview Tab Labels Module
 * @description Extracted from modal-select.ts - TAB LABELS
 * @author Claude (Anthropic AI)
 * @date 2025-12-28
 * @version 1.0.0 - ENTERPRISE MODULAR ARCHITECTURE
 * @compliance CLAUDE.md Enterprise Standards - MODULAR SPLITTING
 */

// ====================================================================
// TAB LABELS - 🏢 ENTERPRISE CENTRALIZED
// ====================================================================

/**
 * Building Tab Labels Configuration Type
 * ✅ ENTERPRISE: Type-safe building tab labels
 */
export interface BuildingTabLabelsConfig {
  // Core Sections
  readonly general: string;
  readonly floorplan: string;
  readonly timeline: string;
  readonly analytics: string;
  readonly storage: string;
  readonly contracts: string;
  readonly protocols: string;
  readonly photos: string;
  readonly customers: string;
  readonly videos: string;

  // Legacy Backward Compatibility
  readonly details: string;
  readonly properties: string;
  readonly units: string;
  readonly floors: string;
  readonly amenities: string;
  readonly documents: string;
  readonly notes: string;
  readonly history: string;
}

/**
 * Contact Tab Labels Configuration Type
 * ✅ ENTERPRISE: Type-safe contact tab labels
 */
export interface ContactTabLabelsConfig {
  readonly general: string;
  readonly details: string;
  readonly properties: string;
  readonly units: string;
  readonly buildings: string;
  readonly projects: string;
  readonly documents: string;
  readonly notes: string;
  readonly history: string;
}

/**
 * Project Tab Labels Configuration Type
 * ✅ ENTERPRISE: Type-safe project tab labels
 */
export interface ProjectTabLabelsConfig {
  readonly general: string;
  readonly details: string;
  readonly buildings: string;
  readonly units: string;
  readonly contacts: string;
  readonly documents: string;
  readonly photos: string;
  readonly notes: string;
  readonly history: string;
}

/**
 * CRM Dashboard Tab Labels Configuration Type
 * ✅ ENTERPRISE: Type-safe CRM dashboard tab labels
 */
export interface CRMDashboardTabLabelsConfig {
  readonly dashboard: string;
  readonly leads: string;
  readonly opportunities: string;
  readonly contacts: string;
  readonly companies: string;
  readonly tasks: string;
  readonly reports: string;
  readonly settings: string;
}

/**
 * Units Tab Labels Configuration Type
 * ✅ ENTERPRISE: Type-safe units tab labels (existing function preserved)
 */
export interface UnitsTabLabelsConfig {
  readonly general: string;
  readonly details: string;
  readonly files: string;
  readonly photos: string;
  readonly documents: string;
  readonly notes: string;
  readonly history: string;
  readonly contracts: string;
}

/**
 * Storage Tab Labels Configuration Type
 * ✅ ENTERPRISE: Type-safe storage tab labels (existing function preserved)
 */
export interface StorageTabLabelsConfig {
  readonly general: string;
  readonly details: string;
  readonly units: string;
  readonly documents: string;
  readonly notes: string;
  readonly history: string;
}

// ====================================================================
// TAB LABELS CONSTANTS - 🏢 ENTERPRISE CENTRALIZED
// ====================================================================

/**
 * Building Tab Labels - Centralized για Building detail views
 * ✅ ENTERPRISE: Single source of truth για όλα τα building tab labels
 */
export const MODAL_SELECT_BUILDING_TAB_LABELS: BuildingTabLabelsConfig = {
  // ✅ ENTERPRISE: Πλήρης λίστα building tabs από backup configuration
  general: "Γενικά",
  floorplan: "Κάτοψη Κτιρίου",
  timeline: "Timeline",
  analytics: "Analytics",
  storage: "Αποθήκες",
  contracts: "Συμβόλαια",
  protocols: "Πρωτόκολλα",
  photos: "Φωτογραφίες",
  customers: "Πελάτες",
  videos: "Videos",

  // 🔧 LEGACY: Παλιές ετικέτες για backward compatibility
  details: "Λεπτομέρειες",
  properties: "Ιδιότητες",
  units: "Μονάδες",
  floors: "Όροφοι",
  amenities: "Ανέσεις",
  documents: "Έγγραφα",
  notes: "Σημειώσεις",
  history: "Ιστορικό"
} as const;

/**
 * Contact Tab Labels - Centralized για Contact detail views
 * ✅ ENTERPRISE: Single source of truth για όλα τα contact tab labels
 */
export const MODAL_SELECT_CONTACT_TAB_LABELS: ContactTabLabelsConfig = {
  general: "Γενικά",
  details: "Λεπτομέρειες",
  properties: "Ιδιότητες",
  units: "Μονάδες",
  buildings: "Κτίρια",
  projects: "Έργα",
  documents: "Έγγραφα",
  notes: "Σημειώσεις",
  history: "Ιστορικό"
} as const;

/**
 * Project Tab Labels - Centralized για Project detail views
 * ✅ ENTERPRISE: Single source of truth για όλα τα project tab labels
 */
export const MODAL_SELECT_PROJECT_TAB_LABELS: ProjectTabLabelsConfig = {
  general: "Γενικά",
  details: "Λεπτομέρειες",
  buildings: "Κτίρια",
  units: "Μονάδες",
  contacts: "Επαφές",
  documents: "Έγγραφα",
  photos: "Φωτογραφίες",
  notes: "Σημειώσεις",
  history: "Ιστορικό"
} as const;

/**
 * CRM Dashboard Tab Labels - Centralized για CRM Dashboard views
 * ✅ ENTERPRISE: Single source of truth για όλα τα CRM dashboard tab labels
 */
export const MODAL_SELECT_CRM_DASHBOARD_TAB_LABELS: CRMDashboardTabLabelsConfig = {
  dashboard: "Dashboard",
  leads: "Leads",
  opportunities: "Ευκαιρίες",
  contacts: "Επαφές",
  companies: "Εταιρείες",
  tasks: "Εργασίες",
  reports: "Αναφορές",
  settings: "Ρυθμίσεις"
} as const;

/**
 * Units Tab Labels - Centralized για Units detail views
 * ✅ ENTERPRISE: Single source of truth για όλα τα units tab labels
 */
export const MODAL_SELECT_UNITS_TAB_LABELS: UnitsTabLabelsConfig = {
  general: "Βασικές Πληροφορίες", // Using actual data from original
  details: "Πελάτης",              // Using actual data from original
  files: "Κάτοψη",                 // Using actual data from original
  photos: "Φωτογραφίες",
  documents: "Έγγραφα",
  notes: "Videos",                 // Using actual data from original
  history: "Ιστορικό",
  contracts: "Συμβόλαια"
} as const;

/**
 * Storage Tab Labels - Centralized για Storage detail views
 * ✅ ENTERPRISE: Single source of truth για όλα τα storage tab labels
 */
export const MODAL_SELECT_STORAGE_TAB_LABELS: StorageTabLabelsConfig = {
  general: "Γενικά",
  details: "Στατιστικά",          // Using actual data from original
  units: "Κατόψεις",              // Using actual data from original (floorplans)
  documents: "Έγγραφα",
  notes: "Φωτογραφίες",           // Using actual data from original
  history: "Ιστορικό"             // Using actual data from original (activity)
} as const;

// ====================================================================
// ACCESSOR FUNCTIONS - 🏢 ENTERPRISE CENTRALIZED
// ====================================================================

/**
 * Get building tab labels
 * ✅ CENTRALIZED: Getter function για building tab labels
 */
export function getBuildingTabLabels(): BuildingTabLabelsConfig {
  return MODAL_SELECT_BUILDING_TAB_LABELS;
}

/**
 * Get contact tab labels
 * ✅ CENTRALIZED: Getter function για contact tab labels
 */
export function getContactTabLabels(): ContactTabLabelsConfig {
  return MODAL_SELECT_CONTACT_TAB_LABELS;
}

/**
 * Get project tab labels
 * ✅ CENTRALIZED: Getter function για project tab labels
 */
export function getProjectTabLabels(): ProjectTabLabelsConfig {
  return MODAL_SELECT_PROJECT_TAB_LABELS;
}

/**
 * Get CRM dashboard tab labels
 * ✅ CENTRALIZED: Getter function για CRM dashboard tab labels
 */
export function getCRMDashboardTabLabels(): CRMDashboardTabLabelsConfig {
  return MODAL_SELECT_CRM_DASHBOARD_TAB_LABELS;
}

/**
 * Get units tab labels
 * ✅ CENTRALIZED: Getter function για units tab labels
 */
export function getUnitsTabLabels(): UnitsTabLabelsConfig {
  return MODAL_SELECT_UNITS_TAB_LABELS;
}

/**
 * Get storage tab labels
 * ✅ CENTRALIZED: Getter function για storage tab labels
 */
export function getStorageTabLabels(): StorageTabLabelsConfig {
  return MODAL_SELECT_STORAGE_TAB_LABELS;
}

// ====================================================================
// DOMAIN-SPECIFIC ACCESSORS - 🏢 ENTERPRISE DOMAIN ORGANIZATION
// ====================================================================

/**
 * Get all tab labels by category
 * ✅ CENTRALIZED: Domain-organized access pattern
 */
export function getAllTabLabels() {
  return {
    building: MODAL_SELECT_BUILDING_TAB_LABELS,
    contact: MODAL_SELECT_CONTACT_TAB_LABELS,
    project: MODAL_SELECT_PROJECT_TAB_LABELS,
    crmDashboard: MODAL_SELECT_CRM_DASHBOARD_TAB_LABELS,
    units: MODAL_SELECT_UNITS_TAB_LABELS,
    storage: MODAL_SELECT_STORAGE_TAB_LABELS
  } as const;
}

/**
 * Get common tab labels (appearing across multiple domains)
 * ✅ CENTRALIZED: Cross-cutting concerns accessor
 */
export function getCommonTabLabels() {
  return {
    general: "Γενικά",
    details: "Λεπτομέρειες",
    documents: "Έγγραφα",
    notes: "Σημειώσεις",
    history: "Ιστορικό"
  } as const;
}