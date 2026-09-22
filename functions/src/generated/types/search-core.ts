// ⚠️ GENERATED — DO NOT EDIT. Verbatim projection of src/types/search-core.ts (ADR-874 · CHECK 3.93).
// Edit the source, then run: npm run generate:functions-projection
// sha256:00184be597c73f1e35301b19d970f8e51b1385c62f92dff95236a7fc0c017ae0

/**
 * =============================================================================
 * 🔍 GLOBAL SEARCH — PORTABLE CORE TYPES (ADR-029 · ADR-874)
 * =============================================================================
 *
 * The part of the search vocabulary that the **indexer** needs: which entity
 * types exist, who may see a result, and the shape of an indexing rule.
 *
 * ⚠️ PORTABLE MODULE — projected verbatim into `functions/src/generated/` by
 * `npm run generate:functions-projection` (CHECK 3.93). Rules that keep it
 * portable, enforced by the generator:
 *   - only RELATIVE imports, and only of other projected modules;
 *   - no `@/` alias, no app-only types (`PermissionId`, `WorkspaceHref`, …).
 * Presentation concerns (stats fields, permission typing) live in
 * `./search.ts`, which re-exports everything declared here.
 *
 * @module types/search-core
 */

// =============================================================================
// SEARCH ENTITY TYPES (Subset of ENTITY_TYPES for searchable entities)
// =============================================================================

/**
 * Entity types that are searchable via Global Search.
 * Subset of ENTITY_TYPES from domain-constants.ts
 */
export const SEARCH_ENTITY_TYPES = {
  PROJECT: 'project',
  BUILDING: 'building',
  FLOOR: 'floor',
  PROPERTY: 'property',
  CONTACT: 'contact',
  FILE: 'file',
  PARKING: 'parking',
  STORAGE: 'storage',
  // ADR-029 Global Search v1 Phase 2 - CRM Entities
  OPPORTUNITY: 'opportunity',
  COMMUNICATION: 'communication',
  TASK: 'task',
} as const;

export type SearchEntityType = typeof SEARCH_ENTITY_TYPES[keyof typeof SEARCH_ENTITY_TYPES];

/**
 * Type guard to check if a string is a valid SearchEntityType
 */
export function isSearchEntityType(value: string): value is SearchEntityType {
  return Object.values(SEARCH_ENTITY_TYPES).includes(value as SearchEntityType);
}

// =============================================================================
// SEARCH AUDIENCE (Access Control)
// =============================================================================

/**
 * Audience types for search access control.
 * - internal: Only authenticated users with proper permissions
 * - external: Public inventory (published units/buildings)
 */
export const SEARCH_AUDIENCE = {
  INTERNAL: 'internal',
  EXTERNAL: 'external',
} as const;

export type SearchAudience = typeof SEARCH_AUDIENCE[keyof typeof SEARCH_AUDIENCE];

// =============================================================================
// INDEXING RULE
// =============================================================================

/**
 * Configuration for a single field that can be used as title.
 * Can be a simple field name or a function for computed titles.
 */
export type TitleFieldConfig = string | ((doc: Record<string, unknown>) => string);

/**
 * Configuration for audience field.
 * Can be a static value or a function for dynamic audience.
 */
export type AudienceFieldConfig = SearchAudience | ((doc: Record<string, unknown>) => SearchAudience);

/**
 * How one searchable entity type is written into `search_documents`.
 * Everything the indexer reads — and nothing the result card renders.
 */
export interface SearchIndexCoreConfig {
  /** Firestore collection name */
  collection: string;

  /** Field(s) to use as title */
  titleField: TitleFieldConfig;

  /** Field(s) to use as subtitle */
  subtitleFields: string[];

  /** Fields to include in search index */
  searchableFields: string[];

  /** Field containing entity status */
  statusField: string;

  /** Audience type or function */
  audience: AudienceFieldConfig;

  /** Required permission to view results */
  requiredPermission: string;

  /** Route template with {id} placeholder (other {field} placeholders read the source doc) */
  routeTemplate: string;
}
