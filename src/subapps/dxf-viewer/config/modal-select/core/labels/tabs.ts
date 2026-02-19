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
  readonly parking: string;
  readonly contracts: string;
  readonly protocols: string;
  readonly photos: string;
  readonly customers: string;
  readonly videos: string;
  readonly measurements: string;

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
  readonly banking: string;  // 🏢 ENTERPRISE: Banking accounts tab (2026-02-01)
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
 * 🔧 UPDATED: Keys now match tab IDs from unified-tabs-factory.ts
 */
export interface UnitsTabLabelsConfig {
  // Core unit tabs - matching unified-tabs-factory IDs
  readonly info: string;
  readonly 'floor-plan': string;
  readonly documents: string;
  readonly photos: string;
  readonly videos: string;
  // Legacy keys for backward compatibility
  readonly general: string;
  readonly details: string;
  readonly files: string;
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

/**
 * Parking Tab Labels Configuration Type
 * ✅ ENTERPRISE: Type-safe parking tab labels
 */
export interface ParkingTabLabelsConfig {
  readonly general: string;
  readonly parkingFloorplan: string;
  readonly statistics: string;
  readonly documents: string;
  readonly photos: string;
  readonly history: string;
}

// ====================================================================
// TAB LABELS CONSTANTS - 🏢 ENTERPRISE CENTRALIZED
// ====================================================================

/**
 * Building Tab Labels - Centralized για Building detail views
 * ✅ ENTERPRISE: Single source of truth για όλα τα building tab labels
 * 🏢 PATTERN: i18n keys for translation at component level (UniversalTabsRenderer)
 * 📍 Translations: src/i18n/locales/{lang}/building.json → tabs.labels.*
 */
export const MODAL_SELECT_BUILDING_TAB_LABELS: BuildingTabLabelsConfig = {
  // ✅ ENTERPRISE: i18n keys for building tabs
  general: "tabs.labels.general",
  floorplan: "tabs.labels.floorplan",
  timeline: "tabs.labels.timeline",
  analytics: "tabs.labels.analytics",
  storage: "tabs.labels.storage",
  parking: "tabs.labels.parking",
  contracts: "tabs.labels.contracts",
  protocols: "tabs.labels.protocols",
  photos: "tabs.labels.photos",
  customers: "tabs.labels.customers",
  videos: "tabs.labels.videos",
  measurements: "tabs.labels.measurements",

  // 🔧 LEGACY: i18n keys for backward compatibility
  details: "tabs.labels.details",
  properties: "tabs.labels.properties",
  units: "tabs.labels.units",
  floors: "tabs.labels.floors",
  amenities: "tabs.labels.amenities",
  documents: "tabs.labels.documents",
  notes: "tabs.labels.notes",
  history: "tabs.labels.history"
} as const;

/**
 * Contact Tab Labels - Centralized για Contact detail views
 * ✅ ENTERPRISE: Single source of truth για όλα τα contact tab labels
 * 🏢 PATTERN: i18n keys for translation at component level
 * 📍 Translations: src/i18n/locales/{lang}/building.json → tabs.labels.*
 */
export const MODAL_SELECT_CONTACT_TAB_LABELS: ContactTabLabelsConfig = {
  general: "tabs.labels.general",
  details: "tabs.labels.details",
  properties: "tabs.labels.properties",
  units: "tabs.labels.units",
  buildings: "tabs.labels.buildings",
  projects: "tabs.labels.projects",
  documents: "tabs.labels.documents",
  banking: "tabs.labels.banking",  // 🏢 ENTERPRISE: Banking accounts tab (2026-02-01)
  notes: "tabs.labels.notes",
  history: "tabs.labels.history"
} as const;

/**
 * Project Tab Labels - Centralized για Project detail views
 * ✅ ENTERPRISE: Single source of truth για όλα τα project tab labels
 * 🏢 PATTERN: i18n keys for translation at component level
 * 📍 Translations: src/i18n/locales/{lang}/building.json → tabs.labels.*
 */
export const MODAL_SELECT_PROJECT_TAB_LABELS: ProjectTabLabelsConfig = {
  general: "tabs.labels.general",
  details: "tabs.labels.details",
  buildings: "tabs.labels.buildings",
  units: "tabs.labels.units",
  contacts: "tabs.labels.contacts",
  documents: "tabs.labels.documents",
  photos: "tabs.labels.photos",
  notes: "tabs.labels.notes",
  history: "tabs.labels.history"
} as const;

/**
 * CRM Dashboard Tab Labels - Centralized για CRM Dashboard views
 * ✅ ENTERPRISE: Single source of truth για όλα τα CRM dashboard tab labels
 * 🏢 PATTERN: i18n keys for translation at component level
 * 📍 Translations: src/i18n/locales/{lang}/building.json → tabs.labels.*
 */
export const MODAL_SELECT_CRM_DASHBOARD_TAB_LABELS: CRMDashboardTabLabelsConfig = {
  dashboard: "tabs.labels.dashboard",
  leads: "tabs.labels.leads",
  opportunities: "tabs.labels.opportunities",
  contacts: "tabs.labels.contacts",
  companies: "tabs.labels.companies",
  tasks: "tabs.labels.tasks",
  reports: "tabs.labels.reports",
  settings: "tabs.labels.settings"
} as const;

/**
 * Units Tab Labels - Centralized για Units detail views
 * ✅ ENTERPRISE: Single source of truth για όλα τα units tab labels
 * 🏢 PATTERN: i18n keys for translation at component level
 * 📍 Translations: src/i18n/locales/{lang}/building.json → tabs.labels.*
 * 🔧 UPDATED: Added keys matching unified-tabs-factory tab IDs
 */
export const MODAL_SELECT_UNITS_TAB_LABELS: UnitsTabLabelsConfig = {
  // 🎯 Core unit tabs - matching unified-tabs-factory IDs
  info: "tabs.labels.basicInfo",
  'floor-plan': "tabs.labels.floorplans",
  documents: "tabs.labels.documents",
  photos: "tabs.labels.photos",
  videos: "tabs.labels.videos",
  // 🔧 Legacy keys for backward compatibility
  general: "tabs.labels.basicInfo",
  details: "tabs.labels.customer",
  files: "tabs.labels.floorplans",
  notes: "tabs.labels.videos",
  history: "tabs.labels.history",
  contracts: "tabs.labels.contracts"
} as const;

/**
 * Storage Tab Labels - Centralized για Storage detail views
 * ✅ ENTERPRISE: Single source of truth για όλα τα storage tab labels
 * 🏢 PATTERN: i18n keys for translation at component level
 * 📍 Translations: src/i18n/locales/{lang}/building.json → tabs.labels.*
 */
export const MODAL_SELECT_STORAGE_TAB_LABELS: StorageTabLabelsConfig = {
  general: "tabs.labels.general",
  details: "tabs.labels.statistics",
  units: "tabs.labels.floorplans",
  documents: "tabs.labels.documents",
  notes: "tabs.labels.photos",
  history: "tabs.labels.history"
} as const;

/**
 * Parking Tab Labels - Centralized για Parking detail views
 * ✅ ENTERPRISE: Single source of truth για όλα τα parking tab labels
 * 🏢 PATTERN: i18n keys for translation at component level
 * 📍 Translations: src/i18n/locales/{lang}/building.json → tabs.labels.*
 */
export const MODAL_SELECT_PARKING_TAB_LABELS: ParkingTabLabelsConfig = {
  general: "tabs.labels.general",
  parkingFloorplan: "tabs.labels.parkingFloorplan",
  statistics: "tabs.labels.statistics",
  documents: "tabs.labels.documents",
  photos: "tabs.labels.photos",
  history: "tabs.labels.history"
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

/**
 * Get parking tab labels
 * ✅ CENTRALIZED: Getter function για parking tab labels
 */
export function getParkingTabLabels(): ParkingTabLabelsConfig {
  return MODAL_SELECT_PARKING_TAB_LABELS;
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
    storage: MODAL_SELECT_STORAGE_TAB_LABELS,
    parking: MODAL_SELECT_PARKING_TAB_LABELS
  } as const;
}

/**
 * Get common tab labels (appearing across multiple domains)
 * ✅ CENTRALIZED: Cross-cutting concerns accessor
 * 🏢 PATTERN: i18n keys for translation at component level
 * 📍 Translations: src/i18n/locales/{lang}/building.json → tabs.labels.*
 */
export function getCommonTabLabels() {
  return {
    general: "tabs.labels.general",
    details: "tabs.labels.details",
    documents: "tabs.labels.documents",
    notes: "tabs.labels.notes",
    history: "tabs.labels.history"
  } as const;
}