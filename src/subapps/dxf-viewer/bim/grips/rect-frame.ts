/**
 * ADR-363 / ADR-436 — Rectangle grip FRAME (SSoT geometry primitive).
 *
 * The canonical, entity-agnostic description of an axis-aligned-in-local-frame
 * rectangle footprint, plus the pure helpers that read its corner / edge-midpoint
 * world positions. Consumed by `rect-grip-engine.ts` (resize transforms) and by
 * every rectangular BIM entity's grip module via a small per-entity adapter
 * (wall straight / column rect+shear-wall / foundation pad). Before this module
 * each entity re-derived corner/edge math in its own `*-grips.ts`; this collapses
 * the rotated-rectangle geometry into ONE place.
 *
 * Coordinates: `center`, `halfWidth`, `halfLength` are in SCENE units (already
 * scaled from mm by the caller's `mmScaleFor`) so the engine stays purely
 * geometric — unit conversion + anchor semantics live in the entity adapter.
 *
 * Zero React / DOM / Firestore / canvas deps.
 *
 * @see rect-grip-engine.ts — corner/edge resize transforms
 * @see bim/grips/grip-math.ts — rotateVector / projectToLocalFrame SSoT (ADR-397)
 */

import type { Point2D } from '../../rendering/types/Types';
import { translatePoint } from '../../rendering/entities/shared/geometry-vector-utils';
import { rotateVector } from './grip-math';

/**
 * A rotated rectangle, centred on its footprint centroid. `halfWidth` is the
 * half-extent along the local +X axis, `halfLength` along local +Y; both are in
 * scene units. `rotationDeg` is CCW degrees (same convention as `rotateVector`).
 */
export interface RectFrame {
  readonly center: Point2D;
  readonly rotationDeg: number;
  readonly halfWidth: number;
  readonly halfLength: number;
}

/** Sign along a local axis: `+1` = positive face, `-1` = negative face. */
export type RectSign = -1 | 1;

/** A corner identified by its sign on each local axis (e.g. `{sx:+1, sy:+1}` = NE). */
export interface RectCorner {
  readonly sx: RectSign;
  readonly sy: RectSign;
}

/** Which local axis a dimension/edge lives on: `x` = width, `y` = length. */
export type RectAxis = 'x' | 'y';

/** An edge midpoint identified by its axis + far/near sign. */
export interface RectEdge {
  readonly axis: RectAxis;
  readonly sign: RectSign;
}

/**
 * The four corners in stable CCW order starting from the +X/+Y quadrant: NE,
 * NW, SW, SE. Stable order so a consumer can map them to fixed grip kinds.
 */
export const RECT_CORNERS: readonly RectCorner[] = [
  { sx: 1, sy: 1 },
  { sx: -1, sy: 1 },
  { sx: -1, sy: -1 },
  { sx: 1, sy: -1 },
];

/**
 * Local-frame (scene-unit) point — centred on the centroid, axes aligned to the
 * frame's local +X/+Y before rotation — → world coords. Exposed as SSoT so
 * consumers can place handles at arbitrary local offsets (e.g. the rotation
 * handle's stand-off beyond a face) instead of re-deriving the rotate+translate.
 */
export function rectLocalWorld(frame: RectFrame, localX: number, localY: number): Point2D {
  const r = rotateVector({ x: localX, y: localY }, frame.rotationDeg);
  return translatePoint(frame.center, r);
}

/** World position of a corner handle. */
export function rectCornerWorld(frame: RectFrame, corner: RectCorner): Point2D {
  return rectLocalWorld(frame, corner.sx * frame.halfWidth, corner.sy * frame.halfLength);
}

/** World position of an edge-midpoint handle (width edge for `x`, length edge for `y`). */
export function rectEdgeWorld(frame: RectFrame, edge: RectEdge): Point2D {
  return edge.axis === 'x'
    ? rectLocalWorld(frame, edge.sign * frame.halfWidth, 0)
    : rectLocalWorld(frame, 0, edge.sign * frame.halfLength);
}
