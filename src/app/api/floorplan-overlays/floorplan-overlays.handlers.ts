/**
 * 🔷 FLOORPLAN OVERLAYS API — Enterprise Handlers (ADR-340 Phase 9)
 *
 * Centralizes writes to the `floorplan_overlays` collection (multi-kind
 * discriminated-union schema). Per-role geometry consistency + linked
 * entity requirements enforced before commit. Tenant-isolated, audited.
 *
 * @see ADR-340 — Floorplan Background System (Phase 9 — Multi-Kind Overlays)
 * @see src/types/floorplan-overlays.ts — schema SSoT
 *
 * 🔒 SECURITY:
 * - Permission: dxf:layers:view (create/update/upsert/read) · dxf:layers:manage (delete)
 * - Admin SDK; companyId stamped server-side; immutable fields guarded
 */

import { NextRequest, NextResponse } from 'next/server';
import type { AuthContext } from '@/lib/auth';
import { COLLECTIONS } from '@/config/firestore-collections';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { getAdminFirestore, FieldValue, Timestamp } from '@/lib/firebaseAdmin';
import { createModuleLogger } from '@/lib/telemetry';
import { logAuditEvent } from '@/lib/auth/audit';
import { isRoleBypass } from '@/lib/auth/roles';
import { getErrorMessage } from '@/lib/error-utils';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { generateOverlayId } from '@/services/enterprise-id.service';
import {
  isRoleGeometryConsistent,
  findMissingLink,
  type OverlayGeometry,
  type OverlayLinked,
  type OverlayRole,
} from '@/types/floorplan-overlays';
import {
  CreateFloorplanOverlaySchema,
  UpdateFloorplanOverlaySchema,
  UpsertFloorplanOverlaySchema,
} from './floorplan-overlays.schemas';
import type {
  FloorplanOverlayCreateResponse,
  FloorplanOverlayDeleteResponse,
  FloorplanOverlayDocument,
  FloorplanOverlayUpdateResponse,
  FloorplanOverlayUpsertResponse,
  FloorplanOverlaysListResponse,
} from './floorplan-overlays.types';

const logger = createModuleLogger('FloorplanOverlaysRoute');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function overlayDocRef(overlayId: string) {
  return getAdminFirestore().collection(COLLECTIONS.FLOORPLAN_OVERLAYS).doc(overlayId);
}

/**
 * Throws ApiError(422) if role doesn't allow the geometry type or if the
 * required linked entity id is missing.
 */
function validateRoleGeometryConsistency(
  role: OverlayRole,
  geometry: OverlayGeometry,
  linked: OverlayLinked | undefined,
): void {
  if (!isRoleGeometryConsistent(role, geometry.type)) {
    throw new ApiError(
      422,
      `role '${role}' does not allow geometry type '${geometry.type}'`,
    );
  }
  const missing = findMissingLink(role, linked);
  if (missing) {
    throw new ApiError(422, `role '${role}' requires linked.${missing}`);
  }
}

function ensureSameCompany(
  ctx: AuthContext,
  existingCompanyId: string | null | undefined,
  overlayId: string,
  path: string,
): void {
  if (
    existingCompanyId &&
    existingCompanyId !== ctx.companyId &&
    !isRoleBypass(ctx.globalRole)
  ) {
    void logAuditEvent(ctx, 'access_denied', overlayId, 'api', {
      metadata: { path, reason: 'Tenant isolation violation — overlay companyId mismatch' },
    });
    throw new ApiError(403, 'Access denied — tenant isolation violation');
  }
}

// ─── POST — create ────────────────────────────────────────────────────────────

export async function handleCreateFloorplanOverlay(
  request: NextRequest,
  ctx: AuthContext,
): Promise<NextResponse<ApiSuccessResponse<FloorplanOverlayCreateResponse>>> {
  try {
    const parsed = safeParseBody(CreateFloorplanOverlaySchema, await request.json());
    if (parsed.error) throw new ApiError(400, 'Validation failed');
    const body = parsed.data;

    validateRoleGeometryConsistency(body.role, body.geometry, body.linked);

    const overlayId = generateOverlayId();
    const docRef = overlayDocRef(overlayId);

    const doc: Record<string, unknown> = {
      id: overlayId,
      companyId: ctx.companyId,
      backgroundId: body.backgroundId,
      floorId: body.floorId,
      geometry: body.geometry,
      role: body.role,
      createdBy: ctx.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      ...(body.linked !== undefined ? { linked: body.linked } : {}),
      ...(body.label !== undefined ? { label: body.label } : {}),
      ...(body.style !== undefined ? { style: body.style } : {}),
      ...(body.layer !== undefined ? { layer: body.layer } : {}),
    };

    await docRef.set(doc);

    await logAuditEvent(ctx, 'data_created', overlayId, 'api', {
      metadata: {
        path: '/api/floorplan-overlays (POST)',
        reason: 'Floorplan overlay created via centralized SSoT pipeline',
      },
    });

    logger.info('[FloorplanOverlays/Create]', {
      overlayId,
      role: body.role,
      geometryType: body.geometry.type,
      companyId: ctx.companyId,
    });

    return apiSuccess<FloorplanOverlayCreateResponse>(
      { overlayId },
      `Overlay "${overlayId}" created`,
    );
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logger.error('[FloorplanOverlays/Create] Error', { error: getErrorMessage(error) });
    throw new ApiError(500, getErrorMessage(error, 'Failed to create overlay'));
  }
}

// ─── PUT — upsert (restore) ───────────────────────────────────────────────────

export async function handleUpsertFloorplanOverlay(
  request: NextRequest,
  ctx: AuthContext,
): Promise<NextResponse<ApiSuccessResponse<FloorplanOverlayUpsertResponse>>> {
  try {
    const parsed = safeParseBody(UpsertFloorplanOverlaySchema, await request.json());
    if (parsed.error) throw new ApiError(400, 'Validation failed');
    const body = parsed.data;

    validateRoleGeometryConsistency(body.role, body.geometry, body.linked);

    const docRef = overlayDocRef(body.overlayId);
    const snapshot = await docRef.get();
    let created: boolean;

    if (snapshot.exists) {
      const existing = snapshot.data() as Record<string, unknown> | undefined;
      ensureSameCompany(
        ctx,
        existing?.companyId as string | null | undefined,
        body.overlayId,
        '/api/floorplan-overlays (PUT upsert)',
      );
      created = false;
    } else {
      created = true;
    }

    const createdAt =
      body.createdAtMs !== undefined
        ? Timestamp.fromMillis(body.createdAtMs)
        : FieldValue.serverTimestamp();

    const doc: Record<string, unknown> = {
      id: body.overlayId,
      companyId: ctx.companyId,
      backgroundId: body.backgroundId,
      floorId: body.floorId,
      geometry: body.geometry,
      role: body.role,
      createdBy: body.createdBy ?? ctx.uid,
      createdAt,
      updatedAt: FieldValue.serverTimestamp(),
      restoredAt: FieldValue.serverTimestamp(),
      ...(body.linked !== undefined ? { linked: body.linked } : {}),
      ...(body.label !== undefined ? { label: body.label } : {}),
      ...(body.style !== undefined ? { style: body.style } : {}),
      ...(body.layer !== undefined ? { layer: body.layer } : {}),
    };

    await docRef.set(doc);

    await logAuditEvent(
      ctx,
      created ? 'data_created' : 'data_updated',
      body.overlayId,
      'api',
      {
        metadata: {
          path: '/api/floorplan-overlays (PUT upsert)',
          reason: created
            ? 'Overlay restored (new doc) via centralized SSoT pipeline'
            : 'Overlay restored (existing doc) via centralized SSoT pipeline',
        },
      },
    );

    return apiSuccess<FloorplanOverlayUpsertResponse>(
      { overlayId: body.overlayId, created },
      created ? 'Overlay restored (new)' : 'Overlay restored (updated)',
    );
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logger.error('[FloorplanOverlays/Upsert] Error', { error: getErrorMessage(error) });
    throw new ApiError(500, getErrorMessage(error, 'Failed to upsert overlay'));
  }
}

// ─── PATCH — update ───────────────────────────────────────────────────────────

export async function handleUpdateFloorplanOverlay(
  request: NextRequest,
  ctx: AuthContext,
): Promise<NextResponse<FloorplanOverlayUpdateResponse>> {
  try {
    const parsed = safeParseBody(UpdateFloorplanOverlaySchema, await request.json());
    if (parsed.error) throw new ApiError(400, 'Validation failed');
    const body = parsed.data;

    const docRef = overlayDocRef(body.overlayId);
    const snapshot = await docRef.get();
    if (!snapshot.exists) throw new ApiError(404, 'Overlay not found');

    const existing = snapshot.data() as Record<string, unknown>;
    ensureSameCompany(
      ctx,
      existing?.companyId as string | null | undefined,
      body.overlayId,
      '/api/floorplan-overlays (PATCH)',
    );

    // Resolve effective post-update role + geometry + linked for consistency check
    const effectiveRole = (body.role ?? (existing.role as OverlayRole)) as OverlayRole;
    const effectiveGeometry = (body.geometry ?? (existing.geometry as OverlayGeometry)) as OverlayGeometry;
    const effectiveLinked: OverlayLinked | undefined = (() => {
      if (body.linked === null) return undefined;
      if (body.linked !== undefined) return body.linked;
      return (existing.linked as OverlayLinked | undefined) ?? undefined;
    })();
    validateRoleGeometryConsistency(effectiveRole, effectiveGeometry, effectiveLinked);

    const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
    if (body.geometry !== undefined) updates.geometry = body.geometry;
    if (body.role !== undefined) updates.role = body.role;
    if (body.linked !== undefined) updates.linked = body.linked;
    if (body.label !== undefined) updates.label = body.label;
    if (body.style !== undefined) updates.style = body.style;
    if (body.layer !== undefined) updates.layer = body.layer;

    if (Object.keys(updates).length === 1) {
      throw new ApiError(400, 'No fields to update');
    }

    await docRef.update(updates);

    logger.info('[FloorplanOverlays/Update]', {
      overlayId: body.overlayId,
      fields: Object.keys(updates).filter((k) => k !== 'updatedAt'),
    });

    return NextResponse.json({
      success: true,
      overlayId: body.overlayId,
      message: `Overlay "${body.overlayId}" updated`,
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logger.error('[FloorplanOverlays/Update] Error', { error: getErrorMessage(error) });
    throw new ApiError(500, getErrorMessage(error, 'Failed to update overlay'));
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function handleDeleteFloorplanOverlay(
  request: NextRequest,
  ctx: AuthContext,
): Promise<NextResponse<FloorplanOverlayDeleteResponse>> {
  try {
    const { searchParams } = new URL(request.url);
    const overlayId = searchParams.get('overlayId');
    if (!overlayId) {
      return NextResponse.json(
        { success: false, error: 'overlayId query parameter is required' },
        { status: 400 },
      );
    }

    const docRef = overlayDocRef(overlayId);
    const snapshot = await docRef.get();
    if (!snapshot.exists) {
      return NextResponse.json(
        { success: false, error: 'Overlay not found' },
        { status: 404 },
      );
    }

    const existing = snapshot.data() as Record<string, unknown>;
    if (
      existing?.companyId &&
      existing.companyId !== ctx.companyId &&
      !isRoleBypass(ctx.globalRole)
    ) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    await docRef.delete();

    await logAuditEvent(ctx, 'data_deleted', overlayId, 'api', {
      metadata: {
        path: '/api/floorplan-overlays (DELETE)',
        reason: 'Overlay deleted via centralized SSoT pipeline',
      },
    });

    logger.info('[FloorplanOverlays/Delete]', { overlayId, userId: ctx.uid });

    return NextResponse.json({
      success: true,
      message: `Overlay "${overlayId}" deleted`,
    });
  } catch (error) {
    logger.error('[FloorplanOverlays/Delete] Error', { error: getErrorMessage(error) });
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete overlay',
        details: getErrorMessage(error),
      },
      { status: 500 },
    );
  }
}

// ─── GET — list ───────────────────────────────────────────────────────────────

export async function handleListFloorplanOverlays(
  request: NextRequest,
  ctx: AuthContext,
): Promise<NextResponse<FloorplanOverlaysListResponse>> {
  try {
    const { searchParams } = new URL(request.url);
    const floorId = searchParams.get('floorId');
    const backgroundId = searchParams.get('backgroundId');

    if (!floorId && !backgroundId) {
      return NextResponse.json(
        { success: false, error: 'floorId or backgroundId query parameter is required' },
        { status: 400 },
      );
    }

    const adminDb = getAdminFirestore();
    let query = adminDb
      .collection(COLLECTIONS.FLOORPLAN_OVERLAYS)
      .where('companyId', '==', ctx.companyId);

    if (floorId) query = query.where('floorId', '==', floorId);
    if (backgroundId) query = query.where('backgroundId', '==', backgroundId);

    const snapshot = await query.orderBy('createdAt', 'asc').get();

    const isSuperAdmin = isRoleBypass(ctx.globalRole);
    const overlays: FloorplanOverlayDocument[] = [];

    snapshot.docs.forEach((doc) => {
      const data = doc.data() as Record<string, unknown>;
      const docCompanyId = data.companyId as string | null | undefined;
      if (!isSuperAdmin && docCompanyId && docCompanyId !== ctx.companyId) return;
      overlays.push({ id: doc.id, ...data } as FloorplanOverlayDocument);
    });

    return NextResponse.json({
      success: true,
      overlays,
      stats: {
        totalOverlays: overlays.length,
        ...(floorId ? { floorId } : {}),
        ...(backgroundId ? { backgroundId } : {}),
      },
      message: `Found ${overlays.length} overlays`,
    });
  } catch (error) {
    logger.error('[FloorplanOverlays/List] Error', { error: getErrorMessage(error) });
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch overlays',
        details: getErrorMessage(error),
      },
      { status: 500 },
    );
  }
}
