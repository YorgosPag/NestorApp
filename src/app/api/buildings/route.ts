import { z } from 'zod';
import { NextRequest } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { isRoleBypass } from '@/lib/auth/roles';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { normalizeProjectIdForQuery } from '@/utils/firestore-helpers';
import { normalizeToMillis } from '@/lib/date-local';
import { createEntity } from '@/lib/firestore/entity-creation.service';
import { getErrorMessage } from '@/lib/error-utils';
import { safeParseBody } from '@/lib/validation/shared-schemas';

const CreateBuildingSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(200).optional(),
  totalArea: z.number().min(0).max(999_999_999).optional(),
  builtArea: z.number().min(0).max(999_999_999).optional(),
  floors: z.number().int().min(0).max(999).optional(),
  units: z.number().int().min(0).max(9999).optional(),
  totalValue: z.number().min(0).max(999_999_999).optional(),
  startDate: z.string().max(30).optional(),
  completionDate: z.string().max(30).optional(),
  status: z.string().max(50).optional(),
  projectId: z.string().max(128).optional(),
  companyId: z.string().max(128).optional(),
  company: z.string().max(200).optional(),
  addresses: z.array(z.record(z.unknown())).optional(),
}).passthrough();

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
        .where(FIELDS.PROJECT_ID, '==', normalizeProjectIdForQuery(projectId));
      snapshot = await projectQuery.get();

      // Step 3: Fallback — many buildings have no projectId field.
      // Load ALL buildings for the same companyId so the user can pick one.
      if (snapshot.empty && tenantCompanyId) {
        logger.info('[Buildings] No buildings with projectId, falling back to companyId', { projectId, tenantCompanyId });
        const fallbackQuery = adminDb.collection(COLLECTIONS.BUILDINGS)
          .where(FIELDS.COMPANY_ID, '==', tenantCompanyId);
        snapshot = await fallbackQuery.get();
      }
    } else if (isSuperAdmin) {
      // 🏢 ADR-232: Super admin without projectId → load ALL buildings
      const queryRef = adminDb.collection(COLLECTIONS.BUILDINGS);
      snapshot = await queryRef.get();
    } else {
      // Without projectId, use tenant companyId to list all buildings
      const queryRef = adminDb.collection(COLLECTIONS.BUILDINGS)
        .where(FIELDS.COMPANY_ID, '==', tenantCompanyId);
      snapshot = await queryRef.get();
    }

    // 🏢 ENTERPRISE: Ensure Firestore document ID is preserved
    // ADR-281: Exclude soft-deleted records from normal list
    const buildings: BuildingDocument[] = snapshot.docs
      .filter(doc => doc.data().status !== 'deleted')
      .map(doc => ({
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
      const parsed = safeParseBody(CreateBuildingSchema, await request.json());
      if (parsed.error) throw new ApiError(400, 'Validation failed');
      const body = parsed.data;

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
      throw new ApiError(500, getErrorMessage(error, 'Failed to create building'));
    }
    },
    { permissions: 'buildings:buildings:create' }
  )
);

// PATCH — Update Building (extracted for SRP, ADR-281)
export { PATCH } from './building-update.handler';
