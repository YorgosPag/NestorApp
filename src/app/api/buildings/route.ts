import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { CacheHelpers } from '@/lib/cache/enterprise-api-cache';

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
      const { where } = await import('firebase/firestore');
      buildingsQuery = query(
        collection(db, COLLECTIONS.BUILDINGS),
        where('projectId', '==', projectId),
        orderBy('createdAt', 'desc')
      );
    } else {
      // Get all buildings
      buildingsQuery = query(
        collection(db, COLLECTIONS.BUILDINGS),
        orderBy('createdAt', 'desc')
      );
    }

    const snapshot = await getDocs(buildingsQuery);

    const buildings = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

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