/**
 * ADR-363 Slice F — Centre-anchored footprint local→world transform (SSoT).
 *
 * ONE implementation of the centre-anchored box geometry shared by every
 * point-based BIM entity whose footprint is anchored at a reference `position`
 * via a 9-way anchor, sized `dimX × dimY` (mm), rotated `rotationDeg` and scaled
 * to scene units: column (`column-grip-utils` + `column-anchors`) and foundation
 * pad (`foundation-grips`). Before this module the SAME "anchor shift → rotate →
 * scale → translate" math was hand-written in THREE places (and `column-anchors`
 * re-implemented raw `cos`/`sin`, violating the `rotatePoint` SSoT of ADR-188).
 *
 * The geometry is here; the ENTITY-SPECIFIC `dimX`/`dimY` extraction (column:
 * width×depth, or `polygonBboxMm` / `polygonBackedBboxMm` for polygon / U-shape /
 * composite; pad: width×length) and any circular special-case stay in each caller,
 * so this stays a pure, behaviour-preserving geometric core.
 *
 * Units: `position` is in SCENE units; `dimX`/`dimY` and any `localMm` offset are
 * in mm and scaled by `scale` (= `mmScaleFor(params)`) here. Rotation goes through
 * the shared `rotateVector` (→ canonical `rotatePoint`, ADR-188) — never raw cos/sin.
 *
 * Zero React / DOM / Firestore / canvas deps.
 *
 * @see bim/grips/grip-math.ts — rotateVector / farEdgeSign SSoT
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md Slice F
 */

import type { Point2D } from '../../rendering/types/Types';
import { translatePoint } from '../../rendering/entities/shared/geometry-vector-utils';
import { rotateVector } from './grip-math';

/**
 * The minimal spec of a centre-anchored footprint. `anchorOffset` is the entity's
 * `ANCHOR_OFFSETS[anchor]` (local fractions in [-0.5, +0.5]); `dimX`/`dimY` are the
 * footprint extents (mm) the caller derives per kind.
 */
export interface CentredAnchorFrame {
  /** Anchor reference point (the click point), scene units. */
  readonly position: Point2D;
  /** Plan rotation, degrees CCW. */
  readonly rotationDeg: number;
  /** mm → scene-unit scale (`mmScaleFor(params)`). */
  readonly scale: number;
  /** `ANCHOR_OFFSETS[anchor]` — local anchor fractions. */
  readonly anchorOffset: { readonly dx: number; readonly dy: number };
  /** mm footprint extent along local +X. */
  readonly dimX: number;
  /** mm footprint extent along local +Y. */
  readonly dimY: number;
}

/**
 * World position of the footprint CENTROID = `position` shifted by the anchor
 * offset (`−dx·dimX, −dy·dimY` mm, scaled) rotated into world. Inverse: the anchor
 * reference point is `centroid + R(dx·dimX, dy·dimY)`.
 */
export function centredCentroidWorld(frame: CentredAnchorFrame): Point2D {
  const shift = rotateVector(
    { x: -frame.anchorOffset.dx * frame.dimX * frame.scale, y: -frame.anchorOffset.dy * frame.dimY * frame.scale },
    frame.rotationDeg,
  );
  return translatePoint(frame.position, shift);
}

/**
 * A local-frame mm point (centred on the centroid, before rotation) → world: the
 * centroid + the local offset (scaled) rotated into world. The single transform
 * every centre-anchored handle position (width / depth / length / rotation /
 * corner) goes through.
 */
export function centredLocalToWorld(frame: CentredAnchorFrame, localMm: Point2D): Point2D {
  const centroid = centredCentroidWorld(frame);
  const rotated = rotateVector({ x: localMm.x * frame.scale, y: localMm.y * frame.scale }, frame.rotationDeg);
  return translatePoint(centroid, rotated);
}

/**
 * Batch transform of an ALREADY-SCALED local footprint polygon (canvas units) →
 * world: anchor-shift → rotate → translate, applied to every vertex. The geometry
 * render core (`transformFootprint`) builds its local vertices in canvas units
 * (mm × scale) already, so — unlike {@link centredLocalToWorld} — the points are NOT
 * re-scaled here; only `dimX`/`dimY` (mm) inside `centredCentroidWorld` get scaled
 * for the anchor shift. This is the SAME `rotateVector` (→ `rotatePoint`, ADR-188)
 * SSoT the grip/anchor handles use — no more per-engine raw cos/sin.
 */
export function centredPolyToWorld(
  frame: CentredAnchorFrame,
  localCanvasPts: readonly Point2D[],
): Point2D[] {
  const centroid = centredCentroidWorld(frame);
  return localCanvasPts.map((p) => {
    const rotated = rotateVector({ x: p.x, y: p.y }, frame.rotationDeg);
    return translatePoint(centroid, rotated);
  });
}
