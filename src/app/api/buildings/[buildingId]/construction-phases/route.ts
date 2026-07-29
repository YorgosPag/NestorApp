import { NextResponse } from 'next/server';
import { COLLECTIONS } from '@/config/firestore-collections';
import { logAuditEvent } from '@/lib/auth';
import { ApiError } from '@/lib/api/ApiErrorHandler';
import { createModuleLogger } from '@/lib/telemetry';
import { buildingScopedRoute } from '@/lib/api/building-scoped-route';
import { requireDocOfBuilding, buildAllowedUpdates } from '@/lib/api/firestore-doc-guards';
import { fetchPhasesAndTasks } from '@/lib/api/construction-doc-mappers';
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

const routePath = (buildingId: string) => `/api/buildings/${buildingId}/construction-phases`;

/** PATCH λευκή λίστα — οι εργασίες έχουν επιπλέον `phaseId` + `dependencies`. */
const TASK_PATCHABLE_FIELDS = [
  'name', 'code', 'order', 'status', 'plannedStartDate', 'plannedEndDate',
  'actualStartDate', 'actualEndDate', 'progress', 'dependencies', 'barColor',
  'description', 'phaseId', 'delayReason', 'delayNote',
] as const;

const PHASE_PATCHABLE_FIELDS = [
  'name', 'code', 'order', 'status', 'plannedStartDate', 'plannedEndDate',
  'actualStartDate', 'actualEndDate', 'progress', 'barColor', 'description',
  'delayReason', 'delayNote',
] as const;

// =============================================================================
// GET — Load construction phases + tasks for a building
// =============================================================================

export const GET = buildingScopedRoute<ConstructionPhasesGetResponse>({
  routePath,
  permissions: 'buildings:buildings:view',
  handler: async ({ adminDb, buildingId }) => {
    const { phases, tasks } = await fetchPhasesAndTasks(adminDb, buildingId);

    logger.info('[Construction] Loaded phases and tasks for building', { phasesCount: phases.length, tasksCount: tasks.length, buildingId });

    return NextResponse.json({ success: true, phases, tasks, buildingId } as ConstructionPhasesGetResponse);
  },
});

// =============================================================================
// POST — Create a construction phase or task (delegated to _helpers)
// =============================================================================

export const POST = buildingScopedRoute<ConstructionMutationResponse>({
  routePath,
  permissions: 'buildings:buildings:update',
  handler: async ({ req, ctx, adminDb, buildingId }) => {
    const body: CreatePayload = await req.json();
    return handleCreate(body, buildingId, ctx, adminDb);
  },
});

// =============================================================================
// PATCH — Update a construction phase or task
// =============================================================================

export const PATCH = buildingScopedRoute<ConstructionMutationResponse>({
  routePath,
  permissions: 'buildings:buildings:update',
  handler: async ({ req, ctx, adminDb, buildingId }) => {
    const { type, id, updates }: UpdatePayload = await req.json();
    if (!id || !type) throw new ApiError(400, 'id and type are required');

    const collection = type === 'task' ? COLLECTIONS.CONSTRUCTION_TASKS : COLLECTIONS.CONSTRUCTION_PHASES;

    // Το 404 λέει τον τύπο (`phase`/`task`), το 403 μένει γενικό — ίδια μηνύματα
    // με πριν, ώστε να μην αλλάξει το συμβόλαιο του πελάτη.
    const { ref } = await requireDocOfBuilding({
      adminDb, collection, id, buildingId, label: type, ownerLabel: 'Document',
    });

    const allowed = type === 'task' ? TASK_PATCHABLE_FIELDS : PHASE_PATCHABLE_FIELDS;
    const cleanUpdates = buildAllowedUpdates(updates, allowed, ctx.uid);
    await ref.update(cleanUpdates);

    logger.info('[Construction] Updated entity for building', { type, id, buildingId, fields: Object.keys(cleanUpdates) });

    await logAuditEvent(ctx, 'data_updated', buildingId, 'building', {
      newValue: { type: 'building_update', value: { id, fields: Object.keys(cleanUpdates), entityType: `construction_${type}` } },
      metadata: { reason: `Construction ${type} updated` },
    });

    return NextResponse.json({ success: true, id, type } as ConstructionMutationResponse);
  },
});

// =============================================================================
// DELETE — Delete a construction phase or task (delegated to _helpers)
// =============================================================================

export const DELETE = buildingScopedRoute<ConstructionMutationResponse>({
  routePath,
  permissions: 'buildings:buildings:update',
  handler: async ({ req, ctx, adminDb, buildingId }) => handleDelete(req.url, buildingId, ctx, adminDb),
});
