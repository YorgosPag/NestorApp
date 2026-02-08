import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { withAuth, requireBuildingInTenant, logAuditEvent } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { ApiError } from '@/lib/api/ApiErrorHandler';
import { FieldValue } from 'firebase-admin/firestore';
import type {
  ConstructionPhase,
  ConstructionTask,
} from '@/types/building/construction';

// ─── Response Types ──────────────────────────────────────────────────────

interface ConstructionPhasesGetResponse {
  success: boolean;
  phases: ConstructionPhase[];
  tasks: ConstructionTask[];
  buildingId: string;
}

interface ConstructionMutationResponse {
  success: boolean;
  id: string;
  type: 'phase' | 'task';
  cascadedTasks?: number;
}

// ─── Firestore Timestamp Helper ──────────────────────────────────────────

function firestoreTimestampToISO(
  val: string | Date | { seconds: number; nanoseconds: number } | undefined
): string | undefined {
  if (!val) return undefined;
  if (typeof val === 'string') return val;
  if (val instanceof Date) return val.toISOString();
  if (typeof val === 'object' && 'seconds' in val) {
    return new Date(val.seconds * 1000).toISOString();
  }
  return undefined;
}

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

      // Tenant isolation: verify building belongs to user's company
      await requireBuildingInTenant({
        ctx,
        buildingId,
        path: `/api/buildings/${buildingId}/construction-phases`,
      });

      // Fetch phases ordered by 'order' field
      const phasesSnapshot = await adminDb
        .collection(COLLECTIONS.CONSTRUCTION_PHASES)
        .where('buildingId', '==', buildingId)
        .orderBy('order', 'asc')
        .get();

      const phases: ConstructionPhase[] = phasesSnapshot.docs.map((doc) => {
        const data = doc.data();
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
          createdAt: firestoreTimestampToISO(data.createdAt),
          updatedAt: firestoreTimestampToISO(data.updatedAt),
          createdBy: data.createdBy,
          updatedBy: data.updatedBy,
        };
      });

      // Fetch tasks ordered by 'order' field
      const tasksSnapshot = await adminDb
        .collection(COLLECTIONS.CONSTRUCTION_TASKS)
        .where('buildingId', '==', buildingId)
        .orderBy('order', 'asc')
        .get();

      const tasks: ConstructionTask[] = tasksSnapshot.docs.map((doc) => {
        const data = doc.data();
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
          createdAt: firestoreTimestampToISO(data.createdAt),
          updatedAt: firestoreTimestampToISO(data.updatedAt),
          createdBy: data.createdBy,
          updatedBy: data.updatedBy,
        };
      });

      console.log(`✅ [Construction] Loaded ${phases.length} phases, ${tasks.length} tasks for building ${buildingId}`);

      return NextResponse.json({
        success: true,
        phases,
        tasks,
        buildingId,
      } as ConstructionPhasesGetResponse);
    },
    { permissions: 'buildings:buildings:view' }
  ));

  return handler(request);
}

// =============================================================================
// POST — Create a construction phase or task
// =============================================================================

interface CreatePayload {
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

export async function POST(
  request: NextRequest,
  segmentData: { params: Promise<{ buildingId: string }> }
) {
  const { buildingId } = await segmentData.params;

  const handler = withStandardRateLimit(withAuth<ConstructionMutationResponse>(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      const adminDb = getAdminFirestore();
      if (!adminDb) {
        throw new ApiError(503, 'Database unavailable');
      }

      // Tenant isolation
      await requireBuildingInTenant({
        ctx,
        buildingId,
        path: `/api/buildings/${buildingId}/construction-phases`,
      });

      const body: CreatePayload = await req.json();
      const { type, name, plannedStartDate, plannedEndDate } = body;

      // Validation
      if (!name || !plannedStartDate || !plannedEndDate) {
        throw new ApiError(400, 'name, plannedStartDate, and plannedEndDate are required');
      }

      if (type === 'task' && !body.phaseId) {
        throw new ApiError(400, 'phaseId is required for tasks');
      }

      const collection = type === 'task'
        ? COLLECTIONS.CONSTRUCTION_TASKS
        : COLLECTIONS.CONSTRUCTION_PHASES;

      // Auto-generate code if not provided
      const existingCount = await adminDb
        .collection(collection)
        .where('buildingId', '==', buildingId)
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

      // Task-specific fields
      if (type === 'task') {
        docData.phaseId = body.phaseId;
        docData.dependencies = body.dependencies ?? [];
      }

      const docRef = await adminDb.collection(collection).add(docData);

      console.log(`✅ [Construction] Created ${type} ${docRef.id} (${code}) for building ${buildingId}`);

      await logAuditEvent(ctx, 'data_created', buildingId, 'building', {
        newValue: {
          type: 'building_update',
          value: { id: docRef.id, code, name, entityType: `construction_${type}` },
        },
        metadata: { reason: `Construction ${type} created` },
      });

      return NextResponse.json({
        success: true,
        id: docRef.id,
        type,
      } as ConstructionMutationResponse);
    },
    { permissions: 'buildings:buildings:update' }
  ));

  return handler(request);
}

// =============================================================================
// PATCH — Update a construction phase or task
// =============================================================================

interface UpdatePayload {
  type: 'phase' | 'task';
  id: string;
  updates: Record<string, unknown>;
}

export async function PATCH(
  request: NextRequest,
  segmentData: { params: Promise<{ buildingId: string }> }
) {
  const { buildingId } = await segmentData.params;

  const handler = withStandardRateLimit(withAuth<ConstructionMutationResponse>(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      const adminDb = getAdminFirestore();
      if (!adminDb) {
        throw new ApiError(503, 'Database unavailable');
      }

      // Tenant isolation
      await requireBuildingInTenant({
        ctx,
        buildingId,
        path: `/api/buildings/${buildingId}/construction-phases`,
      });

      const body: UpdatePayload = await req.json();
      const { type, id, updates } = body;

      if (!id || !type) {
        throw new ApiError(400, 'id and type are required');
      }

      const collection = type === 'task'
        ? COLLECTIONS.CONSTRUCTION_TASKS
        : COLLECTIONS.CONSTRUCTION_PHASES;

      // Verify document exists and belongs to this building
      const docRef = adminDb.collection(collection).doc(id);
      const docSnap = await docRef.get();

      if (!docSnap.exists) {
        throw new ApiError(404, `${type} not found`);
      }

      const existingData = docSnap.data();
      if (existingData?.buildingId !== buildingId) {
        throw new ApiError(403, 'Document does not belong to this building');
      }

      // Sanitize updates: remove undefined values and system fields
      const allowedFields = type === 'task'
        ? ['name', 'code', 'order', 'status', 'plannedStartDate', 'plannedEndDate', 'actualStartDate', 'actualEndDate', 'progress', 'dependencies', 'barColor', 'description', 'phaseId']
        : ['name', 'code', 'order', 'status', 'plannedStartDate', 'plannedEndDate', 'actualStartDate', 'actualEndDate', 'progress', 'barColor', 'description'];

      const cleanUpdates: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key) && value !== undefined) {
          cleanUpdates[key] = value;
        }
      }

      if (Object.keys(cleanUpdates).length === 0) {
        throw new ApiError(400, 'No valid fields to update');
      }

      // Add audit fields
      cleanUpdates.updatedAt = FieldValue.serverTimestamp();
      cleanUpdates.updatedBy = ctx.uid;

      await docRef.update(cleanUpdates);

      console.log(`✅ [Construction] Updated ${type} ${id} for building ${buildingId}: ${Object.keys(cleanUpdates).join(', ')}`);

      await logAuditEvent(ctx, 'data_updated', buildingId, 'building', {
        newValue: {
          type: 'building_update',
          value: { id, fields: Object.keys(cleanUpdates), entityType: `construction_${type}` },
        },
        metadata: { reason: `Construction ${type} updated` },
      });

      return NextResponse.json({
        success: true,
        id,
        type,
      } as ConstructionMutationResponse);
    },
    { permissions: 'buildings:buildings:update' }
  ));

  return handler(request);
}

// =============================================================================
// DELETE — Delete a construction phase or task
// =============================================================================

export async function DELETE(
  request: NextRequest,
  segmentData: { params: Promise<{ buildingId: string }> }
) {
  const { buildingId } = await segmentData.params;

  const handler = withStandardRateLimit(withAuth<ConstructionMutationResponse>(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      const adminDb = getAdminFirestore();
      if (!adminDb) {
        throw new ApiError(503, 'Database unavailable');
      }

      // Tenant isolation
      await requireBuildingInTenant({
        ctx,
        buildingId,
        path: `/api/buildings/${buildingId}/construction-phases`,
      });

      // Read from query params (DELETE doesn't support body in apiClient)
      const { searchParams } = new URL(req.url);
      const type = searchParams.get('type') as 'phase' | 'task' | null;
      const id = searchParams.get('id');

      if (!id || !type) {
        throw new ApiError(400, 'id and type query params are required');
      }

      const collection = type === 'task'
        ? COLLECTIONS.CONSTRUCTION_TASKS
        : COLLECTIONS.CONSTRUCTION_PHASES;

      // Verify document exists and belongs to this building
      const docRef = adminDb.collection(collection).doc(id);
      const docSnap = await docRef.get();

      if (!docSnap.exists) {
        throw new ApiError(404, `${type} not found`);
      }

      const existingData = docSnap.data();
      if (existingData?.buildingId !== buildingId) {
        throw new ApiError(403, 'Document does not belong to this building');
      }

      let cascadedTasks = 0;

      // If deleting a phase, also delete all its tasks
      if (type === 'phase') {
        const childTasks = await adminDb
          .collection(COLLECTIONS.CONSTRUCTION_TASKS)
          .where('phaseId', '==', id)
          .get();

        if (!childTasks.empty) {
          const batch = adminDb.batch();
          childTasks.docs.forEach((taskDoc) => batch.delete(taskDoc.ref));
          await batch.commit();
          cascadedTasks = childTasks.size;
          console.log(`🗑️ [Construction] Cascade-deleted ${cascadedTasks} tasks for phase ${id}`);
        }
      }

      await docRef.delete();

      console.log(`✅ [Construction] Deleted ${type} ${id} from building ${buildingId}`);

      await logAuditEvent(ctx, 'data_deleted', buildingId, 'building', {
        newValue: {
          type: 'building_update',
          value: { id, cascadedTasks, entityType: `construction_${type}` },
        },
        metadata: { reason: `Construction ${type} deleted` },
      });

      return NextResponse.json({
        success: true,
        id,
        type,
        cascadedTasks: type === 'phase' ? cascadedTasks : undefined,
      } as ConstructionMutationResponse);
    },
    { permissions: 'buildings:buildings:update' }
  ));

  return handler(request);
}
