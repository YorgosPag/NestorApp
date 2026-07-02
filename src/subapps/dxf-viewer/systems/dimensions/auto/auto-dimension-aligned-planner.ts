/**
 * ADR-563 Φ4-Β (Auto-Dimension) — Aligned chain planner for SKEWED members (pure).
 *
 * The perimeter/interior planners project every element onto the global X/Y
 * bbox, so a DIAGONAL wall is dimensioned by its bounding-box width — not its
 * true length. This planner emits an ALIGNED dimension parallel to each skewed
 * linear member's own axis (Revit "Add Aligned Dimensions to Walls"), measuring
 * the real span. Axis-aligned members are skipped — the perimeter/interior
 * chains already handle those correctly.
 *
 * Reuses the axis SSoT wholesale — `unitAxis` (`bim/walls/wall-grip-math.ts`) for
 * walls, `beamAxisSceneFrame` (`bim/beams/beam-axis-scene-frame.ts`) for beams,
 * and `perpUnit`/`project2D` (`bim/grips/grip-math.ts`) for the offset. No new
 * geometry math (N.0.2). Emits `dimensionType:'aligned'` segments the entity
 * factory turns into `AlignedDimensionEntity` — already supported end-to-end by
 * `buildAlignedGeometry` + the dimension renderer (no downstream changes).
 *
 * First slice: NON-associative (no `source1/2`) — follow-on-move on a skewed
 * axis would need a vector `bimAnchor` in the shared `dim-association-service`
 * (out of scope). Columns have no axis SSoT → excluded (walls + beams only).
 *
 * @see auto-dimension-engine.ts — concatenates this planner's output when opted in.
 */

import type { Entity } from '../../../types/entities';
import { isWallEntity, isBeamEntity } from '../../../types/entities';
import type { Point2D } from '../../../rendering/types/Types';
import { unitAxis } from '../../../bim/walls/wall-grip-math';
import { perpUnit, project2D } from '../../../bim/grips/grip-math';
import { beamAxisSceneFrame } from '../../../bim/beams/beam-axis-scene-frame';
import type { AutoDimensionOptions, PlannedSegment } from './auto-dimension-types';

/**
 * Below this the member's axis is treated as horizontal/vertical (~0.5° off an
 * axis) and left to the perimeter/interior chains. `sin(0.5°) ≈ 0.0087`.
 */
const AXIS_ALIGNED_EPS = 0.0087;

/** A skewed member reduced to its axis: endpoints + unit direction. */
interface MemberAxis {
  readonly start: Point2D;
  readonly end: Point2D;
  readonly u: { readonly x: number; readonly y: number };
}

/** True when the unit axis is neither ~horizontal nor ~vertical (i.e. skewed). */
function isSkewed(u: { x: number; y: number }): boolean {
  return Math.abs(u.x) > AXIS_ALIGNED_EPS && Math.abs(u.y) > AXIS_ALIGNED_EPS;
}

/** Extract a skewed member's axis, or null when axis-aligned/degenerate/unsupported. */
function memberAxisOf(e: Entity): MemberAxis | null {
  if (isWallEntity(e)) {
    const u = unitAxis(e.params);
    if (!u || !isSkewed(u)) return null;
    return { start: project2D(e.params.start), end: project2D(e.params.end), u };
  }
  if (isBeamEntity(e)) {
    const f = beamAxisSceneFrame(e);
    if (!f || !isSkewed({ x: f.ux, y: f.uy })) return null;
    return {
      start: { x: f.ax, y: f.ay },
      end: { x: f.ax + f.ux * f.lenScene, y: f.ay + f.uy * f.lenScene },
      u: { x: f.ux, y: f.uy },
    };
  }
  return null;
}

/**
 * Plan one aligned dimension per skewed wall/beam, offset perpendicular to its
 * axis by `offsetFromModel`. Returns `[]` when no skewed member exists.
 */
export function planAlignedChains(
  elements: readonly Entity[],
  options: AutoDimensionOptions,
): PlannedSegment[] {
  const out: PlannedSegment[] = [];
  for (const e of elements) {
    const axis = memberAxisOf(e);
    if (!axis) continue;
    const perp = perpUnit(axis.u);
    const off = options.offsetFromModel;
    const mid: Point2D = {
      x: (axis.start.x + axis.end.x) / 2,
      y: (axis.start.y + axis.end.y) / 2,
    };
    const dimLineRef: Point2D = { x: mid.x + perp.x * off, y: mid.y + perp.y * off };
    out.push({
      // `axis` only satisfies the type — no sources means the factory never
      // reads it (aligned dims are non-associative in this slice).
      axis: Math.abs(axis.u.x) >= Math.abs(axis.u.y) ? 'x' : 'y',
      dimensionType: 'aligned',
      defPoints: [axis.start, axis.end, dimLineRef],
      rotation: 0, // unused by AlignedDimensionEntity (dim line parallel to defPoints).
    });
  }
  return out;
}
