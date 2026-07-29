/**
 * Construction Baselines API — List, Create, Delete (ADR-266 Phase C, Sub-phase 3)
 *
 * Baseline Snapshots: frozen copies of the schedule at a point in time,
 * enabling Baseline vs Actual comparison (Primavera P6 / MS Project pattern).
 */

import { NextResponse } from 'next/server';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { logAuditEvent } from '@/lib/auth';
import { ApiError } from '@/lib/api/ApiErrorHandler';
import { FieldValue } from 'firebase-admin/firestore';
import { createModuleLogger } from '@/lib/telemetry';
import { normalizeToISO, nowISO } from '@/lib/date-local';
import { generateConstructionBaselineId } from '@/services/enterprise-id.service';
import { buildingScopedRoute } from '@/lib/api/building-scoped-route';
import { requireDocOfBuilding } from '@/lib/api/firestore-doc-guards';
import { fetchPhasesAndTasks } from '@/lib/api/construction-doc-mappers';
import type {
  ConstructionBaselineSummary,
  ConstructionBaselineCreatePayload,
} from '@/types/building/construction';

const logger = createModuleLogger('ConstructionBaselinesRoute');

/** Max baselines per building (server-enforced) */
const MAX_BASELINES_PER_BUILDING = 10;

const routePath = (buildingId: string) => `/api/buildings/${buildingId}/construction-baselines`;

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

export const GET = buildingScopedRoute<BaselinesListResponse>({
  routePath,
  permissions: 'buildings:buildings:view',
  handler: async ({ adminDb, buildingId }) => {
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
        createdAt: normalizeToISO(d.createdAt) ?? nowISO(),
        phaseCount: Array.isArray(d.phases) ? d.phases.length : 0,
        taskCount: Array.isArray(d.tasks) ? d.tasks.length : 0,
      };
    });

    logger.info('[Baselines] Listed baselines', { count: baselines.length, buildingId });
    return NextResponse.json({ success: true, baselines, buildingId } satisfies BaselinesListResponse);
  },
});

// =============================================================================
// POST — Create a new baseline snapshot (captures current phases + tasks)
// =============================================================================

export const POST = buildingScopedRoute<BaselineMutationResponse>({
  routePath,
  permissions: 'buildings:buildings:update',
  handler: async ({ req, ctx, adminDb, buildingId }) => {
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

    // Το στιγμιότυπο διαβάζεται με τον ΙΔΙΟ mapper που σερβίρει το GET των phases —
    // αλλιώς το «baseline vs actual» θα σύγκρινε δύο διαφορετικά σχήματα.
    const { phases, tasks } = await fetchPhasesAndTasks(adminDb, buildingId);

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
});

// =============================================================================
// DELETE — Delete a baseline snapshot
// =============================================================================

export const DELETE = buildingScopedRoute<BaselineMutationResponse>({
  routePath,
  permissions: 'buildings:buildings:update',
  handler: async ({ req, ctx, adminDb, buildingId }) => {
    const id = new URL(req.url).searchParams.get('id');
    if (!id) throw new ApiError(400, 'id query param is required');

    const { ref } = await requireDocOfBuilding({
      adminDb,
      collection: COLLECTIONS.CONSTRUCTION_BASELINES,
      id,
      buildingId,
      label: 'Baseline',
    });

    await ref.delete();
    logger.info('[Baselines] Deleted baseline', { baselineId: id, buildingId });

    await logAuditEvent(ctx, 'data_deleted', buildingId, 'building', {
      newValue: { type: 'building_update', value: { id, entityType: 'construction_baseline' } },
      metadata: { reason: 'Construction baseline snapshot deleted' },
    });

    return NextResponse.json({ success: true, baselineId: id } satisfies BaselineMutationResponse);
  },
});
