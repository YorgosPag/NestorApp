/**
 * 🔷 DXF OVERLAY ITEMS API — ENTERPRISE HANDLERS (ADR-289)
 *
 * Centralizes writes to the `dxf_overlay_levels/{levelId}/items/{overlayId}`
 * subcollection. Replaces direct client-side setDoc/updateDoc/deleteDoc calls
 * in `overlay-store.tsx` with authenticated, audited, tenant-isolated endpoints.
 *
 * @see ADR-289 — DXF Overlay Item Centralization
 * @see ADR-237 — Polygon Overlay Bridge (original subcollection spec)
 * @see ADR-285 — DXF Tenant Scoping (companyId/createdBy requirement)
 * @see ADR-288 — CAD File Metadata Centralization (pattern reference)
 *
 * 🔒 SECURITY:
 * - Permission: dxf:layers:view (create/update/upsert/read) · dxf:layers:manage (delete)
 * - Admin SDK for server-side writes
 * - Tenant isolation enforced via companyId stamp on every write
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
  CreateDxfOverlayItemSchema,
  UpdateDxfOverlayItemSchema,
  UpsertDxfOverlayItemSchema,
} from './dxf-overlay-items.schemas';
import type {
  DxfOverlayItemCreateResponse,
  DxfOverlayItemDeleteResponse,
  DxfOverlayItemDocument,
  DxfOverlayItemUpdateResponse,
  DxfOverlayItemUpsertResponse,
  DxfOverlayItemsListResponse,
} from './dxf-overlay-items.types';

const logger = createModuleLogger('DxfOverlayItemsRoute');

/** Build Firestore subcollection path for a given level. */
function itemsSubcollectionPath(levelId: string): string {
  return `${COLLECTIONS.DXF_OVERLAY_LEVELS}/${levelId}/items`;
}

/**
 * POST /api/dxf-overlay-items — Create a brand new overlay item.
 * Server generates the overlayId via enterprise-id.service.generateOverlayId().
 */
export async function handleCreateDxfOverlayItem(
  request: NextRequest,
  ctx: AuthContext
): Promise<NextResponse<ApiSuccessResponse<DxfOverlayItemCreateResponse>>> {
  try {
    const parsed = safeParseBody(CreateDxfOverlayItemSchema, await request.json());
    if (parsed.error) {
      throw new ApiError(400, 'Validation failed');
    }
    const body = parsed.data;

    const adminDb = getAdminFirestore();
    const overlayId = generateOverlayId();
    const docRef = adminDb
      .collection(itemsSubcollectionPath(body.levelId))
      .doc(overlayId);

    const doc: Record<string, unknown> = {
      levelId: body.levelId,
      kind: body.kind,
      polygon: body.polygon,
      // 🔒 TENANT SCOPING (ADR-285)
      companyId: ctx.companyId,
      createdBy: ctx.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      // Optional fields — only set if provided
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.label !== undefined ? { label: body.label } : {}),
      ...(body.linked !== undefined ? { linked: body.linked } : {}),
      ...(body.style !== undefined ? { style: body.style } : {}),
    };

    await docRef.set(doc);

    await logAuditEvent(ctx, 'data_created', overlayId, 'api', {
      metadata: {
        path: '/api/dxf-overlay-items (POST)',
        reason: 'Overlay item created via centralized SSOT pipeline',
      },
    });

    logger.info('[DxfOverlayItems/Create] Overlay created', {
      overlayId,
      levelId: body.levelId,
      companyId: ctx.companyId,
    });

    return apiSuccess<DxfOverlayItemCreateResponse>(
      { overlayId, levelId: body.levelId },
      `Overlay "${overlayId}" created successfully`
    );
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logger.error('[DxfOverlayItems/Create] Error', {
      error: getErrorMessage(error),
      userId: ctx.uid,
    });
    throw new ApiError(500, getErrorMessage(error, 'Failed to create overlay item'));
  }
}

/**
 * PUT /api/dxf-overlay-items — Upsert (restore) an overlay with its original id.
 * Used by the undo/restore flow to recreate a deleted overlay with its prior
 * identity. Tenant isolation is enforced on existing docs.
 */
export async function handleUpsertDxfOverlayItem(
  request: NextRequest,
  ctx: AuthContext
): Promise<NextResponse<ApiSuccessResponse<DxfOverlayItemUpsertResponse>>> {
  try {
    const parsed = safeParseBody(UpsertDxfOverlayItemSchema, await request.json());
    if (parsed.error) {
      throw new ApiError(400, 'Validation failed');
    }
    const body = parsed.data;

    const adminDb = getAdminFirestore();
    const docRef = adminDb
      .collection(itemsSubcollectionPath(body.levelId))
      .doc(body.overlayId);

    const snapshot = await docRef.get();
    let created: boolean;

    if (snapshot.exists) {
      const existing = snapshot.data() as Record<string, unknown> | undefined;
      const existingCompanyId = existing?.companyId as string | null | undefined;

      if (
        existingCompanyId &&
        existingCompanyId !== ctx.companyId &&
        !isRoleBypass(ctx.globalRole)
      ) {
        await logAuditEvent(ctx, 'access_denied', body.overlayId, 'api', {
          metadata: {
            path: '/api/dxf-overlay-items (PUT upsert)',
            reason: 'Tenant isolation violation — overlay companyId mismatch',
          },
        });
        throw new ApiError(403, 'Access denied — tenant isolation violation');
      }
      created = false;
    } else {
      created = true;
    }

    const createdAt =
      body.createdAtMs !== undefined
        ? Timestamp.fromMillis(body.createdAtMs)
        : FieldValue.serverTimestamp();

    const doc: Record<string, unknown> = {
      levelId: body.levelId,
      kind: body.kind,
      polygon: body.polygon,
      companyId: ctx.companyId,
      createdBy: body.createdBy ?? ctx.uid,
      createdAt,
      updatedAt: FieldValue.serverTimestamp(),
      restoredAt: FieldValue.serverTimestamp(),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.label !== undefined ? { label: body.label } : {}),
      ...(body.linked !== undefined ? { linked: body.linked } : {}),
      ...(body.style !== undefined ? { style: body.style } : {}),
    };

    await docRef.set(doc);

    await logAuditEvent(ctx, created ? 'data_created' : 'data_updated', body.overlayId, 'api', {
      metadata: {
        path: '/api/dxf-overlay-items (PUT upsert)',
        reason: created
          ? 'Overlay restored (new doc) via centralized SSOT pipeline'
          : 'Overlay restored (existing doc) via centralized SSOT pipeline',
      },
    });

    logger.info('[DxfOverlayItems/Upsert] Overlay upserted', {
      overlayId: body.overlayId,
      levelId: body.levelId,
      created,
      companyId: ctx.companyId,
    });

    return apiSuccess<DxfOverlayItemUpsertResponse>(
      { overlayId: body.overlayId, levelId: body.levelId, created },
      created ? 'Overlay restored (new)' : 'Overlay restored (updated)'
    );
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logger.error('[DxfOverlayItems/Upsert] Error', {
      error: getErrorMessage(error),
      userId: ctx.uid,
    });
    throw new ApiError(500, getErrorMessage(error, 'Failed to upsert overlay item'));
  }
}

/**
 * PATCH /api/dxf-overlay-items — Update fields of an existing overlay.
 * Supports partial updates on polygon/kind/status/label/linked/style.
 * `linked: null` explicitly clears the link (Firestore stores null).
 */
export async function handleUpdateDxfOverlayItem(
  request: NextRequest,
  ctx: AuthContext
): Promise<NextResponse<DxfOverlayItemUpdateResponse>> {
  try {
    const parsed = safeParseBody(UpdateDxfOverlayItemSchema, await request.json());
    if (parsed.error) {
      throw new ApiError(400, 'Validation failed');
    }
    const body = parsed.data;

    const adminDb = getAdminFirestore();
    const docRef = adminDb
      .collection(itemsSubcollectionPath(body.levelId))
      .doc(body.overlayId);

    const snapshot = await docRef.get();
    if (!snapshot.exists) {
      throw new ApiError(404, 'Overlay item not found');
    }

    const existing = snapshot.data() as Record<string, unknown>;
    const existingCompanyId = existing?.companyId as string | null | undefined;

    if (
      existingCompanyId &&
      existingCompanyId !== ctx.companyId &&
      !isRoleBypass(ctx.globalRole)
    ) {
      await logAuditEvent(ctx, 'access_denied', body.overlayId, 'api', {
        metadata: {
          path: '/api/dxf-overlay-items (PATCH)',
          reason: 'Tenant isolation violation — overlay companyId mismatch',
        },
      });
      throw new ApiError(403, 'Access denied — tenant isolation violation');
    }

    const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
    if (body.polygon !== undefined) updates.polygon = body.polygon;
    if (body.kind !== undefined) updates.kind = body.kind;
    if (body.status !== undefined) updates.status = body.status;
    if (body.label !== undefined) updates.label = body.label;
    if (body.linked !== undefined) updates.linked = body.linked; // includes explicit null
    if (body.style !== undefined) updates.style = body.style;

    // If only updatedAt was added, treat as no-op (prevent accidental writes).
    if (Object.keys(updates).length === 1) {
      throw new ApiError(400, 'No fields to update');
    }

    await docRef.update(updates);

    logger.info('[DxfOverlayItems/Update] Overlay updated', {
      overlayId: body.overlayId,
      levelId: body.levelId,
      fields: Object.keys(updates).filter((k) => k !== 'updatedAt'),
    });

    return NextResponse.json({
      success: true,
      overlayId: body.overlayId,
      levelId: body.levelId,
      message: `Overlay "${body.overlayId}" updated`,
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logger.error('[DxfOverlayItems/Update] Error', {
      error: getErrorMessage(error),
      userId: ctx.uid,
    });
    throw new ApiError(500, getErrorMessage(error, 'Failed to update overlay item'));
  }
}

/**
 * DELETE /api/dxf-overlay-items?levelId=...&overlayId=... — Remove an overlay.
 */
export async function handleDeleteDxfOverlayItem(
  request: NextRequest,
  ctx: AuthContext
): Promise<NextResponse<DxfOverlayItemDeleteResponse>> {
  try {
    const { searchParams } = new URL(request.url);
    const levelId = searchParams.get('levelId');
    const overlayId = searchParams.get('overlayId');

    if (!levelId || !overlayId) {
      return NextResponse.json(
        { success: false, error: 'levelId and overlayId query parameters are required' },
        { status: 400 }
      );
    }

    const adminDb = getAdminFirestore();
    const docRef = adminDb.collection(itemsSubcollectionPath(levelId)).doc(overlayId);
    const snapshot = await docRef.get();

    if (!snapshot.exists) {
      return NextResponse.json(
        { success: false, error: 'Overlay item not found' },
        { status: 404 }
      );
    }

    const existing = snapshot.data() as Record<string, unknown>;
    const existingCompanyId = existing?.companyId as string | null | undefined;

    if (
      existingCompanyId &&
      existingCompanyId !== ctx.companyId &&
      !isRoleBypass(ctx.globalRole)
    ) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    await docRef.delete();

    await logAuditEvent(ctx, 'data_deleted', overlayId, 'api', {
      metadata: {
        path: '/api/dxf-overlay-items (DELETE)',
        reason: 'Overlay deleted via centralized SSOT pipeline',
      },
    });

    logger.info('[DxfOverlayItems/Delete] Overlay deleted', {
      overlayId,
      levelId,
      userId: ctx.uid,
    });

    return NextResponse.json({
      success: true,
      message: `Overlay "${overlayId}" deleted`,
    });
  } catch (error) {
    logger.error('[DxfOverlayItems/Delete] Error', { error: getErrorMessage(error) });
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete overlay item',
        details: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/dxf-overlay-items?levelId=... — List overlays for a level.
 * Primary clients use onSnapshot subscriptions; this endpoint exists for
 * admin/debug introspection and server-side consumers.
 */
export async function handleListDxfOverlayItems(
  request: NextRequest,
  ctx: AuthContext
): Promise<NextResponse<DxfOverlayItemsListResponse>> {
  try {
    const { searchParams } = new URL(request.url);
    const levelId = searchParams.get('levelId');

    if (!levelId) {
      return NextResponse.json(
        { success: false, error: 'levelId query parameter is required' },
        { status: 400 }
      );
    }

    const adminDb = getAdminFirestore();
    const snapshot = await adminDb
      .collection(itemsSubcollectionPath(levelId))
      .orderBy('createdAt', 'asc')
      .get();

    const isSuperAdmin = isRoleBypass(ctx.globalRole);
    const overlays: DxfOverlayItemDocument[] = [];

    snapshot.docs.forEach((doc) => {
      const data = doc.data() as Record<string, unknown>;
      const docCompanyId = data.companyId as string | null | undefined;
      if (!isSuperAdmin && docCompanyId && docCompanyId !== ctx.companyId) {
        return;
      }
      overlays.push({ id: doc.id, ...data } as DxfOverlayItemDocument);
    });

    return NextResponse.json({
      success: true,
      overlays,
      stats: { totalOverlays: overlays.length, levelId },
      message: `Found ${overlays.length} overlays`,
    });
  } catch (error) {
    logger.error('[DxfOverlayItems/List] Error', {
      error: getErrorMessage(error),
      userId: ctx.uid,
    });
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch overlay items',
        details: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}
