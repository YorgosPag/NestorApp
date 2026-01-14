import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { CacheHelpers } from '@/lib/cache/enterprise-api-cache';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';

/** Building document with optional createdAt for sorting */
interface BuildingDocument {
  id: string;
  createdAt?: string | Date | { toDate: () => Date };
  [key: string]: unknown;
}

/** Response type for buildings API */
interface BuildingsResponse {
  success: boolean;
  buildings?: BuildingDocument[];
  count?: number;
  cached?: boolean;
  projectId?: string;
  error?: string;
  details?: string;
}

export const GET = withAuth<BuildingsResponse>(
  async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
  try {
    // 🏗️ ENTERPRISE: Extract projectId parameter for filtering
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    // 🔒 TENANT ISOLATION: Always scope to user's company
    const tenantCompanyId = ctx.companyId;

    if (projectId) {
      console.log(`🏗️ API: Loading buildings for project ${projectId} (tenant: ${tenantCompanyId})...`);
    } else {
      console.log(`🏗️ API: Loading all buildings for tenant ${tenantCompanyId}...`);
    }

    // 🚀 ENTERPRISE CACHING: Check cache first (tenant-scoped key)
    // Note: Cache disabled for now - tenant-scoped caching requires refactor
    // TODO: Implement tenant-scoped cache keys

    console.log('🔍 API: Fetching from Firestore with tenant isolation...');

    // 🎯 ENTERPRISE: Build query with MANDATORY tenant filter + optional projectId
    const { where } = await import('firebase/firestore');
    let buildingsQuery;

    if (projectId) {
      // 🔒 TENANT + PROJECT: Filter by both companyId AND projectId
      buildingsQuery = query(
        collection(db, COLLECTIONS.BUILDINGS),
        where('companyId', '==', tenantCompanyId),
        where('projectId', '==', projectId)
      );
    } else {
      // 🔒 TENANT ONLY: Filter by companyId (company-wide list)
      buildingsQuery = query(
        collection(db, COLLECTIONS.BUILDINGS),
        where('companyId', '==', tenantCompanyId)
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

    // 💾 ENTERPRISE CACHING: Disabled until tenant-scoped cache is implemented
    // TODO: Implement tenant-scoped cache keys: `buildings:${tenantCompanyId}:${projectId || 'all'}`

    console.log(`✅ API: Found ${buildings.length} buildings for tenant ${tenantCompanyId}${projectId ? ` (project: ${projectId})` : ''}`);

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
  },
  { permissions: 'buildings:buildings:view' }
);
