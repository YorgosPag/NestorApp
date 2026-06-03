/**
 * Furniture top-view silhouette (ADR-410) — automatic 2D plan footprint.
 *
 * Derives a REPRESENTATIVE 2D plan outline from the loaded 3D mesh, per asset:
 * project every triangle straight down onto the plan plane, rasterise the union
 * into a binary grid, trace the outer contour (Moore boundary), simplify
 * (Douglas–Peucker). The result is the actual top-down silhouette of the item
 * (chair seat/back/arms) — what Revit/ArchiCAD show as the family plan symbol.
 *
 * Pure geometry — NO WebGL render-to-texture (deterministic + testable). Runs
 * ONCE per asset when the glTF loads (cached in `FurnitureGltfCache`).
 *
 * Coordinate frame: input is the mesh's LOCAL space (the un-placed template);
 * output points are in **plan meters relative to the placement origin**, mapping
 * three world (x, z) → plan (x = worldX, y = -worldZ) — the same convention as
 * `furniture-to-three.ts`. The renderer scales meters→scene-units, rotates and
 * translates onto `params.position`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-410-cc0-mesh-furniture-import.md
 */

import * as THREE from 'three';

export interface SilPoint { readonly x: number; readonly y: number }

/** Grid resolution on the longer plan axis (cells). */
const GRID_LONG = 110;
/** Douglas–Peucker tolerance as a fraction of the longer plan extent. */
const SIMPLIFY_FRAC = 0.012;
/** Minimum triangles to attempt a silhouette (else fall back to the rectangle). */
const MIN_TRIS = 2;

/**
 * Compute the top-view silhouette of `obj` (a loaded glTF group, un-placed).
 * Returns a closed CCW-ish outline in plan meters (relative to origin), or an
 * empty array when geometry is too sparse to trace.
 */
export function computeTopSilhouette(obj: THREE.Object3D): SilPoint[] {
  obj.updateMatrixWorld(true);
  const tris = collectProjectedTriangles(obj);
  if (tris.length < MIN_TRIS) return [];

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
  if (!(span > 0)) return [];

  // Grid sized to the aspect ratio (+1 cell padding each side for clean borders).
  const cell = span / GRID_LONG;
  const cols = Math.max(3, Math.ceil(spanU / cell) + 2);
  const rows = Math.max(3, Math.ceil(spanV / cell) + 2);
  const ox = minU - cell, oy = minV - cell; // grid origin (cell col/row 0)
  const grid = new Uint8Array(cols * rows);

  for (const t of tris) {
    rasteriseTriangle(grid, cols, rows, ox, oy, cell, t);
  }

  const contourCells = traceOuterContour(grid, cols, rows);
  if (contourCells.length < 4) return [];

  // Grid cell → plan meters: u = worldX, v = worldZ → plan (x = u, y = -v).
  const ring: SilPoint[] = contourCells.map(([ci, ri]) => ({
    x: ox + (ci + 0.5) * cell,
    y: -(oy + (ri + 0.5) * cell),
  }));

  return simplify(ring, span * SIMPLIFY_FRAC);
}

// ─── Triangle collection (world → plan projection) ──────────────────────────

/** Flat array of [ax,az, bx,bz, cx,cz] per triangle, in mesh world (=local) space. */
function collectProjectedTriangles(obj: THREE.Object3D): Float32Array[] {
  const out: Float32Array[] = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const geo = mesh.geometry as THREE.BufferGeometry;
    const pos = geo.getAttribute('position') as THREE.BufferAttribute | undefined;
    if (!pos) return;
    const idx = geo.getIndex();
    const m = mesh.matrixWorld;
    const triCount = idx ? idx.count / 3 : pos.count / 3;
    for (let i = 0; i < triCount; i++) {
      const i0 = idx ? idx.getX(i * 3) : i * 3;
      const i1 = idx ? idx.getX(i * 3 + 1) : i * 3 + 1;
      const i2 = idx ? idx.getX(i * 3 + 2) : i * 3 + 2;
      a.fromBufferAttribute(pos, i0).applyMatrix4(m);
      b.fromBufferAttribute(pos, i1).applyMatrix4(m);
      c.fromBufferAttribute(pos, i2).applyMatrix4(m);
      out.push(Float32Array.from([a.x, a.z, b.x, b.z, c.x, c.z]));
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
