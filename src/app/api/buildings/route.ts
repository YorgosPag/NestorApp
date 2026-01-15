import { NextRequest, NextResponse } from 'next/server';
import { db as getAdminDb } from '@/lib/firebase-admin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';

/** Building document with optional createdAt for sorting */
interface BuildingDocument {
  id: string;
  createdAt?: string | Date | { seconds: number; nanoseconds: number };
  [key: string]: unknown;
}

/** Response type for buildings API */
interface BuildingsResponse {
  success: boolean;
  buildings?: BuildingDocument[];
  count?: number;
  projectId?: string;
  error?: string;
  details?: string;
}

export const GET = withAuth<BuildingsResponse>(
  async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
    try {
      // 🔐 ADMIN SDK: Get server-side Firestore instance
      const adminDb = getAdminDb();
      if (!adminDb) {
        console.error('❌ Firebase Admin not initialized');
        return NextResponse.json({
          success: false,
          error: 'Database unavailable',
          details: 'Firebase Admin not initialized'
        }, { status: 503 });
      }

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

      console.log('🔍 API: Fetching from Firestore with Admin SDK + tenant isolation...');

      // 🎯 ENTERPRISE: Build query with MANDATORY tenant filter + optional projectId
      // Using Admin SDK syntax: collection().where().where().get()
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

      // 🔄 ENTERPRISE: Server-side sort by createdAt
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
        return getTime(b.createdAt) - getTime(a.createdAt); // desc order
      });

      console.log(`✅ API: Found ${buildings.length} buildings for tenant ${tenantCompanyId}${projectId ? ` (project: ${projectId})` : ''}`);

      return NextResponse.json({
        success: true,
        buildings,
        count: buildings.length,
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
