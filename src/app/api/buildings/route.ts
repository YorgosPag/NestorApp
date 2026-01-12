import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { CacheHelpers } from '@/lib/cache/enterprise-api-cache';

/** Building document with optional createdAt for sorting */
interface BuildingDocument {
  id: string;
  createdAt?: string | Date | { toDate: () => Date };
  [key: string]: unknown;
}

export async function GET(request: NextRequest) {
  try {
    // 🏗️ ENTERPRISE: Extract projectId parameter for filtering
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (projectId) {
      console.log(`🏗️ API: Loading buildings for project ${projectId}...`);
    } else {
      console.log('🏗️ API: Loading all buildings...');
    }

    // 🚀 ENTERPRISE CACHING: Check cache first (only for all buildings)
    if (!projectId) {
      const cachedBuildings = CacheHelpers.getCachedAllBuildings();
      if (cachedBuildings) {
        console.log(`⚡ API: CACHE HIT - Returning ${cachedBuildings.length} cached buildings`);
        return NextResponse.json({
          success: true,
          buildings: cachedBuildings,
          count: cachedBuildings.length,
          cached: true
        });
      }
    }

    console.log('🔍 API: Cache miss - Fetching from Firestore...');

    // 🎯 ENTERPRISE: Build query with optional projectId filter
    let buildingsQuery;

    if (projectId) {
      // 🎯 ENTERPRISE: Filter buildings by projectId relationship
      // Note: Removed orderBy to avoid composite index requirement
      const { where } = await import('firebase/firestore');
      buildingsQuery = query(
        collection(db, COLLECTIONS.BUILDINGS),
        where('projectId', '==', projectId)
      );
    } else {
      // Get all buildings (without orderBy to avoid index requirement)
      // Sorting will be done client-side
      buildingsQuery = query(
        collection(db, COLLECTIONS.BUILDINGS)
      );
    }

    const snapshot = await getDocs(buildingsQuery);

    // 🏢 ENTERPRISE: Ensure Firestore document ID is preserved
    // The spread must come BEFORE id to avoid data.id overriding doc.id
    const buildings: BuildingDocument[] = snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,  // ✅ Firestore document ID (always last to prevent override)
    }));

    // 🔄 ENTERPRISE: Client-side sort by createdAt (fallback for missing index)
    buildings.sort((a, b) => {
      const getTime = (val: BuildingDocument['createdAt']): number => {
        if (!val) return 0;
        if (typeof val === 'string') return new Date(val).getTime();
        if (val instanceof Date) return val.getTime();
        if (typeof val === 'object' && 'toDate' in val) return val.toDate().getTime();
        return 0;
      };
      return getTime(b.createdAt) - getTime(a.createdAt); // desc order
    });

    // 💾 ENTERPRISE CACHING: Store in cache for future requests (only for all buildings)
    if (!projectId) {
      CacheHelpers.cacheAllBuildings(buildings);
    }

    if (projectId) {
      console.log(`✅ API: Found ${buildings.length} buildings for project ${projectId}`);
    } else {
      console.log(`✅ API: Found ${buildings.length} buildings (cached for 2 minutes)`);
    }

    return NextResponse.json({
      success: true,
      buildings,
      count: buildings.length,
      cached: false,
      projectId: projectId || undefined
    });

  } catch (error) {
    console.error('❌ Error fetching buildings:', error);

    return NextResponse.json({
      success: false,
      error: 'Failed to fetch buildings',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}