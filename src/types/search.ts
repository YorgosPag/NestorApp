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

import type { WorkspaceHref } from '@/lib/workspace/route-worlds';
import type { Timestamp } from 'firebase/firestore';
import type { CommitVersion } from '@/lib/search/search-index-version';

// =============================================================================
// PORTABLE CORE (ADR-874) — entity types, audience, indexing rule
// =============================================================================

// The indexer's vocabulary lives in `./search-core` so that the Cloud Functions
// build receives it by projection (CHECK 3.93) instead of a hand-kept mirror.
import type { SearchEntityType, SearchAudience, SearchIndexCoreConfig } from './search-core';

export {
  SEARCH_ENTITY_TYPES,
  SEARCH_AUDIENCE,
  isSearchEntityType,
  type SearchEntityType,
  type SearchAudience,
  type TitleFieldConfig,
  type AudienceFieldConfig,
  type SearchIndexCoreConfig,
} from './search-core';

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
  href: WorkspaceHref;

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

  /**
   * 🏢 ENTERPRISE: Raw entity data for card display
   * Stores floor, area, price, etc. for stats display in search results
   * @see ADR-029 Global Search v1
   */
  metadata?: {
    floor?: string | number;
    area?: number;
    price?: number;
    type?: string;
  };

  // === Έκδοση & ταφόπλακα (ADR-873 Φ1 §9.1.2) ===
  /**
   * Η έκδοση commit της **πηγής** που παρήγαγε αυτή την εγγραφή.
   *
   * Πάνω της κρίνεται ποια γραφή κερδίζει όταν δύο παρατηρητές της ίδιας αλλαγής φτάνουν
   * ανάποδα. Λείπει σε εγγραφές γραμμένες πριν το ADR-873 — ο κριτής το διαβάζει ως «άγνωστη».
   */
  sourceUpdateTime?: CommitVersion | null;

  /**
   * Ταφόπλακα: η οντότητα διαγράφηκε σε αυτή την έκδοση.
   *
   * Η εγγραφή μένει επίτηδες, με **κενά** `search.prefixes` — δηλαδή δομικά αόρατη στο
   * ερώτημα — ώστε ένα καθυστερημένο γεγονός να βρίσκει έκδοση να συγκριθεί μαζί της αντί για
   * κενό. Σβήνεται μόνη της με TTL. Ποτέ σε ζωντανή εγγραφή.
   */
  deleted?: boolean;
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
  /**
   * 🏢 ENTERPRISE: Raw entity metadata for stats display
   * Used for floor, area, price in parking/storage cards
   * @see ADR-029 Global Search v1
   */
  metadata?: {
    floor?: string | number;
    area?: number;
    price?: number;
    type?: string;
  };
}

// =============================================================================
// SEARCH API TYPES (Request/Response)
// =============================================================================

/**
 * Search result stat item for display in cards.
 * Matches the StatItem interface from design system.
 */
export interface SearchResultStat {
  /** Stat label */
  label: string;
  /** Stat value */
  value: string;
  /** Icon key from NAVIGATION_ENTITIES (e.g., 'floor', 'area', 'price') */
  iconKey?: string;
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
  href: WorkspaceHref;

  /**
   * 🏢 ENTERPRISE: Entity status for badge display
   * e.g., 'available', 'sold', 'reserved' for parking/storage
   * @see ADR-029 Global Search v1
   */
  status?: string;

  /**
   * 🏢 ENTERPRISE: Optional stats for display (floor, area, price, etc.)
   * Used by ListCard to show additional info like ParkingListCard does
   * @see ADR-029 Global Search v1
   */
  stats?: SearchResultStat[];
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
 * Stats field configuration for search results.
 * Maps document fields to display stats.
 */
export interface SearchStatsFieldConfig {
  /** Document field to read value from */
  field: string;
  /** Label for the stat (i18n key or literal) */
  label: string;
  /** Icon key from NAVIGATION_ENTITIES */
  iconKey: string;
  /** Optional formatter: 'floor' | 'area' | 'currency' | 'number' */
  formatter?: 'floor' | 'area' | 'currency' | 'number';
}

/**
 * Index configuration for a searchable entity type.
 *
 * @enterprise Centralized configuration pattern
 */
export interface SearchIndexConfig extends SearchIndexCoreConfig {
  /**
   * 🏢 ENTERPRISE: Optional stats fields for card display
   * Used for parking, storage, units to show floor/area/price
   * @see ADR-029 Global Search v1
   */
  statsFields?: SearchStatsFieldConfig[];
}

/**
 * Complete index configuration map for all searchable entity types.
 */
export type SearchIndexConfigMap = Record<SearchEntityType, SearchIndexConfig>;

// =============================================================================
// TYPE GUARDS
// =============================================================================

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
