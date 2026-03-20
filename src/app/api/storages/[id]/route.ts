/**
 * Storage Unit PATCH / DELETE endpoint
 *
 * @module api/storages/[id]
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
import { executeDeletion } from '@/lib/firestore/deletion-guard';
import { linkEntity } from '@/lib/firestore/entity-linking.service';
import { propagateSpaceAllocationCodeChange } from '@/lib/firestore/cascade-propagation.service';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('StoragesIdRoute');

// ============================================================================
// TYPES
// ============================================================================

interface StoragePatchPayload {
  name?: string;
  type?: 'large' | 'small' | 'basement' | 'ground' | 'special' | 'storage' | 'parking' | 'garage' | 'warehouse';
  status?: 'available' | 'occupied' | 'maintenance' | 'reserved' | 'sold' | 'unavailable';
  floor?: string;
  /** Floor document ID (Firestore foreign key) */
  floorId?: string | null;
  area?: number;
  price?: number;
  description?: string;
  notes?: string;
  /** Set to null to unlink from building, or string to link */
  buildingId?: string | null;
}

interface StorageMutationResult {
  id: string;
}

// ============================================================================
// PATCH — Update Storage Unit
// ============================================================================

export const PATCH = withStandardRateLimit(
  withAuth<ApiSuccessResponse<StorageMutationResult>>(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      const adminDb = getAdminFirestore();
      if (!adminDb) throw new ApiError(503, 'Database unavailable');

      const id = extractIdFromUrl(request.url);
      if (!id) throw new ApiError(400, 'Storage ID is required');

      try {
        const docRef = adminDb.collection(COLLECTIONS.STORAGE).doc(id);
        const doc = await docRef.get();

        if (!doc.exists) throw new ApiError(404, 'Storage unit not found');

        const existing = doc.data() as Record<string, unknown>;
        if (ctx.globalRole !== 'super_admin' && existing.companyId && existing.companyId !== ctx.companyId) {
          throw new ApiError(403, 'Access denied');
        }

        const body: StoragePatchPayload = await request.json();

        const updateData: Record<string, unknown> = {
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: ctx.uid,
        };

        if (body.name?.trim()) updateData.name = body.name.trim();
        if (body.type) updateData.type = body.type;
        if (body.status) updateData.status = body.status;
        if (body.floor !== undefined) updateData.floor = body.floor?.trim() || null;
        if (body.floorId !== undefined) updateData.floorId = body.floorId || null;
        if (body.area !== undefined) updateData.area = typeof body.area === 'number' ? body.area : null;
        if (body.price !== undefined) updateData.price = typeof body.price === 'number' ? body.price : null;
        if (body.description !== undefined) updateData.description = body.description?.trim() || null;
        if (body.notes !== undefined) updateData.notes = body.notes?.trim() || null;
        if (body.buildingId !== undefined) updateData.buildingId = body.buildingId ?? null;

        await docRef.update(updateData);

        // 🔗 ADR-247 F-4: Cascade allocationCode to linkedSpaces on units
        if (body.name?.trim() && body.name.trim() !== (existing.name as string)) {
          propagateSpaceAllocationCodeChange(id, body.name.trim(), (existing.buildingId as string) ?? null)
            .catch((err) => logger.warn('allocationCode cascade failed (non-blocking)', {
              id, error: getErrorMessage(err),
            }));
        }

        // 🔗 ADR-239: Centralized linking — change detection + cascade + entity audit
        if (body.buildingId !== undefined) {
          linkEntity('storage:buildingId', {
            auth: ctx,
            entityId: id,
            newLinkValue: body.buildingId ?? null,
            existingDoc: existing,
            apiPath: '/api/storages/[id] (PATCH)',
          }).catch((err) => {
            logger.warn('linkEntity failed (non-blocking)', {
              id, error: getErrorMessage(err),
            });
          });
        }

        logger.info('Storage unit updated', { id, companyId: ctx.companyId });

        await logAuditEvent(ctx, 'data_updated', 'storage', 'api', {
          newValue: { type: 'status', value: { storageId: id, updates: Object.keys(updateData) } },
          metadata: { reason: 'Storage unit updated via API' },
        });

        return apiSuccess<StorageMutationResult>({ id }, 'Storage unit updated');
      } catch (error) {
        if (error instanceof ApiError) throw error;
        logger.error('Error updating storage', { id, error: getErrorMessage(error) });
        throw new ApiError(500, getErrorMessage(error, 'Failed to update storage unit'));
      }
    },
    { permissions: 'units:units:update' }
  )
);

// ============================================================================
// DELETE — Delete Storage Unit
// ============================================================================

export const DELETE = withStandardRateLimit(
  withAuth<ApiSuccessResponse<StorageMutationResult>>(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      const adminDb = getAdminFirestore();
      if (!adminDb) throw new ApiError(503, 'Database unavailable');

      const id = extractIdFromUrl(request.url);
      if (!id) throw new ApiError(400, 'Storage ID is required');

      try {
        const docRef = adminDb.collection(COLLECTIONS.STORAGE).doc(id);
        const doc = await docRef.get();

        if (!doc.exists) throw new ApiError(404, 'Storage unit not found');

        const existing = doc.data() as Record<string, unknown>;
        if (ctx.globalRole !== 'super_admin' && existing.companyId && existing.companyId !== ctx.companyId) {
          throw new ApiError(403, 'Access denied');
        }

        // 🛡️ ADR-226: Guarded deletion (checks dependencies + conditional block for sold storage)
        await executeDeletion(adminDb, 'storage', id, ctx.uid, ctx.companyId);

        logger.info('Storage unit deleted', { id, companyId: ctx.companyId });

        // Auth audit (dual audit — executeDeletion handles entity audit)
        await logAuditEvent(ctx, 'data_deleted', 'storage', 'api', {
          newValue: { type: 'status', value: { storageId: id, name: existing.name } },
          metadata: { reason: 'Storage unit deleted via API' },
        });

        return apiSuccess<StorageMutationResult>({ id }, 'Storage unit deleted');
      } catch (error) {
        if (error instanceof ApiError) throw error;
        logger.error('Error deleting storage', { id, error: getErrorMessage(error) });
        throw new ApiError(500, getErrorMessage(error, 'Failed to delete storage unit'));
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
