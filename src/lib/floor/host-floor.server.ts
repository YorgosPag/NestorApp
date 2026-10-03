/**
 * @fileoverview **Ο ΕΝΑΣ συγγραφέας του αντιγράφου ορόφου** (server, ADR-903 §6).
 * @module lib/floor/host-floor.server
 *
 * Ο client στέλνει **μόνο** `floorId`· ο server διαβάζει το έγγραφο ορόφου και παράγει
 * `{ floorId, floor, floorKind }`. Μία πηγή — όπως στο Revit το στοιχείο δεν «λέει» ποιος είναι ο
 * όροφός του, το ρωτά.
 *
 * 🔒 Ο όροφος περνά από τον **φύλακα του πόρου** (`floorResource`, ADR-742): ξένος ≡ ανύπαρκτος ⇒
 * `404 'Floor not found'` (κανένα μαντείο ύπαρξης). Ο όροφος **άλλου κτιρίου** ⇒ `400`.
 */

import 'server-only';

import type { Firestore } from 'firebase-admin/firestore';
import type { AuthContext } from '@/lib/auth';
import { ApiError } from '@/lib/api/ApiErrorHandler';
import { floorResource } from '@/app/api/floors/_shared/floor-ownership';
import {
  hostedCopyOf,
  planHostedFloorIntent,
  UNHOSTED,
  type HostedFloorCopy,
} from './hosted-floor';

/** Το μήνυμα όταν ο όροφος δεν ανήκει στο κτίριο του στοιχείου (ή το στοιχείο δεν έχει κτίριο). */
export const FLOOR_NOT_IN_BUILDING = 'Floor does not belong to the building';

/**
 * Φόρτωσε τον όροφο ως **φιλοξενούντα**: ύπαρξη + εταιρεία (φύλακας) + ίδιο κτίριο.
 * @throws {ApiError} 404 ξένος/ανύπαρκτος · 400 άλλο κτίριο / χωρίς κτίριο / χωρίς αριθμό
 */
export async function loadHostFloor(
  db: Firestore,
  ctx: AuthContext,
  floorId: string,
  buildingId: string | null,
): Promise<HostedFloorCopy> {
  const owned = await floorResource.load({
    docId: floorId,
    caller: ctx,
    action: 'host',
    refusal: () => new ApiError(404, floorResource.notFoundMessage),
    db,
  });
  if (owned.refusal) throw owned.refusal;

  const data = owned.doc.data ?? {};
  if (!buildingId || data.buildingId !== buildingId) throw new ApiError(400, FLOOR_NOT_IN_BUILDING);
  if (typeof data.number !== 'number' || !Number.isInteger(data.number)) {
    throw new ApiError(400, 'Floor has no number');
  }
  return hostedCopyOf({ id: floorId, number: data.number, kind: data.kind });
}

/**
 * Τα πεδία φιλοξενίας μιας **δημιουργίας**: `floorId` ⇒ αντίγραφο από τον όροφο, αλλιώς τίποτα.
 */
export async function resolveHostedFloorForCreate(
  db: Firestore,
  ctx: AuthContext,
  floorId: string | null | undefined,
  buildingId: string | null,
): Promise<Partial<HostedFloorCopy>> {
  const id = floorId?.trim();
  if (!id) return {};
  return loadHostFloor(db, ctx, id, buildingId);
}

/**
 * Τα πεδία φιλοξενίας μιας **ενημέρωσης** — `{}` όταν δεν αλλάζουν (το PATCH τα αφήνει ήσυχα).
 * Η απόφαση είναι το καθαρό {@link planHostedFloorIntent}· εδώ μόνο η ανάγνωση.
 */
export async function resolveHostedFloorPatch(
  db: Firestore,
  ctx: AuthContext,
  body: Readonly<Record<string, unknown>>,
  existing: Readonly<Record<string, unknown>>,
): Promise<Partial<HostedFloorCopy>> {
  const intent = planHostedFloorIntent(body, existing);
  switch (intent.kind) {
    case 'keep':
      return {};
    case 'clear':
      return UNHOSTED;
    case 'resolve':
      return loadHostFloor(db, ctx, intent.floorId, intent.buildingId);
  }
}
