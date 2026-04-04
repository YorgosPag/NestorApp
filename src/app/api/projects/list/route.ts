/**
 * 🏗️ PROJECTS LIST ENDPOINT
 *
 * Enterprise-grade endpoint για loading ALL projects.
 * Διαχωρισμένο από /api/projects/bootstrap (Option A architecture).
 *
 * @module api/projects/list
 * @version 1.0.0
 * @enterprise Phase 3 - Data Architecture Separation
 * @updated 2026-01-15 - AUTHZ PHASE 2: Added RBAC protection + tenant isolation
 * @rateLimit HIGH (100 req/min) - List endpoint
 *
 * 🏢 ARCHITECTURE:
 * - Admin SDK (server-side, consistent latency)
 * - withAuth + tenant isolation (CRITICAL security fix)
 * - Short TTL caching (30s for near-realtime updates)
 * - Type-safe field extraction (no type assertions)
 *
 * 🔒 SECURITY:
 * - Permission: projects:projects:view
 * - Tenant isolation: Query filtered by ctx.companyId
 */

import { NextRequest } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withAuth, logAuditEvent } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { fieldToISO } from '@/lib/date-local';
import { getString, getNumber, getArray } from '@/lib/firestore/field-extractors';
import { EnterpriseAPICache } from '@/lib/cache/enterprise-api-cache';
import type { ProjectSummary, ProjectStatus } from '@/types/project';
import type { ProjectAddress } from '@/types/project/addresses';
import type { LandownerEntry } from '@/types/ownership-table';
import { withHighRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('ProjectsListRoute');

// ============================================================================
// TYPES - Project List Response
// ============================================================================

// 🏢 SSoT: ProjectSummary from @/types/project (via Pick<Project, ...>)
// Eliminates duplicate ProjectListItem interface — fields defined ONCE in Project type.

interface ProjectListResponse {
  projects: ProjectSummary[];
  count: number;
  loadedAt: string;
  source: 'cache' | 'firestore';
}

// ============================================================================
// CONSTANTS
// ============================================================================

const CACHE_KEY_PREFIX = 'api:projects:list';

/**
 * Generate tenant-specific cache key
 * TTL managed by EnterpriseAPICache (30s for projectsList - near-realtime)
 * 🏢 Super Admin gets 'all' cache key for cross-tenant access
 */
function getTenantCacheKey(companyId: string, isSuperAdmin: boolean): string {
  return isSuperAdmin ? `${CACHE_KEY_PREFIX}:all` : `${CACHE_KEY_PREFIX}:${companyId}`;
}

// ============================================================================
// TYPE-SAFE FIELD EXTRACTORS
// ============================================================================

// ADR-219: Field extractors centralized to @/lib/firestore/field-extractors

// ADR-218: getTimestampString replaced by centralized fieldToISO from @/lib/date-local

// ============================================================================
// STATUS NORMALIZER
// ============================================================================

/**
 * 🔒 ENTERPRISE: Normalize status to canonical ProjectStatus values
 */
const VALID_STATUSES: ReadonlySet<ProjectStatus> = new Set<ProjectStatus>([
  'planning', 'in_progress', 'completed', 'on_hold', 'cancelled',
]);

function normalizeStatus(status: string | undefined): ProjectStatus {
  if (status === 'construction' || status === 'active') {
    return 'in_progress';
  }
  if (status && VALID_STATUSES.has(status as ProjectStatus)) {
    return status as ProjectStatus;
  }
  return 'planning';
}

// ============================================================================
// FORCE DYNAMIC
// ============================================================================

export const dynamic = 'force-dynamic';

// ============================================================================
// MAIN HANDLER
// ============================================================================

export const GET = withHighRateLimit(
  withAuth<ApiSuccessResponse<ProjectListResponse>>(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      const startTime = Date.now();

      // 🏢 ENTERPRISE: Check if user is Super Admin for cross-tenant access
      const isSuperAdmin = ctx.globalRole === 'super_admin';
      logger.info('[Projects/List] Starting projects list load', { isSuperAdmin });

      // ============================================================================
      // 1. CHECK TENANT-SPECIFIC CACHE FIRST
      // ============================================================================

      const cache = EnterpriseAPICache.getInstance();
      const tenantCacheKey = getTenantCacheKey(ctx.companyId, isSuperAdmin);
      const cachedData = cache.get<ProjectListResponse>(tenantCacheKey);

  if (cachedData) {
    const duration = Date.now() - startTime;
    logger.info('[Projects/List] CACHE HIT', { count: cachedData.count, durationMs: duration });

    // Audit event for cache hit
    await logAuditEvent(ctx, 'data_accessed', 'projects', 'api', {
      metadata: {
        path: '/api/projects/list',
        reason: `Projects list accessed (${cachedData.count} items from cache, ${duration}ms)`
      }
    });

    return apiSuccess<ProjectListResponse>({
      ...cachedData,
      source: 'cache'
    }, `Projects loaded from cache in ${duration}ms`);
  }

      logger.info('[Projects/List] Cache miss - Fetching from Firestore');

      // ============================================================================
      // 2. FETCH PROJECTS (Admin SDK)
      // 🏢 ENTERPRISE: Super Admin gets ALL projects, others get tenant-scoped
      // ============================================================================

      let projectsSnapshot;
      if (isSuperAdmin) {
        // 🏢 Super Admin: Fetch ALL projects (no navigation_companies filtering)
        // navigation_companies is visual-only (sidebar navigation), not a data filter
        logger.info('[Projects/List] Super Admin - Fetching all projects');
        projectsSnapshot = await getAdminFirestore().collection(COLLECTIONS.PROJECTS).get();
      } else {
        // 🔒 Regular user: Tenant-scoped (only their company)
        projectsSnapshot = await getAdminFirestore()
          .collection(COLLECTIONS.PROJECTS)
          .where(FIELDS.COMPANY_ID, '==', ctx.companyId)
          .get();
      }

      logger.info('[Projects/List] Found projects', { total: projectsSnapshot.docs.length });

  // ============================================================================
  // 3. MAP TO ProjectListItem (type-safe)
  // ============================================================================

  // 🏢 ENTERPRISE: Filter out archived/deleted projects (soft-delete support)
  const activeDocs = projectsSnapshot.docs.filter(doc => {
    const status = doc.data().status;
    return status !== 'archived' && status !== 'deleted';
  });

  const projects: ProjectSummary[] = activeDocs.map(doc => {
    const data = doc.data() as Record<string, unknown>;

    return {
      id: doc.id,
      name: getString(data, 'name', 'Unnamed Project'),
      title: getString(data, 'title', ''),
      status: normalizeStatus(getString(data, 'status')),
      company: getString(data, 'company', ''),
      companyId: getString(data, 'companyId', ''),
      linkedCompanyId: getString(data, 'linkedCompanyId') || null,
      address: getString(data, 'address', ''),
      city: getString(data, 'city', ''),
      // 🏢 ENTERPRISE: Multi-address support (ADR-167)
      addresses: getArray<ProjectAddress>(data, 'addresses'),
      progress: getNumber(data, 'progress', 0),
      totalValue: getNumber(data, 'totalValue', 0),
      totalArea: getNumber(data, 'totalArea', 0),
      startDate: fieldToISO(data, 'startDate'),
      completionDate: fieldToISO(data, 'completionDate'),
      lastUpdate: fieldToISO(data, 'lastUpdate') || fieldToISO(data, 'updatedAt'),
      // 🏢 ADR-244: Landowner + bartex data
      landowners: getArray<LandownerEntry>(data, 'landowners') ?? null,
      bartexPercentage: getNumber(data, 'bartexPercentage') ?? null,
      landownerContactIds: getArray<string>(data, 'landownerContactIds') ?? null,
    };
  });

  // ============================================================================
  // 4. BUILD RESPONSE
  // ============================================================================

  const response: ProjectListResponse = {
    projects,
    count: projects.length,
    loadedAt: new Date().toISOString(),
    source: 'firestore'
  };

  // ============================================================================
  // 5. CACHE RESPONSE (TTL managed by EnterpriseAPICache.getTTLForKey)
  // ============================================================================

  cache.set(tenantCacheKey, response);

  const duration = Date.now() - startTime;
  logger.info('[Projects/List] Complete', { count: projects.length, durationMs: duration });

  // ============================================================================
  // 6. AUDIT EVENT (Enterprise compliance)
  // ============================================================================

  await logAuditEvent(ctx, 'data_accessed', 'projects', 'api', {
    metadata: {
      path: '/api/projects/list',
      reason: `Projects list accessed (${projects.length} items from firestore, ${duration}ms)`
    }
  });

  return apiSuccess<ProjectListResponse>(response, `Projects loaded in ${duration}ms`);
    },
    {
      permissions: 'projects:projects:view'
    }
  )
);

// ============================================================================
// POST - Create Single Project (Admin SDK)
// Extracted to project-create.handler.ts to keep this route within
// Google SRP size limits (API ≤300 lines).
// ============================================================================
export { POST } from './project-create.handler';

