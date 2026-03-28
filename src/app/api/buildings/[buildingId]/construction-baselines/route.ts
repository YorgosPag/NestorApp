/**
 * Construction Baselines API — List, Create, Delete (ADR-266 Phase C, Sub-phase 3)
 *
 * Baseline Snapshots: frozen copies of the schedule at a point in time,
 * enabling Baseline vs Actual comparison (Primavera P6 / MS Project pattern).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { withAuth, requireBuildingInTenant, logAuditEvent } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { ApiError } from '@/lib/api/ApiErrorHandler';
import { FieldValue } from 'firebase-admin/firestore';
import { createModuleLogger } from '@/lib/telemetry';
import { normalizeToISO } from '@/lib/date-local';
import { generateConstructionBaselineId } from '@/services/enterprise-id.service';
import type {
  ConstructionPhase,
  ConstructionTask,
  ConstructionBaselineSummary,
  ConstructionBaselineCreatePayload,
} from '@/types/building/construction';

const logger = createModuleLogger('ConstructionBaselinesRoute');

/** Max baselines per building (server-enforced) */
const MAX_BASELINES_PER_BUILDING = 10;

// ─── Response Types ─────────────────────────────────────────────────────

interface BaselinesListResponse {
  success: boolean;
  baselines: ConstructionBaselineSummary[];
  buildingId: string;
}

interface BaselineMutationResponse {
  success: boolean;
  baselineId?: string;
  error?: string;
}

// =============================================================================
// GET — List baseline summaries for a building (no embedded phases/tasks)
// =============================================================================

export async function GET(
  request: NextRequest,
  segmentData: { params: Promise<{ buildingId: string }> }
) {
  const { buildingId } = await segmentData.params;

  const handler = withStandardRateLimit(withAuth<BaselinesListResponse>(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      const adminDb = getAdminFirestore();
      if (!adminDb) {
        return NextResponse.json({ success: false, baselines: [], buildingId } satisfies BaselinesListResponse);
      }

      await requireBuildingInTenant({ ctx, buildingId, path: `/api/buildings/${buildingId}/construction-baselines` });

      const snapshot = await adminDb
        .collection(COLLECTIONS.CONSTRUCTION_BASELINES)
        .where(FIELDS.BUILDING_ID, '==', buildingId)
        .orderBy('version', 'desc')
        .get();

      const baselines: ConstructionBaselineSummary[] = snapshot.docs.map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          name: d.name ?? '',
          version: d.version ?? 1,
          createdAt: normalizeToISO(d.createdAt) ?? new Date().toISOString(),
          phaseCount: Array.isArray(d.phases) ? d.phases.length : 0,
          taskCount: Array.isArray(d.tasks) ? d.tasks.length : 0,
        };
      });

      logger.info('[Baselines] Listed baselines', { count: baselines.length, buildingId });
      return NextResponse.json({ success: true, baselines, buildingId } satisfies BaselinesListResponse);
    },
    { permissions: 'buildings:buildings:view' }
  ));

  return handler(request);
}

// =============================================================================
// POST — Create a new baseline snapshot (captures current phases + tasks)
// =============================================================================

export async function POST(
  request: NextRequest,
  segmentData: { params: Promise<{ buildingId: string }> }
) {
  const { buildingId } = await segmentData.params;

  const handler = withStandardRateLimit(withAuth<BaselineMutationResponse>(
    async (req: NextRequest, ctx: AuthContext) => {
      const adminDb = getAdminFirestore();
      if (!adminDb) throw new ApiError(503, 'Database unavailable');

      await requireBuildingInTenant({ ctx, buildingId, path: `/api/buildings/${buildingId}/construction-baselines` });

      const body: ConstructionBaselineCreatePayload = await req.json();
      if (!body.name?.trim()) throw new ApiError(400, 'Baseline name is required');

      // Enforce max baselines per building
      const countResult = await adminDb
        .collection(COLLECTIONS.CONSTRUCTION_BASELINES)
        .where(FIELDS.BUILDING_ID, '==', buildingId)
        .count()
        .get();

      const existingCount = countResult.data().count ?? 0;
      if (existingCount >= MAX_BASELINES_PER_BUILDING) {
        throw new ApiError(400, `Maximum ${MAX_BASELINES_PER_BUILDING} baselines per building. Delete an old baseline first.`);
      }

      // Auto-increment version
      const latestSnap = await adminDb
        .collection(COLLECTIONS.CONSTRUCTION_BASELINES)
        .where(FIELDS.BUILDING_ID, '==', buildingId)
        .orderBy('version', 'desc')
        .limit(1)
        .get();

      const nextVersion = latestSnap.empty ? 1 : ((latestSnap.docs[0].data().version as number) + 1);

      // Fetch current phases + tasks
      const [phasesSnap, tasksSnap] = await Promise.all([
        adminDb.collection(COLLECTIONS.CONSTRUCTION_PHASES).where(FIELDS.BUILDING_ID, '==', buildingId).orderBy('order', 'asc').get(),
        adminDb.collection(COLLECTIONS.CONSTRUCTION_TASKS).where(FIELDS.BUILDING_ID, '==', buildingId).orderBy('order', 'asc').get(),
      ]);

      const phases: ConstructionPhase[] = phasesSnap.docs.map((doc) => {
        const d = doc.data() as Omit<ConstructionPhase, 'id'>;
        return {
          id: doc.id, buildingId: d.buildingId, companyId: d.companyId,
          name: d.name, code: d.code, order: d.order, status: d.status,
          plannedStartDate: d.plannedStartDate, plannedEndDate: d.plannedEndDate,
          actualStartDate: d.actualStartDate, actualEndDate: d.actualEndDate,
          progress: d.progress ?? 0, barColor: d.barColor, description: d.description,
          delayReason: d.delayReason ?? null, delayNote: d.delayNote ?? null,
          createdAt: normalizeToISO(d.createdAt) ?? undefined,
          updatedAt: normalizeToISO(d.updatedAt) ?? undefined,
          createdBy: d.createdBy, updatedBy: d.updatedBy,
        };
      });

      const tasks: ConstructionTask[] = tasksSnap.docs.map((doc) => {
        const d = doc.data() as Omit<ConstructionTask, 'id'>;
        return {
          id: doc.id, phaseId: d.phaseId, buildingId: d.buildingId, companyId: d.companyId,
          name: d.name, code: d.code, order: d.order, status: d.status,
          plannedStartDate: d.plannedStartDate, plannedEndDate: d.plannedEndDate,
          actualStartDate: d.actualStartDate, actualEndDate: d.actualEndDate,
          progress: d.progress ?? 0, dependencies: d.dependencies ?? [],
          barColor: d.barColor, description: d.description,
          delayReason: d.delayReason ?? null, delayNote: d.delayNote ?? null,
          createdAt: normalizeToISO(d.createdAt) ?? undefined,
          updatedAt: normalizeToISO(d.updatedAt) ?? undefined,
          createdBy: d.createdBy, updatedBy: d.updatedBy,
        };
      });

      // Write baseline document
      const baselineId = generateConstructionBaselineId();
      await adminDb.collection(COLLECTIONS.CONSTRUCTION_BASELINES).doc(baselineId).set({
        buildingId,
        companyId: ctx.companyId,
        name: body.name.trim(),
        version: nextVersion,
        description: body.description?.trim() ?? null,
        phases,
        tasks,
        createdAt: FieldValue.serverTimestamp(),
        createdBy: ctx.uid,
      });

      logger.info('[Baselines] Created baseline', { baselineId, version: nextVersion, buildingId, phases: phases.length, tasks: tasks.length });

      await logAuditEvent(ctx, 'data_created', buildingId, 'building', {
        newValue: { type: 'building_update', value: { id: baselineId, name: body.name, version: nextVersion, entityType: 'construction_baseline' } },
        metadata: { reason: 'Construction baseline snapshot created' },
      });

      return NextResponse.json({ success: true, baselineId } satisfies BaselineMutationResponse);
    },
    { permissions: 'buildings:buildings:update' }
  ));

  return handler(request);
}

// =============================================================================
// DELETE — Delete a baseline snapshot
// =============================================================================

export async function DELETE(
  request: NextRequest,
  segmentData: { params: Promise<{ buildingId: string }> }
) {
  const { buildingId } = await segmentData.params;

  const handler = withStandardRateLimit(withAuth<BaselineMutationResponse>(
    async (req: NextRequest, ctx: AuthContext) => {
      const adminDb = getAdminFirestore();
      if (!adminDb) throw new ApiError(503, 'Database unavailable');

      await requireBuildingInTenant({ ctx, buildingId, path: `/api/buildings/${buildingId}/construction-baselines` });

      const { searchParams } = new URL(req.url);
      const id = searchParams.get('id');
      if (!id) throw new ApiError(400, 'id query param is required');

      const docRef = adminDb.collection(COLLECTIONS.CONSTRUCTION_BASELINES).doc(id);
      const docSnap = await docRef.get();

      if (!docSnap.exists) throw new ApiError(404, 'Baseline not found');
      if (docSnap.data()?.buildingId !== buildingId) throw new ApiError(403, 'Baseline does not belong to this building');

      await docRef.delete();

      logger.info('[Baselines] Deleted baseline', { baselineId: id, buildingId });

      await logAuditEvent(ctx, 'data_deleted', buildingId, 'building', {
        newValue: { type: 'building_update', value: { id, entityType: 'construction_baseline' } },
        metadata: { reason: 'Construction baseline snapshot deleted' },
      });

      return NextResponse.json({ success: true, baselineId: id } satisfies BaselineMutationResponse);
    },
    { permissions: 'buildings:buildings:update' }
  ));

  return handler(request);
}
