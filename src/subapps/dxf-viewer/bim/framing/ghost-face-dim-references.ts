/**
 * ghost-face-dim-references — pure SSoT for the Revit-style **listening/temporary
 * dimensions** shown while a wall (or any linear-member) ghost slides ALONG an existing
 * member's face (ADR-508 §dim).
 *
 * Conceptual twin of `bim/walls/opening-dim-references.ts`: an opening slides 1D along its
 * host wall, so its temporary dimensions are OFFSETS ALONG THAT AXIS to the nearest
 * references. Here the ghost plays the opening's role — it occupies `[ghostCenterAlong ±
 * ghostHalfWidth]` along the existing face — and we measure, along the same axis:
 *   1. **leftGap**  — face LEFT end  → ghost LEFT base corner
 *   2. **rightGap** — ghost RIGHT base corner → face RIGHT end
 *   3. **centerToCenter** — face CENTER → ghost axis-center
 *
 * Giorgio (2026-06-21): «να δείχνουμε πάντα 3 νούμερα ταυτόχρονα». All three are emitted
 * every frame (no center-flip), each as two witness points ON the face line + a dim-line
 * reference point offset OUTWARD (toward the ghost) so it clears the existing wall fill.
 *
 * Pure — zero React/DOM/store/Three. Units = **scene units** (= canvas world units), the
 * same frame as `GhostFaceFrame`. The caller supplies zoom-adaptive perpendicular offsets.
 *
 * @see ./linear-member-face-snap.ts — produces the `GhostFaceFrame`
 * @see ../walls/opening-dim-references.ts — the along-axis-offset twin (openings)
 * @see ../../canvas-v2/preview-canvas/ghost-face-dim-paint.ts — renders these via the
 *      ADR-362 `renderPreviewDimension` SSoT
 */

import type { Point2D } from '../../rendering/types/Types';
import type { SceneUnits } from '../../utils/scene-units';
import type { GhostFaceFrame } from './linear-member-face-snap';

/** A single along-face listening dimension (scene units). */
export interface GhostFaceDimension {
  /** Semantic role — drives nothing geometric, useful for labels/tests. */
  readonly kind: 'leftGap' | 'rightGap' | 'centerToCenter';
  /** Witness point A, ON the face line (scene units). */
  readonly p1: Point2D;
  /** Witness point B, ON the face line (scene units). */
  readonly p2: Point2D;
  /** Any point on the dim line — offset OUTWARD from the face so text/line clear the wall. */
  readonly dimLineRef: Point2D;
  /** Measured along-face distance (scene units, ≥ 0). */
  readonly valueScene: number;
}

/** Renderable bundle attached to the wall ghost preview entity (carries the unit system). */
export interface GhostFaceDimensionsMeta {
  readonly sceneUnits: SceneUnits;
  readonly dims: readonly GhostFaceDimension[];
}

export interface GhostFaceDimensionsOptions {
  /** Perpendicular offset (scene units) for the two end-gap dims — the inner stacked row. */
  readonly gapOffsetScene: number;
  /** Perpendicular offset (scene units) for the center-to-center dim — the outer row,
   *  larger so it clears the ghost stub it spans over. */
  readonly centerOffsetScene: number;
  /** Distances below this (scene units) are dropped (flush / zero-width → no dim). */
  readonly minValueScene?: number;
}

/**
 * Resolve the ≤3 along-face listening dimensions for a sliding ghost on `frame`. Returns
 * the dims whose measured value exceeds `minValueScene` (a flush end / centred ghost drops
 * the corresponding zero dim). Pure.
 */
export function resolveGhostFaceDimensions(
  frame: Readonly<GhostFaceFrame>,
  opts: Readonly<GhostFaceDimensionsOptions>,
): readonly GhostFaceDimension[] {
  const { origin: a, axisDir: u, perpDir: p, facePerp, outwardSign } = frame;
  const minValue = opts.minValueScene ?? 1e-6;

  // Point on the face line at longitudinal position `along`.
  const at = (along: number): Point2D => ({
    x: a.x + along * u.x + facePerp * p.x,
    y: a.y + along * u.y + facePerp * p.y,
  });
  // Point offset OUTWARD (toward the ghost) from the face line at `along` by `d`.
  const off = (along: number, d: number): Point2D => ({
    x: a.x + along * u.x + (facePerp + outwardSign * d) * p.x,
    y: a.y + along * u.y + (facePerp + outwardSign * d) * p.y,
  });

  const faceCenterAlong = (frame.faceAlongMin + frame.faceAlongMax) / 2;
  const ghostLeftAlong = frame.ghostCenterAlong - frame.ghostHalfWidth;
  const ghostRightAlong = frame.ghostCenterAlong + frame.ghostHalfWidth;

  const out: GhostFaceDimension[] = [];

  // 1. leftGap — face left end → ghost left base corner.
  pushDim(out, 'leftGap', frame.faceAlongMin, ghostLeftAlong, opts.gapOffsetScene, at, off, minValue);
  // 2. rightGap — ghost right base corner → face right end.
  pushDim(out, 'rightGap', ghostRightAlong, frame.faceAlongMax, opts.gapOffsetScene, at, off, minValue);
  // 3. centerToCenter — face center → ghost axis-center (outer row, larger offset).
  pushDim(out, 'centerToCenter', faceCenterAlong, frame.ghostCenterAlong, opts.centerOffsetScene, at, off, minValue);

  return out;
}

/** Build one dim from two longitudinal positions; append only when length > `minValue`. */
function pushDim(
  out: GhostFaceDimension[],
  kind: GhostFaceDimension['kind'],
  alongA: number,
  alongB: number,
  offsetScene: number,
  at: (along: number) => Point2D,
  off: (along: number, d: number) => Point2D,
  minValue: number,
): void {
  const valueScene = Math.abs(alongB - alongA);
  if (valueScene <= minValue) return;
  out.push({
    kind,
    p1: at(alongA),
    p2: at(alongB),
    dimLineRef: off((alongA + alongB) / 2, offsetScene),
    valueScene,
  });
}
