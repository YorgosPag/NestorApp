/**
 * Unit PATCH / DELETE endpoint
 *
 * @module api/units/[id]
 * @permission units:units:update (PATCH), units:units:update (DELETE)
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

const logger = createModuleLogger('UnitIdRoute');

// ============================================================================
// TYPES
// ============================================================================

interface UnitPatchPayload {
  name?: string;
  type?: string;
  status?: string;
  floor?: string;
  area?: number;
  price?: number;
  description?: string;
  /** Set to null to unlink from building, or string to link */
  buildingId?: string | null;
}

interface UnitMutationResult {
  id: string;
}

// ============================================================================
// PATCH — Update Unit
// ============================================================================

export const PATCH = withStandardRateLimit(
  withAuth<ApiSuccessResponse<UnitMutationResult>>(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      const adminDb = getAdminFirestore();
      if (!adminDb) throw new ApiError(503, 'Database unavailable');

      const id = extractIdFromUrl(request.url);
      if (!id) throw new ApiError(400, 'Unit ID is required');

      try {
        const docRef = adminDb.collection(COLLECTIONS.UNITS).doc(id);
        const doc = await docRef.get();

        if (!doc.exists) throw new ApiError(404, 'Unit not found');

        const existing = doc.data() as Record<string, unknown>;
        if (existing.companyId && existing.companyId !== ctx.companyId) {
          throw new ApiError(403, 'Access denied');
        }

        const body: UnitPatchPayload = await request.json();

        const updateData: Record<string, unknown> = {
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: ctx.uid,
        };

        if (body.name?.trim()) updateData.name = body.name.trim();
        if (body.type) updateData.type = body.type;
        if (body.status) updateData.status = body.status;
        if (body.floor !== undefined) updateData.floor = body.floor?.trim() || null;
        if (body.area !== undefined) updateData.area = typeof body.area === 'number' ? body.area : null;
        if (body.price !== undefined) updateData.price = typeof body.price === 'number' ? body.price : null;
        if (body.description !== undefined) updateData.description = body.description?.trim() || null;
        if (body.buildingId !== undefined) updateData.buildingId = body.buildingId ?? null;

        await docRef.update(updateData);

        logger.info('Unit updated', { id, companyId: ctx.companyId });

        await logAuditEvent(ctx, 'data_updated', 'unit', 'api', {
          newValue: { type: 'status', value: { unitId: id, updates: Object.keys(updateData) } },
          metadata: { reason: 'Unit updated via API' },
        });

        return apiSuccess<UnitMutationResult>({ id }, 'Unit updated');
      } catch (error) {
        if (error instanceof ApiError) throw error;
        logger.error('Error updating unit', { id, error: error instanceof Error ? error.message : String(error) });
        throw new ApiError(500, error instanceof Error ? error.message : 'Failed to update unit');
      }
    },
    { permissions: 'units:units:update' }
  )
);

// ============================================================================
// DELETE — Delete Unit
// ============================================================================

export const DELETE = withStandardRateLimit(
  withAuth<ApiSuccessResponse<UnitMutationResult>>(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      const adminDb = getAdminFirestore();
      if (!adminDb) throw new ApiError(503, 'Database unavailable');

      const id = extractIdFromUrl(request.url);
      if (!id) throw new ApiError(400, 'Unit ID is required');

      try {
        const docRef = adminDb.collection(COLLECTIONS.UNITS).doc(id);
        const doc = await docRef.get();

        if (!doc.exists) throw new ApiError(404, 'Unit not found');

        const existing = doc.data() as Record<string, unknown>;
        if (existing.companyId && existing.companyId !== ctx.companyId) {
          throw new ApiError(403, 'Access denied');
        }

        await docRef.delete();

        logger.info('Unit deleted', { id, companyId: ctx.companyId });

        await logAuditEvent(ctx, 'data_deleted', 'unit', 'api', {
          newValue: { type: 'status', value: { unitId: id, name: existing.name } },
          metadata: { reason: 'Unit deleted via API' },
        });

        return apiSuccess<UnitMutationResult>({ id }, 'Unit deleted');
      } catch (error) {
        if (error instanceof ApiError) throw error;
        logger.error('Error deleting unit', { id, error: error instanceof Error ? error.message : String(error) });
        throw new ApiError(500, error instanceof Error ? error.message : 'Failed to delete unit');
      }
    },
    { permissions: 'units:units:update' }
  )
);

// ============================================================================
// HELPERS
// ============================================================================

function extractIdFromUrl(url: string): string | null {
  const segments = new URL(url).pathname.split('/');
  return segments[segments.length - 1] || null;
}
