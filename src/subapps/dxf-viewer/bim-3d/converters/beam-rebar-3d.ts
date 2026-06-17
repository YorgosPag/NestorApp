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
import { mmToSceneUnits, sceneUnitsToMeters } from '../../utils/scene-units';
import { buildBeamSectionContext } from '../../bim/structural/section-context';
import { resolveActiveBeamReinforcementForEntity } from '../../bim/structural/active-reinforcement';
import { resolveBeamRebarLayout } from '../../bim/structural/reinforcement/beam-rebar-layout';
import { DEFAULT_STIRRUP_TYPE } from '../../bim/structural/reinforcement/beam-reinforcement-types';
import { samplePolylineFrame } from '../../bim/geometry/shared/polyline-frame';
import { MM_TO_M, MIN_RADIUS, REBAR_MATERIAL, buildRods, type Seg } from './rebar-3d-shared';

/** Beam που χρειάζεται ο κλωβός (geometry-is-SSoT· full `BeamEntity` ικανοποιεί το Pick). */
type RebarBeam = Pick<BeamEntity, 'id' | 'params' | 'geometry'>;

/**
 * Χτίζει τον κλωβό οπλισμού (διαμήκεις + συνδετήρες) μιας δοκού ως `THREE.Group`, ή
 * `null` αν δεν έχει ενεργό οπλισμό / εκφυλισμένη γεωμετρία. `bottomFaceY` = κάτω παρειά
 * του πυρήνα σε world metres (ίδιο datum με το box extrude → ευθυγράμμιση).
 */
export function buildBeamRebarCage(
  beam: RebarBeam,
  bottomFaceY: number,
  levelId?: string,
): THREE.Group | null {
  const r = resolveActiveBeamReinforcementForEntity(beam);
  if (!r) return null;
  const layout = resolveBeamRebarLayout(buildBeamSectionContext(beam), r);
  if (!layout) return null;
  const axisPts = beam.geometry.axisPolyline.points;
  if (axisPts.length < 2) return null;

  const s = mmToSceneUnits(beam.params.sceneUnits ?? 'mm'); // canvas units ανά mm
  const sceneToM = sceneUnitsToMeters(beam.params.sceneUnits ?? 'mm'); // metres ανά canvas unit
  const depthM = Math.max(0, layout.depthMm) * MM_TO_M;
  const centerY = bottomFaceY + depthM / 2; // κατακόρυφο κέντρο διατομής (world metres)

  // beam-local (u,v,w) [mm] → three.js Vector3 (world metres, AXIS_FLIP: z = −planY).
  const localToThree = (uMm: number, vMm: number, wMm: number): THREE.Vector3 => {
    const frame = samplePolylineFrame(axisPts, uMm * s);
    if (!frame) return new THREE.Vector3(0, centerY + wMm * MM_TO_M, 0); // defensive (guarded ≥2)
    const planX = frame.point.x + vMm * s * frame.normal.x;
    const planY = frame.point.y + vMm * s * frame.normal.y;
    return new THREE.Vector3(planX * sceneToM, centerY + wMm * MM_TO_M, -(planY * sceneToM));
  };

  const group = new THREE.Group();

  // ── Διαμήκεις: κύλινδροι κατά τον άξονα (curve-aware sampling), ομαδοποιημένοι ανά Ø ──
  const subdivisions = axisPts.length <= 2 ? 1 : Math.max(8, axisPts.length * 2);
  const segsByDiameter = new Map<number, Seg[]>();
  for (const bar of layout.longitudinalBars) {
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= subdivisions; k++) {
      const u = bar.uStartMm + ((bar.uEndMm - bar.uStartMm) * k) / subdivisions;
      pts.push(localToThree(u, bar.vMm, bar.wMm));
    }
    const arr = segsByDiameter.get(bar.diameterMm) ?? [];
    for (let i = 1; i < pts.length; i++) arr.push({ a: pts[i - 1], b: pts[i] });
    segsByDiameter.set(bar.diameterMm, arr);
  }
  for (const [diameterMm, segs] of segsByDiameter) {
    const rods = buildRods(segs, Math.max(MIN_RADIUS, (diameterMm / 2) * MM_TO_M), REBAR_MATERIAL);
    if (rods) group.add(rods);
  }

  // ── Συνδετήρες: κλειστά loops στο επίπεδο διατομής (v,w) σε κάθε στάθμη ──
  const stirrupRadius = Math.max(MIN_RADIUS, (layout.stirrupDiameterMm / 2) * MM_TO_M);
  const ring = layout.stirrupSectionPathMm;
  const hooked = (r.stirrups.type ?? DEFAULT_STIRRUP_TYPE) === 'closed-hooked';
  const stirrupSegs: Seg[] = [];
  if (ring.length >= 2) {
    for (const u of layout.stirrupLevelsMm) {
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i];
        const b = ring[(i + 1) % ring.length];
        stirrupSegs.push({ a: localToThree(u, a.x, a.y), b: localToThree(u, b.x, b.y) });
      }
      if (hooked) {
        for (const hook of layout.stirrupHookEndsMm) {
          for (let i = 1; i < hook.length; i++) {
            stirrupSegs.push({ a: localToThree(u, hook[i - 1].x, hook[i - 1].y), b: localToThree(u, hook[i].x, hook[i].y) });
          }
        }
      }
    }
  }
  const stirrups = buildRods(stirrupSegs, stirrupRadius, REBAR_MATERIAL);
  if (stirrups) group.add(stirrups);

  if (group.children.length === 0) return null;
  group.userData['bimId'] = beam.id;
  group.userData['bimType'] = 'beam';
  group.userData['reinforcement'] = true;
  if (levelId !== undefined) group.userData['levelId'] = levelId;
  return group;
}
