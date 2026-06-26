/**
 * ADR-471 Slice 3 — 3Δ/τομή κλωβός οπλισμού δοκού (rebar cage): layout → THREE.Group.
 *
 * Mirror του `column-rebar-3d`, αλλά **longitudinal**: σε αντίθεση με την κολόνα (όπου
 * οι διαμήκεις είναι κατακόρυφες και τα στεφάνια οριζόντια), στη δοκό:
 *   - **Διαμήκεις** ράβδοι = κύλινδροι **κατά τον άξονα** (στις θέσεις (v,w) της διατομής).
 *   - **Συνδετήρες** = κλειστά loops στο **επίπεδο διατομής** (v κάθετο στον άξονα, w
 *     κατακόρυφο) σε κάθε στάθμη `stirrupLevelsMm`.
 *
 * Καταναλώνει το ΙΔΙΟ geometry SSoT (`resolveBeamRebarLayout`) με το 2Δ → ίδιες θέσεις.
 * Η beam-local (u,v,w) [mm] → three.js [m] μετατροπή:
 *   - (u,v): path-relative frame (`samplePolylineFrame`) πάνω στον **πλήρη** άξονα
 *     (canvas units), offset εγκάρσια κατά v, μετά × `sceneToM` → world metres.
 *   - w: κατακόρυφα από το κέντρο διατομής (`centerY = bottomFaceY + depth/2`) × MM_TO_M.
 * Σύμβαση αξόνων (ίδια με τον πυρήνα): plan (sx, sy) → three (sx, y, −sy).
 *
 * Reuse 3Δ primitives (`rebar-3d-shared`): `REBAR_MATERIAL` (κοινό άφωτο singleton),
 * `buildRods` (InstancedMesh ανά κατηγορία — 1 draw call), `MIN_RADIUS`, `MM_TO_M`.
 * Πεδίο: ορθογωνική δοκός με ενεργό `reinforcement`. Tilted beam slope = DEFER (επίπεδες
 * δοκοί στη συντριπτική πλειονότητα· ο πυρήνας slope-άρεται ήδη, ο κλωβός όχι ακόμα).
 *
 * @see ./column-rebar-3d.ts — ο δίδυμος της κολόνας
 * @see ../../bim/structural/reinforcement/beam-rebar-layout.ts — geometry SSoT
 * @see docs/centralized-systems/reference/adrs/ADR-471-unified-member-reinforcement.md §2-3
 */

import * as THREE from 'three';
import type { BeamEntity } from '../../bim/types/beam-types';
import { resolveActiveBeamRebarLayout } from '../../bim/structural/active-reinforcement';
import { DEFAULT_STIRRUP_TYPE } from '../../bim/structural/reinforcement/beam-reinforcement-types';
import { buildLinearMemberRebarCage } from './linear-member-rebar-3d';

/** Beam που χρειάζεται ο κλωβός (geometry-is-SSoT· full `BeamEntity` ικανοποιεί το Pick). */
type RebarBeam = Pick<BeamEntity, 'id' | 'params' | 'geometry'>;

/**
 * Χτίζει τον κλωβό οπλισμού (διαμήκεις + συνδετήρες) μιας δοκού ως `THREE.Group`, ή
 * `null` αν δεν έχει ενεργό οπλισμό / εκφυλισμένη γεωμετρία. `bottomFaceY` = κάτω παρειά
 * του πυρήνα σε world metres (ίδιο datum με το box extrude → ευθυγράμμιση).
 *
 * ADR-477 Slice 2 — thin wrapper: resolve (auto-aware) → SSoT core
 * `buildLinearMemberRebarCage` (το ίδιο core που τροφοδοτεί και η συνδετήρια δοκός).
 *
 * ADR-534 Φ3c-B3a — `topClipY` (world m): όταν μονολιθική πλάκα καλύπτει τη δοκό, ο κλωβός
 * κόβεται στο soffit (ίδιο επίπεδο με το ορατό στερεό). `undefined` → χωρίς κοπή.
 */
export function buildBeamRebarCage(
  beam: RebarBeam,
  bottomFaceY: number,
  levelId?: string,
  topClipY?: number,
): THREE.Group | null {
  // ADR-471/486 — ΕΝΑΣ SSoT: ενεργός (auto-aware) οπλισμός + topology-aware layout (πρόβολος).
  const rebar = resolveActiveBeamRebarLayout(beam);
  if (!rebar) return null;

  const group = buildLinearMemberRebarCage({
    axisPts: beam.geometry.axisPolyline.points,
    sceneUnits: beam.params.sceneUnits,
    layout: rebar.layout,
    stirrupType: rebar.reinforcement.stirrups.type ?? DEFAULT_STIRRUP_TYPE,
    bottomFaceY,
    topClipY,
  });
  if (!group) return null;

  group.userData['bimId'] = beam.id;
  group.userData['bimType'] = 'beam';
  group.userData['reinforcement'] = true;
  if (levelId !== undefined) group.userData['levelId'] = levelId;
  return group;
}
