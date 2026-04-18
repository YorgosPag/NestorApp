/**
 * 🏢 ENTERPRISE NAVIGATION CONFIGURATION - SMART FACTORY POWERED
 *
 * ✅ ENTERPRISE MIGRATION: This file now uses smart-navigation-factory.ts
 * ✅ BACKWARD COMPATIBLE: All existing imports continue to work unchanged
 * ✅ ZERO BREAKING CHANGES: Same API, same exports, same functionality
 * ✅ ZERO HARDCODED VALUES: All labels from centralized modal-select.ts
 *
 * @author Γιώργος Παγώνης + Smart Factory Migration (2025-12-27)
 * @migrated 2025-12-27
 * @version 2.0.0 (Smart Factory-based)
 */

// 🏢 ENTERPRISE: Import from smart navigation factory (NEW)
import {
  createMainMenuItems,
  createToolsMenuItems,
  createSettingsMenuItems,
  type NavigationEnvironment
} from './smart-navigation-factory';

// 🏢 ENTERPRISE: Import LucideIcon type for proper typing
import type { LucideIcon } from 'lucide-react';

// 🏢 BACKWARD COMPATIBILITY: Legacy imports maintained
// Define MenuItem locally για compatibility fix
interface MenuItem {
  title: string;
  icon: LucideIcon;
  href: string;
  badge?: string | null;
  subItems?: MenuItem[];
}

// 🏢 ENTERPRISE: Environment detection για smart configuration
const environment: NavigationEnvironment =
  process.env.NODE_ENV === 'development' ? 'development' : 'production';

// 🏢 ENTERPRISE: Default user permissions (empty for static usage)
const defaultUserPermissions: string[] = [];

// ============================================================================
// 🏭 SMART FACTORY POWERED EXPORTS - ENTERPRISE GRADE
// ============================================================================

/**
 * ✅ ENTERPRISE: Main menu items via Smart Factory
 * ✅ BACKWARD COMPATIBLE: Same mainMenuItems export as before
 * ✅ CENTRALIZED: All configuration now comes from smart-navigation-factory.ts
 *
 * SSoT computed instance from createMainMenuItems(...) — ADR-314 Phase B
 * (legitimate: factory in smart-navigation-factory.ts, instance lives here).
 */
export const mainMenuItems: MenuItem[] = createMainMenuItems(environment, defaultUserPermissions);

/**
 * ✅ ENTERPRISE: Tools menu items via Smart Factory
 * ✅ BACKWARD COMPATIBLE: Same toolsMenuItems export as before
 * ✅ CENTRALIZED: All configuration now comes from smart-navigation-factory.ts
 */
export const toolsMenuItems: MenuItem[] = createToolsMenuItems(environment, defaultUserPermissions);

/**
 * ✅ ENTERPRISE: Settings menu items via Smart Factory
 * ✅ BACKWARD COMPATIBLE: Same settingsMenuItem export as before
 * ✅ CENTRALIZED: All configuration now comes from smart-navigation-factory.ts
 */
export const settingsMenuItem: MenuItem[] = createSettingsMenuItems(environment, defaultUserPermissions);

// ============================================================================
// 🏢 ENTERPRISE: Permission-aware exports (for runtime filtering)
// ============================================================================

export function getMainMenuItems(userPermissions: string[] = []): MenuItem[] {
  return createMainMenuItems(environment, userPermissions);
}

export function getToolsMenuItems(userPermissions: string[] = []): MenuItem[] {
  return createToolsMenuItems(environment, userPermissions);
}

export function getSettingsMenuItems(userPermissions: string[] = []): MenuItem[] {
  return createSettingsMenuItems(environment, userPermissions);
}

// ============================================================================
// 🏢 BACKWARD COMPATIBLE EXPORTS & DEVELOPMENT HELPERS
// ============================================================================

/**
 * ✅ BACKWARD COMPATIBLE: Default export exactly as before
 * All functionality remains the same - powered by smart factory
 */
export default {
  mainMenuItems,
  toolsMenuItems,
  settingsMenuItem,

  // New: Smart factory utilities (optional usage)
  environment,
  defaultUserPermissions,
  getMainMenuItems,
  getToolsMenuItems,
  getSettingsMenuItems
};

// Development debug - disabled to reduce console noise
