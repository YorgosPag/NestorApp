import { NextRequest } from 'next/server';
import { db as getAdminDb } from '@/lib/firebase-admin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';

/** Building document with optional createdAt for sorting */
interface BuildingDocument {
  id: string;
  createdAt?: string | Date | { seconds: number; nanoseconds: number };
  [key: string]: unknown;
}

/** 🏢 ENTERPRISE: Response data type (for apiSuccess wrapper) */
interface BuildingsResponseData {
  buildings: BuildingDocument[];
  count: number;
  projectId?: string;
}

export const GET = withAuth<ApiSuccessResponse<BuildingsResponseData>>(
  async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
    // 🔐 ADMIN SDK: Get server-side Firestore instance
    const adminDb = getAdminDb();
    if (!adminDb) {
      console.error('❌ Firebase Admin not initialized');
      throw new Error('Database unavailable: Firebase Admin not initialized');
    }

    // 🏗️ ENTERPRISE: Extract projectId parameter for filtering
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    // 🔒 TENANT ISOLATION: Always scope to user's company
    const tenantCompanyId = ctx.companyId;

    if (projectId) {
      console.log(`🏗️ [Buildings] Loading for project ${projectId} (tenant: ${tenantCompanyId})...`);
    } else {
      console.log(`🏗️ [Buildings] Loading all buildings for tenant ${tenantCompanyId}...`);
    }

    // 🎯 ENTERPRISE: Build query with MANDATORY tenant filter + optional projectId
    let queryRef = adminDb.collection(COLLECTIONS.BUILDINGS)
      .where('companyId', '==', tenantCompanyId);

    if (projectId) {
      // 🔒 TENANT + PROJECT: Filter by both companyId AND projectId
      queryRef = queryRef.where('projectId', '==', projectId);
    }

    const snapshot = await queryRef.get();

    // 🏢 ENTERPRISE: Ensure Firestore document ID is preserved
    const buildings: BuildingDocument[] = snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,  // ✅ Firestore document ID (always last to prevent override)
    })) as BuildingDocument[];

    // 🔄 ENTERPRISE: Server-side sort by createdAt (desc order)
    buildings.sort((a, b) => {
      const getTime = (val: BuildingDocument['createdAt']): number => {
        if (!val) return 0;
        if (typeof val === 'string') return new Date(val).getTime();
        if (val instanceof Date) return val.getTime();
        // Admin SDK returns Timestamp as { seconds, nanoseconds }
        if (typeof val === 'object' && 'seconds' in val) {
          return val.seconds * 1000 + val.nanoseconds / 1000000;
        }
        return 0;
      };
      return getTime(b.createdAt) - getTime(a.createdAt);
    });

    console.log(`✅ [Buildings] Found ${buildings.length} buildings for tenant ${tenantCompanyId}${projectId ? ` (project: ${projectId})` : ''}`);

    // 🏢 ENTERPRISE: Return standard apiSuccess format
    return apiSuccess<BuildingsResponseData>(
      {
        buildings,
        count: buildings.length,
        projectId: projectId || undefined
      },
      `Loaded ${buildings.length} buildings`
    );
  },
  { permissions: 'buildings:buildings:view' }
);
