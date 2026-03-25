/**
 * 🏢 FLOORS API - ENTERPRISE NORMALIZED COLLECTION
 *
 * Provides access to floors using foreign key relationships.
 *
 * @module api/floors
 * @version 2.0.0
 * @updated 2026-01-15 - AUTHZ PHASE 2: Added RBAC protection
 *
 * 🔒 SECURITY:
 * - Permission: floors:floors:view
 * - Admin SDK for secure server-side operations
 * - Tenant isolation: Query filtered by ctx.companyId
 */

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { isRoleBypass } from '@/lib/auth/roles';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { executeDeletion } from '@/lib/firestore/deletion-guard';
import { groupByKey } from '@/utils/collection-utils';
import { normalizeProjectIdForQuery } from '@/utils/firestore-helpers';
import { getErrorMessage } from '@/lib/error-utils';
import { createEntity } from '@/lib/firestore/entity-creation.service';
import { withVersionCheck, ConflictError } from '@/lib/firestore/version-check';
import type { ConflictResponseBody } from '@/types/versioning';
import { safeParseBody } from '@/lib/validation/shared-schemas';

const CreateFloorSchema = z.object({
  number: z.number().int(),
  name: z.string().min(1).max(200),
  buildingId: z.string().min(1).max(128),
  buildingName: z.string().max(200).optional(),
  projectId: z.string().max(128).optional(),
  projectName: z.string().max(200).optional(),
  units: z.number().int().min(0).max(9999).optional(),
  elevation: z.number().min(-999).max(9999).optional(),
});

const UpdateFloorSchema = z.object({
  floorId: z.string().min(1).max(128),
  number: z.number().int().optional(),
  name: z.string().max(200).optional(),
  elevation: z.number().min(-999).max(9999).optional(),
  _v: z.number().int().optional(),
}).passthrough();

const logger = createModuleLogger('FloorsRoute');

// 🏢 ENTERPRISE INTERFACES - Proper TypeScript typing
interface FloorDocument {
  id: string;
  number: number;
  name?: string;
  buildingId: string;
  projectId?: string;
  companyId?: string;
  [key: string]: unknown;
}

// Response types for type-safe withAuth
type FloorsListSuccess = {
  success: true;
  floors: FloorDocument[];
  floorsByBuilding?: Record<string, FloorDocument[]>;
  stats: {
    totalFloors: number;
    buildingId?: string;
    projectId?: string;
    buildingsWithFloors?: number;
  };
  message?: string;
};

type FloorsListError = {
  success: false;
  error: string;
  details?: string;
};

type FloorsListResponse = FloorsListSuccess | FloorsListError;

/**
 * @rateLimit STANDARD (60 req/min) - CRUD
 */
export const GET = withStandardRateLimit(
  async (request: NextRequest) => {
  const handler = withAuth<FloorsListResponse>(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse<FloorsListResponse>> => {
      try {
        const { searchParams } = new URL(request.url);
        const buildingId = searchParams.get('buildingId');
        const projectId = searchParams.get('projectId');
        const queryCompanyId = searchParams.get('companyId');

        // 🏢 ENTERPRISE: Super admin can access any company's floors
        const isSuperAdmin = isRoleBypass(ctx.globalRole);
        const tenantCompanyId = isSuperAdmin && queryCompanyId
          ? queryCompanyId
          : ctx.companyId;

        logger.info('[Floors/List] Fetching floors', { companyId: tenantCompanyId, userId: ctx.uid, buildingId: buildingId || 'all', projectId: projectId || 'all', isSuperAdmin });

        // ============================================================================
        // TENANT-SCOPED QUERY (Admin SDK + Tenant Isolation)
        // 🏢 ADR-232: Super admin bypasses companyId filter (entities may have null)
        // ============================================================================

        const baseCollection = getAdminFirestore().collection(COLLECTIONS.FLOORS);
        let floorsQuery: FirebaseFirestore.Query = isSuperAdmin
          ? baseCollection
          : baseCollection.where(FIELDS.COMPANY_ID, '==', tenantCompanyId);

        // Apply additional filters
        if (buildingId) {
          floorsQuery = floorsQuery.where(FIELDS.BUILDING_ID, '==', buildingId);
        } else if (projectId) {
          floorsQuery = floorsQuery.where(FIELDS.PROJECT_ID, '==', normalizeProjectIdForQuery(projectId));
        }

        // Execute query
        const floorsSnapshot = await floorsQuery.get();
        let floors: FloorDocument[] = floorsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as FloorDocument));

        logger.info('Found floors', { count: floors.length, companyId: ctx.companyId });

        // ============================================================================
        // ENTERPRISE SORTING - JavaScript-based sorting to avoid Firestore index requirements
        // ============================================================================

        if (buildingId) {
          // Sort floors by number for single building
          floors.sort((a: FloorDocument, b: FloorDocument) => {
            const numA = typeof a.number === 'number' ? a.number : parseInt(String(a.number)) || 0;
            const numB = typeof b.number === 'number' ? b.number : parseInt(String(b.number)) || 0;
            return numA - numB;
          });
        } else if (projectId) {
          // Sort by building first, then by floor number for project-level queries
          floors.sort((a: FloorDocument, b: FloorDocument) => {
            // First sort by building ID
            if (a.buildingId !== b.buildingId) {
              return a.buildingId.localeCompare(b.buildingId);
            }
            // Then by floor number
            const numA = typeof a.number === 'number' ? a.number : parseInt(String(a.number)) || 0;
            const numB = typeof b.number === 'number' ? b.number : parseInt(String(b.number)) || 0;
            return numA - numB;
          });
        }

        // ============================================================================
        // GROUP BY BUILDING (if querying by projectId)
        // ============================================================================

        if (projectId) {
          const floorsByBuilding = groupByKey(floors, (floor: FloorDocument) => floor.buildingId);

          logger.info('[Floors/List] Complete', { floorCount: floors.length, buildingCount: Object.keys(floorsByBuilding).length });

          return NextResponse.json({
            success: true,
            floors,
            floorsByBuilding,
            stats: {
              totalFloors: floors.length,
              buildingsWithFloors: Object.keys(floorsByBuilding).length,
              projectId
            },
            message: `Found ${floors.length} floors in ${Object.keys(floorsByBuilding).length} buildings`
          });
        } else {
          logger.info('[Floors/List] Complete', { floorCount: floors.length });

          return NextResponse.json({
            success: true as const,
            floors,
            stats: {
              totalFloors: floors.length,
              buildingId: buildingId ?? undefined  // 🏢 ENTERPRISE: Convert null to undefined
            },
            message: `Found ${floors.length} floors${buildingId ? ` for building ${buildingId}` : ''}`
          });
        }

      } catch (error) {
        logger.error('[Floors/List] Error', {
          error: getErrorMessage(error),
          userId: ctx.uid,
          companyId: ctx.companyId
        });

        return NextResponse.json({
          success: false,
          error: 'Failed to fetch floors',
          details: getErrorMessage(error)
        }, { status: 500 });
      }
    },
    { permissions: 'projects:floors:view' }
  );

  return handler(request);
  }
);

// =============================================================================
// 🏢 ENTERPRISE: POST - Create new floor with enterprise ID
// =============================================================================

interface CreateFloorRequest {
  number: number;
  name: string;
  buildingId: string;
  buildingName?: string;
  projectId?: string | number;
  projectName?: string;
  units?: number;
  elevation?: number;
}

interface FloorCreateResponse {
  floorId: string;
}

/**
 * 🏢 ADR-238: Create floor via centralized entity service
 *
 * BUG FIXES vs legacy code:
 * - createdAt: serverTimestamp() instead of toISOString() (consistency)
 * - companyId: inherited for ALL users, not just super_admin
 * - updatedAt + linkedCompanyId: now included (were missing)
 * - Audit logging: now included (was missing)
 *
 * @rateLimit STANDARD (60 req/min) - CRUD
 */
export const POST = withStandardRateLimit(
  withAuth<ApiSuccessResponse<FloorCreateResponse>>(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      try {
        const parsed = safeParseBody(CreateFloorSchema, await request.json());
        if (parsed.error) throw new ApiError(400, 'Validation failed');
        const body = parsed.data;

        logger.info('[Floors/Create] Creating floor', { companyId: ctx.companyId, userId: ctx.uid });

        // Entity-specific fields (common fields handled by createEntity)
        const entitySpecificFields: Record<string, unknown> = {
          number: body.number,
          name: body.name,
          buildingId: body.buildingId,
          buildingName: body.buildingName || '',
          units: body.units || 0,
          elevation: body.elevation ?? null,
        };
        if (body.projectId) entitySpecificFields.projectId = String(body.projectId);
        if (body.projectName) entitySpecificFields.projectName = body.projectName;

        // 🛡️ ADR-249 P0-3: Floor uniqueness guard — prevent duplicate floor numbers per building
        // Note: floors use hard delete (via deletion-guard), no isDeleted field needed
        const db = getAdminFirestore();
        const duplicateCheck = await db
          .collection(COLLECTIONS.FLOORS)
          .where(FIELDS.BUILDING_ID, '==', body.buildingId)
          .where('number', '==', body.number)
          .select()
          .limit(1)
          .get();

        if (!duplicateCheck.empty) {
          throw new ApiError(
            409,
            `Floor number ${body.number} already exists in building ${body.buildingId}`
          );
        }

        // 🏢 ADR-238: Centralized entity creation
        const result = await createEntity('floor', {
          auth: ctx,
          parentId: body.buildingId,
          entitySpecificFields,
          apiPath: '/api/floors (POST)',
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
    },
    { permissions: 'projects:floors:view' }
  )
);

// =============================================================================
// 🏢 ENTERPRISE: PATCH - Update floor (name, number, elevation)
// ADR-180: IFC-Compliant Floor Management
// =============================================================================

interface UpdateFloorRequest {
  floorId: string;
  number?: number;
  name?: string;
  elevation?: number | null;
}

type FloorUpdateResponse =
  | { success: true; message: string; _v?: number }
  | { success: false; error: string; details?: string }
  | ConflictResponseBody;

export const PATCH = withStandardRateLimit(
  async (request: NextRequest) => {
    const handler = withAuth<FloorUpdateResponse>(
      async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse<FloorUpdateResponse>> => {
        try {
          const parsedFloor = safeParseBody(UpdateFloorSchema, await req.json());
          if (parsedFloor.error) return parsedFloor.error as NextResponse<FloorUpdateResponse>;
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

          if (Object.keys(updates).length === 0) {
            return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
          }

          // SPEC-256A: Version-checked write
          const versionResult = await withVersionCheck({
            db,
            collection: COLLECTIONS.FLOORS,
            docId: body.floorId,
            expectedVersion,
            updates,
            userId: ctx.uid,
          });
          logger.info('[Floors/Update] Floor updated', { floorId: body.floorId, _v: versionResult.newVersion });

          return NextResponse.json({ success: true, message: `Floor "${body.floorId}" updated`, _v: versionResult.newVersion });
        } catch (error) {
          if (error instanceof ConflictError) {
            return NextResponse.json(error.body, { status: error.statusCode });
          }
          logger.error('[Floors/Update] Error', { error: getErrorMessage(error, 'Unknown') });
          return NextResponse.json({ success: false, error: 'Failed to update floor', details: getErrorMessage(error, 'Unknown') }, { status: 500 });
        }
      },
      { permissions: 'projects:floors:view' }
    );
    return handler(request);
  }
);

// =============================================================================
// 🏢 ENTERPRISE: DELETE - Remove floor
// ADR-180: IFC-Compliant Floor Management
// =============================================================================

type FloorDeleteResponse = { success: true; message: string } | { success: false; error: string; details?: string };

export const DELETE = withStandardRateLimit(
  async (request: NextRequest) => {
    const handler = withAuth<FloorDeleteResponse>(
      async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse<FloorDeleteResponse>> => {
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

          // 🛡️ ADR-226: Guarded deletion (checks dependencies → blocks or deletes + audit)
          await executeDeletion(db, 'floor', floorId, ctx.uid, ctx.companyId);
          logger.info('[Floors/Delete] Floor deleted', { floorId, userId: ctx.uid });

          return NextResponse.json({ success: true, message: `Floor "${floorId}" deleted` });
        } catch (error) {
          logger.error('[Floors/Delete] Error', { error: getErrorMessage(error, 'Unknown') });
          return NextResponse.json({ success: false, error: 'Failed to delete floor', details: getErrorMessage(error, 'Unknown') }, { status: 500 });
        }
      },
      { permissions: 'projects:floors:delete' }
    );
    return handler(request);
  }
);
