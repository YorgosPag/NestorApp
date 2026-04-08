/**
 * Storage Unit PATCH / DELETE endpoint
 *
 * @module api/storages/[id]
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
import { extractIdFromUrl } from '@/lib/api/route-helpers';
import { createModuleLogger } from '@/lib/telemetry';
import { softDelete } from '@/lib/firestore/soft-delete-engine';
import { linkEntity } from '@/lib/firestore/entity-linking.service';
import { propagateSpaceAllocationCodeChange } from '@/lib/firestore/cascade-propagation.service';
import { getErrorMessage } from '@/lib/error-utils';
import { requireStorageInTenant } from '@/lib/auth/tenant-isolation';
import { withVersionCheck, ConflictError } from '@/lib/firestore/version-check';
import { safeParseBody } from '@/lib/validation/shared-schemas';

const UpdateStorageSchema = z.object({
  name: z.string().max(200).optional(),
  /** ADR-233: Entity coding system identifier */
  code: z.string().max(50).nullable().optional(),
  type: z.string().max(50).optional(),
  status: z.string().max(50).optional(),
  floor: z.union([z.string().max(50), z.number()]).nullable().optional(),
  floorId: z.string().max(128).nullable().optional(),
  area: z.number().min(0).max(999_999).nullable().optional(),
  price: z.number().min(0).max(999_999_999).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  buildingId: z.string().max(128).nullable().optional(),
  _v: z.number().int().optional(),
}).passthrough();

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
  _v?: number;
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
        // 🔒 ADR: Centralized tenant isolation (existence + companyId + audit logging)
        await requireStorageInTenant({ ctx, storageId: id, path: '/api/storages/[id]' });

        const docRef = adminDb.collection(COLLECTIONS.STORAGE).doc(id);
        const doc = await docRef.get();
        const existing = doc.data() as Record<string, unknown>;

        const parsed = safeParseBody(UpdateStorageSchema, await request.json());
        if (parsed.error) throw new ApiError(400, 'Validation failed');
        const { _v: expectedVersion, ...body } = parsed.data;

        // SPEC-256A: updatedAt + updatedBy injected by withVersionCheck
        const updateData: Record<string, unknown> = {};

        if (body.name?.trim()) updateData.name = body.name.trim();
        if (body.code !== undefined) updateData.code = body.code?.trim() || null;
        if (body.type) updateData.type = body.type;
        if (body.status) updateData.status = body.status;
        if (body.floor !== undefined) updateData.floor = typeof body.floor === 'string' ? body.floor.trim() || null : body.floor ?? null;
        if (body.floorId !== undefined) updateData.floorId = body.floorId || null;
        if (body.area !== undefined) updateData.area = typeof body.area === 'number' ? body.area : null;
        if (body.price !== undefined) updateData.price = typeof body.price === 'number' ? body.price : null;
        if (body.description !== undefined) updateData.description = body.description?.trim() || null;
        if (body.notes !== undefined) updateData.notes = body.notes?.trim() || null;
        if (body.buildingId !== undefined) updateData.buildingId = body.buildingId ?? null;

        // SPEC-256A: Version-checked write
        const versionResult = await withVersionCheck({
          db: adminDb,
          collection: COLLECTIONS.STORAGE,
          docId: id,
          expectedVersion,
          updates: updateData,
          userId: ctx.uid,
        });

        // 🔗 ADR-247 F-4: Cascade allocationCode to linkedSpaces on units
        // ADR-233: Prefer code field; fall back to name for legacy
        const newDisplayCode = body.code?.trim() || body.name?.trim();
        const oldDisplayCode = (existing.code as string) || (existing.name as string);
        if (newDisplayCode && newDisplayCode !== oldDisplayCode) {
          propagateSpaceAllocationCodeChange(id, newDisplayCode, (existing.buildingId as string) ?? null)
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

        return apiSuccess<StorageMutationResult>({ id, _v: versionResult.newVersion }, 'Storage unit updated');
      } catch (error) {
        if (error instanceof ConflictError) {
          return NextResponse.json(error.body, { status: error.statusCode });
        }
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
        // 🔒 ADR: Centralized tenant isolation (existence + companyId + audit logging)
        await requireStorageInTenant({ ctx, storageId: id, path: '/api/storages/[id]' });

        const docRef = adminDb.collection(COLLECTIONS.STORAGE).doc(id);
        const existing = (await docRef.get()).data() as Record<string, unknown>;

        // 🗑️ ADR-281: Soft-delete — move to trash (status='deleted')
        await softDelete(adminDb, 'storage', id, ctx.uid, ctx.companyId, ctx.email ?? undefined);

        logger.info('Storage unit moved to trash', { id, companyId: ctx.companyId });

        // Auth audit (soft-delete engine handles entity audit)
        await logAuditEvent(ctx, 'soft_deleted', 'storage', 'api', {
          newValue: { type: 'status', value: { storageId: id, name: existing.name } },
          metadata: { reason: 'Storage unit moved to trash via API' },
        });

        return apiSuccess<StorageMutationResult>({ id }, 'Storage unit moved to trash');
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
// GET — Fetch Single Storage Unit
// ============================================================================

export const GET = withStandardRateLimit(
  withAuth<ApiSuccessResponse<Record<string, unknown>>>(
    async (request: NextRequest, ctx: AuthContext) => {
      const adminDb = getAdminFirestore();
      if (!adminDb) throw new ApiError(503, 'Database unavailable');

      const id = extractIdFromUrl(request.url);
      if (!id) throw new ApiError(400, 'Storage ID is required');

      // 🔒 ADR: Centralized tenant isolation
      await requireStorageInTenant({ ctx, storageId: id, path: '/api/storages/[id]' });

      const docRef = adminDb.collection(COLLECTIONS.STORAGE).doc(id);
      const doc = await docRef.get();

      if (!doc.exists) throw new ApiError(404, 'Storage unit not found');

      return apiSuccess({ id: doc.id, ...doc.data() }, 'Storage unit loaded');
    },
    { permissions: 'units:units:view' }
  )
);

// Helper: extractIdFromUrl → centralized in @/lib/api/route-helpers
