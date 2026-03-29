/**
 * Construction Phases API — Shared types & mutation handlers (ADR-034)
 *
 * Extracted from route.ts to comply with 300-line API route limit.
 * Contains: response types, POST/DELETE handler logic.
 */

import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { requireBuildingInTenant, logAuditEvent } from '@/lib/auth';
import type { AuthContext } from '@/lib/auth';
import { ApiError } from '@/lib/api/ApiErrorHandler';
import { FieldValue } from 'firebase-admin/firestore';
import { createModuleLogger } from '@/lib/telemetry';
import { generateConstructionPhaseId, generateConstructionTaskId } from '@/services/enterprise-id.service';
import type { ConstructionPhase, ConstructionTask } from '@/types/building/construction';

const logger = createModuleLogger('ConstructionPhasesRoute');

// ─── Shared Types ────────────────────────────────────────────────────────

export interface ConstructionPhasesGetResponse {
  success: boolean;
  phases: ConstructionPhase[];
  tasks: ConstructionTask[];
  buildingId: string;
}

export interface ConstructionMutationResponse {
  success: boolean;
  id: string;
  type: 'phase' | 'task';
  cascadedTasks?: number;
}

export interface CreatePayload {
  type: 'phase' | 'task';
  name: string;
  code?: string;
  order?: number;
  status?: string;
  plannedStartDate: string;
  plannedEndDate: string;
  description?: string;
  phaseId?: string;
  dependencies?: string[];
}

export interface UpdatePayload {
  type: 'phase' | 'task';
  id: string;
  updates: Record<string, unknown>;
}

// ─── POST Logic — Create Phase or Task ──────────────────────────────────

export async function handleCreate(
  body: CreatePayload,
  buildingId: string,
  ctx: AuthContext,
): Promise<NextResponse> {
  const adminDb = getAdminFirestore();
  if (!adminDb) throw new ApiError(503, 'Database unavailable');

  await requireBuildingInTenant({ ctx, buildingId, path: `/api/buildings/${buildingId}/construction-phases` });

  const { type, name, plannedStartDate, plannedEndDate } = body;

  if (!name || !plannedStartDate || !plannedEndDate) {
    throw new ApiError(400, 'name, plannedStartDate, and plannedEndDate are required');
  }
  if (type === 'task' && !body.phaseId) {
    throw new ApiError(400, 'phaseId is required for tasks');
  }

  const collection = type === 'task' ? COLLECTIONS.CONSTRUCTION_TASKS : COLLECTIONS.CONSTRUCTION_PHASES;

  const existingCount = await adminDb
    .collection(collection)
    .where(FIELDS.BUILDING_ID, '==', buildingId)
    .count()
    .get();

  const nextNumber = (existingCount.data().count ?? 0) + 1;
  const prefix = type === 'task' ? 'TSK' : 'PH';
  const code = body.code || `${prefix}-${String(nextNumber).padStart(3, '0')}`;

  const docData: Record<string, unknown> = {
    buildingId,
    companyId: ctx.companyId,
    name,
    code,
    order: body.order ?? nextNumber,
    status: body.status ?? (type === 'task' ? 'notStarted' : 'planning'),
    plannedStartDate,
    plannedEndDate,
    progress: 0,
    description: body.description ?? '',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: ctx.uid,
  };

  if (type === 'task') {
    docData.phaseId = body.phaseId;
    docData.dependencies = body.dependencies ?? [];
  }

  const enterpriseId = type === 'task' ? generateConstructionTaskId() : generateConstructionPhaseId();
  const docRef = adminDb.collection(collection).doc(enterpriseId);
  await docRef.set(docData);

  logger.info('[Construction] Created entity for building', { type, id: enterpriseId, code, buildingId });

  await logAuditEvent(ctx, 'data_created', buildingId, 'building', {
    newValue: { type: 'building_update', value: { id: enterpriseId, code, name, entityType: `construction_${type}` } },
    metadata: { reason: `Construction ${type} created` },
  });

  return NextResponse.json({ success: true, id: enterpriseId, type } as ConstructionMutationResponse);
}

// ─── DELETE Logic — Delete Phase or Task ────────────────────────────────

export async function handleDelete(
  url: string,
  buildingId: string,
  ctx: AuthContext,
): Promise<NextResponse> {
  const adminDb = getAdminFirestore();
  if (!adminDb) throw new ApiError(503, 'Database unavailable');

  await requireBuildingInTenant({ ctx, buildingId, path: `/api/buildings/${buildingId}/construction-phases` });

  const { searchParams } = new URL(url);
  const type = searchParams.get('type') as 'phase' | 'task' | null;
  const id = searchParams.get('id');

  if (!id || !type) {
    throw new ApiError(400, 'id and type query params are required');
  }

  const collection = type === 'task' ? COLLECTIONS.CONSTRUCTION_TASKS : COLLECTIONS.CONSTRUCTION_PHASES;
  const docRef = adminDb.collection(collection).doc(id);
  const docSnap = await docRef.get();

  if (!docSnap.exists) throw new ApiError(404, `${type} not found`);

  const existingData = docSnap.data();
  if (existingData?.buildingId !== buildingId) {
    throw new ApiError(403, 'Document does not belong to this building');
  }

  let cascadedTasks = 0;

  if (type === 'phase') {
    // Cascade-delete child tasks
    const childTasks = await adminDb
      .collection(COLLECTIONS.CONSTRUCTION_TASKS)
      .where('phaseId', '==', id)
      .get();

    if (!childTasks.empty) {
      const batch = adminDb.batch();
      childTasks.docs.forEach((taskDoc) => batch.delete(taskDoc.ref));
      await batch.commit();
      cascadedTasks = childTasks.size;
      logger.info('[Construction] Cascade-deleted tasks for phase', { cascadedTasks, phaseId: id });
    }

    // Cascade-delete resource assignments for all tasks in this phase (ADR-266 C4)
    const phaseAssignments = await adminDb
      .collection(COLLECTIONS.CONSTRUCTION_RESOURCE_ASSIGNMENTS)
      .where('phaseId', '==', id)
      .get();

    if (!phaseAssignments.empty) {
      const batch = adminDb.batch();
      phaseAssignments.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      logger.info('[Construction] Cascade-deleted resource assignments for phase', { count: phaseAssignments.size, phaseId: id });
    }
  } else {
    // Cascade-delete resource assignments for this task (ADR-266 C4)
    const taskAssignments = await adminDb
      .collection(COLLECTIONS.CONSTRUCTION_RESOURCE_ASSIGNMENTS)
      .where('taskId', '==', id)
      .get();

    if (!taskAssignments.empty) {
      const batch = adminDb.batch();
      taskAssignments.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      logger.info('[Construction] Cascade-deleted resource assignments for task', { count: taskAssignments.size, taskId: id });
    }
  }

  await docRef.delete();

  logger.info('[Construction] Deleted entity from building', { type, id, buildingId });

  await logAuditEvent(ctx, 'data_deleted', buildingId, 'building', {
    newValue: { type: 'building_update', value: { id, cascadedTasks, entityType: `construction_${type}` } },
    metadata: { reason: `Construction ${type} deleted` },
  });

  return NextResponse.json({
    success: true, id, type,
    cascadedTasks: type === 'phase' ? cascadedTasks : undefined,
  } as ConstructionMutationResponse);
}
