/**
 * 🔷 DXF OVERLAY ITEMS API — ENTERPRISE ROUTE (ADR-289)
 *
 * Centralized CRUD + upsert for overlay polygon items stored under
 * `dxf_overlay_levels/{levelId}/items/{overlayId}`. Replaces direct client
 * Firestore writes in `overlay-store.tsx`.
 *
 * @module api/dxf-overlay-items
 * @see ADR-289 — DXF Overlay Item Centralization
 * @see ADR-237 — Polygon Overlay Bridge
 * @see ADR-285 — DXF Tenant Scoping
 * @see ADR-288 — CAD File Metadata Centralization (upsert pattern)
 *
 * 🔒 SECURITY:
 * - Permission: dxf:layers:view (POST/PUT/PATCH/GET) · dxf:layers:manage (DELETE)
 * - Admin SDK for secure server-side operations
 * - Tenant isolation enforced on every write/delete
 */

import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import type { ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import type {
  DxfOverlayItemCreateResponse,
  DxfOverlayItemDeleteResponse,
  DxfOverlayItemUpdateResponse,
  DxfOverlayItemUpsertResponse,
  DxfOverlayItemsListResponse,
} from './dxf-overlay-items.types';
import {
  handleCreateDxfOverlayItem,
  handleDeleteDxfOverlayItem,
  handleListDxfOverlayItems,
  handleUpdateDxfOverlayItem,
  handleUpsertDxfOverlayItem,
} from './dxf-overlay-items.handlers';

export const GET = withStandardRateLimit(
  async (request: NextRequest) => {
    const handler = withAuth<DxfOverlayItemsListResponse>(
      async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache) =>
        handleListDxfOverlayItems(request, ctx),
      { permissions: 'dxf:layers:view' }
    );
    return handler(request);
  }
);

export const POST = withStandardRateLimit(
  withAuth<ApiSuccessResponse<DxfOverlayItemCreateResponse>>(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) =>
      handleCreateDxfOverlayItem(request, ctx),
    { permissions: 'dxf:layers:view' }
  )
);

export const PUT = withStandardRateLimit(
  withAuth<ApiSuccessResponse<DxfOverlayItemUpsertResponse>>(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) =>
      handleUpsertDxfOverlayItem(request, ctx),
    { permissions: 'dxf:layers:view' }
  )
);

export const PATCH = withStandardRateLimit(
  async (request: NextRequest) => {
    const handler = withAuth<DxfOverlayItemUpdateResponse>(
      async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache) =>
        handleUpdateDxfOverlayItem(request, ctx),
      { permissions: 'dxf:layers:view' }
    );
    return handler(request);
  }
);

export const DELETE = withStandardRateLimit(
  async (request: NextRequest) => {
    const handler = withAuth<DxfOverlayItemDeleteResponse>(
      async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache) =>
        handleDeleteDxfOverlayItem(request, ctx),
      { permissions: 'dxf:layers:manage' }
    );
    return handler(request);
  }
);
