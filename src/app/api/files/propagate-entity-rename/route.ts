/**
 * =============================================================================
 * Entity Rename → File Display Name Cascade API
 * =============================================================================
 *
 * POST /api/files/propagate-entity-rename
 * Body: { entityType: AuditEntityType, entityId: string, newEntityLabel: string }
 *
 * Updates FileRecord.displayName for every file attached to the renamed entity.
 * See services/filesystem/entity-file-display-propagator.service.ts for the
 * propagation algorithm.
 *
 * @module api/files/propagate-entity-rename
 * @enterprise ADR-293 Phase 8 — Entity Display Name Cascade
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { COLLECTIONS } from '@/config/firestore-collections';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { EntityFileDisplayPropagator } from '@/services/filesystem/entity-file-display-propagator.service';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import type { AuditEntityType } from '@/types/audit-trail';

const logger = createModuleLogger('PropagateEntityRenameRoute');

export const maxDuration = 60;

const ENTITY_COLLECTION_MAP: Readonly<Record<AuditEntityType, string>> = {
  contact: COLLECTIONS.CONTACTS,
  building: COLLECTIONS.BUILDINGS,
  property: COLLECTIONS.PROPERTIES,
  floor: COLLECTIONS.FLOORS,
  project: COLLECTIONS.PROJECTS,
  company: COLLECTIONS.COMPANIES,
  parking: COLLECTIONS.PARKING_SPACES,
  storage: COLLECTIONS.STORAGE,
  purchase_order: COLLECTIONS.PURCHASE_ORDERS,
};

interface PropagateRenameRequest {
  readonly entityType: AuditEntityType;
  readonly entityId: string;
  readonly newEntityLabel: string;
}

interface PropagatedFilePayload {
  readonly fileId: string;
  readonly newDisplayName: string;
}

interface PropagateRenameResponse {
  readonly success: boolean;
  readonly updatedCount?: number;
  readonly skippedCount?: number;
  readonly updatedFiles?: readonly PropagatedFilePayload[];
  readonly error?: string;
}

function isAuditEntityType(value: unknown): value is AuditEntityType {
  return typeof value === 'string' && value in ENTITY_COLLECTION_MAP;
}

async function assertEntityOwnership(
  entityType: AuditEntityType,
  entityId: string,
  callerCompanyId: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const collection = ENTITY_COLLECTION_MAP[entityType];
  const snap = await getAdminFirestore().collection(collection).doc(entityId).get();
  if (!snap.exists) {
    return { ok: false, status: 404, error: 'Entity not found' };
  }
  const data = snap.data();
  const entityCompanyId = typeof data?.companyId === 'string' ? data.companyId : null;
  if (!entityCompanyId || entityCompanyId !== callerCompanyId) {
    return { ok: false, status: 403, error: 'Forbidden: entity belongs to a different tenant' };
  }
  return { ok: true };
}

async function handlePost(
  request: NextRequest,
  ctx: AuthContext,
  _cache: PermissionCache,
): Promise<NextResponse<PropagateRenameResponse>> {
  try {
    const body = (await request.json()) as Partial<PropagateRenameRequest>;

    if (!isAuditEntityType(body.entityType)) {
      return NextResponse.json(
        { success: false, error: 'Invalid entityType' },
        { status: 400 },
      );
    }
    if (typeof body.entityId !== 'string' || body.entityId.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'entityId is required' },
        { status: 400 },
      );
    }
    if (typeof body.newEntityLabel !== 'string' || body.newEntityLabel.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'newEntityLabel is required' },
        { status: 400 },
      );
    }

    const ownership = await assertEntityOwnership(body.entityType, body.entityId, ctx.companyId);
    if (!ownership.ok) {
      return NextResponse.json(
        { success: false, error: ownership.error },
        { status: ownership.status },
      );
    }

    const result = await EntityFileDisplayPropagator.propagate({
      entityType: body.entityType,
      entityId: body.entityId,
      newEntityLabel: body.newEntityLabel,
      companyId: ctx.companyId,
      performedBy: ctx.uid,
      performedByName: ctx.email ?? null,
    });

    return NextResponse.json({
      success: true,
      updatedCount: result.updatedCount,
      skippedCount: result.skippedCount,
      updatedFiles: result.updatedFiles,
    });
  } catch (err) {
    const message = getErrorMessage(err, 'Propagation failed');
    logger.error('Propagation route error', { error: message });
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}

const authedHandler = withAuth(handlePost);
export const POST = withStandardRateLimit(authedHandler);
