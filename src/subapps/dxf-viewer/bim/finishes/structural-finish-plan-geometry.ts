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
import { computeMiteredOuter, segOffsetVec } from './structural-finish-outline-geometry';

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
  const segs = faces.segments;
  const offsets = segs.map((seg) => segOffsetVec(seg, seg.thickness * s));
  const { aOuter, bOuter, aCore, bCore } = computeMiteredOuter(segs, offsets, true);

  const out: FinishPlanPolyline[] = [];
  for (let i = 0; i < segs.length; i++) {
    if (!offsets[i]) continue;
    out.push({
      points: [aCore[i], aOuter[i], bOuter[i], bCore[i]],
      colorHex: getMaterialFlatColorHex(segs[i].materialId),
      heightMm,
    });
  }
  return out;
}
