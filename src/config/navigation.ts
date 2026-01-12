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

// 🏢 ENTERPRISE: User permissions (expandable για future features)
const userPermissions: string[] = [
  // Add user permissions here as needed
  // 'admin_access', 'legal_access', etc.
];

// ============================================================================
// 🏭 SMART FACTORY POWERED EXPORTS - ENTERPRISE GRADE
// ============================================================================

/**
 * ✅ ENTERPRISE: Main menu items via Smart Factory
 * ✅ BACKWARD COMPATIBLE: Same mainMenuItems export as before
 * ✅ CENTRALIZED: All configuration now comes from smart-navigation-factory.ts
 */
export const mainMenuItems: MenuItem[] = createMainMenuItems(environment, userPermissions);

/**
 * ✅ ENTERPRISE: Tools menu items via Smart Factory
 * ✅ BACKWARD COMPATIBLE: Same toolsMenuItems export as before
 * ✅ CENTRALIZED: All configuration now comes from smart-navigation-factory.ts
 */
export const toolsMenuItems: MenuItem[] = createToolsMenuItems(environment, userPermissions);

/**
 * ✅ ENTERPRISE: Settings menu items via Smart Factory
 * ✅ BACKWARD COMPATIBLE: Same settingsMenuItem export as before
 * ✅ CENTRALIZED: All configuration now comes from smart-navigation-factory.ts
 */
export const settingsMenuItem: MenuItem[] = createSettingsMenuItems(environment, userPermissions);

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
  userPermissions
};

// Development debug - disabled to reduce console noise
