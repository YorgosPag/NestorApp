/**
 * ADR-650 Milestone 1 — Topography domain types (points → TIN → contours).
 *
 * Big-player pattern (Civil 3D Surface / Revit Toposolid): the RAW survey points
 * are the single source of truth; the TIN surface and the contour lines are both
 * DERIVED, immutable products. These types encode that pipeline:
 *
 *   TopoPoint[] + Breakline[]  →  TinSurface  →  ContourLine[]  →  CAD entities
 *
 * Coordinate frames (ADR-462 canonical mm, ADR-635 culling ±1e6):
 *   - `TopoPoint` / `Breakline` / `ContourLine` carry WORLD coordinates (canonical mm,
 *     e.g. ΕΓΣΑ'87 ~1e5..1e6). These are what the store holds and what entities emit.
 *   - `TinSurface` carries LOCAL coordinates (world − origin) so the CDT / marching math
 *     runs on small floats near 0,0 for robustness. The `origin` re-projects back to world.
 *
 * There is NO logic in this file (types only — exempt from the 500-line rule).
 */

import type { Point2D } from '../../rendering/types/Types';

/** A survey point in WORLD canonical mm. `code` = optional feature/figure code (field-to-finish). */
export interface TopoPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Optional feature code (e.g. `EDGE`, `TREE`) — carried through, unused in Milestone 1. */
  readonly code?: string;
}

/**
 * A constraint polyline (breakline) in WORLD canonical mm — road edge, ridge, ditch,
 * retaining wall. Q6: breakline-aware from the start. Its vertices become constrained
 * edges in the CDT so the TIN keeps the hard break instead of smoothing across it.
 */
export interface Breakline {
  readonly id: string;
  readonly vertices: readonly TopoPoint[];
  /** When true, the first and last vertices are also joined by a constrained edge. */
  readonly closed?: boolean;
}

/** LOCAL-origin offset: subtract from world to get local; add to local to get world. */
export interface LocalOrigin {
  readonly x: number;
  readonly y: number;
}

/** Axis-aligned bounds in whatever frame the producer documents (world or local). */
export interface TopoBounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
  readonly minZ: number;
  readonly maxZ: number;
}

/**
 * Immutable triangulated irregular network (the derived "surface object").
 *
 * Parallel-array layout (cdt2d-native, cache-friendly):
 *   - `positions[i]` = `[localX, localY]` of vertex i (LOCAL frame).
 *   - `elevations[i]` = Z of vertex i (WORLD Z — elevation is not offset).
 *   - `triangles[t]` = `[i, j, k]` vertex indices (CCW, constrained edges preserved).
 */
export interface TinSurface {
  readonly positions: ReadonlyArray<readonly [number, number]>;
  readonly elevations: readonly number[];
  readonly triangles: ReadonlyArray<readonly [number, number, number]>;
  /** Re-projection back to world coordinates (LOCAL + origin = WORLD). */
  readonly origin: LocalOrigin;
  /** Local-frame planimetric + world-frame vertical bounds. */
  readonly bounds: TopoBounds;
  /**
   * Triangle indices skipped as "false flats" (all three vertices at the same Z).
   * Kept for QA/diagnostics; these produce no contour crossings (ADR-650 §5 trap).
   */
  readonly flatTriangleCount: number;
}

/** A single contour crossing segment within ONE triangle (LOCAL frame). */
export interface ContourSegment {
  readonly level: number;
  readonly a: Point2D;
  readonly b: Point2D;
}

/**
 * A finished contour line at one elevation `level`, in WORLD canonical mm.
 * `isMajor` = index contour (every N-th interval) → heavier layer + label.
 */
export interface ContourLine {
  readonly level: number;
  readonly vertices: readonly Point2D[];
  readonly isMajor: boolean;
  readonly closed: boolean;
}
