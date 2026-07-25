/**
 * =============================================================================
 * SSoT: Building-space entity route handlers (`/api/parking/[id]`, `/api/storages/[id]`)
 * =============================================================================
 *
 * ONE owner of the PATCH / DELETE / GET pipeline for a «building space» — the
 * domain family the codebase already treats as siblings everywhere else
 * (`propagateSpaceAllocationCodeChange`, `linkedSpaces`, the
 * `requireParkingInTenant` / `requireStorageInTenant` twins, the mirrored trash
 * routes). Before this, `api/parking/[id]/route.ts` and `api/storages/[id]/route.ts`
 * carried **nine** token-identical clone blocks (~750 tokens): tenant guard →
 * doc read → schema parse → updateData build → `withVersionCheck` →
 * allocationCode cascade → `linkEntity` → audit → envelope.
 *
 * COMPOSITION, NOT RE-IMPLEMENTATION — every primitive stays where it lives:
 *   withStandardRateLimit → withAuth → try/catch → safeParseBody → withVersionCheck
 *   → softDelete → linkEntity → propagateSpaceAllocationCodeChange → logAuditEvent
 *
 * WIRE CONTRACT IS FROZEN. Response `message` strings, status codes and audit
 * payload shapes are injected verbatim per entity (see {@link SpaceEntityMessages})
 * rather than templated, because the two routes were NOT consistent with each
 * other ('Parking spot ID is required' vs 'Storage ID is required', logger says
 * 'storage' where the message says 'storage unit'). Centralizing must not silently
 * rewrite what clients already receive — the divergence is now declared data
 * instead of hidden copy-paste drift.
 *
 * This module is the thin public factory; the handler internals live in
 * `space-entity-handlers.ts` and the contract types in `space-entity-route-types.ts`
 * (three files so each stays under the CHECK 4 size limit for a `route.ts` name).
 *
 * @module lib/api/space-entity-route
 * @see ADR-696 Building-space route SSoT (this module)
 * @see ADR-602 API Route-Handler Factory SSoT (the generic `defineRoute` layer)
 * @see ADR-184 Building Spaces Tabs
 * @see ADR-233 Entity coding · ADR-239 Entity linking · ADR-247 F-4 allocationCode cascade
 * @see ADR-281 Soft-delete · SPEC-256A Version-checked writes
 */

import 'server-only';

import { withAuth } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import {
  buildPatchHandler,
  buildDeleteHandler,
  buildGetHandler,
} from '@/lib/api/space-entity-handlers';
import type { SpaceEntityRouteConfig, SpaceMutationResult } from '@/lib/api/space-entity-route-types';

export type {
  SpaceMutationResult,
  SpaceEntityMessages,
  SpaceEntityRouteConfig,
} from '@/lib/api/space-entity-route-types';

/**
 * Build the `{ PATCH, DELETE, GET }` handler trio for a building-space entity.
 *
 * Permissions are fixed (`units:units:update` / `:delete` / `:view`) because both
 * space entities live under the same RBAC resource — a divergence here would be a
 * security decision, not a configuration one, and must be made explicitly.
 */
export function createSpaceEntityRoutes<TBody extends Record<string, unknown>>(
  cfg: SpaceEntityRouteConfig<TBody>,
) {
  return {
    PATCH: withStandardRateLimit(
      withAuth<ApiSuccessResponse<SpaceMutationResult>>(
        buildPatchHandler(cfg),
        { permissions: 'units:units:update' },
      ),
    ),
    DELETE: withStandardRateLimit(
      withAuth<ApiSuccessResponse<SpaceMutationResult>>(
        buildDeleteHandler(cfg),
        { permissions: 'units:units:delete' },
      ),
    ),
    GET: withStandardRateLimit(
      withAuth<ApiSuccessResponse<Record<string, unknown>>>(
        buildGetHandler(cfg),
        { permissions: 'units:units:view' },
      ),
    ),
  };
}
