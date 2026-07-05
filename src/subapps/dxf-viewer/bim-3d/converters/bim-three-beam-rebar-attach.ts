/**
 * bim-three-beam-rebar-attach — beam reinforcement cage attach (ADR-471 / ADR-534).
 *
 * File-private helpers εξηγμένα από το `bim-three-structural-converters` (file-size
 * SSoT, N.7.1, 2026-07-05). Προσθέτουν τον additive κλωβό οπλισμού δοκού (διαμήκεις +
 * συνδετήρες) στο συντεθειμένο beam result, με top-clip όταν πλάκα οροφής κόβει την κορυφή.
 */

import * as THREE from 'three';
import type { BeamEntity } from '../../bim/types/beam-types';
import { isStructuralComponentVisible } from '../../bim/visibility/structural-component-visibility';
import { buildBeamRebarCage } from './beam-rebar-3d';

const MM_TO_M = 0.001;

/**
 * ADR-534 Φ3c-B3a — απόλυτο **top-clip Y** (world m) του κλωβού οπλισμού δοκού από το ίδιο
 * `clipTopZmm` (absolute mm) που κόβει το ορατό στερεό (`beamToMesh`). Datum-mapping: η κάτω
 * παρειά (`bottomFaceY`, world m) αντιστοιχεί στο `beamBottomAbsMm` → απόλυτο mm → world m με
 * `MM_TO_M`. `undefined` όταν δεν υπάρχει κάλυψη ή το clip είναι ≥ κορυφής (μηδέν regression).
 */
function beamRebarTopClipY(
  beam: BeamEntity,
  bottomFaceY: number,
  clipTopZmm?: number,
): number | undefined {
  const beamTopAbsMm = beam.params.topElevation + (beam.params.zOffset ?? 0);
  if (clipTopZmm === undefined || clipTopZmm >= beamTopAbsMm) return undefined;
  const beamBottomAbsMm = beamTopAbsMm - beam.params.depth;
  return bottomFaceY + (clipTopZmm - beamBottomAbsMm) * MM_TO_M;
}

/**
 * ADR-471 Slice 3 — προσθέτει τον κλωβό οπλισμού (διαμήκεις + συνδετήρες) στο ήδη
 * συντεθειμένο beam result (πυρήνας ή πυρήνας+σοβάς). Mirror του `attachColumnRebar`:
 * επιστρέφει το ίδιο αντικείμενο όταν ο οπλισμός είναι ανενεργός (view gate / χωρίς
 * `reinforcement`). `bottomFaceY` = κάτω παρειά πυρήνα (ίδιο datum → ευθυγράμμιση).
 * Gate μόνο στον δικό του διακόπτη `showReinforcement` — ΑΝΕΞΑΡΤΗΤΟΣ από `suppressFinishSkin`.
 */
export function attachBeamRebar(
  composed: THREE.Mesh | THREE.Group,
  beam: BeamEntity,
  bottomFaceY: number,
  levelId: string | undefined,
  clipTopZmm?: number,
): THREE.Mesh | THREE.Group {
  // ADR-470 — per-element οπλισμός override → per-view flag (Revit precedence).
  if (!isStructuralComponentVisible('reinforcement', beam)) return composed;
  const cage = buildBeamRebarCage(beam, bottomFaceY, levelId, beamRebarTopClipY(beam, bottomFaceY, clipTopZmm));
  if (!cage) return composed;
  if (composed instanceof THREE.Group) {
    composed.add(cage);
    return composed;
  }
  const group = new THREE.Group();
  group.add(composed);
  group.add(cage);
  group.userData['bimId'] = beam.id;
  group.userData['bimType'] = 'beam';
  return group;
}
