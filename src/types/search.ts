/**
 * =============================================================================
 * 🔍 GLOBAL SEARCH v1 - TYPE DEFINITIONS
 * =============================================================================
 *
 * Enterprise-grade type definitions for Global Search functionality.
 * Provides compile-time safety for all search operations.
 *
 * @module types/search
 * @enterprise ADR-XXX - Global Search v1 (Non-AI)
 * @compliance Local_Protocol.txt - ZERO any, Type Safety
 *
 * @see docs/adr/global-search-v1.md
 */

import type { Timestamp } from 'firebase/firestore';

// =============================================================================
// SEARCH ENTITY TYPES (Subset of ENTITY_TYPES for searchable entities)
// =============================================================================

/**
 * Entity types that are searchable via Global Search.
 * Subset of ENTITY_TYPES from domain-constants.ts
 *
 * @enterprise Uses centralized domain constants pattern
 */
export const SEARCH_ENTITY_TYPES = {
  PROJECT: 'project',
  BUILDING: 'building',
  UNIT: 'unit',
  CONTACT: 'contact',
  FILE: 'file',
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
// SEARCH DOCUMENT (Firestore Document Schema)
// =============================================================================

/**
 * Search fields for indexing and querying.
 * Contains normalized text and prefix arrays for Firestore-native search.
 */
export interface SearchFields {
  /**
   * Greek-normalized concatenated searchable text.
   * Generated using normalizeSearchText from src/lib/search/search.ts
   */
  normalized: string;

  /**
   * First 3-5 characters of each word for prefix search.
   * Enables Firestore array-contains queries for autocomplete.
   */
  prefixes: string[];
}

/**
 * Navigation links for search results.
 * Provides direct navigation to entity detail pages.
 */
export interface SearchResultLinks {
  /** Route path: '/contacts/abc123' */
  href: string;

  /** Route parameters for dynamic routes */
  routeParams: Record<string, string>;
}

/**
 * Search Document stored in Firestore.
 * Path: /tenants/{tenantId}/searchDocuments/{docId}
 * docId Format: {entityType}_{entityId} (e.g., 'contact_abc123')
 *
 * @enterprise Tenant isolation via tenantId (companyId)
 */
export interface SearchDocument {
  // === Identity ===
  /** Tenant ID (companyId) - tenant isolation anchor */
  tenantId: string;

  /** Entity type for grouping and filtering */
  entityType: SearchEntityType;

  /** Original entity ID (Firestore document ID) */
  entityId: string;

  // === Display Fields ===
  /** Primary display text (name, displayName) */
  title: string;

  /** Secondary info (address, email, status) */
  subtitle: string;

  /** Entity status for filtering */
  status: string;

  /** Last update timestamp for freshness sorting */
  updatedAt: Timestamp;

  // === Search Fields ===
  /** Indexed search fields */
  search: SearchFields;

  // === Access Control ===
  /** Audience type (internal/external) */
  audience: SearchAudience;

  /** Required permission to view this result */
  requiredPermission: string;

  // === Navigation ===
  /** Navigation links */
  links: SearchResultLinks;

  // === Metadata ===
  /** Document creation timestamp */
  createdAt: Timestamp;

  /** Last indexing timestamp */
  indexedAt: Timestamp;
}

/**
 * Search Document input for creation/update (without server-generated fields).
 */
export interface SearchDocumentInput {
  tenantId: string;
  entityType: SearchEntityType;
  entityId: string;
  title: string;
  subtitle: string;
  status: string;
  search: SearchFields;
  audience: SearchAudience;
  requiredPermission: string;
  links: SearchResultLinks;
}

// =============================================================================
// SEARCH API TYPES (Request/Response)
// =============================================================================

/**
 * Search API query parameters.
 */
export interface SearchQueryParams {
  /** Search query string */
  q: string;

  /** Entity types to filter (comma-separated) */
  types?: string;

  /** Results per type (default: 10, max: 50) */
  limit?: number;
}

/**
 * Single search result returned by the API.
 */
export interface SearchResult {
  /** Entity type */
  entityType: SearchEntityType;

  /** Entity ID */
  entityId: string;

  /** Primary display text */
  title: string;

  /** Secondary info */
  subtitle: string;

  /** Navigation href */
  href: string;
}

/**
 * Search API successful response.
 */
export interface SearchSuccessResponse {
  success: true;
  results: SearchResult[];
  query: {
    normalized: string;
    types?: SearchEntityType[];
  };
}

/**
 * Search API error response.
 */
export interface SearchErrorResponse {
  success: false;
  error: string;
  errorCode?: string;
}

/**
 * Union type for Search API response.
 */
export type SearchResponse = SearchSuccessResponse | SearchErrorResponse;

// =============================================================================
// SEARCH AUDIT TYPES
// =============================================================================

/**
 * Audit event metadata for search operations.
 * Logged to /companies/{companyId}/audit_logs/
 *
 * @enterprise Privacy-conscious: does NOT log actual query text
 */
export interface SearchAuditMetadata {
  /** Query length (NOT the actual query for privacy) */
  queryLength: number;

  /** Number of results returned */
  resultCount: number;

  /** Entity types searched */
  entityTypes: SearchEntityType[];

  /** Audience type */
  audience: SearchAudience;
}

// =============================================================================
// SEARCH CONFIGURATION TYPES
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
 * Index configuration for a searchable entity type.
 *
 * @enterprise Centralized configuration pattern
 */
export interface SearchIndexConfig {
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

  /** Route template with {id} placeholder */
  routeTemplate: string;
}

/**
 * Complete index configuration map for all searchable entity types.
 */
export type SearchIndexConfigMap = Record<SearchEntityType, SearchIndexConfig>;

// =============================================================================
// TYPE GUARDS
// =============================================================================

/**
 * Type guard for SearchSuccessResponse
 */
export function isSearchSuccessResponse(response: SearchResponse): response is SearchSuccessResponse {
  return response.success === true;
}

/**
 * Type guard for SearchErrorResponse
 */
export function isSearchErrorResponse(response: SearchResponse): response is SearchErrorResponse {
  return response.success === false;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Search API configuration constants.
 *
 * @enterprise Centralized constants pattern
 */
export const SEARCH_CONFIG = {
  /** Default results per entity type */
  DEFAULT_LIMIT: 10,

  /** Maximum results per entity type */
  MAX_LIMIT: 50,

  /** Client-side debounce in milliseconds */
  DEBOUNCE_MS: 300,

  /** SWR cache TTL in milliseconds (5 minutes) */
  CACHE_TTL_MS: 5 * 60 * 1000,

  /** Minimum query length to execute search */
  MIN_QUERY_LENGTH: 2,

  /** Maximum prefix length for array-contains */
  MAX_PREFIX_LENGTH: 5,
} as const;
