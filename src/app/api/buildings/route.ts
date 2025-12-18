import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { CacheHelpers } from '@/lib/cache/enterprise-api-cache';

export async function GET(request: NextRequest) {
  try {
    console.log('🏗️ API: Loading buildings...');

    // 🚀 ENTERPRISE CACHING: Check cache first
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

    console.log('🔍 API: Cache miss - Fetching from Firestore...');

    // Get all buildings from Firestore
    const buildingsQuery = query(
      collection(db, COLLECTIONS.BUILDINGS),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(buildingsQuery);

    const buildings = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // 💾 ENTERPRISE CACHING: Store in cache for future requests
    CacheHelpers.cacheAllBuildings(buildings);

    console.log(`✅ API: Found ${buildings.length} buildings (cached for 2 minutes)`);

    return NextResponse.json({
      success: true,
      buildings,
      count: buildings.length,
      cached: false
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