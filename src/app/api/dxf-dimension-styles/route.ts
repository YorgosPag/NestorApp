/**
 * 📐 DXF DIMENSION STYLES API — ENTERPRISE ROUTE (ADR-362 Phase F4)
 *
 * Centralized CRUD for per-company custom DIMSTYLES (dxf_dimension_styles) plus
 * the per-company default-style pointer. Mirrors the /api/dxf-levels route.
 *
 * @module api/dxf-dimension-styles
 * @see ADR-362 §Group F Phase F4
 * @see ADR-286 — DXF Level Creation Centralization (pattern parent)
 *
 * 🔒 SECURITY:
 * - Permission: dxf:layers:view (read/create/update) · dxf:layers:manage (delete)
 * - Admin SDK for secure server-side operations
 * - Tenant isolation: query filtered by ctx.companyId
 */

import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import type { ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import type {
  DxfDimStyleCreateResponse,
  DxfDimStyleDeleteResponse,
  DxfDimStylesListResponse,
  DxfDimStyleUpdateResponse,
} from './dxf-dimension-styles.types';
import {
  handleCreateDxfDimStyle,
  handleDeleteDxfDimStyle,
  handleListDxfDimStyles,
  handlePatchDxfDimStyle,
} from './dxf-dimension-styles.handlers';

export const GET = withStandardRateLimit(
  async (request: NextRequest) => {
    const handler = withAuth<DxfDimStylesListResponse>(
      async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache) =>
        handleListDxfDimStyles(request, ctx),
      { permissions: 'dxf:layers:view' }
    );
    return handler(request);
  }
);

export const POST = withStandardRateLimit(
  withAuth<ApiSuccessResponse<DxfDimStyleCreateResponse>>(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) =>
      handleCreateDxfDimStyle(request, ctx),
    { permissions: 'dxf:layers:view' }
  )
);

export const PATCH = withStandardRateLimit(
  async (request: NextRequest) => {
    const handler = withAuth<DxfDimStyleUpdateResponse>(
      async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache) =>
        handlePatchDxfDimStyle(request, ctx),
      { permissions: 'dxf:layers:view' }
    );
    return handler(request);
  }
);

export const DELETE = withStandardRateLimit(
  async (request: NextRequest) => {
    const handler = withAuth<DxfDimStyleDeleteResponse>(
      async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache) =>
        handleDeleteDxfDimStyle(request, ctx),
      { permissions: 'dxf:layers:manage' }
    );
    return handler(request);
  }
);
