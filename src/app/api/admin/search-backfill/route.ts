/**
 * =============================================================================
 * 🔍 SEARCH INDEX BACKFILL API - PROTECTED (super_admin ONLY)
 * =============================================================================
 *
 * Admin endpoint for backfilling search index documents.
 * Indexes existing entities (projects, contacts, buildings, units, files)
 * into the searchDocuments collection for Global Search.
 *
 * @module api/admin/search-backfill
 * @enterprise ADR-029 - Global Search v1
 *
 * 🔒 SECURITY: Protected with RBAC
 * - Permission: admin:migrations:execute (super_admin ONLY)
 * - Comprehensive audit logging
 *
 * USAGE:
 *   POST /api/admin/search-backfill
 *   Body: { "dryRun": true }           - Preview what would be indexed
 *   Body: { "dryRun": false }          - Execute indexing
 *   Body: { "type": "contact" }        - Index only contacts
 *   Body: { "companyId": "abc123" }    - Index only specific company
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { FieldValue, type Firestore as FirebaseFirestoreType, type Query, type DocumentData, type BulkWriter } from 'firebase-admin/firestore';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { COLLECTIONS } from '@/config/firestore-collections';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
// 🏢 ENTERPRISE: Import from centralized search types (ADR-029 - ZERO duplicates)
import {
  SEARCH_ENTITY_TYPES,
  SEARCH_AUDIENCE,
  type SearchEntityType,
  type SearchAudience,
  type SearchFields,
  type SearchDocumentInput,
  type TitleFieldConfig,
  type AudienceFieldConfig,
  type SearchIndexConfig,
} from '@/types/search';

/**
 * Create error response with standard format.
 * 🏢 ENTERPRISE: Uses literal type for success to satisfy TypeScript strict mode.
 */
function createErrorResponse(message: string, status: number) {
  return NextResponse.json(
    { success: false as const, error: message },
    { status }
  );
}

// =============================================================================
// TYPES (🏢 ENTERPRISE: Imported from @/types/search - ZERO duplicates)
// =============================================================================
// SearchEntityType, SearchAudience, SearchFields, SearchDocumentInput
// are imported from centralized types (ADR-029)

interface BackfillRequest {
  dryRun?: boolean;
  type?: SearchEntityType;
  companyId?: string;
  limit?: number;
}

interface BackfillStats {
  processed: number;
  indexed: number;
  skipped: number;
  errors: number;
  skippedDetails?: Array<{
    id: string;
    reason: string;
    fields: Record<string, unknown>;
  }>;
}

interface BackfillResponse {
  mode: 'DRY_RUN' | 'EXECUTE';
  stats: Record<SearchEntityType, BackfillStats>;
  totalStats: BackfillStats;
  duration: number;
  timestamp: string;
}

/**
 * GET response type for backfill system status.
 */
interface BackfillStatusResponse {
  system: {
    name: string;
    version: string;
    security: string;
  };
  currentIndex: {
    collection: string;
    totalDocuments: number;
    byEntityType: Record<string, number>;
  };
  availableTypes: SearchEntityType[];
  usage: {
    dryRun: string;
    execute: string;
    filterByType: string;
    filterByCompany: string;
  };
}

/**
 * PATCH response type for migration.
 */
interface MigrationResponse {
  mode: string;
  stats: MigrationStats;
  duration: number;
  timestamp: string;
}

/**
 * Standard error response type.
 */
interface ErrorResponse {
  success: false;
  error: string;
}

// =============================================================================
// 🏢 ENTERPRISE: API Response Union Types
// Provides type-safe responses for withAuth middleware
// =============================================================================

/**
 * POST handler response type
 */
type BackfillApiResponse = ApiSuccessResponse<BackfillResponse> | ErrorResponse;

/**
 * GET handler response type
 */
type BackfillStatusApiResponse = ApiSuccessResponse<BackfillStatusResponse> | ErrorResponse;

/**
 * PATCH handler response type
 */
type MigrationApiResponse = ApiSuccessResponse<MigrationResponse> | ErrorResponse;

// =============================================================================
// INDEX CONFIG (🏢 ENTERPRISE: Types imported from @/types/search)
// Note: routeTemplates here use query params for backfill navigation
// =============================================================================

const SEARCH_INDEX_CONFIG: Record<SearchEntityType, SearchIndexConfig> = {
  project: {
    collection: COLLECTIONS.PROJECTS,
    titleField: 'name',
    subtitleFields: ['address', 'city'],
    searchableFields: ['name', 'address', 'city', 'projectCode'],
    statusField: 'status',
    audience: SEARCH_AUDIENCE.INTERNAL,
    requiredPermission: 'projects:projects:view',
    routeTemplate: '/audit?projectId={id}&selected=true',
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
  unit: {
    collection: COLLECTIONS.UNITS,
    titleField: 'name',
    subtitleFields: ['floor', 'type'],
    searchableFields: ['name', 'unitCode', 'floor'],
    statusField: 'status',
    audience: (doc) => (doc.isPublished ? SEARCH_AUDIENCE.EXTERNAL : SEARCH_AUDIENCE.INTERNAL),
    requiredPermission: 'units:units:view',
    routeTemplate: '/units?unitId={id}&selected=true',
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
    titleField: 'number',  // 🏢 Fixed: parking spots have 'number' field (e.g., 'P-001')
    subtitleFields: ['floor', 'type'],  // Fixed: parking has 'floor' not 'level'
    searchableFields: ['number', 'type', 'floor', 'location', 'notes'],  // Fixed field names
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
  // =========================================================================
  // ADR-029 Global Search v1 Phase 2 - CRM Entities
  // =========================================================================
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

function normalizeSearchText(text: string): string {
  if (!text) return '';
  let result = text.toLowerCase();
  for (const [accented, base] of Object.entries(GREEK_ACCENT_MAP)) {
    result = result.replace(new RegExp(accented, 'g'), base);
  }
  return result.replace(/\s+/g, ' ').trim();
}

/**
 * 🏢 ENTERPRISE: Remove undefined values recursively from object.
 * Firestore throws error on undefined values.
 */
function removeUndefinedValues<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) {
      continue; // Skip undefined
    }

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      // Recursively clean nested objects
      const cleaned = removeUndefinedValues(value as Record<string, unknown>);
      // Only include if object has keys after cleaning
      if (Object.keys(cleaned).length > 0) {
        result[key] = cleaned;
      }
    } else {
      result[key] = value;
    }
  }

  return result as T;
}

function generateSearchPrefixes(text: string, maxPrefixLength = 5): string[] {
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
// BUILDER FUNCTIONS
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

function determineAudience(doc: Record<string, unknown>, config: SearchIndexConfig): SearchAudience {
  if (typeof config.audience === 'function') {
    return config.audience(doc);
  }
  return config.audience;
}

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

// 🏢 ENTERPRISE: User cache for createdBy lookup (performance optimization)
const userCompanyCache = new Map<string, string | null>();

/**
 * Resolve tenant ID for an entity using multiple strategies.
 * Enterprise pattern: explicit > relationship > creator
 *
 * @param entityType - Type of entity
 * @param data - Entity data
 * @param adminDb - Firestore admin instance (for lookups)
 * @returns Promise<string | null> - Resolved tenant ID or null
 */
async function resolveTenantId(
  entityType: SearchEntityType,
  data: Record<string, unknown>,
  adminDb: FirebaseFirestoreType
): Promise<string | null> {
  // Strategy 1: Direct field (preferred)
  const directTenantId = (data.companyId as string) || (data.tenantId as string);
  if (directTenantId) return directTenantId;

  // Strategy 2: CreatedBy lookup (for contacts without companyId)
  // 🏢 ENTERPRISE: Google/Microsoft pattern - inherit tenant from creator
  const createdBy = data.createdBy as string | undefined;
  console.log(`   🔍 [DEBUG] Strategy 2 (CreatedBy): createdBy=${createdBy || 'NONE'}, entityType=${entityType}`);
  if (createdBy) {
    // Check cache first - but only return if we found a valid companyId
    // 🏢 FIX: If cache has null, continue to next strategies instead of returning null
    if (userCompanyCache.has(createdBy)) {
      const cachedCompanyId = userCompanyCache.get(createdBy);
      console.log(`   🔍 [DEBUG] Strategy 2: Cache HIT for ${createdBy} → companyId=${cachedCompanyId || 'NULL'}`);
      if (cachedCompanyId) {
        return cachedCompanyId; // Only return if we have a valid companyId
      }
      // If cachedCompanyId is null, continue to Strategy 2.5/3/4 (don't return!)
    } else {
      // Not in cache - lookup user
      try {
        // Lookup user's company from their custom claims or user doc
        const userDoc = await adminDb.collection(COLLECTIONS.USERS).doc(createdBy).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          const userCompanyId = userData?.companyId as string | undefined;
          userCompanyCache.set(createdBy, userCompanyId || null);
          console.log(`   🔍 [DEBUG] Strategy 2: User lookup ${createdBy} → companyId=${userCompanyId || 'NULL'}`);
          if (userCompanyId) return userCompanyId;
        } else {
          console.log(`   🔍 [DEBUG] Strategy 2: User ${createdBy} NOT FOUND`);
          userCompanyCache.set(createdBy, null);
        }
      } catch (error) {
        console.warn(`   ⚠️ Failed to lookup user ${createdBy}:`, error);
        userCompanyCache.set(createdBy, null);
      }
    }
  }

  // Strategy 2.5: AssignedTo lookup (for CRM entities like opportunities, tasks)
  // 🏢 ENTERPRISE ADR-029 Phase 2: CRM entities may use assignedTo instead of createdBy
  const assignedTo = data.assignedTo as string | undefined;
  console.log(`   🔍 [DEBUG] Strategy 2.5 (AssignedTo): assignedTo=${assignedTo || 'NONE'}, entityType=${entityType}`);
  if (assignedTo) {
    // Check cache first
    if (userCompanyCache.has(assignedTo)) {
      const cachedCompanyId = userCompanyCache.get(assignedTo);
      console.log(`   🔍 [DEBUG] Strategy 2.5: Cache HIT for ${assignedTo} → companyId=${cachedCompanyId || 'NULL'}`);
      if (cachedCompanyId) {
        console.log(`   📌 Entity resolved via assignedTo: userId=${assignedTo} → companyId=${cachedCompanyId}`);
        return cachedCompanyId;
      }
    } else {
      // Not in cache - lookup user
      try {
        const userDoc = await adminDb.collection(COLLECTIONS.USERS).doc(assignedTo).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          const userCompanyId = userData?.companyId as string | undefined;
          userCompanyCache.set(assignedTo, userCompanyId || null);
          console.log(`   🔍 [DEBUG] Strategy 2.5: User lookup ${assignedTo} → companyId=${userCompanyId || 'NULL'}`);
          if (userCompanyId) {
            console.log(`   📌 Entity resolved via assignedTo: userId=${assignedTo} → companyId=${userCompanyId}`);
            return userCompanyId;
          }
        } else {
          console.log(`   🔍 [DEBUG] Strategy 2.5: User ${assignedTo} NOT FOUND`);
          userCompanyCache.set(assignedTo, null);
        }
      } catch (error) {
        console.warn(`   ⚠️ Failed to lookup assignedTo user ${assignedTo}:`, error);
        userCompanyCache.set(assignedTo, null);
      }
    }
  }

  // Strategy 3: Contact lookup (for opportunities, communications, tasks)
  // 🏢 ENTERPRISE ADR-029 Phase 2: CRM entities inherit tenant from contact
  const contactId = data.contactId as string | undefined;
  console.log(`   🔍 [DEBUG] Strategy 3 (Contact): contactId=${contactId || 'NONE'}, entityType=${entityType}`);
  if (contactId) {
    try {
      const contactDoc = await adminDb.collection(COLLECTIONS.CONTACTS).doc(contactId).get();
      if (contactDoc.exists) {
        const contactData = contactDoc.data();
        const contactCompanyId = contactData?.companyId as string | undefined;
        if (contactCompanyId) {
          console.log(`   📌 Entity resolved via contact: contactId=${contactId} → companyId=${contactCompanyId}`);
          return contactCompanyId;
        } else {
          console.log(`   ⚠️ Contact "${contactId}" exists but has NO companyId - falling through`);
        }
      } else {
        console.log(`   ⚠️ Contact "${contactId}" NOT FOUND`);
      }
    } catch (error) {
      console.warn(`   ⚠️ Failed to lookup contact ${contactId}:`, error);
    }
  }

  // Strategy 4: Project lookup (for units, parking, storage without direct companyId)
  // Supports both 'project' field (units) and 'projectId' field (parking/storage)
  // 🏢 ENTERPRISE: Handles both prefixed (project_xxx) and non-prefixed (xxx) IDs
  const projectRef = (data.project as string | undefined) || (data.projectId as string | undefined);
  console.log(`   🔍 [DEBUG] Strategy 4 (Project): projectRef=${projectRef || 'NONE'}, entityType=${entityType}`);
  if (projectRef) {
    try {
      // Try with original ID first
      console.log(`   🔍 [DEBUG] Looking up project: ${COLLECTIONS.PROJECTS}/${projectRef}`);
      let projectDoc = await adminDb.collection(COLLECTIONS.PROJECTS).doc(projectRef).get();
      console.log(`   🔍 [DEBUG] Project lookup result: exists=${projectDoc.exists}`);

      // 🏢 ENTERPRISE: If not found and has prefix, try without prefix (legacy support)
      if (!projectDoc.exists && projectRef.startsWith('project_')) {
        const unprefixedId = projectRef.replace('project_', '');
        console.log(`   🔄 [LEGACY] Trying unprefixed project ID: ${unprefixedId}`);
        projectDoc = await adminDb.collection(COLLECTIONS.PROJECTS).doc(unprefixedId).get();
        console.log(`   🔍 [DEBUG] Unprefixed lookup result: exists=${projectDoc.exists}`);
        if (projectDoc.exists) {
          console.warn(`   ⚠️ [MIGRATION NEEDED] Project "${unprefixedId}" should be migrated to "${projectRef}"`);
        }
      }

      // 🏢 ENTERPRISE: If not found and doesn't have prefix, try with prefix
      if (!projectDoc.exists && !projectRef.startsWith('project_')) {
        const prefixedId = `project_${projectRef}`;
        console.log(`   🔄 [LEGACY] Trying prefixed project ID: ${prefixedId}`);
        projectDoc = await adminDb.collection(COLLECTIONS.PROJECTS).doc(prefixedId).get();
        console.log(`   🔍 [DEBUG] Prefixed lookup result: exists=${projectDoc.exists}`);
      }

      if (projectDoc.exists) {
        const projectData = projectDoc.data();
        const projectCompanyId = projectData?.companyId as string | undefined;
        // 🔍 DEBUG: Log project data for troubleshooting
        console.log(`   🔍 [DEBUG] Project found: ${projectDoc.id}`);
        console.log(`   🔍 [DEBUG] Project data keys: ${Object.keys(projectData || {}).join(', ')}`);
        console.log(`   🔍 [DEBUG] Project companyId: ${projectCompanyId || 'MISSING'}`);
        if (projectCompanyId) {
          console.log(`   📌 Entity resolved via project: projectId=${projectDoc.id} → companyId=${projectCompanyId}`);
          return projectCompanyId;
        } else {
          console.log(`   ⚠️ Project "${projectDoc.id}" exists but has NO companyId - falling through to Strategy 4`);
        }
      } else {
        console.log(`   ⚠️ [DEBUG] Project NOT FOUND with any ID variant: ${projectRef}`);
      }
    } catch (error) {
      console.warn(`   ⚠️ Failed to lookup project ${projectRef}:`, error);
    }
  }

  // Strategy 5: Building lookup (for units without project field)
  // Chain: unit.buildingId → building.projectId → project.companyId
  // 🏢 ENTERPRISE: Handles both prefixed (building_xxx) and non-prefixed (xxx) IDs
  const buildingId = data.buildingId as string | undefined;
  console.log(`   🔍 [DEBUG] Strategy 5 (Building): buildingId=${buildingId || 'NONE'}`);
  if (buildingId) {
    try {
      // Try with original ID first
      let buildingDoc = await adminDb.collection(COLLECTIONS.BUILDINGS).doc(buildingId).get();

      // 🏢 ENTERPRISE: If not found and has prefix, try without prefix (legacy support)
      if (!buildingDoc.exists && buildingId.startsWith('building_')) {
        const unprefixedId = buildingId.replace('building_', '');
        console.log(`   🔄 [LEGACY] Trying unprefixed building ID: ${unprefixedId}`);
        buildingDoc = await adminDb.collection(COLLECTIONS.BUILDINGS).doc(unprefixedId).get();
        if (buildingDoc.exists) {
          console.warn(`   ⚠️ [MIGRATION NEEDED] Building "${unprefixedId}" should be migrated to "${buildingId}"`);
        }
      }

      // 🏢 ENTERPRISE: If not found and doesn't have prefix, try with prefix
      if (!buildingDoc.exists && !buildingId.startsWith('building_')) {
        const prefixedId = `building_${buildingId}`;
        console.log(`   🔄 [LEGACY] Trying prefixed building ID: ${prefixedId}`);
        buildingDoc = await adminDb.collection(COLLECTIONS.BUILDINGS).doc(prefixedId).get();
      }

      if (buildingDoc.exists) {
        const buildingData = buildingDoc.data();
        const buildingProjectId = buildingData?.projectId as string | undefined;
        if (buildingProjectId) {
          // Now lookup the project to get companyId (also with prefix fallback)
          let projectDoc = await adminDb.collection(COLLECTIONS.PROJECTS).doc(buildingProjectId).get();

          // Try without prefix if not found
          if (!projectDoc.exists && buildingProjectId.startsWith('project_')) {
            const unprefixedProjectId = buildingProjectId.replace('project_', '');
            projectDoc = await adminDb.collection(COLLECTIONS.PROJECTS).doc(unprefixedProjectId).get();
          }

          // Try with prefix if not found
          if (!projectDoc.exists && !buildingProjectId.startsWith('project_')) {
            const prefixedProjectId = `project_${buildingProjectId}`;
            projectDoc = await adminDb.collection(COLLECTIONS.PROJECTS).doc(prefixedProjectId).get();
          }

          if (projectDoc.exists) {
            const projectData = projectDoc.data();
            const projectCompanyId = projectData?.companyId as string | undefined;
            if (projectCompanyId) {
              console.log(`   📌 Entity resolved via building chain: buildingId=${buildingId} → projectId=${buildingProjectId} → companyId=${projectCompanyId}`);
              return projectCompanyId;
            }
          }
        }
      }
    } catch (error) {
      console.warn(`   ⚠️ Failed to lookup building ${buildingId}:`, error);
    }
  }

  // No tenant ID found
  return null;
}

async function buildSearchDocument(
  entityType: SearchEntityType,
  entityId: string,
  data: Record<string, unknown>,
  adminDb: FirebaseFirestoreType
): Promise<SearchDocumentInput | null> {
  const config = SEARCH_INDEX_CONFIG[entityType];
  if (!config) return null;

  // 🏢 ENTERPRISE: Multi-strategy tenant resolution
  const tenantId = await resolveTenantId(entityType, data, adminDb);
  if (!tenantId) return null;

  const title = extractTitle(data, config);
  const subtitle = extractSubtitle(data, config);
  const status = (data[config.statusField] as string) || 'active';
  const audience = determineAudience(data, config);
  const searchableText = extractSearchableText(data, config);
  const normalizedText = normalizeSearchText(searchableText);
  const prefixes = generateSearchPrefixes(normalizedText);

  // 🏢 ENTERPRISE: Extract metadata for parking/storage card stats
  let metadata: SearchDocumentInput['metadata'] | undefined;
  if (entityType === 'parking' || entityType === 'storage') {
    metadata = {
      floor: data.floor as string | number | undefined,
      area: data.area as number | undefined,
      price: data.price as number | undefined,
      type: data.type as string | undefined,
    };
    // Remove undefined values
    metadata = Object.fromEntries(
      Object.entries(metadata).filter(([, v]) => v !== undefined)
    ) as SearchDocumentInput['metadata'];
    // If empty, set to undefined
    if (Object.keys(metadata || {}).length === 0) {
      metadata = undefined;
    }
  }

  return {
    tenantId,
    entityType,
    entityId,
    title,
    subtitle,
    status,
    search: { normalized: normalizedText, prefixes },
    audience,
    requiredPermission: config.requiredPermission,
    links: {
      href: config.routeTemplate.replace('{id}', entityId),
      routeParams: { id: entityId },
    },
    metadata,
  };
}

// =============================================================================
// BACKFILL LOGIC - 🏢 ENTERPRISE: BulkWriter + Parallel Processing
// =============================================================================

/**
 * 🏢 ENTERPRISE: BulkWriter Configuration
 * Based on Google Cloud best practices for high-throughput writes
 *
 * @see https://cloud.google.com/firestore/docs/bulk-writes
 */
const BULK_WRITER_CONFIG = {
  /** Maximum concurrent operations (Google default: 500) */
  MAX_CONCURRENT_OPS: 500,
  /** Throttling enabled for rate limiting protection */
  THROTTLING_ENABLED: true,
  /** Initial operations per second */
  INITIAL_OPS_PER_SECOND: 500,
  /** Maximum operations per second */
  MAX_OPS_PER_SECOND: 10000,
} as const;

/**
 * 🏢 ENTERPRISE: Backfill single entity type using BulkWriter
 * BulkWriter provides automatic retry, batching, and rate limiting
 */
async function backfillEntityType(
  entityType: SearchEntityType,
  options: BackfillRequest,
  sharedBulkWriter?: BulkWriter
): Promise<BackfillStats> {
  const adminDb = getAdminFirestore();
  if (!adminDb) {
    throw new Error('Firebase Admin not initialized');
  }

  const config = SEARCH_INDEX_CONFIG[entityType];
  const stats: BackfillStats = { processed: 0, indexed: 0, skipped: 0, errors: 0, skippedDetails: [] };

  console.log(`📦 [Search Backfill] Processing ${entityType}...`);

  // Build query
  let query: Query<DocumentData> = adminDb.collection(config.collection);

  if (options.companyId) {
    query = query.where('companyId', '==', options.companyId);
  }

  if (options.limit) {
    query = query.limit(options.limit);
  }

  const snapshot = await query.get();
  console.log(`   Found ${snapshot.size} documents`);

  // 🏢 ENTERPRISE: Use shared BulkWriter or create new one
  // BulkWriter automatically handles batching, retries, and rate limiting
  const bulkWriter = sharedBulkWriter || adminDb.bulkWriter({
    throttling: {
      initialOpsPerSecond: BULK_WRITER_CONFIG.INITIAL_OPS_PER_SECOND,
      maxOpsPerSecond: BULK_WRITER_CONFIG.MAX_OPS_PER_SECOND,
    },
  });

  // Track write promises for error handling
  const writePromises: Promise<void>[] = [];

  for (const doc of snapshot.docs) {
    stats.processed++;
    const data = doc.data() as Record<string, unknown>;

    // Skip soft-deleted
    if (data.isDeleted === true || data.deletedAt) {
      stats.skipped++;
      continue;
    }

    const searchDoc = await buildSearchDocument(entityType, doc.id, data, adminDb);
    if (!searchDoc) {
      stats.skipped++;
      // 🔍 DEBUG: Collect skipped document details for response
      stats.skippedDetails?.push({
        id: doc.id,
        reason: 'No tenant ID resolved',
        fields: {
          companyId: data.companyId || null,
          tenantId: data.tenantId || null,
          project: data.project || null,
          projectId: data.projectId || null,
          buildingId: data.buildingId || null,
          createdBy: data.createdBy || null,
          assignedTo: data.assignedTo || null,  // 🏢 ADR-029: CRM entities
          contactId: data.contactId || null,    // 🏢 ADR-029: CRM entities
        },
      });
      console.log(`   ⏭️ Skipped ${doc.id}: projectId="${data.projectId}", buildingId="${data.buildingId}"`);
      continue;
    }

    const searchDocId = `${entityType}_${doc.id}`;
    const searchDocRef = adminDb.collection(COLLECTIONS.SEARCH_DOCUMENTS).doc(searchDocId);

    if (options.dryRun) {
      console.log(`   [DRY-RUN] Would index: ${searchDoc.title} (${searchDocId})`);
      stats.indexed++;
    } else {
      // 🏢 ENTERPRISE: Remove undefined values recursively for Firestore compatibility
      const firestoreDoc = removeUndefinedValues(searchDoc as unknown as Record<string, unknown>);

      // Count as indexed optimistically
      stats.indexed++;

      // 🏢 ENTERPRISE: BulkWriter.set() - non-blocking, auto-batched
      const writePromise = bulkWriter
        .set(searchDocRef, {
          ...firestoreDoc,
          updatedAt: FieldValue.serverTimestamp(),
          createdAt: FieldValue.serverTimestamp(),
          indexedAt: FieldValue.serverTimestamp(),
        })
        .then(() => undefined)
        .catch((error) => {
          console.error(`   ❌ Write failed for ${searchDocId}:`, error);
          // Revert optimistic count on error
          stats.indexed--;
          stats.errors++;
        });

      writePromises.push(writePromise);
    }
  }

  // 🏢 ENTERPRISE: Wait for all writes to complete
  if (!options.dryRun && writePromises.length > 0) {
    // Wait for all individual write promises to resolve
    await Promise.all(writePromises);

    // Close BulkWriter only if we created it (not shared)
    if (!sharedBulkWriter) {
      await bulkWriter.close();
    }
  }

  console.log(`   📊 ${entityType}: processed=${stats.processed}, indexed=${stats.indexed}, skipped=${stats.skipped}, errors=${stats.errors}`);

  return stats;
}

/**
 * 🏢 ENTERPRISE: Parallel backfill all entity types
 * Uses Promise.all for concurrent processing with shared BulkWriter
 */
async function backfillAllTypesParallel(
  types: SearchEntityType[],
  options: BackfillRequest
): Promise<{ statsByType: Record<string, BackfillStats>; totalStats: BackfillStats }> {
  const adminDb = getAdminFirestore();
  if (!adminDb) {
    throw new Error('Firebase Admin not initialized');
  }

  console.log(`🚀 [Search Backfill] PARALLEL MODE - Processing ${types.length} entity types concurrently`);

  // 🏢 ENTERPRISE: Shared BulkWriter for all entity types
  // This maximizes throughput by allowing cross-type batching
  const bulkWriter = adminDb.bulkWriter({
    throttling: {
      initialOpsPerSecond: BULK_WRITER_CONFIG.INITIAL_OPS_PER_SECOND,
      maxOpsPerSecond: BULK_WRITER_CONFIG.MAX_OPS_PER_SECOND,
    },
  });

  // 🏢 ENTERPRISE: Process all entity types in parallel
  const resultsArray = await Promise.all(
    types.map((entityType) => backfillEntityType(entityType, options, bulkWriter))
  );

  // 🏢 ENTERPRISE: Close BulkWriter and wait for all writes
  if (!options.dryRun) {
    console.log(`   ⏳ Flushing all pending writes...`);
    await bulkWriter.close();
    console.log(`   ✅ All writes completed`);
  }

  // Aggregate results
  const statsByType: Record<string, BackfillStats> = {};
  const totalStats: BackfillStats = { processed: 0, indexed: 0, skipped: 0, errors: 0 };

  types.forEach((entityType, index) => {
    const stats = resultsArray[index];
    statsByType[entityType] = stats;
    totalStats.processed += stats.processed;
    totalStats.indexed += stats.indexed;
    totalStats.skipped += stats.skipped;
    totalStats.errors += stats.errors;
  });

  return { statsByType, totalStats };
}

// =============================================================================
// API HANDLERS
// =============================================================================

/**
 * POST /api/admin/search-backfill
 *
 * Execute search index backfill.
 * Body: { dryRun?: boolean, type?: string, companyId?: string, limit?: number }
 *
 * @rateLimit SENSITIVE (20 req/min) - Admin/Auth operation
 */
export const POST = withSensitiveRateLimit(withAuth<BackfillApiResponse>(
  async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse<BackfillApiResponse>> => {
    const startTime = Date.now();

    // 🔐 ENTERPRISE: Only super_admin can execute backfill
    if (ctx.globalRole !== 'super_admin') {
      console.warn(
        `🚫 [Search Backfill] BLOCKED: Non-super_admin attempted backfill: ` +
        `${ctx.email} (${ctx.globalRole})`
      );
      return createErrorResponse('Forbidden: Only super_admin can execute search backfill', 403);
    }

    console.log(`🔐 [Search Backfill] Request from ${ctx.email} (${ctx.globalRole})`);

    try {
      const body = await request.json() as BackfillRequest;
      const { dryRun = true, type, companyId, limit } = body;

      console.log(`🔍 SEARCH INDEX BACKFILL`);
      console.log(`   Mode: ${dryRun ? 'DRY-RUN' : 'EXECUTE'}`);
      if (type) console.log(`   Type filter: ${type}`);
      if (companyId) console.log(`   Company filter: ${companyId}`);
      if (limit) console.log(`   Limit: ${limit}`);

      // Determine which types to process
      const typesToProcess = type
        ? [type]
        : Object.values(SEARCH_ENTITY_TYPES);

      // 🏢 ENTERPRISE: Use parallel processing for maximum throughput
      console.log(`🚀 Processing ${typesToProcess.length} entity types in PARALLEL mode`);

      const { statsByType, totalStats } = await backfillAllTypesParallel(
        typesToProcess,
        { dryRun, companyId, limit }
      );

      const duration = Date.now() - startTime;

      console.log(`\n📊 FINAL SUMMARY`);
      console.log(`   Total processed: ${totalStats.processed}`);
      console.log(`   Total indexed:   ${totalStats.indexed}`);
      console.log(`   Total skipped:   ${totalStats.skipped}`);
      console.log(`   Total errors:    ${totalStats.errors}`);
      console.log(`   Duration:        ${duration}ms`);

      const response: BackfillResponse = {
        mode: dryRun ? 'DRY_RUN' : 'EXECUTE',
        stats: statsByType as Record<SearchEntityType, BackfillStats>,
        totalStats,
        duration,
        timestamp: new Date().toISOString(),
      };

      return apiSuccess(response, dryRun
        ? `Dry run complete. Would index ${totalStats.indexed} documents.`
        : `Backfill complete. Indexed ${totalStats.indexed} documents.`
      );

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ [Search Backfill] Error:`, errorMessage);
      return createErrorResponse(errorMessage, 500);
    }
  },
  { permissions: 'admin:migrations:execute' }
));

/**
 * GET /api/admin/search-backfill
 *
 * Get backfill status and configuration info.
 */
export const GET = withAuth<BackfillStatusApiResponse>(
  async (_request: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse<BackfillStatusApiResponse>> => {
    // 🔐 ENTERPRISE: Only super_admin can view backfill info
    if (ctx.globalRole !== 'super_admin') {
      return createErrorResponse('Forbidden: Only super_admin can access search backfill', 403);
    }

    const adminDb = getAdminFirestore();
    if (!adminDb) {
      return createErrorResponse('Firebase Admin not initialized', 500);
    }

    // Get current search document counts
    const counts: Record<string, number> = {};
    for (const entityType of Object.values(SEARCH_ENTITY_TYPES)) {
      const snapshot = await adminDb
        .collection(COLLECTIONS.SEARCH_DOCUMENTS)
        .where('entityType', '==', entityType)
        .count()
        .get();
      counts[entityType] = snapshot.data().count;
    }

    const totalCount = Object.values(counts).reduce((sum, c) => sum + c, 0);

    return apiSuccess({
      system: {
        name: 'Search Index Backfill',
        version: '1.0.0',
        security: 'super_admin ONLY',
      },
      currentIndex: {
        collection: COLLECTIONS.SEARCH_DOCUMENTS,
        totalDocuments: totalCount,
        byEntityType: counts,
      },
      availableTypes: Object.values(SEARCH_ENTITY_TYPES),
      usage: {
        dryRun: 'POST { "dryRun": true } - Preview what would be indexed',
        execute: 'POST { "dryRun": false } - Execute indexing',
        filterByType: 'POST { "type": "contact" } - Index only contacts',
        filterByCompany: 'POST { "companyId": "abc123" } - Index only specific company',
      },
    }, 'Search backfill system ready');
  },
  { permissions: 'admin:migrations:execute' }
);

// =============================================================================
// CONTACT TENANT MIGRATION (PATCH)
// =============================================================================

interface MigrationStats {
  total: number;
  migrated: number;
  skipped: number;
  errors: number;
  noCreator: number;
}

/**
 * PATCH /api/admin/search-backfill
 *
 * Migrate contacts to add companyId from createdBy user.
 * Enterprise pattern: CreatedBy Lookup for tenant resolution.
 *
 * Body: { "dryRun": true }  - Preview migration
 * Body: { "dryRun": false } - Execute migration
 * Body: { "limit": 100 }    - Limit number of contacts to process
 */
export const PATCH = withAuth<MigrationApiResponse>(
  async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse<MigrationApiResponse>> => {
    const startTime = Date.now();

    // 🔐 ENTERPRISE: Only super_admin can execute migration
    if (ctx.globalRole !== 'super_admin') {
      console.warn(
        `🚫 [Contact Migration] BLOCKED: Non-super_admin attempted migration: ` +
        `${ctx.email} (${ctx.globalRole})`
      );
      return createErrorResponse('Forbidden: Only super_admin can execute contact migration', 403);
    }

    console.log(`🔐 [Contact Migration] Request from ${ctx.email} (${ctx.globalRole})`);

    const adminDb = getAdminFirestore();
    if (!adminDb) {
      return createErrorResponse('Firebase Admin not initialized', 500);
    }

    try {
      const body = await request.json() as { dryRun?: boolean; limit?: number; defaultCompanyId?: string };
      const { dryRun = true, limit, defaultCompanyId } = body;

      console.log(`\n🏢 CONTACT TENANT MIGRATION`);
      console.log(`   Mode: ${dryRun ? 'DRY-RUN' : 'EXECUTE'}`);
      if (limit) console.log(`   Limit: ${limit}`);
      if (defaultCompanyId) console.log(`   Default companyId: ${defaultCompanyId}`);

      const stats: MigrationStats = {
        total: 0,
        migrated: 0,
        skipped: 0,
        errors: 0,
        noCreator: 0,
      };

      // Query contacts without companyId
      let query = adminDb.collection(COLLECTIONS.CONTACTS) as Query<DocumentData>;

      if (limit) {
        query = query.limit(limit);
      }

      const snapshot = await query.get();
      stats.total = snapshot.size;

      console.log(`   Found ${stats.total} contacts to process`);

      // Clear user cache for fresh lookups
      userCompanyCache.clear();

      // Process in batches
      const BATCH_SIZE = 500;
      let batch = adminDb.batch();
      let batchCount = 0;

      for (const doc of snapshot.docs) {
        const data = doc.data() as Record<string, unknown>;

        // Skip if already has companyId
        if (data.companyId) {
          stats.skipped++;
          continue;
        }

        const createdBy = data.createdBy as string | undefined;

        // Determine companyId to use
        let resolvedCompanyId: string | null = null;

        if (createdBy) {
          // Try to lookup creator's companyId
          if (userCompanyCache.has(createdBy)) {
            resolvedCompanyId = userCompanyCache.get(createdBy) || null;
          } else {
            try {
              const userDoc = await adminDb.collection(COLLECTIONS.USERS).doc(createdBy).get();
              if (userDoc.exists) {
                const userData = userDoc.data();
                resolvedCompanyId = (userData?.companyId as string) || null;
              }
              userCompanyCache.set(createdBy, resolvedCompanyId);
            } catch (error) {
              console.warn(`   ⚠️ Failed to lookup user ${createdBy}:`, error);
              userCompanyCache.set(createdBy, null);
            }
          }
        }

        // Fallback to defaultCompanyId if no creator or creator has no companyId
        if (!resolvedCompanyId && defaultCompanyId) {
          resolvedCompanyId = defaultCompanyId;
          console.log(`   📌 Contact ${doc.id} using default companyId`);
        }

        if (!resolvedCompanyId) {
          stats.noCreator++;
          console.log(`   ⚠️ Contact ${doc.id} has no createdBy and no defaultCompanyId - skipping`);
          continue;
        }

        const userCompanyId = resolvedCompanyId;

        if (dryRun) {
          console.log(`   [DRY-RUN] Would set companyId=${userCompanyId} for contact ${doc.id}`);
          stats.migrated++;
        } else {
          batch.update(doc.ref, {
            companyId: userCompanyId,
            updatedAt: FieldValue.serverTimestamp(),
          });
          batchCount++;
          stats.migrated++;

          // Commit batch every 500 documents
          if (batchCount >= BATCH_SIZE) {
            try {
              await batch.commit();
              console.log(`   ✅ Committed batch of ${batchCount} contacts`);
              batch = adminDb.batch();
              batchCount = 0;
            } catch (error) {
              console.error(`   ❌ Batch commit failed:`, error);
              stats.errors += batchCount;
              stats.migrated -= batchCount;
              batch = adminDb.batch();
              batchCount = 0;
            }
          }
        }
      }

      // Commit remaining documents
      if (!dryRun && batchCount > 0) {
        try {
          await batch.commit();
          console.log(`   ✅ Committed final batch of ${batchCount} contacts`);
        } catch (error) {
          console.error(`   ❌ Final batch commit failed:`, error);
          stats.errors += batchCount;
          stats.migrated -= batchCount;
        }
      }

      const duration = Date.now() - startTime;

      console.log(`\n📊 MIGRATION SUMMARY`);
      console.log(`   Total contacts: ${stats.total}`);
      console.log(`   Migrated:       ${stats.migrated}`);
      console.log(`   Skipped:        ${stats.skipped} (already have companyId)`);
      console.log(`   No creator:     ${stats.noCreator}`);
      console.log(`   Errors:         ${stats.errors}`);
      console.log(`   Duration:       ${duration}ms`);

      return apiSuccess({
        mode: dryRun ? 'DRY_RUN' : 'EXECUTE',
        stats,
        duration,
        timestamp: new Date().toISOString(),
      }, dryRun
        ? `Dry run complete. Would migrate ${stats.migrated} contacts.`
        : `Migration complete. Migrated ${stats.migrated} contacts.`
      );

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ [Contact Migration] Error:`, errorMessage);
      return createErrorResponse(errorMessage, 500);
    }
  },
  { permissions: 'admin:migrations:execute' }
);
