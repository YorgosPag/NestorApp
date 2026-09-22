// ⚠️ GENERATED — DO NOT EDIT. Verbatim projection of src/config/search-index-core.ts (ADR-874 · CHECK 3.93).
// Edit the source, then run: npm run generate:functions-projection
// sha256:bcd021d0cd4d5e9d95eb8ee4976344febc424b913cd960b59dbe869b59b2112d

/**
 * =============================================================================
 * 🔍 SEARCH INDEX — PORTABLE CORE (ADR-029 · ADR-874)
 * =============================================================================
 *
 * THE indexing rules: which fields of which collection become a
 * `search_documents` entry, plus the pure functions that apply them. This is
 * the single source for BOTH writers — the Next.js server (backfill, reindex)
 * and the Cloud Functions triggers, which are the production writer.
 *
 * ⚠️ PORTABLE MODULE — projected verbatim into `functions/src/generated/` by
 * `npm run generate:functions-projection` (CHECK 3.93). Before ADR-874 the
 * functions build read a HAND-KEPT mirror, and a change made only here
 * (`4bd107bd`) never reached production for ~5 months (ADR-873 Ε-873.1).
 * Rules that keep it portable, enforced by the generator:
 *   - only RELATIVE imports, and only of other projected modules;
 *   - `COLLECTIONS.X` is fine: the projection carries every key that is used.
 * Result-card presentation (`statsFields`, `PermissionId` typing) lives in
 * `./search-index-config.ts`.
 *
 * @module config/search-index-core
 */

import { COLLECTIONS } from './firestore-collections';
import {
  SEARCH_ENTITY_TYPES,
  SEARCH_AUDIENCE,
  type SearchAudience,
  type SearchEntityType,
  type SearchIndexCoreConfig,
} from '../types/search-core';

// =============================================================================
// REQUIRED PERMISSIONS
// =============================================================================

/**
 * Permission a viewer needs to see each entity type in results. Literal types
 * are kept (`as const`) so the app can prove every value is a real
 * `PermissionId` without this module importing the app's RBAC types.
 */
export const SEARCH_REQUIRED_PERMISSIONS = {
  [SEARCH_ENTITY_TYPES.PROJECT]: 'projects:projects:view',
  [SEARCH_ENTITY_TYPES.BUILDING]: 'buildings:buildings:view',
  [SEARCH_ENTITY_TYPES.FLOOR]: 'buildings:buildings:view',
  [SEARCH_ENTITY_TYPES.PROPERTY]: 'properties:properties:view',
  [SEARCH_ENTITY_TYPES.CONTACT]: 'crm:contacts:view',
  [SEARCH_ENTITY_TYPES.FILE]: 'dxf:files:view',
  [SEARCH_ENTITY_TYPES.PARKING]: 'buildings:buildings:view',
  [SEARCH_ENTITY_TYPES.STORAGE]: 'buildings:buildings:view',
  [SEARCH_ENTITY_TYPES.OPPORTUNITY]: 'crm:opportunities:view',
  [SEARCH_ENTITY_TYPES.COMMUNICATION]: 'crm:communications:view',
  [SEARCH_ENTITY_TYPES.TASK]: 'crm:tasks:view',
} as const;

const P = SEARCH_REQUIRED_PERMISSIONS;

/** Published entities are visible to the public inventory; everything else is internal. */
function publishedAudience(doc: Record<string, unknown>): SearchAudience {
  const isPublished = doc.isPublished as boolean | undefined;
  return isPublished ? SEARCH_AUDIENCE.EXTERNAL : SEARCH_AUDIENCE.INTERNAL;
}

function contactTitle(doc: Record<string, unknown>): string {
  const displayName = doc.displayName as string | undefined;
  const firstName = doc.firstName as string | undefined;
  const lastName = doc.lastName as string | undefined;
  const companyName = doc.companyName as string | undefined;
  const serviceName = doc.serviceName as string | undefined;
  return (
    displayName ||
    `${firstName || ''} ${lastName || ''}`.trim() ||
    companyName ||
    serviceName ||
    'Unknown'
  );
}

function communicationTitle(doc: Record<string, unknown>): string {
  const subject = doc.subject as string | undefined;
  const type = doc.type as string | undefined;
  return subject || `${type || 'communication'}`;
}

// =============================================================================
// INDEXING RULES
// =============================================================================

export const SEARCH_INDEX_CORE: Record<SearchEntityType, SearchIndexCoreConfig> = {
  [SEARCH_ENTITY_TYPES.PROJECT]: {
    collection: COLLECTIONS.PROJECTS,
    titleField: 'name',
    subtitleFields: ['address', 'city'],
    searchableFields: ['name', 'address', 'city', 'projectCode'],
    statusField: 'status',
    audience: SEARCH_AUDIENCE.INTERNAL,
    requiredPermission: P[SEARCH_ENTITY_TYPES.PROJECT],
    routeTemplate: '/projects/{id}',
  },

  [SEARCH_ENTITY_TYPES.BUILDING]: {
    collection: COLLECTIONS.BUILDINGS,
    titleField: 'name',
    subtitleFields: ['address'],
    searchableFields: ['name', 'address', 'buildingCode'],
    statusField: 'status',
    audience: publishedAudience,
    requiredPermission: P[SEARCH_ENTITY_TYPES.BUILDING],
    routeTemplate: '/buildings/{id}',
  },

  [SEARCH_ENTITY_TYPES.FLOOR]: {
    collection: COLLECTIONS.FLOORS,
    titleField: 'name',
    subtitleFields: ['buildingName'],
    searchableFields: ['name', 'buildingName'],
    statusField: 'status',
    audience: SEARCH_AUDIENCE.INTERNAL,
    requiredPermission: P[SEARCH_ENTITY_TYPES.FLOOR],
    // Deep-link to the parent building + focus the floor (Revit "double-click a
    // Level" pattern). Direct query form — NOT `/buildings/{buildingId}` — so the
    // `?floor=` survives: the `/buildings/[id]` route redirects to the query form
    // and would otherwise drop it. Resolved by buildSearchResultHref.
    routeTemplate: '/buildings?buildingId={buildingId}&floor={id}',
  },

  [SEARCH_ENTITY_TYPES.PROPERTY]: {
    collection: COLLECTIONS.PROPERTIES,
    titleField: 'name',
    subtitleFields: ['floor', 'type'],
    searchableFields: ['name', 'propertyCode', 'floor'],
    // SSoT: commercial disposition is the canonical status (ADR-197/287).
    // Legacy `status` is only a write-time mirror — index reads the source of truth.
    statusField: 'commercialStatus',
    audience: publishedAudience,
    requiredPermission: P[SEARCH_ENTITY_TYPES.PROPERTY],
    routeTemplate: '/properties/{id}',
  },

  [SEARCH_ENTITY_TYPES.CONTACT]: {
    collection: COLLECTIONS.CONTACTS,
    titleField: contactTitle,
    subtitleFields: ['email', 'phone'],
    searchableFields: ['displayName', 'firstName', 'lastName', 'email', 'companyName', 'serviceName'],
    statusField: 'status',
    audience: SEARCH_AUDIENCE.INTERNAL,
    requiredPermission: P[SEARCH_ENTITY_TYPES.CONTACT],
    routeTemplate: '/contacts/{id}',
  },

  [SEARCH_ENTITY_TYPES.FILE]: {
    collection: COLLECTIONS.FILES,
    titleField: 'displayName',
    subtitleFields: ['category', 'domain'],
    searchableFields: ['displayName', 'originalFilename'],
    statusField: 'status',
    audience: SEARCH_AUDIENCE.INTERNAL,
    requiredPermission: P[SEARCH_ENTITY_TYPES.FILE],
    routeTemplate: '/files/{id}',
  },

  [SEARCH_ENTITY_TYPES.PARKING]: {
    collection: COLLECTIONS.PARKING_SPACES,
    titleField: 'number',
    subtitleFields: ['type', 'status'],
    searchableFields: ['number', 'code'],
    // ADR-777 §8.60.20 — η διάθεση (όπως στα ακίνητα)· το `status` είναι πλέον μόνο κύκλος ζωής.
    statusField: 'commercialStatus',
    audience: SEARCH_AUDIENCE.INTERNAL,
    requiredPermission: P[SEARCH_ENTITY_TYPES.PARKING],
    routeTemplate: '/parking/{id}',
  },

  [SEARCH_ENTITY_TYPES.STORAGE]: {
    collection: COLLECTIONS.STORAGE,
    titleField: 'name',
    subtitleFields: ['type', 'status'],
    searchableFields: ['name', 'code'],
    // ADR-777 §8.60.20 — η διάθεση (όπως στα ακίνητα)· το `status` είναι πλέον μόνο κύκλος ζωής.
    statusField: 'commercialStatus',
    audience: SEARCH_AUDIENCE.INTERNAL,
    requiredPermission: P[SEARCH_ENTITY_TYPES.STORAGE],
    routeTemplate: '/storage/{id}',
  },

  [SEARCH_ENTITY_TYPES.OPPORTUNITY]: {
    collection: COLLECTIONS.OPPORTUNITIES,
    titleField: 'title',
    subtitleFields: ['stage', 'status'],
    searchableFields: ['title', 'fullName', 'email', 'phone', 'notes'],
    statusField: 'status',
    audience: SEARCH_AUDIENCE.INTERNAL,
    requiredPermission: P[SEARCH_ENTITY_TYPES.OPPORTUNITY],
    routeTemplate: '/crm/opportunities/{id}',
  },

  [SEARCH_ENTITY_TYPES.COMMUNICATION]: {
    collection: COLLECTIONS.COMMUNICATIONS,
    titleField: communicationTitle,
    subtitleFields: ['type', 'direction'],
    searchableFields: ['subject', 'content', 'from', 'to'],
    statusField: 'status',
    audience: SEARCH_AUDIENCE.INTERNAL,
    requiredPermission: P[SEARCH_ENTITY_TYPES.COMMUNICATION],
    routeTemplate: '/crm/communications/{id}',
  },

  [SEARCH_ENTITY_TYPES.TASK]: {
    collection: COLLECTIONS.TASKS,
    titleField: 'title',
    subtitleFields: ['type', 'priority'],
    searchableFields: ['title', 'description'],
    statusField: 'status',
    audience: SEARCH_AUDIENCE.INTERNAL,
    requiredPermission: P[SEARCH_ENTITY_TYPES.TASK],
    routeTemplate: '/crm/tasks/{id}',
  },
};

// =============================================================================
// PURE RULE APPLICATION — the same answer in every writer
// =============================================================================

/** Extract title from document using config. */
export function extractTitle(doc: Record<string, unknown>, config: SearchIndexCoreConfig): string {
  if (typeof config.titleField === 'function') {
    return config.titleField(doc);
  }
  return (doc[config.titleField] as string) || '';
}

/** Extract subtitle from document using config (joined with ' - '). */
export function extractSubtitle(doc: Record<string, unknown>, config: SearchIndexCoreConfig): string {
  return config.subtitleFields
    .map((field) => doc[field] as string | undefined)
    .filter(Boolean)
    .join(' - ');
}

/** Determine audience from document using config. */
export function determineAudience(doc: Record<string, unknown>, config: SearchIndexCoreConfig): SearchAudience {
  if (typeof config.audience === 'function') {
    return config.audience(doc);
  }
  return config.audience;
}

/** Concatenate the non-empty string values of the configured searchable fields. */
export function extractSearchableText(doc: Record<string, unknown>, config: SearchIndexCoreConfig): string {
  const parts: string[] = [];
  for (const field of config.searchableFields) {
    const value = doc[field];
    if (typeof value === 'string' && value.trim()) {
      parts.push(value);
    }
  }
  return parts.join(' ');
}

/** Status value of the source document; `'active'` when the field is empty. */
export function extractStatus(doc: Record<string, unknown>, config: SearchIndexCoreConfig): string {
  return (doc[config.statusField] as string) || 'active';
}

/**
 * Build navigation href from template and entity ID.
 *
 * Resolves `{id}` from the entity ID and any other `{field}` placeholder from
 * the source document (e.g. FLOOR's `{buildingId}`). A missing or non-string
 * value falls back to the entity ID.
 */
export function buildSearchResultHref(
  config: SearchIndexCoreConfig,
  entityId: string,
  data?: Record<string, unknown>,
): string {
  return config.routeTemplate
    .replace('{id}', entityId)
    .replace(/\{(\w+)\}/g, (_, field: string) => {
      const value = data?.[field];
      return typeof value === 'string' && value ? value : entityId;
    });
}

/** Document ID of an entity's entry in `search_documents`: `{entityType}_{entityId}`. */
export function generateSearchDocId(entityType: SearchEntityType, entityId: string): string {
  return `${entityType}_${entityId}`;
}
