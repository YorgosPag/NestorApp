/**
 * =============================================================================
 * Handler builders for the building-space route SSoT
 * =============================================================================
 *
 * The PATCH / DELETE / GET pipeline internals for a «building space», composed
 * from existing primitives (NEVER re-implemented):
 *   withVersionCheck → softDelete → linkEntity → propagateSpaceAllocationCodeChange
 *   → logAuditEvent
 *
 * The public factory that wraps these with `withAuth` + `withStandardRateLimit`
 * lives in `space-entity-route.ts`; the shared contract types live in
 * `space-entity-route-types.ts`. Split out of the original single-file module so
 * each file keeps one responsibility (the `route.ts` name is limited to 300 lines).
 *
 * @module lib/api/space-entity-handlers
 * @see ADR-696 Building-space route SSoT
 * @see ADR-233 Entity coding · ADR-239 Entity linking · ADR-247 F-4 allocationCode cascade
 * @see ADR-281 Soft-delete · SPEC-256A Version-checked writes
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { logAuditEvent } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { extractIdFromUrl } from '@/lib/api/route-helpers';
import { getErrorMessage } from '@/lib/error-utils';
import { softDelete } from '@/lib/firestore/soft-delete-engine';
import { linkEntity } from '@/lib/firestore/entity-linking.service';
import { propagateSpaceAllocationCodeChange } from '@/lib/firestore/cascade-propagation.service';
import { withVersionCheck, ConflictError } from '@/lib/firestore/version-check';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { mapCommonSpaceFields, resolveAllocationCodeChange } from '@/lib/api/space-entity-fields';
import type {
  SpaceEntityRouteConfig,
  SpaceMutationResult,
} from '@/lib/api/space-entity-route-types';

// =============================================================================
// SIDE EFFECTS (fire-and-forget by design — never block the mutation response)
// =============================================================================

/** ADR-247 F-4 — cascade the allocation code onto `linkedSpaces` of units. */
function cascadeAllocationCode<TBody extends Record<string, unknown>>(
  cfg: SpaceEntityRouteConfig<TBody>,
  id: string,
  body: TBody,
  existing: Record<string, unknown>,
): void {
  const newDisplayCode = resolveAllocationCodeChange(body, existing, cfg.displayField);
  if (!newDisplayCode) return;

  propagateSpaceAllocationCodeChange(id, newDisplayCode, (existing.buildingId as string) ?? null)
    .catch((err) => cfg.logger.warn('allocationCode cascade failed (non-blocking)', {
      id, error: getErrorMessage(err),
    }));
}

/** ADR-239 — centralized building link: change detection + cascade + entity audit. */
function cascadeBuildingLink<TBody extends Record<string, unknown>>(
  cfg: SpaceEntityRouteConfig<TBody>,
  ctx: AuthContext,
  id: string,
  body: TBody,
  existing: Record<string, unknown>,
): void {
  if (body.buildingId === undefined) return;

  linkEntity(`${cfg.entityKind}:buildingId`, {
    auth: ctx,
    entityId: id,
    newLinkValue: (body.buildingId as string | null) ?? null,
    existingDoc: existing,
    apiPath: `${cfg.apiPath} (PATCH)`,
  }).catch((err) => {
    cfg.logger.warn('linkEntity failed (non-blocking)', { id, error: getErrorMessage(err) });
  });
}

// =============================================================================
// HANDLERS
// =============================================================================

/** The Admin Firestore handle, after the 503 guard has proven it exists. */
type AdminFirestore = NonNullable<ReturnType<typeof getAdminFirestore>>;

/** Resolve the admin DB + route id, or throw the route's canonical errors. */
function requireDbAndId<TBody extends Record<string, unknown>>(
  cfg: SpaceEntityRouteConfig<TBody>,
  request: NextRequest,
): { adminDb: AdminFirestore; id: string } {
  const adminDb = getAdminFirestore();
  if (!adminDb) throw new ApiError(503, 'Database unavailable');

  const id = extractIdFromUrl(request.url);
  if (!id) throw new ApiError(400, cfg.messages.idRequired);

  return { adminDb, id };
}

/**
 * 🔒 Centralized tenant isolation (existence + companyId + audit logging), then
 * read the current document. Every mutating handler needs exactly this prologue,
 * in this order — the guard MUST run before any read reaches the caller.
 */
async function guardAndLoad<TBody extends Record<string, unknown>>(
  cfg: SpaceEntityRouteConfig<TBody>,
  ctx: AuthContext,
  adminDb: AdminFirestore,
  id: string,
): Promise<Record<string, unknown>> {
  await cfg.requireInTenant({ ctx, id, path: cfg.apiPath });

  const doc = await adminDb.collection(cfg.collection).doc(id).get();
  return doc.data() as Record<string, unknown>;
}

/** Everything a mutating handler body receives once the prologue has succeeded. */
interface MutationScope {
  adminDb: AdminFirestore;
  id: string;
  ctx: AuthContext;
  request: NextRequest;
  /** The document as stored BEFORE the mutation (drives cascades + delete audit). */
  existing: Record<string, unknown>;
}

/**
 * Skeleton shared by PATCH and DELETE: resolve db+id → tenant guard + load →
 * run the body → canonical error funnel.
 *
 * `ConflictError` is handled here for BOTH verbs. DELETE performs no version
 * check so it can never raise one — the branch is inert there, and keeping one
 * funnel is safer than two that can drift.
 */
function buildMutationHandler<TBody extends Record<string, unknown>>(
  cfg: SpaceEntityRouteConfig<TBody>,
  errors: { log: string; fallback: string },
  run: (scope: MutationScope) => Promise<NextResponse | ApiSuccessResponse<SpaceMutationResult>>,
) {
  return async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
    const { adminDb, id } = requireDbAndId(cfg, request);

    try {
      const existing = await guardAndLoad(cfg, ctx, adminDb, id);
      return await run({ adminDb, id, ctx, request, existing });
    } catch (error) {
      if (error instanceof ConflictError) {
        return NextResponse.json(error.body, { status: error.statusCode });
      }
      if (error instanceof ApiError) throw error;
      cfg.logger.error(errors.log, { id, error: getErrorMessage(error) });
      throw new ApiError(500, getErrorMessage(error, errors.fallback));
    }
  };
}

export function buildPatchHandler<TBody extends Record<string, unknown>>(
  cfg: SpaceEntityRouteConfig<TBody>,
) {
  return buildMutationHandler(
    cfg,
    { log: cfg.messages.logUpdateError, fallback: cfg.messages.updateFailed },
    async ({ adminDb, id, ctx, request, existing }) => {
      const parsed = safeParseBody(cfg.updateSchema, await request.json());
      if (parsed.error) throw new ApiError(400, 'Validation failed');
      const { _v: expectedVersion, ...rest } = parsed.data as TBody & { _v?: number };
      const body = rest as unknown as TBody;

      // SPEC-256A: updatedAt + updatedBy injected by withVersionCheck
      const updateData = {
        ...mapCommonSpaceFields(body, cfg.displayField),
        ...cfg.mapExtraFields(body),
      };

      const versionResult = await withVersionCheck({
        db: adminDb,
        collection: cfg.collection,
        docId: id,
        expectedVersion,
        updates: updateData,
        userId: ctx.uid,
      });

      cascadeAllocationCode(cfg, id, body, existing);
      cascadeBuildingLink(cfg, ctx, id, body, existing);

      // ADR-029 Phase D: search_documents written by the entity's Cloud Function.
      cfg.logger.info(cfg.messages.logUpdated, { id, companyId: ctx.companyId });

      await logAuditEvent(ctx, 'data_updated', cfg.auditResource, 'api', {
        newValue: {
          type: 'status',
          value: { [cfg.auditIdKey]: id, updates: Object.keys(updateData) },
        },
        metadata: { reason: cfg.messages.auditUpdateReason },
      });

      return apiSuccess<SpaceMutationResult>(
        { id, _v: versionResult.newVersion },
        cfg.messages.updated,
      );
    },
  );
}

export function buildDeleteHandler<TBody extends Record<string, unknown>>(
  cfg: SpaceEntityRouteConfig<TBody>,
) {
  return buildMutationHandler(
    cfg,
    { log: cfg.messages.logDeleteError, fallback: cfg.messages.deleteFailed },
    async ({ adminDb, id, ctx, existing }) => {
      // 🗑️ ADR-281: Soft-delete — move to trash (status='deleted')
      await softDelete(adminDb, cfg.entityKind, id, ctx.uid, ctx.companyId, ctx.email ?? undefined);

      cfg.logger.info(cfg.messages.logMovedToTrash, { id, companyId: ctx.companyId });

      // Auth audit (the soft-delete engine handles the entity audit)
      await logAuditEvent(ctx, 'soft_deleted', cfg.auditResource, 'api', {
        newValue: {
          type: 'status',
          value: { [cfg.auditIdKey]: id, [cfg.displayField]: existing[cfg.displayField] },
        },
        metadata: { reason: cfg.messages.auditDeleteReason },
      });

      return apiSuccess<SpaceMutationResult>({ id }, cfg.messages.movedToTrash);
    },
  );
}

export function buildGetHandler<TBody extends Record<string, unknown>>(
  cfg: SpaceEntityRouteConfig<TBody>,
) {
  return async (request: NextRequest, ctx: AuthContext) => {
    const { adminDb, id } = requireDbAndId(cfg, request);

    await cfg.requireInTenant({ ctx, id, path: cfg.apiPath });

    const doc = await adminDb.collection(cfg.collection).doc(id).get();
    if (!doc.exists) throw new ApiError(404, cfg.messages.notFound);

    return apiSuccess({ id: doc.id, ...doc.data() }, cfg.messages.loaded);
  };
}
