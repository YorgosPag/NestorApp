/**
 * Parking Spot PATCH / DELETE endpoint
 *
 * @module api/parking/[id]
 * @permission units:units:edit (PATCH), units:units:delete (DELETE)
 * @rateLimit STANDARD (60 req/min)
 * @see ADR-184 (Building Spaces Tabs)
 */

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth, logAuditEvent } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { createModuleLogger } from '@/lib/telemetry';
import { executeDeletion } from '@/lib/firestore/deletion-guard';
import { linkEntity } from '@/lib/firestore/entity-linking.service';
import { propagateSpaceAllocationCodeChange } from '@/lib/firestore/cascade-propagation.service';

const logger = createModuleLogger('ParkingIdRoute');

// ============================================================================
// TYPES
// ============================================================================

import type { ParkingSpotType, ParkingSpotStatus, ParkingLocationZone } from '@/types/parking';
import { getErrorMessage } from '@/lib/error-utils';
import { requireParkingInTenant } from '@/lib/auth/tenant-isolation';
import { withVersionCheck, ConflictError } from '@/lib/firestore/version-check';
import { safeParseBody } from '@/lib/validation/shared-schemas';

const UpdateParkingSchema = z.object({
  number: z.string().max(50).optional(),
  type: z.string().max(50).optional(),
  status: z.string().max(50).optional(),
  locationZone: z.string().max(100).nullable().optional(),
  floor: z.string().max(50).nullable().optional(),
  location: z.string().max(200).nullable().optional(),
  area: z.number().min(0).max(999_999).nullable().optional(),
  price: z.number().min(0).max(999_999_999).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  buildingId: z.string().max(128).nullable().optional(),
  projectId: z.string().max(128).optional(),
  _v: z.number().int().optional(),
}).passthrough();

interface ParkingPatchPayload {
  number?: string;
  type?: ParkingSpotType;
  status?: ParkingSpotStatus;
  locationZone?: ParkingLocationZone | null;
  floor?: string;
  location?: string;
  area?: number;
  price?: number;
  notes?: string;
  /** Set to null to unlink from building, or string to link */
  buildingId?: string | null;
  projectId?: string;
}

interface ParkingMutationResult {
  id: string;
  _v?: number;
}

// ============================================================================
// PATCH — Update Parking Spot
// ============================================================================

export const PATCH = withStandardRateLimit(
  withAuth<ApiSuccessResponse<ParkingMutationResult>>(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      const adminDb = getAdminFirestore();
      if (!adminDb) throw new ApiError(503, 'Database unavailable');

      const id = extractIdFromUrl(request.url);
      if (!id) throw new ApiError(400, 'Parking spot ID is required');

      try {
        // 🔒 ADR: Centralized tenant isolation (existence + companyId + audit logging)
        await requireParkingInTenant({ ctx, parkingId: id, path: '/api/parking/[id]' });

        const docRef = adminDb.collection(COLLECTIONS.PARKING_SPACES).doc(id);
        const doc = await docRef.get();
        const existing = doc.data() as Record<string, unknown>;

        const parsed = safeParseBody(UpdateParkingSchema, await request.json());
        if (parsed.error) throw new ApiError(400, 'Validation failed');
        const { _v: expectedVersion, ...body } = parsed.data;

        // Build update object — only include provided fields
        // SPEC-256A: updatedAt + updatedBy injected by withVersionCheck
        const updateData: Record<string, unknown> = {};

        if (body.number?.trim()) updateData.number = body.number.trim();
        if (body.type) updateData.type = body.type;
        if (body.status) updateData.status = body.status;
        if (body.floor !== undefined) updateData.floor = body.floor?.trim() || null;
        if (body.location !== undefined) updateData.location = body.location?.trim() || null;
        if (body.area !== undefined) updateData.area = typeof body.area === 'number' ? body.area : null;
        if (body.price !== undefined) updateData.price = typeof body.price === 'number' ? body.price : null;
        if (body.notes !== undefined) updateData.notes = body.notes?.trim() || null;
        if (body.buildingId !== undefined) updateData.buildingId = body.buildingId ?? null;
        if (body.locationZone !== undefined) updateData.locationZone = body.locationZone ?? null;
        if (body.projectId?.trim()) updateData.projectId = body.projectId.trim();

        // SPEC-256A: Version-checked write
        const versionResult = await withVersionCheck({
          db: adminDb,
          collection: COLLECTIONS.PARKING_SPACES,
          docId: id,
          expectedVersion,
          updates: updateData,
          userId: ctx.uid,
        });

        // 🔗 ADR-247 F-4: Cascade allocationCode to linkedSpaces on units
        if (body.number?.trim() && body.number.trim() !== (existing.number as string)) {
          propagateSpaceAllocationCodeChange(id, body.number.trim(), (existing.buildingId as string) ?? null)
            .catch((err) => logger.warn('allocationCode cascade failed (non-blocking)', {
              id, error: getErrorMessage(err),
            }));
        }

        // 🔗 ADR-239: Centralized linking — change detection + cascade + entity audit
        if (body.buildingId !== undefined) {
          linkEntity('parking:buildingId', {
            auth: ctx,
            entityId: id,
            newLinkValue: body.buildingId ?? null,
            existingDoc: existing,
            apiPath: '/api/parking/[id] (PATCH)',
          }).catch((err) => {
            logger.warn('linkEntity failed (non-blocking)', {
              id, error: getErrorMessage(err),
            });
          });
        }

        logger.info('Parking spot updated', { id, companyId: ctx.companyId });

        await logAuditEvent(ctx, 'data_updated', 'parking_spot', 'api', {
          newValue: { type: 'status', value: { parkingSpotId: id, updates: Object.keys(updateData) } },
          metadata: { reason: 'Parking spot updated via API' },
        });

        return apiSuccess<ParkingMutationResult>({ id, _v: versionResult.newVersion }, 'Parking spot updated');
      } catch (error) {
        if (error instanceof ConflictError) {
          return NextResponse.json(error.body, { status: error.statusCode });
        }
        if (error instanceof ApiError) throw error;
        logger.error('Error updating parking spot', { id, error: getErrorMessage(error) });
        throw new ApiError(500, getErrorMessage(error, 'Failed to update parking spot'));
      }
    },
    { permissions: 'units:units:update' }
  )
);

// ============================================================================
// DELETE — Delete Parking Spot
// ============================================================================

export const DELETE = withStandardRateLimit(
  withAuth<ApiSuccessResponse<ParkingMutationResult>>(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      const adminDb = getAdminFirestore();
      if (!adminDb) throw new ApiError(503, 'Database unavailable');

      const id = extractIdFromUrl(request.url);
      if (!id) throw new ApiError(400, 'Parking spot ID is required');

      try {
        // 🔒 ADR: Centralized tenant isolation (existence + companyId + audit logging)
        await requireParkingInTenant({ ctx, parkingId: id, path: '/api/parking/[id]' });

        const docRef = adminDb.collection(COLLECTIONS.PARKING_SPACES).doc(id);
        const existing = (await docRef.get()).data() as Record<string, unknown>;

        // 🛡️ ADR-226: Guarded deletion (checks dependencies + conditional block for sold parking)
        await executeDeletion(adminDb, 'parking', id, ctx.uid, ctx.companyId);

        logger.info('Parking spot deleted', { id, companyId: ctx.companyId });

        // Auth audit (dual audit — executeDeletion handles entity audit)
        await logAuditEvent(ctx, 'data_deleted', 'parking_spot', 'api', {
          newValue: { type: 'status', value: { parkingSpotId: id, number: existing.number } },
          metadata: { reason: 'Parking spot deleted via API' },
        });

        return apiSuccess<ParkingMutationResult>({ id }, 'Parking spot deleted');
      } catch (error) {
        if (error instanceof ApiError) throw error;
        logger.error('Error deleting parking spot', { id, error: getErrorMessage(error) });
        throw new ApiError(500, getErrorMessage(error, 'Failed to delete parking spot'));
      }
    },
    { permissions: 'units:units:delete' }
  )
);

// ============================================================================
// HELPERS
// ============================================================================

function extractIdFromUrl(url: string): string | null {
  const segments = new URL(url).pathname.split('/');
  return segments[segments.length - 1] || null;
}
