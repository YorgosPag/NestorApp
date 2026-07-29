/**
 * Construction Resource Assignments API — CRUD (ADR-266 Phase C, Sub-phase 4)
 *
 * Assigns workers and equipment to construction tasks.
 * Primavera P6 / MS Project resource management pattern.
 */

import { NextResponse } from 'next/server';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { logAuditEvent } from '@/lib/auth';
import { ApiError } from '@/lib/api/ApiErrorHandler';
import { FieldValue } from 'firebase-admin/firestore';
import { createModuleLogger } from '@/lib/telemetry';
import { normalizeToISO } from '@/lib/date-local';
import { generateConstructionResourceAssignmentId } from '@/services/enterprise-id.service';
import { buildingScopedRoute } from '@/lib/api/building-scoped-route';
import { requireDocOfBuilding, buildAllowedUpdates } from '@/lib/api/firestore-doc-guards';
import type {
  ConstructionResourceAssignment,
  ResourceAssignmentCreatePayload,
} from '@/types/building/construction';

const logger = createModuleLogger('ResourceAssignmentsRoute');

const MAX_ASSIGNMENTS_PER_TASK = 20;

/** PATCH δέχεται μόνο αυτά — ό,τι άλλο σταλεί αγνοείται (λευκή λίστα, ADR-245). */
const PATCHABLE_FIELDS = ['allocatedHours', 'notes'] as const;

const ASSIGNMENTS = COLLECTIONS.CONSTRUCTION_RESOURCE_ASSIGNMENTS;

const routePath = (buildingId: string) =>
  `/api/buildings/${buildingId}/construction-resource-assignments`;

// ─── Response Types ─────────────────────────────────────────────────────

interface AssignmentsListResponse {
  success: boolean;
  assignments: ConstructionResourceAssignment[];
  buildingId: string;
}

interface AssignmentMutationResponse {
  success: boolean;
  assignmentId?: string;
  error?: string;
}

// =============================================================================
// GET — List resource assignments (all for building, or filtered by taskId)
// =============================================================================

export const GET = buildingScopedRoute<AssignmentsListResponse>({
  routePath,
  permissions: 'buildings:buildings:view',
  handler: async ({ req, adminDb, buildingId }) => {
    const taskIdFilter = new URL(req.url).searchParams.get('taskId');

    let query = adminDb.collection(ASSIGNMENTS).where(FIELDS.BUILDING_ID, '==', buildingId);
    if (taskIdFilter) query = query.where('taskId', '==', taskIdFilter);

    const snapshot = await query.orderBy('resourceName', 'asc').get();

    const assignments: ConstructionResourceAssignment[] = snapshot.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        taskId: d.taskId,
        phaseId: d.phaseId,
        buildingId: d.buildingId,
        companyId: d.companyId,
        resourceType: d.resourceType,
        contactId: d.contactId ?? null,
        resourceName: d.resourceName ?? '',
        equipmentLabel: d.equipmentLabel ?? null,
        allocatedHours: d.allocatedHours ?? 0,
        notes: d.notes ?? null,
        createdAt: normalizeToISO(d.createdAt) ?? undefined,
        updatedAt: normalizeToISO(d.updatedAt) ?? undefined,
        createdBy: d.createdBy,
        updatedBy: d.updatedBy,
      };
    });

    logger.info('[Resources] Listed assignments', { count: assignments.length, buildingId, taskIdFilter });
    return NextResponse.json({ success: true, assignments, buildingId } satisfies AssignmentsListResponse);
  },
});

// =============================================================================
// POST — Create a resource assignment
// =============================================================================

export const POST = buildingScopedRoute<AssignmentMutationResponse>({
  routePath,
  permissions: 'buildings:buildings:update',
  handler: async ({ req, ctx, adminDb, buildingId }) => {
    const body: ResourceAssignmentCreatePayload = await req.json();

    if (!body.taskId || !body.resourceName?.trim() || !body.resourceType) {
      throw new ApiError(400, 'taskId, resourceName, and resourceType are required');
    }
    if (body.allocatedHours <= 0) {
      throw new ApiError(400, 'allocatedHours must be positive');
    }

    // Η εργασία πρέπει να υπάρχει ΚΑΙ να ανήκει στο κτήριο — 404 πριν από 403.
    await requireDocOfBuilding({
      adminDb,
      collection: COLLECTIONS.CONSTRUCTION_TASKS,
      id: body.taskId,
      buildingId,
      label: 'Task',
    });

    // Enforce max assignments per task
    const countResult = await adminDb
      .collection(ASSIGNMENTS)
      .where('taskId', '==', body.taskId)
      .count()
      .get();

    if ((countResult.data().count ?? 0) >= MAX_ASSIGNMENTS_PER_TASK) {
      throw new ApiError(400, `Maximum ${MAX_ASSIGNMENTS_PER_TASK} resource assignments per task.`);
    }

    const assignmentId = generateConstructionResourceAssignmentId();
    await adminDb.collection(ASSIGNMENTS).doc(assignmentId).set({
      taskId: body.taskId,
      phaseId: body.phaseId,
      buildingId,
      companyId: ctx.companyId,
      resourceType: body.resourceType,
      contactId: body.contactId ?? null,
      resourceName: body.resourceName.trim(),
      equipmentLabel: body.equipmentLabel?.trim() ?? null,
      allocatedHours: body.allocatedHours,
      notes: body.notes?.trim() ?? null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      createdBy: ctx.uid,
    });

    logger.info('[Resources] Created assignment', { assignmentId, taskId: body.taskId, resourceName: body.resourceName, buildingId });

    await logAuditEvent(ctx, 'data_created', buildingId, 'building', {
      newValue: { type: 'building_update', value: { id: assignmentId, taskId: body.taskId, resourceName: body.resourceName, entityType: 'resource_assignment' } },
      metadata: { reason: 'Resource assignment created' },
    });

    return NextResponse.json({ success: true, assignmentId } satisfies AssignmentMutationResponse);
  },
});

// =============================================================================
// PATCH — Update assignment (hours / notes only)
// =============================================================================

export const PATCH = buildingScopedRoute<AssignmentMutationResponse>({
  routePath,
  permissions: 'buildings:buildings:update',
  handler: async ({ req, ctx, adminDb, buildingId }) => {
    const body = await req.json() as { id: string; updates: Record<string, unknown> };
    if (!body.id) throw new ApiError(400, 'Assignment id is required');

    const { ref } = await requireDocOfBuilding({
      adminDb, collection: ASSIGNMENTS, id: body.id, buildingId, label: 'Assignment',
    });

    const cleanUpdates = buildAllowedUpdates(body.updates, PATCHABLE_FIELDS, ctx.uid);
    await ref.update(cleanUpdates);

    logger.info('[Resources] Updated assignment', { assignmentId: body.id, fields: Object.keys(cleanUpdates), buildingId });
    return NextResponse.json({ success: true, assignmentId: body.id } satisfies AssignmentMutationResponse);
  },
});

// =============================================================================
// DELETE — Delete a resource assignment
// =============================================================================

export const DELETE = buildingScopedRoute<AssignmentMutationResponse>({
  routePath,
  permissions: 'buildings:buildings:update',
  handler: async ({ req, ctx, adminDb, buildingId }) => {
    const id = new URL(req.url).searchParams.get('id');
    if (!id) throw new ApiError(400, 'id query param is required');

    const { ref } = await requireDocOfBuilding({
      adminDb, collection: ASSIGNMENTS, id, buildingId, label: 'Assignment',
    });

    await ref.delete();
    logger.info('[Resources] Deleted assignment', { assignmentId: id, buildingId });

    await logAuditEvent(ctx, 'data_deleted', buildingId, 'building', {
      newValue: { type: 'building_update', value: { id, entityType: 'resource_assignment' } },
      metadata: { reason: 'Resource assignment deleted' },
    });

    return NextResponse.json({ success: true, assignmentId: id } satisfies AssignmentMutationResponse);
  },
});
