/**
 * @fileoverview **Οι χώροι ενός κτιρίου στον πίνακα αντικειμενικής** (ADR-898 §19 · §20) — θέσεις στάθμευσης και
 * αποθήκες: όσοι **μετρούν** εδώ γίνονται γραμμές, όσοι ανήκουν σε μονάδα του αλλά βρίσκονται **αλλού** γίνονται αναφορές.
 * @related `lib/building-spaces/building-space-membership.ts` (ΠΟΙΟΙ χώροι — ο ΕΝΑΣ κανόνας) ·
 *   `lib/objective-value/building-space-objective-value.ts` (ΠΟΣΟ — ο καθαρός κανόνας) · `building-objective-values.service.ts`
 * @module services/objective-value/building-space-objective-values
 *
 * ⛔ Κανένας δεύτερος κανόνας «ποιοι χώροι» εδώ: ως 02/10 ζούσε ένας εδώ και ένας στον πελάτη, και διαφωνούσαν.
 */

import 'server-only';

import { spaceDisplayNameOf, type CountedSpace } from '@/lib/building-spaces/building-space-membership';
import type { ValueZoneVerdict } from '@/lib/market/value-zone-at-point';
import type { BuildingObjectiveValueContext } from '@/lib/objective-value/building-objective-value';
import type { BuildingQuestionSubject } from '@/lib/objective-value/building-objective-value-questions';
import type { BuildingObjectiveValueRow, OtherBuildingRef } from '@/lib/objective-value/building-objective-values-contract';
import {
  buildingSpaceObjectiveValue,
  readSpacePositionDeclaration,
  spaceFloorOf,
  SPACE_OBJECTIVE_VALUE_POSITION_FIELD,
  type BuildingSpaceInput,
} from '@/lib/objective-value/building-space-objective-value';
import { isFiniteNumber } from '@/lib/type-guards';
import { otherBuildingRefOf } from '@/services/building-spaces/building-space-admin-reader';
import { PARKING_LOCATION_ZONE_LABELS, type ParkingLocationZone } from '@/types/parking';

function isLocationZone(raw: unknown): raw is ParkingLocationZone {
  return typeof raw === 'string' && Object.prototype.hasOwnProperty.call(PARKING_LOCATION_ZONE_LABELS, raw);
}

function spaceInputOf(space: CountedSpace): BuildingSpaceInput {
  const { data } = space;
  return {
    kind: space.kind,
    area: isFiniteNumber(data.area) && data.area > 0 ? data.area : null,
    floor: spaceFloorOf(data.floor),
    locationZone: space.kind === 'parking' && isLocationZone(data.locationZone) ? data.locationZone : null,
    declaredPosition: readSpacePositionDeclaration(space.kind, data[SPACE_OBJECTIVE_VALUE_POSITION_FIELD]),
    linkedQuantity: space.owner?.quantity ?? null,
  };
}

/** Ό,τι χρειάζεται ένας χώρος για τη γραμμή του, πέρα από τον εαυτό του. */
export interface SpaceRowPass {
  readonly buildingId: string;
  readonly context: BuildingObjectiveValueContext;
  readonly verdict: ValueZoneVerdict;
  readonly today: string;
  readonly buildingLabels: ReadonlyMap<string, string | null>;
}

/** Η μονάδα του χώρου, αν ζει σε **άλλο** κτίριο· αλλιώς `null`. */
function ownerElsewhereOf(space: CountedSpace, pass: SpaceRowPass): OtherBuildingRef | null {
  const unitBuildingId = space.owner?.unitBuildingId ?? null;
  return unitBuildingId === null || unitBuildingId === pass.buildingId ? null : otherBuildingRefOf(unitBuildingId, pass.buildingLabels);
}

/** Ένας χώρος που μετρά → γραμμή του πίνακα **και** υποκείμενο ερώτησης (ποιο γεγονός κλείνει τη θέση του). */
export function spaceRow(
  space: CountedSpace,
  pass: SpaceRowPass,
): { readonly row: BuildingObjectiveValueRow; readonly subject: BuildingQuestionSubject } {
  const input = spaceInputOf(space);
  const { value, position } = buildingSpaceObjectiveValue(input, pass.context, pass.verdict, pass.today);
  const row: BuildingObjectiveValueRow = {
    id: space.id,
    kind: space.kind,
    name: spaceDisplayNameOf(space),
    type: typeof space.data.type === 'string' ? space.data.type : null,
    floor: input.floor,
    value,
    space: {
      ownerUnitId: space.owner?.unitId ?? null,
      ownerUnitName: space.owner?.unitName ?? null,
      ownerElsewhere: ownerElsewhereOf(space, pass),
      inclusion: space.owner?.inclusion ?? null,
      declaredPosition: input.declaredPosition,
      position,
    },
  };
  return { row, subject: { value, positionFact: position.kind === 'open' ? position.fact : null } };
}
