/**
 * Storage Unit PATCH / DELETE / GET endpoint
 *
 * Thin configuration over the `createSpaceEntityRoutes` SSoT — the whole
 * pipeline (tenant guard → parse → version-checked write → allocationCode
 * cascade → building link → audit → envelope) lives once in
 * `@/lib/api/space-entity-route`. Only what genuinely differs from the parking
 * twin is declared here.
 *
 * @module api/storages/[id]
 * @permission units:units:update (PATCH), units:units:delete (DELETE), units:units:view (GET)
 * @rateLimit STANDARD (60 req/min)
 * @see ADR-184 (Building Spaces Tabs), ADR-696 (space-entity route SSoT)
 */

import { z } from 'zod';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { requireStorageInTenant } from '@/lib/auth/tenant-isolation';
import { createSpaceEntityRoutes } from '@/lib/api/space-entity-route';
import { SPACE_COMMON_UPDATE_FIELDS } from '@/lib/api/space-entity-fields';
import { SPACE_OBJECTIVE_VALUE_POSITION_FIELD } from '@/lib/objective-value/building-space-objective-value';
import { STORAGE_POSITIONS } from '@/lib/objective-value/objective-value-types';

const logger = createModuleLogger('StoragesIdRoute');

/** Storage-only fields on top of the shared building-space shape. */
const UpdateStorageSchema = z.object({
  name: z.string().max(200).optional(),
  /** ADR-898 §19 — η θέση κατά την ΠΟΛ.1149/1994 (άρθ. 6 §4), όταν τη δηλώνει ο άνθρωπος· `null` = «σβήσε». */
  [SPACE_OBJECTIVE_VALUE_POSITION_FIELD]: z.enum(STORAGE_POSITIONS).nullable().optional(),
  ...SPACE_COMMON_UPDATE_FIELDS,
}).passthrough();

type UpdateStorageBody = z.infer<typeof UpdateStorageSchema>;

export const { PATCH, DELETE, GET } = createSpaceEntityRoutes<UpdateStorageBody>({
  collection: COLLECTIONS.STORAGE,
  entityKind: 'storage',
  apiPath: '/api/storages/[id]',
  logger,
  auditResource: 'storage',
  auditIdKey: 'storageId',
  displayField: 'name',
  requireInTenant: ({ ctx, id, path }) => requireStorageInTenant({ ctx, storageId: id, path }),
  updateSchema: UpdateStorageSchema,

  /** Storage-only fields — the shared mapper covers the rest. */
  mapExtraFields: (body) => {
    // ADR-903 §6 — το `floorId` είναι πλέον κοινό (και στο parking) και το επιλύει ο handler.
    const extra: Record<string, unknown> = {};
    const position = body[SPACE_OBJECTIVE_VALUE_POSITION_FIELD];
    if (position !== undefined) extra[SPACE_OBJECTIVE_VALUE_POSITION_FIELD] = position;
    return extra;
  },

  messages: {
    idRequired: 'Storage ID is required',
    updated: 'Storage unit updated',
    movedToTrash: 'Storage unit moved to trash',
    loaded: 'Storage unit loaded',
    notFound: 'Storage unit not found',
    updateFailed: 'Failed to update storage unit',
    deleteFailed: 'Failed to delete storage unit',
    logUpdateError: 'Error updating storage',
    logDeleteError: 'Error deleting storage',
    logUpdated: 'Storage unit updated',
    logMovedToTrash: 'Storage unit moved to trash',
    auditUpdateReason: 'Storage unit updated via API',
    auditDeleteReason: 'Storage unit moved to trash via API',
  },
});
