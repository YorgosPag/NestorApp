/**
 * ADR-363 Phase 4.5 + 4.5b — Shared local-frame math για column grips.
 *
 * Pure, side-effect-free primitives reused από `column-grips.ts` (base) και
 * `column-variant-grips.ts` (Phase 4.5b L/T variant grips). Extracted ώστε το
 * core module να μένει εντός του 500-line Google budget (CLAUDE.md N.7.1) και
 * το variant module να μην επανυλοποιεί τη rotated-frame γεωμετρία.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.6 §6 Phase 4.5/4.5b
 */

import type { Point2D } from '../../rendering/types/Types';
import type { ColumnParams } from '../types/column-types';
import { ANCHOR_OFFSETS } from '../types/column-types';
import { polygonBboxMm } from './column-anchors';
import { mmScaleFor } from '../../utils/scene-units';

export const DEG_TO_RAD = Math.PI / 180;
export const RAD_TO_DEG = 180 / Math.PI;

/** mm. Offset της λαβής rotation πάνω από το north edge (visual separation). */
export const ROTATION_HANDLE_OFFSET_MM = 200;

/**
 * Rotate vector `v` by `rotDeg` (CCW) around the origin. Returns new vector.
 */
export function rotate(v: Point2D, rotDeg: number): Point2D {
  const r = rotDeg * DEG_TO_RAD;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
}

/**
 * Project world delta onto the column's local rotated axes. Returns
 * `{ dxLocal, dyLocal }` where dxLocal is the component along the rotated +X
 * axis και dyLocal along rotated +Y.
 */
export function projectDeltaToLocal(
  delta: Point2D,
  rotDeg: number,
): { dxLocal: number; dyLocal: number } {
  const r = rotDeg * DEG_TO_RAD;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return { dxLocal: delta.x * c + delta.y * s, dyLocal: -delta.x * s + delta.y * c };
}

/**
 * Compute the centroid (bbox centre) of the column footprint σε world coords.
 * For non-circular / non-polygon: `centroid = position + rotatedR(-dx*width, -dy*depth)`.
 * For circular: anchor effectively 'center', `centroid = position`.
 * For polygon (Phase 8C): uses actual N-gon bbox `dimX, dimY` (mirror του
 * `transformFootprint` geometry pipeline), since polygon `depth` is meaningless
 * και bbox depends on sides count.
 */
export function computeCentroidWorld(params: ColumnParams): Point2D {
  if (params.kind === 'circular') {
    return { x: params.position.x, y: params.position.y };
  }
  // ADR-397 — `params.position` is in scene units (the click point) but
  // width/depth are in mm; scale the anchor shift by `mmScaleFor` so the centroid
  // lands correctly in metre/cm scenes (same SSoT factor `computeColumnGeometry`
  // applies). See feedback: BIM grip positions must be scene-unit-correct.
  const s = mmScaleFor(params);
  const { dx, dy } = ANCHOR_OFFSETS[params.anchor];
  let dimX: number;
  let dimY: number;
  if (params.kind === 'polygon') {
    ({ dimX, dimY } = polygonBboxMm(params.width, params.polygon?.sides));
  } else {
    dimX = params.width;
    dimY = params.depth;
  }
  const shift = rotate({ x: -dx * dimX * s, y: -dy * dimY * s }, params.rotation);
  return { x: params.position.x + shift.x, y: params.position.y + shift.y };
}

/**
 * Convert a local-frame point (centered on centroid, ΧΩΡΙΣ anchor shift,
 * ΧΩΡΙΣ rotation) σε world coords, εφαρμόζοντας params.rotation γύρω από το
 * centroid.
 */
export function localToWorld(local: Point2D, params: ColumnParams): Point2D {
  // ADR-397 — `local` is a mm offset in the column's own frame; scale to scene
  // units (mirror `computeCentroidWorld`) so variant handles do not drift
  // off-screen in metre/cm scenes.
  const s = mmScaleFor(params);
  const centroid = computeCentroidWorld(params);
  const rotated = rotate({ x: local.x * s, y: local.y * s }, params.rotation);
  return { x: centroid.x + rotated.x, y: centroid.y + rotated.y };
}

/**
 * Resolve far-edge sign along local X axis. Returns `+1` (east edge) for
 * `dx <= 0`, `-1` (west edge) for `dx > 0`. Guarantees non-zero coefficient
 * for width handle even when anchor sits on east/west edge.
 */
export function farEdgeSignX(dx: number): number {
  return dx <= 0 ? +1 : -1;
}

/**
 * Same as `farEdgeSignX` but for local Y axis (north / south).
 */
export function farEdgeSignY(dy: number): number {
  return dy <= 0 ? +1 : -1;
}
