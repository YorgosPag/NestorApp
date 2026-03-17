import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { withAuth, requireBuildingInTenant, logAuditEvent } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { ApiError } from '@/lib/api/ApiErrorHandler';
import { FieldValue } from 'firebase-admin/firestore';
import type { BuildingMilestone } from '@/types/building/milestone';
import { createModuleLogger } from '@/lib/telemetry';
import { normalizeToISO } from '@/lib/date-local';

const logger = createModuleLogger('MilestonesRoute');

// ─── Response Types ──────────────────────────────────────────────────────

interface MilestonesGetResponse {
  success: boolean;
  milestones: BuildingMilestone[];
  buildingId: string;
}

interface MilestoneMutationResponse {
  success: boolean;
  id: string;
}

// ADR-217: firestoreTimestampToISO replaced by centralized normalizeToISO from @/lib/date-local

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

      const snapshot = await adminDb
        .collection(COLLECTIONS.BUILDING_MILESTONES)
        .where('buildingId', '==', buildingId)
        .orderBy('order', 'asc')
        .get();

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

      logger.info('[Milestones] Loaded milestones for building', {
        count: milestones.length,
        buildingId,
      });

      return NextResponse.json({
        success: true,
        milestones,
        buildingId,
      } as MilestonesGetResponse);
    },
    { permissions: 'buildings:buildings:view' }
  ));

  return handler(request);
}

// =============================================================================
// POST — Create a milestone
// =============================================================================

interface CreateMilestonePayload {
  title: string;
  description?: string;
  date: string;
  status?: string;
  progress?: number;
  type: string;
  order?: number;
  code?: string;
  phaseId?: string;
}

export async function POST(
  request: NextRequest,
  segmentData: { params: Promise<{ buildingId: string }> }
) {
  const { buildingId } = await segmentData.params;

  const handler = withStandardRateLimit(withAuth<MilestoneMutationResponse>(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      const adminDb = getAdminFirestore();
      if (!adminDb) {
        throw new ApiError(503, 'Database unavailable');
      }

      await requireBuildingInTenant({
        ctx,
        buildingId,
        path: `/api/buildings/${buildingId}/milestones`,
      });

      const body: CreateMilestonePayload = await req.json();
      const { title, date, type } = body;

      if (!title || !date || !type) {
        throw new ApiError(400, 'title, date, and type are required');
      }

      // Auto-generate code if not provided
      const existingCount = await adminDb
        .collection(COLLECTIONS.BUILDING_MILESTONES)
        .where('buildingId', '==', buildingId)
        .count()
        .get();

      const nextNumber = (existingCount.data().count ?? 0) + 1;
      const code = body.code || `MS-${String(nextNumber).padStart(3, '0')}`;

      const docData: Record<string, unknown> = {
        buildingId,
        companyId: ctx.companyId,
        title,
        description: body.description ?? '',
        date,
        status: body.status ?? 'pending',
        progress: body.progress ?? 0,
        type,
        order: body.order ?? nextNumber,
        code,
        ...(body.phaseId ? { phaseId: body.phaseId } : {}),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        createdBy: ctx.uid,
      };

      // 🏢 ENTERPRISE: setDoc + enterprise ID (SOS N.6)
      const { generateMilestoneId } = await import('@/services/enterprise-id.service');
      const enterpriseId = generateMilestoneId();
      await adminDb.collection(COLLECTIONS.BUILDING_MILESTONES).doc(enterpriseId).set(docData);

      logger.info('[Milestones] Created milestone for building', {
        id: enterpriseId,
        code,
        buildingId,
      });

      await logAuditEvent(ctx, 'data_created', buildingId, 'building', {
        newValue: {
          type: 'building_update',
          value: { id: enterpriseId, code, title, entityType: 'milestone' },
        },
        metadata: { reason: 'Building milestone created' },
      });

      return NextResponse.json({
        success: true,
        id: docRef.id,
      } as MilestoneMutationResponse);
    },
    { permissions: 'buildings:buildings:update' }
  ));

  return handler(request);
}

// =============================================================================
// PATCH — Update a milestone
// =============================================================================

interface UpdateMilestonePayload {
  id: string;
  updates: Record<string, unknown>;
}

export async function PATCH(
  request: NextRequest,
  segmentData: { params: Promise<{ buildingId: string }> }
) {
  const { buildingId } = await segmentData.params;

  const handler = withStandardRateLimit(withAuth<MilestoneMutationResponse>(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      const adminDb = getAdminFirestore();
      if (!adminDb) {
        throw new ApiError(503, 'Database unavailable');
      }

      await requireBuildingInTenant({
        ctx,
        buildingId,
        path: `/api/buildings/${buildingId}/milestones`,
      });

      const body: UpdateMilestonePayload = await req.json();
      const { id, updates } = body;

      if (!id) {
        throw new ApiError(400, 'id is required');
      }

      const docRef = adminDb.collection(COLLECTIONS.BUILDING_MILESTONES).doc(id);
      const docSnap = await docRef.get();

      if (!docSnap.exists) {
        throw new ApiError(404, 'Milestone not found');
      }

      const existingData = docSnap.data();
      if (existingData?.buildingId !== buildingId) {
        throw new ApiError(403, 'Milestone does not belong to this building');
      }

      const allowedFields = [
        'title', 'description', 'date', 'status', 'progress',
        'type', 'order', 'phaseId',
      ];

      const cleanUpdates: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key) && value !== undefined) {
          cleanUpdates[key] = value;
        }
      }

      if (Object.keys(cleanUpdates).length === 0) {
        throw new ApiError(400, 'No valid fields to update');
      }

      cleanUpdates.updatedAt = FieldValue.serverTimestamp();
      cleanUpdates.updatedBy = ctx.uid;

      await docRef.update(cleanUpdates);

      logger.info('[Milestones] Updated milestone for building', {
        id,
        buildingId,
        fields: Object.keys(cleanUpdates),
      });

      await logAuditEvent(ctx, 'data_updated', buildingId, 'building', {
        newValue: {
          type: 'building_update',
          value: { id, fields: Object.keys(cleanUpdates), entityType: 'milestone' },
        },
        metadata: { reason: 'Building milestone updated' },
      });

      return NextResponse.json({
        success: true,
        id,
      } as MilestoneMutationResponse);
    },
    { permissions: 'buildings:buildings:update' }
  ));

  return handler(request);
}

// =============================================================================
// DELETE — Delete a milestone
// =============================================================================

export async function DELETE(
  request: NextRequest,
  segmentData: { params: Promise<{ buildingId: string }> }
) {
  const { buildingId } = await segmentData.params;

  const handler = withStandardRateLimit(withAuth<MilestoneMutationResponse>(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      const adminDb = getAdminFirestore();
      if (!adminDb) {
        throw new ApiError(503, 'Database unavailable');
      }

      await requireBuildingInTenant({
        ctx,
        buildingId,
        path: `/api/buildings/${buildingId}/milestones`,
      });

      const { searchParams } = new URL(req.url);
      const id = searchParams.get('id');

      if (!id) {
        throw new ApiError(400, 'id query param is required');
      }

      const docRef = adminDb.collection(COLLECTIONS.BUILDING_MILESTONES).doc(id);
      const docSnap = await docRef.get();

      if (!docSnap.exists) {
        throw new ApiError(404, 'Milestone not found');
      }

      const existingData = docSnap.data();
      if (existingData?.buildingId !== buildingId) {
        throw new ApiError(403, 'Milestone does not belong to this building');
      }

      await docRef.delete();

      logger.info('[Milestones] Deleted milestone from building', { id, buildingId });

      await logAuditEvent(ctx, 'data_deleted', buildingId, 'building', {
        newValue: {
          type: 'building_update',
          value: { id, entityType: 'milestone' },
        },
        metadata: { reason: 'Building milestone deleted' },
      });

      return NextResponse.json({
        success: true,
        id,
      } as MilestoneMutationResponse);
    },
    { permissions: 'buildings:buildings:update' }
  ));

  return handler(request);
}
