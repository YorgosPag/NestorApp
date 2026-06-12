/**
 * ADR-449 Slice 4 — beam finish BOQ feed (SSoT). Mirror του `column-boq-feed.ts`.
 *
 * Σε αντίθεση με την `attached` κολόνα, το δοκάρι έχει **σταθερό βάθος** → δεν
 * χρειάζεται profile-aware geometry· ο feed απλώς προσθέτει το derived σοβά
 * contribution (interior/exterior εμβαδά πλάγιων όψεων, εξαιρώντας άκρα/καλυμμένα)
 * ώστε ο `BimToBoqBridge` να βγάλει parent (στατικός πυρήνας m³) + finish children.
 *
 * **Όταν ο σοβάς είναι ανενεργός** → επιστρέφει το προ-Slice-4 minimal payload
 * (`{id, kind, geometry}`) → byte-identical single-entry BOQ (μηδέν regression).
 *
 * @see hooks/data/column-boq-feed.ts (sibling)
 * @see docs/centralized-systems/reference/adrs/ADR-449-structural-finish-skin.md
 */

import type { SceneModel } from '../../types/entities';
import type { BeamEntity } from '../../bim/types/beam-types';
import type { BimEntityForBoq } from '../../bim/services/BimToBoqBridge';
import { computeBeamFinishContribution } from '../../bim/finishes/structural-finish-scene';

/**
 * Build το BOQ-feed entity ενός δοκαριού. Με ενεργό σοβά → προσθέτει `params`
 * (category/sectionKind resolution) + `finishContribution`· αλλιώς minimal payload.
 */
export function beamBoqEntity(entity: BeamEntity, scene: SceneModel | null): BimEntityForBoq {
  const finishContribution = computeBeamFinishContribution(entity, scene);
  if (!finishContribution) {
    return { id: entity.id, kind: entity.kind, geometry: entity.geometry };
  }
  return {
    id: entity.id,
    kind: entity.kind,
    params: entity.params as unknown as Readonly<{ category?: string; [key: string]: unknown }>,
    geometry: entity.geometry,
    finishContribution,
  };
}
