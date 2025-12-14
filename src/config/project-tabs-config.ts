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
 */

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
  component?: string;
  /** Any additional props for the component */
  componentProps?: Record<string, any>;
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
    label: 'Γενικά Έργου',
    value: 'general',
    icon: 'construction',
    description: 'Βασικές πληροφορίες και στοιχεία του έργου',
    order: 1,
    enabled: true,
    component: 'GeneralProjectTab',
  },

  // -------------------------------------------------------------------------
  // 2. ΚΑΤΟΨΗ ΕΡΓΟΥ
  // -------------------------------------------------------------------------
  {
    id: 'floorplan',
    label: 'Κάτοψη Έργου',
    value: 'floorplan',
    icon: 'ruler',
    description: 'Αρχιτεκτονική κάτοψη και σχέδια του έργου',
    order: 2,
    enabled: true,
    component: 'FloorplanViewerTab',
    componentProps: {
      title: 'Κάτοψη Έργου',
      type: 'project'
    }
  },

  // -------------------------------------------------------------------------
  // 3. ΚΑΤΟΨΗ ΘΕΣΕΩΝ ΣΤΑΘΜΕΥΣΗΣ
  // -------------------------------------------------------------------------
  {
    id: 'parking-floorplan',
    label: 'Κάτοψη Θ.Σ.',
    value: 'parking-floorplan',
    icon: 'car',
    description: 'Κάτοψη και διάταξη θέσεων στάθμευσης',
    order: 3,
    enabled: true,
    component: 'FloorplanViewerTab',
    componentProps: {
      title: 'Κάτοψη Θέσεων Στάθμευσης',
      type: 'parking'
    }
  },

  // -------------------------------------------------------------------------
  // 4. ΔΟΜΗ ΕΡΓΟΥ
  // -------------------------------------------------------------------------
  {
    id: 'structure',
    label: 'Δομή Έργου',
    value: 'structure',
    icon: 'building',
    description: 'Οργανωτική δομή και ιεραρχία του έργου',
    order: 4,
    enabled: true,
    component: 'ProjectStructureTab',
  },

  // -------------------------------------------------------------------------
  // 5. TIMELINE
  // -------------------------------------------------------------------------
  {
    id: 'timeline',
    label: 'Timeline',
    value: 'timeline',
    icon: 'calendar',
    description: 'Χρονοδιάγραμμα και ορόσημα του έργου',
    order: 5,
    enabled: true,
    component: 'ProjectTimelineTab',
  },

  // -------------------------------------------------------------------------
  // 6. ΠΕΛΑΤΕΣ (ENTERPRISE CENTRALIZED)
  // -------------------------------------------------------------------------
  {
    id: 'customers',
    label: 'Πελάτες',
    value: 'customers',
    icon: 'users',
    description: 'Πελάτες και αγοραστές του έργου',
    order: 6,
    enabled: true,
    component: 'ProjectCustomersTable',
  },

  // -------------------------------------------------------------------------
  // 7. ΣΤΟΙΧΕΙΑ ΔΟΜΗΣΗΣ
  // -------------------------------------------------------------------------
  {
    id: 'building-data',
    label: 'Στοιχεία Δόμησης',
    value: 'building-data',
    icon: 'bar-chart',
    description: 'Τεχνικά στοιχεία και παράμετροι δόμησης',
    order: 7,
    enabled: true,
    component: 'BuildingDataTab',
  },

  // -------------------------------------------------------------------------
  // 8. ΘΕΣΕΙΣ ΣΤΑΘΜΕΥΣΗΣ
  // -------------------------------------------------------------------------
  {
    id: 'parking',
    label: 'Θέσεις Στάθμευσης',
    value: 'parking',
    icon: 'car',
    description: 'Διαχείριση και κατανομή θέσεων στάθμευσης',
    order: 8,
    enabled: true,
    component: 'ParkingTab',
  },

  // -------------------------------------------------------------------------
  // 9. ΣΥΝΤΕΛΕΣΤΕΣ
  // -------------------------------------------------------------------------
  {
    id: 'contributors',
    label: 'Συντελεστές',
    value: 'contributors',
    icon: 'handshake',
    description: 'Συντελεστές, εργολάβοι και συνεργάτες',
    order: 9,
    enabled: true,
    component: 'ContributorsTab',
  },

  // -------------------------------------------------------------------------
  // 10. ΕΓΓΡΑΦΑ ΕΡΓΟΥ
  // -------------------------------------------------------------------------
  {
    id: 'documents',
    label: 'Έγγραφα Έργου',
    value: 'documents',
    icon: 'file-text',
    description: 'Συμβάσεις, άδειες και νομικά έγγραφα',
    order: 10,
    enabled: true,
    component: 'DocumentsProjectTab',
  },

  // -------------------------------------------------------------------------
  // 11. ΙΚΑ
  // -------------------------------------------------------------------------
  {
    id: 'ika',
    label: 'IKA',
    value: 'ika',
    icon: 'landmark',
    description: 'Στοιχεία IKA και ασφαλιστικές υποχρεώσεις',
    order: 11,
    enabled: true,
    component: 'IkaTab',
  },

  // -------------------------------------------------------------------------
  // 12. ΦΩΤΟΓΡΑΦΙΕΣ
  // -------------------------------------------------------------------------
  {
    id: 'photos',
    label: 'Φωτογραφίες',
    value: 'photos',
    icon: 'camera',
    description: 'Φωτογραφίες προόδου και ολοκληρωμένου έργου',
    order: 12,
    enabled: true,
    component: 'PhotosTab',
  },

  // -------------------------------------------------------------------------
  // 13. ΒΙΝΤΕΟ
  // -------------------------------------------------------------------------
  {
    id: 'videos',
    label: 'Βίντεο',
    value: 'videos',
    icon: 'video',
    description: 'Βίντεο παρουσίασης και τεκμηρίωσης του έργου',
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