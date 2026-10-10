/**
 * @fileoverview **Η ΑΦΑΙΡΕΣΗ ΤΟΥ ΟΡΟΦΟΥ** — κρίση «ενδιάμεσος;», διαγραφή και επανατοποθέτηση ειδικών σταθμών σε ΜΙΑ
 * συναλλαγή, κάτω από το κλειδί της στοίβας.
 * @module api/floors/floor-removal
 * @see ./floor-stack-authority — το σύνορο · @see ./floor-birth — η συμμετρική πράξη
 *
 * 🔴 Ως τις 2026-10-10 ο έλεγχος «ενδιάμεσος όροφος» διάβαζε τα αδέλφια **έξω** από συναλλαγή (και χωρίς `companyId`):
 * δύο ταυτόχρονες διαγραφές (του 1ου και του 3ου) περνούσαν και οι δύο και άφηναν τον 2ο να αιωρείται. Και η
 * επανατοποθέτηση της θεμελίωσης έτρεχε **μετά**, ως χωριστό, μη-ατομικό βήμα.
 *
 * ⚠️ Οι εξαρτήσεις (ακίνητα, επιμετρήσεις…) και το ίχνος μένουν στο `executeDeletion` — εδώ αλλάζει μόνο το **πώς**
 * σβήνεται το ίδιο το έγγραφο.
 */

import 'server-only';

import type { Firestore } from 'firebase-admin/firestore';

import { ENTITY_TYPES } from '@/config/domain-constants';
import { ApiError } from '@/lib/api/ApiErrorHandler';
import type { AuthContext } from '@/lib/auth';
import { getErrorMessage } from '@/lib/error-utils';
import { executeDeletion } from '@/lib/firestore/deletion-guard';
import { isIntermediateStorey } from '@/lib/floor/floor-stack-integrity';
import { createModuleLogger } from '@/lib/telemetry';
import { buildFloorCascadeActor } from './_shared/floor-cascade-audit';
import { readFloorStack } from './_shared/floor-stack-rows';
import { floorStackOwnerOf, withFloorStack, type FloorStackOwner } from './floor-stack-authority';
import {
  planSpecialLevelPlacement,
  recordSpecialLevelPlacements,
  writeSpecialLevelPlacements,
  type SpecialLevelPlacement,
} from './floor-stack-reconcile.service';

const logger = createModuleLogger('FloorRemoval');

/** Το `errorCode` της άρνησης όταν η διαγραφή θα άφηνε κενό στη στοίβα. */
export const FLOOR_INTERMEDIATE = 'FLOOR_INTERMEDIATE';

export interface FloorRemovalRequest {
  readonly db: Firestore;
  readonly ctx: AuthContext;
  readonly floorId: string;
  /** Το έγγραφο του ορόφου, όπως το φόρτωσε ο φύλακας ιδιοκτησίας. */
  readonly floor: Readonly<Record<string, unknown>>;
}

function intermediateRefusal(): ApiError {
  return new ApiError(422, 'Cannot delete an intermediate floor. Delete the floors above it first.', FLOOR_INTERMEDIATE);
}

/**
 * **Η ΜΙΑ αφαίρεση ορόφου** (CHECK 3.102 Κ1).
 *
 * @throws {ApiError} 422 `FLOOR_INTERMEDIATE` · 409 όταν εξαρτήσεις μπλοκάρουν τη διαγραφή (από το `executeDeletion`)
 */
export async function removeFloor(request: FloorRemovalRequest): Promise<void> {
  const { db, ctx, floorId, floor } = request;
  const owner = floorStackOwnerOf(floor);
  // Όροφος χωρίς κτίριο/ενοικιαστή δεν ανήκει σε καμία στοίβα: η διαγραφή του δεν μπορεί να παραβιάσει τον κανόνα,
  // και μια άρνηση εδώ θα έκανε τα ορφανά έγγραφα αδιάγραπτα.
  if (owner === null) {
    await executeDeletion(db, 'floor', floorId, ctx.uid, ctx.companyId);
    return;
  }

  // Πρώτη κρίση **πριν** από τις αλυσιδωτές διαγραφές του `executeDeletion` — η οριστική γίνεται μέσα στη συναλλαγή.
  const { rows } = await readFloorStack(db, owner.buildingId, owner.companyId);
  if (isIntermediateStorey(rows, floorId)) throw intermediateRefusal();

  let placements: readonly SpecialLevelPlacement[] = [];
  await executeDeletion(db, 'floor', floorId, ctx.uid, ctx.companyId, {
    commit: async (ref) => { placements = await commitRemoval(db, owner, ref, ctx.uid); },
  });
  await recordPlacements(placements, owner, request);
}

/** Η συναλλαγή: οριστική κρίση → διαγραφή → επανατοποθέτηση όσων μένουν → σφράγιση κλειδιού. */
function commitRemoval(
  db: Firestore,
  owner: FloorStackOwner,
  ref: FirebaseFirestore.DocumentReference,
  userId: string,
): Promise<SpecialLevelPlacement[]> {
  return withFloorStack(db, owner, userId, (transaction, stack) => {
    if (isIntermediateStorey(stack.rows, ref.id)) throw intermediateRefusal();
    transaction.delete(ref);
    const placements = planSpecialLevelPlacement(stack.rows.filter((row) => row.id !== ref.id));
    writeSpecialLevelPlacements(transaction, stack.refById, placements, userId);
    return placements;
  });
}

/** ADR-195 — οι παράγωγες γραμμές της επανατοποθέτησης. Αποτυχία εδώ ⇒ ο όροφος **σβήστηκε ήδη**· δεν ρίχνει. */
async function recordPlacements(
  placements: readonly SpecialLevelPlacement[],
  owner: FloorStackOwner,
  request: FloorRemovalRequest,
): Promise<void> {
  if (placements.length === 0) return;
  try {
    // Αιτία = ο όροφος που μόλις σβήστηκε· η γραμμή διαγραφής γράφτηκε μέσα στο `executeDeletion`.
    const actor = await buildFloorCascadeActor({
      ctx: request.ctx,
      entityType: ENTITY_TYPES.FLOOR,
      entityId: request.floorId,
      entityName: typeof request.floor.name === 'string' ? request.floor.name : null,
      auditId: null,
    });
    await recordSpecialLevelPlacements(placements, owner.companyId, actor);
  } catch (error) {
    logger.warn('[Floors/Delete] Special-level placement audit failed (floor deleted, levels placed)', {
      buildingId: owner.buildingId, floorId: request.floorId, error: getErrorMessage(error),
    });
  }
}
