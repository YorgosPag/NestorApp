/**
 * Common Space PATCH / DELETE / GET endpoint (ADR-931)
 *
 * Thin configuration over the `createSpaceEntityRoutes` SSoT (ADR-696). What differs from
 * parking/storage is declared here — and the pipeline itself skips every transferable-only
 * step for `common_space` (ΑΚ 1117: not independently transferable), via
 * `SPACE_ENTITY_CAPABILITIES`.
 *
 * @module api/common-spaces/[id]
 * @permission units:units:update (PATCH), units:units:delete (DELETE), units:units:view (GET)
 * @rateLimit STANDARD (60 req/min)
 * @see ADR-931 (Common spaces entity), ADR-696 (space-entity route SSoT)
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { requireCommonSpaceInTenant } from '@/lib/auth/tenant-isolation';
import { createSpaceEntityRoutes } from '@/lib/api/space-entity-route';
import {
  UpdateCommonSpaceSchema,
  mapCommonSpaceExtraFields,
  type UpdateCommonSpaceBody,
} from '@/lib/common-spaces/common-space-fields';
import { resolveLegalNatureForPatch } from '@/lib/common-spaces/common-space-legal.server';

const logger = createModuleLogger('CommonSpacesIdRoute');

export const { PATCH, DELETE, GET } = createSpaceEntityRoutes<UpdateCommonSpaceBody>({
  collection: COLLECTIONS.COMMON_SPACES,
  category: 'STANDARD',
  entityKind: 'common_space',
  apiPath: '/api/common-spaces/[id]',
  logger,
  auditResource: 'common_space',
  auditIdKey: 'commonSpaceId',
  displayField: 'name',
  requireInTenant: ({ ctx, id, path }) => requireCommonSpaceInTenant({ ctx, commonSpaceId: id, path }),
  updateSchema: UpdateCommonSpaceSchema,
  mapExtraFields: mapCommonSpaceExtraFields,
  resolveAsyncFields: ({ adminDb, ctx, body, existing }) => resolveLegalNatureForPatch(adminDb, ctx, body, existing),

  messages: {
    idRequired: 'Common space ID is required',
    updated: 'Common space updated',
    movedToTrash: 'Common space moved to trash',
    loaded: 'Common space loaded',
    notFound: 'Common space not found',
    updateFailed: 'Failed to update common space',
    deleteFailed: 'Failed to delete common space',
    logUpdateError: 'Error updating common space',
    logDeleteError: 'Error deleting common space',
    logUpdated: 'Common space updated',
    logMovedToTrash: 'Common space moved to trash',
    auditUpdateReason: 'Common space updated via API',
    auditDeleteReason: 'Common space moved to trash via API',
  },
});
