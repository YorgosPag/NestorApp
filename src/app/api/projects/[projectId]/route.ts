/**
 * PROJECT CRUD API — /api/projects/[projectId]
 *
 * Thin route handlers delegating to project-mutations.service.ts.
 * Enterprise-grade with Admin SDK, RBAC, tenant isolation, and caching.
 *
 * @module api/projects/[projectId]
 * @see ADR-167 (Multi-address support)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { isRoleBypass } from '@/lib/auth/roles';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { ProjectAddress } from '@/types/project/addresses';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import {
  handleUpdateProject,
  handleDeleteProject,
  ConflictError,
} from './project-mutations.service';
import type {
  ProjectUpdateResponse,
  ProjectDeleteResponse,
} from './project-mutations.types';

const logger = createModuleLogger('ProjectRoute');

// =============================================================================
// FORCE DYNAMIC
// =============================================================================

export const dynamic = 'force-dynamic';

// =============================================================================
// GET HANDLER - Get Single Project
// =============================================================================

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

      const isSuperAdmin = isRoleBypass(ctx.globalRole);
      if (!isSuperAdmin && projectData?.companyId !== ctx.companyId) {
        throw new ApiError(403, 'Access denied - Project not found');
      }
      if (isSuperAdmin && projectData?.companyId !== ctx.companyId) {
        logger.info('[SUPER_ADMIN] Cross-tenant project view', { email: ctx.email, projectId, projectCompanyId: projectData?.companyId });
      }

      return apiSuccess<ProjectGetResponse>(
        { project: { id: projectDoc.id, ...projectData } as ProjectGetResponse['project'] },
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

async function handlePatch(
  request: NextRequest,
  segmentData?: { params: Promise<{ projectId: string }> }
): Promise<NextResponse> {
  const { projectId } = await segmentData!.params;

  const handler = withAuth<ApiSuccessResponse<ProjectUpdateResponse>>(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      try {
        return await handleUpdateProject(req, ctx, projectId);
      } catch (error) {
        if (error instanceof ConflictError) {
          return NextResponse.json(error.body, { status: error.statusCode });
        }
        throw error;
      }
    },
    { permissions: 'projects:projects:update' }
  );

  return handler(request);
}

export const PATCH = withStandardRateLimit(handlePatch);

// =============================================================================
// DELETE HANDLER - Delete Project
// =============================================================================

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
