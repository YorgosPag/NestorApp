/**
 * =============================================================================
 * SEARCH INDEX CONFIGURATION - Single Source of Truth (ADR-029)
 * =============================================================================
 *
 * Contains:
 * - Search index config for all entity types
 * - Greek-friendly text normalization
 * - Search document field extraction helpers
 * - Search prefix generation
 *
 * @module api/admin/search-backfill/search-index-config
 * @enterprise ADR-029 - Global Search v1
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import {
  SEARCH_AUDIENCE,
  type SearchAudience,
  type SearchEntityType,
  type SearchIndexConfig,
} from '@/types/search';

// =============================================================================
// INDEX CONFIG - SSoT for all entity type search configurations
// =============================================================================

export const SEARCH_INDEX_CONFIG: Record<SearchEntityType, SearchIndexConfig> = {
  project: {
    collection: COLLECTIONS.PROJECTS,
    titleField: 'name',
    subtitleFields: ['address', 'city'],
    searchableFields: ['name', 'address', 'city', 'projectCode'],
    statusField: 'status',
    audience: SEARCH_AUDIENCE.INTERNAL,
    requiredPermission: 'projects:projects:view',
    routeTemplate: '/projects?projectId={id}&selected=true',
  },
  building: {
    collection: COLLECTIONS.BUILDINGS,
    titleField: 'name',
    subtitleFields: ['address'],
    searchableFields: ['name', 'address', 'buildingCode'],
    statusField: 'status',
    audience: (doc) => (doc.isPublished ? SEARCH_AUDIENCE.EXTERNAL : SEARCH_AUDIENCE.INTERNAL),
    requiredPermission: 'buildings:buildings:view',
    routeTemplate: '/buildings?buildingId={id}&selected=true',
  },
  property: {
    collection: COLLECTIONS.PROPERTIES,
    titleField: 'name',
    subtitleFields: ['floor', 'type'],
    searchableFields: ['name', 'propertyCode', 'floor'],
    statusField: 'status',
    audience: (doc: Record<string, unknown>) => (doc.isPublished ? SEARCH_AUDIENCE.EXTERNAL : SEARCH_AUDIENCE.INTERNAL),
    requiredPermission: 'properties:properties:view',
    routeTemplate: '/properties?propertyId={id}&selected=true',
  },
  contact: {
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
    routeTemplate: '/contacts?contactId={id}&selected=true',
  },
  file: {
    collection: COLLECTIONS.FILES,
    titleField: 'displayName',
    subtitleFields: ['category', 'domain'],
    searchableFields: ['displayName', 'originalFilename'],
    statusField: 'status',
    audience: SEARCH_AUDIENCE.INTERNAL,
    requiredPermission: 'dxf:files:view',
    routeTemplate: '/files?fileId={id}&selected=true',
  },
  parking: {
    collection: COLLECTIONS.PARKING_SPACES,
    titleField: 'number',
    subtitleFields: ['floor', 'type'],
    searchableFields: ['number', 'type', 'floor', 'location', 'notes'],
    statusField: 'status',
    audience: SEARCH_AUDIENCE.INTERNAL,
    requiredPermission: 'spaces:parking:view',
    routeTemplate: '/spaces/parking?parkingId={id}&selected=true',
  },
  storage: {
    collection: COLLECTIONS.STORAGE,
    titleField: (doc) => {
      const name = doc.name as string | undefined;
      const code = doc.code as string | undefined;
      const identifier = doc.identifier as string | undefined;
      return name || code || identifier || 'Unknown';
    },
    subtitleFields: ['floor', 'type'],
    searchableFields: ['name', 'code', 'identifier', 'floor', 'notes'],
    statusField: 'status',
    audience: SEARCH_AUDIENCE.INTERNAL,
    requiredPermission: 'spaces:storage:view',
    routeTemplate: '/spaces/storages?storageId={id}&selected=true',
  },
  // ADR-029 Global Search v1 Phase 2 - CRM Entities
  opportunity: {
    collection: COLLECTIONS.OPPORTUNITIES,
    titleField: 'title',
    subtitleFields: ['stage', 'status'],
    searchableFields: ['title', 'fullName', 'email', 'phone', 'notes'],
    statusField: 'status',
    audience: SEARCH_AUDIENCE.INTERNAL,
    requiredPermission: 'crm:opportunities:view',
    routeTemplate: '/crm/opportunities?opportunityId={id}&selected=true',
  },
  communication: {
    collection: COLLECTIONS.COMMUNICATIONS,
    titleField: (doc) => {
      const subject = doc.subject as string | undefined;
      const type = doc.type as string | undefined;
      return subject || `${type || 'communication'}`;
    },
    subtitleFields: ['type', 'direction'],
    searchableFields: ['subject', 'content', 'from', 'to'],
    statusField: 'status',
    audience: SEARCH_AUDIENCE.INTERNAL,
    requiredPermission: 'crm:communications:view',
    routeTemplate: '/crm/communications?communicationId={id}&selected=true',
  },
  task: {
    collection: COLLECTIONS.TASKS,
    titleField: 'title',
    subtitleFields: ['type', 'priority'],
    searchableFields: ['title', 'description'],
    statusField: 'status',
    audience: SEARCH_AUDIENCE.INTERNAL,
    requiredPermission: 'crm:tasks:view',
    routeTemplate: '/crm/tasks?taskId={id}&selected=true',
  },
};

// =============================================================================
// TEXT NORMALIZATION (Greek-friendly)
// =============================================================================

const GREEK_ACCENT_MAP: Record<string, string> = {
  'ά': 'α', 'έ': 'ε', 'ή': 'η', 'ί': 'ι', 'ό': 'ο', 'ύ': 'υ', 'ώ': 'ω',
  'Ά': 'α', 'Έ': 'ε', 'Ή': 'η', 'Ί': 'ι', 'Ό': 'ο', 'Ύ': 'υ', 'Ώ': 'ω',
  'ϊ': 'ι', 'ϋ': 'υ', 'ΐ': 'ι', 'ΰ': 'υ',
};

export function normalizeSearchText(text: string): string {
  if (!text) return '';
  let result = text.toLowerCase();
  for (const [accented, base] of Object.entries(GREEK_ACCENT_MAP)) {
    result = result.replace(new RegExp(accented, 'g'), base);
  }
  return result.replace(/\s+/g, ' ').trim();
}

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
// FIELD EXTRACTION HELPERS
// =============================================================================

export function extractTitle(doc: Record<string, unknown>, config: SearchIndexConfig): string {
  if (typeof config.titleField === 'function') {
    return config.titleField(doc);
  }
  return (doc[config.titleField] as string) || '';
}

export function extractSubtitle(doc: Record<string, unknown>, config: SearchIndexConfig): string {
  return config.subtitleFields
    .map((field) => doc[field] as string | undefined)
    .filter(Boolean)
    .join(' - ');
}

export function determineAudience(doc: Record<string, unknown>, config: SearchIndexConfig): SearchAudience {
  if (typeof config.audience === 'function') {
    return config.audience(doc);
  }
  return config.audience;
}

export function extractSearchableText(doc: Record<string, unknown>, config: SearchIndexConfig): string {
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
// FIRESTORE UTILITIES
// =============================================================================

/**
 * Remove undefined values recursively from object.
 * Firestore throws error on undefined values.
 */
export function removeUndefinedValues<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) {
      continue;
    }

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      const cleaned = removeUndefinedValues(value as Record<string, unknown>);
      if (Object.keys(cleaned).length > 0) {
        result[key] = cleaned;
      }
    } else {
      result[key] = value;
    }
  }

  return result as T;
}
