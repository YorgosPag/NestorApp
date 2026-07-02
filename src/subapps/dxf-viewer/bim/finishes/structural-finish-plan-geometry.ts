/**
 * ADR-505 (finish/rebar export) — Γεωμετρία σοβατισμένης όψης σε κάτοψη (pure SSoT).
 *
 * Το «σώμα» του πρώην `drawStructuralFinishOutline` ΠΡΙΝ το ctx: από τις exposed
 * `StructuralFinishFaces` παράγει τις **world λωρίδες** σοβά (4 σημεία ανά όψη:
 * core-a → outer-a → outer-b → core-b) μέσω του ΚΟΙΝΟΥ `computeMiteredOuter`/
 * `segOffsetVec` (ίδιες γωνίες με 2Δ ΚΑΙ 3Δ). Κάθε λωρίδα φέρει χρώμα υλικού +
 * ύψος (mm) ώστε ο DXF export να την extrude-άρει (group-39) σαν το σώμα.
 *
 * Καταναλώνεται από: `structural-finish-outline-2d.ts` (canvas) + `overlay-dxf-collector.ts` (DXF).
 *
 * @see ./structural-finish-outline-geometry.ts — γωνιακή math SSoT
 * @see ../renderers/structural-finish-outline-2d.ts — ο canvas consumer
 */

import type { Point2D } from '../../rendering/types/Types';
import type { StructuralFinishFaces } from './structural-finish-types';
import { getMaterialFlatColorHex } from '../materials/material-catalog-defs';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';
import { computeBandFinishQuads, type BandFinishQuad } from './structural-finish-outline-geometry';
import type { FinishStrip } from './structural-finish-vertical-merge';

/** Μια λωρίδα σοβά σε κάτοψη (world coords) + χρώμα υλικού + ύψος για extrusion. */
export interface FinishPlanPolyline {
  /** 4 σημεία: aCore → aOuter → bOuter → bCore (ανοιχτή — η core πλευρά ακουμπά το σώμα). */
  readonly points: readonly Point2D[];
  /** Χρώμα flat υλικού σοβά (ίδιο με 2Δ/3Δ). */
  readonly colorHex: string;
  /** Ύψος (mm) της κατακόρυφης ζώνης σοβά — για DXF extrusion (group 39). */
  readonly heightMm: number;
}

/**
 * ADR-449 — ΕΝΑ mitered quad (BandFinishQuad ή FinishStrip) → μία λωρίδα κάτοψης (4 σημεία
 * aCore→aOuter→bOuter→bCore + χρώμα). Per-face `colorOverride` (Revit «Paint») υπερισχύει του
 * χρώματος υλικού· απόν → flat χρώμα καταλόγου (materialId, SSoT με 3Δ). BOQ αμετάβλητο.
 */
function quadToPlanPolyline(q: BandFinishQuad | FinishStrip, heightMm: number): FinishPlanPolyline {
  return {
    points: [q.aCore, q.aOuter, q.bOuter, q.bCore],
    colorHex: q.seg.colorOverride ?? getMaterialFlatColorHex(q.seg.materialId),
    heightMm,
  };
}

/**
 * Λωρίδες σοβά μιας ομάδας faces σε world coords. `heightMm` = ύψος της ζώνης
 * (silhouette band) στην οποία ανήκουν οι faces. Κενό όταν δεν υπάρχουν faces.
 */
export function collectFinishOutlinePlanPolylines(
  faces: StructuralFinishFaces | undefined,
  sceneUnits: SceneUnits,
  heightMm: number,
): FinishPlanPolyline[] {
  if (!faces || faces.segments.length === 0) return [];
  const s = mmToSceneUnits(sceneUnits);
  return computeBandFinishQuads(faces.segments, s).map((q) => quadToPlanPolyline(q, heightMm));
}

/**
 * ADR-449 Slice X6 — λωρίδες κάτοψης από κατακόρυφα-ενοποιημένα `FinishStrip[]` (DXF export):
 * κάθε strip έχει έτοιμο mitered quad + το δικό του ύψος `zTop−zBot` → μία extrusion ανά συνεχή
 * όψη (μηδέν στοιβαγμένες per-band extrusions στο εξαγόμενο μοντέλο). ΙΔΙΟ SSoT με το 2Δ/3Δ.
 */
export function collectFinishStripPlanPolylines(strips: readonly FinishStrip[]): FinishPlanPolyline[] {
  return strips.map((strip) => quadToPlanPolyline(strip, Math.max(0, strip.zTopMm - strip.zBottomMm)));
}
