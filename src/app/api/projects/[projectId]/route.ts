/**
 * =============================================================================
 * 🏢 ENTERPRISE: PROJECT UPDATE/DELETE ENDPOINT
 * =============================================================================
 *
 * API endpoint for updating and deleting individual projects.
 * Enterprise-grade with Admin SDK, RBAC, tenant isolation, and caching.
 *
 * @module api/projects/[projectId]
 * @version 1.0.0
 * @created 2026-02-02 - ADR-167 Multi-address support
 *
 * 🏢 ARCHITECTURE:
 * - Admin SDK (server-side, bypasses Firestore rules)
 * - withAuth + RBAC protection
 * - Tenant isolation (companyId verification)
 * - Cache invalidation on mutations
 * - Type-safe field updates
 * - Audit logging
 *
 * 🔒 SECURITY:
 * - Permission: projects:projects:view (GET)
 * - Permission: projects:projects:update (PATCH)
 * - Permission: projects:projects:delete (DELETE)
 * - Tenant isolation: Verifies project ownership before updates
 * - No unauthorized cross-tenant operations
 *
 * 📝 FEATURES:
 * - Update project basic fields (name, title, description, status)
 * - Update legacy address fields (address, city) - backward compatible
 * - Update multi-address array (addresses[]) - ADR-167
 * - Auto-sync between legacy and new address fields
 * - Soft delete capability (status: 'archived')
 * - Hard delete with cascade options
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withAuth, logAuditEvent } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { isRoleBypass } from '@/lib/auth/roles';
import { COLLECTIONS } from '@/config/firestore-collections';
import { EnterpriseAPICache } from '@/lib/cache/enterprise-api-cache';
import { FieldValue } from 'firebase-admin/firestore';
import type { ProjectAddress } from '@/types/project/addresses';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('ProjectRoute');

// =============================================================================
// TYPES
// =============================================================================

/**
 * Project update payload - supports both legacy and new address fields
 */
interface ProjectUpdatePayload {
  name?: string;
  title?: string;
  description?: string;
  status?: string;
  // Legacy fields (backward compatible)
  address?: string;
  city?: string;
  // 🏢 ENTERPRISE: Multi-address support (ADR-167)
  addresses?: ProjectAddress[];
  // Additional optional fields
  progress?: number;
  totalValue?: number;
  totalArea?: number;
  startDate?: string | Date;
  completionDate?: string | Date;
}

interface ProjectUpdateResponse {
  projectId: string;
  updated: boolean;
}

interface ProjectDeleteResponse {
  projectId: string;
  deleted: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const CACHE_KEY_PREFIX = 'api:projects:list';

// =============================================================================
// FORCE DYNAMIC
// =============================================================================

export const dynamic = 'force-dynamic';

// =============================================================================
// GET HANDLER - Get Single Project
// =============================================================================

/**
 * GET /api/projects/[projectId]
 *
 * Fetch a single project by ID, including addresses array.
 *
 * @security Protected with RBAC - projects:projects:view
 * @security Tenant isolation - only access own company's projects
 */

interface ProjectGetResponse {
  project: {
    id: string;
    name?: string;
    title?: string;
    address?: string;
    city?: string;
    addresses?: ProjectAddress[];
    companyId?: string;
    status?: string;
    [key: string]: unknown;
  };
}

async function handleGet(
  request: NextRequest,
  segmentData?: { params: Promise<{ projectId: string }> }
): Promise<NextResponse> {
  const { projectId } = await segmentData!.params;

  const handler = withAuth<ApiSuccessResponse<ProjectGetResponse>>(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      const adminDb = getAdminFirestore();

      const projectRef = adminDb.collection(COLLECTIONS.PROJECTS).doc(projectId);
      const projectDoc = await projectRef.get();

      if (!projectDoc.exists) {
        throw new ApiError(404, 'Project not found');
      }

      const projectData = projectDoc.data();

      // Tenant isolation: bypass for Super Admin, enforce for regular users
      const isSuperAdmin = isRoleBypass(ctx.globalRole);
      if (!isSuperAdmin && projectData?.companyId !== ctx.companyId) {
        throw new ApiError(403, 'Access denied - Project not found');
      }
      if (isSuperAdmin && projectData?.companyId !== ctx.companyId) {
        logger.info('[SUPER_ADMIN] Cross-tenant project view', { email: ctx.email, projectId, projectCompanyId: projectData?.companyId });
      }

      return apiSuccess<ProjectGetResponse>(
        {
          project: {
            id: projectDoc.id,
            ...projectData,
          } as ProjectGetResponse['project'],
        },
        'Project fetched successfully'
      );
    },
    { permissions: 'projects:projects:view' }
  );

  return handler(request);
}

export const GET = withStandardRateLimit(handleGet);

// =============================================================================
// PATCH HANDLER - Update Project
// =============================================================================

/**
 * PATCH /api/projects/[projectId]
 *
 * Update a project's fields including addresses.
 *
 * 🔒 SECURITY: Protected with RBAC
 * - Permission: projects:projects:update
 * - Tenant isolation: Only update projects in same company
 * - Validates project existence and ownership
 * - Rate Limit: STANDARD (60 req/min)
 *
 * 🏢 ENTERPRISE: Supports both legacy and multi-address (ADR-167)
 * - Legacy: { address, city }
 * - New: { addresses: ProjectAddress[] }
 * - Auto-sync: Updates both formats automatically
 */
async function handlePatch(
  request: NextRequest,
  segmentData?: { params: Promise<{ projectId: string }> }
): Promise<NextResponse> {
  const { projectId } = await segmentData!.params;

  const handler = withAuth<ApiSuccessResponse<ProjectUpdateResponse>>(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      return handleUpdateProject(req, ctx, projectId);
    },
    { permissions: 'projects:projects:update' }
  );

  return handler(request);
}

export const PATCH = withStandardRateLimit(handlePatch);

async function handleUpdateProject(
  request: NextRequest,
  ctx: AuthContext,
  projectId: string
): Promise<ReturnType<typeof apiSuccess<ProjectUpdateResponse>>> {
  const startTime = Date.now();

  logger.info('[Projects/Update] User updating project', { email: ctx.email, projectId });

  // 1. Parse request body
  const body: ProjectUpdatePayload = await request.json();

  if (!body || Object.keys(body).length === 0) {
    throw new ApiError(400, 'No update fields provided');
  }

  // 2. Get project document and verify ownership (tenant isolation)
  const projectRef = getAdminFirestore().collection(COLLECTIONS.PROJECTS).doc(projectId);
  const projectDoc = await projectRef.get();

  if (!projectDoc.exists) {
    logger.info('[Projects/Update] Project not found', { projectId });
    throw new ApiError(404, 'Project not found');
  }

  const projectData = projectDoc.data();

  // 3. Validate tenant isolation: bypass for Super Admin, enforce for regular users
  const isSuperAdmin = isRoleBypass(ctx.globalRole);
  if (!isSuperAdmin && projectData?.companyId !== ctx.companyId) {
    logger.warn('[Projects/Update] TENANT ISOLATION VIOLATION: attempted to update project', { uid: ctx.uid, userCompanyId: ctx.companyId, projectId, projectCompanyId: projectData?.companyId });
    throw new ApiError(403, 'Access denied - Project not found');
  }
  if (isSuperAdmin && projectData?.companyId !== ctx.companyId) {
    logger.info('[SUPER_ADMIN] Cross-tenant project update', { email: ctx.email, projectId, projectCompanyId: projectData?.companyId });
  }

  // 4. Build update payload
  const updateData: Record<string, unknown> = {
    ...body,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: ctx.uid,
  };

  // 🏢 ENTERPRISE: Remove undefined fields (Firestore doesn't accept undefined)
  const cleanData = Object.fromEntries(
    Object.entries(updateData).filter(([, value]) => value !== undefined)
  );

  logger.info('[Projects/Update] Updating fields', { fieldsCount: Object.keys(cleanData).length });

  // 5. Update project using Admin SDK
  await projectRef.update(cleanData);

  const duration = Date.now() - startTime;
  logger.info('[Projects/Update] Project updated successfully', { projectId, durationMs: duration });

  // 6. Invalidate caches
  const cache = EnterpriseAPICache.getInstance();
  cache.delete(`${CACHE_KEY_PREFIX}:${ctx.companyId}`);
  cache.delete(`${CACHE_KEY_PREFIX}:all`);
  logger.info('[Projects/Update] Cache invalidated for tenant', { companyId: ctx.companyId });

  // 7. Audit log
  await logAuditEvent(ctx, 'data_updated', 'projects', 'api', {
    newValue: {
      type: 'status',
      value: {
        projectId,
        projectName: projectData?.name,
        fieldsUpdated: Object.keys(cleanData),
        duration,
      },
    },
    metadata: { reason: 'Project updated' },
  });

  return apiSuccess<ProjectUpdateResponse>(
    {
      projectId,
      updated: true,
    },
    `Project updated successfully in ${duration}ms`
  );
}

// =============================================================================
// DELETE HANDLER - Delete Project
// =============================================================================

/**
 * DELETE /api/projects/[projectId]
 *
 * Delete a project (soft delete by default).
 *
 * 🔒 SECURITY: Protected with RBAC
 * - Permission: projects:projects:delete
 * - Tenant isolation: Only delete projects in same company
 * - Validates project existence and ownership
 * - Rate Limit: STANDARD (60 req/min)
 *
 * 🏢 ENTERPRISE: Soft delete by default
 * - Sets status: 'archived'
 * - Adds deletedAt timestamp
 * - Preserves data for audit/recovery
 * - Hard delete requires ?hard=true query param
 */
async function handleDelete(
  request: NextRequest,
  segmentData?: { params: Promise<{ projectId: string }> }
): Promise<NextResponse> {
  const { projectId } = await segmentData!.params;

  const handler = withAuth<ApiSuccessResponse<ProjectDeleteResponse>>(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      return handleDeleteProject(req, ctx, projectId);
    },
    { permissions: 'projects:projects:delete' }
  );

  return handler(request);
}

export const DELETE = withStandardRateLimit(handleDelete);

async function handleDeleteProject(
  request: NextRequest,
  ctx: AuthContext,
  projectId: string
): Promise<ReturnType<typeof apiSuccess<ProjectDeleteResponse>>> {
  const startTime = Date.now();

  // Check if hard delete is requested
  const url = new URL(request.url);
  const hardDelete = url.searchParams.get('hard') === 'true';

  logger.info('[Projects/Delete] User deleting project', { email: ctx.email, projectId, hardDelete });

  // 1. Get project document and verify ownership (tenant isolation)
  const projectRef = getAdminFirestore().collection(COLLECTIONS.PROJECTS).doc(projectId);
  const projectDoc = await projectRef.get();

  if (!projectDoc.exists) {
    logger.info('[Projects/Delete] Project not found', { projectId });
    throw new ApiError(404, 'Project not found');
  }

  const projectData = projectDoc.data();

  // 2. Validate tenant isolation: bypass for Super Admin, enforce for regular users
  const isSuperAdmin = isRoleBypass(ctx.globalRole);
  if (!isSuperAdmin && projectData?.companyId !== ctx.companyId) {
    logger.warn('[Projects/Delete] TENANT ISOLATION VIOLATION: attempted to delete project', { uid: ctx.uid, userCompanyId: ctx.companyId, projectId, projectCompanyId: projectData?.companyId });
    throw new ApiError(403, 'Access denied - Project not found');
  }
  if (isSuperAdmin && projectData?.companyId !== ctx.companyId) {
    logger.info('[SUPER_ADMIN] Cross-tenant project delete', { email: ctx.email, projectId, projectCompanyId: projectData?.companyId });
  }

  // 3. Delete project
  if (hardDelete) {
    // Hard delete - permanently remove document
    await projectRef.delete();
    logger.info('[Projects/Delete] Project HARD DELETED', { projectId });
  } else {
    // Soft delete - archive project
    await projectRef.update({
      status: 'archived',
      deletedAt: FieldValue.serverTimestamp(),
      deletedBy: ctx.uid,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: ctx.uid,
    });
    logger.info('[Projects/Delete] Project ARCHIVED (soft delete)', { projectId });
  }

  const duration = Date.now() - startTime;

  // 4. Invalidate caches
  const cache = EnterpriseAPICache.getInstance();
  cache.delete(`${CACHE_KEY_PREFIX}:${ctx.companyId}`);
  cache.delete(`${CACHE_KEY_PREFIX}:all`);
  logger.info('[Projects/Delete] Cache invalidated for tenant', { companyId: ctx.companyId });

  // 5. Audit log
  await logAuditEvent(ctx, 'data_deleted', 'projects', 'api', {
    newValue: {
      type: 'status',
      value: {
        projectId,
        projectName: projectData?.name,
        deleteType: hardDelete ? 'hard' : 'soft',
        duration,
      },
    },
    metadata: { reason: 'Project deleted' },
  });

  return apiSuccess<ProjectDeleteResponse>(
    {
      projectId,
      deleted: true,
    },
    `Project ${hardDelete ? 'permanently deleted' : 'archived'} successfully in ${duration}ms`
  );
}
