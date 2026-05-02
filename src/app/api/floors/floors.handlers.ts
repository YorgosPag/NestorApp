import { NextRequest, NextResponse } from 'next/server';
import type { AuthContext } from '@/lib/auth';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { createModuleLogger } from '@/lib/telemetry';
import { executeDeletion } from '@/lib/firestore/deletion-guard';
import { createEntity } from '@/lib/firestore/entity-creation.service';
import { withVersionCheck, ConflictError } from '@/lib/firestore/version-check';
import { groupByKey } from '@/utils/collection-utils';
import { getErrorMessage } from '@/lib/error-utils';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { CreateFloorSchema, UpdateFloorSchema } from './floors.schemas';
import type {
  FloorCreateResponse,
  FloorDeleteResponse,
  FloorDocument,
  FloorsListResponse,
  FloorUpdateResponse,
} from './floors.types';
import { FLOORPLAN_PURPOSES } from '@/config/domain-constants';
import {
  buildFloorsQuery,
  resolveFloorsListParams,
  resolveTenantCompanyId,
  sortFloors,
} from './floors.shared';

const logger = createModuleLogger('FloorsRoute');

export async function handleListFloors(
  request: NextRequest,
  ctx: AuthContext
): Promise<NextResponse<FloorsListResponse>> {
  try {
    const params = resolveFloorsListParams(request.url);
    const tenantCompanyId = resolveTenantCompanyId(ctx, params.queryCompanyId);
    const isSuperAdmin = ctx.globalRole === 'super_admin';

    logger.info('[Floors/List] Fetching floors', {
      companyId: tenantCompanyId,
      userId: ctx.uid,
      buildingId: params.buildingId || 'all',
      projectId: params.projectId || 'all',
      isSuperAdmin,
    });

    const queryOrResponse = await buildFloorsQuery(ctx, params);
    if (queryOrResponse instanceof NextResponse) {
      return queryOrResponse;
    }

    const floorsSnapshot = await queryOrResponse.get();
    const rawFloors = sortFloors(
      floorsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as FloorDocument)),
      params
    );

    // Enrich each floor with hasFloorplan (batch query, ≤30 floors per Firestore 'in' limit)
    const db = getAdminFirestore();
    const floorIds = rawFloors.map((f) => f.id);
    const floorplanSet = new Set<string>();
    if (floorIds.length > 0) {
      const filesSnap = await db.collection(COLLECTIONS.FILES)
        .where(FIELDS.COMPANY_ID, '==', tenantCompanyId)
        .where(FIELDS.ENTITY_TYPE, '==', 'floor')
        .where('purpose', '==', FLOORPLAN_PURPOSES.FLOOR)
        .where(FIELDS.ENTITY_ID, 'in', floorIds.slice(0, 30))
        .select(FIELDS.ENTITY_ID)
        .get();
      filesSnap.docs.forEach((doc) => floorplanSet.add(doc.data()[FIELDS.ENTITY_ID] as string));
    }
    const floors = rawFloors.map((f) => ({ ...f, hasFloorplan: floorplanSet.has(f.id) }));

    logger.info('[Floors/List] Found floors', { count: floors.length, companyId: ctx.companyId });

    if (params.projectId) {
      const floorsByBuilding = groupByKey(floors, (floor: FloorDocument) => floor.buildingId);
      const buildingCount = Object.keys(floorsByBuilding).length;

      logger.info('[Floors/List] Complete', { floorCount: floors.length, buildingCount });

      return NextResponse.json({
        success: true,
        data: {
          floors,
          floorsByBuilding,
          stats: {
            totalFloors: floors.length,
            buildingsWithFloors: buildingCount,
            projectId: params.projectId,
          },
          message: `Found ${floors.length} floors in ${buildingCount} buildings`,
        },
      });
    }

    logger.info('[Floors/List] Complete', { floorCount: floors.length });
    return NextResponse.json({
      success: true,
      data: {
        floors,
        stats: {
          totalFloors: floors.length,
          buildingId: params.buildingId ?? undefined,
        },
        message: `Found ${floors.length} floors${params.buildingId ? ` for building ${params.buildingId}` : ''}`,
      },
    });
  } catch (error) {
    logger.error('[Floors/List] Error', {
      error: getErrorMessage(error),
      userId: ctx.uid,
      companyId: ctx.companyId,
    });

    return NextResponse.json({
      success: false,
      error: 'Failed to fetch floors',
      details: getErrorMessage(error),
    }, { status: 500 });
  }
}

export async function handleCreateFloor(
  request: NextRequest,
  ctx: AuthContext
): Promise<NextResponse<ApiSuccessResponse<FloorCreateResponse>>> {
  try {
    const parsed = safeParseBody(CreateFloorSchema, await request.json());
    if (parsed.error) {
      throw new ApiError(400, 'Validation failed');
    }
    const body = parsed.data;

    logger.info('[Floors/Create] Creating floor', { companyId: ctx.companyId, userId: ctx.uid });

    const entitySpecificFields: Record<string, unknown> = {
      number: body.number,
      name: body.name,
      buildingId: body.buildingId,
      buildingName: body.buildingName || '',
      units: body.units || 0,
      elevation: body.elevation ?? null,
      height: body.height ?? null,
    };
    if (body.projectId) entitySpecificFields.projectId = String(body.projectId);
    if (body.projectName) entitySpecificFields.projectName = body.projectName;

    const db = getAdminFirestore();
    const duplicateCheck = await db
      .collection(COLLECTIONS.FLOORS)
      .where(FIELDS.BUILDING_ID, '==', body.buildingId)
      .where('number', '==', body.number)
      .select()
      .limit(1)
      .get();

    if (!duplicateCheck.empty) {
      throw new ApiError(409, `Floor number ${body.number} already exists in building ${body.buildingId}`);
    }

    const result = await createEntity('floor', {
      auth: ctx,
      parentId: body.buildingId,
      entitySpecificFields,
      apiPath: '/api/floors (POST)',
      auditFieldResolvers: {
        buildingId: async (id) => {
          if (!id || typeof id !== 'string') return null;
          const snap = await db.collection(COLLECTIONS.BUILDINGS).doc(id).get();
          return snap.exists ? ((snap.data()?.name as string) ?? null) : null;
        },
        projectId: async (id) => {
          if (!id || typeof id !== 'string') return null;
          const snap = await db.collection(COLLECTIONS.PROJECTS).doc(id).get();
          return snap.exists ? ((snap.data()?.name as string) ?? null) : null;
        },
      },
    });

    return apiSuccess<FloorCreateResponse>(
      { floorId: result.id },
      `Floor "${body.name}" created successfully`
    );
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logger.error('[Floors/Create] Error', { error: getErrorMessage(error), userId: ctx.uid });
    throw new ApiError(500, getErrorMessage(error, 'Failed to create floor'));
  }
}

export async function handleUpdateFloor(
  request: NextRequest,
  ctx: AuthContext
): Promise<NextResponse<FloorUpdateResponse>> {
  try {
    const parsedFloor = safeParseBody(UpdateFloorSchema, await request.json());
    if (parsedFloor.error) {
      return parsedFloor.error as NextResponse<FloorUpdateResponse>;
    }
    const { _v: expectedVersion, ...body } = parsedFloor.data;

    const db = getAdminFirestore();
    const floorRef = db.collection(COLLECTIONS.FLOORS).doc(body.floorId);
    const floorDoc = await floorRef.get();

    if (!floorDoc.exists) {
      return NextResponse.json({ success: false, error: 'Floor not found' }, { status: 404 });
    }

    const floorData = floorDoc.data();
    if (floorData?.companyId !== ctx.companyId && ctx.globalRole !== 'super_admin') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.number !== undefined) updates.number = body.number;
    if (body.elevation !== undefined) updates.elevation = body.elevation ?? null;
    if (body.height !== undefined) updates.height = body.height ?? null;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
    }

    const versionResult = await withVersionCheck({
      db,
      collection: COLLECTIONS.FLOORS,
      docId: body.floorId,
      expectedVersion,
      updates,
      userId: ctx.uid,
    });
    logger.info('[Floors/Update] Floor updated', { floorId: body.floorId, _v: versionResult.newVersion });

    return NextResponse.json({
      success: true,
      message: `Floor "${body.floorId}" updated`,
      _v: versionResult.newVersion,
    });
  } catch (error) {
    if (error instanceof ConflictError) {
      return NextResponse.json(error.body, { status: error.statusCode });
    }
    logger.error('[Floors/Update] Error', { error: getErrorMessage(error, 'Unknown') });
    return NextResponse.json({
      success: false,
      error: 'Failed to update floor',
      details: getErrorMessage(error, 'Unknown'),
    }, { status: 500 });
  }
}

export async function handleDeleteFloor(
  request: NextRequest,
  ctx: AuthContext
): Promise<NextResponse<FloorDeleteResponse>> {
  try {
    const { searchParams } = new URL(request.url);
    const floorId = searchParams.get('floorId');

    if (!floorId) {
      return NextResponse.json({ success: false, error: 'Floor ID is required' }, { status: 400 });
    }

    const db = getAdminFirestore();
    const floorRef = db.collection(COLLECTIONS.FLOORS).doc(floorId);
    const floorDoc = await floorRef.get();

    if (!floorDoc.exists) {
      return NextResponse.json({ success: false, error: 'Floor not found' }, { status: 404 });
    }

    const floorData = floorDoc.data();
    if (floorData?.companyId !== ctx.companyId && ctx.globalRole !== 'super_admin') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const siblingsSnap = await db.collection(COLLECTIONS.FLOORS)
      .where(FIELDS.BUILDING_ID, '==', floorData?.buildingId)
      .get();
    const siblingNumbers = siblingsSnap.docs
      .filter((d) => d.id !== floorId)
      .map((d) => (d.data() as FloorDocument).number);
    const targetNumber = (floorData as FloorDocument).number;
    const isIntermediate = siblingNumbers.some((n) => n < targetNumber) && siblingNumbers.some((n) => n > targetNumber);
    if (isIntermediate) {
      return NextResponse.json({
        success: false,
        error: 'Cannot delete an intermediate floor. Delete the floors above it first.',
      }, { status: 422 });
    }

    await executeDeletion(db, 'floor', floorId, ctx.uid, ctx.companyId);
    logger.info('[Floors/Delete] Floor deleted', { floorId, userId: ctx.uid });

    return NextResponse.json({ success: true, message: `Floor "${floorId}" deleted` });
  } catch (error) {
    logger.error('[Floors/Delete] Error', { error: getErrorMessage(error, 'Unknown') });
    return NextResponse.json({
      success: false,
      error: 'Failed to delete floor',
      details: getErrorMessage(error, 'Unknown'),
    }, { status: 500 });
  }
}
