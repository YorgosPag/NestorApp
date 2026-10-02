/**
 * @fileoverview **Η ΤΟΠΟΘΕΤΗΣΗ χώρου στο κτίριο της μονάδας του** (ADR-898 §21) — καθαρή απόφαση, κοινή για το PATCH
 * μονάδας (προληπτικά, στην ίδια συναλλαγή) και την εφάπαξ μετάπτωση (`scripts/migrations/migrate-unplaced-linked-spaces.ts`).
 * @module lib/building-spaces/space-placement
 *
 * 🔑 **Η άκυρη κατάσταση γίνεται αδύνατη, όχι «ανεκτή»**: παρακολούθημα μονάδας **χωρίς** `buildingId` μετρά (κανόνας,
 *   `building-space-membership.ts`) στο κτίριο της μονάδας, αλλά λείπει από τη λίστα «βρίσκεται εδώ». Αν δεν υπάρχει
 *   κανένας τέτοιος χώρος, η λίστα `buildingId = Χ` **ταυτίζεται** με το `counted` του κανόνα — ένας αριθμός, χωρίς
 *   δεύτερο φορτωτή. (Revit: το «Not Placed» είναι μόνιμη κατάσταση που κουβαλάς· εδώ δεν γεννιέται.)
 * 🔑 **Τοποθέτηση ≠ μετακίνηση**: γράφεται μόνο κενό `buildingId`· χώρος που βρίσκεται ήδη κάπου (ίδιο ή άλλο κτίριο,
 *   θέση ≠ ανάθεση) **δεν αγγίζεται ποτέ**. Γι' αυτό ισχύει και για πωλημένο χώρο: δεν μετακινείται, τοποθετείται.
 * 🔑 Ιδεμποτική: δεύτερη εκτέλεση ⇒ καμία τοποθέτηση.
 */

import {
  isLiveSpace,
  spaceBuildingIdOf,
  spaceDisplayNameOf,
  type BuildingSpaceKind,
  type SpaceOwner,
  type SpaceRecord,
} from './building-space-membership';

/** Ένας χώρος που παίρνει το κτίριο της μονάδας του. */
export interface SpacePlacement {
  readonly spaceId: string;
  readonly kind: BuildingSpaceKind;
  readonly name: string | null;
  /** Το κτίριο της μονάδας — το νέο `buildingId` του χώρου. */
  readonly buildingId: string;
  readonly unitId: string;
}

/** Η απόφαση για έναν χώρο — ονομασμένη, ποτέ boolean. */
export type SpacePlacementDecision =
  | { readonly kind: 'place'; readonly placement: SpacePlacement }
  /** Βρίσκεται ήδη σε κτίριο, ή είναι στον κάδο — τίποτα να γίνει. */
  | { readonly kind: 'noop' }
  /** Ούτε ο χώρος ούτε η μονάδα έχουν κτίριο: ο κανόνας δεν τον μετρά πουθενά — αναφέρεται, δεν μαντεύεται. */
  | { readonly kind: 'unit-without-building' };

/** **Η απόφαση**: ζωντανός χώρος χωρίς κτίριο, μονάδα με κτίριο ⇒ τοποθέτηση στο κτίριο της μονάδας. */
export function planSpacePlacement(space: SpaceRecord, owner: SpaceOwner): SpacePlacementDecision {
  if (!isLiveSpace(space) || spaceBuildingIdOf(space.data) !== null) return { kind: 'noop' };
  if (owner.unitBuildingId === null) return { kind: 'unit-without-building' };
  return {
    kind: 'place',
    placement: { spaceId: space.id, kind: space.kind, name: spaceDisplayNameOf(space), buildingId: owner.unitBuildingId, unitId: owner.unitId },
  };
}

/** Οι τοποθετήσεις για τους χώρους που έχουν κάτοχο — κάθε χώρος **μία** φορά, με τον **έναν** κάτοχό του. */
export function planSpacePlacements(
  spaces: readonly SpaceRecord[],
  owners: ReadonlyMap<string, SpaceOwner>,
): readonly SpacePlacement[] {
  const placements = new Map<string, SpacePlacement>();
  for (const space of spaces) {
    const owner = owners.get(space.id);
    if (owner === undefined || placements.has(space.id)) continue;
    const decision = planSpacePlacement(space, owner);
    if (decision.kind === 'place') placements.set(space.id, decision.placement);
  }
  return [...placements.values()];
}
