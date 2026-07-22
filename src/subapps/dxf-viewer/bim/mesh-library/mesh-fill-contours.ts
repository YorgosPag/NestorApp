/**
 * mesh-fill-contours — ADR-683 §10.9 (revised): the **cheap, cached** top-view fill.
 *
 * Big-player practice (Revit/ArchiCAD/C4D) for a 2D plan symbol of a 3D mesh: project +
 * trace the outline at high resolution, punch the real holes, simplify to a clean curve —
 * ONCE at load — then fill that few-point curve cheaply on every zoom. NOT the raw
 * projected-triangle shadow (HSeatFrm alone = 42.240 triangles → ~126k `worldToScreen`
 * calls **per `DxfBitmapCache.rebuild`** → zoom jank).
 *
 * This is the SAME rasterise → Moore-trace → Douglas–Peucker pipeline the silhouette /
 * per-slot poché already use (SSoT `mesh-silhouette`) — reused here at a higher fill
 * resolution and extended with **hole detection** (interior gaps enclosed by fill). The
 * result is a flat list of rings — outer components + holes — that the renderer fills with
 * the shared even-odd painter (`fillRingsEvenOdd`, ADR-684): every disjoint region filled,
 * every real hole punched, no raster resolution loss visible, no 42k-triangle draw.
 *
 * Output frame == `mesh-silhouette`: plan meters relative to the placement origin.
 *
 * @see ./mesh-silhouette — the shared raster/trace/simplify primitives (SSoT core)
 * @see ../renderers/bim-polygon-render — fillRingsEvenOdd (shared even-odd hole fill)
 * @see docs/centralized-systems/reference/adrs/ADR-683-bim-collaboration-roundtrip.md §10.9
 */

import type * as THREE from 'three';
import {
  buildRasterGrid,
  traceComponentContours,
  traceOuterContour,
  cellsToPlan,
  simplify,
  collectProjectedTrisTagged,
  type RasterGrid,
  type SilPoint,
} from './mesh-silhouette';

/**
 * Long-axis raster resolution for the fill contours — HIGHER than the silhouette's default so
 * thin plan features (e.g. spindle radii) survive AND a symmetric mesh quantises near-identically
 * on both mirror halves (coarse cells were breaking the chair's symmetry). The raster runs ONCE at
 * load, so the extra cells cost nothing per-zoom.
 */
const FILL_GRID_LONG = 320;
/**
 * Douglas–Peucker tolerance (fraction of the footprint span) for the fill contours — TIGHTER than
 * the silhouette default (`SIMPLIFY_FRAC`=0.012). DP is greedy and NOT mirror-symmetric: a large
 * tolerance simplifies the two halves of a symmetric shape differently → visible asymmetry. A tight
 * tolerance keeps the outline faithful (still hundreds of points, not 42k triangles → cheap zoom).
 */
const FILL_SIMPLIFY_FRAC = 0.0025;
/** Drop outer components smaller than this fraction of the footprint bbox — mesh-weave specks. */
const MIN_COMPONENT_AREA_FRAC = 0.0008;
/** Drop holes smaller than this fraction of the footprint bbox — weave noise, not real gaps. */
const MIN_HOLE_AREA_FRAC = 0.004;

/** Unsigned shoelace area (plan m²) of a closed ring. */
export function ringArea(ring: readonly SilPoint[]): number {
  let s = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s) / 2;
}

/**
 * Mark the EXTERIOR background: 4-connected flood from every border background cell.
 * 4-connectivity is the topological dual of the 8-connected fill, so a diagonal fill touch
 * closes a hole rather than letting the flood leak through the corner.
 */
function floodExteriorBackground(grid: Uint8Array, cols: number, rows: number): Uint8Array {
  const exterior = new Uint8Array(cols * rows);
  const stack: number[] = [];
  const pushIfBg = (c: number, r: number): void => {
    const i = r * cols + c;
    if (grid[i] === 0 && !exterior[i]) { exterior[i] = 1; stack.push(i); }
  };
  for (let c = 0; c < cols; c++) { pushIfBg(c, 0); pushIfBg(c, rows - 1); }
  for (let r = 0; r < rows; r++) { pushIfBg(0, r); pushIfBg(cols - 1, r); }
  while (stack.length) {
    const i = stack.pop()!;
    const c = i % cols;
    const r = (i - c) / cols;
    if (c > 0) pushIfBg(c - 1, r);
    if (c < cols - 1) pushIfBg(c + 1, r);
    if (r > 0) pushIfBg(c, r - 1);
    if (r < rows - 1) pushIfBg(c, r + 1);
  }
  return exterior;
}

/**
 * Trace the contour of every INTERIOR hole (a background region enclosed by fill): whatever
 * background the exterior flood cannot reach is an enclosed hole. Each hole's own outline is
 * traced via the shared {@link traceOuterContour} on a mask of just that hole's cells.
 */
function traceHoleContours(g: RasterGrid): Array<Array<[number, number]>> {
  const { grid, cols, rows } = g;
  const exterior = floodExteriorBackground(grid, cols, rows);
  const visited = new Uint8Array(cols * rows);
  const holes: Array<Array<[number, number]>> = [];
  for (let start = 0; start < grid.length; start++) {
    if (grid[start] !== 0 || exterior[start] || visited[start]) continue;
    const mask = new Uint8Array(cols * rows);
    const s: number[] = [start];
    while (s.length) {
      const j = s.pop()!;
      if (visited[j] || grid[j] !== 0 || exterior[j]) continue;
      visited[j] = 1;
      mask[j] = 1;
      const c = j % cols;
      const r = (j - c) / cols;
      if (c > 0) s.push(j - 1);
      if (c < cols - 1) s.push(j + 1);
      if (r > 0) s.push(j - cols);
      if (r < rows - 1) s.push(j + cols);
    }
    const contour = traceOuterContour(mask, cols, rows);
    if (contour.length >= 4) holes.push(contour);
  }
  return holes;
}

/**
 * The cached top-view fill footprint of a projected-triangle set: a FLAT list of simplified
 * rings — outer components first, then interior holes — ready for one even-odd fill. Weave
 * noise (sub-visible specks + tiny holes) is filtered so the plan reads as a clean symbol,
 * not the mesh weave. Empty when the triangles are too sparse to trace.
 */
export function contoursWithHolesFromTriangles(tris: readonly Float32Array[]): SilPoint[][] {
  const g = buildRasterGrid(tris, FILL_GRID_LONG);
  if (!g) return [];
  const eps = g.span * FILL_SIMPLIFY_FRAC;
  const bboxArea = g.span * g.span; // conservative normaliser (square bounding the footprint)
  const out: SilPoint[][] = [];
  for (const comp of traceComponentContours(g.grid, g.cols, g.rows)) {
    if (comp.length < 4) continue;
    const ring = simplify(cellsToPlan(comp, g), eps);
    if (ring.length >= 3 && ringArea(ring) >= bboxArea * MIN_COMPONENT_AREA_FRAC) out.push(ring);
  }
  for (const hole of traceHoleContours(g)) {
    const ring = simplify(cellsToPlan(hole, g), eps);
    if (ring.length >= 3 && ringArea(ring) >= bboxArea * MIN_HOLE_AREA_FRAC) out.push(ring);
  }
  return out;
}

/**
 * Compute the cached fill contours (outer components + holes) of a loaded glTF group
 * (un-placed template) — the load-time entry the mesh cache stores. Plan meters relative to
 * the placement origin (same frame as `computeTopSilhouette`).
 */
export function computeTopFillContours(obj: THREE.Object3D): SilPoint[][] {
  obj.updateMatrixWorld(true);
  return contoursWithHolesFromTriangles(collectProjectedTrisTagged(obj).map((t) => t.xz));
}

/**
 * Convert the EXACT union rings (flat plan-meter `[x0,y0,x1,y1,…]` from `mesh-fill-union.worker`) →
 * {@link SilPoint} contours, dropping sub-visible specks (mesh-weave noise the exact union still
 * reproduces faithfully). Outer boundaries + holes stay as a flat list → one even-odd fill. Shares
 * the {@link ringArea} + area-fraction threshold with the raster path (one cleaning rule).
 */
export function flatRingsToFilteredContours(rings: readonly (readonly number[])[]): SilPoint[][] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const parsed: SilPoint[][] = rings.map((flat) => {
    const pts: SilPoint[] = [];
    for (let i = 0; i + 1 < flat.length; i += 2) {
      const x = flat[i], y = flat[i + 1];
      pts.push({ x, y });
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    return pts;
  });
  const span = Math.max(maxX - minX, maxY - minY);
  if (!(span > 0)) return [];
  const minArea = span * span * MIN_COMPONENT_AREA_FRAC;
  return parsed.filter((pts) => pts.length >= 3 && ringArea(pts) >= minArea);
}
