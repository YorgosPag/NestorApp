/**
 * 🏢 FLOORS API - ENTERPRISE NORMALIZED COLLECTION
 *
 * Provides access to floors using foreign key relationships.
 *
 * @module api/floors
 * @version 2.0.0
 * @updated 2026-01-15 - AUTHZ PHASE 2: Added RBAC protection
 *
 * 🔒 SECURITY:
 * - Permission: floors:floors:view
 * - Admin SDK for secure server-side operations
 * - Tenant isolation: Query filtered by ctx.companyId
 */

import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import type { ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import type { FloorCreateResponse, FloorDeleteResponse, FloorsListResponse, FloorUpdateResponse } from './floors.types';
import { handleCreateFloor, handleDeleteFloor, handleListFloors, handleUpdateFloor } from './floors.handlers';

export const GET = withStandardRateLimit(
  async (request: NextRequest) => {
    const handler = withAuth<FloorsListResponse>(
      async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => handleListFloors(request, ctx),
      { permissions: 'projects:floors:view' }
    );

    return handler(request);
  }
);

export const POST = withStandardRateLimit(
  withAuth<ApiSuccessResponse<FloorCreateResponse>>(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => handleCreateFloor(request, ctx),
    { permissions: 'projects:floors:view' }
  )
);

export const PATCH = withStandardRateLimit(
  async (request: NextRequest) => {
    const handler = withAuth<FloorUpdateResponse>(
      async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => handleUpdateFloor(request, ctx),
      { permissions: 'projects:floors:view' }
    );

    return handler(request);
  }
);

export const DELETE = withStandardRateLimit(
  async (request: NextRequest) => {
    const handler = withAuth<FloorDeleteResponse>(
      async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => handleDeleteFloor(request, ctx),
      { permissions: 'projects:floors:delete' }
    );

    return handler(request);
  }
);
