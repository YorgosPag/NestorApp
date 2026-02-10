/**
 * Units Tabs Configuration - MIGRATED TO UNIFIED FACTORY
 *
 * ✅ ENTERPRISE MIGRATION: This file now uses unified-tabs-factory.ts
 * ✅ BACKWARD COMPATIBLE: All existing imports continue to work unchanged
 * ✅ ZERO BREAKING CHANGES: Same API, same exports, same functionality
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
const logger = createModuleLogger('units-tabs-config');

// 🏢 BACKWARD COMPATIBILITY: Legacy imports (DEPRECATED but maintained)

// ============================================================================
// BACKWARD COMPATIBLE TYPE EXPORTS
// ============================================================================

/**
 * ✅ BACKWARD COMPATIBLE: Legacy UnitsTabConfig interface
 * Re-exported from unified factory για zero breaking changes
 */
export interface UnitsTabConfig extends UnifiedTabConfig {
  // Same interface as before - no changes needed
}

// ============================================================================
// FACTORY-BASED CONFIGURATION (ENTERPRISE)
// ============================================================================

/**
 * ✅ ENTERPRISE: Units tabs configuration via unified factory
 * ✅ BACKWARD COMPATIBLE: Same UNITS_TABS export as before
 * ✅ CENTRALIZED: All configuration now comes from unified-tabs-factory.ts
 */
export const UNITS_TABS: UnitsTabConfig[] = createTabsConfig('units') as UnitsTabConfig[];

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
export function getSortedUnitsTabs(): UnitsTabConfig[] {
  return getSortedTabs('units') as UnitsTabConfig[];
}

/**
 * Επιστρέφει μόνο τις enabled καρτέλες
 */
export function getEnabledUnitsTabs(): UnitsTabConfig[] {
  return getSortedTabs('units') as UnitsTabConfig[];
}

/**
 * Βρίσκει μία καρτέλα με βάση το ID
 */
export function getUnitsTabById(id: string): UnitsTabConfig | undefined {
  return getTabById('units', id) as UnitsTabConfig | undefined;
}

/**
 * Βρίσκει μία καρτέλα με βάση το value
 */
export function getUnitsTabByValue(value: string): UnitsTabConfig | undefined {
  return getTabByValue('units', value) as UnitsTabConfig | undefined;
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
  return getTabsStats('units');
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

  // Έλεγχος για κενά required fields using unified factory validation
  UNITS_TABS.forEach((tab, index) => {
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
export function debugUnitsTabs(): void {
  if (process.env.NODE_ENV === 'development') {
    logger.info('Units Tabs Configuration Debug (Factory-based)', {
      stats: getUnitsTabsStats(),
      validation: validateUnitsTabsConfiguration(),
      enabledTabs: getEnabledUnitsTabs().map(t => t.label),
      allTabsCount: UNITS_TABS.length,
      factory: 'unified-tabs-factory.ts'
    });
  }
}

// Development debug (μόνο στο development)
if (process.env.NODE_ENV === 'development') {
  debugUnitsTabs();
}

// ============================================================================
// BACKWARD COMPATIBLE EXPORTS
// ============================================================================

/**
 * ✅ BACKWARD COMPATIBLE: Default export exactly as before
 * All functionality remains the same - powered by unified factory
 */
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