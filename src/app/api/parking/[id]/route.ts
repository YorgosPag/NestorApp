/**
 * Parking Spot PATCH / DELETE / GET endpoint
 *
 * Thin configuration over the `createSpaceEntityRoutes` SSoT — the whole
 * pipeline (tenant guard → parse → version-checked write → allocationCode
 * cascade → building link → audit → envelope) lives once in
 * `@/lib/api/space-entity-route`. Only what genuinely differs from the storage
 * twin is declared here.
 *
 * @module api/parking/[id]
 * @permission units:units:update (PATCH), units:units:delete (DELETE), units:units:view (GET)
 * @rateLimit STANDARD (60 req/min)
 * @see ADR-184 (Building Spaces Tabs), ADR-696 (space-entity route SSoT)
 */

import { z } from 'zod';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { requireParkingInTenant } from '@/lib/auth/tenant-isolation';
import { createSpaceEntityRoutes } from '@/lib/api/space-entity-route';
import { SPACE_COMMON_UPDATE_FIELDS } from '@/lib/api/space-entity-fields';

const logger = createModuleLogger('ParkingIdRoute');

/** Parking-only fields on top of the shared building-space shape. */
const UpdateParkingSchema = z.object({
  number: z.string().max(50).optional(),
  locationZone: z.string().max(100).nullable().optional(),
  location: z.string().max(200).nullable().optional(),
  projectId: z.string().max(128).optional(),
  ...SPACE_COMMON_UPDATE_FIELDS,
}).passthrough();

type UpdateParkingBody = z.infer<typeof UpdateParkingSchema>;

export const { PATCH, DELETE, GET } = createSpaceEntityRoutes<UpdateParkingBody>({
  collection: COLLECTIONS.PARKING_SPACES,
  entityKind: 'parking',
  apiPath: '/api/parking/[id]',
  logger,
  auditResource: 'parking_spot',
  auditIdKey: 'parkingSpotId',
  displayField: 'number',
  requireInTenant: ({ ctx, id, path }) => requireParkingInTenant({ ctx, parkingId: id, path }),
  updateSchema: UpdateParkingSchema,

  /** Parking-only fields — the shared mapper covers the rest. */
  mapExtraFields: (body) => {
    const extra: Record<string, unknown> = {};
    if (body.location !== undefined) extra.location = body.location?.trim() || null;
    if (body.locationZone !== undefined) extra.locationZone = body.locationZone ?? null;
    if (body.projectId?.trim()) extra.projectId = body.projectId.trim();
    return extra;
  },

  messages: {
    idRequired: 'Parking spot ID is required',
    updated: 'Parking spot updated',
    movedToTrash: 'Parking spot moved to trash',
    loaded: 'Parking spot loaded',
    notFound: 'Parking spot not found',
    updateFailed: 'Failed to update parking spot',
    deleteFailed: 'Failed to delete parking spot',
    logUpdateError: 'Error updating parking spot',
    logDeleteError: 'Error deleting parking spot',
    logUpdated: 'Parking spot updated',
    logMovedToTrash: 'Parking spot moved to trash',
    auditUpdateReason: 'Parking spot updated via API',
    auditDeleteReason: 'Parking spot moved to trash via API',
  },
});
