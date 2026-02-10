/**
 * 🏢 ENTERPRISE: Building Tabs Configuration - MIGRATED TO UNIFIED FACTORY
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
  getTabByValue,
  getTabsStats,
  validateTabConfig,
  type UnifiedTabConfig
} from './unified-tabs-factory';
import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('building-tabs-config');

// 🏢 BACKWARD COMPATIBILITY: Legacy imports (DEPRECATED but maintained)

// ============================================================================
// BACKWARD COMPATIBLE TYPE EXPORTS
// ============================================================================

/**
 * ✅ BACKWARD COMPATIBLE: Legacy BuildingTabConfig interface
 * Re-exported from unified factory για zero breaking changes
 */
export interface BuildingTabConfig extends UnifiedTabConfig {
  // Same interface as before - no changes needed
}

// ============================================================================
// FACTORY-BASED CONFIGURATION (ENTERPRISE)
// ============================================================================

/**
 * ✅ ENTERPRISE: Building tabs configuration via unified factory
 * ✅ BACKWARD COMPATIBLE: Same BUILDING_TABS export as before
 * ✅ CENTRALIZED: All configuration now comes from unified-tabs-factory.ts
 */
export const BUILDING_TABS: BuildingTabConfig[] = createTabsConfig('building') as BuildingTabConfig[];

// ============================================================================
// BACKWARD COMPATIBLE UTILITY FUNCTIONS
// ============================================================================

/**
 * ✅ BACKWARD COMPATIBLE: Re-exported factory functions with legacy names
 * All functions now use unified factory internally for consistency
 */

/**
 * Επιστρέφει όλες τις ενεργές καρτέλες ταξινομημένες κατά order
 */
export function getSortedBuildingTabs(): BuildingTabConfig[] {
  return getSortedTabs('building') as BuildingTabConfig[];
}

/**
 * Επιστρέφει μόνο τις enabled καρτέλες
 */
export function getEnabledBuildingTabs(): BuildingTabConfig[] {
  return getSortedTabs('building') as BuildingTabConfig[];
}

/**
 * Βρίσκει μία καρτέλα με βάση το ID
 */
export function getBuildingTabById(id: string): BuildingTabConfig | undefined {
  return getTabById('building', id) as BuildingTabConfig | undefined;
}

/**
 * Βρίσκει μία καρτέλα με βάση το value
 */
export function getBuildingTabByValue(value: string): BuildingTabConfig | undefined {
  return getTabByValue('building', value) as BuildingTabConfig | undefined;
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
  return getTabsStats('building');
}

// ============================================================================
// BACKWARD COMPATIBLE VALIDATION UTILITIES
// ============================================================================

/**
 * ✅ BACKWARD COMPATIBLE: Legacy validation functions
 * Now use unified factory validation internally
 */

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

  // Έλεγχος για κενά required fields using unified factory validation
  BUILDING_TABS.forEach((tab, index) => {
    if (!validateTabConfig(tab)) {
      errors.push(`Tab at index ${index} failed validation`);
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

// ============================================================================
// BACKWARD COMPATIBLE DEVELOPMENT HELPERS
// ============================================================================

/**
 * ✅ BACKWARD COMPATIBLE: Development helper για debugging
 */
export function debugBuildingTabs(): void {
  if (process.env.NODE_ENV === 'development') {
    logger.info('Building Tabs Configuration Debug (Factory-based)', {
      stats: getBuildingTabsStats(),
      validation: validateBuildingTabsConfiguration(),
      enabledTabs: getEnabledBuildingTabs().map(t => t.label),
      allTabsCount: BUILDING_TABS.length,
      factory: 'unified-tabs-factory.ts'
    });
  }
}

// 🔕 Development debug disabled to reduce console noise (2026-01-31)
// Call debugBuildingTabs() manually if needed
// if (process.env.NODE_ENV === 'development') {
//   debugBuildingTabs();
// }

// ============================================================================
// BACKWARD COMPATIBLE EXPORTS
// ============================================================================

/**
 * ✅ BACKWARD COMPATIBLE: Default export exactly as before
 * All functionality remains the same - powered by unified factory
 */
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