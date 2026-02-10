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
    // 🏗️ ENTERPRISE: Extract buildingId parameter for filtering
    const { searchParams } = new URL(request.url);
    const requestedBuildingId = searchParams.get('buildingId');

    // =========================================================================
    // STEP 0: Get authorized buildings (TENANT ISOLATION)
    // =========================================================================
    logger.info('Getting authorized buildings for company');

    // Get all projects belonging to user's company
    const projectsSnapshot = await getAdminFirestore()
      .collection(COLLECTIONS.PROJECTS)
      .where('companyId', '==', ctx.companyId)
      .get();

    const projectIds = projectsSnapshot.docs.map(doc => doc.id);
    logger.info('Found projects for company', { projectCount: projectIds.length, companyId: ctx.companyId });

    if (projectIds.length === 0) {
      logger.info('No projects found for company - returning empty result');
      return NextResponse.json({
        success: true,
        data: {
          parkingSpots: [],
          count: 0,
          cached: false
        }
      });
    }

    // Get all buildings from these projects
    const buildingsSnapshot = await getAdminFirestore()
      .collection(COLLECTIONS.BUILDINGS)
      .where('projectId', 'in', projectIds.slice(0, 10)) // Firestore 'in' limit is 10
      .get();

    const authorizedBuildingIds = new Set(buildingsSnapshot.docs.map(doc => doc.id));
    logger.info('Found authorized buildings', { buildingCount: authorizedBuildingIds.size });

    // If buildingId parameter provided, verify it's authorized
    if (requestedBuildingId) {
      if (!authorizedBuildingIds.has(requestedBuildingId)) {
        logger.warn('TENANT ISOLATION: Unauthorized building access attempt', { userId: ctx.uid, buildingId: requestedBuildingId });
        return NextResponse.json({
          success: false,
          error: 'Building not found or access denied',
          details: 'The requested building does not belong to your organization'
        }, { status: 403 });
      }
      logger.info('Building authorized - proceeding with query', { buildingId: requestedBuildingId });
    }

    // =========================================================================
    // STEP 1: Check cache (skip for now - tenant-specific caching needed)
    // =========================================================================
    logger.info('Fetching from Firestore with Admin SDK (tenant-filtered)');

    // =========================================================================
    // STEP 2: Query Firestore using Admin SDK (TENANT FILTERED)
    // =========================================================================
    let snapshot;

    if (requestedBuildingId) {
      // Single building query (already validated as authorized)
      snapshot = await getAdminFirestore()
        .collection(COLLECTIONS.PARKING_SPACES)
        .where('buildingId', '==', requestedBuildingId)
        .get();
      logger.info('Querying parking spots for building', { buildingId: requestedBuildingId });
    } else {
      // Multiple buildings query - get all and filter in-memory
      // (Firestore 'in' operator limited to 10 items)
      snapshot = await getAdminFirestore()
        .collection(COLLECTIONS.PARKING_SPACES)
        .get();
      logger.info('Querying all parking spots', { authorizedBuildingCount: authorizedBuildingIds.size });
    }

    // =========================================================================
    // STEP 3: Map and filter parking spots (TENANT ISOLATION)
    // =========================================================================
    const allParkingSpots: FirestoreParkingSpot[] = snapshot.docs.map(doc => {
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
        // Convert Firestore timestamps to dates
        createdAt: (data.createdAt as { toDate?: () => Date })?.toDate?.() || data.createdAt as Date | undefined,
        updatedAt: (data.updatedAt as { toDate?: () => Date })?.toDate?.() || data.updatedAt as Date | undefined
      };
    });

    // Filter by authorized buildings (if not already filtered by single buildingId)
    const parkingSpots = requestedBuildingId
      ? allParkingSpots // Already filtered by Firestore query
      : allParkingSpots.filter(spot => authorizedBuildingIds.has(spot.buildingId));

    logger.info('Found parking spots for authorized buildings', { count: parkingSpots.length });
    if (!requestedBuildingId) {
      const filteredOut = allParkingSpots.length - parkingSpots.length;
      if (filteredOut > 0) {
        logger.info('TENANT ISOLATION: Filtered out parking spots from unauthorized buildings', { filteredOut });
      }
    }

    // =========================================================================
    // STEP 4: Return tenant-filtered results (CANONICAL FORMAT)
    // =========================================================================
    return NextResponse.json({
      success: true,
      data: {
        parkingSpots,
        count: parkingSpots.length,
        cached: false,
        buildingId: requestedBuildingId || undefined
      }
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
