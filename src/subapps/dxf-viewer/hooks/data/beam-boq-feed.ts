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
import { isColumnEntity } from '../../types/entities';
import type { BeamEntity, BeamGeometry } from '../../bim/types/beam-types';
import type { BimEntityForBoq } from '../../bim/services/BimToBoqBridge';
import { computeBeamFinishContribution } from '../../bim/finishes/structural-finish-scene';
import { computeBeamCutbackNetAreaM2 } from '../../bim/geometry/beam-column-cutback';
import { mmToSceneUnits } from '../../utils/scene-units';

const MM_TO_M = 0.001;

/**
 * ADR-458 — NET στατικός όγκος δοκαριού (Revit join, «η κολόνα νικάει»): αφαιρεί την
 * εμβυθισμένη διεπαφή κολόνας↔δοκαριού ώστε ο κόμβος να μετριέται ΜΙΑ φορά (ανήκει στην
 * κολόνα). Mirror του `foundationStripNetGeometry`: net plan area × depth → net volume.
 * DERIVED από τα live column footprints (ίδιο SSoT με 2Δ/3Δ). Καμία τομή / I-shape →
 * passthrough (το I-shape volume είναι διατομής×μήκος, εκτός του area×depth μοντέλου →
 * DEFER). Ορθογώνιο RC → byte-for-byte gross όταν δεν τέμνει κολόνα.
 */
function beamNetCoreGeometry(entity: BeamEntity, scene: SceneModel | null): BeamGeometry {
  if (!scene || entity.params.sectionKind === 'I-shape') return entity.geometry;
  const columnFootprints = scene.entities
    .filter(isColumnEntity)
    .map((c) => c.geometry?.footprint?.vertices)
    .filter((f): f is NonNullable<typeof f> => !!f && f.length >= 3)
    .map((f) => f.map((v) => ({ x: v.x, y: v.y })));
  if (columnFootprints.length === 0) return entity.geometry;

  const s = mmToSceneUnits(entity.params.sceneUnits ?? 'mm');
  const canvasToM = (1 / s) * MM_TO_M;
  const netAreaM2 = computeBeamCutbackNetAreaM2(
    entity.geometry.outline.vertices.map((v) => ({ x: v.x, y: v.y })),
    columnFootprints,
    canvasToM * canvasToM,
  );
  if (netAreaM2 === null) return entity.geometry;
  return { ...entity.geometry, area: netAreaM2, volume: netAreaM2 * (entity.params.depth * MM_TO_M) };
}

/**
 * Build το BOQ-feed entity ενός δοκαριού. ADR-458: NET στατικός πυρήνας (column-cutback)·
 * με ενεργό σοβά → προσθέτει `params` (category/sectionKind resolution) + `finishContribution`·
 * αλλιώς minimal payload.
 */
export function beamBoqEntity(entity: BeamEntity, scene: SceneModel | null): BimEntityForBoq {
  const geometry = beamNetCoreGeometry(entity, scene);
  const finishContribution = computeBeamFinishContribution(entity, scene);
  if (!finishContribution) {
    return { id: entity.id, kind: entity.kind, geometry };
  }
  return {
    id: entity.id,
    kind: entity.kind,
    params: entity.params as unknown as Readonly<{ category?: string; [key: string]: unknown }>,
    geometry,
    finishContribution,
  };
}
