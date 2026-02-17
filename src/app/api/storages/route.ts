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
  const lastUpdated = parseFirestoreTimestamp(data.lastUpdated);

  return {
    id: docId,
    name: data.name || `Storage ${docId.substring(0, 6)}`,
    type,
    status,
    building: data.building || '',
    // 🏢 ENTERPRISE: buildingId field (added via migration 006)
    buildingId: data.buildingId as string | undefined,
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
  return ['large', 'small', 'basement', 'ground', 'special'].includes(type);
}

/**
 * 🔧 Helper: Validate StorageStatus
 */
function isValidStorageStatus(status: string): status is StorageStatus {
  return ['available', 'occupied', 'maintenance', 'reserved'].includes(status);
}

/**
 * 🔧 Helper: Parse Firestore Timestamp to Date
 */
function parseFirestoreTimestamp(timestamp: unknown): Date | null {
  if (!timestamp) return null;

  // Handle Firestore Timestamp object
  if (typeof timestamp === 'object' && timestamp !== null && 'toDate' in timestamp) {
    const firestoreTs = timestamp as { toDate: () => Date };
    return firestoreTs.toDate();
  }

  // Handle Date object
  if (timestamp instanceof Date) {
    return timestamp;
  }

  // Handle ISO string
  if (typeof timestamp === 'string') {
    const parsed = new Date(timestamp);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  // Handle epoch milliseconds
  if (typeof timestamp === 'number') {
    return new Date(timestamp);
  }

  return null;
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
    // STEP 0: Get authorized projects (TENANT ISOLATION)
    // =========================================================================
    logger.info('Getting authorized projects for company');

    const projectsSnapshot = await getAdminFirestore()
      .collection(COLLECTIONS.PROJECTS)
      .where('companyId', '==', ctx.companyId)
      .get();

    const authorizedProjectIds = new Set(projectsSnapshot.docs.map(doc => doc.id));
    logger.info('Found authorized projects', { projectCount: authorizedProjectIds.size, companyId: ctx.companyId });

    if (authorizedProjectIds.size === 0) {
      logger.info('No projects found for company - returning empty result');
      return NextResponse.json({
        success: true,
        data: {
          storages: [],
          count: 0,
          cached: false
        }
      });
    }

    // Validate projectId parameter if provided
    if (requestedProjectId) {
      if (!authorizedProjectIds.has(requestedProjectId)) {
        logger.warn('TENANT ISOLATION: Unauthorized project access attempt', { userId: ctx.uid, projectId: requestedProjectId });
        return NextResponse.json({
          success: false,
          error: 'Project not found or access denied',
          details: 'The requested project does not belong to your organization'
        }, { status: 403 });
      }
      logger.info('Project authorized - proceeding with query', { projectId: requestedProjectId });
    }

    // =========================================================================
    // STEP 1: Fetch storages from Firestore (TENANT FILTERED)
    // =========================================================================
    logger.info('Fetching storages from Firestore with Admin SDK (tenant-filtered)');

    let snapshot;

    if (requestedBuildingId) {
      // 🏢 ENTERPRISE: Direct buildingId query with companyId tenant isolation
      // This is the most efficient path — no need for projectId-based filtering
      snapshot = await getAdminFirestore()
        .collection(COLLECTIONS.STORAGE)
        .where('buildingId', '==', requestedBuildingId)
        .where('companyId', '==', ctx.companyId)
        .get();
      logger.info('Querying storages for building (direct)', { buildingId: requestedBuildingId });
    } else if (requestedProjectId) {
      // Single project query (already validated as authorized)
      snapshot = await getAdminFirestore()
        .collection(COLLECTIONS.STORAGE)
        .where('projectId', '==', requestedProjectId)
        .get();
      logger.info('Querying storages for project', { projectId: requestedProjectId });
    } else {
      // Multiple projects query - get all and filter in-memory
      snapshot = await getAdminFirestore()
        .collection(COLLECTIONS.STORAGE)
        .get();
      logger.info('Querying all storages', { authorizedProjectCount: authorizedProjectIds.size });
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

    // Filter by authorized projects (skip if already filtered by buildingId+companyId)
    let storages: Storage[];
    if (requestedBuildingId) {
      // Already tenant-isolated via Firestore query (buildingId + companyId)
      storages = allStorages;
    } else if (requestedProjectId) {
      storages = allStorages; // Already filtered by Firestore query
    } else {
      storages = allStorages.filter(storage => storage.projectId && authorizedProjectIds.has(storage.projectId));
    }

    logger.info('Found storages for authorized projects', { count: storages.length });
    if (!requestedProjectId) {
      const filteredOut = allStorages.length - storages.length;
      if (filteredOut > 0) {
        logger.info('TENANT ISOLATION: Filtered out storages from unauthorized projects', { filteredOut });
      }
    }

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

        // Sanitize data
        const cleanData: Record<string, unknown> = {
          name: body.name.trim(),
          buildingId: body.buildingId,
          type: isValidStorageType(body.type || 'small') ? body.type || 'small' : 'small',
          status: isValidStorageStatus(body.status || 'available') ? body.status || 'available' : 'available',
          companyId: ctx.companyId,
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

        const docRef = await adminDb.collection(COLLECTIONS.STORAGE).add(cleanData);

        logger.info('Storage unit created', { storageId: docRef.id });

        await logAuditEvent(ctx, 'data_created', 'storage', 'api', {
          newValue: {
            type: 'status',
            value: { storageId: docRef.id, name: body.name, buildingId: body.buildingId },
          },
          metadata: { reason: 'Storage unit created via API' },
        });

        return apiSuccess<StorageCreateResponse>(
          { storageId: docRef.id },
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
