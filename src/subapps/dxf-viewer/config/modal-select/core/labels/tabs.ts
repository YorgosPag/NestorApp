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

/**
 * Parking Tab Labels Configuration Type
 * ✅ ENTERPRISE: Type-safe parking tab labels
 */
export interface ParkingTabLabelsConfig {
  readonly general: string;
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
 * 🏢 PATTERN: Direct labels (SAP/Salesforce standard) - i18n at component level
 */
export const MODAL_SELECT_BUILDING_TAB_LABELS: BuildingTabLabelsConfig = {
  // ✅ ENTERPRISE: Direct labels for building tabs
  general: "General",
  floorplan: "Floor Plan",
  timeline: "Timeline",
  analytics: "Analytics",
  storage: "Storages",
  contracts: "Contracts",
  protocols: "Protocols",
  photos: "Photos",
  customers: "Customers",
  videos: "Videos",

  // 🔧 LEGACY: Labels for backward compatibility
  details: "Details",
  properties: "Properties",
  units: "Units",
  floors: "Floors",
  amenities: "Amenities",
  documents: "Documents",
  notes: "Notes",
  history: "History"
} as const;

/**
 * Contact Tab Labels - Centralized για Contact detail views
 * ✅ ENTERPRISE: Single source of truth για όλα τα contact tab labels
 * 🏢 PATTERN: Direct labels (SAP/Salesforce standard)
 */
export const MODAL_SELECT_CONTACT_TAB_LABELS: ContactTabLabelsConfig = {
  general: "General",
  details: "Details",
  properties: "Properties",
  units: "Units",
  buildings: "Buildings",
  projects: "Projects",
  documents: "Documents",
  notes: "Notes",
  history: "History"
} as const;

/**
 * Project Tab Labels - Centralized για Project detail views
 * ✅ ENTERPRISE: Single source of truth για όλα τα project tab labels
 * 🏢 PATTERN: Direct labels (SAP/Salesforce standard)
 */
export const MODAL_SELECT_PROJECT_TAB_LABELS: ProjectTabLabelsConfig = {
  general: "General",
  details: "Details",
  buildings: "Buildings",
  units: "Units",
  contacts: "Contacts",
  documents: "Documents",
  photos: "Photos",
  notes: "Notes",
  history: "History"
} as const;

/**
 * CRM Dashboard Tab Labels - Centralized για CRM Dashboard views
 * ✅ ENTERPRISE: Single source of truth για όλα τα CRM dashboard tab labels
 * 🏢 PATTERN: Direct labels (SAP/Salesforce standard)
 */
export const MODAL_SELECT_CRM_DASHBOARD_TAB_LABELS: CRMDashboardTabLabelsConfig = {
  dashboard: "Dashboard",
  leads: "Leads",
  opportunities: "Opportunities",
  contacts: "Contacts",
  companies: "Companies",
  tasks: "Tasks",
  reports: "Reports",
  settings: "Settings"
} as const;

/**
 * Units Tab Labels - Centralized για Units detail views
 * ✅ ENTERPRISE: Single source of truth για όλα τα units tab labels
 * 🏢 PATTERN: Direct labels (SAP/Salesforce standard)
 */
export const MODAL_SELECT_UNITS_TAB_LABELS: UnitsTabLabelsConfig = {
  general: "Basic Info",
  details: "Customer",
  files: "Floor Plan",
  photos: "Photos",
  documents: "Documents",
  notes: "Videos",
  history: "History",
  contracts: "Contracts"
} as const;

/**
 * Storage Tab Labels - Centralized για Storage detail views
 * ✅ ENTERPRISE: Single source of truth για όλα τα storage tab labels
 * 🏢 PATTERN: Direct labels (SAP/Salesforce standard)
 */
export const MODAL_SELECT_STORAGE_TAB_LABELS: StorageTabLabelsConfig = {
  general: "General",
  details: "Statistics",
  units: "Floor Plans",
  documents: "Documents",
  notes: "Photos",
  history: "History"
} as const;

/**
 * Parking Tab Labels - Centralized για Parking detail views
 * ✅ ENTERPRISE: Single source of truth για όλα τα parking tab labels
 * 🏢 PATTERN: Direct labels (SAP/Salesforce standard)
 */
export const MODAL_SELECT_PARKING_TAB_LABELS: ParkingTabLabelsConfig = {
  general: "General",
  statistics: "Statistics",
  documents: "Documents",
  photos: "Photos",
  history: "History"
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
 * 🏢 PATTERN: Direct labels (SAP/Salesforce standard)
 */
export function getCommonTabLabels() {
  return {
    general: "General",
    details: "Details",
    documents: "Documents",
    notes: "Notes",
    history: "History"
  } as const;
}