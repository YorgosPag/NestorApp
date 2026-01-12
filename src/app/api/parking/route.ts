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
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { CacheHelpers } from '@/lib/cache/enterprise-api-cache';

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
 * 🅿️ API Response interface
 */
interface ParkingAPIResponse {
  success: boolean;
  parkingSpots?: FirestoreParkingSpot[];
  count?: number;
  cached?: boolean;
  buildingId?: string;
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
 */
export async function GET(request: NextRequest): Promise<NextResponse<ParkingAPIResponse>> {
  try {
    // 🏗️ ENTERPRISE: Extract buildingId parameter for filtering
    const { searchParams } = new URL(request.url);
    const buildingId = searchParams.get('buildingId');

    if (buildingId) {
      console.log(`🅿️ API: Loading parking spots for building ${buildingId}...`);
    } else {
      console.log('🅿️ API: Loading all parking spots...');
    }

    // 🚀 ENTERPRISE CACHING: Check cache first
    if (buildingId) {
      const cachedParking = CacheHelpers.getCachedParkingByBuilding(buildingId);
      if (cachedParking) {
        console.log(`⚡ API: CACHE HIT - Returning ${cachedParking.length} cached parking spots for building ${buildingId}`);
        return NextResponse.json({
          success: true,
          parkingSpots: cachedParking as FirestoreParkingSpot[],
          count: cachedParking.length,
          cached: true,
          buildingId
        });
      }
    } else {
      const cachedAllParking = CacheHelpers.getCachedAllParking();
      if (cachedAllParking) {
        console.log(`⚡ API: CACHE HIT - Returning ${cachedAllParking.length} cached parking spots`);
        return NextResponse.json({
          success: true,
          parkingSpots: cachedAllParking as FirestoreParkingSpot[],
          count: cachedAllParking.length,
          cached: true
        });
      }
    }

    console.log('🔍 API: Cache miss - Fetching from Firestore with Admin SDK...');

    // =========================================================================
    // Query Firestore using Admin SDK
    // =========================================================================
    let snapshot;

    if (buildingId) {
      // Filter by buildingId
      snapshot = await adminDb
        .collection(COLLECTIONS.PARKING_SPACES)
        .where('buildingId', '==', buildingId)
        .get();
    } else {
      // Get all parking spots, ordered by createdAt
      snapshot = await adminDb
        .collection(COLLECTIONS.PARKING_SPACES)
        .orderBy('createdAt', 'desc')
        .get();
    }

    const parkingSpots: FirestoreParkingSpot[] = snapshot.docs.map(doc => {
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

    // 💾 ENTERPRISE CACHING: Store in cache for future requests
    if (buildingId) {
      CacheHelpers.cacheParkingByBuilding(buildingId, parkingSpots);
      console.log(`✅ API: Found ${parkingSpots.length} parking spots for building ${buildingId} (cached for 2 minutes)`);
    } else {
      CacheHelpers.cacheAllParking(parkingSpots);
      console.log(`✅ API: Found ${parkingSpots.length} parking spots (cached for 2 minutes)`);
    }

    return NextResponse.json({
      success: true,
      parkingSpots,
      count: parkingSpots.length,
      cached: false,
      buildingId: buildingId || undefined
    });

  } catch (error) {
    console.error('❌ Error fetching parking spots:', error);

    return NextResponse.json({
      success: false,
      error: 'Failed to fetch parking spots',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
