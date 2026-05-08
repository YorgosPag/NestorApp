/**
 * 🔷 FLOORPLAN OVERLAYS API — Enterprise Route (ADR-340 Phase 9)
 *
 * Centralized CRUD + upsert for the multi-kind `floorplan_overlays`
 * collection. Replaces direct client-side Firestore writes; enforces
 * tenant isolation, role↔geometry consistency, audit logging.
 *
 * @module api/floorplan-overlays
 * @see ADR-340 — Floorplan Background System (Phase 9 — Multi-Kind Overlays)
 *
 * 🔒 SECURITY:
 * - Permission: dxf:layers:view (POST/PUT/PATCH/GET) · dxf:layers:manage (DELETE)
 * - Admin SDK; tenant-scoped queries; immutable fields server-stamped
 */

import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import type { ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import type {
  FloorplanOverlayCreateResponse,
  FloorplanOverlayDeleteResponse,
  FloorplanOverlayUpdateResponse,
  FloorplanOverlayUpsertResponse,
  FloorplanOverlaysListResponse,
} from './floorplan-overlays.types';
import {
  handleCreateFloorplanOverlay,
  handleDeleteFloorplanOverlay,
  handleListFloorplanOverlays,
  handleUpdateFloorplanOverlay,
  handleUpsertFloorplanOverlay,
} from './floorplan-overlays.handlers';

export const GET = withStandardRateLimit(
  async (request: NextRequest) => {
    const handler = withAuth<FloorplanOverlaysListResponse>(
      async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache) =>
        handleListFloorplanOverlays(request, ctx),
      { permissions: 'dxf:layers:view' },
    );
    return handler(request);
  },
);

export const POST = withStandardRateLimit(
  withAuth<ApiSuccessResponse<FloorplanOverlayCreateResponse>>(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) =>
      handleCreateFloorplanOverlay(request, ctx),
    { permissions: 'dxf:layers:view' },
  ),
);

export const PUT = withStandardRateLimit(
  withAuth<ApiSuccessResponse<FloorplanOverlayUpsertResponse>>(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) =>
      handleUpsertFloorplanOverlay(request, ctx),
    { permissions: 'dxf:layers:view' },
  ),
);

export const PATCH = withStandardRateLimit(
  async (request: NextRequest) => {
    const handler = withAuth<FloorplanOverlayUpdateResponse>(
      async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache) =>
        handleUpdateFloorplanOverlay(request, ctx),
      { permissions: 'dxf:layers:view' },
    );
    return handler(request);
  },
);

export const DELETE = withStandardRateLimit(
  async (request: NextRequest) => {
    const handler = withAuth<FloorplanOverlayDeleteResponse>(
      async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache) =>
        handleDeleteFloorplanOverlay(request, ctx),
      { permissions: 'dxf:layers:manage' },
    );
    return handler(request);
  },
);
