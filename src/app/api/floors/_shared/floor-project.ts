import 'server-only';

/**
 * Το έργο ενός ορόφου για τον κριτή (ADR-926 Κ3).
 *
 * ⚠️ Το έργο του ορόφου είναι το έργο του **κτιρίου του**. Το πεδίο `floor.projectId` δεν διαβάζεται επίτηδες: είναι
 * παράγωγο, και ιστορικά έφτανε από το σώμα του `POST` (ADR-829 §7.1).
 *
 * @module app/api/floors/_shared/floor-project
 * @see lib/auth/resource-project — η μία απάντηση για τα κτίρια
 */

import type { NextRequest } from 'next/server';

import { ApiError } from '@/lib/api/ApiErrorHandler';
import { bodyText, NO_PROJECT, projectOfBuilding, type PermissionResource } from '@/lib/auth/resource-project';
import type { AuthContext } from '@/lib/auth';
import { floorResource } from './floor-ownership';

/**
 * `floorId` στο σώμα: `PATCH /api/floors`. Όροφος χωρίς κτίριο δεν ανήκει σε έργο.
 *
 * @throws ApiError(404) ξένος ή ανύπαρκτος όροφος
 * @throws TenantIsolationError(404) ξένο ή ανύπαρκτο κτίριο
 */
export async function projectOfBodyFloor(request: NextRequest, ctx: AuthContext, path: string): Promise<PermissionResource> {
  const floorId = await bodyText(request, 'floorId');
  if (floorId === null) return NO_PROJECT;

  const owned = await floorResource.load({
    docId: floorId,
    caller: ctx,
    action: 'authorize',
    refusal: () => new ApiError(404, floorResource.notFoundMessage),
  });
  if (owned.refusal) throw owned.refusal;

  const buildingId = owned.doc.data?.buildingId;
  return typeof buildingId === 'string' && buildingId.length > 0
    ? projectOfBuilding(ctx, buildingId, path)
    : NO_PROJECT;
}
