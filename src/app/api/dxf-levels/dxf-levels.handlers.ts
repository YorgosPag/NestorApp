/**
 * 📐 DXF LEVELS API — ENTERPRISE HANDLERS
 *
 * Centralizes DXF Viewer level creation through createEntity() (ADR-286).
 * Previously written directly via client-side setDoc — now routed through
 * the same SSOT pipeline as floors/units/parking/storage (ADR-238).
 *
 * @see ADR-286 — DXF Level Creation Centralization
 * @see ADR-237 — Polygon Overlay Bridge (original dxf-viewer-levels spec)
 * @see ADR-238 — Entity Creation Centralization
 */

import { NextRequest, NextResponse } from 'next/server';
import type { AuthContext } from '@/lib/auth';
import { COLLECTIONS } from '@/config/firestore-collections';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { createModuleLogger } from '@/lib/telemetry';
import { createEntity } from '@/lib/firestore/entity-creation.service';
import { withVersionCheck, ConflictError } from '@/lib/firestore/version-check';
import { getErrorMessage } from '@/lib/error-utils';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { CreateDxfLevelSchema, UpdateDxfLevelSchema } from './dxf-levels.schemas';
import type {
  DxfLevelCreateResponse,
  DxfLevelDeleteResponse,
  DxfLevelDocument,
  DxfLevelsListResponse,
  DxfLevelUpdateResponse,
} from './dxf-levels.types';

const logger = createModuleLogger('DxfLevelsRoute');

export async function handleListDxfLevels(
  request: NextRequest,
  ctx: AuthContext
): Promise<NextResponse<DxfLevelsListResponse>> {
  try {
    const { searchParams } = new URL(request.url);
    const floorId = searchParams.get('floorId');
    const isSuperAdmin = ctx.globalRole === 'super_admin';

    const db = getAdminFirestore();
    let query = db.collection(COLLECTIONS.DXF_VIEWER_LEVELS).orderBy('order', 'asc');

    if (!isSuperAdmin) {
      query = query.where('companyId', '==', ctx.companyId);
    }
    if (floorId) {
      query = query.where('floorId', '==', floorId);
    }

    const snapshot = await query.get();
    const levels = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as DxfLevelDocument));

    logger.info('[DxfLevels/List] Found levels', {
      count: levels.length,
      companyId: ctx.companyId,
      floorId: floorId ?? 'all',
    });

    return NextResponse.json({
      success: true,
      levels,
      stats: {
        totalLevels: levels.length,
        floorId: floorId ?? undefined,
      },
      message: `Found ${levels.length} DXF levels`,
    });
  } catch (error) {
    logger.error('[DxfLevels/List] Error', {
      error: getErrorMessage(error),
      userId: ctx.uid,
    });
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch DXF levels',
      details: getErrorMessage(error),
    }, { status: 500 });
  }
}

export async function handleCreateDxfLevel(
  request: NextRequest,
  ctx: AuthContext
): Promise<NextResponse<ApiSuccessResponse<DxfLevelCreateResponse>>> {
  try {
    const parsed = safeParseBody(CreateDxfLevelSchema, await request.json());
    if (parsed.error) {
      throw new ApiError(400, 'Validation failed');
    }
    const body = parsed.data;

    logger.info('[DxfLevels/Create] Creating level', {
      companyId: ctx.companyId,
      userId: ctx.uid,
      floorId: body.floorId ?? null,
    });

    // Duplicate name check (per tenant)
    const db = getAdminFirestore();
    const duplicateCheck = await db
      .collection(COLLECTIONS.DXF_VIEWER_LEVELS)
      .where('companyId', '==', ctx.companyId)
      .where('name', '==', body.name)
      .select()
      .limit(1)
      .get();

    if (!duplicateCheck.empty) {
      throw new ApiError(409, `DXF level "${body.name}" already exists for this tenant`);
    }

    const entitySpecificFields: Record<string, unknown> = {
      name: body.name,
      order: body.order,
      isDefault: body.isDefault ?? false,
      visible: body.visible ?? true,
      floorId: body.floorId ?? null,
      sceneFileId: body.sceneFileId ?? null,
      sceneFileName: body.sceneFileName ?? null,
    };

    const result = await createEntity('dxfLevel', {
      auth: ctx,
      parentId: body.floorId ?? null,
      entitySpecificFields,
      apiPath: '/api/dxf-levels (POST)',
    });

    return apiSuccess<DxfLevelCreateResponse>(
      { levelId: result.id },
      `DXF level "${body.name}" created successfully`
    );
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logger.error('[DxfLevels/Create] Error', { error: getErrorMessage(error), userId: ctx.uid });
    throw new ApiError(500, getErrorMessage(error, 'Failed to create DXF level'));
  }
}

export async function handleUpdateDxfLevel(
  request: NextRequest,
  ctx: AuthContext
): Promise<NextResponse<DxfLevelUpdateResponse>> {
  try {
    const parsed = safeParseBody(UpdateDxfLevelSchema, await request.json());
    if (parsed.error) {
      return parsed.error as NextResponse<DxfLevelUpdateResponse>;
    }
    const { _v: expectedVersion, levelId, ...body } = parsed.data;

    const db = getAdminFirestore();
    const levelRef = db.collection(COLLECTIONS.DXF_VIEWER_LEVELS).doc(levelId);
    const levelDoc = await levelRef.get();

    if (!levelDoc.exists) {
      return NextResponse.json({ success: false, error: 'DXF level not found' }, { status: 404 });
    }

    const levelData = levelDoc.data();
    if (levelData?.companyId !== ctx.companyId && ctx.globalRole !== 'super_admin') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.order !== undefined) updates.order = body.order;
    if (body.isDefault !== undefined) updates.isDefault = body.isDefault;
    if (body.visible !== undefined) updates.visible = body.visible;
    if (body.floorId !== undefined) updates.floorId = body.floorId ?? null;
    if (body.buildingId !== undefined) updates.buildingId = body.buildingId ?? null;
    if (body.sceneFileId !== undefined) updates.sceneFileId = body.sceneFileId ?? null;
    if (body.sceneFileName !== undefined) updates.sceneFileName = body.sceneFileName ?? null;
    // ADR-309 Phase 3: context-aware level fields
    if (body.floorplanType !== undefined) updates.floorplanType = body.floorplanType ?? null;
    if (body.entityLabel !== undefined) updates.entityLabel = body.entityLabel ?? null;
    if (body.projectId !== undefined) updates.projectId = body.projectId ?? null;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
    }

    const versionResult = await withVersionCheck({
      db,
      collection: COLLECTIONS.DXF_VIEWER_LEVELS,
      docId: levelId,
      expectedVersion,
      updates,
      userId: ctx.uid,
    });
    logger.info('[DxfLevels/Update] Level updated', { levelId, _v: versionResult.newVersion });

    return NextResponse.json({
      success: true,
      message: `DXF level "${levelId}" updated`,
      _v: versionResult.newVersion,
    });
  } catch (error) {
    if (error instanceof ConflictError) {
      return NextResponse.json(error.body, { status: error.statusCode });
    }
    logger.error('[DxfLevels/Update] Error', { error: getErrorMessage(error, 'Unknown') });
    return NextResponse.json({
      success: false,
      error: 'Failed to update DXF level',
      details: getErrorMessage(error, 'Unknown'),
    }, { status: 500 });
  }
}

export async function handleDeleteDxfLevel(
  request: NextRequest,
  ctx: AuthContext
): Promise<NextResponse<DxfLevelDeleteResponse>> {
  try {
    const { searchParams } = new URL(request.url);
    const levelId = searchParams.get('levelId');

    if (!levelId) {
      return NextResponse.json({ success: false, error: 'Level ID is required' }, { status: 400 });
    }

    const db = getAdminFirestore();
    const levelRef = db.collection(COLLECTIONS.DXF_VIEWER_LEVELS).doc(levelId);
    const levelDoc = await levelRef.get();

    if (!levelDoc.exists) {
      return NextResponse.json({ success: false, error: 'DXF level not found' }, { status: 404 });
    }

    const levelData = levelDoc.data();
    if (levelData?.companyId !== ctx.companyId && ctx.globalRole !== 'super_admin') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    await levelRef.delete();
    logger.info('[DxfLevels/Delete] Level deleted', { levelId, userId: ctx.uid });

    return NextResponse.json({ success: true, message: `DXF level "${levelId}" deleted` });
  } catch (error) {
    logger.error('[DxfLevels/Delete] Error', { error: getErrorMessage(error, 'Unknown') });
    return NextResponse.json({
      success: false,
      error: 'Failed to delete DXF level',
      details: getErrorMessage(error, 'Unknown'),
    }, { status: 500 });
  }
}
