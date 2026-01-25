/**
 * =============================================================================
 * 🔍 SEARCH INDEX BUILDER
 * =============================================================================
 *
 * Helper functions for building SearchDocument objects for Firestore indexing.
 * Used by indexTriggers.ts for automatic indexing on entity create/update.
 *
 * @module functions/search/indexBuilder
 * @enterprise ADR-029 - Global Search v1
 * @compliance Local_Protocol.txt - ZERO any, Centralization First
 */

import * as admin from 'firebase-admin';

// =============================================================================
// TYPES (Mirrored from src/types/search.ts - Functions can't import from main app)
// =============================================================================

/**
 * Entity types that are searchable via Global Search.
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
 * Audience types for search access control.
 */
export const SEARCH_AUDIENCE = {
  INTERNAL: 'internal',
  EXTERNAL: 'external',
} as const;

export type SearchAudience = typeof SEARCH_AUDIENCE[keyof typeof SEARCH_AUDIENCE];

/**
 * Search fields for indexing and querying.
 */
export interface SearchFields {
  normalized: string;
  prefixes: string[];
}

/**
 * Navigation links for search results.
 */
export interface SearchResultLinks {
  href: string;
  routeParams: Record<string, string>;
}

/**
 * Search Document stored in Firestore.
 * Path: searchDocuments/{docId}
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
// COLLECTIONS (Mirrored from firestore-collections.ts)
// =============================================================================

export const COLLECTIONS = {
  PROJECTS: 'projects',
  BUILDINGS: 'buildings',
  UNITS: 'units',
  CONTACTS: 'contacts',
  FILES: 'files',
  SEARCH_DOCUMENTS: 'searchDocuments',
} as const;

// =============================================================================
// INDEX CONFIGURATION
// =============================================================================

/**
 * Configuration for a single field that can be used as title.
 */
type TitleFieldConfig = string | ((doc: Record<string, unknown>) => string);

/**
 * Configuration for audience field.
 */
type AudienceFieldConfig = SearchAudience | ((doc: Record<string, unknown>) => SearchAudience);

/**
 * Index configuration for a searchable entity type.
 */
interface SearchIndexConfig {
  collection: string;
  titleField: TitleFieldConfig;
  subtitleFields: string[];
  searchableFields: string[];
  statusField: string;
  audience: AudienceFieldConfig;
  requiredPermission: string;
  routeTemplate: string;
}

/**
 * Index configuration for all searchable entity types.
 */
export const SEARCH_INDEX_CONFIG: Record<SearchEntityType, SearchIndexConfig> = {
  [SEARCH_ENTITY_TYPES.PROJECT]: {
    collection: COLLECTIONS.PROJECTS,
    titleField: 'name',
    subtitleFields: ['address', 'city'],
    searchableFields: ['name', 'address', 'city', 'projectCode'],
    statusField: 'status',
    audience: SEARCH_AUDIENCE.INTERNAL,
    requiredPermission: 'projects:projects:view',
    routeTemplate: '/projects/{id}',
  },
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
    requiredPermission: 'buildings:buildings:view',
    routeTemplate: '/buildings/{id}',
  },
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
    requiredPermission: 'units:units:view',
    routeTemplate: '/units/{id}',
  },
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
    requiredPermission: 'crm:contacts:view',
    routeTemplate: '/contacts/{id}',
  },
  [SEARCH_ENTITY_TYPES.FILE]: {
    collection: COLLECTIONS.FILES,
    titleField: 'displayName',
    subtitleFields: ['category', 'domain'],
    searchableFields: ['displayName', 'originalFilename'],
    statusField: 'status',
    audience: SEARCH_AUDIENCE.INTERNAL,
    requiredPermission: 'dxf:files:view',
    routeTemplate: '/files/{id}',
  },
};

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
 *
 * @param text - Text to normalize
 * @returns Normalized text
 */
export function normalizeSearchText(text: string): string {
  if (!text) return '';

  let result = text.toLowerCase();

  // Replace Greek accented characters
  for (const [accented, base] of Object.entries(GREEK_ACCENT_MAP)) {
    result = result.replace(new RegExp(accented, 'g'), base);
  }

  // Normalize whitespace
  result = result.replace(/\s+/g, ' ').trim();

  return result;
}

/**
 * Generate prefix array from normalized text.
 * Used for Firestore array-contains queries for autocomplete.
 *
 * @param text - Normalized text
 * @param maxPrefixLength - Maximum prefix length (default 5)
 * @returns Array of prefixes
 */
export function generateSearchPrefixes(text: string, maxPrefixLength = 5): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const prefixes: Set<string> = new Set();

  for (const word of words) {
    // Generate prefixes of length 3, 4, 5
    for (let len = 3; len <= Math.min(maxPrefixLength, word.length); len++) {
      prefixes.add(word.substring(0, len));
    }
  }

  return Array.from(prefixes);
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Extract title from document using config.
 */
function extractTitle(doc: Record<string, unknown>, config: SearchIndexConfig): string {
  if (typeof config.titleField === 'function') {
    return config.titleField(doc);
  }
  return (doc[config.titleField] as string) || '';
}

/**
 * Extract subtitle from document using config.
 */
function extractSubtitle(doc: Record<string, unknown>, config: SearchIndexConfig): string {
  return config.subtitleFields
    .map((field) => doc[field] as string | undefined)
    .filter(Boolean)
    .join(' - ');
}

/**
 * Determine audience from document using config.
 */
function determineAudience(doc: Record<string, unknown>, config: SearchIndexConfig): SearchAudience {
  if (typeof config.audience === 'function') {
    return config.audience(doc);
  }
  return config.audience;
}

/**
 * Build navigation href from template and entity ID.
 */
function buildHref(config: SearchIndexConfig, entityId: string): string {
  return config.routeTemplate.replace('{id}', entityId);
}

/**
 * Extract all searchable text from document.
 */
function extractSearchableText(doc: Record<string, unknown>, config: SearchIndexConfig): string {
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
 *
 * @param entityType - Type of entity
 * @param entityId - Entity document ID
 * @param data - Entity document data
 * @returns SearchDocumentInput ready for Firestore
 */
export function buildSearchDocument(
  entityType: SearchEntityType,
  entityId: string,
  data: Record<string, unknown>
): SearchDocumentInput | null {
  const config = SEARCH_INDEX_CONFIG[entityType];
  if (!config) {
    console.warn(`No index config for entity type: ${entityType}`);
    return null;
  }

  // Extract tenant ID (companyId)
  const tenantId = (data.companyId as string) || (data.tenantId as string);
  if (!tenantId) {
    console.warn(`Missing tenantId/companyId for ${entityType}/${entityId}`);
    return null;
  }

  // Extract fields
  const title = extractTitle(data, config);
  const subtitle = extractSubtitle(data, config);
  const status = (data[config.statusField] as string) || 'active';
  const audience = determineAudience(data, config);

  // Build search fields
  const searchableText = extractSearchableText(data, config);
  const normalizedText = normalizeSearchText(searchableText);
  const prefixes = generateSearchPrefixes(normalizedText);

  // Build navigation links
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
 *
 * @param input - SearchDocumentInput
 * @returns SearchDocument with server timestamps
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
 *
 * @param entityType - Entity type
 * @param entityId - Entity ID
 * @returns Document ID for searchDocuments collection
 */
export function generateSearchDocId(entityType: SearchEntityType, entityId: string): string {
  return `${entityType}_${entityId}`;
}
