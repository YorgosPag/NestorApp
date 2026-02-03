import { NextRequest } from 'next/server';
import { db as getAdminDb } from '@/lib/firebase-admin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { withAuth, logAuditEvent } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { FieldValue } from 'firebase-admin/firestore';
import { isRoleBypass } from '@/lib/auth/roles';

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

/**
 * 🏗️ ENTERPRISE: Create new building via Admin SDK
 *
 * @security Firestore rules block client-side writes (allow write: if false)
 *           This endpoint uses Admin SDK to bypass rules with proper auth
 * @permission buildings:buildings:create
 */
interface BuildingCreatePayload {
  name: string;
  description?: string;
  address?: string;
  city?: string;
  totalArea?: number | string;
  builtArea?: number | string;
  floors?: number | string;
  units?: number | string;
  totalValue?: number | string;
  startDate?: string;
  completionDate?: string;
  status?: string;
  projectId?: string | null;
  companyId?: string;
  company?: string;
}

interface BuildingCreateResponse {
  buildingId: string;
  building: BuildingCreatePayload & { id: string };
}

export const POST = withAuth<ApiSuccessResponse<BuildingCreateResponse>>(
  async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
    // 🔐 ADMIN SDK: Get server-side Firestore instance
    const adminDb = getAdminDb();
    if (!adminDb) {
      console.error('❌ Firebase Admin not initialized');
      throw new ApiError(503, 'Database unavailable');
    }

    try {
      // 🏢 ENTERPRISE: Parse request body
      const body: BuildingCreatePayload = await request.json();

      // 🔒 SECURITY: Override companyId with authenticated user's company
      // This prevents cross-tenant building creation
      const sanitizedData = {
        ...body,
        companyId: ctx.companyId,  // 🔒 FORCED: Always use auth context companyId
        progress: 0,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        createdBy: ctx.uid,
      };

      // 🏢 ENTERPRISE: Remove undefined fields (Firestore doesn't accept undefined)
      const cleanData = Object.fromEntries(
        Object.entries(sanitizedData).filter(([, value]) => value !== undefined)
      );

      console.log(`🏗️ [Buildings] Creating new building for tenant ${ctx.companyId}...`);

      // 🏗️ CREATE: Use Admin SDK (bypasses Firestore rules)
      const docRef = await adminDb.collection(COLLECTIONS.BUILDINGS).add(cleanData);

      console.log(`✅ [Buildings] Building created with ID: ${docRef.id}`);

      // 🏢 ENTERPRISE: Return created building with ID
      return apiSuccess<BuildingCreateResponse>(
        {
          buildingId: docRef.id,
          building: { ...body, id: docRef.id }
        },
        'Building created successfully'
      );

    } catch (error) {
      console.error('❌ [Buildings] Error creating building:', error);
      throw new ApiError(500, error instanceof Error ? error.message : 'Failed to create building');
    }
  },
  { permissions: 'buildings:buildings:create' }
);

// =============================================================================
// PATCH - Update Building (Admin SDK)
// =============================================================================

interface BuildingUpdatePayload {
  name?: string;
  description?: string;
  address?: string;
  city?: string;
  totalArea?: number;
  builtArea?: number;
  floors?: number;
  units?: number;
  totalValue?: number;
  startDate?: string;
  completionDate?: string;
  status?: string;
  projectId?: string | null;
}

interface BuildingUpdateResponse {
  buildingId: string;
  updated: boolean;
}

/**
 * 🏗️ ENTERPRISE: Update building via Admin SDK
 *
 * @security Firestore rules block client-side writes (allow write: if false)
 *           This endpoint uses Admin SDK to bypass rules with proper auth
 * @permission buildings:buildings:edit
 */
export const PATCH = withAuth<ApiSuccessResponse<BuildingUpdateResponse>>(
  async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
    // 🔐 ADMIN SDK: Get server-side Firestore instance
    const adminDb = getAdminDb();
    if (!adminDb) {
      console.error('❌ Firebase Admin not initialized');
      throw new ApiError(503, 'Database unavailable');
    }

    try {
      // 🏢 ENTERPRISE: Parse request body
      const body = await request.json();
      const { buildingId, ...updates } = body as { buildingId: string } & BuildingUpdatePayload;

      if (!buildingId) {
        throw new ApiError(400, 'Building ID is required');
      }

      // 🔐 Get building to check ownership
      const buildingDoc = await adminDb.collection(COLLECTIONS.BUILDINGS).doc(buildingId).get();

      if (!buildingDoc.exists) {
        throw new ApiError(404, 'Building not found');
      }

      const buildingData = buildingDoc.data();
      const isSuperAdmin = isRoleBypass(ctx.globalRole);

      // 🔒 TENANT ISOLATION: Check ownership (unless super_admin)
      if (!isSuperAdmin && buildingData?.companyId !== ctx.companyId) {
        console.warn(`🚫 [Buildings] Unauthorized update attempt by ${ctx.email} on building ${buildingId}`);
        throw new ApiError(403, 'Unauthorized: Building belongs to different company');
      }

      // 🔒 SECURITY: Sanitize - remove undefined fields
      const cleanUpdates = Object.fromEntries(
        Object.entries(updates).filter(([, value]) => value !== undefined)
      );

      console.log(`🏗️ [Buildings] Updating building ${buildingId} for tenant ${ctx.companyId}...`);

      // 🏗️ UPDATE: Use Admin SDK (bypasses Firestore rules)
      await adminDb.collection(COLLECTIONS.BUILDINGS).doc(buildingId).update({
        ...cleanUpdates,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: ctx.uid,
      });

      console.log(`✅ [Buildings] Building ${buildingId} updated by ${ctx.email}`);

      // 📊 Audit log
      await logAuditEvent(ctx, 'data_updated', 'buildings', 'api', {
        newValue: {
          type: 'building_update',
          value: {
            buildingId,
            fields: Object.keys(cleanUpdates),
          },
        },
        metadata: { reason: 'Building updated' },
      });

      return apiSuccess<BuildingUpdateResponse>(
        { buildingId, updated: true },
        'Building updated successfully'
      );

    } catch (error) {
      console.error('❌ [Buildings] Error updating building:', error);
      throw new ApiError(500, error instanceof Error ? error.message : 'Failed to update building');
    }
  },
  { permissions: 'buildings:buildings:edit' }
);
