/**
 * =============================================================================
 * 🔍 SEARCH INDEX BUILDER
 * =============================================================================
 *
 * Helper functions for building SearchDocument objects for Firestore indexing.
 * Used by indexTriggers.ts for automatic indexing on entity create/update.
 *
 * Rules, entity types, text normalization and prefixes are NOT written here:
 * they are the app SSoT (`src/config/search-index-core.ts`, `src/lib/search/search.ts`),
 * projected into `../generated/` (ADR-874, CHECK 3.93). The app's `/api/search`
 * normalizes the QUERY with the same function that normalizes the INDEX here.
 *
 * @module functions/search/indexBuilder
 * @enterprise ADR-029 — Global Search v1
 */

import * as admin from 'firebase-admin';

import {
  SEARCH_ENTITY_TYPES,
  SEARCH_AUDIENCE,
  type SearchEntityType,
  type SearchAudience,
  type SearchIndexCoreConfig,
} from '../generated/types/search-core';
import {
  SEARCH_INDEX_CORE,
  extractTitle,
  extractSubtitle,
  determineAudience,
  extractSearchableText,
  extractStatus,
  buildSearchResultHref,
  generateSearchDocId,
} from '../generated/config/search-index-core';
import { normalizeSearchText, generateSearchPrefixes } from '../generated/lib/search/search';

/** The indexing rules — THE app SSoT, projected (ADR-874). */
const SEARCH_INDEX_CONFIG = SEARCH_INDEX_CORE;
type SearchIndexConfig = SearchIndexCoreConfig;

// Re-exports so `indexTriggers.ts` and other callers keep a stable import surface
export { SEARCH_ENTITY_TYPES, SEARCH_AUDIENCE, SEARCH_INDEX_CONFIG, generateSearchDocId };
export type { SearchEntityType, SearchAudience, SearchIndexConfig };
export { COLLECTIONS } from '../config/firestore-collections';

// =============================================================================
// SEARCH DOCUMENT WIRE FORMAT
// =============================================================================

export interface SearchFields {
  normalized: string;
  prefixes: string[];
}

export interface SearchResultLinks {
  href: string;
  routeParams: Record<string, string>;
}

/**
 * Search Document stored in Firestore.
 * Path: search_documents/{docId}
 * docId Format: {entityType}_{entityId}
 */
export interface SearchDocument {
  tenantId: string;
  entityType: SearchEntityType;
  entityId: string;
  title: string;
  subtitle: string;
  status: string;
  updatedAt: FirebaseFirestore.FieldValue;
  search: SearchFields;
  audience: SearchAudience;
  requiredPermission: string;
  links: SearchResultLinks;
  createdAt: FirebaseFirestore.FieldValue;
  indexedAt: FirebaseFirestore.FieldValue;
}

/**
 * Input for creating a SearchDocument (without server-generated timestamps).
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
// MAIN BUILDER FUNCTION
// =============================================================================

/**
 * Build a SearchDocument from entity data.
 */
export function buildSearchDocument(
  entityType: SearchEntityType,
  entityId: string,
  data: Record<string, unknown>,
): SearchDocumentInput | null {
  const config = SEARCH_INDEX_CONFIG[entityType];
  if (!config) {
    console.warn(`No index config for entity type: ${entityType}`);
    return null;
  }

  const tenantId = (data.companyId as string) || (data.tenantId as string);
  if (!tenantId) {
    console.warn(`Missing tenantId/companyId for ${entityType}/${entityId}`);
    return null;
  }

  const title = extractTitle(data, config);
  const subtitle = extractSubtitle(data, config);
  const status = extractStatus(data, config);
  const audience = determineAudience(data, config);

  const searchableText = extractSearchableText(data, config);
  const normalizedText = normalizeSearchText(searchableText);
  const prefixes = generateSearchPrefixes(normalizedText);

  const href = buildSearchResultHref(config, entityId, data);

  return {
    tenantId,
    entityType,
    entityId,
    title,
    subtitle,
    status,
    search: {
      normalized: normalizedText,
      prefixes,
    },
    audience,
    requiredPermission: config.requiredPermission,
    links: {
      href,
      routeParams: { id: entityId },
    },
  };
}

/**
 * Create full SearchDocument with timestamps.
 */
export function createSearchDocument(input: SearchDocumentInput): SearchDocument {
  return {
    ...input,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    indexedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
}
