/**
 * =============================================================================
 * 🔍 SEARCH INDEX CONFIGURATION
 * =============================================================================
 *
 * Enterprise-grade configuration for Global Search indexing.
 * Defines how each entity type is indexed for search.
 *
 * @module config/search-index-config
 * @enterprise ADR-029 - Global Search v1 (Non-AI) · ADR-874 - portable core
 * @compliance Local_Protocol.txt - Centralization First, ZERO hardcoded
 *
 * @see docs/adr/global-search-v1.md
 */

// Server-safe currency formatter (avoids @/lib/intl-utils → react-i18next → createContext)
const formatSearchCurrency = (amount: number): string =>
  new Intl.NumberFormat('el', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount);
import type { PermissionId } from '@/lib/auth/types';
import {
  SEARCH_ENTITY_TYPES,
  type SearchEntityType,
  type SearchIndexConfig,
  type SearchIndexConfigMap,
  type SearchStatsFieldConfig,
} from '@/types/search';
import { SEARCH_INDEX_CORE, SEARCH_REQUIRED_PERMISSIONS } from './search-index-core';

// ADR-874 — the indexing rules and their pure application live in the PORTABLE
// core, which the Cloud Functions build receives by projection (CHECK 3.93).
// Re-exported here so every app caller keeps one import surface.
export {
  extractTitle,
  extractSubtitle,
  determineAudience,
  extractSearchableText,
  extractStatus,
  buildSearchResultHref,
  generateSearchDocId,
} from './search-index-core';

// =============================================================================
// PERMISSION PROOF (app-only)
// =============================================================================

/**
 * Every permission the core declares is a real `PermissionId`. The core keeps
 * literal types (`as const`) and cannot import the app's RBAC types, so the
 * proof happens here: an unknown permission string fails this assignment.
 */
const SEARCH_PERMISSIONS: Readonly<Record<SearchEntityType, PermissionId>> = SEARCH_REQUIRED_PERMISSIONS;

// =============================================================================
// RESULT-CARD STATS (presentation — never read by the indexer)
// =============================================================================

const SEARCH_STATS_FIELDS: Partial<Record<SearchEntityType, SearchStatsFieldConfig[]>> = {
  // 🏢 ENTERPRISE: Stats for card display (like ParkingListCard)
  [SEARCH_ENTITY_TYPES.PARKING]: [
    { field: 'floor', label: 'parking.card.stats.level', iconKey: 'floor', formatter: 'floor' },
    { field: 'area', label: 'parking.card.stats.area', iconKey: 'area', formatter: 'area' },
  ],
  // 🏢 ENTERPRISE: Stats for card display (like StorageListCard)
  [SEARCH_ENTITY_TYPES.STORAGE]: [
    { field: 'floor', label: 'storage.card.stats.level', iconKey: 'floor', formatter: 'floor' },
    { field: 'area', label: 'storage.card.stats.area', iconKey: 'area', formatter: 'area' },
  ],
  [SEARCH_ENTITY_TYPES.OPPORTUNITY]: [
    { field: 'estimatedValue', label: 'opportunity.card.stats.value', iconKey: 'price', formatter: 'currency' },
    { field: 'stage', label: 'opportunity.card.stats.stage', iconKey: 'status' },
  ],
  [SEARCH_ENTITY_TYPES.TASK]: [
    { field: 'priority', label: 'task.card.stats.priority', iconKey: 'priority' },
    { field: 'dueDate', label: 'task.card.stats.dueDate', iconKey: 'calendar' },
  ],
};

// =============================================================================
// SEARCH INDEX CONFIGURATION MAP
// =============================================================================

function withPresentation(entityType: SearchEntityType): SearchIndexConfig {
  const statsFields = SEARCH_STATS_FIELDS[entityType];
  return {
    ...SEARCH_INDEX_CORE[entityType],
    requiredPermission: SEARCH_PERMISSIONS[entityType],
    ...(statsFields ? { statsFields } : {}),
  };
}

/**
 * Complete index configuration for all searchable entity types: the portable
 * indexing rules (`./search-index-core`) plus the result-card stats.
 */
export const SEARCH_INDEX_CONFIG: SearchIndexConfigMap = Object.fromEntries(
  Object.values(SEARCH_ENTITY_TYPES).map((entityType) => [entityType, withPresentation(entityType)]),
) as SearchIndexConfigMap;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get index configuration for a specific entity type.
 *
 * @param entityType - The entity type to get config for
 * @returns SearchIndexConfig or undefined if not found
 */
export function getSearchIndexConfig(entityType: SearchEntityType): SearchIndexConfig | undefined {
  return SEARCH_INDEX_CONFIG[entityType];
}

/**
 * 🏢 ENTERPRISE: Extract stats from document using config.
 * Used for parking/storage to show floor/area info in search results.
 *
 * @param doc - Document data
 * @param config - Index configuration
 * @returns Array of SearchResultStat objects
 */
export function extractStats(
  doc: Record<string, unknown>,
  config: SearchIndexConfig
): Array<{ label: string; value: string; iconKey?: string }> {
  if (!config.statsFields) return [];

  return config.statsFields
    .map((statConfig) => {
      const rawValue = doc[statConfig.field];
      if (rawValue === undefined || rawValue === null || rawValue === '') {
        return null;
      }

      let formattedValue: string;

      switch (statConfig.formatter) {
        case 'floor':
          // Format floor number (e.g., "0" → "Ισόγειο", "-1" → "Υπόγειο 1")
          formattedValue = String(rawValue);
          break;
        case 'area':
          // Format area with m² suffix
          formattedValue = `${rawValue} m²`;
          break;
        case 'currency':
          // Format as currency (basic)
          formattedValue = formatSearchCurrency(Number(rawValue));
          break;
        case 'number':
          formattedValue = Number(rawValue).toLocaleString();
          break;
        default:
          formattedValue = String(rawValue);
      }

      return {
        label: statConfig.label,
        value: formattedValue,
        iconKey: statConfig.iconKey,
      };
    })
    .filter((stat): stat is NonNullable<typeof stat> => stat !== null);
}

