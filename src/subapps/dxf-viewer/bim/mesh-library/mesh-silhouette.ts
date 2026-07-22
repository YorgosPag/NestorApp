/**
 * Mesh top-view silhouette (ADR-411, generalised from ADR-410) — automatic 2D
 * plan footprint for ANY mesh-based BIM entity (furniture, light fixture, …).
 *
 * Derives a REPRESENTATIVE 2D plan outline from a loaded 3D mesh: project every
 * triangle straight down onto the plan plane, rasterise the union into a binary
 * grid, trace the outer contour (Moore boundary), simplify (Douglas–Peucker).
 * The result is the actual top-down silhouette of the item — what Revit/ArchiCAD
 * show as the family plan symbol. `computeTopEdges` adds the interior feature
 * lines (crease/boundary edges seen from directly above).
 *
 * Pure geometry — NO WebGL render-to-texture (deterministic + testable). Runs
 * ONCE per asset when the glTF loads (cached in `bimMeshCache`).
 *
 * Coordinate frame: input is the mesh's LOCAL space (the un-placed template);
 * output points are in **plan meters relative to the placement origin**, mapping
 * three world (x, z) → plan (x = worldX, y = -worldZ) — the same convention as
 * the mesh converters. The renderer scales meters→scene-units, rotates and
 * translates onto the entity position.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-411-bim-mesh-library.md
 */

import * as THREE from 'three';

export interface SilPoint { readonly x: number; readonly y: number }

/** Grid resolution on the longer plan axis (cells). */
const GRID_LONG = 110;
/** Douglas–Peucker tolerance as a fraction of the longer plan extent. */
const SIMPLIFY_FRAC = 0.012;
/** Minimum triangles to attempt a silhouette (else fall back to the rectangle). */
const MIN_TRIS = 2;

/** A projected plan line segment (plan meters, relative to placement origin). */
export interface SilSegment { readonly x1: number; readonly y1: number; readonly x2: number; readonly y2: number }

/** Feature-edge crease threshold (deg) + min segment length (m) + hard cap. */
const EDGE_THRESHOLD_DEG = 30;
const EDGE_MIN_LEN_M = 0.006;
const EDGE_MAX_SEGMENTS = 6000;

/**
 * Compute top-view feature edges of `obj` (a loaded glTF group, un-placed):
 * project the mesh's crease/boundary edges (THREE.EdgesGeometry) straight down
 * onto the plan plane → a line drawing as seen from directly above. Plan meters,
 * relative to origin (same frame as `computeTopSilhouette`). Empty when geometry
 * is absent.
 */
export function computeTopEdges(obj: THREE.Object3D): SilSegment[] {
  obj.updateMatrixWorld(true);
  const segs: SilSegment[] = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3();
  obj.traverse((child) => {
    if (segs.length >= EDGE_MAX_SEGMENTS) return;
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    let eg: THREE.EdgesGeometry | null = null;
    try {
      eg = new THREE.EdgesGeometry(mesh.geometry as THREE.BufferGeometry, EDGE_THRESHOLD_DEG);
    } catch {
      return;
    }
    const pos = eg.getAttribute('position') as THREE.BufferAttribute | undefined;
    if (pos) {
      const m = mesh.matrixWorld;
      for (let i = 0; i + 1 < pos.count && segs.length < EDGE_MAX_SEGMENTS; i += 2) {
        a.fromBufferAttribute(pos, i).applyMatrix4(m);
        b.fromBufferAttribute(pos, i + 1).applyMatrix4(m);
        // three world (x, z) → plan (x = worldX, y = -worldZ).
        const x1 = a.x, y1 = -a.z, x2 = b.x, y2 = -b.z;
        if (Math.hypot(x2 - x1, y2 - y1) >= EDGE_MIN_LEN_M) {
          segs.push({ x1, y1, x2, y2 });
        }
      }
    }
    eg.dispose();
  });
  return segs;
}

/**
 * Compute the top-view silhouette of `obj` (a loaded glTF group, un-placed).
 * Returns a closed CCW-ish outline in plan meters (relative to origin), or an
 * empty array when geometry is too sparse to trace.
 */
export function computeTopSilhouette(obj: THREE.Object3D): SilPoint[] {
  obj.updateMatrixWorld(true);
  return silhouetteFromTriangles(collectProjectedTrisTagged(obj).map((t) => t.xz));
}

/** Rasterised plan grid of a projected triangle set (plan meters ↔ cell mapping). */
interface RasterGrid {
  readonly grid: Uint8Array;
  readonly cols: number;
  readonly rows: number;
  readonly ox: number;
  readonly oy: number;
  readonly cell: number;
  readonly span: number;
}

/**
 * Rasterise a projected-triangle set (`[ax,az, bx,bz, cx,cz]` each, plan space)
 * into a binary occupancy grid sized to its aspect ratio. `null` when the set is
 * too sparse / degenerate to trace. The ONE grid builder shared by the single
 * silhouette and the per-component tracer.
 */
function buildRasterGrid(tris: readonly Float32Array[]): RasterGrid | null {
  if (tris.length < MIN_TRIS) return null;

  // Plan-space bbox of the projection (u = worldX, v = worldZ).
  let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
  for (const t of tris) {
    for (let k = 0; k < 6; k += 2) {
      minU = Math.min(minU, t[k]); maxU = Math.max(maxU, t[k]);
      minV = Math.min(minV, t[k + 1]); maxV = Math.max(maxV, t[k + 1]);
    }
  }
  const spanU = maxU - minU, spanV = maxV - minV;
  const span = Math.max(spanU, spanV);
  if (!(span > 0)) return null;

  // Grid sized to the aspect ratio (+1 cell padding each side for clean borders).
  const cell = span / GRID_LONG;
  const cols = Math.max(3, Math.ceil(spanU / cell) + 2);
  const rows = Math.max(3, Math.ceil(spanV / cell) + 2);
  const ox = minU - cell, oy = minV - cell; // grid origin (cell col/row 0)
  const grid = new Uint8Array(cols * rows);
  for (const t of tris) rasteriseTriangle(grid, cols, rows, ox, oy, cell, t);

  return { grid, cols, rows, ox, oy, cell, span };
}

/** Grid contour cells → plan meters: u = worldX, v = worldZ → plan (x = u, y = -v). */
function cellsToPlan(cells: ReadonlyArray<[number, number]>, g: RasterGrid): SilPoint[] {
  return cells.map(([ci, ri]) => ({
    x: g.ox + (ci + 0.5) * g.cell,
    y: -(g.oy + (ri + 0.5) * g.cell),
  }));
}

/**
 * Trace ONE closed plan outline (the primary connected component) from a set of
 * already-projected triangles. The rasterise → Moore-trace → Douglas–Peucker
 * pipeline lives here as a **single** implementation, shared by the whole-object
 * silhouette above and (via {@link contoursFromTriangles}) the per-slot poché.
 * Empty when the triangles are too sparse to trace.
 */
export function silhouetteFromTriangles(tris: readonly Float32Array[]): SilPoint[] {
  const g = buildRasterGrid(tris);
  if (!g) return [];
  const contour = traceOuterContour(g.grid, g.cols, g.rows);
  if (contour.length < 4) return [];
  return simplify(cellsToPlan(contour, g), g.span * SIMPLIFY_FRAC);
}

/**
 * Trace **every** connected component of a projected-triangle set (ADR-683 Φ5).
 * A single material slot can project to disjoint regions (the two leather arm
 * pads of a chair are one `leather` slot but two blobs); a single outer contour
 * would colour only one. This returns one simplified ring per component so the
 * per-slot poché paints them all. Empty when nothing traces.
 */
export function contoursFromTriangles(tris: readonly Float32Array[]): SilPoint[][] {
  const g = buildRasterGrid(tris);
  if (!g) return [];
  const out: SilPoint[][] = [];
  for (const comp of traceComponentContours(g.grid, g.cols, g.rows)) {
    if (comp.length < 4) continue;
    const ring = simplify(cellsToPlan(comp, g), g.span * SIMPLIFY_FRAC);
    if (ring.length >= 3) out.push(ring);
  }
  return out;
}

// ─── Triangle collection (world → plan projection, slot-tagged) ──────────────

/** A projected triangle tagged with its material slot + height (ADR-683 Φ5). */
export interface ProjectedTri {
  /** `[ax,az, bx,bz, cx,cz]` — plan projection (worldX, worldZ) of the triangle. */
  readonly xz: Float32Array;
  /** Mean world Y (height) of the triangle — painters ordering for per-slot poché. */
  readonly y: number;
  /** Material-slot name (`mesh.material[materialIndex].name`); `null` if unnamed/single. */
  readonly slot: string | null;
}

// Module scratch vectors — reused per triangle (single-threaded, no allocation churn).
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();

/** Name of a material slot, or `null` when unnamed/absent. */
function materialSlotName(mat: THREE.Material | undefined): string | null {
  const name = mat?.name;
  return typeof name === 'string' && name.length > 0 ? name : null;
}

/** Project one triangle (by index) of a mesh straight down; reuses module scratch vectors. */
function projectTriangle(
  pos: THREE.BufferAttribute,
  idx: THREE.BufferAttribute | null,
  m: THREE.Matrix4,
  triIndex: number,
): { xz: Float32Array; y: number } {
  const i0 = idx ? idx.getX(triIndex * 3) : triIndex * 3;
  const i1 = idx ? idx.getX(triIndex * 3 + 1) : triIndex * 3 + 1;
  const i2 = idx ? idx.getX(triIndex * 3 + 2) : triIndex * 3 + 2;
  _a.fromBufferAttribute(pos, i0).applyMatrix4(m);
  _b.fromBufferAttribute(pos, i1).applyMatrix4(m);
  _c.fromBufferAttribute(pos, i2).applyMatrix4(m);
  return { xz: Float32Array.from([_a.x, _a.z, _b.x, _b.z, _c.x, _c.z]), y: (_a.y + _b.y + _c.y) / 3 };
}

/**
 * Every projected triangle of `obj`, tagged with its material slot + height. A
 * multi-material mesh (material **array** + `geometry.groups`) is split per group
 * → one slot per material index. A single-material mesh stays ONE slot even when
 * its geometry carries auto-groups (e.g. `BoxGeometry` = 6 groups) — else it would
 * falsely fragment. Feeds both `computeTopSilhouette` (all `.xz`) and the per-slot
 * silhouettes (ADR-683 Φ5).
 */
export function collectProjectedTrisTagged(obj: THREE.Object3D): ProjectedTri[] {
  const out: ProjectedTri[] = [];
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const geo = mesh.geometry as THREE.BufferGeometry;
    const pos = geo.getAttribute('position') as THREE.BufferAttribute | undefined;
    if (!pos) return;
    const idx = geo.getIndex();
    const m = mesh.matrixWorld;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const groups = Array.isArray(mesh.material) && geo.groups.length > 0 ? geo.groups : null;
    if (groups) {
      for (const g of groups) {
        const slot = materialSlotName(materials[g.materialIndex ?? 0]);
        const end = Math.floor((g.start + g.count) / 3);
        for (let ti = Math.floor(g.start / 3); ti < end; ti++) {
          out.push({ ...projectTriangle(pos, idx, m, ti), slot });
        }
      }
    } else {
      const slot = materialSlotName(materials[0]);
      const triCount = idx ? idx.count / 3 : pos.count / 3;
      for (let ti = 0; ti < triCount; ti++) out.push({ ...projectTriangle(pos, idx, m, ti), slot });
    }
  });
  return out;
}

// ─── Rasterisation (scanline-free barycentric fill on cell centres) ──────────

function rasteriseTriangle(
  grid: Uint8Array, cols: number, rows: number,
  ox: number, oy: number, cell: number, t: Float32Array,
): void {
  const ax = t[0], ay = t[1], bx = t[2], by = t[3], cx = t[4], cy = t[5];
  const minC = Math.max(0, Math.floor((Math.min(ax, bx, cx) - ox) / cell));
  const maxC = Math.min(cols - 1, Math.ceil((Math.max(ax, bx, cx) - ox) / cell));
  const minR = Math.max(0, Math.floor((Math.min(ay, by, cy) - oy) / cell));
  const maxR = Math.min(rows - 1, Math.ceil((Math.max(ay, by, cy) - oy) / cell));
  const d = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
  if (d === 0) return;
  for (let r = minR; r <= maxR; r++) {
    const py = oy + (r + 0.5) * cell;
    for (let cI = minC; cI <= maxC; cI++) {
      const px = ox + (cI + 0.5) * cell;
      const w0 = ((bx - px) * (cy - py) - (cx - px) * (by - py)) / d;
      const w1 = ((cx - px) * (ay - py) - (ax - px) * (cy - py)) / d;
      const w2 = 1 - w0 - w1;
      if (w0 >= -1e-6 && w1 >= -1e-6 && w2 >= -1e-6) grid[r * cols + cI] = 1;
    }
  }
}

// ─── Moore-neighbour outer contour trace ─────────────────────────────────────

/** 8 neighbours in clockwise order (E, SE, S, SW, W, NW, N, NE). */
const N8: ReadonlyArray<readonly [number, number]> = [
  [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1],
];

/**
 * Moore-neighbour boundary tracing with explicit backtrack-cell bookkeeping.
 * Returns the ordered outer contour cells of the filled region (one loop).
 */
function traceOuterContour(grid: Uint8Array, cols: number, rows: number): Array<[number, number]> {
  const at = (c: number, r: number): boolean =>
    c >= 0 && c < cols && r >= 0 && r < rows && grid[r * cols + c] === 1;

  // Start: first filled cell in row-major scan (lowest row, then lowest col).
  let sc = -1, sr = -1;
  for (let r = 0; r < rows && sr < 0; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r * cols + c] === 1) { sc = c; sr = r; break; }
    }
  }
  if (sc < 0) return [];

  const contour: Array<[number, number]> = [];
  let cc = sc, cr = sr;
  // Backtrack = the (empty) cell examined just before the start — its west
  // neighbour (out-of-grid counts as empty).
  let bc = sc - 1, br = sr;
  const maxSteps = cols * rows * 8;
  let steps = 0;

  do {
    contour.push([cc, cr]);
    // Clockwise sweep starting just after the backtrack direction.
    let bIdx = N8.findIndex((d) => d[0] === bc - cc && d[1] === br - cr);
    if (bIdx < 0) bIdx = 4;
    let found = false;
    for (let k = 1; k <= 8; k++) {
      const dir = (bIdx + k) % 8;
      const nc = cc + N8[dir][0];
      const nr = cr + N8[dir][1];
      if (at(nc, nr)) {
        // New backtrack = the last (empty) cell checked before this hit.
        const pdir = (dir + 7) % 8;
        bc = cc + N8[pdir][0]; br = cr + N8[pdir][1];
        cc = nc; cr = nr;
        found = true;
        break;
      }
    }
    if (!found) break; // isolated pixel
    if (++steps > maxSteps) break;
  } while (!(cc === sc && cr === sr));

  return dedupeConsecutive(contour);
}

/**
 * Trace the outer contour of EVERY connected component (8-connectivity) of the
 * grid (ADR-683 Φ5). Each component is flood-filled into its own mask first, so
 * {@link traceOuterContour} (which follows a single region from its first filled
 * cell) traces exactly that component — disjoint same-slot blobs each get a ring.
 */
function traceComponentContours(
  grid: Uint8Array, cols: number, rows: number,
): Array<Array<[number, number]>> {
  const visited = new Uint8Array(cols * rows);
  const contours: Array<Array<[number, number]>> = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r * cols + c] !== 1 || visited[r * cols + c]) continue;
      const mask = floodComponent(grid, cols, rows, c, r, visited);
      const contour = traceOuterContour(mask, cols, rows);
      if (contour.length >= 4) contours.push(contour);
    }
  }
  return contours;
}

/** Flood-fill (8-conn) the filled component at (sc,sr) into a fresh mask; marks `visited`. */
function floodComponent(
  grid: Uint8Array, cols: number, rows: number, sc: number, sr: number, visited: Uint8Array,
): Uint8Array {
  const mask = new Uint8Array(cols * rows);
  const stack: Array<[number, number]> = [[sc, sr]];
  while (stack.length) {
    const [c, r] = stack.pop()!;
    if (c < 0 || c >= cols || r < 0 || r >= rows) continue;
    const i = r * cols + c;
    if (grid[i] !== 1 || visited[i]) continue;
    visited[i] = 1; mask[i] = 1;
    for (const [dc, dr] of N8) stack.push([c + dc, r + dr]);
  }
  return mask;
}

function dedupeConsecutive(pts: Array<[number, number]>): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
  }
  return out;
}

// ─── Douglas–Peucker polyline simplification (closed ring) ───────────────────

function simplify(ring: SilPoint[], eps: number): SilPoint[] {
  if (ring.length <= 4 || eps <= 0) return ring;
  const keep = new Array<boolean>(ring.length).fill(false);
  keep[0] = true; keep[ring.length - 1] = true;
  const stack: Array<[number, number]> = [[0, ring.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop()!;
    let maxD = -1, idx = -1;
    for (let i = s + 1; i < e; i++) {
      const d = perpDist(ring[i], ring[s], ring[e]);
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > eps && idx > 0) {
      keep[idx] = true;
      stack.push([s, idx], [idx, e]);
    }
  }
  const out = ring.filter((_, i) => keep[i]);
  return out.length >= 3 ? out : ring;
}

function perpDist(p: SilPoint, a: SilPoint, b: SilPoint): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  return Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / len;
}
