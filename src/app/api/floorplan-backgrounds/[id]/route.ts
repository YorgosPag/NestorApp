/**
 * =============================================================================
 * Floorplan Backgrounds API — PATCH (transform | calibration) + DELETE cascade
 * =============================================================================
 *
 * PATCH /api/floorplan-backgrounds/[id]
 *   body: { kind: 'transform', transform?, opacity?, visible?, locked? }
 *      or { kind: 'calibration', oldTransform, newTransform, calibration }
 *
 * DELETE /api/floorplan-backgrounds/[id]
 *   - cascades floorplan_overlays linked to this background
 *   - the doc delete triggers Cloud Function for files/{fileId} ref-count cleanup
 *
 * RBAC (Q9): super_admin, company_admin, internal_user.
 *
 * @module api/floorplan-backgrounds/[id]/route
 * @enterprise ADR-340 Phase 7
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { FloorplanBackgroundService } from '@/services/floorplan-background/floorplan-background.service';
import { FloorplanCascadeDeleteService } from '@/services/floorplan-background/floorplan-cascade-delete.service';
import { CalibrationRemapService } from '@/services/floorplan-background/calibration-remap.service';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import type {
  BackgroundTransform,
  CalibrationData,
} from '@/subapps/dxf-viewer/floorplan-background/providers/types';

const logger = createModuleLogger('FloorplanBackgroundIdRoute');

const WRITE_ROLES = ['super_admin', 'company_admin', 'internal_user'] as const;

interface RouteContext {
  params: Promise<{ id: string }>;
}

// ============================================================================
// HELPERS
// ============================================================================

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message, code: 'BAD_REQUEST' }, { status });
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function isTransform(v: unknown): v is BackgroundTransform {
  if (!v || typeof v !== 'object') return false;
  const t = v as BackgroundTransform;
  return (
    isFiniteNumber(t.translateX) &&
    isFiniteNumber(t.translateY) &&
    isFiniteNumber(t.scaleX) &&
    isFiniteNumber(t.scaleY) &&
    isFiniteNumber(t.rotation)
  );
}

function isCalibrationData(v: unknown): v is CalibrationData {
  if (!v || typeof v !== 'object') return false;
  const c = v as CalibrationData;
  if (c.method !== 'two-point') return false;
  if (!isFiniteNumber(c.realDistance) || c.realDistance <= 0) return false;
  if (!['m', 'cm', 'mm', 'ft', 'in'].includes(c.unit)) return false;
  if (!c.pointA || !isFiniteNumber(c.pointA.x) || !isFiniteNumber(c.pointA.y)) return false;
  if (!c.pointB || !isFiniteNumber(c.pointB.x) || !isFiniteNumber(c.pointB.y)) return false;
  return true;
}

// ============================================================================
// PATCH
// ============================================================================

async function handlePatch(
  request: NextRequest,
  ctx: AuthContext,
  _cache: PermissionCache,
  routeContext?: RouteContext,
): Promise<NextResponse> {
  if (!ctx.companyId) return bad('companyId missing on auth context', 403);
  if (!routeContext) return bad('Missing route context', 500);
  const { id } = await routeContext.params;
  if (!id) return bad('Missing background id');

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return bad('Invalid JSON body');
  }
  if (!body || typeof body !== 'object') return bad('Body must be an object');

  const kind = (body as { kind?: unknown }).kind;

  try {
    if (kind === 'transform') {
      const { transform, opacity, visible, locked } = body as {
        transform?: Partial<BackgroundTransform>;
        opacity?: number;
        visible?: boolean;
        locked?: boolean;
      };
      const updated = await FloorplanBackgroundService.patchTransform(id, {
        companyId: ctx.companyId,
        transform: transform ?? {},
        opacity,
        visible,
        locked,
        updatedBy: ctx.uid,
      });
      return NextResponse.json({ background: updated });
    }

    if (kind === 'calibration') {
      const { oldTransform, newTransform, calibration } = body as {
        oldTransform?: BackgroundTransform;
        newTransform?: BackgroundTransform;
        calibration?: CalibrationData;
      };
      if (!isTransform(oldTransform)) return bad('Invalid oldTransform');
      if (!isTransform(newTransform)) return bad('Invalid newTransform');
      if (!isCalibrationData(calibration)) return bad('Invalid calibration data');

      const existing = await FloorplanBackgroundService.getById(id, ctx.companyId);
      if (!existing) return bad('Background not found', 404);
      if (existing.locked) return bad('Background is locked', 409);

      const remap = await CalibrationRemapService.applyCalibration({
        companyId: ctx.companyId,
        backgroundId: id,
        oldTransform,
        newTransform,
        calibration,
        updatedBy: ctx.uid,
      });
      const updated = await FloorplanBackgroundService.getById(id, ctx.companyId);
      return NextResponse.json({ background: updated, remap });
    }

    return bad('Invalid kind: expected "transform" or "calibration"');
  } catch (err) {
    const msg = getErrorMessage(err);
    logger.error('PATCH failed', { id, kind, error: msg });
    if (msg.includes('not found')) {
      return NextResponse.json({ error: msg, code: 'NOT_FOUND' }, { status: 404 });
    }
    if (msg.includes('Cross-tenant') || msg.includes('locked')) {
      return NextResponse.json({ error: msg, code: 'FORBIDDEN' }, { status: 409 });
    }
    return NextResponse.json({ error: msg, code: 'PATCH_FAILED' }, { status: 500 });
  }
}

// ============================================================================
// DELETE
// ============================================================================

async function handleDelete(
  request: NextRequest,
  ctx: AuthContext,
  _cache: PermissionCache,
  routeContext?: RouteContext,
): Promise<NextResponse> {
  if (!ctx.companyId) return bad('companyId missing on auth context', 403);
  if (!routeContext) return bad('Missing route context', 500);
  const { id } = await routeContext.params;
  if (!id) return bad('Missing background id');

  try {
    const existing = await FloorplanBackgroundService.getById(id, ctx.companyId);
    if (!existing) return NextResponse.json({ deleted: false }, { status: 404 });

    const overlaysDeleted = await FloorplanCascadeDeleteService.cascadeOverlaysForBackground(
      ctx.companyId,
      id,
    );

    await FloorplanBackgroundService.deleteById(id, ctx.companyId);

    logger.info('Background deleted via API', { id, overlaysDeleted });
    return NextResponse.json({ deleted: true, overlaysDeleted });
  } catch (err) {
    const msg = getErrorMessage(err);
    logger.error('DELETE failed', { id, error: msg });
    return NextResponse.json({ error: msg, code: 'DELETE_FAILED' }, { status: 500 });
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const PATCH = withStandardRateLimit(
  withAuth(handlePatch, { requiredGlobalRoles: [...WRITE_ROLES] }),
);

export const DELETE = withStandardRateLimit(
  withAuth(handleDelete, { requiredGlobalRoles: [...WRITE_ROLES] }),
);
