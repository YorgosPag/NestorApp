/**
 * 📦 ENTERPRISE: Storage Tabs Configuration - Single Source of Truth
 *
 * Enterprise-class centralized configuration για τις καρτέλες αποθηκών.
 * Χρησιμοποιεί το ίδιο architecture pattern με τις καρτέλες κτιρίων και επαφών.
 * ZERO HARDCODED VALUES - All storage references από environment configuration
 *
 * @author Claude AI Assistant
 * @created 2025-12-22
 * @version 1.0.0
 */

import { LucideIcon } from 'lucide-react';

// 🏢 ENTERPRISE: Import centralized tab labels
import { getStorageTabLabels } from '@/subapps/dxf-viewer/config/modal-select';

// ============================================================================
// INTERFACES & TYPES
// ============================================================================

/**
 * Interface για τη διαμόρφωση μίας καρτέλας αποθηκών
 */
export interface StorageTabConfig {
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
// STORAGE TABS CONFIGURATION
// ============================================================================

/**
 * Κεντρική διαμόρφωση όλων των καρτελών αποθηκών
 *
 * ΣΗΜΑΝΤΙΚΟ: Αυτή είναι η ΜΟΝΑΔΙΚΗ πηγή αλήθειας για τις καρτέλες αποθηκών!
 * Οποιαδήποτε αλλαγή στις καρτέλες πρέπει να γίνεται ΕΔΩ και μόνο εδώ.
 * ✅ ENTERPRISE: Uses centralized labels από modal-select.ts
 */
export const STORAGE_TABS: StorageTabConfig[] = (() => {
  const tabLabels = getStorageTabLabels();
  return [
  {
    id: 'general',
    label: tabLabels.general,
    value: 'general',
    icon: 'info',
    description: 'Βασικές πληροφορίες και στοιχεία αποθήκης',
    order: 1,
    enabled: true,
    component: 'StorageGeneralTab',
  },
  {
    id: 'statistics',
    label: tabLabels.statistics,
    value: 'statistics',
    icon: 'bar-chart-3',
    description: 'Στατιστικά χρήσης και αποδοτικότητας αποθήκης',
    order: 2,
    enabled: true,
    component: 'StorageStatsTab',
  },
  {
    id: 'floorplans',
    label: tabLabels.floorplans,
    value: 'floorplans',
    icon: 'layout-grid',
    description: 'Κατόψεις και διάταξη αποθήκης',
    order: 3,
    enabled: true,
    component: 'FloorplanViewerTab',
    componentProps: {
      title: 'Κατόψεις Αποθήκης', // Keep this as contextual description
      floorplanType: 'storage'
    }
  },
  {
    id: 'documents',
    label: tabLabels.documents,
    value: 'documents',
    icon: 'file-text',
    description: 'Διαχείριση εγγράφων και συμβολαίων αποθήκης',
    order: 4,
    enabled: true,
    component: 'StorageDocumentsTab',
  },
  {
    id: 'photos',
    label: tabLabels.photos,
    value: 'photos',
    icon: 'image',
    description: 'Φωτογραφίες και εικόνες της αποθήκης',
    order: 5,
    enabled: true,
    component: 'StoragePhotosTab',
  },
  {
    id: 'activity',
    label: tabLabels.activity,
    value: 'activity',
    icon: 'clock',
    description: 'Ιστορικό μισθώσεων και χρήσης αποθήκης',
    order: 6,
    enabled: true,
    component: 'StorageHistoryTab',
  }
];
})();

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Φιλτράρισμα και ταξινόμηση enabled tabs
 */
export function getSortedStorageTabs(): StorageTabConfig[] {
  return STORAGE_TABS
    .filter(tab => tab.enabled)
    .sort((a, b) => a.order - b.order);
}

/**
 * Λήψη συγκεκριμένης καρτέλας
 */
export function getStorageTabById(tabId: string): StorageTabConfig | undefined {
  return STORAGE_TABS.find(tab => tab.id === tabId);
}

/**
 * Λήψη πρώτης enabled καρτέλας (default)
 */
export function getDefaultStorageTab(): StorageTabConfig {
  const enabledTabs = getSortedStorageTabs();
  return enabledTabs[0] || STORAGE_TABS[0];
}

/**
 * Validation function για tab configuration
 */
export function validateStorageTabConfig(config: StorageTabConfig): boolean {
  return !!(
    config.id &&
    config.label &&
    config.value &&
    config.icon &&
    config.component &&
    typeof config.order === 'number' &&
    typeof config.enabled === 'boolean'
  );
}

/**
 * Επιστρέφει όλα τα available component names
 */
export function getAvailableStorageComponents(): string[] {
  return [...new Set(STORAGE_TABS.map(tab => tab.component))];
}

// ============================================================================
// ENVIRONMENT-BASED CONFIGURATION
// ============================================================================

/**
 * Δυναμικό configuration βάση environment
 * Μπορεί να override τη βασική configuration
 */
export function getStorageTabsForEnvironment(): StorageTabConfig[] {
  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    // Development: Όλες οι καρτέλες enabled
    return STORAGE_TABS.map(tab => ({
      ...tab,
      enabled: true
    }));
  }

  // Production: Μόνο οι επισήμως enabled
  return getSortedStorageTabs();
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  STORAGE_TABS,
  getSortedStorageTabs,
  getStorageTabById,
  getDefaultStorageTab,
  validateStorageTabConfig,
  getAvailableStorageComponents,
  getStorageTabsForEnvironment
};

export type {
  StorageTabConfig
};