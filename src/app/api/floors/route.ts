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

        console.log(`🏢 [Floors/List] Fetching floors for tenant ${ctx.companyId}...`);
        console.log(`🔒 Auth Context: User ${ctx.uid}, Company ${ctx.companyId}`);
        console.log(`📋 Filters: buildingId=${buildingId || 'all'}, projectId=${projectId || 'all'}`);

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

        console.log(`🏢 Found ${floors.length} floors for tenant ${ctx.companyId}`);

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

          console.log(`✅ [Floors/List] Complete: ${floors.length} floors in ${Object.keys(floorsByBuilding).length} buildings`);

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
          console.log(`✅ [Floors/List] Complete: ${floors.length} floors returned`);

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
        console.error('❌ [Floors/List] Error:', {
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

        console.log(`🏢 [Floors/Create] Creating floor for tenant ${ctx.companyId}...`);
        console.log(`🔒 Auth Context: User ${ctx.uid}, Company ${ctx.companyId}`);
        console.log(`📋 Floor data:`, body);

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

        console.log(`🆔 [Floors/Create] Generated enterprise ID: ${floorId}`);

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

        console.log(`✅ [Floors/Create] Floor created successfully: ${floorId}`);

        return NextResponse.json({
          success: true,
          floor: floorDocument,
          message: `Floor "${body.name}" created successfully with ID ${floorId}`
        }, { status: 201 });

      } catch (error) {
        console.error('❌ [Floors/Create] Error:', {
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
