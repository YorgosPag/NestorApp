/**
 * 🅿️ ENTERPRISE: Parking Tabs Configuration - MIGRATED TO UNIFIED FACTORY
 *
 * ✅ ENTERPRISE MIGRATION: This file now uses unified-tabs-factory.ts
 * ✅ ZERO HARDCODED VALUES: All labels from centralized systems
 * ✅ ZERO INLINE STYLES: Following Fortune 500 protocol
 * ✅ BACKWARD COMPATIBLE: All existing imports continue to work unchanged
 *
 * @author Claude AI Assistant + Unified Factory Migration
 * @migrated 2025-01-09
 * @version 1.0.0 (Factory-based)
 */

// 🏢 ENTERPRISE: Import from unified factory
import {
  createTabsConfig,
  getSortedTabs,
  getEnabledTabsCount,
  getTabById,
  getTabByValue,
  getTabsStats,
  validateTabConfig,
  getTabsForEnvironment,
  type UnifiedTabConfig,
  type TabEntityType
} from './unified-tabs-factory';

// 🏢 BACKWARD COMPATIBILITY: Legacy imports (DEPRECATED but maintained)
import { LucideIcon } from 'lucide-react';

// ============================================================================
// BACKWARD COMPATIBLE TYPE EXPORTS
// ============================================================================

/**
 * ✅ BACKWARD COMPATIBLE: Legacy ParkingTabConfig interface
 * Re-exported from unified factory για zero breaking changes
 */
export interface ParkingTabConfig extends UnifiedTabConfig {
  // Same interface as before - no changes needed
}

// ============================================================================
// FACTORY-BASED CONFIGURATION (ENTERPRISE)
// ============================================================================

/**
 * ✅ ENTERPRISE: Parking tabs configuration via unified factory
 * ✅ ZERO HARDCODED VALUES: Configuration from factory
 * ✅ CENTRALIZED: All configuration now comes from unified-tabs-factory.ts
 */
export const PARKING_TABS: ParkingTabConfig[] = createTabsConfig('parking') as ParkingTabConfig[];

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
export function getSortedParkingTabs(): ParkingTabConfig[] {
  return getSortedTabs('parking') as ParkingTabConfig[];
}

/**
 * Λήψη συγκεκριμένης καρτέλας
 */
export function getParkingTabById(tabId: string): ParkingTabConfig | undefined {
  return getTabById('parking', tabId) as ParkingTabConfig | undefined;
}

/**
 * Λήψη πρώτης enabled καρτέλας (default)
 */
export function getDefaultParkingTab(): ParkingTabConfig {
  const enabledTabs = getSortedParkingTabs();
  return enabledTabs[0] || PARKING_TABS[0];
}

/**
 * Validation function για tab configuration
 */
export function validateParkingTabConfig(config: ParkingTabConfig): boolean {
  return validateTabConfig(config);
}

/**
 * Επιστρέφει όλα τα available component names
 */
export function getAvailableParkingComponents(): string[] {
  return [...new Set(PARKING_TABS.map(tab => tab.component))];
}

// ============================================================================
// BACKWARD COMPATIBLE ENVIRONMENT CONFIGURATION
// ============================================================================

/**
 * ✅ BACKWARD COMPATIBLE: Environment-based configuration
 * Now uses unified factory internally
 */
export function getParkingTabsForEnvironment(): ParkingTabConfig[] {
  return getTabsForEnvironment('parking') as ParkingTabConfig[];
}

// ============================================================================
// BACKWARD COMPATIBLE EXPORTS
// ============================================================================

/**
 * ✅ BACKWARD COMPATIBLE: Default export exactly as before
 * All functionality remains the same - powered by unified factory
 */
export default {
  PARKING_TABS,
  getSortedParkingTabs,
  getParkingTabById,
  getDefaultParkingTab,
  validateParkingTabConfig,
  getAvailableParkingComponents,
  getParkingTabsForEnvironment
};

// ParkingTabConfig already exported inline above