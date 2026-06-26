/**
 * ADR-477 Slice 2 — 3Δ κλωβός οπλισμού **γραμμικού μέλους** (rebar cage): SSoT core.
 *
 * Το «σώμα» του πρώην `buildBeamRebarCage` ΜΕΤΑ το resolve — δέχεται έτοιμο
 * `BeamRebarLayout` (διαμήκεις + συνδετήρες σε beam-local mm) + τον άξονα (canvas
 * units) + το `bottomFaceY` (world metres) και χτίζει το `THREE.Group` (χωρίς
 * userData — ο caller βάζει `bimType`/`bimId`). Καταναλώνεται από:
 *   - `beam-rebar-3d.ts` (δοκός) — resolve μέσω beam suggester.
 *   - `footing-rebar-3d.ts` (συνδετήρια δοκός, ADR-477) — resolve μέσω **footing**
 *     suggester (μεγαλύτερο cover EC2 §4.4.1)· περνά footing-resolved layout εδώ.
 *
 * Γι' αυτό ο core ΔΕΝ ξανα-resolve-άρει οπλισμό — δέχεται `layout` + `stirrupType`
 * έτοιμα. beam-local (u,v,w) [mm] → three.js [m]: (u,v) μέσω path-relative frame
 * (`samplePolylineFrame`) στον άξονα (canvas), offset κατά v, × `sceneToM`· w
 * κατακόρυφα από `centerY = bottomFaceY + depth/2`. AXIS_FLIP: z = −planY.
 *
 * @see ./beam-rebar-3d.ts · ./footing-rebar-3d.ts — οι δύο thin callers
 * @see ../../bim/structural/reinforcement/beam-rebar-layout.ts — geometry SSoT (EC8 ζώνες)
 * @see docs/centralized-systems/reference/adrs/ADR-477-tie-beam-reinforcement-unification.md §Slice 2
 */

import * as THREE from 'three';
import type { Point2D } from '../../rendering/types/Types';
import type { SceneUnits } from '../../utils/scene-units';
import { mmToSceneUnits, sceneUnitsToMeters } from '../../utils/scene-units';
import { samplePolylineFrame } from '../../bim/geometry/shared/polyline-frame';
import type { BeamRebarLayout } from '../../bim/structural/reinforcement/beam-rebar-layout';
import type { StirrupType } from '../../bim/structural/reinforcement/beam-reinforcement-types';
import { MM_TO_M, MIN_RADIUS, REBAR_MATERIAL, buildRods, type Seg } from './rebar-3d-shared';

/** Είσοδος του 3Δ core: άξονας (canvas units) + έτοιμη διάταξη + κάτω παρειά (world m). */
export interface LinearMemberRebarCageInput {
  /** Σημεία άξονα σε **canvas/scene units** (δοκός: axisPolyline· tie-beam: [start,end]). */
  readonly axisPts: readonly Point2D[];
  /** Μονάδα καμβά (για mm→canvas + canvas→metres scale· absent ⇒ 'mm'). */
  readonly sceneUnits: SceneUnits | undefined;
  /** Διάταξη οπλισμού σε beam-local mm (resolved από τον caller — geometry SSoT). */
  readonly layout: BeamRebarLayout;
  /** Μορφή συνδετήρα (resolved, defaulted) — γάντζοι 135° μόνο `closed-hooked`. */
  readonly stirrupType: StirrupType;
  /** Κάτω παρειά του πυρήνα σε world metres (ίδιο datum με το box extrude). */
  readonly bottomFaceY: number;
  /**
   * ADR-534 Φ3c-B3a — απόλυτο **top-clip Y** (world metres) όταν μονολιθική πλάκα καλύπτει
   * τη δοκό: ο κλωβός κόβεται στο soffit (ίδιο επίπεδο με το ορατό στερεό → ο οπλισμός δεν
   * προεξέχει στην πλάκα). `undefined` → χωρίς κοπή (byte-for-byte, μηδέν regression).
   */
  readonly topClipY?: number;
}

/**
 * Χτίζει τον κλωβό οπλισμού (διαμήκεις + συνδετήρες) ενός γραμμικού μέλους ως
 * `THREE.Group`, ή `null` αν δεν υπάρχει τίποτα να σχεδιαστεί / εκφυλισμένος άξονας.
 * Χωρίς userData — ο caller βάζει `bimId`/`bimType`/`levelId`.
 */
export function buildLinearMemberRebarCage(
  input: LinearMemberRebarCageInput,
): THREE.Group | null {
  const { axisPts, sceneUnits, layout, stirrupType, bottomFaceY, topClipY } = input;
  if (axisPts.length < 2) return null;

  const s = mmToSceneUnits(sceneUnits ?? 'mm'); // canvas units ανά mm
  const sceneToM = sceneUnitsToMeters(sceneUnits ?? 'mm'); // metres ανά canvas unit
  const depthM = Math.max(0, layout.depthMm) * MM_TO_M;
  const centerY = bottomFaceY + depthM / 2; // κατακόρυφο κέντρο διατομής (world metres)
  // ADR-534 Φ3c-B3a — κόψε στο soffit πλάκας (no-op όταν απών) ώστε ο κλωβός να μην προεξέχει στην πλάκα.
  const clampY = (y: number): number => (topClipY !== undefined ? Math.min(y, topClipY) : y);

  // beam-local (u,v,w) [mm] → three.js Vector3 (world metres, AXIS_FLIP: z = −planY).
  const localToThree = (uMm: number, vMm: number, wMm: number): THREE.Vector3 => {
    const frame = samplePolylineFrame(axisPts, uMm * s);
    if (!frame) return new THREE.Vector3(0, clampY(centerY + wMm * MM_TO_M), 0); // defensive (guarded ≥2)
    const planX = frame.point.x + vMm * s * frame.normal.x;
    const planY = frame.point.y + vMm * s * frame.normal.y;
    return new THREE.Vector3(planX * sceneToM, clampY(centerY + wMm * MM_TO_M), -(planY * sceneToM));
  };

  const group = new THREE.Group();
  addLongitudinalRods(group, layout, axisPts.length, localToThree);
  addStirrupRods(group, layout, stirrupType, localToThree);

  if (group.children.length === 0) return null;
  return group;
}

/** Διαμήκεις: κύλινδροι κατά τον άξονα (curve-aware sampling), ομαδοποιημένοι ανά Ø. */
function addLongitudinalRods(
  group: THREE.Group,
  layout: BeamRebarLayout,
  axisPtCount: number,
  localToThree: (uMm: number, vMm: number, wMm: number) => THREE.Vector3,
): void {
  const subdivisions = axisPtCount <= 2 ? 1 : Math.max(8, axisPtCount * 2);
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
}

/** Συνδετήρες: κλειστά loops στο επίπεδο διατομής (v,w) σε κάθε στάθμη + γάντζοι 135°. */
function addStirrupRods(
  group: THREE.Group,
  layout: BeamRebarLayout,
  stirrupType: StirrupType,
  localToThree: (uMm: number, vMm: number, wMm: number) => THREE.Vector3,
): void {
  const stirrupRadius = Math.max(MIN_RADIUS, (layout.stirrupDiameterMm / 2) * MM_TO_M);
  const ring = layout.stirrupSectionPathMm;
  if (ring.length < 2) return;
  const hooked = stirrupType === 'closed-hooked';
  const segs: Seg[] = [];
  for (const u of layout.stirrupLevelsMm) {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      segs.push({ a: localToThree(u, a.x, a.y), b: localToThree(u, b.x, b.y) });
    }
    if (hooked) {
      for (const hook of layout.stirrupHookEndsMm) {
        for (let i = 1; i < hook.length; i++) {
          segs.push({ a: localToThree(u, hook[i - 1].x, hook[i - 1].y), b: localToThree(u, hook[i].x, hook[i].y) });
        }
      }
    }
  }
  const stirrups = buildRods(segs, stirrupRadius, REBAR_MATERIAL);
  if (stirrups) group.add(stirrups);
}
