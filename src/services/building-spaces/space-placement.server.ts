/**
 * @fileoverview **Η τοποθέτηση χώρου στο κτίριο της μονάδας του — η πλευρά Admin SDK** (ADR-898 §21). Η απόφαση ζει
 * στο `lib/building-spaces/space-placement.ts`· εδώ μόνο ανάγνωση/εγγραφή και οι συνέπειες (ADR-239).
 * @module services/building-spaces/space-placement.server
 *
 * 🔑 **Προληπτικά, στην ΙΔΙΑ συναλλαγή** (N.7.2 #1-#2): το PATCH μονάδας που γράφει `linkedSpaces` περνά τον
 *   {@link spacePlacementCompanion} στο `withVersionCheck` — η μονάδα και ο χώρος γράφονται **μαζί** ή **καθόλου**.
 * 🔑 **Μία εγγραφή** ({@link spacePlacementWrite}) για το PATCH **και** τη μετάπτωση — ίδιο σχήμα, ίδιο `_v`.
 */

import 'server-only';

import { FieldValue, type DocumentReference, type Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { FIELDS } from '@/config/firestore-field-constants';
import { VERSION_FIELD } from '@/config/versioning-config';
import type { AuthContext } from '@/lib/auth';
import {
  BUILDING_SPACE_KINDS,
  spaceOwnersOf,
  type BuildingSpaceKind,
  type SpaceOwningUnit,
  type SpaceRecord,
} from '@/lib/building-spaces/building-space-membership';
import { planSpacePlacements, type SpacePlacement } from '@/lib/building-spaces/space-placement';
import { getErrorMessage } from '@/lib/error-utils';
import { linkEntity } from '@/lib/firestore/entity-linking.service';
import { createModuleLogger } from '@/lib/telemetry';
import { isPlainRecord } from '@/lib/type-guards';
import type { VersionedCompanion } from '@/types/versioning';

import { SPACE_COLLECTION_OF } from './building-space-admin-reader';

const logger = createModuleLogger('SpacePlacement');

/** Μια τοποθέτηση που γράφτηκε — μαζί με το έγγραφο **πριν** (για το ίχνος και τον cascade). */
export interface PlacedSpace {
  readonly placement: SpacePlacement;
  readonly before: Readonly<Record<string, unknown>>;
}

interface LinkedSpaceTarget {
  readonly id: string;
  readonly kind: BuildingSpaceKind;
  readonly ref: DocumentReference;
}

/** Το έγγραφο ενός χώρου — η μία αντιστοίχιση είδος → συλλογή. */
export function spaceDocRef(db: AdminFirestore, kind: BuildingSpaceKind, spaceId: string): DocumentReference {
  return db.collection(SPACE_COLLECTION_OF[kind]).doc(spaceId);
}

/** Οι συνδεδεμένοι χώροι μιας μονάδας, από το `spaceType` κάθε σύνδεσης (άγνωστο είδος ⇒ αγνοείται). */
function linkedSpaceTargets(db: AdminFirestore, links: unknown): readonly LinkedSpaceTarget[] {
  if (!Array.isArray(links)) return [];
  return links.flatMap((link) => {
    if (!isPlainRecord(link) || typeof link.spaceId !== 'string') return [];
    const kind = BUILDING_SPACE_KINDS.find((candidate) => candidate === link.spaceType);
    return kind === undefined ? [] : [{ id: link.spaceId, kind, ref: spaceDocRef(db, kind, link.spaceId) }];
  });
}

/** **Η εγγραφή της τοποθέτησης** — μόνο `buildingId`, με νέα έκδοση ώστε ανοιχτή φόρμα του χώρου να δει σύγκρουση. */
export function spacePlacementWrite(placement: SpacePlacement, userId: string): Record<string, unknown> {
  return {
    [FIELDS.BUILDING_ID]: placement.buildingId,
    [VERSION_FIELD]: FieldValue.increment(1),
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: userId,
  };
}

/**
 * Ο συνοδός της συναλλαγής της μονάδας: διαβάζει τους συνδεδεμένους χώρους **μέσα** στη συναλλαγή, αποφασίζει με τον
 * ΕΝΑ planner και γράφει τις τοποθετήσεις μαζί με τη μονάδα. `unit` = η μονάδα **όπως θα είναι** μετά την εγγραφή.
 * Το `onPlanned` καλείται σε κάθε εκτέλεση· η τελευταία είναι αυτή που γράφτηκε.
 */
export function spacePlacementCompanion(
  db: AdminFirestore,
  unit: SpaceOwningUnit,
  userId: string,
  onPlanned: (placed: readonly PlacedSpace[]) => void,
): VersionedCompanion {
  return async (transaction) => {
    const targets = linkedSpaceTargets(db, unit.linkedSpaces);
    const snapshots = targets.length === 0 ? [] : await transaction.getAll(...targets.map((target) => target.ref));
    const spaces: SpaceRecord[] = snapshots.flatMap((snapshot, index) =>
      snapshot.exists ? [{ id: targets[index].id, kind: targets[index].kind, data: snapshot.data() ?? {} }] : [],
    );
    const dataOf = new Map(spaces.map((space) => [space.id, space.data]));
    const placed = planSpacePlacements(spaces, spaceOwnersOf([unit])).map((placement) => ({
      placement,
      before: dataOf.get(placement.spaceId) ?? {},
    }));
    onPlanned(placed);
    return (writeTransaction) => {
      for (const { placement } of placed) {
        writeTransaction.update(spaceDocRef(db, placement.kind, placement.spaceId), spacePlacementWrite(placement, userId));
      }
    };
  };
}

/** Μετά την εγγραφή: cascade (έργο/εταιρεία από το κτίριο) + ίχνος, μέσω του ΕΝΟΣ `linkEntity` (ADR-239). */
export function announceSpacePlacements(ctx: AuthContext, placed: readonly PlacedSpace[], apiPath: string): void {
  for (const { placement, before } of placed) {
    linkEntity(`${placement.kind}:buildingId`, {
      auth: ctx,
      entityId: placement.spaceId,
      newLinkValue: placement.buildingId,
      existingDoc: { ...before },
      apiPath,
    }).catch((error) => {
      logger.warn('Space placement consequences failed (non-blocking)', { spaceId: placement.spaceId, error: getErrorMessage(error) });
    });
  }
}
