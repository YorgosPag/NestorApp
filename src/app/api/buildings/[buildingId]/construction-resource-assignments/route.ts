/**
 * Construction Resource Assignments API — CRUD (ADR-266 Phase C, Sub-phase 4)
 *
 * Assigns workers and equipment to construction tasks.
 * Primavera P6 / MS Project resource management pattern.
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
import { generateConstructionResourceAssignmentId } from '@/services/enterprise-id.service';
import type {
  ConstructionResourceAssignment,
  ResourceAssignmentCreatePayload,
} from '@/types/building/construction';

const logger = createModuleLogger('ResourceAssignmentsRoute');

const MAX_ASSIGNMENTS_PER_TASK = 20;

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

export async function GET(
  request: NextRequest,
  segmentData: { params: Promise<{ buildingId: string }> }
) {
  const { buildingId } = await segmentData.params;

  const handler = withStandardRateLimit(withAuth<AssignmentsListResponse>(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      const adminDb = getAdminFirestore();
      if (!adminDb) {
        return NextResponse.json({ success: false, assignments: [], buildingId } satisfies AssignmentsListResponse);
      }

      await requireBuildingInTenant({ ctx, buildingId, path: `/api/buildings/${buildingId}/construction-resource-assignments` });

      const { searchParams } = new URL(req.url);
      const taskIdFilter = searchParams.get('taskId');

      let query = adminDb
        .collection(COLLECTIONS.CONSTRUCTION_RESOURCE_ASSIGNMENTS)
        .where(FIELDS.BUILDING_ID, '==', buildingId);

      if (taskIdFilter) {
        query = query.where('taskId', '==', taskIdFilter);
      }

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
    { permissions: 'buildings:buildings:view' }
  ));

  return handler(request);
}

// =============================================================================
// POST — Create a resource assignment
// =============================================================================

export async function POST(
  request: NextRequest,
  segmentData: { params: Promise<{ buildingId: string }> }
) {
  const { buildingId } = await segmentData.params;

  const handler = withStandardRateLimit(withAuth<AssignmentMutationResponse>(
    async (req: NextRequest, ctx: AuthContext) => {
      const adminDb = getAdminFirestore();
      if (!adminDb) throw new ApiError(503, 'Database unavailable');

      await requireBuildingInTenant({ ctx, buildingId, path: `/api/buildings/${buildingId}/construction-resource-assignments` });

      const body: ResourceAssignmentCreatePayload = await req.json();

      if (!body.taskId || !body.resourceName?.trim() || !body.resourceType) {
        throw new ApiError(400, 'taskId, resourceName, and resourceType are required');
      }
      if (body.allocatedHours <= 0) {
        throw new ApiError(400, 'allocatedHours must be positive');
      }

      // Verify task exists and belongs to building
      const taskDoc = await adminDb.collection(COLLECTIONS.CONSTRUCTION_TASKS).doc(body.taskId).get();
      if (!taskDoc.exists) throw new ApiError(404, 'Task not found');
      if (taskDoc.data()?.buildingId !== buildingId) throw new ApiError(403, 'Task does not belong to this building');

      // Enforce max assignments per task
      const countResult = await adminDb
        .collection(COLLECTIONS.CONSTRUCTION_RESOURCE_ASSIGNMENTS)
        .where('taskId', '==', body.taskId)
        .count()
        .get();

      if ((countResult.data().count ?? 0) >= MAX_ASSIGNMENTS_PER_TASK) {
        throw new ApiError(400, `Maximum ${MAX_ASSIGNMENTS_PER_TASK} resource assignments per task.`);
      }

      const assignmentId = generateConstructionResourceAssignmentId();
      await adminDb.collection(COLLECTIONS.CONSTRUCTION_RESOURCE_ASSIGNMENTS).doc(assignmentId).set({
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
    { permissions: 'buildings:buildings:update' }
  ));

  return handler(request);
}

// =============================================================================
// PATCH — Update assignment (hours / notes only)
// =============================================================================

export async function PATCH(
  request: NextRequest,
  segmentData: { params: Promise<{ buildingId: string }> }
) {
  const { buildingId } = await segmentData.params;

  const handler = withStandardRateLimit(withAuth<AssignmentMutationResponse>(
    async (req: NextRequest, ctx: AuthContext) => {
      const adminDb = getAdminFirestore();
      if (!adminDb) throw new ApiError(503, 'Database unavailable');

      await requireBuildingInTenant({ ctx, buildingId, path: `/api/buildings/${buildingId}/construction-resource-assignments` });

      const body = await req.json() as { id: string; updates: Record<string, unknown> };
      if (!body.id) throw new ApiError(400, 'Assignment id is required');

      const docRef = adminDb.collection(COLLECTIONS.CONSTRUCTION_RESOURCE_ASSIGNMENTS).doc(body.id);
      const docSnap = await docRef.get();
      if (!docSnap.exists) throw new ApiError(404, 'Assignment not found');
      if (docSnap.data()?.buildingId !== buildingId) throw new ApiError(403, 'Assignment does not belong to this building');

      const allowedFields = ['allocatedHours', 'notes'];
      const cleanUpdates: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(body.updates)) {
        if (allowedFields.includes(key) && value !== undefined) {
          cleanUpdates[key] = value;
        }
      }

      if (Object.keys(cleanUpdates).length === 0) throw new ApiError(400, 'No valid fields to update');

      cleanUpdates.updatedAt = FieldValue.serverTimestamp();
      cleanUpdates.updatedBy = ctx.uid;
      await docRef.update(cleanUpdates);

      logger.info('[Resources] Updated assignment', { assignmentId: body.id, fields: Object.keys(cleanUpdates), buildingId });
      return NextResponse.json({ success: true, assignmentId: body.id } satisfies AssignmentMutationResponse);
    },
    { permissions: 'buildings:buildings:update' }
  ));

  return handler(request);
}

// =============================================================================
// DELETE — Delete a resource assignment
// =============================================================================

export async function DELETE(
  request: NextRequest,
  segmentData: { params: Promise<{ buildingId: string }> }
) {
  const { buildingId } = await segmentData.params;

  const handler = withStandardRateLimit(withAuth<AssignmentMutationResponse>(
    async (req: NextRequest, ctx: AuthContext) => {
      const adminDb = getAdminFirestore();
      if (!adminDb) throw new ApiError(503, 'Database unavailable');

      await requireBuildingInTenant({ ctx, buildingId, path: `/api/buildings/${buildingId}/construction-resource-assignments` });

      const { searchParams } = new URL(req.url);
      const id = searchParams.get('id');
      if (!id) throw new ApiError(400, 'id query param is required');

      const docRef = adminDb.collection(COLLECTIONS.CONSTRUCTION_RESOURCE_ASSIGNMENTS).doc(id);
      const docSnap = await docRef.get();
      if (!docSnap.exists) throw new ApiError(404, 'Assignment not found');
      if (docSnap.data()?.buildingId !== buildingId) throw new ApiError(403, 'Assignment does not belong to this building');

      await docRef.delete();

      logger.info('[Resources] Deleted assignment', { assignmentId: id, buildingId });

      await logAuditEvent(ctx, 'data_deleted', buildingId, 'building', {
        newValue: { type: 'building_update', value: { id, entityType: 'resource_assignment' } },
        metadata: { reason: 'Resource assignment deleted' },
      });

      return NextResponse.json({ success: true, assignmentId: id } satisfies AssignmentMutationResponse);
    },
    { permissions: 'buildings:buildings:update' }
  ));

  return handler(request);
}
