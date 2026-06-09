/**
 * ADR-429 — MEP Routing Brain: shared constants + obstacle rectangle type (SSoT).
 *
 * The wall-aware A* router (Slice 3) tunes itself from these single-source constants. All
 * lengths are **scene-unit scalars** (the router is unit-agnostic — it works in whatever
 * coordinate space its inputs use; Nestor's scene convention is mm, so the values double as
 * mm). Every consumer may override them per-call via the router `opts`, but the defaults are
 * the Revit-grade baseline.
 *
 * @see ./route-wall-aware.ts (the entry point that swaps Manhattan → A* when walls exist)
 * @see ./astar-grid.ts (the pathfinder) · ./wall-obstacles.ts (wall → Rect2D extraction)
 */

/**
 * Axis-aligned obstacle rectangle in routing (scene-unit) space. Field names mirror
 * `core/spatial` `SpatialBounds` so an obstacle can be fed to the shared spatial index
 * verbatim if a future slice needs broad-phase queries — but this module stays pure (no
 * spatial-index dependency) for testability.
 */
export interface Rect2D {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/**
 * A* grid cell size (scene units). 150 trades accuracy for speed: fine enough to slip a
 * pipe through a doorway, coarse enough to keep the grid small. Revit MEP routes on a
 * comparable orthogonal grid.
 */
export const ASTAR_CELL_SCENE = 150;

/**
 * Extra clearance (scene units) added to each wall's bounding box on every side. The bbox is
 * already thickness-aware, so this is pure stand-off so the pipe centreline never grazes the
 * wall face.
 */
export const WALL_CLEARANCE_SCENE = 75;

/**
 * Margin (scene units) added around a single run's [start,end] bounding box when building its
 * local A* grid — gives the detour room to bulge sideways past a wall end.
 */
export const ASTAR_LOCAL_MARGIN_SCENE = 1500;

/**
 * Performance guard: if a run's local grid would exceed this many cells, skip A* and keep the
 * run straight (Manhattan fallback). Bounds worst-case cost on pathological geometry.
 */
export const ASTAR_MAX_CELLS = 40_000;

/**
 * Performance guard: max nodes expanded before A* aborts to the straight fallback. A
 * belt-and-suspenders cap independent of the grid-size guard.
 */
export const ASTAR_MAX_ITERATIONS = 20_000;

/**
 * Slice 3B pairing: extra clearance (scene units) between the supply and return runs, added
 * on top of the DN-aware half-sum so the two parallel pipes never touch.
 */
export const PAIRING_CLEARANCE_SCENE = 30;
