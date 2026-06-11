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
// ADR-397 §D3 — local-frame rotation primitives are shared SSoT (grip-math →
// canonical rotatePoint, ADR-188). This module keeps the column-named exports as
// thin wrappers so callers (column-grips / column-variant-grips) stay unchanged.
import { rotateVector, projectToLocalFrame } from '../grips/grip-math';

export const DEG_TO_RAD = Math.PI / 180;
export const RAD_TO_DEG = 180 / Math.PI;

/** mm. Offset της λαβής rotation πάνω από το north edge (visual separation). */
export const ROTATION_HANDLE_OFFSET_MM = 200;

/**
 * Rotate vector `v` by `rotDeg` (CCW) around the origin. Thin wrapper over the
 * shared SSoT `rotateVector` (grip-math → canonical `rotatePoint`). Kept under
 * the column-local name so existing callers need no churn.
 */
export function rotate(v: Point2D, rotDeg: number): Point2D {
  return rotateVector(v, rotDeg);
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
  // SSoT: inverse rotation onto the local axes via shared `projectToLocalFrame`.
  const local = projectToLocalFrame(delta, rotDeg);
  return { dxLocal: local.x, dyLocal: local.y };
}

/**
 * Bounding-box dimensions (mm) of a polygon-backed cross-section (U-shape /
 * composite, ADR-363 Phase 2b). The polygon is bbox-centred by invariant (the
 * «από-περίγραμμα» generator + `resizePolyVertex` re-centre it), so the centre
 * is 0 and only the spans matter for the anchor shift.
 */
export function polygonBackedBboxMm(
  poly: readonly Point2D[],
): { dimX: number; dimY: number } {
  let minX = Number.POSITIVE_INFINITY, maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY, maxY = Number.NEGATIVE_INFINITY;
  for (const p of poly) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { dimX: maxX - minX, dimY: maxY - minY };
}

/**
 * Compute the centroid (bbox centre) of the column footprint σε world coords.
 * For non-circular / non-polygon: `centroid = position + rotatedR(-dx*width, -dy*depth)`.
 * For circular: anchor effectively 'center', `centroid = position`.
 * For polygon (Phase 8C): uses actual N-gon bbox `dimX, dimY` (mirror του
 * `transformFootprint` geometry pipeline), since polygon `depth` is meaningless
 * και bbox depends on sides count.
 * For polygon-backed U-shape / composite (Phase 2b): uses the actual polygon
 * bbox (mirror της `transformFootprint` `computeLocalBboxCanvas` κλάδου) ώστε
 * τα grips να ταιριάζουν με τη γεωμετρία σε ΟΛΑ τα anchors, όχι μόνο 'center'.
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
  const uPoly = params.kind === 'U-shape' ? params.ushape?.polygon : undefined;
  const cPoly = params.kind === 'composite' ? params.composite?.polygon : undefined;
  if (params.kind === 'polygon') {
    ({ dimX, dimY } = polygonBboxMm(params.width, params.polygon?.sides));
  } else if (uPoly && uPoly.length >= 3) {
    ({ dimX, dimY } = polygonBackedBboxMm(uPoly));
  } else if (cPoly && cPoly.length >= 3) {
    ({ dimX, dimY } = polygonBackedBboxMm(cPoly));
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

// ─── Base grip handle positions (Phase 4.5 + 8C) ─────────────────────────────

/**
 * World position of the width grip handle (far edge midpoint along local X).
 * Local coords (centered on centroid): `(signX*width/2, 0)`. Polygon uses
 * symmetric +X point at (width/2, 0) τοπικού πλαισίου centroid (circumscribed
 * radius representation — visually πέφτει στην περίμετρο του circumscribed
 * circle, ελαφρώς εκτός polygon για N≠4).
 *
 * ADR-397 — handle positions go through `localToWorld`, which scales the mm
 * local offset by `mmScaleFor(params)` so the handles stay on the column body in
 * metre/cm scenes (the off-screen-grip bug). `localToWorld` already adds the
 * centroid + applies rotation.
 */
export function widthHandleWorld(params: ColumnParams): Point2D {
  if (params.kind === 'circular') {
    // Circular handle sits on the world +X radius from `position` (no rotation).
    return { x: params.position.x + (params.width / 2) * mmScaleFor(params), y: params.position.y };
  }
  if (params.kind === 'polygon') {
    return localToWorld({ x: params.width / 2, y: 0 }, params);
  }
  const { dx } = ANCHOR_OFFSETS[params.anchor];
  const signX = farEdgeSignX(dx);
  return localToWorld({ x: (signX * params.width) / 2, y: 0 }, params);
}

/**
 * World position of the depth grip handle (far edge midpoint along local Y).
 */
export function depthHandleWorld(params: ColumnParams): Point2D {
  const { dy } = ANCHOR_OFFSETS[params.anchor];
  const signY = farEdgeSignY(dy);
  return localToWorld({ x: 0, y: (signY * params.depth) / 2 }, params);
}

/**
 * World position of the rotation grip handle. Stands off the perpendicular face
 * OPPOSITE the depth handle (centroid + rotated(0, −signY·(dimY/2 + offset))) —
 * the depth handle (= the πάχος handle for a `shear-wall`, ADR-363 Phase 8) sits
 * on the `signY` face, so the rotation handle goes on the −signY face. Revit-style
 * clean separation: the rotation control is NEVER coincident with a dimension
 * handle (mirrors the axis-box rule — rotation → opposite perp face from
 * `width-edge` — so all 5 structural entities follow one rule). Polygon uses the
 * actual N-gon bbox dimY (`polygonBboxMm`) αντί για το meaningless `params.depth`.
 */
export function rotationHandleWorld(params: ColumnParams): Point2D {
  const dimY = params.kind === 'polygon'
    ? polygonBboxMm(params.width, params.polygon?.sides).dimY
    : params.depth;
  // Depth handle face = `signY` (farEdgeSignY of the anchor's dy); rotation stands
  // off the opposite (−signY) face so the two never coincide for any anchor.
  const dy = params.kind === 'polygon' ? 0 : ANCHOR_OFFSETS[params.anchor].dy;
  const signY = farEdgeSignY(dy);
  return localToWorld({ x: 0, y: -signY * (dimY / 2 + ROTATION_HANDLE_OFFSET_MM) }, params);
}
