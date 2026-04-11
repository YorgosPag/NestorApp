/**
 * =============================================================================
 * POST /api/buildings/[buildingId]/link-project — Atomic Orphan Fix
 * =============================================================================
 *
 * Assigns a `projectId` to an orphan Building (one that currently has no
 * project linkage). Scope-limited by design (ADR-284 §3.3):
 *   - Only mutates `building.projectId` (NOT other Building fields).
 *   - REJECTS if Building already has a non-empty `projectId` (use PATCH to
 *     reassign — cross-project moves are out of scope here).
 *   - Atomic transaction: verifies Project exists, Project has
 *     `linkedCompanyId`, Building exists + is orphan, then writes.
 *
 * Security boundary: server-side assertion is the only guarantee — UI flows
 * can be bypassed via devtools or direct API calls (ADR-284 §9.2).
 *
 * @module api/buildings/[buildingId]/link-project
 * @enterprise ADR-284 §3.3 Phase 3b — Inline fix modal for orphan Buildings
 * @permission buildings:buildings:update
 */

import { z } from 'zod';
import { NextRequest } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { withAuth, logAuditEvent } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import {
  ApiError,
  apiSuccess,
  type ApiSuccessResponse,
} from '@/lib/api/ApiErrorHandler';
import { isRoleBypass } from '@/lib/auth/roles';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { getErrorMessage } from '@/lib/error-utils';
import { linkEntity } from '@/lib/firestore/entity-linking.service';
import { EntityAuditService } from '@/services/entity-audit.service';
import { ENTITY_TYPES } from '@/config/domain-constants';

const logger = createModuleLogger('BuildingLinkProjectRoute');

// ============================================================================
// SCHEMA
// ============================================================================

const LinkProjectBodySchema = z.object({
  projectId: z.string().trim().min(1).max(128),
});

interface LinkProjectResponse {
  buildingId: string;
  projectId: string;
  linked: true;
}

// ============================================================================
// HANDLER
// ============================================================================

function isBlank(value: unknown): boolean {
  return typeof value !== 'string' || value.trim().length === 0;
}

export async function POST(
  request: NextRequest,
  segmentData: { params: Promise<{ buildingId: string }> },
) {
  const { buildingId } = await segmentData.params;

  const handler = withStandardRateLimit(
    withAuth<ApiSuccessResponse<LinkProjectResponse>>(
      async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
        if (isBlank(buildingId)) {
          throw new ApiError(400, 'Building ID is required');
        }

        const adminDb = getAdminFirestore();
        if (!adminDb) {
          logger.error('Firebase Admin not initialized');
          throw new ApiError(503, 'Database unavailable');
        }

        const parsed = safeParseBody(LinkProjectBodySchema, await req.json());
        if (parsed.error) {
          throw new ApiError(400, 'Validation failed: projectId is required');
        }
        const { projectId } = parsed.data;

        const buildingRef = adminDb
          .collection(COLLECTIONS.BUILDINGS)
          .doc(buildingId);
        const projectRef = adminDb
          .collection(COLLECTIONS.PROJECTS)
          .doc(projectId);

        let existingBuildingData: Record<string, unknown> = {};

        try {
          await adminDb.runTransaction(async (tx) => {
            // Step 1: Verify Project exists + has linkedCompanyId (5-level chain)
            const projectSnap = await tx.get(projectRef);
            if (!projectSnap.exists) {
              throw new ApiError(400, 'Referenced Project not found.');
            }
            const linkedCompanyId = projectSnap.data()?.linkedCompanyId;
            if (isBlank(linkedCompanyId)) {
              throw new ApiError(
                400,
                'Referenced Project is orphan (no linkedCompanyId). Fix Project first.',
              );
            }

            // Step 2: Verify Building exists + is currently orphan
            const buildingSnap = await tx.get(buildingRef);
            if (!buildingSnap.exists) {
              throw new ApiError(404, 'Building not found');
            }
            const buildingData = buildingSnap.data() ?? {};
            existingBuildingData = buildingData;

            // 🔒 TENANT ISOLATION (unless super_admin)
            const isSuperAdmin = isRoleBypass(ctx.globalRole);
            if (!isSuperAdmin && buildingData.companyId !== ctx.companyId) {
              logger.warn('Unauthorized link attempt', {
                email: ctx.email,
                buildingId,
              });
              throw new ApiError(
                403,
                'Unauthorized: Building belongs to different company',
              );
            }

            // Scope guard: only assign to orphans; reject cross-project moves
            if (!isBlank(buildingData.projectId)) {
              throw new ApiError(
                409,
                'Building already linked to a project. Use full edit to reassign.',
              );
            }

            // Step 3: Atomic write
            tx.update(buildingRef, {
              projectId,
              updatedAt: new Date(),
              updatedBy: ctx.uid,
            });
          });
        } catch (error) {
          if (error instanceof ApiError) throw error;
          logger.error('link-project transaction failed', {
            buildingId,
            projectId,
            error: getErrorMessage(error),
          });
          throw new ApiError(
            500,
            getErrorMessage(error, 'Failed to link Building to Project'),
          );
        }

        // Per-entity audit trail (feeds the building "Ιστορικό" tab via ADR-195).
        // Fire-and-forget — recordChange never throws, logs internally on failure.
        await EntityAuditService.recordChange({
          entityType: ENTITY_TYPES.BUILDING,
          entityId: buildingId,
          entityName: (existingBuildingData.name as string | undefined) ?? null,
          action: 'updated',
          changes: [
            {
              field: 'projectId',
              oldValue: null,
              newValue: projectId,
              label: 'Έργο',
            },
          ],
          performedBy: ctx.uid,
          performedByName: ctx.email ?? null,
          companyId:
            (existingBuildingData.companyId as string | undefined) ??
            ctx.companyId,
        });

        // Step 4: Cascade + audit via centralized linking pipeline (fire-and-forget)
        linkEntity('building:projectId', {
          auth: ctx,
          entityId: buildingId,
          newLinkValue: projectId,
          existingDoc: existingBuildingData,
          apiPath: `/api/buildings/${buildingId}/link-project (POST)`,
        }).catch((err) => {
          logger.warn('linkEntity cascade failed (non-blocking)', {
            buildingId,
            projectId,
            error: getErrorMessage(err),
          });
        });

        // Auth audit (mirrors PATCH handler pattern)
        await logAuditEvent(ctx, 'data_updated', 'buildings', 'api', {
          newValue: {
            type: 'building_update',
            value: { buildingId, projectId, fields: ['projectId'] },
          },
          metadata: {
            reason: 'Orphan Building linked to Project (ADR-284 Phase 3b)',
          },
        });

        logger.info('Building linked to Project', {
          buildingId,
          projectId,
          email: ctx.email,
        });

        return apiSuccess<LinkProjectResponse>(
          { buildingId, projectId, linked: true },
          'Building linked to Project successfully',
        );
      },
      { permissions: 'buildings:buildings:update' },
    ),
  );

  return handler(request);
}
