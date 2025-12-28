/**
 * ============================================================================
 * 👥 CONTACT TABS CONFIGURATION - MIGRATED TO UNIFIED FACTORY
 * ============================================================================
 *
 * ✅ ENTERPRISE MIGRATION: This file now uses unified-tabs-factory.ts
 * ✅ BACKWARD COMPATIBLE: All existing imports continue to work unchanged
 * ✅ ZERO BREAKING CHANGES: Same API, same exports, same functionality
 * ✅ ZERO HARDCODED VALUES: All labels from centralized modal-select.ts
 * ✅ CONTACT TYPE SUPPORT: Full ContactType conditional logic maintained
 *
 * @author Claude AI Assistant + Unified Factory Migration (2025-12-27)
 * @migrated 2025-12-27
 * @version 2.0.0 (Factory-based)
 */

// 🏢 ENTERPRISE: Import from unified factory (NEW)
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
  type TabEntityType,
  type ContactType
} from './unified-tabs-factory';

// 🏢 BACKWARD COMPATIBILITY: Legacy imports (DEPRECATED but maintained)
import type { ContactType as LegacyContactType } from '@/types/ContactFormTypes';

// ============================================================================
// BACKWARD COMPATIBLE TYPE EXPORTS
// ============================================================================

/**
 * ✅ BACKWARD COMPATIBLE: Legacy ContactTabConfig interface
 * Re-exported from unified factory για zero breaking changes
 */
export interface ContactTabConfig extends UnifiedTabConfig {
  /** Contact type restrictions (legacy compatibility) */
  contactType?: ContactType[];
}

// Re-export ContactType for backward compatibility
export type { ContactType };

// ============================================================================
// FACTORY-BASED CONFIGURATION (ENTERPRISE)
// ============================================================================

/**
 * ✅ ENTERPRISE: Contact tabs configuration via unified factory
 * ✅ BACKWARD COMPATIBLE: Same CONTACT_TABS export as before
 * ✅ CENTRALIZED: All configuration now comes from unified-tabs-factory.ts
 * ✅ CONTACT TYPE SUPPORT: Maintains conditional tab logic per contact type
 */
export const CONTACT_TABS: ContactTabConfig[] = createTabsConfig('contact') as ContactTabConfig[];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get sorted tabs for specific contact type
 */
export function getSortedContactTabs(contactType: ContactType): ContactTabConfig[] {
  return CONTACT_TABS
    .filter(tab =>
      tab.enabled !== false &&
      tab.contactTypes.includes(contactType)
    )
    .sort((a, b) => a.order - b.order);
}

/**
 * Get all contact tabs (for admin/config purposes)
 */
export function getAllContactTabs(): ContactTabConfig[] {
  return [...CONTACT_TABS].sort((a, b) => a.order - b.order);
}

/**
 * Get specific tab by ID
 */
export function getContactTabById(tabId: string): ContactTabConfig | undefined {
  return CONTACT_TABS.find(tab => tab.id === tabId);
}

/**
 * Get enabled tab count for contact type
 */
export function getEnabledContactTabsCount(contactType: ContactType): number {
  return getSortedContactTabs(contactType).length;
}

/**
 * Check if tab is enabled for contact type
 */
export function isContactTabEnabled(tabId: string, contactType: ContactType): boolean {
  const tab = getContactTabById(tabId);
  return tab
    ? tab.enabled !== false && tab.contactTypes.includes(contactType)
    : false;
}

/**
 * Get default tab for contact type (first enabled tab)
 */
export function getDefaultContactTab(contactType: ContactType): string {
  const tabs = getSortedContactTabs(contactType);
  return tabs[0]?.value || 'basicInfo';
}

// ============================================================================
// VALIDATION & DEBUG
// ============================================================================

/**
 * Validate contact tabs configuration
 */
export function validateContactTabsConfig(): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for duplicate IDs
  const ids = CONTACT_TABS.map(tab => tab.id);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicateIds.length > 0) {
    errors.push(`Duplicate tab IDs found: ${duplicateIds.join(', ')}`);
  }

  // Check for duplicate values
  const values = CONTACT_TABS.map(tab => tab.value);
  const duplicateValues = values.filter((value, index) => values.indexOf(value) !== index);
  if (duplicateValues.length > 0) {
    errors.push(`Duplicate tab values found: ${duplicateValues.join(', ')}`);
  }

  // Check each contact type has at least one tab
  const contactTypes: ContactType[] = ['individual', 'company', 'service'];
  for (const type of contactTypes) {
    const enabledTabs = getSortedContactTabs(type);
    if (enabledTabs.length === 0) {
      warnings.push(`Contact type "${type}" has no enabled tabs`);
    }
  }

  // Check for missing components
  const missingComponents = CONTACT_TABS.filter(tab => !tab.component);
  if (missingComponents.length > 0) {
    warnings.push(`Tabs without component: ${missingComponents.map(t => t.id).join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================================================
// DEBUG HELPERS
// ============================================================================

/**
 * Debug: Print contact tabs configuration
 */
export function debugContactTabsConfig(): void {
  if (typeof window === 'undefined') return; // Server-side safe

  console.group('👥 Contact Tabs Configuration Debug');

  const validation = validateContactTabsConfig();
  console.log('📊 Validation:', validation);

  const contactTypes: ContactType[] = ['individual', 'company', 'service'];

  for (const type of contactTypes) {
    const tabs = getSortedContactTabs(type);
    console.group(`📋 ${type.toUpperCase()} Tabs (${tabs.length})`);

    tabs.forEach((tab, index) => {
      console.log(`${index + 1}. ${tab.label} (${tab.value}) - ${tab.component || 'NO COMPONENT'}`);
    });

    console.groupEnd();
  }

  console.groupEnd();
}

// ============================================================================
// EXPORTS
// ============================================================================

export default CONTACT_TABS;

// Enterprise-grade export object for external integrations
export const ContactTabsConfig = {
  tabs: CONTACT_TABS,
  getSortedContactTabs,
  getAllContactTabs,
  getContactTabById,
  getEnabledContactTabsCount,
  isContactTabEnabled,
  getDefaultContactTab,
  validateContactTabsConfig,
  debugContactTabsConfig,
} as const;