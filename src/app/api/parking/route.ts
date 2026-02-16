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
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { requireBuildingInTenant, TenantIsolationError } from '@/lib/auth/tenant-isolation';
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

/**
 * 🅿️ Enterprise Parking Spot interface
 * Type-safe interface για Firestore documents
 */
interface FirestoreParkingSpot {
  id: string;
  number: string;
  buildingId: string;
  type?: 'standard' | 'handicapped' | 'motorcycle' | 'electric' | 'visitor';
  status?: 'available' | 'occupied' | 'reserved' | 'sold' | 'maintenance';
  floor?: string;
  location?: string;
  area?: number;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * 🅿️ API Response interface - CANONICAL FORMAT
 * Required by enterprise-api-client for proper response handling
 */
interface ParkingData {
  parkingSpots: FirestoreParkingSpot[];
  count: number;
  cached: boolean;
  buildingId?: string;
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

async function handleGetParking(request: NextRequest, ctx: AuthContext): Promise<NextResponse<ParkingAPIResponse>> {
  logger.info('Loading parking spots', { email: ctx.email, companyId: ctx.companyId });

  try {
    const { searchParams } = new URL(request.url);
    const requestedBuildingId = searchParams.get('buildingId');

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
    // NO buildingId — Return all parking for company's buildings
    // =========================================================================

    // Get all buildings belonging to this company
    const buildingsSnapshot = await getAdminFirestore()
      .collection(COLLECTIONS.BUILDINGS)
      .where('companyId', '==', ctx.companyId)
      .get();

    const authorizedBuildingIds = new Set(buildingsSnapshot.docs.map(doc => doc.id));
    logger.info('Found authorized buildings', { buildingCount: authorizedBuildingIds.size, companyId: ctx.companyId });

    if (authorizedBuildingIds.size === 0) {
      return NextResponse.json({
        success: true,
        data: { parkingSpots: [], count: 0, cached: false }
      });
    }

    // Fetch all parking spots and filter by authorized buildings
    const snapshot = await getAdminFirestore()
      .collection(COLLECTIONS.PARKING_SPACES)
      .get();

    const allSpots = mapParkingDocs(snapshot.docs);
    const parkingSpots = allSpots.filter(spot => authorizedBuildingIds.has(spot.buildingId));

    logger.info('Found parking spots for company', { total: allSpots.length, authorized: parkingSpots.length });

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

function mapParkingDocs(docs: FirebaseFirestore.QueryDocumentSnapshot[]): FirestoreParkingSpot[] {
  return docs.map(doc => {
    const data = doc.data() as Record<string, unknown>;
    return {
      id: doc.id,
      number: (data.number as string) || (data.code as string) || `P-${doc.id.slice(0, 4)}`,
      buildingId: (data.buildingId as string) || '',
      type: data.type as FirestoreParkingSpot['type'],
      status: data.status as FirestoreParkingSpot['status'],
      floor: data.floor as string | undefined,
      location: data.location as string | undefined,
      area: data.area as number | undefined,
      notes: data.notes as string | undefined,
      createdAt: (data.createdAt as { toDate?: () => Date })?.toDate?.() || data.createdAt as Date | undefined,
      updatedAt: (data.updatedAt as { toDate?: () => Date })?.toDate?.() || data.updatedAt as Date | undefined
    };
  });
}
