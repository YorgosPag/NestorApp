/**
 * Building Tabs Configuration - Single Source of Truth
 *
 * Enterprise-class centralized configuration για τις καρτέλες κτιρίων.
 * Χρησιμοποιεί το ίδιο architecture pattern με τις καρτέλες επαφών και έργων.
 *
 * @author Claude AI Assistant
 * @created 2024-11-28
 * @version 1.0.0
 */

import { LucideIcon } from 'lucide-react';

// ============================================================================
// INTERFACES & TYPES
// ============================================================================

/**
 * Interface για τη διαμόρφωση μίας καρτέλας κτιρίων
 */
export interface BuildingTabConfig {
  /** Unique identifier για την καρτέλα */
  id: string;

  /** Εμφανιζόμενη ετικέτα */
  label: string;

  /** Τιμή για το Tab value */
  value: string;

  /** Icon για την καρτέλα (emoji string) */
  icon: string;

  /** Περιγραφή της καρτέλας (για documentation) */
  description?: string;

  /** Σειρά εμφάνισης */
  order: number;

  /** Αν η καρτέλα είναι ενεργή */
  enabled: boolean;

  /** Το component που θα render-αρει */
  component: string;

  /** Custom props για το component */
  componentProps?: Record<string, any>;

  /** Permissions required για την καρτέλα */
  requiredPermissions?: string[];

  /** Feature flags */
  featureFlag?: string;

  /** Conditional rendering logic */
  condition?: string;
}

// ============================================================================
// BUILDING TABS CONFIGURATION
// ============================================================================

/**
 * Κεντρική διαμόρφωση όλων των καρτελών κτιρίων
 *
 * ΣΗΜΑΝΤΙΚΟ: Αυτή είναι η ΜΟΝΑΔΙΚΗ πηγή αλήθειας για τις καρτέλες κτιρίων!
 * Οποιαδήποτε αλλαγή στις καρτέλες πρέπει να γίνεται ΕΔΩ και μόνο εδώ.
 */
export const BUILDING_TABS: BuildingTabConfig[] = [
  {
    id: 'general',
    label: 'Γενικά',
    value: 'general',
    icon: 'home',
    description: 'Βασικές πληροφορίες και στοιχεία κτιρίου',
    order: 1,
    enabled: true,
    component: 'GeneralTabContent',
  },
  {
    id: 'floorplan',
    label: 'Κάτοψη Κτιρίου',
    value: 'floorplan',
    icon: 'map',
    description: 'Κάτοψη και διάταξη του κτιρίου',
    order: 2,
    enabled: true,
    component: 'FloorplanViewerTab',
    componentProps: {
      title: 'Κάτοψη Κτιρίου',
      floorplanType: 'building'
    }
  },
  {
    id: 'timeline',
    label: 'Timeline',
    value: 'timeline',
    icon: 'clock',
    description: 'Χρονοδιάγραμμα και ιστορικό κτιρίου',
    order: 3,
    enabled: true,
    component: 'TimelineTabContent',
  },
  {
    id: 'analytics',
    label: 'Analytics',
    value: 'analytics',
    icon: 'trending-up',
    description: 'Αναλυτικά στοιχεία και στατιστικά',
    order: 4,
    enabled: true,
    component: 'AnalyticsTabContent',
  },
  {
    id: 'storage',
    label: 'Αποθήκες',
    value: 'storage',
    icon: 'package',
    description: 'Διαχείριση αποθηκών και αποθεματικών',
    order: 5,
    enabled: true,
    component: 'StorageTab',
  },
  {
    id: 'storage-floorplans',
    label: 'Κατόψεις Αποθηκών',
    value: 'storage-floorplans',
    icon: 'map',
    description: 'Κατόψεις και διάταξη αποθηκών',
    order: 6,
    enabled: true,
    component: 'FloorplanViewerTab',
    componentProps: {
      title: 'Κατόψεις Αποθηκών',
      floorplanType: 'storage'
    }
  },
  {
    id: 'contracts',
    label: 'Συμβόλαια',
    value: 'contracts',
    icon: 'file-text',
    description: 'Συμβόλαια και συμφωνίες πελατών',
    order: 7,
    enabled: true,
    component: 'PlaceholderTab',
    componentProps: {
      title: 'Συμβόλαια Πελατών',
      icon: 'FileText'
    }
  },
  {
    id: 'protocols',
    label: 'Πρωτόκολλα',
    value: 'protocols',
    icon: 'settings',
    description: 'Υ.Δ.Τοιχοποιίας & Πρωτόκολλα',
    order: 8,
    enabled: true,
    component: 'PlaceholderTab',
    componentProps: {
      title: 'Υ.Δ.Τοιχοποιίας & Πρωτόκολλα',
      icon: 'Settings'
    }
  },
  {
    id: 'photos',
    label: 'Φωτογραφίες',
    value: 'photos',
    icon: 'camera',
    description: 'Φωτογραφίες κτιρίου και εργασιών',
    order: 9,
    enabled: true,
    component: 'PhotosTabContent',
  },
  {
    id: 'videos',
    label: 'Videos',
    value: 'videos',
    icon: 'video',
    description: 'Videos κτιρίου και εργασιών',
    order: 10,
    enabled: true,
    component: 'VideosTabContent',
  }
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Επιστρέφει όλες τις ενεργές καρτέλες ταξινομημένες κατά order
 */
export function getSortedBuildingTabs(): BuildingTabConfig[] {
  return BUILDING_TABS
    .filter(tab => tab.enabled)
    .sort((a, b) => a.order - b.order);
}

/**
 * Επιστρέφει μόνο τις enabled καρτέλες
 */
export function getEnabledBuildingTabs(): BuildingTabConfig[] {
  return BUILDING_TABS.filter(tab => tab.enabled);
}

/**
 * Βρίσκει μία καρτέλα με βάση το ID
 */
export function getBuildingTabById(id: string): BuildingTabConfig | undefined {
  return BUILDING_TABS.find(tab => tab.id === id);
}

/**
 * Βρίσκει μία καρτέλα με βάση το value
 */
export function getBuildingTabByValue(value: string): BuildingTabConfig | undefined {
  return BUILDING_TABS.find(tab => tab.value === value);
}

/**
 * Επιστρέφει όλες τις διαθέσιμες καρτέλες (enabled/disabled)
 */
export function getAllBuildingTabs(): BuildingTabConfig[] {
  return [...BUILDING_TABS];
}

/**
 * Επιστρέφει καρτέλες που ταιριάζουν σε συγκεκριμένα criteria
 */
export function getBuildingTabsByCondition(
  predicate: (tab: BuildingTabConfig) => boolean
): BuildingTabConfig[] {
  return BUILDING_TABS.filter(predicate);
}

/**
 * Επιστρέφει στατιστικά των καρτελών
 */
export function getBuildingTabsStats() {
  const all = BUILDING_TABS;
  const enabled = getEnabledBuildingTabs();

  return {
    total: all.length,
    enabled: enabled.length,
    disabled: all.length - enabled.length,
    components: [...new Set(all.map(tab => tab.component))],
    icons: [...new Set(all.map(tab => tab.icon))],
  };
}

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Ελέγχει αν όλες οι καρτέλες έχουν μοναδικά IDs
 */
export function validateBuildingTabIds(): boolean {
  const ids = BUILDING_TABS.map(tab => tab.id);
  return ids.length === new Set(ids).size;
}

/**
 * Ελέγχει αν όλες οι καρτέλες έχουν μοναδικά values
 */
export function validateBuildingTabValues(): boolean {
  const values = BUILDING_TABS.map(tab => tab.value);
  return values.length === new Set(values).size;
}

/**
 * Ελέγχει αν όλες οι καρτέλες έχουν μοναδικά orders
 */
export function validateBuildingTabOrders(): boolean {
  const orders = BUILDING_TABS.map(tab => tab.order);
  return orders.length === new Set(orders).size;
}

/**
 * Comprehensive validation όλων των καρτελών
 */
export function validateBuildingTabsConfiguration(): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!validateBuildingTabIds()) {
    errors.push('Duplicate tab IDs found');
  }

  if (!validateBuildingTabValues()) {
    errors.push('Duplicate tab values found');
  }

  if (!validateBuildingTabOrders()) {
    errors.push('Duplicate tab orders found');
  }

  // Έλεγχος για κενά required fields
  BUILDING_TABS.forEach((tab, index) => {
    if (!tab.id) errors.push(`Tab at index ${index} has no ID`);
    if (!tab.label) errors.push(`Tab at index ${index} has no label`);
    if (!tab.value) errors.push(`Tab at index ${index} has no value`);
    if (!tab.component) errors.push(`Tab at index ${index} has no component`);
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

// ============================================================================
// DEVELOPMENT HELPERS
// ============================================================================

/**
 * Development helper για debugging
 */
export function debugBuildingTabs(): void {
  if (process.env.NODE_ENV === 'development') {
    console.group('🏗️ Building Tabs Configuration Debug');
    console.log('📊 Stats:', getBuildingTabsStats());
    console.log('✅ Validation:', validateBuildingTabsConfiguration());
    console.log('📋 Enabled tabs:', getEnabledBuildingTabs().map(t => t.label));
    console.log('🎯 All tabs:', BUILDING_TABS.length);
    console.groupEnd();
  }
}

// Development debug (μόνο στο development)
if (process.env.NODE_ENV === 'development') {
  debugBuildingTabs();
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  tabs: BUILDING_TABS,
  getSorted: getSortedBuildingTabs,
  getEnabled: getEnabledBuildingTabs,
  getById: getBuildingTabById,
  getByValue: getBuildingTabByValue,
  getAll: getAllBuildingTabs,
  getByCondition: getBuildingTabsByCondition,
  getStats: getBuildingTabsStats,
  validate: validateBuildingTabsConfiguration,
  debug: debugBuildingTabs,
};