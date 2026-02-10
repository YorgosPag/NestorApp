/**
 * 📦 ENTERPRISE: Storage Tabs Configuration - MIGRATED TO UNIFIED FACTORY
 *
 * ✅ ENTERPRISE MIGRATION: This file now uses unified-tabs-factory.ts
 * ✅ BACKWARD COMPATIBLE: All existing imports continue to work unchanged
 * ✅ ZERO BREAKING CHANGES: Same API, same exports, same functionality
 * ✅ ZERO HARDCODED VALUES: All labels from centralized modal-select.ts
 *
 * @author Claude AI Assistant + Unified Factory Migration (2025-12-27)
 * @migrated 2025-12-27
 * @version 2.0.0 (Factory-based)
 */

// 🏢 ENTERPRISE: Import from unified factory (NEW)
import {
  createTabsConfig,
  getSortedTabs,
  getTabById,
  validateTabConfig,
  getTabsForEnvironment,
  type UnifiedTabConfig
} from './unified-tabs-factory';

// 🏢 BACKWARD COMPATIBILITY: Legacy imports (DEPRECATED but maintained)

// ============================================================================
// BACKWARD COMPATIBLE TYPE EXPORTS
// ============================================================================

/**
 * ✅ BACKWARD COMPATIBLE: Legacy StorageTabConfig interface
 * Re-exported from unified factory για zero breaking changes
 */
export interface StorageTabConfig extends UnifiedTabConfig {
  // Same interface as before - no changes needed
}

// ============================================================================
// FACTORY-BASED CONFIGURATION (ENTERPRISE)
// ============================================================================

/**
 * ✅ ENTERPRISE: Storage tabs configuration via unified factory
 * ✅ BACKWARD COMPATIBLE: Same STORAGE_TABS export as before
 * ✅ CENTRALIZED: All configuration now comes from unified-tabs-factory.ts
 */
export const STORAGE_TABS: StorageTabConfig[] = createTabsConfig('storage') as StorageTabConfig[];

// ============================================================================
// BACKWARD COMPATIBLE UTILITY FUNCTIONS
// ============================================================================

/**
 * ✅ BACKWARD COMPATIBLE: Re-exported factory functions with legacy names
 * All functions now use unified factory internally for consistency
 */

/**
 * Φιλτράρισμα και ταξινόμηση enabled tabs
 */
export function getSortedStorageTabs(): StorageTabConfig[] {
  return getSortedTabs('storage') as StorageTabConfig[];
}

/**
 * Λήψη συγκεκριμένης καρτέλας
 */
export function getStorageTabById(tabId: string): StorageTabConfig | undefined {
  return getTabById('storage', tabId) as StorageTabConfig | undefined;
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
  return validateTabConfig(config);
}

/**
 * Επιστρέφει όλα τα available component names
 */
export function getAvailableStorageComponents(): string[] {
  return [...new Set(STORAGE_TABS.map(tab => tab.component))];
}

// ============================================================================
// BACKWARD COMPATIBLE ENVIRONMENT CONFIGURATION
// ============================================================================

/**
 * ✅ BACKWARD COMPATIBLE: Environment-based configuration
 * Now uses unified factory internally
 */
export function getStorageTabsForEnvironment(): StorageTabConfig[] {
  return getTabsForEnvironment('storage') as StorageTabConfig[];
}

// ============================================================================
// BACKWARD COMPATIBLE EXPORTS
// ============================================================================

/**
 * ✅ BACKWARD COMPATIBLE: Default export exactly as before
 * All functionality remains the same - powered by unified factory
 */
export default {
  STORAGE_TABS,
  getSortedStorageTabs,
  getStorageTabById,
  getDefaultStorageTab,
  validateStorageTabConfig,
  getAvailableStorageComponents,
  getStorageTabsForEnvironment
};

// StorageTabConfig already exported inline above