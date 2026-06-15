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
import { FLOORPLAN_PURPOSES, ENTITY_TYPES } from '@/config/domain-constants';
import { isBuildingStorey, type FloorKind } from '@/utils/floor-naming';
import { EntityAuditService } from '@/services/entity-audit.service';
import type { AuditFieldChange } from '@/types/audit-trail';
import {
  buildFloorsQuery,
  resolveFloorsListParams,
  resolveTenantCompanyId,
  sortFloors,
} from './floors.shared';
import { reconcileFloorStackAfterEdit, reconcileSpecialLevelPlacement } from './floor-stack-reconcile.service';

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
    // Filter out trashed/deleted files post-query to avoid requiring a new composite index.
    const db = getAdminFirestore();
    const floorIds = rawFloors.map((f) => f.id);
    const floorplanSet = new Set<string>();
    if (floorIds.length > 0) {
      const filesSnap = await db.collection(COLLECTIONS.FILES)
        .where(FIELDS.COMPANY_ID, '==', tenantCompanyId)
        .where(FIELDS.ENTITY_TYPE, '==', 'floor')
        .where('purpose', '==', FLOORPLAN_PURPOSES.FLOOR)
        .where(FIELDS.ENTITY_ID, 'in', floorIds.slice(0, 30))
        .select(FIELDS.ENTITY_ID, 'isDeleted')
        .get();
      filesSnap.docs.forEach((doc) => {
        const data = doc.data();
        if (data.isDeleted !== true) {
          floorplanSet.add(data[FIELDS.ENTITY_ID] as string);
        }
      });
    }
    const floors = rawFloors.map((f) => ({ ...f, hasFloorplan: floorplanSet.has(f.id) }));

    logger.info('[Floors/List] Found floors', { count: floors.length, companyId: ctx.companyId });

    if (params.projectId) {
      const floorsByBuilding = groupByKey(floors, (floor: FloorDocument) => floor.buildingId);
      const buildingCount = Object.keys(floorsByBuilding).length;

      logger.info('[Floors/List] Complete', { floorCount: floors.length, buildingCount });

      return NextResponse.json({
        success: true,
        floors,
        floorsByBuilding,
        stats: {
          totalFloors: floors.length,
          buildingsWithFloors: buildingCount,
          projectId: params.projectId,
        },
        message: `Found ${floors.length} floors in ${buildingCount} buildings`,
      });
    }

    logger.info('[Floors/List] Complete', { floorCount: floors.length });
    return NextResponse.json({
      success: true,
      floors,
      stats: {
        totalFloors: floors.length,
        buildingId: params.buildingId ?? undefined,
      },
      message: `Found ${floors.length} floors${params.buildingId ? ` for building ${params.buildingId}` : ''}`,
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

    const db = getAdminFirestore();
    const buildingDoc = await db.collection(COLLECTIONS.BUILDINGS).doc(body.buildingId).get();
    const buildingName = (buildingDoc.data()?.name as string) || body.buildingName || '';

    const entitySpecificFields: Record<string, unknown> = {
      number: body.number,
      name: body.name,
      buildingId: body.buildingId,
      buildingName,
      units: body.units || 0,
      elevation: body.elevation ?? null,
      height: body.height ?? null,
      // ADR-369/ADR-461 — Revit-style classification + auto-naming flags. Previously
      // dropped here even though CreateFloorSchema validates them (boy-scout, N.0.2):
      // without `kind` no floor ever persisted its classification, so special levels
      // (foundation / stair-penthouse) could not be told apart from counted storeys.
      kind: body.kind,
      longName: body.longName,
      nameAutoGenerated: body.nameAutoGenerated,
      longNameAutoGenerated: body.longNameAutoGenerated,
    };
    if (body.finishThickness !== undefined) entitySpecificFields.finishThickness = body.finishThickness;
    if (body.mezzanineParentNumber !== undefined) entitySpecificFields.mezzanineParentNumber = body.mezzanineParentNumber;
    if (body.projectId) entitySpecificFields.projectId = String(body.projectId);
    if (body.projectName) entitySpecificFields.projectName = body.projectName;

    // ADR-461 — kind-aware uniqueness (Revit «Building Story» OFF for special levels).
    // Counted storeys must keep UNIQUE numbers among themselves; a special level
    // (foundation/roof/stair-penthouse) may legitimately share a number with a
    // counted storey (e.g. a foundation auto-numbered −1 co-existing with a manual
    // basement −1). The only special-level constraint is at most ONE per kind.
    // Read the building's floors by a single-field query (no new composite index)
    // and decide in memory — buildings hold few floors.
    const siblingsSnap = await db
      .collection(COLLECTIONS.FLOORS)
      .where(FIELDS.BUILDING_ID, '==', body.buildingId)
      .select('number', 'kind')
      .get();
    const siblings = siblingsSnap.docs.map((d) => ({
      number: d.data().number as number,
      kind: d.data().kind as FloorKind | undefined,
    }));

    const newIsSpecial = body.kind !== undefined && !isBuildingStorey(body.kind);
    if (newIsSpecial) {
      if (siblings.some((s) => s.kind === body.kind)) {
        throw new ApiError(409, `A ${body.kind} special level already exists in building ${body.buildingId}`);
      }
    } else {
      const clashesCounted = siblings.some(
        (s) => s.number === body.number && (s.kind === undefined || isBuildingStorey(s.kind)),
      );
      if (clashesCounted) {
        throw new ApiError(409, `Floor number ${body.number} already exists in building ${body.buildingId}`);
      }
    }

    const result = await createEntity('floor', {
      auth: ctx,
      parentId: body.buildingId,
      entitySpecificFields,
      apiPath: '/api/floors (POST)',
      auditFieldResolvers: {
        buildingId: async (id) => {
          if (!id || typeof id !== 'string') return null;
          return buildingName || null;
        },
        projectId: async (id) => {
          if (!id || typeof id !== 'string') return null;
          const snap = await db.collection(COLLECTIONS.PROJECTS).doc(id).get();
          return snap.exists ? ((snap.data()?.name as string) ?? null) : null;
        },
      },
    });

    // ADR-461 — Revit-true satellite placement: keep foundation always at the
    // bottom & roof/stair-penthouse always at the top after this create. Adding a
    // basement pushes the foundation further down; adding a top floor pushes the
    // penthouse further up. Non-fatal — the floor is already created.
    if (ctx.companyId) {
      try {
        await reconcileSpecialLevelPlacement(db, body.buildingId, ctx.companyId, ctx.uid);
      } catch (placeErr) {
        logger.warn('[Floors/Create] Special-level placement reconcile failed (floor created)', {
          buildingId: body.buildingId, error: getErrorMessage(placeErr),
        });
      }
    }

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

    const trackedFields = ['name', 'number', 'elevation', 'height'] as const;
    const changes: AuditFieldChange[] = trackedFields
      .filter((field) => updates[field] !== undefined && updates[field] !== floorData?.[field])
      .map((field) => ({
        field,
        oldValue: (floorData?.[field] as AuditFieldChange['oldValue']) ?? null,
        newValue: updates[field] as AuditFieldChange['newValue'],
        label: field,
      }));
    if (changes.length > 0) {
      await EntityAuditService.recordChange({
        entityType: ENTITY_TYPES.FLOOR,
        entityId: body.floorId,
        entityName: (floorData?.name as string) ?? body.floorId,
        action: 'updated',
        changes,
        performedBy: ctx.uid,
        performedByName: null,
        companyId: ctx.companyId!,
      });
    }

    // ADR-451 — Unified server-authoritative floor-stack reconcile. `elevation` is
    // the SSoT (absolute Level truth), `height` its derived projection. Dispatch by
    // which field the user actually changed (elevation wins when both):
    //   - elevation edit → re-derive the two adjacent storey heights + re-stretch
    //     only those storeys' entities (Revit «move a Level» — nobody else moves).
    //   - height edit → ADR-450 §1 push: re-stretch this floor + shift upper FFLs.
    let cascadeWarning: string | undefined;
    const elevationChanged = changes.some((c) => c.field === 'elevation');
    const heightChanged = changes.some((c) => c.field === 'height');
    const buildingId = floorData?.buildingId as string | undefined;
    if ((elevationChanged || heightChanged) && ctx.companyId && buildingId) {
      try {
        await reconcileFloorStackAfterEdit(db, buildingId, body.floorId, ctx.companyId, ctx.uid, {
          elevationChanged,
          heightChanged,
          newHeightMetres: typeof updates.height === 'number' ? updates.height : null,
        });
      } catch (cascadeErr) {
        logger.error('[Floors/Update] Reconcile failed — floor updated, stack not reconciled', {
          floorId: body.floorId,
          error: getErrorMessage(cascadeErr),
        });
        cascadeWarning = 'Floor updated but vertical-stack reconcile failed. Retry or manually adjust elevations/heights.';
      }
    }

    return NextResponse.json({
      success: true,
      message: `Floor "${body.floorId}" updated`,
      _v: versionResult.newVersion,
      ...(cascadeWarning ? { cascadeWarning } : {}),
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
    // ADR-461 — only COUNTED storeys sandwich a floor. A special level (foundation
    // at −1, roof, stair-penthouse) never makes a counted storey "intermediate",
    // and a special level is itself always deletable (it is outside the stack).
    const targetFloor = floorData as FloorDocument;
    const targetIsSpecial = targetFloor.kind !== undefined && !isBuildingStorey(targetFloor.kind);
    const countedSiblingNumbers = siblingsSnap.docs
      .filter((d) => d.id !== floorId)
      .map((d) => d.data() as FloorDocument)
      .filter((f) => f.kind === undefined || isBuildingStorey(f.kind))
      .map((f) => f.number);
    const targetNumber = targetFloor.number;
    const isIntermediate =
      !targetIsSpecial &&
      countedSiblingNumbers.some((n) => n < targetNumber) &&
      countedSiblingNumbers.some((n) => n > targetNumber);
    if (isIntermediate) {
      return NextResponse.json({
        success: false,
        error: 'Cannot delete an intermediate floor. Delete the floors above it first.',
      }, { status: 422 });
    }

    await executeDeletion(db, 'floor', floorId, ctx.uid, ctx.companyId);
    logger.info('[Floors/Delete] Floor deleted', { floorId, userId: ctx.uid });

    // ADR-461 — re-place special levels after a counted storey is removed, so the
    // foundation rises back up under the new lowest counted storey (and the
    // penthouse drops onto the new top). Non-fatal — the floor is already deleted.
    const deletedBuildingId = floorData?.buildingId as string | undefined;
    if (ctx.companyId && deletedBuildingId) {
      try {
        await reconcileSpecialLevelPlacement(db, deletedBuildingId, ctx.companyId, ctx.uid);
      } catch (placeErr) {
        logger.warn('[Floors/Delete] Special-level placement reconcile failed (floor deleted)', {
          buildingId: deletedBuildingId, error: getErrorMessage(placeErr),
        });
      }
    }

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
