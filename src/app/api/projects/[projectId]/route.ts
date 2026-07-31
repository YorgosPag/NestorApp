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
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import type { ProjectAddress } from '@/types/project/addresses';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { loadOwnedProject } from '../_shared/project-owned-doc';
import {
  handleUpdateProject,
  handleDeleteProject,
  ConflictError,
} from './project-mutations.service';
import type {
  ProjectUpdateResponse,
  ProjectDeleteResponse,
} from './project-mutations.types';

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
      // ADR-742 §7sexies: «υπάρχει;» και «δικό μου;» απαντούν με το **ίδιο**
      // σφάλμα, από τον ίδιο φορτωτή. Δεν ξαναγράφεται εδώ η αλυσίδα.
      const { id, data } = await loadOwnedProject({ projectId, caller: ctx, action: 'view' });

      return apiSuccess<ProjectGetResponse>(
        { project: { id, ...data } as ProjectGetResponse['project'] },
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
