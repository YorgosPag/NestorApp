/** Milestone mutation helpers — extracted from route.ts for Google SRP compliance */

import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { requireBuildingInTenant, logAuditEvent } from '@/lib/auth';
import type { AuthContext } from '@/lib/auth';
import { ApiError } from '@/lib/api/ApiErrorHandler';
import { FieldValue } from 'firebase-admin/firestore';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('MilestonesHelpers');

// ─── Types ──────────────────────────────────────────────────────────────

export interface MilestoneMutationResponse {
  success: boolean;
  id: string;
}

export interface CreateMilestonePayload {
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

export interface UpdateMilestonePayload {
  id: string;
  updates: Record<string, unknown>;
}

// ─── Create ─────────────────────────────────────────────────────────────

export async function handleCreate(
  body: CreateMilestonePayload,
  buildingId: string,
  ctx: AuthContext,
): Promise<NextResponse<MilestoneMutationResponse>> {
  const adminDb = getAdminFirestore();
  if (!adminDb) throw new ApiError(503, 'Database unavailable');

  await requireBuildingInTenant({
    ctx,
    buildingId,
    path: `/api/buildings/${buildingId}/milestones`,
  });

  const { title, date, type } = body;
  if (!title || !date || !type) {
    throw new ApiError(400, 'title, date, and type are required');
  }

  const existingCount = await adminDb
    .collection(COLLECTIONS.BUILDING_MILESTONES)
    .where(FIELDS.BUILDING_ID, '==', buildingId)
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

  const { generateMilestoneId } = await import('@/services/enterprise-id.service');
  const enterpriseId = generateMilestoneId();
  await adminDb.collection(COLLECTIONS.BUILDING_MILESTONES).doc(enterpriseId).set(docData);

  logger.info('[Milestones] Created milestone', { id: enterpriseId, code, buildingId });

  await logAuditEvent(ctx, 'data_created', buildingId, 'building', {
    newValue: { type: 'building_update', value: { id: enterpriseId, code, title, entityType: 'milestone' } },
    metadata: { reason: 'Building milestone created' },
  });

  return NextResponse.json({ success: true, id: enterpriseId });
}

// ─── Update ─────────────────────────────────────────────────────────────

const ALLOWED_UPDATE_FIELDS = [
  'title', 'description', 'date', 'status', 'progress',
  'type', 'order', 'phaseId',
];

export async function handleUpdate(
  body: UpdateMilestonePayload,
  buildingId: string,
  ctx: AuthContext,
): Promise<NextResponse<MilestoneMutationResponse>> {
  const adminDb = getAdminFirestore();
  if (!adminDb) throw new ApiError(503, 'Database unavailable');

  await requireBuildingInTenant({
    ctx,
    buildingId,
    path: `/api/buildings/${buildingId}/milestones`,
  });

  const { id, updates } = body;
  if (!id) throw new ApiError(400, 'id is required');

  const docRef = adminDb.collection(COLLECTIONS.BUILDING_MILESTONES).doc(id);
  const docSnap = await docRef.get();

  if (!docSnap.exists) throw new ApiError(404, 'Milestone not found');
  if (docSnap.data()?.buildingId !== buildingId) {
    throw new ApiError(403, 'Milestone does not belong to this building');
  }

  const cleanUpdates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (ALLOWED_UPDATE_FIELDS.includes(key) && value !== undefined) {
      cleanUpdates[key] = value;
    }
  }

  if (Object.keys(cleanUpdates).length === 0) {
    throw new ApiError(400, 'No valid fields to update');
  }

  cleanUpdates.updatedAt = FieldValue.serverTimestamp();
  cleanUpdates.updatedBy = ctx.uid;
  await docRef.update(cleanUpdates);

  logger.info('[Milestones] Updated milestone', { id, buildingId, fields: Object.keys(cleanUpdates) });

  await logAuditEvent(ctx, 'data_updated', buildingId, 'building', {
    newValue: { type: 'building_update', value: { id, fields: Object.keys(cleanUpdates), entityType: 'milestone' } },
    metadata: { reason: 'Building milestone updated' },
  });

  return NextResponse.json({ success: true, id });
}

// ─── Delete ─────────────────────────────────────────────────────────────

export async function handleDelete(
  url: string,
  buildingId: string,
  ctx: AuthContext,
): Promise<NextResponse<MilestoneMutationResponse>> {
  const adminDb = getAdminFirestore();
  if (!adminDb) throw new ApiError(503, 'Database unavailable');

  await requireBuildingInTenant({
    ctx,
    buildingId,
    path: `/api/buildings/${buildingId}/milestones`,
  });

  const { searchParams } = new URL(url);
  const id = searchParams.get('id');
  if (!id) throw new ApiError(400, 'id query param is required');

  const docRef = adminDb.collection(COLLECTIONS.BUILDING_MILESTONES).doc(id);
  const docSnap = await docRef.get();

  if (!docSnap.exists) throw new ApiError(404, 'Milestone not found');
  if (docSnap.data()?.buildingId !== buildingId) {
    throw new ApiError(403, 'Milestone does not belong to this building');
  }

  await docRef.delete();

  logger.info('[Milestones] Deleted milestone', { id, buildingId });

  await logAuditEvent(ctx, 'data_deleted', buildingId, 'building', {
    newValue: { type: 'building_update', value: { id, entityType: 'milestone' } },
    metadata: { reason: 'Building milestone deleted' },
  });

  return NextResponse.json({ success: true, id });
}
