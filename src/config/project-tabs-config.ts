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
  // 1.5. ΤΟΠΟΘΕΣΙΕΣ & ΔΙΕΥΘΥΝΣΕΙΣ - 🏢 ENTERPRISE: Multi-address support (ADR-167)
  // -------------------------------------------------------------------------
  {
    id: 'locations',
    label: 'Τοποθεσίες & Διευθύνσεις',
    value: 'locations',
    icon: 'map-pin',
    description: 'Διαχείριση διευθύνσεων και τοποθεσιών του έργου',
    order: 1.5,
    enabled: true,
    component: 'ProjectLocationsTab',
  },

  // -------------------------------------------------------------------------
  // 2. ΚΑΤΟΨΗ ΕΡΓΟΥ - 🏢 ENTERPRISE: Uses centralized file storage (ADR-033)
  // -------------------------------------------------------------------------
  {
    id: 'floorplan',
    label: PROJECT_TAB_LABELS.FLOORPLAN,
    value: 'floorplan',
    icon: 'ruler',
    description: PROJECT_TAB_DESCRIPTIONS.FLOORPLAN,
    order: 2,
    enabled: true,
    component: 'ProjectFloorplanTab',
    componentProps: {
      title: PROJECT_COMPONENT_LABELS.FLOORPLAN_TITLE,
      floorplanType: 'project'
    }
  },

  // -------------------------------------------------------------------------
  // 3. ΚΑΤΟΨΗ ΘΕΣΕΩΝ ΣΤΑΘΜΕΥΣΗΣ - 🏢 ENTERPRISE: Uses centralized file storage (ADR-033)
  // -------------------------------------------------------------------------
  {
    id: 'parking-floorplan',
    label: PROJECT_TAB_LABELS.PARKING_FLOORPLAN,
    value: 'parking-floorplan',
    icon: 'car',
    description: PROJECT_TAB_DESCRIPTIONS.PARKING_FLOORPLAN,
    order: 3,
    enabled: true,
    component: 'ProjectFloorplanTab',
    componentProps: {
      title: PROJECT_COMPONENT_LABELS.PARKING_FLOORPLAN_TITLE,
      floorplanType: 'parking'
    }
  },

  // -------------------------------------------------------------------------
  // 4. ΔΟΜΗ ΕΡΓΟΥ
  // -------------------------------------------------------------------------
  {
    id: 'structure',
    label: PROJECT_TAB_LABELS.STRUCTURE,
    value: 'structure',
    icon: 'building',
    description: PROJECT_TAB_DESCRIPTIONS.STRUCTURE,
    order: 4,
    enabled: true,
    component: 'ProjectStructureTab',
  },

  // -------------------------------------------------------------------------
  // 5. TIMELINE
  // -------------------------------------------------------------------------
  {
    id: 'timeline',
    label: PROJECT_TAB_LABELS.TIMELINE,
    value: 'timeline',
    icon: 'calendar',
    description: PROJECT_TAB_DESCRIPTIONS.TIMELINE,
    order: 5,
    enabled: true,
    component: 'ProjectTimelineTab',
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

  // -------------------------------------------------------------------------
  // 7. ΣΤΟΙΧΕΙΑ ΔΟΜΗΣΗΣ
  // -------------------------------------------------------------------------
  {
    id: 'building-data',
    label: PROJECT_TAB_LABELS.BUILDING_DATA,
    value: 'building-data',
    icon: 'bar-chart',
    description: PROJECT_TAB_DESCRIPTIONS.BUILDING_DATA,
    order: 7,
    enabled: true,
    component: 'BuildingDataTab',
  },

  // -------------------------------------------------------------------------
  // 8. ΘΕΣΕΙΣ ΣΤΑΘΜΕΥΣΗΣ
  // -------------------------------------------------------------------------
  {
    id: 'parking',
    label: PROJECT_TAB_LABELS.PARKING,
    value: 'parking',
    icon: 'car',
    description: PROJECT_TAB_DESCRIPTIONS.PARKING,
    order: 8,
    enabled: true,
    component: 'ParkingTab',
  },

  // -------------------------------------------------------------------------
  // 9. ΣΥΝΤΕΛΕΣΤΕΣ
  // -------------------------------------------------------------------------
  {
    id: 'contributors',
    label: PROJECT_TAB_LABELS.CONTRIBUTORS,
    value: 'contributors',
    icon: 'handshake',
    description: PROJECT_TAB_DESCRIPTIONS.CONTRIBUTORS,
    order: 9,
    enabled: true,
    component: 'ContributorsTab',
  },

  // -------------------------------------------------------------------------
  // 10. ΕΓΓΡΑΦΑ ΕΡΓΟΥ
  // -------------------------------------------------------------------------
  {
    id: 'documents',
    label: PROJECT_TAB_LABELS.DOCUMENTS,
    value: 'documents',
    icon: 'file-text',
    description: PROJECT_TAB_DESCRIPTIONS.DOCUMENTS,
    order: 10,
    enabled: true,
    component: 'DocumentsProjectTab',
  },

  // -------------------------------------------------------------------------
  // 11. ΙΚΑ
  // -------------------------------------------------------------------------
  {
    id: 'ika',
    label: PROJECT_TAB_LABELS.IKA,
    value: 'ika',
    icon: 'landmark',
    description: PROJECT_TAB_DESCRIPTIONS.IKA,
    order: 11,
    enabled: true,
    component: 'IkaTab',
  },

  // -------------------------------------------------------------------------
  // 12. ΦΩΤΟΓΡΑΦΙΕΣ
  // -------------------------------------------------------------------------
  {
    id: 'photos',
    label: PROJECT_TAB_LABELS.PHOTOS,
    value: 'photos',
    icon: 'camera',
    description: PROJECT_TAB_DESCRIPTIONS.PHOTOS,
    order: 12,
    enabled: true,
    component: 'PhotosTab',
  },

  // -------------------------------------------------------------------------
  // 13. ΒΙΝΤΕΟ
  // -------------------------------------------------------------------------
  {
    id: 'videos',
    label: PROJECT_TAB_LABELS.VIDEOS,
    value: 'videos',
    icon: 'video',
    description: PROJECT_TAB_DESCRIPTIONS.VIDEOS,
    order: 13,
    enabled: true,
    component: 'VideosTab',
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
