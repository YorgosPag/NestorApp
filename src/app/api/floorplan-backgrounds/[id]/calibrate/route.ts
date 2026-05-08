/**
 * =============================================================================
 * Floorplan Backgrounds API — POST scale calibration (ADR-340 Phase 9)
 * =============================================================================
 *
 * POST /api/floorplan-backgrounds/[id]/calibrate
 *   body: { scale: { unitsPerMeter: number; sourceUnit: 'mm'|'cm'|'m'|'pixel' } }
 *
 * Persists the BackgroundScale metadata used by dimension/measurement
 * renderers + FloorplanGallery measure tool to compute real-world distances.
 * Distinct from the existing PATCH `kind: 'calibration'` (which performs the
 * affine 2-point remap of all overlay coordinates) — this endpoint only
 * writes scale metadata; no overlay rewrites.
 *
 * RBAC: super_admin, company_admin, internal_user.
 *
 * @module api/floorplan-backgrounds/[id]/calibrate/route
 * @enterprise ADR-340 Phase 9
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { setBackgroundScale } from '@/services/floorplan-background/floorplan-scale.service';
import { createModuleLogger } from '@/lib/telemetry';
import { logAuditEvent } from '@/lib/auth/audit';
import { getErrorMessage } from '@/lib/error-utils';
import type { BackgroundScale } from '@/types/floorplan-overlays';

const logger = createModuleLogger('FloorplanBackgroundCalibrateRoute');

interface RouteContext {
  params: Promise<{ id: string }>;
}

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message, code: 'BAD_REQUEST' }, { status });
}

function isValidScale(v: unknown): v is BackgroundScale {
  if (!v || typeof v !== 'object') return false;
  const s = v as BackgroundScale;
  if (typeof s.unitsPerMeter !== 'number' || !Number.isFinite(s.unitsPerMeter) || s.unitsPerMeter <= 0) {
    return false;
  }
  return s.sourceUnit === 'mm' || s.sourceUnit === 'cm' || s.sourceUnit === 'm' || s.sourceUnit === 'pixel';
}

async function handlePost(
  request: NextRequest,
  ctx: AuthContext,
  routeCtx: RouteContext,
): Promise<NextResponse> {
  try {
    const { id } = await routeCtx.params;
    if (!id) return bad('Missing background id', 400);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return bad('Invalid JSON body', 400);
    }

    const scale = (body as { scale?: unknown }).scale;
    if (!isValidScale(scale)) {
      return bad('Invalid scale payload — expected { unitsPerMeter > 0, sourceUnit ∈ {mm,cm,m,pixel} }', 422);
    }

    if (!ctx.companyId) return bad('Missing companyId in auth context', 403);

    const result = await setBackgroundScale({
      companyId: ctx.companyId,
      backgroundId: id,
      scale,
      updatedBy: ctx.uid,
    });

    await logAuditEvent(ctx, 'data_updated', id, 'api', {
      metadata: {
        path: `/api/floorplan-backgrounds/${id}/calibrate (POST)`,
        reason: 'BackgroundScale calibration metadata updated',
      },
    });

    return NextResponse.json({ success: true, backgroundId: id, scale: result });
  } catch (error) {
    const msg = getErrorMessage(error);
    logger.error('[FloorplanBackgroundsCalibrate/Post] Error', { error: msg });
    if (msg.includes('not found')) return bad('Background not found', 404);
    if (msg.includes('Cross-tenant')) return bad('Forbidden — cross-tenant', 403);
    return NextResponse.json(
      { success: false, error: 'Failed to update background scale', details: msg },
      { status: 500 },
    );
  }
}

export const POST = withStandardRateLimit(
  async (request: NextRequest, routeCtx: RouteContext) => {
    const handler = withAuth(
      async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache) =>
        handlePost(request, ctx, routeCtx),
      { permissions: 'dxf:layers:view' },
    );
    return handler(request);
  },
);
