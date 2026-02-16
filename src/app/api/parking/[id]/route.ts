/**
 * Parking Spot PATCH / DELETE endpoint
 *
 * @module api/parking/[id]
 * @permission units:units:edit (PATCH), units:units:delete (DELETE)
 * @rateLimit STANDARD (60 req/min)
 * @see ADR-184 (Building Spaces Tabs)
 */

import { NextRequest } from 'next/server';
import { withAuth, logAuditEvent } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FieldValue } from 'firebase-admin/firestore';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('ParkingIdRoute');

// ============================================================================
// TYPES
// ============================================================================

interface ParkingPatchPayload {
  number?: string;
  type?: 'standard' | 'handicapped' | 'motorcycle' | 'electric' | 'visitor';
  status?: 'available' | 'occupied' | 'reserved' | 'sold' | 'maintenance';
  floor?: string;
  location?: string;
  area?: number;
  price?: number;
  notes?: string;
}

interface ParkingMutationResult {
  id: string;
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
        // Verify document exists and belongs to tenant
        const docRef = adminDb.collection(COLLECTIONS.PARKING_SPACES).doc(id);
        const doc = await docRef.get();

        if (!doc.exists) throw new ApiError(404, 'Parking spot not found');

        const existing = doc.data() as Record<string, unknown>;
        if (existing.companyId && existing.companyId !== ctx.companyId) {
          throw new ApiError(403, 'Access denied');
        }

        const body: ParkingPatchPayload = await request.json();

        // Build update object — only include provided fields
        const updateData: Record<string, unknown> = {
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: ctx.uid,
        };

        if (body.number?.trim()) updateData.number = body.number.trim();
        if (body.type) updateData.type = body.type;
        if (body.status) updateData.status = body.status;
        if (body.floor !== undefined) updateData.floor = body.floor?.trim() || null;
        if (body.location !== undefined) updateData.location = body.location?.trim() || null;
        if (body.area !== undefined) updateData.area = typeof body.area === 'number' ? body.area : null;
        if (body.price !== undefined) updateData.price = typeof body.price === 'number' ? body.price : null;
        if (body.notes !== undefined) updateData.notes = body.notes?.trim() || null;

        await docRef.update(updateData);

        logger.info('Parking spot updated', { id, companyId: ctx.companyId });

        await logAuditEvent(ctx, 'data_updated', 'parking_spot', 'api', {
          newValue: { type: 'status', value: { parkingSpotId: id, updates: Object.keys(updateData) } },
          metadata: { reason: 'Parking spot updated via API' },
        });

        return apiSuccess<ParkingMutationResult>({ id }, 'Parking spot updated');
      } catch (error) {
        if (error instanceof ApiError) throw error;
        logger.error('Error updating parking spot', { id, error: error instanceof Error ? error.message : String(error) });
        throw new ApiError(500, error instanceof Error ? error.message : 'Failed to update parking spot');
      }
    },
    { permissions: 'units:units:edit' }
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
        const docRef = adminDb.collection(COLLECTIONS.PARKING_SPACES).doc(id);
        const doc = await docRef.get();

        if (!doc.exists) throw new ApiError(404, 'Parking spot not found');

        const existing = doc.data() as Record<string, unknown>;
        if (existing.companyId && existing.companyId !== ctx.companyId) {
          throw new ApiError(403, 'Access denied');
        }

        await docRef.delete();

        logger.info('Parking spot deleted', { id, companyId: ctx.companyId });

        await logAuditEvent(ctx, 'data_deleted', 'parking_spot', 'api', {
          newValue: { type: 'status', value: { parkingSpotId: id, number: existing.number } },
          metadata: { reason: 'Parking spot deleted via API' },
        });

        return apiSuccess<ParkingMutationResult>({ id }, 'Parking spot deleted');
      } catch (error) {
        if (error instanceof ApiError) throw error;
        logger.error('Error deleting parking spot', { id, error: error instanceof Error ? error.message : String(error) });
        throw new ApiError(500, error instanceof Error ? error.message : 'Failed to delete parking spot');
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
