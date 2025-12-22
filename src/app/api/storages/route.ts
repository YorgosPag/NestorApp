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
      console.log(`🏗️ API: Loading storages for project ${projectId}...`);
    } else {
      console.log('🏗️ API: Loading all storages...');
    }

    // 🚀 ENTERPRISE CACHING: Check cache first (only for all storages)
    if (!projectId) {
      const cachedStorages = CacheHelpers.getCachedAllStorages();
      if (cachedStorages) {
        console.log(`⚡ API: CACHE HIT - Returning ${cachedStorages.length} cached storages`);
        return NextResponse.json({
          success: true,
          storages: cachedStorages,
          count: cachedStorages.length,
          cached: true
        });
      }
    }

    console.log('🔍 API: Cache miss - Fetching from Firestore...');

    // 🎯 ENTERPRISE: Build query with optional projectId filter
    let storagesQuery;

    if (projectId) {
      // 🎯 ENTERPRISE: Filter storages by projectId relationship
      // Note: Removed orderBy to avoid composite index requirement
      const { where } = await import('firebase/firestore');
      storagesQuery = query(
        collection(db, COLLECTIONS.STORAGE),
        where('projectId', '==', projectId)
      );
    } else {
      // Get all storages
      storagesQuery = query(
        collection(db, COLLECTIONS.STORAGE),
        orderBy('createdAt', 'desc')
      );
    }

    const snapshot = await getDocs(storagesQuery);

    const storages = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        // Convert Firestore timestamps to dates
        lastUpdated: data.lastUpdated?.toDate?.() || data.lastUpdated,
        createdAt: data.createdAt?.toDate?.() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.() || data.updatedAt
      };
    });

    // 💾 ENTERPRISE CACHING: Store in cache for future requests (only for all storages)
    if (!projectId) {
      CacheHelpers.cacheAllStorages(storages);
    }

    if (projectId) {
      console.log(`✅ API: Found ${storages.length} storages for project ${projectId}`);
    } else {
      console.log(`✅ API: Found ${storages.length} storages (cached for 2 minutes)`);
    }

    return NextResponse.json({
      success: true,
      storages,
      count: storages.length,
      cached: false,
      projectId: projectId || undefined
    });

  } catch (error) {
    console.error('❌ Error fetching storages:', error);

    return NextResponse.json({
      success: false,
      error: 'Failed to fetch storages',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}