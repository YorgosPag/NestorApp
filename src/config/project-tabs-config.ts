/**
 * ============================================================================
 * 🏗️ PROJECT TABS CONFIGURATION
 * ============================================================================
 *
 * Single Source of Truth για όλα τα project tabs
 * Centralized config που χρησιμοποιείται από:
 * - ProjectDetails (tab rendering)
 * - Edit forms (future)
 * - Any other project-related components
 *
 * Architecture: Config-driven με Generic Components
 * Pattern: Single Source of Truth
 *
 * ✅ ENTERPRISE: Using centralized project tab labels - ZERO HARDCODED VALUES
 */

// 🏢 ENTERPRISE: Import centralized project tab labels - ZERO HARDCODED VALUES
import {
  PROJECT_TAB_LABELS,
  PROJECT_TAB_DESCRIPTIONS,
  PROJECT_COMPONENT_LABELS
} from '@/constants/property-statuses-enterprise';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface ProjectTabConfig {
  /** Unique tab identifier */
  id: string;
  /** Display label */
  label: string;
  /** Tab value for Tabs component */
  value: string;
  /** Tab icon (emoji) */
  icon: string;
  /** Tab description */
  description?: string;
  /** Display order */
  order: number;
  /** Whether tab is enabled by default */
  enabled?: boolean;
  /** Component to render for this tab */
  component: string;
  /** Any additional props for the component */
  componentProps?: Record<string, unknown>;
}

// ============================================================================
// PROJECT TABS CONFIGURATION
// ============================================================================

export const PROJECT_TABS: ProjectTabConfig[] = [
  // =========================================================================
  // ΤΑΥΤΟΤΗΤΑ — Τι είναι αυτό το Έργο
  // =========================================================================

  // -------------------------------------------------------------------------
  // 1. ΓΕΝΙΚΑ ΕΡΓΟΥ
  // -------------------------------------------------------------------------
  {
    id: 'general',
    label: PROJECT_TAB_LABELS.GENERAL,
    value: 'general',
    icon: 'construction',
    description: PROJECT_TAB_DESCRIPTIONS.GENERAL,
    order: 1,
    enabled: true,
    component: 'GeneralProjectTab',
  },

  // -------------------------------------------------------------------------
  // 2. ΔΙΕΥΘΥΝΣΕΙΣ (ADR-167)
  // -------------------------------------------------------------------------
  {
    id: 'locations',
    label: 'Διευθύνσεις',
    value: 'locations',
    icon: 'map-pin',
    description: 'Διαχείριση διευθύνσεων του έργου',
    order: 2,
    enabled: true,
    component: 'ProjectLocationsTab',
  },

  // =========================================================================
  // ΔΟΜΗ — Τι περιέχει το Έργο
  // =========================================================================

  // -------------------------------------------------------------------------
  // 3. ΔΟΜΗ ΕΡΓΟΥ (Κτίρια → Μονάδες/Αποθήκες/Parking)
  // -------------------------------------------------------------------------
  {
    id: 'structure',
    label: PROJECT_TAB_LABELS.STRUCTURE,
    value: 'structure',
    icon: 'building',
    description: PROJECT_TAB_DESCRIPTIONS.STRUCTURE,
    order: 3,
    enabled: true,
    component: 'ProjectStructureTab',
  },

  // =========================================================================
  // ΑΝΘΡΩΠΟΙ — Ποιος εμπλέκεται
  // =========================================================================

  // -------------------------------------------------------------------------
  // 4. ΣΥΝΕΡΓΑΤΕΣ & ΕΠΑΦΕΣ (αντικατέστησε τον stub ContributorsTab)
  // -------------------------------------------------------------------------
  {
    id: 'contributors',
    label: PROJECT_TAB_LABELS.CONTRIBUTORS,
    value: 'contributors',
    icon: 'handshake',
    description: PROJECT_TAB_DESCRIPTIONS.CONTRIBUTORS,
    order: 4,
    enabled: true,
    component: 'ProjectAssociationsTab',
  },

  // -------------------------------------------------------------------------
  // 5. ΜΕΣΙΤΕΣ (ADR-230 / SPEC-230B)
  // -------------------------------------------------------------------------
  {
    id: 'brokers',
    label: PROJECT_TAB_LABELS.BROKERS,
    value: 'brokers',
    icon: 'briefcase',
    description: PROJECT_TAB_DESCRIPTIONS.BROKERS,
    order: 5,
    enabled: true,
    component: 'ProjectBrokersTab',
  },

  // -------------------------------------------------------------------------
  // 6. ΠΕΛΑΤΕΣ
  // -------------------------------------------------------------------------
  {
    id: 'customers',
    label: PROJECT_TAB_LABELS.CUSTOMERS,
    value: 'customers',
    icon: 'users',
    description: PROJECT_TAB_DESCRIPTIONS.CUSTOMERS,
    order: 6,
    enabled: true,
    component: 'ProjectCustomersTab',
  },

  // =========================================================================
  // ΕΡΓΑΣΙΑ — Τι γίνεται / Χρονοδιάγραμμα
  // =========================================================================

  // -------------------------------------------------------------------------
  // 7. TIMELINE
  // -------------------------------------------------------------------------
  {
    id: 'timeline',
    label: PROJECT_TAB_LABELS.TIMELINE,
    value: 'timeline',
    icon: 'calendar',
    description: PROJECT_TAB_DESCRIPTIONS.TIMELINE,
    order: 7,
    enabled: true,
    component: 'ProjectTimelineTab',
  },

  // -------------------------------------------------------------------------
  // 8. ΙΚΑ
  // -------------------------------------------------------------------------
  {
    id: 'ika',
    label: PROJECT_TAB_LABELS.IKA,
    value: 'ika',
    icon: 'landmark',
    description: PROJECT_TAB_DESCRIPTIONS.IKA,
    order: 8,
    enabled: true,
    component: 'IkaTab',
  },

  // =========================================================================
  // ΑΡΧΕΙΑ — Τεκμηρίωση & Media
  // =========================================================================

  // -------------------------------------------------------------------------
  // 9. ΚΑΤΟΨΗ ΕΡΓΟΥ (ADR-033)
  // -------------------------------------------------------------------------
  {
    id: 'floorplan',
    label: PROJECT_TAB_LABELS.FLOORPLAN,
    value: 'floorplan',
    icon: 'ruler',
    description: PROJECT_TAB_DESCRIPTIONS.FLOORPLAN,
    order: 9,
    enabled: true,
    component: 'ProjectFloorplanTab',
    componentProps: {
      title: PROJECT_COMPONENT_LABELS.FLOORPLAN_TITLE,
      floorplanType: 'project'
    }
  },

  // -------------------------------------------------------------------------
  // 10. ΘΕΣΕΙΣ ΣΤΑΘΜΕΥΣΗΣ — Κατόψεις + Λίστα (ADR-191)
  // -------------------------------------------------------------------------
  {
    id: 'parking-floorplan',
    label: PROJECT_TAB_LABELS.PARKING_FLOORPLAN,
    value: 'parking-floorplan',
    icon: 'car',
    description: PROJECT_TAB_DESCRIPTIONS.PARKING_FLOORPLAN,
    order: 10,
    enabled: true,
    component: 'ProjectParkingTab',
    componentProps: {
      title: PROJECT_COMPONENT_LABELS.PARKING_FLOORPLAN_TITLE,
      floorplanType: 'parking'
    }
  },

  // -------------------------------------------------------------------------
  // 11. ΕΠΙΜΕΤΡΗΣΕΙΣ ΕΡΓΟΥ (Aggregation — read-only, data entry at building level)
  // -------------------------------------------------------------------------
  {
    id: 'measurements',
    label: 'tabs.labels.measurements',
    value: 'measurements',
    icon: 'ruler',
    description: 'Συγκεντρωτικές επιμετρήσεις από όλα τα κτίρια του έργου',
    order: 11,
    enabled: true,
    component: 'ProjectMeasurementsTab',
  },

  // -------------------------------------------------------------------------
  // 12. ΕΓΓΡΑΦΑ ΕΡΓΟΥ
  // -------------------------------------------------------------------------
  {
    id: 'documents',
    label: PROJECT_TAB_LABELS.DOCUMENTS,
    value: 'documents',
    icon: 'file-text',
    description: PROJECT_TAB_DESCRIPTIONS.DOCUMENTS,
    order: 12,
    enabled: true,
    component: 'DocumentsProjectTab',
  },

  // -------------------------------------------------------------------------
  // 13. ΦΩΤΟΓΡΑΦΙΕΣ
  // -------------------------------------------------------------------------
  {
    id: 'photos',
    label: PROJECT_TAB_LABELS.PHOTOS,
    value: 'photos',
    icon: 'camera',
    description: PROJECT_TAB_DESCRIPTIONS.PHOTOS,
    order: 13,
    enabled: true,
    component: 'PhotosTab',
  },

  // -------------------------------------------------------------------------
  // 14. ΒΙΝΤΕΟ
  // -------------------------------------------------------------------------
  {
    id: 'videos',
    label: PROJECT_TAB_LABELS.VIDEOS,
    value: 'videos',
    icon: 'video',
    description: PROJECT_TAB_DESCRIPTIONS.VIDEOS,
    order: 14,
    enabled: true,
    component: 'VideosTab',
  },

  // =========================================================================
  // ΕΛΕΓΧΟΣ — Audit & History
  // =========================================================================

  // -------------------------------------------------------------------------
  // 15. ΙΣΤΟΡΙΚΟ ΑΛΛΑΓΩΝ (ADR-195)
  // -------------------------------------------------------------------------
  {
    id: 'history',
    label: PROJECT_TAB_LABELS.HISTORY,
    value: 'history',
    icon: 'clock',
    description: PROJECT_TAB_DESCRIPTIONS.HISTORY,
    order: 15,
    enabled: true,
    component: 'ActivityTab',
    componentProps: {
      entityType: 'project',
    },
  },

  // =========================================================================
  // ΠΑΓΩΜΕΝΑ — Disabled tabs (κρυφά, ενεργοποίηση μελλοντικά)
  // =========================================================================

  // -------------------------------------------------------------------------
  // ΣΤΟΙΧΕΙΑ ΔΟΜΗΣΗΣ — ΠΑΓΩΜΕΝΟ (2026-03-07)
  // Ο Γιώργος ζήτησε να μην εμφανίζεται.
  // Για επανενεργοποίηση: enabled: true
  // -------------------------------------------------------------------------
  {
    id: 'building-data',
    label: PROJECT_TAB_LABELS.BUILDING_DATA,
    value: 'building-data',
    icon: 'bar-chart',
    description: PROJECT_TAB_DESCRIPTIONS.BUILDING_DATA,
    order: 99,
    enabled: false,
    component: 'BuildingDataTab',
  },
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get all tabs sorted by order
 */
export function getSortedProjectTabs(): ProjectTabConfig[] {
  return [...PROJECT_TABS].sort((a, b) => a.order - b.order);
}

/**
 * Get enabled tabs only, sorted by order
 */
export function getEnabledProjectTabs(): ProjectTabConfig[] {
  return getSortedProjectTabs().filter(tab => tab.enabled !== false);
}

/**
 * Get specific tab by ID
 */
export function getProjectTab(tabId: string): ProjectTabConfig | undefined {
  return PROJECT_TABS.find(tab => tab.id === tabId);
}

/**
 * Get tab by value
 */
export function getProjectTabByValue(value: string): ProjectTabConfig | undefined {
  return PROJECT_TABS.find(tab => tab.value === value);
}

/**
 * Get tabs by component name
 */
export function getProjectTabsByComponent(componentName: string): ProjectTabConfig[] {
  return PROJECT_TABS.filter(tab => tab.component === componentName);
}

/**
 * Check if tab is enabled
 */
export function isProjectTabEnabled(tabId: string): boolean {
  const tab = getProjectTab(tabId);
  return tab ? tab.enabled !== false : false;
}

/**
 * Get tabs count
 */
export function getProjectTabsCount(): number {
  return PROJECT_TABS.length;
}

/**
 * Get enabled tabs count
 */
export function getEnabledProjectTabsCount(): number {
  return getEnabledProjectTabs().length;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  PROJECT_TABS,
  getSortedProjectTabs,
  getEnabledProjectTabs,
  getProjectTab,
  getProjectTabByValue,
  getProjectTabsByComponent,
  isProjectTabEnabled,
  getProjectTabsCount,
  getEnabledProjectTabsCount,
};
