import { NextRequest } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { withAuth, logAuditEvent } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { FieldValue } from 'firebase-admin/firestore';
import { isRoleBypass } from '@/lib/auth/roles';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { linkEntity } from '@/lib/firestore/entity-linking.service';
import { normalizeProjectIdForQuery } from '@/utils/firestore-helpers';
import { normalizeToMillis } from '@/lib/date-local';
import { createEntity } from '@/lib/firestore/entity-creation.service';

const logger = createModuleLogger('BuildingsRoute');

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

export const GET = withStandardRateLimit(
  withAuth<ApiSuccessResponse<BuildingsResponseData>>(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
    // 🔐 ADMIN SDK: Get server-side Firestore instance
    const adminDb = getAdminFirestore();
    if (!adminDb) {
      logger.error('Firebase Admin not initialized');
      throw new Error('Database unavailable: Firebase Admin not initialized');
    }

    // Extract query parameters
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const queryCompanyId = searchParams.get('companyId');

    // 🏢 ENTERPRISE: Super admin can access any company's buildings
    const isSuperAdmin = isRoleBypass(ctx.globalRole);
    const tenantCompanyId = isSuperAdmin && queryCompanyId
      ? queryCompanyId
      : ctx.companyId;

    if (projectId) {
      logger.info('[Buildings] Loading for project', { projectId, tenantCompanyId, isSuperAdmin });
    } else {
      logger.info('[Buildings] Loading all buildings for tenant', { tenantCompanyId });
    }

    // 🎯 ENTERPRISE: Build query — projectId + fallback to companyId
    // 🏢 ADR-232: Super admin sees ALL buildings (companyId may be null)
    let snapshot;
    if (projectId) {
      // 🏢 ADR-209: Single query with normalized projectId (handles string/number mismatch)
      const projectQuery = adminDb.collection(COLLECTIONS.BUILDINGS)
        .where('projectId', '==', normalizeProjectIdForQuery(projectId));
      snapshot = await projectQuery.get();

      // Step 3: Fallback — many buildings have no projectId field.
      // Load ALL buildings for the same companyId so the user can pick one.
      if (snapshot.empty && tenantCompanyId) {
        logger.info('[Buildings] No buildings with projectId, falling back to companyId', { projectId, tenantCompanyId });
        const fallbackQuery = adminDb.collection(COLLECTIONS.BUILDINGS)
          .where('companyId', '==', tenantCompanyId);
        snapshot = await fallbackQuery.get();
      }
    } else if (isSuperAdmin) {
      // 🏢 ADR-232: Super admin without projectId → load ALL buildings
      const queryRef = adminDb.collection(COLLECTIONS.BUILDINGS);
      snapshot = await queryRef.get();
    } else {
      // Without projectId, use tenant companyId to list all buildings
      const queryRef = adminDb.collection(COLLECTIONS.BUILDINGS)
        .where('companyId', '==', tenantCompanyId);
      snapshot = await queryRef.get();
    }

    // 🏢 ENTERPRISE: Ensure Firestore document ID is preserved
    const buildings: BuildingDocument[] = snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,  // ✅ Firestore document ID (always last to prevent override)
    })) as BuildingDocument[];

    // 🔄 ENTERPRISE: Server-side sort by createdAt (desc order)
    buildings.sort((a, b) => normalizeToMillis(b.createdAt) - normalizeToMillis(a.createdAt));

    logger.info('[Buildings] Found buildings for tenant', { count: buildings.length, tenantCompanyId, projectId: projectId || undefined });

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
  )
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
  addresses?: Record<string, unknown>[];  // 🏢 ENTERPRISE: Multi-address support (ADR-167)
}

interface BuildingCreateResponse {
  buildingId: string;
  building: BuildingCreatePayload & { id: string };
}

export const POST = withStandardRateLimit(
  withAuth<ApiSuccessResponse<BuildingCreateResponse>>(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
    try {
      const body: BuildingCreatePayload = await request.json();

      // Entity-specific fields: exclude common fields handled by createEntity
      const { companyId: _c, ...bodyFields } = body;
      const entitySpecificFields: Record<string, unknown> = {
        ...Object.fromEntries(
          Object.entries(bodyFields).filter(([, value]) => value !== undefined)
        ),
        progress: 0,
      };

      logger.info('[Buildings] Creating new building for tenant', { companyId: ctx.companyId });

      // 🏢 ADR-238: Centralized entity creation (auto companyId, audit, timestamps)
      const result = await createEntity('building', {
        auth: ctx,
        parentId: body.projectId ? String(body.projectId) : null,
        entitySpecificFields,
        apiPath: '/api/buildings (POST)',
      });

      return apiSuccess<BuildingCreateResponse>(
        {
          buildingId: result.id,
          building: { ...body, id: result.id }
        },
        'Building created successfully'
      );
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('[Buildings] Error creating building', { error });
      throw new ApiError(500, error instanceof Error ? error.message : 'Failed to create building');
    }
    },
    { permissions: 'buildings:buildings:create' }
  )
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
  // 🏢 ENTERPRISE: Company association (separate from tenant companyId)
  linkedCompanyId?: string | null;
  linkedCompanyName?: string | null;
  company?: string | null;  // Legacy display name
  addresses?: Record<string, unknown>[];  // 🏢 ENTERPRISE: Multi-address support (ADR-167)
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
 * @permission buildings:buildings:update
 */
export const PATCH = withStandardRateLimit(
  withAuth<ApiSuccessResponse<BuildingUpdateResponse>>(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
    // 🔐 ADMIN SDK: Get server-side Firestore instance
    const adminDb = getAdminFirestore();
    if (!adminDb) {
      logger.error('Firebase Admin not initialized');
      throw new ApiError(503, 'Database unavailable');
    }

    try {
      // Parse request body
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
        logger.warn('[Buildings] Unauthorized update attempt', { email: ctx.email, buildingId });
        throw new ApiError(403, 'Unauthorized: Building belongs to different company');
      }

      // 🔒 SECURITY: Sanitize - remove undefined fields AND protect tenant isolation fields
      // companyId is the TENANT key (set at creation, immutable by client)
      // Use linkedCompanyId/linkedCompanyName for company association changes
      const IMMUTABLE_FIELDS = ['companyId'];
      const cleanUpdates = Object.fromEntries(
        Object.entries(updates).filter(([key, value]) =>
          value !== undefined && !IMMUTABLE_FIELDS.includes(key)
        )
      );

      logger.info('[Buildings] Updating building for tenant', { buildingId, companyId: ctx.companyId });

      // 🏗️ UPDATE: Use Admin SDK (bypasses Firestore rules)
      await adminDb.collection(COLLECTIONS.BUILDINGS).doc(buildingId).update({
        ...cleanUpdates,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: ctx.uid,
      });

      logger.info('[Buildings] Building updated', { buildingId, email: ctx.email });

      // 🔗 ADR-239: Centralized linking — change detection + cascade + entity audit
      if ('projectId' in cleanUpdates) {
        linkEntity('building:projectId', {
          auth: ctx,
          entityId: buildingId,
          newLinkValue: (cleanUpdates.projectId as string) ?? null,
          existingDoc: (buildingData ?? {}) as Record<string, unknown>,
          apiPath: '/api/buildings (PATCH)',
        }).catch((err) => {
          logger.warn('[Buildings] linkEntity failed (non-blocking)', {
            buildingId,
            error: err instanceof Error ? err.message : String(err),
          });
        });
      }

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
      logger.error('[Buildings] Error updating building', { error });
      throw new ApiError(500, error instanceof Error ? error.message : 'Failed to update building');
    }
    },
    { permissions: 'buildings:buildings:update' }
  )
);
