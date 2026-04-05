/**
 * 📐 DXF LEVELS API — ENTERPRISE ROUTE
 *
 * Provides centralized CRUD for DXF Viewer levels (dxf-viewer-levels collection).
 * Replaces direct client-side setDoc writes with server-side createEntity()
 * pipeline (ADR-286).
 *
 * @module api/dxf-levels
 * @see ADR-286 — DXF Level Creation Centralization
 * @see ADR-238 — Entity Creation Centralization
 *
 * 🔒 SECURITY:
 * - Permission: dxf:layers:view (read/create/update) · dxf:layers:manage (delete)
 * - Admin SDK for secure server-side operations
 * - Tenant isolation: Query filtered by ctx.companyId
 */

import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import type { ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import type {
  DxfLevelCreateResponse,
  DxfLevelDeleteResponse,
  DxfLevelsListResponse,
  DxfLevelUpdateResponse,
} from './dxf-levels.types';
import {
  handleCreateDxfLevel,
  handleDeleteDxfLevel,
  handleListDxfLevels,
  handleUpdateDxfLevel,
} from './dxf-levels.handlers';

export const GET = withStandardRateLimit(
  async (request: NextRequest) => {
    const handler = withAuth<DxfLevelsListResponse>(
      async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache) =>
        handleListDxfLevels(request, ctx),
      { permissions: 'dxf:layers:view' }
    );
    return handler(request);
  }
);

export const POST = withStandardRateLimit(
  withAuth<ApiSuccessResponse<DxfLevelCreateResponse>>(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) =>
      handleCreateDxfLevel(request, ctx),
    { permissions: 'dxf:layers:view' }
  )
);

export const PATCH = withStandardRateLimit(
  async (request: NextRequest) => {
    const handler = withAuth<DxfLevelUpdateResponse>(
      async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache) =>
        handleUpdateDxfLevel(request, ctx),
      { permissions: 'dxf:layers:view' }
    );
    return handler(request);
  }
);

export const DELETE = withStandardRateLimit(
  async (request: NextRequest) => {
    const handler = withAuth<DxfLevelDeleteResponse>(
      async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache) =>
        handleDeleteDxfLevel(request, ctx),
      { permissions: 'dxf:layers:manage' }
    );
    return handler(request);
  }
);
