/**
 * =============================================================================
 * 🔍 SEARCH INDEX BUILDER
 * =============================================================================
 *
 * Helper functions for building SearchDocument objects for Firestore indexing.
 * Used by indexTriggers.ts for automatic indexing on entity create/update.
 *
 * Config + entity-type constants are owned by `./search-config.mirror.ts`
 * (the SSoT mirror of `src/config/search-index-config.ts` — ADR-029).
 *
 * @module functions/search/indexBuilder
 * @enterprise ADR-029 — Global Search v1
 */

import * as admin from 'firebase-admin';

import {
  SEARCH_ENTITY_TYPES,
  SEARCH_AUDIENCE,
  SEARCH_INDEX_CONFIG,
  type SearchEntityType,
  type SearchAudience,
  type SearchIndexConfig,
} from './search-config.mirror';

// Re-exports so `indexTriggers.ts` and other callers keep a stable import surface
export { SEARCH_ENTITY_TYPES, SEARCH_AUDIENCE, SEARCH_INDEX_CONFIG };
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
// TEXT NORMALIZATION (Greek-friendly)
// =============================================================================

/**
 * Greek accent mapping for normalization.
 * Maps accented characters to their base form.
 */
const GREEK_ACCENT_MAP: Record<string, string> = {
  'ά': 'α', 'έ': 'ε', 'ή': 'η', 'ί': 'ι', 'ό': 'ο', 'ύ': 'υ', 'ώ': 'ω',
  'Ά': 'α', 'Έ': 'ε', 'Ή': 'η', 'Ί': 'ι', 'Ό': 'ο', 'Ύ': 'υ', 'Ώ': 'ω',
  'ϊ': 'ι', 'ϋ': 'υ', 'ΐ': 'ι', 'ΰ': 'υ',
};

/**
 * Normalize text for Greek-friendly search.
 * - Converts to lowercase
 * - Removes accents/diacritics
 * - Normalizes whitespace
 */
export function normalizeSearchText(text: string): string {
  if (!text) return '';

  let result = text.toLowerCase();

  for (const [accented, base] of Object.entries(GREEK_ACCENT_MAP)) {
    result = result.replace(new RegExp(accented, 'g'), base);
  }

  result = result.replace(/\s+/g, ' ').trim();

  return result;
}

/**
 * Generate prefix array from normalized text.
 * Used for Firestore array-contains queries for autocomplete.
 */
export function generateSearchPrefixes(text: string, maxPrefixLength = 5): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const prefixes: Set<string> = new Set();

  for (const word of words) {
    for (let len = 3; len <= Math.min(maxPrefixLength, word.length); len++) {
      prefixes.add(word.substring(0, len));
    }
  }

  return Array.from(prefixes);
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function extractTitle(doc: Record<string, unknown>, config: SearchIndexConfig): string {
  if (typeof config.titleField === 'function') {
    return config.titleField(doc);
  }
  return (doc[config.titleField] as string) || '';
}

function extractSubtitle(doc: Record<string, unknown>, config: SearchIndexConfig): string {
  return config.subtitleFields
    .map((field) => doc[field] as string | undefined)
    .filter(Boolean)
    .join(' - ');
}

function determineAudience(
  doc: Record<string, unknown>,
  config: SearchIndexConfig,
): SearchAudience {
  if (typeof config.audience === 'function') {
    return config.audience(doc);
  }
  return config.audience;
}

function buildHref(config: SearchIndexConfig, entityId: string): string {
  return config.routeTemplate.replace('{id}', entityId);
}

function extractSearchableText(
  doc: Record<string, unknown>,
  config: SearchIndexConfig,
): string {
  const parts: string[] = [];

  for (const field of config.searchableFields) {
    const value = doc[field];
    if (typeof value === 'string' && value.trim()) {
      parts.push(value);
    }
  }

  return parts.join(' ');
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
  const status = (data[config.statusField] as string) || 'active';
  const audience = determineAudience(data, config);

  const searchableText = extractSearchableText(data, config);
  const normalizedText = normalizeSearchText(searchableText);
  const prefixes = generateSearchPrefixes(normalizedText);

  const href = buildHref(config, entityId);

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

/**
 * Generate document ID for search document.
 * Format: {entityType}_{entityId}
 */
export function generateSearchDocId(entityType: SearchEntityType, entityId: string): string {
  return `${entityType}_${entityId}`;
}
