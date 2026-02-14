/**
 * 🏢 FLOORS API - ENTERPRISE NORMALIZED COLLECTION
 *
 * Provides access to floors using foreign key relationships.
 *
 * @module api/floors
 * @version 2.0.0
 * @updated 2026-01-15 - AUTHZ PHASE 2: Added RBAC protection
 *
 * 🔒 SECURITY:
 * - Permission: floors:floors:view
 * - Admin SDK for secure server-side operations
 * - Tenant isolation: Query filtered by ctx.companyId
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { COLLECTIONS } from '@/config/firestore-collections';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('FloorsRoute');

// 🏢 ENTERPRISE INTERFACES - Proper TypeScript typing
interface FloorDocument {
  id: string;
  number: number;
  name?: string;
  buildingId: string;
  projectId?: string;
  companyId?: string;
  [key: string]: unknown;
}

// Response types for type-safe withAuth
type FloorsListSuccess = {
  success: true;
  floors: FloorDocument[];
  floorsByBuilding?: Record<string, FloorDocument[]>;
  stats: {
    totalFloors: number;
    buildingId?: string;
    projectId?: string;
    buildingsWithFloors?: number;
  };
  message?: string;
};

type FloorsListError = {
  success: false;
  error: string;
  details?: string;
};

type FloorsListResponse = FloorsListSuccess | FloorsListError;

/**
 * @rateLimit STANDARD (60 req/min) - CRUD
 */
export const GET = withStandardRateLimit(
  async (request: NextRequest) => {
  const handler = withAuth<FloorsListResponse>(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse<FloorsListResponse>> => {
      try {
        const { searchParams } = new URL(request.url);
        const buildingId = searchParams.get('buildingId');
        const projectId = searchParams.get('projectId');

        logger.info('[Floors/List] Fetching floors', { companyId: ctx.companyId, userId: ctx.uid, buildingId: buildingId || 'all', projectId: projectId || 'all' });

        // ============================================================================
        // TENANT-SCOPED QUERY (Admin SDK + Tenant Isolation)
        // ============================================================================

        let floorsQuery = getAdminFirestore()
          .collection(COLLECTIONS.FLOORS)
          .where('companyId', '==', ctx.companyId);

        // Apply additional filters
        if (buildingId) {
          // Query floors by buildingId (most common use case)
          floorsQuery = floorsQuery.where('buildingId', '==', buildingId);
        } else if (projectId) {
          // Query floors by projectId (for project-level floor listing)
          // Handle both string and number projectId values
          const projectIdValue = isNaN(Number(projectId)) ? projectId : Number(projectId);
          floorsQuery = floorsQuery.where('projectId', '==', projectIdValue);
        }

        // Execute query
        const floorsSnapshot = await floorsQuery.get();
        let floors: FloorDocument[] = floorsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as FloorDocument));

        logger.info('Found floors', { count: floors.length, companyId: ctx.companyId });

        // ============================================================================
        // ENTERPRISE SORTING - JavaScript-based sorting to avoid Firestore index requirements
        // ============================================================================

        if (buildingId) {
          // Sort floors by number for single building
          floors.sort((a: FloorDocument, b: FloorDocument) => {
            const numA = typeof a.number === 'number' ? a.number : parseInt(String(a.number)) || 0;
            const numB = typeof b.number === 'number' ? b.number : parseInt(String(b.number)) || 0;
            return numA - numB;
          });
        } else if (projectId) {
          // Sort by building first, then by floor number for project-level queries
          floors.sort((a: FloorDocument, b: FloorDocument) => {
            // First sort by building ID
            if (a.buildingId !== b.buildingId) {
              return a.buildingId.localeCompare(b.buildingId);
            }
            // Then by floor number
            const numA = typeof a.number === 'number' ? a.number : parseInt(String(a.number)) || 0;
            const numB = typeof b.number === 'number' ? b.number : parseInt(String(b.number)) || 0;
            return numA - numB;
          });
        }

        // ============================================================================
        // GROUP BY BUILDING (if querying by projectId)
        // ============================================================================

        if (projectId) {
          const floorsByBuilding = floors.reduce((groups: Record<string, FloorDocument[]>, floor: FloorDocument) => {
            const buildingId = floor.buildingId;
            if (!groups[buildingId]) {
              groups[buildingId] = [];
            }
            groups[buildingId].push(floor);
            return groups;
          }, {} as Record<string, FloorDocument[]>);

          logger.info('[Floors/List] Complete', { floorCount: floors.length, buildingCount: Object.keys(floorsByBuilding).length });

          return NextResponse.json({
            success: true,
            floors,
            floorsByBuilding,
            stats: {
              totalFloors: floors.length,
              buildingsWithFloors: Object.keys(floorsByBuilding).length,
              projectId
            },
            message: `Found ${floors.length} floors in ${Object.keys(floorsByBuilding).length} buildings`
          });
        } else {
          logger.info('[Floors/List] Complete', { floorCount: floors.length });

          return NextResponse.json({
            success: true as const,
            floors,
            stats: {
              totalFloors: floors.length,
              buildingId: buildingId ?? undefined  // 🏢 ENTERPRISE: Convert null to undefined
            },
            message: `Found ${floors.length} floors${buildingId ? ` for building ${buildingId}` : ''}`
          });
        }

      } catch (error) {
        logger.error('[Floors/List] Error', {
          error: error instanceof Error ? error.message : 'Unknown error',
          userId: ctx.uid,
          companyId: ctx.companyId
        });

        return NextResponse.json({
          success: false,
          error: 'Failed to fetch floors',
          details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
      }
    },
    { permissions: 'projects:floors:view' }
  );

  return handler(request);
  }
);

// =============================================================================
// 🏢 ENTERPRISE: POST - Create new floor with enterprise ID
// =============================================================================

interface CreateFloorRequest {
  number: number;
  name: string;
  buildingId: string;
  buildingName?: string;
  projectId: string | number;
  projectName?: string;
  units?: number;
  elevation?: number;
}

type FloorCreateSuccess = {
  success: true;
  floor: FloorDocument;
  message: string;
};

type FloorCreateError = {
  success: false;
  error: string;
  details?: string;
};

type FloorCreateResponse = FloorCreateSuccess | FloorCreateError;

/**
 * @rateLimit STANDARD (60 req/min) - CRUD
 */
export const POST = withStandardRateLimit(
  async (request: NextRequest) => {
  const handler = withAuth<FloorCreateResponse>(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse<FloorCreateResponse>> => {
      try {
        const body = await req.json() as CreateFloorRequest;

        logger.info('[Floors/Create] Creating floor', { companyId: ctx.companyId, userId: ctx.uid, floorData: body });

        // ============================================================================
        // VALIDATION
        // ============================================================================

        if (typeof body.number !== 'number') {
          return NextResponse.json({
            success: false,
            error: 'Validation failed',
            details: 'Floor number is required and must be a number'
          }, { status: 400 });
        }

        if (!body.name || typeof body.name !== 'string') {
          return NextResponse.json({
            success: false,
            error: 'Validation failed',
            details: 'Floor name is required'
          }, { status: 400 });
        }

        if (!body.buildingId || typeof body.buildingId !== 'string') {
          return NextResponse.json({
            success: false,
            error: 'Validation failed',
            details: 'Building ID is required'
          }, { status: 400 });
        }

        if (!body.projectId) {
          return NextResponse.json({
            success: false,
            error: 'Validation failed',
            details: 'Project ID is required'
          }, { status: 400 });
        }

        // ============================================================================
        // 🏢 ENTERPRISE: Generate ID using centralized service
        // ============================================================================

        const { generateFloorId } = await import('@/services/enterprise-id.service');
        const floorId = generateFloorId();

        logger.info('[Floors/Create] Generated enterprise ID', { floorId });

        // ============================================================================
        // CREATE FLOOR DOCUMENT
        // ============================================================================

        const now = new Date().toISOString();
        const floorDocument: FloorDocument & { createdAt: string; createdBy: string } = {
          id: floorId,
          number: body.number,
          name: body.name,
          buildingId: body.buildingId,
          buildingName: body.buildingName || '',
          projectId: String(body.projectId),  // 🏢 ENTERPRISE: Normalize to string
          projectName: body.projectName || '',
          companyId: ctx.companyId,  // 🔒 Tenant isolation
          units: body.units || 0,
          elevation: body.elevation ?? null,  // 🏢 ADR-180: IFC elevation (metres)
          createdAt: now,
          createdBy: ctx.uid
        };

        // ============================================================================
        // SAVE TO FIRESTORE
        // ============================================================================

        await getAdminFirestore()
          .collection(COLLECTIONS.FLOORS)
          .doc(floorId)
          .set(floorDocument);

        logger.info('[Floors/Create] Floor created successfully', { floorId });

        return NextResponse.json({
          success: true,
          floor: floorDocument,
          message: `Floor "${body.name}" created successfully with ID ${floorId}`
        }, { status: 201 });

      } catch (error) {
        logger.error('[Floors/Create] Error', {
          error: error instanceof Error ? error.message : 'Unknown error',
          userId: ctx.uid,
          companyId: ctx.companyId
        });

        return NextResponse.json({
          success: false,
          error: 'Failed to create floor',
          details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
      }
    },
    { permissions: 'projects:floors:view' }  // 🏢 ENTERPRISE: Using view permission (create not defined yet)
  );

  return handler(request);
  }
);

// =============================================================================
// 🏢 ENTERPRISE: PATCH - Update floor (name, number, elevation)
// ADR-180: IFC-Compliant Floor Management
// =============================================================================

interface UpdateFloorRequest {
  floorId: string;
  number?: number;
  name?: string;
  elevation?: number | null;
}

type FloorUpdateResponse = { success: true; message: string } | { success: false; error: string; details?: string };

export const PATCH = withStandardRateLimit(
  async (request: NextRequest) => {
    const handler = withAuth<FloorUpdateResponse>(
      async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse<FloorUpdateResponse>> => {
        try {
          const body = await req.json() as UpdateFloorRequest;

          if (!body.floorId || typeof body.floorId !== 'string') {
            return NextResponse.json({ success: false, error: 'Floor ID is required' }, { status: 400 });
          }

          const db = getAdminFirestore();
          const floorRef = db.collection(COLLECTIONS.FLOORS).doc(body.floorId);
          const floorDoc = await floorRef.get();

          if (!floorDoc.exists) {
            return NextResponse.json({ success: false, error: 'Floor not found' }, { status: 404 });
          }

          const floorData = floorDoc.data();
          if (floorData?.companyId !== ctx.companyId) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
          }

          const updates: Record<string, unknown> = {};
          if (body.name !== undefined) updates.name = body.name;
          if (body.number !== undefined) updates.number = body.number;
          if (body.elevation !== undefined) updates.elevation = body.elevation ?? null;

          if (Object.keys(updates).length === 0) {
            return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
          }

          updates.updatedAt = new Date().toISOString();
          updates.updatedBy = ctx.uid;

          await floorRef.update(updates);
          logger.info('[Floors/Update] Floor updated', { floorId: body.floorId });

          return NextResponse.json({ success: true, message: `Floor "${body.floorId}" updated` });
        } catch (error) {
          logger.error('[Floors/Update] Error', { error: error instanceof Error ? error.message : 'Unknown' });
          return NextResponse.json({ success: false, error: 'Failed to update floor', details: error instanceof Error ? error.message : 'Unknown' }, { status: 500 });
        }
      },
      { permissions: 'projects:floors:view' }
    );
    return handler(request);
  }
);

// =============================================================================
// 🏢 ENTERPRISE: DELETE - Remove floor
// ADR-180: IFC-Compliant Floor Management
// =============================================================================

type FloorDeleteResponse = { success: true; message: string } | { success: false; error: string; details?: string };

export const DELETE = withStandardRateLimit(
  async (request: NextRequest) => {
    const handler = withAuth<FloorDeleteResponse>(
      async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse<FloorDeleteResponse>> => {
        try {
          const { searchParams } = new URL(request.url);
          const floorId = searchParams.get('floorId');

          if (!floorId) {
            return NextResponse.json({ success: false, error: 'Floor ID is required' }, { status: 400 });
          }

          const db = getAdminFirestore();
          const floorRef = db.collection(COLLECTIONS.FLOORS).doc(floorId);
          const floorDoc = await floorRef.get();

          if (!floorDoc.exists) {
            return NextResponse.json({ success: false, error: 'Floor not found' }, { status: 404 });
          }

          const floorData = floorDoc.data();
          if (floorData?.companyId !== ctx.companyId) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
          }

          await floorRef.delete();
          logger.info('[Floors/Delete] Floor deleted', { floorId, userId: ctx.uid });

          return NextResponse.json({ success: true, message: `Floor "${floorId}" deleted` });
        } catch (error) {
          logger.error('[Floors/Delete] Error', { error: error instanceof Error ? error.message : 'Unknown' });
          return NextResponse.json({ success: false, error: 'Failed to delete floor', details: error instanceof Error ? error.message : 'Unknown' }, { status: 500 });
        }
      },
      { permissions: 'projects:floors:view' }
    );
    return handler(request);
  }
);
