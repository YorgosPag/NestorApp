/**
 * PATCH /api/buildings — Update building via Admin SDK
 *
 * Extracted from route.ts for SRP (ADR-281 Batch 3).
 *
 * @module api/buildings/building-update.handler
 * @permission buildings:buildings:update
 * @rateLimit STANDARD (60 req/min)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { normalizeProjectIdForQuery } from '@/utils/firestore-helpers';
import { withAuth, logAuditEvent } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { isRoleBypass } from '@/lib/auth/roles';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { linkEntity } from '@/lib/firestore/entity-linking.service';
import { getErrorMessage } from '@/lib/error-utils';
import { withVersionCheck, ConflictError } from '@/lib/firestore/version-check';
import { POLICY_ERROR_CODES } from '@/lib/policy';

const logger = createModuleLogger('BuildingUpdate');

// ============================================================================
// TYPES
// ============================================================================

interface BuildingUpdatePayload {
  /** ADR-233 §3.4: locked building identifier (e.g. "Κτήριο Α") */
  code?: string;
  name?: string;
  description?: string;
  address?: string;
  city?: string;
  totalArea?: number;
  builtArea?: number;
  floors?: number;
  units?: number;
  totalValue?: number;
  startDate?: string;
  completionDate?: string;
  status?: string;
  projectId?: string | null;
  linkedCompanyId?: string | null;
  linkedCompanyName?: string | null;
  company?: string | null;
  addresses?: Record<string, unknown>[];
  category?: string;
}

interface BuildingUpdateResponse {
  buildingId: string;
  updated: boolean;
  _v?: number;
}

// ============================================================================
// PATCH — Update Building
// ============================================================================

export const PATCH = withStandardRateLimit(
  withAuth<ApiSuccessResponse<BuildingUpdateResponse>>(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
    const adminDb = getAdminFirestore();
    if (!adminDb) {
      logger.error('Firebase Admin not initialized');
      throw new ApiError(503, 'Database unavailable');
    }

    try {
      const body = await request.json();
      const { buildingId, _v: expectedVersion, ...updates } = body as { buildingId: string; _v?: number } & BuildingUpdatePayload;

      if (!buildingId) {
        throw new ApiError(400, 'Building ID is required');
      }

      const buildingDoc = await adminDb.collection(COLLECTIONS.BUILDINGS).doc(buildingId).get();

      if (!buildingDoc.exists) {
        throw new ApiError(404, 'Building not found');
      }

      const buildingData = buildingDoc.data();
      const isSuperAdmin = isRoleBypass(ctx.globalRole);

      if (!isSuperAdmin && buildingData?.companyId !== ctx.companyId) {
        logger.warn('[Buildings] Unauthorized update attempt', { email: ctx.email, buildingId });
        throw new ApiError(403, 'Unauthorized: Building belongs to different company');
      }

      const IMMUTABLE_FIELDS = ['companyId'];
      const cleanUpdates = Object.fromEntries(
        Object.entries(updates).filter(([key, value]) =>
          value !== undefined && !IMMUTABLE_FIELDS.includes(key)
        )
      );

      // 🔐 ADR-233 §3.4: Uniqueness validation when `code` changes within projectId scope
      if (typeof cleanUpdates.code === 'string' && cleanUpdates.code !== buildingData?.code) {
        const effectiveProjectId = (cleanUpdates.projectId ?? buildingData?.projectId) as string | null | undefined;
        if (effectiveProjectId) {
          const duplicateSnap = await adminDb.collection(COLLECTIONS.BUILDINGS)
            .where(FIELDS.PROJECT_ID, '==', normalizeProjectIdForQuery(String(effectiveProjectId)))
            .where('code', '==', cleanUpdates.code)
            .limit(2)
            .get();
          const conflict = duplicateSnap.docs.find(d => d.id !== buildingId);
          if (conflict) {
            logger.warn('[Buildings] Duplicate code on update', { code: cleanUpdates.code, projectId: effectiveProjectId, conflictId: conflict.id });
            throw new ApiError(409, `Building code "${cleanUpdates.code}" already exists in this project`, POLICY_ERROR_CODES.DUPLICATE_CODE);
          }
        }
      }

      logger.info('[Buildings] Updating building for tenant', { buildingId, companyId: ctx.companyId });

      const versionResult = await withVersionCheck({
        db: adminDb,
        collection: COLLECTIONS.BUILDINGS,
        docId: buildingId,
        expectedVersion,
        updates: cleanUpdates,
        userId: ctx.uid,
      });

      logger.info('[Buildings] Building updated', { buildingId, email: ctx.email, _v: versionResult.newVersion });

      // ADR-029 Phase D: search_documents written by Cloud Function onBuildingWrite.

      if ('projectId' in cleanUpdates) {
        linkEntity('building:projectId', {
          auth: ctx,
          entityId: buildingId,
          newLinkValue: (cleanUpdates.projectId as string) ?? null,
          existingDoc: (buildingData ?? {}) as Record<string, unknown>,
          apiPath: '/api/buildings (PATCH)',
        }).catch((err) => {
          logger.warn('[Buildings] linkEntity failed (non-blocking)', {
            buildingId,
            error: getErrorMessage(err),
          });
        });
      }

      await logAuditEvent(ctx, 'data_updated', 'buildings', 'api', {
        newValue: {
          type: 'building_update',
          value: {
            buildingId,
            fields: Object.keys(cleanUpdates),
          },
        },
        metadata: { reason: 'Building updated' },
      });

      return apiSuccess<BuildingUpdateResponse>(
        { buildingId, updated: true, _v: versionResult.newVersion },
        'Building updated successfully'
      );

    } catch (error) {
      if (error instanceof ConflictError) {
        return NextResponse.json(error.body, { status: error.statusCode });
      }
      logger.error('[Buildings] Error updating building', { error });
      throw new ApiError(500, getErrorMessage(error, 'Failed to update building'));
    }
    },
    { permissions: 'buildings:buildings:update' }
  )
);
