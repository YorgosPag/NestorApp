/**
 * =============================================================================
 * Floorplan Floor Wipe API — POST execute, GET preview (ADR-340 Phase 4 reborn)
 * =============================================================================
 *
 * GET   /api/floorplans/wipe-floor?floorId=X — preview counts (no mutations)
 * POST  /api/floorplans/wipe-floor           — body { floorId } — HARD wipe
 *
 * Used by the unified Wizard upload flow (DXF + PDF + Image) to clear all
 * prior state before a new background is uploaded. Replace flow guarantees:
 * one floorplan per floor at any time, no orphans.
 *
 * RBAC: super_admin, company_admin, internal_user.
 *
 * @module api/floorplans/wipe-floor/route
 * @enterprise ADR-340 Phase 4 reborn
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withHeavyRateLimit } from '@/lib/middleware/with-rate-limit';
import { FloorplanFloorWipeService } from '@/services/floorplan-background/floorplan-floor-wipe.service';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

export const maxDuration = 60;

const logger = createModuleLogger('FloorplanWipeFloorRoute');

const WRITE_ROLES = ['super_admin', 'company_admin', 'internal_user'] as const;

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message, code: 'BAD_REQUEST' }, { status });
}

// ============================================================================
// GET — preview
// ============================================================================

async function handleGet(
  request: NextRequest,
  ctx: AuthContext,
  _cache: PermissionCache,
): Promise<NextResponse> {
  if (!ctx.companyId) return bad('companyId missing on auth context', 403);

  const floorId = request.nextUrl.searchParams.get('floorId');
  if (!floorId) return bad('floorId query param required');

  try {
    const preview = await FloorplanFloorWipeService.preview(ctx.companyId, floorId);
    return NextResponse.json({ preview });
  } catch (err) {
    logger.error('Preview failed', { floorId, error: getErrorMessage(err) });
    return NextResponse.json(
      { error: getErrorMessage(err, 'Preview failed'), code: 'PREVIEW_FAILED' },
      { status: 500 },
    );
  }
}

// ============================================================================
// POST — execute
// ============================================================================

async function handlePost(
  request: NextRequest,
  ctx: AuthContext,
  _cache: PermissionCache,
): Promise<NextResponse> {
  if (!ctx.companyId) return bad('companyId missing on auth context', 403);

  let body: { floorId?: unknown };
  try {
    body = (await request.json()) as { floorId?: unknown };
  } catch (err) {
    return bad(`Invalid JSON body: ${getErrorMessage(err)}`);
  }

  const floorId = typeof body.floorId === 'string' ? body.floorId : '';
  if (!floorId) return bad('floorId is required');

  try {
    const result = await FloorplanFloorWipeService.wipeAllForFloor(ctx.companyId, floorId);
    return NextResponse.json({ result });
  } catch (err) {
    logger.error('Wipe failed', { floorId, error: getErrorMessage(err) });
    return NextResponse.json(
      { error: getErrorMessage(err, 'Wipe failed'), code: 'WIPE_FAILED' },
      { status: 500 },
    );
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const GET = withHeavyRateLimit(
  withAuth(handleGet, { requiredGlobalRoles: [...WRITE_ROLES] }),
);

export const POST = withHeavyRateLimit(
  withAuth(handlePost, { requiredGlobalRoles: [...WRITE_ROLES] }),
);
