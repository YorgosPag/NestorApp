import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import type { Storage, StorageType, StorageStatus } from '@/types/storage/contracts';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { createEntity } from '@/lib/firestore/entity-creation.service';
import { mapStorageDoc, isValidStorageType, isValidStorageStatus } from '@/lib/firestore-mappers';
import { getErrorMessage } from '@/lib/error-utils';
import { safeParseBody } from '@/lib/validation/shared-schemas';

const CreateStorageSchema = z.object({
  name: z.string().min(1).max(200),
  /** ADR-233: Entity coding system identifier */
  code: z.string().max(50).optional(),
  buildingId: z.string().max(128).optional(),
  type: z.string().max(50).optional(),
  status: z.string().max(50).optional(),
  floor: z.string().max(50).optional(),
  floorId: z.string().max(128).optional(),
  area: z.number().min(0).max(999_999).optional(),
  price: z.number().min(0).max(999_999_999).optional(),
  description: z.string().max(2000).optional(),
  notes: z.string().max(5000).optional(),
  projectId: z.string().max(128).optional(),
  building: z.string().max(200).optional(),
});

const logger = createModuleLogger('StoragesRoute');

// ============================================================================
// 🏢 ENTERPRISE: Admin SDK Storages Endpoint
// ============================================================================
//
// ARCHITECTURE DECISION:
// Χρησιμοποιεί Admin SDK (server-side) αντί για Client SDK
//
// ΑΙΤΙΟΛΟΓΗΣΗ:
// 1. Τα Firestore Security Rules απαιτούν authentication (request.auth != null)
// 2. Το Client SDK στον server ΔΕΝ έχει authentication context
// 3. Μόνο το Admin SDK μπορεί να παρακάμψει τα security rules
//
// PATTERN: Data Mapper Pattern (Enterprise)
// - Separates domain model from persistence model
// - Type-safe transformation from Firestore to TypeScript
// - Validation at the boundary
//
// ============================================================================

// ============================================================================
// DATA MAPPER — Centralized in @/lib/firestore-mappers (SSoT)
// ============================================================================


// ============================================================================
// RESPONSE TYPES (Type-safe withAuth) - CANONICAL FORMAT
// ============================================================================

/**
 * 🏢 ENTERPRISE CANONICAL FORMAT: { success, data: T }
 * Required by enterprise-api-client for proper response handling
 */
interface StoragesData {
  storages: Storage[];
  count: number;
  cached: boolean;
  projectId?: string;
}

interface StoragesResponse {
  success: boolean;
  data?: StoragesData;
  error?: string;
  details?: string;
}

// ============================================================================
// API HANDLER
// ============================================================================

/**
 * GET /api/storages
 *
 * List storage spaces (optionally filtered by projectId).
 *
 * 🔒 SECURITY: Protected with RBAC (AUTHZ Phase 2)
 * - Permission: units:units:view
 * - Tenant Isolation: Filters storages by user's companyId through projects
 * @rateLimit STANDARD (60 req/min) - CRUD
 */
export const GET = withStandardRateLimit(
  async (request: NextRequest) => {
  const handler = withAuth<StoragesResponse>(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse<StoragesResponse>> => {
      return handleGetStorages(req, ctx);
    },
    { permissions: 'units:units:view' }
  );

  return handler(request);
  }
);

async function handleGetStorages(request: NextRequest, ctx: AuthContext): Promise<NextResponse<StoragesResponse>> {
  logger.info('Loading storages', { email: ctx.email, companyId: ctx.companyId });
  try {
    // 🏗️ ENTERPRISE: Extract query parameters for filtering
    const { searchParams } = new URL(request.url);
    const requestedProjectId = searchParams.get('projectId');
    const requestedBuildingId = searchParams.get('buildingId');

    // =========================================================================
    // STEP 1: Fetch storages from Firestore (TENANT FILTERED)
    // =========================================================================

    let snapshot;

    if (requestedBuildingId) {
      // 🏢 ENTERPRISE: Query by buildingId — tenant isolation via companyId in-memory filter
      logger.info('Querying storages for building', { buildingId: requestedBuildingId });
      snapshot = await getAdminFirestore()
        .collection(COLLECTIONS.STORAGE)
        .where(FIELDS.BUILDING_ID, '==', requestedBuildingId)
        .get();
    } else if (requestedProjectId) {
      // Validate projectId belongs to user's company
      const projectsSnapshot = await getAdminFirestore()
        .collection(COLLECTIONS.PROJECTS)
        .where(FIELDS.COMPANY_ID, '==', ctx.companyId)
        .get();
      const authorizedProjectIds = new Set(projectsSnapshot.docs.map(doc => doc.id));

      if (!authorizedProjectIds.has(requestedProjectId)) {
        logger.warn('TENANT ISOLATION: Unauthorized project access attempt', { userId: ctx.uid, projectId: requestedProjectId });
        return NextResponse.json({
          success: false,
          error: 'Project not found or access denied',
          details: 'The requested project does not belong to your organization'
        }, { status: 403 });
      }

      logger.info('Querying storages for project', { projectId: requestedProjectId });
      snapshot = await getAdminFirestore()
        .collection(COLLECTIONS.STORAGE)
        .where(FIELDS.PROJECT_ID, '==', requestedProjectId)
        .get();
    } else if (ctx.globalRole === 'super_admin') {
      // 🏢 ADR-232: Super admin — load ALL storages
      logger.info('Querying all storages (super admin)');
      snapshot = await getAdminFirestore()
        .collection(COLLECTIONS.STORAGE)
        .get();
    } else {
      // 🏢 ENTERPRISE: Fetch by companyId for tenant isolation
      logger.info('Querying all storages for company', { companyId: ctx.companyId });
      snapshot = await getAdminFirestore()
        .collection(COLLECTIONS.STORAGE)
        .where(FIELDS.COMPANY_ID, '==', ctx.companyId)
        .get();
    }

    // =========================================================================
    // STEP 2: Map and filter storages (TENANT ISOLATION)
    // =========================================================================
    const allStorages: Storage[] = [];

    snapshot.docs.forEach(doc => {
      allStorages.push(mapStorageDoc(doc.id, doc.data() as Record<string, unknown>));
    });

    // 🏢 ENTERPRISE: Tenant isolation — filter by companyId for buildingId queries
    const storages = requestedBuildingId
      ? allStorages.filter(s => !s.companyId || s.companyId === ctx.companyId)
      : allStorages;

    logger.info('Found storages', { count: storages.length });

    // =========================================================================
    // STEP 3: Return tenant-filtered results (CANONICAL FORMAT)
    // =========================================================================
    return NextResponse.json({
      success: true,
      data: {
        storages,
        count: storages.length,
        cached: false,
        projectId: requestedProjectId || undefined
      }
    });

  } catch (error) {
    logger.error('Error fetching storages', { error: getErrorMessage(error) });

    return NextResponse.json({
      success: false,
      error: 'Failed to fetch storages',
      details: getErrorMessage(error)
    }, { status: 500 });
  }
}

// ============================================================================
// POST — Create Storage Unit via Admin SDK
// ============================================================================

interface StorageCreatePayload {
  name: string;
  /** Optional — storage can exist without building link */
  buildingId?: string;
  type?: StorageType;
  status?: StorageStatus;
  floor?: string;
  /** Floor document ID (Firestore foreign key) */
  floorId?: string;
  area?: number;
  price?: number;
  description?: string;
  notes?: string;
  projectId?: string;
  building?: string;
}

interface StorageCreateResponse {
  storageId: string;
}

export const POST = withStandardRateLimit(
  withAuth<ApiSuccessResponse<StorageCreateResponse>>(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      try {
        const parsed = safeParseBody(CreateStorageSchema, await request.json());
        if (parsed.error) throw new ApiError(400, 'Validation failed');
        const body = parsed.data;

        const buildingId = body.buildingId?.trim() || null;

        // Entity-specific fields (exclude common fields handled by createEntity)
        const entitySpecificFields: Record<string, unknown> = {
          name: body.name.trim(),
          buildingId,
          type: isValidStorageType(body.type || 'small') ? body.type || 'small' : 'small',
          status: isValidStorageStatus(body.status || 'available') ? body.status || 'available' : 'available',
        };

        // Optional fields
        if (body.floor?.trim()) entitySpecificFields.floor = body.floor.trim();
        if (body.floorId?.trim()) entitySpecificFields.floorId = body.floorId.trim();
        if (typeof body.area === 'number' && body.area > 0) entitySpecificFields.area = body.area;
        if (typeof body.price === 'number' && body.price >= 0) entitySpecificFields.price = body.price;
        if (body.description?.trim()) entitySpecificFields.description = body.description.trim();
        if (body.notes?.trim()) entitySpecificFields.notes = body.notes.trim();
        if (body.projectId?.trim()) entitySpecificFields.projectId = body.projectId.trim();
        if (body.building?.trim()) entitySpecificFields.building = body.building.trim();
        if (body.code?.trim()) entitySpecificFields.code = body.code.trim();

        logger.info('Creating storage unit', { name: body.name, buildingId, companyId: ctx.companyId });

        // 🏢 ADR-238: Centralized entity creation
        const floorLevel = body.floor ? parseInt(body.floor, 10) : 0;
        const result = await createEntity('storage', {
          auth: ctx,
          parentId: buildingId,
          entitySpecificFields,
          codeOptions: {
            currentValue: body.code?.trim() || body.name.trim(),
            floorLevel: isNaN(floorLevel) ? 0 : floorLevel,
          },
          apiPath: '/api/storages (POST)',
        });

        return apiSuccess<StorageCreateResponse>(
          { storageId: result.id },
          'Storage unit created successfully'
        );
      } catch (error) {
        if (error instanceof ApiError) throw error;
        logger.error('Error creating storage', { error: getErrorMessage(error) });
        throw new ApiError(500, getErrorMessage(error, 'Failed to create storage unit'));
      }
    },
    { permissions: 'units:units:create' }
  )
);
