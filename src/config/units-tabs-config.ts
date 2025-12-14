/**
 * Units Tabs Configuration - Single Source of Truth
 *
 * Enterprise-class centralized configuration για τις καρτέλες μονάδων (units).
 * Χρησιμοποιεί το ίδιο architecture pattern με τις καρτέλες επαφών, έργων και κτιρίων.
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
 * Interface για τη διαμόρφωση μίας καρτέλας μονάδων
 */
export interface UnitsTabConfig {
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
// UNITS TABS CONFIGURATION
// ============================================================================

/**
 * Κεντρική διαμόρφωση όλων των καρτελών μονάδων
 *
 * ΣΗΜΑΝΤΙΚΟ: Αυτή είναι η ΜΟΝΑΔΙΚΗ πηγή αλήθειας για τις καρτέλες μονάδων!
 * Οποιαδήποτε αλλαγή στις καρτέλες πρέπει να γίνεται ΕΔΩ και μόνο εδώ.
 */
export const UNITS_TABS: UnitsTabConfig[] = [
  {
    id: 'info',
    label: 'Βασικές Πληροφορίες',
    value: 'info',
    icon: 'home',
    description: 'Βασικές πληροφορίες και στοιχεία της μονάδας',
    order: 1,
    enabled: true,
    component: 'PropertyDetailsContent',
  },
  {
    id: 'customer',
    label: 'Πελάτης',
    value: 'customer',
    icon: 'user',
    description: 'Πληροφορίες και διαχείριση πελάτη της μονάδας',
    order: 2,
    enabled: true,
    component: 'UnitCustomerTab',
  },
  {
    id: 'floor-plan',
    label: 'Κάτοψη',
    value: 'floor-plan',
    icon: 'map',
    description: 'Κάτοψη και διάταξη της μονάδας',
    order: 3,
    enabled: true,
    component: 'FloorPlanTab',
  },
  {
    id: 'documents',
    label: 'Έγγραφα',
    value: 'documents',
    icon: 'file-text',
    description: 'Έγγραφα και πιστοποιητικά της μονάδας',
    order: 4,
    enabled: true,
    component: 'DocumentsPlaceholder',
    componentProps: {
      title: 'Έγγραφα',
      subtitle: 'Εδώ θα εμφανίζονται τα έγγραφα της μονάδας'
    }
  },
  {
    id: 'photos',
    label: 'Φωτογραφίες',
    value: 'photos',
    icon: 'camera',
    description: 'Φωτογραφίες της μονάδας',
    order: 4,
    enabled: true,
    component: 'PhotosTabContent',
  },
  {
    id: 'videos',
    label: 'Videos',
    value: 'videos',
    icon: 'video',
    description: 'Videos της μονάδας',
    order: 5,
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
export function getSortedUnitsTabs(): UnitsTabConfig[] {
  return UNITS_TABS
    .filter(tab => tab.enabled)
    .sort((a, b) => a.order - b.order);
}

/**
 * Επιστρέφει μόνο τις enabled καρτέλες
 */
export function getEnabledUnitsTabs(): UnitsTabConfig[] {
  return UNITS_TABS.filter(tab => tab.enabled);
}

/**
 * Βρίσκει μία καρτέλα με βάση το ID
 */
export function getUnitsTabById(id: string): UnitsTabConfig | undefined {
  return UNITS_TABS.find(tab => tab.id === id);
}

/**
 * Βρίσκει μία καρτέλα με βάση το value
 */
export function getUnitsTabByValue(value: string): UnitsTabConfig | undefined {
  return UNITS_TABS.find(tab => tab.value === value);
}

/**
 * Επιστρέφει όλες τις διαθέσιμες καρτέλες (enabled/disabled)
 */
export function getAllUnitsTabs(): UnitsTabConfig[] {
  return [...UNITS_TABS];
}

/**
 * Επιστρέφει καρτέλες που ταιριάζουν σε συγκεκριμένα criteria
 */
export function getUnitsTabsByCondition(
  predicate: (tab: UnitsTabConfig) => boolean
): UnitsTabConfig[] {
  return UNITS_TABS.filter(predicate);
}

/**
 * Επιστρέφει στατιστικά των καρτελών
 */
export function getUnitsTabsStats() {
  const all = UNITS_TABS;
  const enabled = getEnabledUnitsTabs();

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
export function validateUnitsTabIds(): boolean {
  const ids = UNITS_TABS.map(tab => tab.id);
  return ids.length === new Set(ids).size;
}

/**
 * Ελέγχει αν όλες οι καρτέλες έχουν μοναδικά values
 */
export function validateUnitsTabValues(): boolean {
  const values = UNITS_TABS.map(tab => tab.value);
  return values.length === new Set(values).size;
}

/**
 * Ελέγχει αν όλες οι καρτέλες έχουν μοναδικά orders
 */
export function validateUnitsTabOrders(): boolean {
  const orders = UNITS_TABS.map(tab => tab.order);
  return orders.length === new Set(orders).size;
}

/**
 * Comprehensive validation όλων των καρτελών
 */
export function validateUnitsTabsConfiguration(): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!validateUnitsTabIds()) {
    errors.push('Duplicate tab IDs found');
  }

  if (!validateUnitsTabValues()) {
    errors.push('Duplicate tab values found');
  }

  if (!validateUnitsTabOrders()) {
    errors.push('Duplicate tab orders found');
  }

  // Έλεγχος για κενά required fields
  UNITS_TABS.forEach((tab, index) => {
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
export function debugUnitsTabs(): void {
  if (process.env.NODE_ENV === 'development') {
    console.group('🏘️ Units Tabs Configuration Debug');
    console.log('📊 Stats:', getUnitsTabsStats());
    console.log('✅ Validation:', validateUnitsTabsConfiguration());
    console.log('📋 Enabled tabs:', getEnabledUnitsTabs().map(t => t.label));
    console.log('🎯 All tabs:', UNITS_TABS.length);
    console.groupEnd();
  }
}

// Development debug (μόνο στο development)
if (process.env.NODE_ENV === 'development') {
  debugUnitsTabs();
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  tabs: UNITS_TABS,
  getSorted: getSortedUnitsTabs,
  getEnabled: getEnabledUnitsTabs,
  getById: getUnitsTabById,
  getByValue: getUnitsTabByValue,
  getAll: getAllUnitsTabs,
  getByCondition: getUnitsTabsByCondition,
  getStats: getUnitsTabsStats,
  validate: validateUnitsTabsConfiguration,
  debug: debugUnitsTabs,
};