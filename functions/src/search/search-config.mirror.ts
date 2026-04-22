/**
 * =============================================================================
 * 🔍 SEARCH INDEX CONFIG — CLOUD FUNCTIONS MIRROR (ADR-029 SSoT)
 * =============================================================================
 *
 * Mirror of `src/config/search-index-config.ts` for Cloud Functions.
 *
 * SSoT enforcement:
 *   Cloud Functions run in a separate build and cannot import from `src/`.
 *   This mirror maintains parity with the main-app SSoT via a pre-commit
 *   sync check (scripts/check-search-config-sync.ts — ADR-029 Phase C).
 *
 * When updating search indexing behavior:
 *   1. Update `src/config/search-index-config.ts` (the canonical SSoT)
 *   2. Mirror the change here with Functions-compatible imports
 *   3. Run `npm run test:search-config-sync` (Phase C)
 *
 * Differences allowed vs. SSoT:
 *   - No `satisfies PermissionId` annotations (Functions has no PermissionId type)
 *   - `statsFields` omitted (Functions indexes but never renders stats)
 *   - `COLLECTIONS` imported from the functions mirror
 *
 * @module functions/search/search-config.mirror
 * @enterprise ADR-029 — Global Search v1
 */

import { COLLECTIONS } from '../config/firestore-collections';

// =============================================================================
// TYPE MIRROR (from src/types/search.ts)
// =============================================================================

export const SEARCH_ENTITY_TYPES = {
  PROJECT: 'project',
  BUILDING: 'building',
  PROPERTY: 'property',
  CONTACT: 'contact',
  FILE: 'file',
  PARKING: 'parking',
  STORAGE: 'storage',
  OPPORTUNITY: 'opportunity',
  COMMUNICATION: 'communication',
  TASK: 'task',
} as const;

export type SearchEntityType = typeof SEARCH_ENTITY_TYPES[keyof typeof SEARCH_ENTITY_TYPES];

export const SEARCH_AUDIENCE = {
  INTERNAL: 'internal',
  EXTERNAL: 'external',
} as const;

export type SearchAudience = typeof SEARCH_AUDIENCE[keyof typeof SEARCH_AUDIENCE];

// =============================================================================
// CONFIG TYPES (from src/types/search.ts, trimmed)
// =============================================================================

export type TitleFieldConfig = string | ((doc: Record<string, unknown>) => string);
export type AudienceFieldConfig =
  | SearchAudience
  | ((doc: Record<string, unknown>) => SearchAudience);

export interface SearchIndexConfig {
  collection: string;
  titleField: TitleFieldConfig;
  subtitleFields: string[];
  searchableFields: string[];
  statusField: string;
  audience: AudienceFieldConfig;
  requiredPermission: string;
  routeTemplate: string;
}

// =============================================================================
// SEARCH INDEX CONFIG — mirror of src/config/search-index-config.ts
// =============================================================================

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
  [SEARCH_ENTITY_TYPES.PROPERTY]: {
    collection: COLLECTIONS.PROPERTIES,
    titleField: 'name',
    subtitleFields: ['floor', 'type'],
    searchableFields: ['name', 'propertyCode', 'floor'],
    statusField: 'status',
    audience: (doc) => {
      const isPublished = doc.isPublished as boolean | undefined;
      return isPublished ? SEARCH_AUDIENCE.EXTERNAL : SEARCH_AUDIENCE.INTERNAL;
    },
    requiredPermission: 'properties:properties:view',
    routeTemplate: '/properties/{id}',
  },
  [SEARCH_ENTITY_TYPES.CONTACT]: {
    collection: COLLECTIONS.CONTACTS,
    titleField: (doc) => {
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
    },
    subtitleFields: ['email', 'phone'],
    searchableFields: [
      'displayName',
      'firstName',
      'lastName',
      'email',
      'companyName',
      'serviceName',
    ],
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
  [SEARCH_ENTITY_TYPES.PARKING]: {
    collection: COLLECTIONS.PARKING_SPACES,
    titleField: 'number',
    subtitleFields: ['type', 'status'],
    searchableFields: ['number', 'type', 'notes'],
    statusField: 'status',
    audience: SEARCH_AUDIENCE.INTERNAL,
    requiredPermission: 'buildings:buildings:view',
    routeTemplate: '/parking/{id}',
  },
  [SEARCH_ENTITY_TYPES.STORAGE]: {
    collection: COLLECTIONS.STORAGE,
    titleField: 'name',
    subtitleFields: ['type', 'status'],
    searchableFields: ['name', 'type', 'notes'],
    statusField: 'status',
    audience: SEARCH_AUDIENCE.INTERNAL,
    requiredPermission: 'buildings:buildings:view',
    routeTemplate: '/storage/{id}',
  },
  [SEARCH_ENTITY_TYPES.OPPORTUNITY]: {
    collection: COLLECTIONS.OPPORTUNITIES,
    titleField: 'title',
    subtitleFields: ['stage', 'status'],
    searchableFields: ['title', 'fullName', 'email', 'phone', 'notes'],
    statusField: 'status',
    audience: SEARCH_AUDIENCE.INTERNAL,
    requiredPermission: 'crm:opportunities:view',
    routeTemplate: '/crm/opportunities/{id}',
  },
  [SEARCH_ENTITY_TYPES.COMMUNICATION]: {
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
    routeTemplate: '/crm/communications/{id}',
  },
  [SEARCH_ENTITY_TYPES.TASK]: {
    collection: COLLECTIONS.TASKS,
    titleField: 'title',
    subtitleFields: ['type', 'priority'],
    searchableFields: ['title', 'description'],
    statusField: 'status',
    audience: SEARCH_AUDIENCE.INTERNAL,
    requiredPermission: 'crm:tasks:view',
    routeTemplate: '/crm/tasks/{id}',
  },
};
