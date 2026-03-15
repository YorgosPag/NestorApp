import { NextRequest, NextResponse } from 'next/server';
import { withAuth, logAuditEvent } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { Storage, StorageType, StorageStatus } from '@/types/storage/contracts';
import { requireBuildingInTenant, TenantIsolationError } from '@/lib/auth/tenant-isolation';
import { FieldValue } from 'firebase-admin/firestore';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { normalizeToDate } from '@/lib/date-local';
import {
  formatFloorCode,
  formatEntityCode,
  parseEntityCode,
} from '@/services/entity-code.service';
import { extractBuildingLetter } from '@/config/entity-code-config';

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
// FIRESTORE RAW DATA INTERFACE
// ============================================================================

/**
 * 🏢 Enterprise: Raw Firestore storage document data interface
 * Represents the actual data structure stored in Firestore
 */
interface FirestoreStorageData {
  name?: string;
  type?: string;
  status?: string;
  building?: string;
  floor?: string;
  area?: number;
  description?: string;
  price?: number;
  projectId?: string;
  owner?: string;
  notes?: string;
  lastUpdated?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  [key: string]: unknown;
}

// ============================================================================
// DATA MAPPER - ENTERPRISE PATTERN
// ============================================================================

/**
 * 🏢 Enterprise Data Mapper: Firestore → Storage
 *
 * Transforms raw Firestore data to type-safe Storage.
 * Follows the Data Mapper pattern used in SAP, Salesforce, Microsoft Dynamics.
 *
 * @param docId - Firestore document ID
 * @param data - Raw Firestore document data
 * @returns Type-safe Storage object
 */
function mapFirestoreToStorage(docId: string, data: FirestoreStorageData): Storage {
  // Validate and cast type
  const rawType = data.type || 'small';
  const type: StorageType = isValidStorageType(rawType) ? rawType : 'small';

  // Validate and cast status
  const rawStatus = data.status || 'available';
  const status: StorageStatus = isValidStorageStatus(rawStatus) ? rawStatus : 'available';

  // Convert timestamps
  const lastUpdated = normalizeToDate(data.lastUpdated);

  return {
    id: docId,
    name: data.name || `Storage ${docId.substring(0, 6)}`,
    type,
    status,
    building: data.building || '',
    // 🏢 ENTERPRISE: buildingId field (added via migration 006)
    buildingId: data.buildingId as string | undefined,
    companyId: data.companyId as string | undefined,
    floor: data.floor || '',
    area: typeof data.area === 'number' ? data.area : 0,
    description: data.description,
    price: typeof data.price === 'number' ? data.price : undefined,
    projectId: data.projectId,
    owner: data.owner,
    notes: data.notes,
    lastUpdated: lastUpdated || undefined
  };
}

/**
 * 🔧 Helper: Validate StorageType
 */
function isValidStorageType(type: string): type is StorageType {
  return ['storage', 'large', 'small', 'basement', 'ground', 'special', 'garage', 'warehouse'].includes(type);
}

/**
 * 🔧 Helper: Validate StorageStatus
 */
function isValidStorageStatus(status: string): status is StorageStatus {
  return ['available', 'occupied', 'maintenance', 'reserved', 'sold', 'unavailable'].includes(status);
}


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
        .where('buildingId', '==', requestedBuildingId)
        .get();
    } else if (requestedProjectId) {
      // Validate projectId belongs to user's company
      const projectsSnapshot = await getAdminFirestore()
        .collection(COLLECTIONS.PROJECTS)
        .where('companyId', '==', ctx.companyId)
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
        .where('projectId', '==', requestedProjectId)
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
        .where('companyId', '==', ctx.companyId)
        .get();
    }

    // =========================================================================
    // STEP 2: Map and filter storages (TENANT ISOLATION)
    // =========================================================================
    const allStorages: Storage[] = [];

    snapshot.docs.forEach(doc => {
      const rawData = doc.data() as FirestoreStorageData;
      const storage = mapFirestoreToStorage(doc.id, rawData);
      allStorages.push(storage);
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
    logger.error('Error fetching storages', { error: error instanceof Error ? error.message : String(error) });

    return NextResponse.json({
      success: false,
      error: 'Failed to fetch storages',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// ============================================================================
// POST — Create Storage Unit via Admin SDK
// ============================================================================

interface StorageCreatePayload {
  name: string;
  buildingId: string;
  type?: StorageType;
  status?: StorageStatus;
  floor?: string;
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
      const adminDb = getAdminFirestore();
      if (!adminDb) throw new ApiError(503, 'Database unavailable');

      try {
        const body: StorageCreatePayload = await request.json();

        // Validation
        if (!body.name?.trim()) {
          throw new ApiError(400, 'Storage name is required');
        }
        if (!body.buildingId?.trim()) {
          throw new ApiError(400, 'Building ID is required');
        }

        // Tenant isolation — verify building belongs to user's company
        try {
          await requireBuildingInTenant({
            ctx,
            buildingId: body.buildingId,
            path: '/api/storages (POST)',
          });
        } catch (err) {
          if (err instanceof TenantIsolationError) {
            throw new ApiError(err.status, err.message);
          }
          throw err;
        }

        // 🏢 ADR-232: Super admin entities get companyId: null
        const isSuperAdmin = ctx.globalRole === 'super_admin';

        // 🏢 ADR-233: Auto-generate entity code if name is not already ADR-233 format
        let storageName = body.name.trim();
        if (!parseEntityCode(storageName)) {
          try {
            const buildingDocForCode = await adminDb.collection(COLLECTIONS.BUILDINGS).doc(body.buildingId).get();
            const buildingDataForCode = buildingDocForCode.data();
            const buildingName = (buildingDataForCode?.name as string) || '?';
            const buildingLetter = extractBuildingLetter(buildingName);
            const typeCode = 'AP'; // Storage = Αποθήκη
            const floorLevel = body.floor ? parseInt(body.floor, 10) : 0;
            const floorCode = formatFloorCode(isNaN(floorLevel) ? 0 : floorLevel);

            // Find next sequence
            const existingStorages = await adminDb.collection(COLLECTIONS.STORAGE)
              .where('buildingId', '==', body.buildingId)
              .get();

            let maxSeq = 0;
            for (const doc of existingStorages.docs) {
              const n = doc.data().name as string | undefined;
              if (!n) continue;
              const parsed = parseEntityCode(n);
              if (parsed && parsed.typeCode === typeCode && parsed.floorCode === floorCode) {
                if (parsed.sequence > maxSeq) maxSeq = parsed.sequence;
              }
            }

            storageName = formatEntityCode(buildingLetter, typeCode, floorCode, maxSeq + 1);
            logger.info('Auto-generated storage code', { storageName, buildingId: body.buildingId });
          } catch (codeErr) {
            logger.warn('Storage code auto-generation failed, using original name', {
              error: codeErr instanceof Error ? codeErr.message : String(codeErr),
            });
          }
        }

        // Sanitize data
        const cleanData: Record<string, unknown> = {
          name: storageName,
          buildingId: body.buildingId,
          type: isValidStorageType(body.type || 'small') ? body.type || 'small' : 'small',
          status: isValidStorageStatus(body.status || 'available') ? body.status || 'available' : 'available',
          companyId: isSuperAdmin ? null : ctx.companyId,  // 🔒 ADR-232
          linkedCompanyId: null,                            // 🏢 ADR-232
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          createdBy: ctx.uid,
        };

        // Optional fields
        if (body.floor?.trim()) cleanData.floor = body.floor.trim();
        if (typeof body.area === 'number' && body.area > 0) cleanData.area = body.area;
        if (typeof body.price === 'number' && body.price >= 0) cleanData.price = body.price;
        if (body.description?.trim()) cleanData.description = body.description.trim();
        if (body.notes?.trim()) cleanData.notes = body.notes.trim();
        if (body.projectId?.trim()) cleanData.projectId = body.projectId.trim();
        if (body.building?.trim()) cleanData.building = body.building.trim();

        logger.info('Creating storage unit', { name: body.name, buildingId: body.buildingId, companyId: ctx.companyId });

        // 🏗️ ADR-210: Enterprise ID for storage units
        const { generateStorageId } = await import('@/services/enterprise-id.service');
        const storageId = generateStorageId();
        await adminDb.collection(COLLECTIONS.STORAGE).doc(storageId).set(cleanData);

        logger.info('Storage unit created', { storageId });

        await logAuditEvent(ctx, 'data_created', 'storage', 'api', {
          newValue: {
            type: 'status',
            value: { storageId, name: body.name, buildingId: body.buildingId },
          },
          metadata: { reason: 'Storage unit created via API' },
        });

        return apiSuccess<StorageCreateResponse>(
          { storageId },
          'Storage unit created successfully'
        );
      } catch (error) {
        if (error instanceof ApiError) throw error;
        logger.error('Error creating storage', { error: error instanceof Error ? error.message : String(error) });
        throw new ApiError(500, error instanceof Error ? error.message : 'Failed to create storage unit');
      }
    },
    { permissions: 'units:units:create' }
  )
);
