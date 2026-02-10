import { NextRequest } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { withAuth, logAuditEvent } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { FieldValue } from 'firebase-admin/firestore';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('UnitsCreateRoute');

// =============================================================================
// TYPES
// =============================================================================

/**
 * Unit creation payload from client.
 * All fields except name are optional.
 */
interface UnitCreatePayload {
  name: string;
  code?: string;
  type?: string;
  buildingId?: string;
  building?: string;
  floor?: number;
  floorId?: string;
  project?: string;
  status?: string;
  operationalStatus?: string;
  area?: number;
  description?: string;
  vertices?: unknown[];
  layout?: Record<string, number>;
}

interface UnitCreateResponse {
  unitId: string;
}

// =============================================================================
// POST — Create Unit via Admin SDK
// =============================================================================

/**
 * 🏢 ENTERPRISE: Create new unit via Admin SDK
 *
 * @security Firestore rules block client-side writes (allow create: if false)
 *           This endpoint uses Admin SDK to bypass rules with proper auth
 * @permission units:units:create
 * @see ADR-078
 */
export const POST = withStandardRateLimit(
  withAuth<ApiSuccessResponse<UnitCreateResponse>>(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      // 🔐 ADMIN SDK: Get server-side Firestore instance
      const adminDb = getAdminFirestore();
      if (!adminDb) {
        logger.error('Firebase Admin not initialized');
        throw new ApiError(503, 'Database unavailable');
      }

      try {
        // 🏢 ENTERPRISE: Parse request body
        const body: UnitCreatePayload = await request.json();

        // 🔒 VALIDATION: Name is required
        if (!body.name || !body.name.trim()) {
          throw new ApiError(400, 'Unit name is required');
        }

        // 🔒 SECURITY: Override companyId with authenticated user's company
        // This prevents cross-tenant unit creation
        const sanitizedData = {
          ...body,
          name: body.name.trim(),
          companyId: ctx.companyId,  // 🔒 FORCED: Always use auth context companyId
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          createdBy: ctx.uid,
        };

        // 🏢 ENTERPRISE: Remove undefined fields (Firestore doesn't accept undefined)
        const cleanData = Object.fromEntries(
          Object.entries(sanitizedData).filter(([, value]) => value !== undefined)
        );

        logger.info('[Units] Creating new unit', { name: body.name, companyId: ctx.companyId });

        // 🏗️ CREATE: Use Admin SDK (bypasses Firestore rules)
        const docRef = await adminDb.collection(COLLECTIONS.UNITS).add(cleanData);

        logger.info('[Units] Unit created', { unitId: docRef.id });

        // 📊 Audit log
        await logAuditEvent(ctx, 'data_created', 'unit', 'api', {
          newValue: {
            type: 'status',
            value: {
              unitId: docRef.id,
              name: body.name,
              buildingId: body.buildingId || null,
            },
          },
          metadata: { reason: 'Unit created via API' },
        });

        // 🏢 ENTERPRISE: Return created unit ID
        return apiSuccess<UnitCreateResponse>(
          { unitId: docRef.id },
          'Unit created successfully'
        );

      } catch (error) {
        if (error instanceof ApiError) throw error;
        logger.error('[Units] Error creating unit', { error: error instanceof Error ? error.message : String(error) });
        throw new ApiError(500, error instanceof Error ? error.message : 'Failed to create unit');
      }
    },
    { permissions: 'units:units:create' }
  )
);
