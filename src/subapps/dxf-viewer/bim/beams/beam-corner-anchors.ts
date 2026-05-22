/**
 * ADR-370 §5.2 — Beam face-corner world-point exposure (pure SSoT).
 *
 * Exposes the **4 face-end corners** of a BIM beam entity as world-coordinate
 * snap targets. For all beam kinds (straight / curved / cantilever) only the
 * START and END face corners are exposed:
 *
 *   startPlus  = start of axis + perpendicular offset +width/2
 *   startMinus = start of axis − perpendicular offset (i.e. +width/2 other side)
 *   endPlus    = end of axis + perpendicular offset
 *   endMinus   = end of axis − perpendicular offset
 *
 * For a straight beam these are the 4 vertices of the plan-view rectangle.
 * For a curved beam the Bezier subdivision produces an N-vertex outline but
 * only the 4 face-end corners (vertices [0], [n-1], [n], [2n-1] in the CCW
 * outline polygon) are exposed as snap targets — NOT all 2N intermediate
 * vertices — to avoid snap noise on long curved beams (ADR-370 §2.3).
 *
 * Implementation strategy: rely on `computeBeamGeometry().outline.vertices`
 * which already contains the CCW polygon. For axis length n, the face-end
 * corners are at indices 0, n−1, n, 2n−1. This is an O(1) slice, not a
 * re-computation of the perpendicular offset.
 *
 * Pure module: zero React / DOM / Firestore / canvas deps. Idempotent.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-370-bim-corner-snap-system.md §5.2
 * @see bim/geometry/beam-geometry.ts (computeBeamGeometry — SSoT geometry source)
 * @see bim/columns/column-anchors.ts  (pattern reference)
 */

import type { Point2D } from '../../rendering/types/Types';
import type { BeamEntity } from '../types/beam-types';
import { CURVED_BEAM_SUBDIVISIONS } from '../types/beam-types';
import { computeBeamGeometry } from '../geometry/beam-geometry';

// ─── Tagged result ─────────────────────────────────────────────────────────────

/** Which end of the beam axis the corner sits on. */
export type BeamAxisEnd = 'start' | 'end';

/**
 * Which side of the beam axis the corner sits on.
 * 'plus' = the +width/2 perpendicular offset side.
 * 'minus' = the −width/2 side.
 */
export type BeamFaceSide = 'plus' | 'minus';

/**
 * Tagged beam face-corner world point.
 * `end` + `side` together uniquely identify which of the 4 corners this is.
 * Enables downstream debug tooltips ("snapped to beam start-plus corner").
 */
export interface BeamCornerWorldPoint {
  readonly end: BeamAxisEnd;
  readonly side: BeamFaceSide;
  readonly point: Point2D;
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Compute the 4 face-end corner world points for a beam entity.
 *
 * The CCW outline polygon from `computeBeamGeometry` has layout:
 *   [plus[0], …, plus[n-1], minus[n-1], …, minus[0]]
 * where n = number of axis vertices.
 *
 * Face-end corners (always 4, regardless of beam kind):
 *   [0]   startPlus  = outline.vertices[0]
 *   [1]   endPlus    = outline.vertices[n-1]
 *   [2]   endMinus   = outline.vertices[n]
 *   [3]   startMinus = outline.vertices[2n-1]
 *
 * Degenerate beams (axis length < ε) → 4 coincident points;
 * de-duplicated by the spatial index.
 */
export function getBeamCornerWorldPoints(
  beam: Readonly<BeamEntity>,
): readonly BeamCornerWorldPoint[] {
  const geo = computeBeamGeometry(beam.params);
  const verts = geo.outline.vertices;

  const n = axisVertexCount(beam);
  if (verts.length < 4 || n < 2) return [];

  return [
    { end: 'start', side: 'plus',  point: to2D(verts[0]) },
    { end: 'end',   side: 'plus',  point: to2D(verts[n - 1]) },
    { end: 'end',   side: 'minus', point: to2D(verts[n]) },
    { end: 'start', side: 'minus', point: to2D(verts[2 * n - 1]) },
  ];
}

// ─── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Number of axis vertices used by `buildOutlineRect`.
 *   - curved + curveControl → CURVED_BEAM_SUBDIVISIONS + 1 = 17
 *   - straight / cantilever → 2
 */
function axisVertexCount(beam: Readonly<BeamEntity>): number {
  if (beam.params.kind === 'curved' && beam.params.curveControl) {
    return CURVED_BEAM_SUBDIVISIONS + 1;
  }
  return 2;
}

function to2D(p: { readonly x: number; readonly y: number }): Point2D {
  return { x: p.x, y: p.y };
}
