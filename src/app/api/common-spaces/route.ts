/**
 * Common Spaces collection endpoint — GET (list) · POST (create) (ADR-931)
 *
 * GET: `?buildingId=` ⇒ the building's common spaces (building guarded first: foreign ≡ absent, 404);
 *      no filter ⇒ every common space of the caller's company (super_admin: all).
 * POST: a common space is ALWAYS anchored to a building (ΑΚ 1117 — part of the building, not of a unit).
 *
 * @module api/common-spaces
 * @permission units:units:view (GET), units:units:create (POST)
 * @rateLimit STANDARD (60 req/min)
 * @see ADR-931 (Common spaces entity), ADR-238 (Entity creation), ADR-903 §6 (hosted floor)
 */

import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext } from '@/lib/auth';
import { requireBuildingInTenant } from '@/lib/auth/tenant-isolation';
import { isRoleBypass } from '@/lib/auth/roles';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { asApiError } from '@/lib/api/api-error-types';
import { resolveNewSpaceAnchor } from '@/lib/api/space-building-project-guard';
import { mapCommonSpaceCreateFields } from '@/lib/api/space-entity-fields';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { createEntity } from '@/lib/firestore/entity-creation.service';
import { resolveHostedFloorForCreate } from '@/lib/floor/host-floor.server';
import { getErrorMessage } from '@/lib/error-utils';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { isRetired } from '@/lib/firestore/trashed-status';
import { CreateCommonSpaceSchema } from '@/lib/common-spaces/common-space-fields';
import { resolveLegalNatureForCreate } from '@/lib/common-spaces/common-space-legal.server';
import { mapCommonSpaceDoc } from '@/lib/common-spaces/common-space-mapper';
import type { CommonSpace } from '@/types/common-space';

const logger = createModuleLogger('CommonSpacesRoute');
const PATH = '/api/common-spaces';

interface CommonSpacesListData {
  commonSpaces: CommonSpace[];
  count: number;
}

interface CommonSpaceCreateData {
  commonSpaceId: string;
}

// =============================================================================
// GET
// =============================================================================

async function queryCommonSpaces(ctx: AuthContext, buildingId: string | null) {
  const db = getAdminFirestore();
  if (buildingId) {
    // 🔒 Ο φύλακας του κτιρίου ΠΡΙΝ το ερώτημα: ξένο ή ανύπαρκτο ⇒ 404 (ADR-742 §7septies).
    // Ο άξονας απομόνωσης εδώ είναι ο ΓΟΝΕΑΣ, που μόλις αποδείχθηκε δικός μας (ίδιο σχήμα με ika/employment-records).
    await requireBuildingInTenant({ ctx, buildingId, path: PATH });
    // tenant-scope-exempt: γονέας επαληθευμένος πριν (requireBuildingInTenant)
    return db.collection(COLLECTIONS.COMMON_SPACES).where(FIELDS.BUILDING_ID, '==', buildingId).get();
  }
  const collection = db.collection(COLLECTIONS.COMMON_SPACES);
  if (isRoleBypass(ctx.globalRole)) return collection.get();
  return collection.where(FIELDS.COMPANY_ID, '==', ctx.companyId).get();
}

async function handleList(request: NextRequest, ctx: AuthContext): Promise<ApiSuccessResponse<CommonSpacesListData>> {
  const buildingId = new URL(request.url).searchParams.get('buildingId')?.trim() || null;
  const snapshot = await queryCommonSpaces(ctx, buildingId);
  const commonSpaces = snapshot.docs
    .filter((doc) => !isRetired(doc.data()))
    .map((doc) => mapCommonSpaceDoc(doc.id, doc.data()));
  return apiSuccess<CommonSpacesListData>({ commonSpaces, count: commonSpaces.length }, 'Common spaces loaded');
}

export const GET = withStandardRateLimit(
  withAuth<ApiSuccessResponse<CommonSpacesListData>>(
    async (request: NextRequest, ctx: AuthContext) => {
      try {
        return await handleList(request, ctx);
      } catch (error) {
        const refusal = asApiError(error);
        if (refusal) throw refusal;
        logger.error('Error listing common spaces', { error: getErrorMessage(error) });
        throw new ApiError(500, 'Failed to list common spaces');
      }
    },
    { permissions: 'units:units:view' },
  ),
);

// =============================================================================
// POST
// =============================================================================

async function handleCreate(request: NextRequest, ctx: AuthContext): Promise<ApiSuccessResponse<CommonSpaceCreateData>> {
  const parsed = safeParseBody(CreateCommonSpaceSchema, await request.json());
  if (parsed.error) throw new ApiError(400, 'Validation failed');
  const body = parsed.data;
  const db = getAdminFirestore();

  // ADR-898 §21.6 — η άγκυρα από τον ΕΝΑ επιλυτή: το έργο προκύπτει από το κτίριο (ποτέ ωμό από το σώμα).
  const { buildingId, projectId } = await resolveNewSpaceAnchor({ ctx, path: PATH }, body);
  if (!buildingId) throw new ApiError(400, 'Common space requires a building');
  const hosted = await resolveHostedFloorForCreate(db, ctx, body.floorId, buildingId);
  const legal = await resolveLegalNatureForCreate(db, ctx, buildingId, body);

  const result = await createEntity('common_space', {
    auth: ctx,
    parentId: buildingId,
    entitySpecificFields: {
      name: body.name,
      category: body.category,
      buildingId,
      ...(projectId ? { projectId } : {}),
      legalNature: legal.legalNature,
      exclusiveUsePropertyIds: [...legal.exclusiveUsePropertyIds],
      ...mapCommonSpaceCreateFields(body),
      ...hosted,
    },
    apiPath: `${PATH} (POST)`,
  });

  logger.info('Common space created', { id: result.id, buildingId, companyId: ctx.companyId });
  return apiSuccess<CommonSpaceCreateData>({ commonSpaceId: result.id }, 'Common space created');
}

export const POST = withStandardRateLimit(
  withAuth<ApiSuccessResponse<CommonSpaceCreateData>>(
    async (request: NextRequest, ctx: AuthContext) => {
      try {
        return await handleCreate(request, ctx);
      } catch (error) {
        const refusal = asApiError(error);
        if (refusal) throw refusal;
        logger.error('Error creating common space', { error: getErrorMessage(error) });
        throw new ApiError(500, 'Failed to create common space');
      }
    },
    { permissions: 'units:units:create' },
  ),
);
