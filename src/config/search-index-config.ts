/**
 * =============================================================================
 * 🔍 SEARCH INDEX CONFIGURATION
 * =============================================================================
 *
 * Enterprise-grade configuration for Global Search indexing.
 * Defines how each entity type is indexed for search.
 *
 * @module config/search-index-config
 * @enterprise ADR-XXX - Global Search v1 (Non-AI)
 * @compliance Local_Protocol.txt - Centralization First, ZERO hardcoded
 *
 * @see docs/adr/global-search-v1.md
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import type { PermissionId } from '@/lib/auth/types';
import {
  SEARCH_ENTITY_TYPES,
  SEARCH_AUDIENCE,
  type SearchEntityType,
  type SearchIndexConfig,
  type SearchIndexConfigMap,
} from '@/types/search';

// =============================================================================
// SEARCH INDEX CONFIGURATION MAP
// =============================================================================

/**
 * Complete index configuration for all searchable entity types.
 *
 * @enterprise
 * - Uses centralized COLLECTIONS constants
 * - Uses centralized PERMISSIONS from auth/types.ts
 * - Follows consistent patterns across all entities
 */
export const SEARCH_INDEX_CONFIG: SearchIndexConfigMap = {
  // =========================================================================
  // PROJECT
  // =========================================================================
  [SEARCH_ENTITY_TYPES.PROJECT]: {
    collection: COLLECTIONS.PROJECTS,
    titleField: 'name',
    subtitleFields: ['address', 'city'],
    searchableFields: ['name', 'address', 'city', 'projectCode'],
    statusField: 'status',
    audience: SEARCH_AUDIENCE.INTERNAL,
    requiredPermission: 'projects:projects:view' satisfies PermissionId,
    routeTemplate: '/projects/{id}',
  },

  // =========================================================================
  // BUILDING
  // =========================================================================
  [SEARCH_ENTITY_TYPES.BUILDING]: {
    collection: COLLECTIONS.BUILDINGS,
    titleField: 'name',
    subtitleFields: ['address'],
    searchableFields: ['name', 'address', 'buildingCode'],
    statusField: 'status',
    audience: (doc) => {
      const isPublished = doc.isPublished as boolean | undefined;
      return isPublished ? SEARCH_AUDIENCE.EXTERNAL : SEARCH_AUDIENCE.INTERNAL;
    },
    requiredPermission: 'buildings:buildings:view' satisfies PermissionId,
    routeTemplate: '/buildings/{id}',
  },

  // =========================================================================
  // UNIT
  // =========================================================================
  [SEARCH_ENTITY_TYPES.UNIT]: {
    collection: COLLECTIONS.UNITS,
    titleField: 'name',
    subtitleFields: ['floor', 'type'],
    searchableFields: ['name', 'unitCode', 'floor'],
    statusField: 'status',
    audience: (doc) => {
      const isPublished = doc.isPublished as boolean | undefined;
      return isPublished ? SEARCH_AUDIENCE.EXTERNAL : SEARCH_AUDIENCE.INTERNAL;
    },
    requiredPermission: 'units:units:view' satisfies PermissionId,
    routeTemplate: '/units/{id}',
  },

  // =========================================================================
  // CONTACT
  // =========================================================================
  [SEARCH_ENTITY_TYPES.CONTACT]: {
    collection: COLLECTIONS.CONTACTS,
    titleField: (doc) => {
      const displayName = doc.displayName as string | undefined;
      const firstName = doc.firstName as string | undefined;
      const lastName = doc.lastName as string | undefined;
      return displayName || `${firstName || ''} ${lastName || ''}`.trim() || 'Unknown';
    },
    subtitleFields: ['email', 'phone'],
    searchableFields: ['displayName', 'firstName', 'lastName', 'email', 'companyName'],
    statusField: 'status',
    audience: SEARCH_AUDIENCE.INTERNAL,
    requiredPermission: 'crm:contacts:view' satisfies PermissionId,
    routeTemplate: '/contacts/{id}',
  },

  // =========================================================================
  // FILE
  // =========================================================================
  [SEARCH_ENTITY_TYPES.FILE]: {
    collection: COLLECTIONS.FILES,
    titleField: 'displayName',
    subtitleFields: ['category', 'domain'],
    searchableFields: ['displayName', 'originalFilename'],
    statusField: 'status',
    audience: SEARCH_AUDIENCE.INTERNAL,
    requiredPermission: 'dxf:files:view' satisfies PermissionId,
    routeTemplate: '/files/{id}',
  },
};

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
 * Get all searchable entity types.
 *
 * @returns Array of all SearchEntityType values
 */
export function getAllSearchableEntityTypes(): SearchEntityType[] {
  return Object.values(SEARCH_ENTITY_TYPES);
}

/**
 * Extract title from document using config.
 *
 * @param doc - Document data
 * @param config - Index configuration
 * @returns Extracted title string
 */
export function extractTitle(
  doc: Record<string, unknown>,
  config: SearchIndexConfig
): string {
  if (typeof config.titleField === 'function') {
    return config.titleField(doc);
  }
  return (doc[config.titleField] as string) || '';
}

/**
 * Extract subtitle from document using config.
 *
 * @param doc - Document data
 * @param config - Index configuration
 * @returns Extracted subtitle string (joined with ' - ')
 */
export function extractSubtitle(
  doc: Record<string, unknown>,
  config: SearchIndexConfig
): string {
  return config.subtitleFields
    .map((field) => doc[field] as string | undefined)
    .filter(Boolean)
    .join(' - ');
}

/**
 * Determine audience from document using config.
 *
 * @param doc - Document data
 * @param config - Index configuration
 * @returns SearchAudience value
 */
export function determineAudience(
  doc: Record<string, unknown>,
  config: SearchIndexConfig
): typeof SEARCH_AUDIENCE[keyof typeof SEARCH_AUDIENCE] {
  if (typeof config.audience === 'function') {
    return config.audience(doc);
  }
  return config.audience;
}

/**
 * Build navigation href from template and entity ID.
 *
 * @param config - Index configuration
 * @param entityId - Entity ID
 * @returns Resolved href string
 */
export function buildSearchResultHref(
  config: SearchIndexConfig,
  entityId: string
): string {
  return config.routeTemplate.replace('{id}', entityId);
}

/**
 * Get all searchable fields for an entity type.
 *
 * @param entityType - The entity type
 * @returns Array of searchable field names
 */
export function getSearchableFields(entityType: SearchEntityType): string[] {
  const config = SEARCH_INDEX_CONFIG[entityType];
  return config?.searchableFields ?? [];
}

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Validate that a config has all required fields.
 *
 * @param config - Config to validate
 * @returns true if valid, false otherwise
 */
export function isValidSearchIndexConfig(config: unknown): config is SearchIndexConfig {
  if (!config || typeof config !== 'object') return false;

  const c = config as Record<string, unknown>;

  return (
    typeof c.collection === 'string' &&
    (typeof c.titleField === 'string' || typeof c.titleField === 'function') &&
    Array.isArray(c.subtitleFields) &&
    Array.isArray(c.searchableFields) &&
    typeof c.statusField === 'string' &&
    (typeof c.audience === 'string' || typeof c.audience === 'function') &&
    typeof c.requiredPermission === 'string' &&
    typeof c.routeTemplate === 'string'
  );
}
