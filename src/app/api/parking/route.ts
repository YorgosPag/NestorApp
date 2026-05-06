/** 🅿️ Parking API — GET list, POST create. Admin SDK, standard rate limit. */
import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { requireBuildingInTenant, TenantIsolationError } from '@/lib/auth/tenant-isolation';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { createModuleLogger } from '@/lib/telemetry';
import { createEntity } from '@/lib/firestore/entity-creation.service';
import { mapParkingDoc } from '@/lib/firestore-mappers';
import type { ParkingSpot as CanonicalParkingSpot } from '@/types/parking';
import { getErrorMessage } from '@/lib/error-utils';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import type { ParkingApiData } from '@/types/api/building-spaces.api.types';

const logger = createModuleLogger('ParkingRoute');

const CreateParkingSchema = z.object({
  number: z.string().min(1).max(50),
  /** ADR-233: Entity coding system identifier */
  code: z.string().max(50).optional(),
  buildingId: z.string().max(128).optional(),
  projectId: z.string().max(128).optional(),
  type: z.string().max(50).optional(),
  status: z.string().max(50).optional(),
  locationZone: z.enum(['pilotis', 'underground', 'open_space', 'rooftop', 'covered_outdoor']).optional(),
  floor: z.string().max(50).optional(),
  location: z.string().max(200).optional(),
  area: z.number().min(0).max(999_999).optional(),
  price: z.number().min(0).max(999_999_999).optional(),
  description: z.string().max(2000).optional(),
  notes: z.string().max(5000).optional(),
});

interface ParkingData {
  parkingSpots: CanonicalParkingSpot[];
  count: number;
  cached: boolean;
  buildingId?: string;
  projectId?: string;
}

interface ParkingAPIResponse {
  success: boolean;
  data?: ParkingData;
  error?: string;
  details?: string;
}

const getHandler = async (request: NextRequest) => {
  const handler = withAuth<ParkingAPIResponse>(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse<ParkingAPIResponse>> => {
      return handleGetParking(req, ctx);
    },
    { permissions: 'units:units:view' }
  );

  return handler(request);
};
export const GET = withStandardRateLimit(getHandler);
// ============================================================================
// POST — Create Parking Spot via Admin SDK
// ============================================================================

interface ParkingCreatePayload {
  number: string;
  /** Optional — null means open space / unlinked */
  buildingId?: string;
  /** Required when buildingId is absent; auto-resolved from building otherwise */
  projectId?: string;
  type?: CanonicalParkingSpot['type'];
  status?: CanonicalParkingSpot['status'];
  locationZone?: CanonicalParkingSpot['locationZone'];
  floor?: string;
  location?: string;
  area?: number;
  price?: number;
  description?: string;
  notes?: string;
}

interface ParkingCreateResponse {
  parkingSpotId: string;
}

export const POST = withStandardRateLimit(
  withAuth<ApiSuccessResponse<ParkingCreateResponse>>(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      try {
        const parsed = safeParseBody(CreateParkingSchema, await request.json());
        if (parsed.error) throw new ApiError(400, 'Validation failed');
        const body = parsed.data;
        const buildingId = body.buildingId?.trim() || null;
        const resolvedProjectId = body.projectId?.trim() || null;
        // ADR-191: Open space parking (no buildingId) — verify project belongs to tenant
        if (!buildingId && resolvedProjectId) {
          const adminDb = getAdminFirestore();
          if (!adminDb) throw new ApiError(503, 'Database unavailable');
          const projectDoc = await adminDb.collection(COLLECTIONS.PROJECTS).doc(resolvedProjectId).get();
          if (!projectDoc.exists) {
            throw new ApiError(404, 'Project not found');
          }
          const projectData = projectDoc.data() as Record<string, unknown>;
          if (ctx.globalRole !== 'super_admin' && projectData.companyId !== ctx.companyId) {
            throw new ApiError(403, 'Project does not belong to your company');
          }
        }

        // Entity-specific fields (everything NOT handled by centralized service)
        const entitySpecificFields: Record<string, unknown> = {
          number: body.number.trim(),
          buildingId: buildingId,
          type: body.type || 'standard',
          status: body.status || 'available',
        };

        // projectId — auto-resolved from building by service, but may come from body
        if (resolvedProjectId) entitySpecificFields.projectId = resolvedProjectId;

        // Optional fields — only include if provided
        if (body.locationZone) entitySpecificFields.locationZone = body.locationZone;
        if (body.floor?.trim()) entitySpecificFields.floor = body.floor.trim();
        if (body.location?.trim()) entitySpecificFields.location = body.location.trim();
        if (typeof body.area === 'number' && body.area > 0) entitySpecificFields.area = body.area;
        if (typeof body.price === 'number' && body.price >= 0) entitySpecificFields.price = body.price;
        if (body.description?.trim()) entitySpecificFields.description = body.description.trim();
        if (body.notes?.trim()) entitySpecificFields.notes = body.notes.trim();
        if (body.code?.trim()) entitySpecificFields.code = body.code.trim();

        logger.info('Creating parking spot', { number: body.number, buildingId, companyId: ctx.companyId });

        // 🏢 ADR-238: Centralized entity creation
        // projectId auto-resolved from building by service (building-child propagation)
        const result = await createEntity('parking', {
          auth: ctx,
          parentId: buildingId,
          entitySpecificFields,
          codeOptions: {
            currentValue: body.code?.trim() || body.number.trim(),
            floorLevel: body.floor ? parseInt(body.floor, 10) || 0 : 0,
            locationZone: body.locationZone ?? undefined,
          },
          apiPath: '/api/parking (POST)',
        });

        // ADR-029 Phase D: search_documents written by Cloud Function onParkingWrite.
        return apiSuccess<ParkingCreateResponse>(
          { parkingSpotId: result.id },
          'Parking spot created successfully'
        );
      } catch (error) {
        if (error instanceof ApiError) throw error;
        logger.error('Error creating parking spot', { error: getErrorMessage(error) });
        throw new ApiError(500, getErrorMessage(error, 'Failed to create parking spot'));
      }
    },
    { permissions: 'units:units:create' }
  )
);

async function handleGetParking(request: NextRequest, ctx: AuthContext): Promise<NextResponse<ParkingAPIResponse>> {
  logger.info('Loading parking spots', { email: ctx.email, companyId: ctx.companyId });

  try {
    const { searchParams } = new URL(request.url);
    const requestedBuildingId = searchParams.get('buildingId');
    const requestedProjectId = searchParams.get('projectId');

    // =========================================================================
    // TENANT ISOLATION — Enterprise Pattern (O(1) direct verification)
    // =========================================================================
    // Uses requireBuildingInTenant() — single Firestore read + companyId check
    // Replaces fragile 3-hop chain (projects→buildings→check) that:
    //   - Failed when buildings had no projectId
    //   - Silently dropped buildings when >10 projects (Firestore 'in' limit)
    // =========================================================================

    if (requestedBuildingId) {
      // Direct building verification — O(1), no project chain needed
      try {
        await requireBuildingInTenant({
          ctx,
          buildingId: requestedBuildingId,
          path: '/api/parking',
        });
      } catch (err) {
        if (err instanceof TenantIsolationError) {
          return NextResponse.json({
            success: false,
            error: err.code === 'NOT_FOUND' ? 'Building not found' : 'Access denied',
            details: err.message,
          }, { status: err.status });
        }
        throw err;
      }

      logger.info('Building authorized via direct verification', { buildingId: requestedBuildingId });

      // Query parking spots for this building
      const snapshot = await getAdminFirestore()
        .collection(COLLECTIONS.PARKING_SPACES)
        .where(FIELDS.BUILDING_ID, '==', requestedBuildingId)
        .get();

      // ADR-281: Exclude soft-deleted records from normal list
      const parkingSpots = snapshot.docs
        .map(doc => mapParkingDoc(doc.id, doc.data() as Record<string, unknown>))
        .filter(spot => spot.status !== 'deleted');
      logger.info('Found parking spots for building', { buildingId: requestedBuildingId, count: parkingSpots.length });

      return NextResponse.json({
        success: true,
        data: { parkingSpots, count: parkingSpots.length, cached: false, buildingId: requestedBuildingId ?? undefined } satisfies ParkingApiData,
      });
    }

    // =========================================================================
    // ADR-191: projectId filter — return all parking for a specific project
    // =========================================================================

    if (requestedProjectId) {
      // Verify project belongs to tenant
      const projectDoc = await getAdminFirestore().collection(COLLECTIONS.PROJECTS).doc(requestedProjectId).get();
      if (!projectDoc.exists) {
        return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
      }
      const projectData = projectDoc.data() as Record<string, unknown>;
      if (projectData.companyId !== ctx.companyId) {
        return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
      }

      // Get all parking with this projectId
      const snapshot = await getAdminFirestore()
        .collection(COLLECTIONS.PARKING_SPACES)
        .where(FIELDS.PROJECT_ID, '==', requestedProjectId)
        .get();

      // ADR-281: Exclude soft-deleted records from normal list
      const parkingSpots = snapshot.docs
        .map(doc => mapParkingDoc(doc.id, doc.data() as Record<string, unknown>))
        .filter(spot => spot.status !== 'deleted');
      logger.info('Found parking spots for project', { projectId: requestedProjectId, count: parkingSpots.length });

      return NextResponse.json({
        success: true,
        data: { parkingSpots, count: parkingSpots.length, cached: false, projectId: requestedProjectId ?? undefined } satisfies ParkingApiData,
      });
    }

    // =========================================================================
    // NO filters — Return all parking for company (buildings + open space)
    // =========================================================================

    // 🏢 ADR-232: Super admin sees all, regular users filtered by companyId
    const isSuperAdmin = ctx.globalRole === 'super_admin';

    const buildingsSnapshot = await (isSuperAdmin
      ? getAdminFirestore().collection(COLLECTIONS.BUILDINGS).get()
      : getAdminFirestore().collection(COLLECTIONS.BUILDINGS)
          .where(FIELDS.COMPANY_ID, '==', ctx.companyId).get());

    const authorizedBuildingIds = new Set(buildingsSnapshot.docs.map(doc => doc.id));
    logger.info('Found authorized buildings', { buildingCount: authorizedBuildingIds.size, companyId: ctx.companyId });

    const snapshot = await (isSuperAdmin
      ? getAdminFirestore().collection(COLLECTIONS.PARKING_SPACES).get()
      : getAdminFirestore().collection(COLLECTIONS.PARKING_SPACES)
          .where(FIELDS.COMPANY_ID, '==', ctx.companyId).get());

    // ADR-281: Exclude soft-deleted records from normal list
    const parkingSpots = snapshot.docs
      .map(doc => mapParkingDoc(doc.id, doc.data() as Record<string, unknown>))
      .filter(spot => spot.status !== 'deleted');
    logger.info('Found parking spots for company', { count: parkingSpots.length });

    return NextResponse.json({
      success: true,
      data: { parkingSpots, count: parkingSpots.length, cached: false } satisfies ParkingApiData,
    });

  } catch (error) {
    logger.error('Error fetching parking spots', { error: getErrorMessage(error) });

    return NextResponse.json({
      success: false,
      error: 'Failed to fetch parking spots',
      details: getErrorMessage(error)
    }, { status: 500 });
  }
}

// ============================================================================
// DATA MAPPER — Centralized in @/lib/firestore-mappers (SSoT)
// ============================================================================
