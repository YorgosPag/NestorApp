/**
 * Properties Tabs Configuration - MIGRATED TO UNIFIED FACTORY
 *
 * ✅ ENTERPRISE MIGRATION: This file now uses unified-tabs-factory.ts
 * ✅ BACKWARD COMPATIBLE: All existing imports continue to work unchanged
 * ✅ ZERO BREAKING CHANGES: Same API, same exports, same functionality
 *
 * @author Claude AI Assistant + Unified Factory Migration (2025-12-27)
 * @migrated 2025-12-27
 * @version 2.0.0 (Factory-based)
 * @renamed 2026-03-31 units → properties
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
const logger = createModuleLogger('properties-tabs-config');

// 🏢 BACKWARD COMPATIBILITY: Legacy imports (DEPRECATED but maintained)

// ============================================================================
// BACKWARD COMPATIBLE TYPE EXPORTS
// ============================================================================

/**
 * ✅ BACKWARD COMPATIBLE: PropertiesTabConfig interface
 * Re-exported from unified factory για zero breaking changes
 */
export type PropertiesTabConfig = UnifiedTabConfig;

/** @deprecated Use PropertiesTabConfig */
export type UnitsTabConfig = PropertiesTabConfig;

// ============================================================================
// FACTORY-BASED CONFIGURATION (ENTERPRISE)
// ============================================================================

/**
 * ✅ ENTERPRISE: Properties tabs configuration via unified factory
 * ✅ BACKWARD COMPATIBLE: Same PROPERTIES_TABS export as before
 * ✅ CENTRALIZED: All configuration now comes from unified-tabs-factory.ts
 */
export const PROPERTIES_TABS: PropertiesTabConfig[] = createTabsConfig('properties') as PropertiesTabConfig[];

/** @deprecated Use PROPERTIES_TABS */
export const UNITS_TABS = PROPERTIES_TABS;

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
export function getSortedPropertiesTabs(): PropertiesTabConfig[] {
  return getSortedTabs('properties') as PropertiesTabConfig[];
}

/** @deprecated Use getSortedPropertiesTabs */
export const getSortedUnitsTabs = getSortedPropertiesTabs;

/**
 * Επιστρέφει μόνο τις enabled καρτέλες
 */
export function getEnabledPropertiesTabs(): PropertiesTabConfig[] {
  return getSortedTabs('properties') as PropertiesTabConfig[];
}

/** @deprecated Use getEnabledPropertiesTabs */
export const getEnabledUnitsTabs = getEnabledPropertiesTabs;

/**
 * Βρίσκει μία καρτέλα με βάση το ID
 */
export function getPropertiesTabById(id: string): PropertiesTabConfig | undefined {
  return getTabById('properties', id) as PropertiesTabConfig | undefined;
}

/** @deprecated Use getPropertiesTabById */
export const getUnitsTabById = getPropertiesTabById;

/**
 * Βρίσκει μία καρτέλα με βάση το value
 */
export function getPropertiesTabByValue(value: string): PropertiesTabConfig | undefined {
  return getTabByValue('properties', value) as PropertiesTabConfig | undefined;
}

/** @deprecated Use getPropertiesTabByValue */
export const getUnitsTabByValue = getPropertiesTabByValue;

/**
 * Επιστρέφει όλες τις διαθέσιμες καρτέλες (enabled/disabled)
 */
export function getAllPropertiesTabs(): PropertiesTabConfig[] {
  return [...PROPERTIES_TABS];
}

/** @deprecated Use getAllPropertiesTabs */
export const getAllUnitsTabs = getAllPropertiesTabs;

/**
 * Επιστρέφει καρτέλες που ταιριάζουν σε συγκεκριμένα criteria
 */
export function getPropertiesTabsByCondition(
  predicate: (tab: PropertiesTabConfig) => boolean
): PropertiesTabConfig[] {
  return PROPERTIES_TABS.filter(predicate);
}

/** @deprecated Use getPropertiesTabsByCondition */
export const getUnitsTabsByCondition = getPropertiesTabsByCondition;

/**
 * Επιστρέφει στατιστικά των καρτελών
 */
export function getPropertiesTabsStats() {
  return getTabsStats('properties');
}

/** @deprecated Use getPropertiesTabsStats */
export const getUnitsTabsStats = getPropertiesTabsStats;

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
export function validatePropertiesTabIds(): boolean {
  const ids = PROPERTIES_TABS.map(tab => tab.id);
  return ids.length === new Set(ids).size;
}

/** @deprecated Use validatePropertiesTabIds */
export const validateUnitsTabIds = validatePropertiesTabIds;

/**
 * Ελέγχει αν όλες οι καρτέλες έχουν μοναδικά values
 */
export function validatePropertiesTabValues(): boolean {
  const values = PROPERTIES_TABS.map(tab => tab.value);
  return values.length === new Set(values).size;
}

/** @deprecated Use validatePropertiesTabValues */
export const validateUnitsTabValues = validatePropertiesTabValues;

/**
 * Ελέγχει αν όλες οι καρτέλες έχουν μοναδικά orders
 */
export function validatePropertiesTabOrders(): boolean {
  const orders = PROPERTIES_TABS.map(tab => tab.order);
  return orders.length === new Set(orders).size;
}

/** @deprecated Use validatePropertiesTabOrders */
export const validateUnitsTabOrders = validatePropertiesTabOrders;

/**
 * Comprehensive validation όλων των καρτελών
 */
export function validatePropertiesTabsConfiguration(): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!validatePropertiesTabIds()) {
    errors.push('Duplicate tab IDs found');
  }

  if (!validatePropertiesTabValues()) {
    errors.push('Duplicate tab values found');
  }

  if (!validatePropertiesTabOrders()) {
    errors.push('Duplicate tab orders found');
  }

  // Έλεγχος για κενά required fields using unified factory validation
  PROPERTIES_TABS.forEach((tab, index) => {
    if (!validateTabConfig(tab)) {
      errors.push(`Tab at index ${index} failed validation`);
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

/** @deprecated Use validatePropertiesTabsConfiguration */
export const validateUnitsTabsConfiguration = validatePropertiesTabsConfiguration;

// ============================================================================
// BACKWARD COMPATIBLE DEVELOPMENT HELPERS
// ============================================================================

/**
 * ✅ BACKWARD COMPATIBLE: Development helper για debugging
 */
export function debugPropertiesTabs(): void {
  if (process.env.NODE_ENV === 'development') {
    logger.info('Properties Tabs Configuration Debug (Factory-based)', {
      stats: getPropertiesTabsStats(),
      validation: validatePropertiesTabsConfiguration(),
      enabledTabs: getEnabledPropertiesTabs().map(t => t.label),
      allTabsCount: PROPERTIES_TABS.length,
      factory: 'unified-tabs-factory.ts'
    });
  }
}

/** @deprecated Use debugPropertiesTabs */
export const debugUnitsTabs = debugPropertiesTabs;

// Development debug (μόνο στο development)
if (process.env.NODE_ENV === 'development') {
  debugPropertiesTabs();
}

// ============================================================================
// BACKWARD COMPATIBLE EXPORTS
// ============================================================================

/**
 * ✅ BACKWARD COMPATIBLE: Default export exactly as before
 * All functionality remains the same - powered by unified factory
 */
export default {
  tabs: PROPERTIES_TABS,
  getSorted: getSortedPropertiesTabs,
  getEnabled: getEnabledPropertiesTabs,
  getById: getPropertiesTabById,
  getByValue: getPropertiesTabByValue,
  getAll: getAllPropertiesTabs,
  getByCondition: getPropertiesTabsByCondition,
  getStats: getPropertiesTabsStats,
  validate: validatePropertiesTabsConfiguration,
  debug: debugPropertiesTabs,
};
