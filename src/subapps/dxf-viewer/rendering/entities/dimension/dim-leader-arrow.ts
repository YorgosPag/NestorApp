/**
 * ADR-608 — pure helpers for Tekton «Βέλος 2» **leader arrows**. Extracted from
 * `DimensionRenderer` so it stays under the 500-line limit AND the leader behaviour is fully
 * unit-tested (regression lock, Giorgio 2026-07-09).
 *
 * A leader arrow carries a horizontal line (leader) from its tip toward the dim-line centre.
 * Two consequences the standard renderer path doesn't cover:
 *   1. the central dim line is **pulled back** (inset) at each anchor so it starts/ends where the
 *      leaders end (`insetDimLineSegments`), and
 *   2. the arrowhead uses a **deterministic inward** direction, immune to the DIMATFIT fit-flip
 *      (`resolveLeaderArrowDir`) — else a text-size change silently flips one head.
 *
 * A block opts in via `ArrowheadBlockDefinition.dimLineInset` (unit space, 1 = `dimasz`). Standard
 * blocks leave it absent → every helper here degrades to the pre-ADR-608 behaviour.
 */

import type { Point2D } from '../../types/Types';
import type { DimStyle } from '../../../types/dimension';
import type { DimLineSegment } from '../../../systems/dimensions/dim-geometry-builder';
import type { SceneUnits } from '../../../utils/scene-units';
import {
  resolveArrowBlockNames,
  getArrowheadBlock,
} from '../../../systems/dimensions/dim-arrowhead-blocks';
import { paperHeightToModel } from '../../../utils/annotation-scale';
import {
  addPoints, scalePoint, getUnitVector, dotProduct, subtractPoints, calculateDistance,
} from '../shared/geometry-vector-utils';

/** Below this projected span (world units) an inset segment is dropped as degenerate. */
const DIM_LINE_INSET_EPSILON = 1e-6;

/** The DIMSTYLE fields that name the per-side arrowhead blocks. */
type ArrowBlockStyle = Pick<DimStyle, 'dimblk' | 'dimblk1' | 'dimblk2'>;

/** True when either arrowhead carries a leader (`dimLineInset > 0`) → Tekton «Βέλος 2» behaviour. */
export function hasLeaderArrows(style: ArrowBlockStyle): boolean {
  const { block1, block2 } = resolveArrowBlockNames(style);
  return (
    (getArrowheadBlock(block1).dimLineInset ?? 0) > 0 ||
    (getArrowheadBlock(block2).dimLineInset ?? 0) > 0
  );
}

/**
 * Per-anchor dim-line pull-back (world units) = each side's arrowhead `dimLineInset` (unit space)
 * × the arrow world-unit length (`paperHeightToModel(dimasz, dimscale)`). Standard blocks → 0.
 */
export function resolveDimLineInsets(
  style: ArrowBlockStyle & Pick<DimStyle, 'dimasz' | 'dimscale'>,
  sceneUnits: SceneUnits,
): { inset1: number; inset2: number } {
  const { block1, block2 } = resolveArrowBlockNames(style);
  const worldUnit = paperHeightToModel(style.dimasz, style.dimscale, sceneUnits);
  return {
    inset1: (getArrowheadBlock(block1).dimLineInset ?? 0) * worldUnit,
    inset2: (getArrowheadBlock(block2).dimLineInset ?? 0) * worldUnit,
  };
}

/**
 * Pull the dim line back from each anchor by `inset1`/`inset2` (world units), so a leader-carrying
 * arrow leaves a gap its leader fills. Clamps each segment's projection onto the axis to
 * `[inset1, length − inset2]`; segments fully inside the leader zone drop out. Both insets 0 →
 * segments returned unchanged (all standard arrowheads).
 */
export function insetDimLineSegments(
  segs: readonly DimLineSegment[],
  start: Point2D,
  end: Point2D,
  inset1: number,
  inset2: number,
): DimLineSegment[] {
  if (inset1 <= 0 && inset2 <= 0) return [...segs];
  const length = calculateDistance(start, end);
  const lo = inset1;
  const hi = length - inset2;
  if (hi <= lo) return []; // leaders cover the whole span → no central line
  const axis = getUnitVector(start, end);
  const out: DimLineSegment[] = [];
  for (const s of segs) {
    const t0 = dotProduct(subtractPoints(s.start, start), axis);
    const t1 = dotProduct(subtractPoints(s.end, start), axis);
    const a = Math.max(Math.min(t0, t1), lo);
    const b = Math.min(Math.max(t0, t1), hi);
    if (b - a > DIM_LINE_INSET_EPSILON) {
      out.push({ start: addPoints(start, scalePoint(axis, a)), end: addPoints(start, scalePoint(axis, b)) });
    }
  }
  return out;
}

/**
 * Arrowhead direction for one side. Leader arrows use a **deterministic inward** direction (the
 * negated geometric `outward`), immune to the fit flip — the mirrored Tekton block is calibrated
 * for it (tip outward + leader toward centre). Standard arrows keep `fitOrGeometry` (the DIMATFIT
 * placement direction, else the geometric outward).
 */
export function resolveLeaderArrowDir(
  hasLeader: boolean,
  outward: Point2D,
  fitOrGeometry: Point2D,
): Point2D {
  return hasLeader ? scalePoint(outward, -1) : fitOrGeometry;
}
