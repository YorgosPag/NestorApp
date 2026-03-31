import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { withAuth, requireBuildingInTenant } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import type { BuildingMilestone } from '@/types/building/milestone';
import { createModuleLogger } from '@/lib/telemetry';
import { normalizeToISO } from '@/lib/date-local';
import { getErrorMessage } from '@/lib/error-utils';
import {
  handleCreate,
  handleUpdate,
  handleDelete,
  type CreateMilestonePayload,
  type UpdateMilestonePayload,
  type MilestoneMutationResponse,
} from './_helpers';

export const maxDuration = 60;

const logger = createModuleLogger('MilestonesRoute');

// ─── Response Types ──────────────────────────────────────────────────────

interface MilestonesGetResponse {
  success: boolean;
  milestones: BuildingMilestone[];
  buildingId: string;
}

// =============================================================================
// GET — Load milestones for a building
// =============================================================================

export async function GET(
  request: NextRequest,
  segmentData: { params: Promise<{ buildingId: string }> }
) {
  const { buildingId } = await segmentData.params;

  const handler = withStandardRateLimit(withAuth<MilestonesGetResponse>(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      const adminDb = getAdminFirestore();
      if (!adminDb) {
        return NextResponse.json({
          success: false, milestones: [], buildingId,
        } as MilestonesGetResponse);
      }

      await requireBuildingInTenant({
        ctx,
        buildingId,
        path: `/api/buildings/${buildingId}/milestones`,
      });

      let snapshot: Awaited<ReturnType<ReturnType<typeof adminDb.collection>['get']>>;
      try {
        snapshot = await adminDb
          .collection(COLLECTIONS.BUILDING_MILESTONES)
          .where(FIELDS.BUILDING_ID, '==', buildingId)
          .orderBy('order', 'asc')
          .get();
      } catch (firestoreError) {
        const errMsg = getErrorMessage(firestoreError);

        if (errMsg.includes('FAILED_PRECONDITION') || errMsg.includes('index')) {
          logger.warn('[Milestones] Composite index not ready, returning empty', { buildingId });
          return NextResponse.json({
            success: true, milestones: [], buildingId,
          } as MilestonesGetResponse);
        }

        logger.error('[Milestones] Firestore query failed', { buildingId, error: errMsg });
        throw new Error(`Database query failed: ${errMsg}`);
      }

      const milestones: BuildingMilestone[] = snapshot.docs.map((doc) => {
        const data = doc.data() as Omit<BuildingMilestone, 'id'>;
        return {
          id: doc.id,
          buildingId: data.buildingId,
          companyId: data.companyId,
          title: data.title,
          description: data.description ?? '',
          date: data.date,
          status: data.status,
          progress: data.progress ?? 0,
          type: data.type,
          order: data.order,
          code: data.code,
          phaseId: data.phaseId,
          createdAt: normalizeToISO(data.createdAt) ?? undefined,
          updatedAt: normalizeToISO(data.updatedAt) ?? undefined,
          createdBy: data.createdBy,
          updatedBy: data.updatedBy,
        };
      });

      logger.info('[Milestones] Loaded milestones', { count: milestones.length, buildingId });

      return NextResponse.json({
        success: true, milestones, buildingId,
      } as MilestonesGetResponse);
    },
    { permissions: 'buildings:buildings:view' }
  ));

  return handler(request);
}

// =============================================================================
// POST — Create a milestone (delegated to _helpers)
// =============================================================================

export async function POST(
  request: NextRequest,
  segmentData: { params: Promise<{ buildingId: string }> }
) {
  const { buildingId } = await segmentData.params;

  const handler = withStandardRateLimit(withAuth<MilestoneMutationResponse>(
    async (req: NextRequest, ctx: AuthContext) => {
      const body: CreateMilestonePayload = await req.json();
      return handleCreate(body, buildingId, ctx);
    },
    { permissions: 'buildings:buildings:update' }
  ));

  return handler(request);
}

// =============================================================================
// PATCH — Update a milestone (delegated to _helpers)
// =============================================================================

export async function PATCH(
  request: NextRequest,
  segmentData: { params: Promise<{ buildingId: string }> }
) {
  const { buildingId } = await segmentData.params;

  const handler = withStandardRateLimit(withAuth<MilestoneMutationResponse>(
    async (req: NextRequest, ctx: AuthContext) => {
      const body: UpdateMilestonePayload = await req.json();
      return handleUpdate(body, buildingId, ctx);
    },
    { permissions: 'buildings:buildings:update' }
  ));

  return handler(request);
}

// =============================================================================
// DELETE — Delete a milestone (delegated to _helpers)
// =============================================================================

export async function DELETE(
  request: NextRequest,
  segmentData: { params: Promise<{ buildingId: string }> }
) {
  const { buildingId } = await segmentData.params;

  const handler = withStandardRateLimit(withAuth<MilestoneMutationResponse>(
    async (req: NextRequest, ctx: AuthContext) => {
      return handleDelete(req.url, buildingId, ctx);
    },
    { permissions: 'buildings:buildings:update' }
  ));

  return handler(request);
}
