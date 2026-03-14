/**
 * 🅿️ ENTERPRISE PARKING API ENDPOINT
 *
 * Professional-grade API για θέσεις στάθμευσης
 * Ακολουθεί το exact pattern από /api/storages/route.ts
 *
 * ΑΡΧΙΤΕΚΤΟΝΙΚΗ (local_4.log):
 * - Parking είναι parallel category με Units/Storage μέσα στο Building context
 * - ΔΕΝ είναι children των Units
 * - Κάθε parking spot ανήκει σε Building (buildingId)
 *
 * @see local_4.log - Navigation architecture documentation
 * @see firestore-collections.ts - COLLECTIONS.PARKING_SPACES = 'parkingSpaces'
 * @rateLimit STANDARD (60 req/min) - Parking spots retrieval
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, logAuditEvent } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { requireBuildingInTenant, TenantIsolationError } from '@/lib/auth/tenant-isolation';
import { FieldValue } from 'firebase-admin/firestore';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('ParkingRoute');

// ============================================================================
// 🏢 ENTERPRISE: Admin SDK Parking Endpoint
// ============================================================================
//
// ARCHITECTURE DECISION:
// Χρησιμοποιεί Admin SDK (server-side) αντί για Client SDK
//
// ΑΙΤΙΟΛΟΓΗΣΗ:
// 1. Τα Firestore Security Rules απαιτούν authentication (request.auth != null)
// 2. Το Client SDK στον server ΔΕΝ έχει authentication context
// 3. Μόνο το Admin SDK μπορεί να παρακάμψει τα security rules
//
// ============================================================================

// ADR-191: Import canonical types — single source of truth
import type { ParkingSpot as CanonicalParkingSpot } from '@/types/parking';

/**
 * 🅿️ API Response interface - CANONICAL FORMAT
 * Required by enterprise-api-client for proper response handling
 */
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

/**
 * 🅿️ GET /api/parking
 *
 * Query parameters:
 * - buildingId: Filter parking spots by building (RECOMMENDED - follows local_4.log architecture)
 *
 * ENTERPRISE ARCHITECTURE (local_4.log):
 * Parking belongs to Building context, NOT to Units
 *
 * 🔒 SECURITY: Protected with RBAC (AUTHZ Phase 2)
 * - Permission: units:units:view
 * - Tenant Isolation: Filters by user's companyId through buildings
 */
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
  notes?: string;
}

interface ParkingCreateResponse {
  parkingSpotId: string;
}

export const POST = withStandardRateLimit(
  withAuth<ApiSuccessResponse<ParkingCreateResponse>>(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      const adminDb = getAdminFirestore();
      if (!adminDb) {
        throw new ApiError(503, 'Database unavailable');
      }

      try {
        const body: ParkingCreatePayload = await request.json();

        // Validation
        if (!body.number?.trim()) {
          throw new ApiError(400, 'Parking spot number is required');
        }

        // ADR-191: buildingId is optional (open space support)
        // If buildingId provided → tenant-verify it and resolve projectId from building
        // If no buildingId → projectId is required, verify project belongs to tenant
        let resolvedProjectId = body.projectId?.trim() || null;

        if (body.buildingId?.trim()) {
          // Tenant isolation — verify building belongs to user's company
          try {
            await requireBuildingInTenant({
              ctx,
              buildingId: body.buildingId,
              path: '/api/parking (POST)',
            });
          } catch (err) {
            if (err instanceof TenantIsolationError) {
              throw new ApiError(err.status, err.message);
            }
            throw err;
          }

          // Auto-resolve projectId from building if not explicitly provided
          if (!resolvedProjectId) {
            const buildingDoc = await adminDb.collection(COLLECTIONS.BUILDINGS).doc(body.buildingId).get();
            const buildingData = buildingDoc.data() as Record<string, unknown> | undefined;
            resolvedProjectId = (buildingData?.projectId as string) || null;
          }
        } else {
          // No building — projectId is mandatory for open space parking
          if (!resolvedProjectId) {
            throw new ApiError(400, 'projectId is required when no buildingId is provided');
          }
          // Verify project belongs to tenant company
          const projectDoc = await adminDb.collection(COLLECTIONS.PROJECTS).doc(resolvedProjectId).get();
          if (!projectDoc.exists) {
            throw new ApiError(404, 'Project not found');
          }
          const projectData = projectDoc.data() as Record<string, unknown>;
          if (projectData.companyId !== ctx.companyId) {
            throw new ApiError(403, 'Project does not belong to your company');
          }
        }

        // 🏢 ADR-232: Super admin entities get companyId: null
        const isSuperAdmin = ctx.globalRole === 'super_admin';

        // Sanitize data — force companyId from auth context
        const cleanData: Record<string, unknown> = {
          number: body.number.trim(),
          buildingId: body.buildingId?.trim() || null,
          type: body.type || 'standard',
          status: body.status || 'available',
          companyId: isSuperAdmin ? null : ctx.companyId,  // 🔒 ADR-232
          linkedCompanyId: null,                            // 🏢 ADR-232
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          createdBy: ctx.uid,
        };

        // projectId
        if (resolvedProjectId) cleanData.projectId = resolvedProjectId;

        // Optional fields — only include if provided (Firestore rejects undefined)
        if (body.locationZone) cleanData.locationZone = body.locationZone;
        if (body.floor?.trim()) cleanData.floor = body.floor.trim();
        if (body.location?.trim()) cleanData.location = body.location.trim();
        if (typeof body.area === 'number' && body.area > 0) cleanData.area = body.area;
        if (typeof body.price === 'number' && body.price >= 0) cleanData.price = body.price;
        if (body.notes?.trim()) cleanData.notes = body.notes.trim();

        logger.info('Creating parking spot', { number: body.number, buildingId: body.buildingId, companyId: ctx.companyId });

        // 🏗️ ADR-210: Enterprise ID for parking spots
        const { generateParkingId } = await import('@/services/enterprise-id.service');
        const parkingSpotId = generateParkingId();
        await adminDb.collection(COLLECTIONS.PARKING_SPACES).doc(parkingSpotId).set(cleanData);

        logger.info('Parking spot created', { parkingSpotId });

        await logAuditEvent(ctx, 'data_created', 'parking_spot', 'api', {
          newValue: {
            type: 'status',
            value: { parkingSpotId, number: body.number, buildingId: body.buildingId },
          },
          metadata: { reason: 'Parking spot created via API' },
        });

        return apiSuccess<ParkingCreateResponse>(
          { parkingSpotId },
          'Parking spot created successfully'
        );
      } catch (error) {
        if (error instanceof ApiError) throw error;
        logger.error('Error creating parking spot', { error: error instanceof Error ? error.message : String(error) });
        throw new ApiError(500, error instanceof Error ? error.message : 'Failed to create parking spot');
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
        .where('buildingId', '==', requestedBuildingId)
        .get();

      const parkingSpots = mapParkingDocs(snapshot.docs);
      logger.info('Found parking spots for building', { buildingId: requestedBuildingId, count: parkingSpots.length });

      return NextResponse.json({
        success: true,
        data: { parkingSpots, count: parkingSpots.length, cached: false, buildingId: requestedBuildingId }
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
        .where('projectId', '==', requestedProjectId)
        .get();

      const parkingSpots = mapParkingDocs(snapshot.docs);
      logger.info('Found parking spots for project', { projectId: requestedProjectId, count: parkingSpots.length });

      return NextResponse.json({
        success: true,
        data: { parkingSpots, count: parkingSpots.length, cached: false, projectId: requestedProjectId }
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
          .where('companyId', '==', ctx.companyId).get());

    const authorizedBuildingIds = new Set(buildingsSnapshot.docs.map(doc => doc.id));
    logger.info('Found authorized buildings', { buildingCount: authorizedBuildingIds.size, companyId: ctx.companyId });

    const snapshot = await (isSuperAdmin
      ? getAdminFirestore().collection(COLLECTIONS.PARKING_SPACES).get()
      : getAdminFirestore().collection(COLLECTIONS.PARKING_SPACES)
          .where('companyId', '==', ctx.companyId).get());

    const parkingSpots = mapParkingDocs(snapshot.docs);
    logger.info('Found parking spots for company', { count: parkingSpots.length });

    return NextResponse.json({
      success: true,
      data: { parkingSpots, count: parkingSpots.length, cached: false }
    });

  } catch (error) {
    logger.error('Error fetching parking spots', { error: error instanceof Error ? error.message : String(error) });

    return NextResponse.json({
      success: false,
      error: 'Failed to fetch parking spots',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// ============================================================================
// DATA MAPPER — Firestore docs to typed parking spots
// ============================================================================

function mapParkingDocs(docs: FirebaseFirestore.QueryDocumentSnapshot[]): CanonicalParkingSpot[] {
  return docs.map(doc => {
    const data = doc.data() as Record<string, unknown>;
    const spot: CanonicalParkingSpot = {
      id: doc.id,
      number: (data.number as string) || (data.code as string) || `P-${doc.id.slice(0, 4)}`,
      buildingId: (data.buildingId as string) || null,
      projectId: (data.projectId as string) || undefined,
      locationZone: (data.locationZone as CanonicalParkingSpot['locationZone']) || null,
      type: data.type as CanonicalParkingSpot['type'],
      status: data.status as CanonicalParkingSpot['status'],
      floor: data.floor as string | undefined,
      location: data.location as string | undefined,
      area: data.area as number | undefined,
      price: data.price as number | undefined,
      notes: data.notes as string | undefined,
      companyId: data.companyId as string | undefined,
      createdBy: data.createdBy as string | undefined,
      createdAt: (data.createdAt as { toDate?: () => Date })?.toDate?.() || data.createdAt as Date | undefined,
      updatedAt: (data.updatedAt as { toDate?: () => Date })?.toDate?.() || data.updatedAt as Date | undefined,
    };
    return spot;
  });
}
