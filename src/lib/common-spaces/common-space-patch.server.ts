/**
 * =============================================================================
 * Κοινόχρηστος χώρος — τα πεδία του PATCH που κρίνονται απέναντι στο αποθηκευμένο (server, ADR-931)
 * =============================================================================
 *
 * Το **ένα** `resolveAsyncFields` της διαδρομής `common-spaces/[id]`: συνθέτει τις δύο ανεξάρτητες κρίσεις
 * (νομική φύση · πηγή εμβαδού) ώστε το route να μένει λεπτή διαμόρφωση. Άρνηση = `ApiError` **πριν** τη γραφή.
 *
 * @module lib/common-spaces/common-space-patch.server
 */

import 'server-only';

import { ApiError } from '@/lib/api/ApiErrorHandler';
import type { SpaceAsyncFieldsScope } from '@/lib/api/space-entity-route-types';
import { resolveLegalNatureForPatch } from '@/lib/common-spaces/common-space-legal.server';
import { AREA_SOURCE_REJECTION_MESSAGE, resolveAreaSourcePatch } from '@/lib/common-spaces/common-space-area';
import type { UpdateCommonSpaceBody } from '@/lib/common-spaces/common-space-fields';

/** ADR-931 Β1 — «υιοθέτησε το σχεδιασμένο» / νέα δήλωση: τι γράφεται για την πηγή του εμβαδού. */
function resolveAreaSourceFields(
  body: UpdateCommonSpaceBody,
  existing: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  const resolved = resolveAreaSourcePatch(body, existing);
  if (resolved.kind === 'rejected') throw new ApiError(422, AREA_SOURCE_REJECTION_MESSAGE[resolved.reason]);
  return resolved.fields;
}

export async function resolveCommonSpacePatchFields(
  scope: SpaceAsyncFieldsScope<UpdateCommonSpaceBody>,
): Promise<Record<string, unknown>> {
  const { adminDb, ctx, body, existing } = scope;
  const areaFields = resolveAreaSourceFields(body, existing);
  const legalFields = await resolveLegalNatureForPatch(adminDb, ctx, body, existing);
  return { ...legalFields, ...areaFields };
}
