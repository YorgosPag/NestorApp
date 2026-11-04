/**
 * =============================================================================
 * Κοινόχρηστος χώρος — έλεγχος νομικής φύσης απέναντι στη βάση (server, ADR-931)
 * =============================================================================
 *
 * Ο καθαρός κανόνας (`resolveLegalNature`) λέει **τι** γράφεται· εδώ ελέγχεται ότι οι
 * ιδιοκτησίες αποκλειστικής χρήσης **υπάρχουν, είναι του καλούντος, ζωντανές, και στο ΙΔΙΟ
 * κτίριο** — ΑΚ 1117: αποκλειστική χρήση κοινόκτητου δίνεται μόνο σε ιδιοκτησία της ίδιας
 * οικοδομής. Ξένη ή ανύπαρκτη ιδιοκτησία ⇒ η **ίδια** άρνηση (κανένα μαντείο ύπαρξης, ADR-742).
 *
 * @module lib/common-spaces/common-space-legal.server
 */

import 'server-only';

import type { Firestore } from 'firebase-admin/firestore';
import type { AuthContext } from '@/lib/auth';
import { COLLECTIONS } from '@/config/firestore-collections';
import { ApiError } from '@/lib/api/ApiErrorHandler';
import { isRoleBypass } from '@/lib/auth/roles';
import { isPayloadOwnedByCompany } from '@/lib/auth/tenant-ownership';
import { isRetired } from '@/lib/firestore/trashed-status';
import {
  LEGAL_NATURE_REJECTION_MESSAGE,
  resolveLegalNature,
  touchesLegalNature,
  type UpdateCommonSpaceBody,
} from '@/lib/common-spaces/common-space-fields';
import type { CommonSpaceLegalNature } from '@/constants/common-space-categories';

const FOREIGN_PROPERTY_MESSAGE = 'Exclusive-use properties must be live properties of the same building';

/** Ρίχνει 400 αν έστω μία ιδιοκτησία δεν είναι ζωντανή ιδιοκτησία του καλούντος στο `buildingId`. */
async function assertPropertiesInBuilding(
  db: Firestore,
  ctx: AuthContext,
  buildingId: string,
  propertyIds: readonly string[],
): Promise<void> {
  if (propertyIds.length === 0) return;
  const refs = propertyIds.map((id) => db.collection(COLLECTIONS.PROPERTIES).doc(id));
  const snaps = await db.getAll(...refs);
  const bypass = isRoleBypass(ctx.globalRole);
  const allValid = snaps.every((snap) => {
    const data = snap.data();
    return snap.exists
      && data?.buildingId === buildingId
      && !isRetired(data)
      && (bypass || isPayloadOwnedByCompany(data, ctx.companyId));
  });
  if (!allValid) throw new ApiError(400, FOREIGN_PROPERTY_MESSAGE);
}

export interface LegalNatureFields {
  readonly legalNature: CommonSpaceLegalNature;
  readonly exclusiveUsePropertyIds: readonly string[];
}

/** Δημιουργία: η νομική κατάσταση της γέννησης, ελεγμένη. */
export async function resolveLegalNatureForCreate(
  db: Firestore,
  ctx: AuthContext,
  buildingId: string,
  body: Parameters<typeof resolveLegalNature>[0],
): Promise<LegalNatureFields> {
  const resolved = resolveLegalNature(body);
  if (resolved.kind === 'rejected') throw new ApiError(400, LEGAL_NATURE_REJECTION_MESSAGE[resolved.reason]);
  await assertPropertiesInBuilding(db, ctx, buildingId, resolved.exclusiveUsePropertyIds);
  return { legalNature: resolved.legalNature, exclusiveUsePropertyIds: resolved.exclusiveUsePropertyIds };
}

/**
 * Ενημέρωση: `{}` όταν δεν αγγίζεται ούτε η φύση ούτε το κτίριο. Αλλαγή κτιρίου με
 * αποκλειστική χρήση **ξαναελέγχει** τις ιδιοκτησίες στο **νέο** κτίριο — αλλιώς ο χώρος
 * θα «μετέφερε» σιωπηλά αποκλειστικότητα σε ιδιοκτησίες άλλης οικοδομής.
 */
export async function resolveLegalNatureForPatch(
  db: Firestore,
  ctx: AuthContext,
  body: UpdateCommonSpaceBody,
  existing: Readonly<Record<string, unknown>>,
): Promise<Partial<LegalNatureFields>> {
  const movesBuilding = body.buildingId !== undefined && body.buildingId !== existing.buildingId;
  if (!touchesLegalNature(body) && !movesBuilding) return {};
  const resolved = resolveLegalNature(body, existing);
  if (resolved.kind === 'rejected') throw new ApiError(400, LEGAL_NATURE_REJECTION_MESSAGE[resolved.reason]);
  const buildingId = body.buildingId ?? (typeof existing.buildingId === 'string' ? existing.buildingId : '');
  await assertPropertiesInBuilding(db, ctx, buildingId, resolved.exclusiveUsePropertyIds);
  return { legalNature: resolved.legalNature, exclusiveUsePropertyIds: resolved.exclusiveUsePropertyIds };
}
