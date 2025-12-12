/**
 * 🏢 ENTERPRISE HEADER SYSTEM - MAIN INDEX
 *
 * Κεντρικός entry point για όλο το Enterprise Header System
 * Single Source of Truth για όλα τα header components και utilities
 *
 * ΑΝΤΙΚΑΘΙΣΤΑ: UnifiedHeaderSystem.tsx (743 γραμμές → Modular Architecture)
 */

// ============================================================================
// 🎯 CORE TYPES & CONSTANTS
// ============================================================================

export * from './types';
export * from './constants';

// ============================================================================
// 🧩 MODULAR COMPONENTS
// ============================================================================

export * from './components';

// Layouts (για μελλοντική επέκταση)
// export * from './layouts';

// Mobile components (για μελλοντική επέκταση)
// export * from './mobile';

// ============================================================================
// 🔧 UTILITIES & HELPERS
// ============================================================================

// Utilities (για μελλοντική επέκταση)
// export * from './utils';

// ============================================================================
// 🚀 MAIN EXPORTS - ENTERPRISE READY
// ============================================================================

// Backward compatibility με το παλιό UnifiedHeaderSystem
import { HeaderIcon } from './components/HeaderIcon';
import { HeaderTitle } from './components/HeaderTitle';
import { HeaderSearch } from './components/HeaderSearch';
import { HeaderFilters } from './components/HeaderFilters';
import { HeaderViewToggle } from './components/HeaderViewToggle';
import { MobileHeaderViewToggle } from './components/MobileHeaderViewToggle';
import { HeaderActions } from './components/HeaderActions';
import { PageHeader } from './components/PageHeader';

// Re-export με original names για συμβατότητα
export {
  HeaderIcon as UnifiedHeaderIcon,
  HeaderTitle as UnifiedHeaderTitle,
  HeaderSearch as UnifiedHeaderSearch,
  HeaderFilters as UnifiedHeaderFilters,
  HeaderViewToggle as UnifiedHeaderViewToggle,
  MobileHeaderViewToggle as UnifiedMobileHeaderViewToggle,
  HeaderActions as UnifiedHeaderActions,
  PageHeader as UnifiedPageHeader
};

// ============================================================================
// 🏗️ ENTERPRISE COMPOSITION PATTERN
// ============================================================================

/**
 * Enterprise Header Builder Pattern
 * Προγραμματιστικός τρόπος δημιουργίας headers
 */
export class EnterpriseHeaderBuilder {
  private config: any = {};

  withTitle(title: string, subtitle?: string) {
    this.config.title = { title, subtitle };
    return this;
  }

  withSearch(placeholder?: string) {
    this.config.search = { placeholder };
    return this;
  }

  withIcon(icon: any) {
    this.config.icon = icon;
    return this;
  }

  build() {
    return this.config;
  }
}

// ============================================================================
// 🚀 CONVENIENCE EXPORTS
// ============================================================================

// Default export για single import
export { HeaderIcon as default };

// Factory functions για συνήθεις patterns
export const createEnterpriseHeader = () => new EnterpriseHeaderBuilder();

// ============================================================================
// 📚 VERSION & METADATA
// ============================================================================

export const ENTERPRISE_HEADER_VERSION = '1.0.0';
export const ENTERPRISE_HEADER_BUILD = '2025-12-12';

// ============================================================================
// 🔄 LEGACY COMPATIBILITY
// ============================================================================

/**
 * @deprecated UnifiedHeaderSystem.tsx has been removed
 * Use PageHeader from enterprise-system instead
 */
// Legacy export removed - file deleted after successful migration

// Documentation link
export const ENTERPRISE_HEADER_DOCS = '/docs/enterprise-header-system.md';