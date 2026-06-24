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
import type { ColumnEntity, ColumnParams } from '../types/column-types';
import type { GripInfo } from '../../hooks/useGripMovement';
import { ANCHOR_OFFSETS } from '../types/column-types';
import { columnFootprintDims, polygonBboxMm } from './column-footprint-dims';
import { mmScaleFor } from '../../utils/scene-units';
// ADR-397 §D3 — local-frame rotation primitives are shared SSoT (grip-math →
// canonical rotatePoint, ADR-188). This module keeps the column-named exports as
// thin wrappers so callers (column-grips / column-variant-grips) stay unchanged.
import { rotateVector, projectToLocalFrame, farEdgeSign } from '../grips/grip-math';
import { rotationHandlePerpOffset } from '../grips/rotation-handle-policy';
import {
  centredCentroidWorld,
  centredLocalToWorld,
  type CentredAnchorFrame,
} from '../grips/centred-anchor-frame';

export const DEG_TO_RAD = Math.PI / 180;
export const RAD_TO_DEG = 180 / Math.PI;

/** mm. Rotation-handle stand-off. Single source = `rotation-handle-policy`; re-exported here for existing importers. */
export { ROTATION_HANDLE_OFFSET_MM } from '../grips/rotation-handle-policy';

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
 * Footprint-dim SSoT lives in `column-footprint-dims`; re-exported here so existing
 * importers (`column-poly-vertex-grips`) keep their import path.
 */
export { polygonBackedBboxMm } from './column-footprint-dims';

/**
 * Column footprint → shared `CentredAnchorFrame`. Circular bypasses the anchor
 * shift (rotationally symmetric, centroid = `position`) via a zero anchor offset;
 * other kinds use `ANCHOR_OFFSETS` + `columnFootprintDims`. The rotate/scale/shift
 * geometry itself lives in the `centred-anchor-frame` SSoT (shared with the pad).
 */
function columnAnchorFrame(params: ColumnParams): CentredAnchorFrame {
  const scale = mmScaleFor(params);
  const position = { x: params.position.x, y: params.position.y };
  if (params.kind === 'circular') {
    return { position, rotationDeg: params.rotation, scale, anchorOffset: { dx: 0, dy: 0 }, dimX: 0, dimY: 0 };
  }
  return { position, rotationDeg: params.rotation, scale, anchorOffset: ANCHOR_OFFSETS[params.anchor], ...columnFootprintDims(params) };
}

/**
 * Compute the centroid (bbox centre) of the column footprint σε world coords —
 * thin wrapper over the shared `centredCentroidWorld` (ADR-397 scene-unit-correct
 * anchor shift). For circular: anchor effectively 'center' → centroid = `position`.
 */
export function computeCentroidWorld(params: ColumnParams): Point2D {
  return centredCentroidWorld(columnAnchorFrame(params));
}

/**
 * Convert a local-frame mm point (centred on centroid, no anchor shift, no
 * rotation) → world — thin wrapper over the shared `centredLocalToWorld`.
 */
export function localToWorld(local: Point2D, params: ColumnParams): Point2D {
  return centredLocalToWorld(columnAnchorFrame(params), local);
}

/**
 * ADR-518 — SSoT for the gripIndex-0 centre MOVE grip (4-arrow glyph). Shared by
 * BOTH `rectColumnGrips` (rectangular / shear-wall) AND `polygonReshapeGrips`
 * (regular polygon) so the centre-move emission lives in ONE place (N.0.2 Boy-Scout
 * dedup of the prior inline literal). `movesEntity: true` + `column-center` kind →
 * the registry paints the 4-separate-arrow move glyph and the move-glyph zone
 * hit-test (`move-glyph-zones`) gives each arrow its own directional function.
 */
export function columnCenterMoveGrip(entity: Readonly<ColumnEntity>): GripInfo {
  return {
    entityId: entity.id,
    gripIndex: 0,
    type: 'center',
    position: computeCentroidWorld(entity.params),
    movesEntity: true,
    columnGripKind: 'column-center',
  };
}

// Far-edge face sign = shared `farEdgeSign` SSoT (grip-math) — applied to the
// anchor's local dx (width axis) or dy (depth axis).

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
  const signX = farEdgeSign(dx);
  return localToWorld({ x: (signX * params.width) / 2, y: 0 }, params);
}

/**
 * World position of the depth grip handle (far edge midpoint along local Y).
 */
export function depthHandleWorld(params: ColumnParams): Point2D {
  const { dy } = ANCHOR_OFFSETS[params.anchor];
  const signY = farEdgeSign(dy);
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
  // ADR-363 — rectangular / shear-wall (Giorgio 2026-06-15): the rotation marker
  // sits at the MIDPOINT of the imaginary line from the centre to the south
  // edge-midpoint → local (0, −depth/4). Kept HERE (the single rotation-position
  // SSoT) so the grip emission AND the rotation drag (`rotateAroundPosition`,
  // which reads this) agree — otherwise the handle would jump on grab. Inlined
  // kind check (mirror `isRectColumn`) to avoid a column-rect-adapter import cycle.
  if (params.kind === 'rectangular' || params.kind === 'shear-wall') {
    return localToWorld({ x: 0, y: -params.depth / 4 }, params);
  }
  // ADR-518 — polygon mirror του rectangular: η λαβή περιστροφής στο μέσο της νοητής
  // γραμμής κέντρο→κάτω edge-midpoint (local (0,−dimY/4)) — ΑΝΑΜΕΣΑ στο center MOVE
  // (centroid) και την κάτω λαβή. ΠΟΤΕ πάνω στο centroid (όπου κάθεται το move glyph,
  // αφού `interiorAnchorPoint` ≈ centroid για convex N-gon) ΟΥΤΕ στην περίμετρο (λαβές
  // γωνιών/πλευρών). `dimY` = πραγματικό N-gon bbox. Emission ≡ rotation drag, αφού
  // το `polygon` ΔΕΝ μπαίνει στο `usesFreeReshapeGrips` (διαβάζει αυτή την ίδια θέση).
  if (params.kind === 'polygon') {
    const dimY = polygonBboxMm(params.width, params.polygon?.sides).dimY;
    return localToWorld({ x: 0, y: -dimY / 4 }, params);
  }
  // Depth handle face = `signY` (farEdgeSign of the anchor's dy); the shared
  // rotation-handle policy stands the rotation handle off the OPPOSITE (−signY)
  // face so the two never coincide for any anchor (mm local frame → `localToWorld`).
  const dy = ANCHOR_OFFSETS[params.anchor].dy;
  const signY = farEdgeSign(dy);
  return localToWorld({ x: 0, y: rotationHandlePerpOffset(params.depth / 2, signY) }, params);
}
