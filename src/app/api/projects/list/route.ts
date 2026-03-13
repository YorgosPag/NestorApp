/**
 * 🏗️ PROJECTS LIST ENDPOINT
 *
 * Enterprise-grade endpoint για loading ALL projects για audit grid.
 * Διαχωρισμένο από /api/audit/bootstrap (Option A architecture).
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
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { COLLECTIONS } from '@/config/firestore-collections';
import { fieldToISO } from '@/lib/date-local';
import { getString, getNumber, getArray } from '@/lib/firestore/field-extractors';
import { EnterpriseAPICache } from '@/lib/cache/enterprise-api-cache';
import { FieldValue } from 'firebase-admin/firestore';
import { withHighRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('ProjectsListRoute');

// ============================================================================
// TYPES - Project List Response
// ============================================================================

interface ProjectListItem {
  id: string;
  name: string;
  title: string;
  status: string;
  company: string;
  companyId: string;
  address: string;
  city: string;
  // 🏢 ENTERPRISE: Multi-address support (ADR-167)
  addresses?: unknown[];
  progress: number;
  totalValue: number;
  totalArea: number;
  startDate: string;
  completionDate: string;
  lastUpdate: string;
}

interface ProjectListResponse {
  projects: ProjectListItem[];
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
 * 🔒 ENTERPRISE: Normalize status to canonical values
 */
function normalizeStatus(status: string): string {
  if (status === 'construction' || status === 'active') {
    return 'in_progress';
  }
  return status || 'unknown';
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
          .where('companyId', '==', ctx.companyId)
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

  const projects: ProjectListItem[] = activeDocs.map(doc => {
    const data = doc.data() as Record<string, unknown>;

    return {
      id: doc.id,
      name: getString(data, 'name', 'Unnamed Project'),
      title: getString(data, 'title'),
      status: normalizeStatus(getString(data, 'status')),
      company: getString(data, 'company'),
      companyId: getString(data, 'companyId'),
      address: getString(data, 'address'),
      city: getString(data, 'city'),
      // 🏢 ENTERPRISE: Multi-address support (ADR-167)
      addresses: getArray(data, 'addresses'),
      progress: getNumber(data, 'progress'),
      totalValue: getNumber(data, 'totalValue'),
      totalArea: getNumber(data, 'totalArea'),
      startDate: fieldToISO(data, 'startDate'),
      completionDate: fieldToISO(data, 'completionDate'),
      lastUpdate: fieldToISO(data, 'lastUpdate') || fieldToISO(data, 'updatedAt')
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
// ============================================================================

interface ProjectCreatePayload {
  name: string;
  title?: string;
  description?: string;
  status?: string;
  companyId: string;
  company?: string;
  address?: string;
  city?: string;
}

interface ProjectCreateResponse {
  projectId: string;
  project: ProjectCreatePayload & { id: string };
}

/**
 * 🎯 ENTERPRISE: Create new project via Admin SDK
 *
 * 🔒 SECURITY: Firestore rules block client-side writes (allow write: if false)
 *              This endpoint uses Admin SDK to bypass rules with proper auth
 * @permission projects:projects:create
 * @rateLimit STANDARD (60 req/min) - CRUD
 */
export const POST = withHighRateLimit(
  withAuth<ApiSuccessResponse<ProjectCreateResponse>>(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      try {
        // 🏢 ENTERPRISE: Parse request body
        const body: ProjectCreatePayload = await req.json();

        // 🔒 SECURITY: Override companyId with authenticated user's company
        // This prevents cross-tenant project creation
        const sanitizedData = {
          ...body,
          companyId: ctx.companyId,  // 🔒 FORCED: Always use auth context companyId
          progress: 0,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          createdBy: ctx.uid,
        };

        // 🏢 ENTERPRISE: Remove undefined fields (Firestore doesn't accept undefined)
        const cleanData = Object.fromEntries(
          Object.entries(sanitizedData).filter(([, value]) => value !== undefined)
        );

        logger.info('[Projects] Creating new project for tenant', { companyId: ctx.companyId });

        // 🏗️ CREATE: Use Admin SDK (bypasses Firestore rules)
        const docRef = await getAdminFirestore().collection(COLLECTIONS.PROJECTS).add(cleanData);

        logger.info('[Projects] Project created', { projectId: docRef.id });

        // 📊 Audit log
        await logAuditEvent(ctx, 'data_created', 'projects', 'api', {
          newValue: {
            type: 'project_create',
            value: {
              projectId: docRef.id,
              projectName: body.name,
            },
          },
          metadata: { reason: 'Project created' },
        });

        // 🏢 AUTO-REGISTER: Ensure company exists in navigation_companies
        const adminDb = getAdminFirestore();
        const navQuery = await adminDb
          .collection(COLLECTIONS.NAVIGATION)
          .where('contactId', '==', ctx.companyId)
          .limit(1)
          .get();

        if (navQuery.empty) {
          await adminDb.collection(COLLECTIONS.NAVIGATION).add({
            contactId: ctx.companyId,
            addedAt: FieldValue.serverTimestamp(),
            addedBy: ctx.uid,
            source: 'auto_project_create',
          });
          logger.info('[Projects] Auto-registered company in navigation', { companyId: ctx.companyId });
        }

        // 🔄 Invalidate cache for this tenant
        const cache = EnterpriseAPICache.getInstance();
        cache.delete(`${CACHE_KEY_PREFIX}:${ctx.companyId}`);
        cache.delete(`${CACHE_KEY_PREFIX}:all`);

        return apiSuccess<ProjectCreateResponse>(
          {
            projectId: docRef.id,
            project: { ...body, id: docRef.id }
          },
          'Project created successfully'
        );

      } catch (error) {
        logger.error('[Projects] Error creating project', { error });
        throw new ApiError(500, error instanceof Error ? error.message : 'Failed to create project');
      }
    },
    { permissions: 'projects:projects:create' }
  )
);
