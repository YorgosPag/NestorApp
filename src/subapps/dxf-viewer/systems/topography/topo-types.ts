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
  /**
   * ADR-656 M10 — the surveyor's point number/name, VERBATIM (e.g. `101`, `S12`, `ΣΤ3`).
   * Kept as a string for zero-loss (Civil 3D «Point Number» is integer, «Point Name» is
   * alphanumeric — the raw column carries either). Populated only from the wizard/CSV road
   * where a `pointId` column genuinely exists; DXF POINT/TEXT carry no such group code, so
   * that road leaves it undefined rather than inventing one.
   */
  readonly pointNumber?: string;
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
  /**
   * ADR-650 M2-Β: the scene entity this breakline was picked from (`'topo-breakline'` tool).
   * Absent for breaklines that did not come from a drawing entity (e.g. a future file import).
   */
  readonly sourceEntityId?: string;
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

/**
 * How the derived surface is SHADED in 3D (ADR-650 M4/M6) — the Civil 3D «Surface Style» axis:
 *   - `shaded`      — one flat earth material (Revit Toposolid / ArchiCAD Mesh default).
 *   - `hypsometric` — per-vertex colour by elevation (Civil 3D «Elevation Banding» analysis).
 *   - `cutfill`     — per-vertex colour by Δz against the volume reference (Civil 3D «Cut/Fill
 *                     analysis»): red where earth is removed, blue where it is added, pale on
 *                     the zero line. M6 — needs a reference, so it reads `cut-fill-store`.
 * The TRIANGULATION is identical in all three — only the appearance changes.
 */
export type TerrainSurfaceStyle = 'shaded' | 'hypsometric' | 'cutfill';

// ─── ADR-650 M6 — volumes (cut / fill) ────────────────────────────────────────

/**
 * WHICH surface a definition/TIN belongs to (Civil 3D keeps a named Surface collection):
 *   - `existing` — the surveyed ground («υπάρχον»), the one M1–M4 already build.
 *   - `proposed` — the designed ground («μελετημένο»), imported the same way, used as the
 *     volume reference in surface-vs-surface mode.
 * Each id owns its own DEFINITION and therefore its own derived TIN — never a second
 * triangulation of the SAME definition (that invariant is what `topo-surface.ts` guards).
 */
export type TopoSurfaceId = 'existing' | 'proposed';

/** The raw definition of one surface: what the user supplied, never what we derived. */
export interface TopoDefinition {
  readonly points: readonly TopoPoint[];
  readonly breaklines: readonly Breakline[];
}

/**
 * The site boundary (Civil 3D «volume boundary»): earthworks are counted ONLY inside it.
 * Vertices are WORLD canonical mm, implicitly closed (last → first). Picked from a closed
 * polyline already drawn on the plan, so the οικόπεδο stays a single source of truth.
 */
export interface TopoBoundary {
  readonly vertices: readonly Point2D[];
  /** The scene entity the boundary was picked from (toggle off on a second click). */
  readonly sourceEntityId?: string;
}

/** Against WHAT the ground is compared — the two roads the big players offer. */
export type CutFillReferenceMode = 'datum' | 'surface';

/**
 * The earthworks answer. Volumes are canonical mm³ (ADR-462) — the m³ the user reads is a
 * PRESENTATION conversion done once at the UI edge, never baked in here.
 *
 * `cut` = ground ABOVE the reference (excavate). `fill` = ground BELOW it (import earth).
 * `net > 0` → surplus soil to haul away· `net < 0` → soil must be brought in.
 */
export interface CutFillResult {
  readonly cutVolumeMm3: number;
  readonly fillVolumeMm3: number;
  /** cut − fill. The number the contractor actually prices (haul-away vs import). */
  readonly netVolumeMm3: number;
  /** PLAN areas (footprint), not slope areas — the convention Civil 3D reports. */
  readonly cutAreaMm2: number;
  readonly fillAreaMm2: number;
  readonly evaluatedTriangles: number;
  /** Triangles the reference could not answer for (outside the proposed surface) or degenerate. */
  readonly skippedTriangles: number;
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
