import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { withAuth, requireBuildingInTenant, logAuditEvent } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { ApiError } from '@/lib/api/ApiErrorHandler';
import { FieldValue } from 'firebase-admin/firestore';
import type { ConstructionPhase, ConstructionTask } from '@/types/building/construction';
import { createModuleLogger } from '@/lib/telemetry';
import { normalizeToISO } from '@/lib/date-local';
import {
  handleCreate,
  handleDelete,
  type ConstructionPhasesGetResponse,
  type ConstructionMutationResponse,
  type CreatePayload,
  type UpdatePayload,
} from './_helpers';

export const maxDuration = 60;

const logger = createModuleLogger('ConstructionPhasesRoute');

// ADR-217: firestoreTimestampToISO replaced by centralised normalizeToISO from @/lib/date-local

// =============================================================================
// GET — Load construction phases + tasks for a building
// =============================================================================

export async function GET(
  request: NextRequest,
  segmentData: { params: Promise<{ buildingId: string }> }
) {
  const { buildingId } = await segmentData.params;

  const handler = withStandardRateLimit(withAuth<ConstructionPhasesGetResponse>(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      const adminDb = getAdminFirestore();
      if (!adminDb) {
        return NextResponse.json({
          success: false, phases: [], tasks: [], buildingId,
        } as ConstructionPhasesGetResponse);
      }

      await requireBuildingInTenant({
        ctx,
        buildingId,
        path: `/api/buildings/${buildingId}/construction-phases`,
      });

      // Parallel fetch — phases + tasks simultaneously (Google pattern)
      const [phasesSnapshot, tasksSnapshot] = await Promise.all([
        adminDb
          .collection(COLLECTIONS.CONSTRUCTION_PHASES)
          .where(FIELDS.BUILDING_ID, '==', buildingId)
          .orderBy('order', 'asc')
          .get(),
        adminDb
          .collection(COLLECTIONS.CONSTRUCTION_TASKS)
          .where(FIELDS.BUILDING_ID, '==', buildingId)
          .orderBy('order', 'asc')
          .get(),
      ]);

      const phases: ConstructionPhase[] = phasesSnapshot.docs.map((doc) => {
        const data = doc.data() as Omit<ConstructionPhase, 'id'>;
        return {
          id: doc.id,
          buildingId: data.buildingId,
          companyId: data.companyId,
          name: data.name,
          code: data.code,
          order: data.order,
          status: data.status,
          plannedStartDate: data.plannedStartDate,
          plannedEndDate: data.plannedEndDate,
          actualStartDate: data.actualStartDate,
          actualEndDate: data.actualEndDate,
          progress: data.progress ?? 0,
          barColor: data.barColor,
          description: data.description,
          delayReason: data.delayReason ?? null,
          delayNote: data.delayNote ?? null,
          createdAt: normalizeToISO(data.createdAt) ?? undefined,
          updatedAt: normalizeToISO(data.updatedAt) ?? undefined,
          createdBy: data.createdBy,
          updatedBy: data.updatedBy,
        };
      });

      const tasks: ConstructionTask[] = tasksSnapshot.docs.map((doc) => {
        const data = doc.data() as Omit<ConstructionTask, 'id'>;
        return {
          id: doc.id,
          phaseId: data.phaseId,
          buildingId: data.buildingId,
          companyId: data.companyId,
          name: data.name,
          code: data.code,
          order: data.order,
          status: data.status,
          plannedStartDate: data.plannedStartDate,
          plannedEndDate: data.plannedEndDate,
          actualStartDate: data.actualStartDate,
          actualEndDate: data.actualEndDate,
          progress: data.progress ?? 0,
          dependencies: data.dependencies ?? [],
          barColor: data.barColor,
          description: data.description,
          delayReason: data.delayReason ?? null,
          delayNote: data.delayNote ?? null,
          createdAt: normalizeToISO(data.createdAt) ?? undefined,
          updatedAt: normalizeToISO(data.updatedAt) ?? undefined,
          createdBy: data.createdBy,
          updatedBy: data.updatedBy,
        };
      });

      logger.info('[Construction] Loaded phases and tasks for building', { phasesCount: phases.length, tasksCount: tasks.length, buildingId });

      return NextResponse.json({
        success: true, phases, tasks, buildingId,
      } as ConstructionPhasesGetResponse);
    },
    { permissions: 'buildings:buildings:view' }
  ));

  return handler(request);
}

// =============================================================================
// POST — Create a construction phase or task (delegated to _helpers)
// =============================================================================

export async function POST(
  request: NextRequest,
  segmentData: { params: Promise<{ buildingId: string }> }
) {
  const { buildingId } = await segmentData.params;

  const handler = withStandardRateLimit(withAuth(
    async (req: NextRequest, ctx: AuthContext) => {
      const body: CreatePayload = await req.json();
      return handleCreate(body, buildingId, ctx);
    },
    { permissions: 'buildings:buildings:update' }
  ));

  return handler(request);
}

// =============================================================================
// PATCH — Update a construction phase or task
// =============================================================================

export async function PATCH(
  request: NextRequest,
  segmentData: { params: Promise<{ buildingId: string }> }
) {
  const { buildingId } = await segmentData.params;

  const handler = withStandardRateLimit(withAuth(
    async (req: NextRequest, ctx: AuthContext) => {
      const adminDb = getAdminFirestore();
      if (!adminDb) throw new ApiError(503, 'Database unavailable');

      await requireBuildingInTenant({ ctx, buildingId, path: `/api/buildings/${buildingId}/construction-phases` });

      const body: UpdatePayload = await req.json();
      const { type, id, updates } = body;

      if (!id || !type) throw new ApiError(400, 'id and type are required');

      const collection = type === 'task' ? COLLECTIONS.CONSTRUCTION_TASKS : COLLECTIONS.CONSTRUCTION_PHASES;
      const docRef = adminDb.collection(collection).doc(id);
      const docSnap = await docRef.get();

      if (!docSnap.exists) throw new ApiError(404, `${type} not found`);
      if (docSnap.data()?.buildingId !== buildingId) throw new ApiError(403, 'Document does not belong to this building');

      const allowedFields = type === 'task'
        ? ['name', 'code', 'order', 'status', 'plannedStartDate', 'plannedEndDate', 'actualStartDate', 'actualEndDate', 'progress', 'dependencies', 'barColor', 'description', 'phaseId', 'delayReason', 'delayNote']
        : ['name', 'code', 'order', 'status', 'plannedStartDate', 'plannedEndDate', 'actualStartDate', 'actualEndDate', 'progress', 'barColor', 'description', 'delayReason', 'delayNote'];

      const cleanUpdates: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key) && value !== undefined) {
          cleanUpdates[key] = value;
        }
      }

      if (Object.keys(cleanUpdates).length === 0) throw new ApiError(400, 'No valid fields to update');

      cleanUpdates.updatedAt = FieldValue.serverTimestamp();
      cleanUpdates.updatedBy = ctx.uid;
      await docRef.update(cleanUpdates);

      logger.info('[Construction] Updated entity for building', { type, id, buildingId, fields: Object.keys(cleanUpdates) });

      await logAuditEvent(ctx, 'data_updated', buildingId, 'building', {
        newValue: { type: 'building_update', value: { id, fields: Object.keys(cleanUpdates), entityType: `construction_${type}` } },
        metadata: { reason: `Construction ${type} updated` },
      });

      return NextResponse.json({ success: true, id, type } as ConstructionMutationResponse);
    },
    { permissions: 'buildings:buildings:update' }
  ));

  return handler(request);
}

// =============================================================================
// DELETE — Delete a construction phase or task (delegated to _helpers)
// =============================================================================

export async function DELETE(
  request: NextRequest,
  segmentData: { params: Promise<{ buildingId: string }> }
) {
  const { buildingId } = await segmentData.params;

  const handler = withStandardRateLimit(withAuth(
    async (req: NextRequest, ctx: AuthContext) => {
      return handleDelete(req.url, buildingId, ctx);
    },
    { permissions: 'buildings:buildings:update' }
  ));

  return handler(request);
}
