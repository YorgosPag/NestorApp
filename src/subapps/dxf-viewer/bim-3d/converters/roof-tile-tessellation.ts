/**
 * roof-tile-tessellation — ADR-417 #6.
 *
 * Φτιάχνει DENSE GRID geometry για το top cap ενός roof face, ώστε το Three.js
 * displacement map να έχει αρκετά vertices να σπρώξει και το barrel-tile κύμα να
 * είναι ορατό στη σιλουέτα (Revit «Realistic» style relief).
 *
 * Χρησιμοποιείται ΜΟΝΟ όταν `realisticMaterials=true` + `tileReliefMm > 0` +
 * `LoadedTextureSet.displacementMap` φορτωμένο. Fallback: `buildDepthPrism` (ανέπαφο).
 *
 * ## Αλγόριθμος
 * 1. **Slope plane** — linear Ax+By+C=zMm από τα πρώτα 3 outline vertices (face
 *    guaranteed planar by `computeRoofGeometry`). Δεν χρειάζεται world-space
 *    conversion — αρκεί canvas-unit/mm linear map για z interpolation.
 * 2. **Bounding box** — canvas-unit XY.
 * 3. **Adaptive step** — `max(max_side/50, 0.1m)` → ≤50×50 cells per face.
 * 4. **Point-in-polygon** — ray-casting per centroid (handles concave/hip outlines).
 * 5. **Quad emission** — 4 vertices per inside cell (no shared → `computeVertexNormals`
 *    gives exact coplanar normal; sufficient since face is planar → all normals equal).
 * 6. **Normals + UVs** — `computeVertexNormals` → `setSlopeAlignedTileUvs`.
 *
 * Pure (no side effects, no store reads). Returns null for degenerate face.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-417-bim-roof-element.md §10 #6
 * @see roof-to-three.ts — caller (relief branch)
 * @see bim-uv-helpers.ts — setSlopeAlignedTileUvs (slope-aligned UV SSoT)
 */

import * as THREE from 'three';
import type { Point3D } from '../../bim/types/bim-base';
import type { RoofFace } from '../../bim/types/roof-types';
import { setSlopeAlignedTileUvs, type SlopeTileUvOptions } from './bim-uv-helpers';
import { toWorld } from './roof-world-transform';

// ── Constants ──────────────────────────────────────────────────────────────────

/** Maximum grid cells along each axis — caps vertex count at ~50×50×4 = 10K vertices per face. */
const MAX_CELLS_PER_AXIS = 50;

/** Minimum grid cell size in METRES (10 cm). Keeps geometry light on tiny faces. */
const MIN_STEP_M = 0.10;

// ── Slope plane ────────────────────────────────────────────────────────────────

/**
 * Linear plane `zMm(x,y) = A*x + B*y + C` in canvas-unit xy + mm z.
 * Valid flag is false when the first 3 outline vertices are collinear (degenerate face).
 */
interface SlopePlane {
  readonly A: number;
  readonly B: number;
  readonly C: number;
  readonly valid: boolean;
}

/**
 * Fit a slope plane from the first 3 outline vertices. The face is guaranteed
 * planar by `computeRoofGeometry`, so this plane is exact for all outline points.
 * No unit-conversion needed: we only use it to interpolate z (mm) at new (x,y)
 * positions expressed in the SAME canvas-unit space as outline.
 */
export function buildSlopePlane(outline: readonly Point3D[]): SlopePlane {
  if (outline.length < 3) return { A: 0, B: 0, C: 0, valid: false };
  const v0 = outline[0], v1 = outline[1], v2 = outline[2];
  const z0 = v0.z ?? 0, z1 = v1.z ?? 0, z2 = v2.z ?? 0;
  const dx1 = v1.x - v0.x, dy1 = v1.y - v0.y, dz1 = z1 - z0;
  const dx2 = v2.x - v0.x, dy2 = v2.y - v0.y, dz2 = z2 - z0;
  const det = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(det) < 1e-12) {
    // Collinear first 3 vertices (degenerate or flat) — use constant z0.
    return { A: 0, B: 0, C: z0, valid: false };
  }
  const A = (dz1 * dy2 - dz2 * dy1) / det;
  const B = (dx1 * dz2 - dx2 * dz1) / det;
  const C = z0 - A * v0.x - B * v0.y;
  return { A, B, C, valid: true };
}

/** Evaluate zMm at canvas-unit (x, y) on the slope plane. */
export function slopeZMm(x: number, y: number, plane: SlopePlane): number {
  return plane.A * x + plane.B * y + plane.C;
}

// ── Point-in-polygon ───────────────────────────────────────────────────────────

/**
 * Ray-casting point-in-polygon test. O(n) per call. Handles concave and
 * non-convex outlines (hip valleys, L-shaped, triangular).
 */
export function pointInPolygon2D(px: number, py: number, outline: readonly Point3D[]): boolean {
  let inside = false;
  const n = outline.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = outline[i].x, yi = outline[i].y;
    const xj = outline[j].x, yj = outline[j].y;
    if (((yi > py) !== (yj > py)) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

// ── Main tessellation ──────────────────────────────────────────────────────────

/**
 * Tessellate the TOP CAP of a roof face into a dense grid for displacement mapping.
 *
 * Generates a `THREE.BufferGeometry` with slope-aligned UVs and smooth normals,
 * ready to receive a displacement map. Returns `null` for degenerate faces.
 *
 * @param face           RoofFace from `computeRoofGeometry` (guaranteed planar)
 * @param topDepthMm     Vertical offset below slope surface (0 = top surface)
 * @param sceneToM       canvas-unit → metres (from `sceneUnitsToMeters(units)`)
 * @param baseElevationM Base storey elevation added to all y coordinates (metres)
 * @param tileOpts       Slope-aligned UV scale+rotation (from `resolveRoofTileUvOpts`)
 */
export function tessellateRoofTopCap(
  face: RoofFace,
  topDepthMm: number,
  sceneToM: number,
  baseElevationM: number,
  tileOpts: SlopeTileUvOptions,
): THREE.BufferGeometry | null {
  const { outline } = face;
  if (outline.length < 3) return null;

  // ── 1. Slope plane ──────────────────────────────────────────────────────────
  const plane = buildSlopePlane(outline);

  // ── 2. Bounding box (canvas units) ─────────────────────────────────────────
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const v of outline) {
    if (v.x < minX) minX = v.x;
    if (v.x > maxX) maxX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.y > maxY) maxY = v.y;
  }
  const bboxW = maxX - minX;
  const bboxH = maxY - minY;
  if (bboxW < 1e-9 || bboxH < 1e-9) return null;

  // ── 3. Adaptive step ────────────────────────────────────────────────────────
  const minStepScene = MIN_STEP_M / sceneToM;
  const stepScene = Math.max(minStepScene, Math.max(bboxW, bboxH) / MAX_CELLS_PER_AXIS);

  // ── 4. Grid traversal + PIP test ────────────────────────────────────────────
  const positions: number[] = [];
  const indexArr: number[] = [];
  let vtxCount = 0;

  const nx = Math.ceil(bboxW / stepScene);
  const ny = Math.ceil(bboxH / stepScene);

  for (let iy = 0; iy < ny; iy++) {
    const y0 = minY + iy * stepScene;
    const y1 = Math.min(y0 + stepScene, maxY);
    const cy = (y0 + y1) * 0.5;

    for (let ix = 0; ix < nx; ix++) {
      const x0 = minX + ix * stepScene;
      const x1 = Math.min(x0 + stepScene, maxX);
      const cx = (x0 + x1) * 0.5;

      if (!pointInPolygon2D(cx, cy, outline)) continue;

      // ── 5. Emit quad (4 separate vertices — coplanar face → normals identical) ──
      const base = vtxCount;
      const corners: [number, number][] = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
      for (const [vx, vy] of corners) {
        const zMm = slopeZMm(vx, vy, plane);
        const w = toWorld(vx, vy, zMm - topDepthMm, sceneToM);
        w.y += baseElevationM;
        positions.push(w.x, w.y, w.z);
      }
      // CCW winding (faces up toward camera) — matches buildDepthPrism top cap.
      indexArr.push(base, base + 1, base + 2, base, base + 2, base + 3);
      vtxCount += 4;
    }
  }

  if (vtxCount === 0) return null;

  // ── 6. Build geometry + normals + UVs ────────────────────────────────────────
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  geo.setIndex(indexArr);
  // computeVertexNormals on a planar grid → all normals equal to slope normal.
  // Consistent slope normals ensure displacement pushes vertices in the right direction.
  geo.computeVertexNormals();
  // Slope-aligned UVs: grooves run down-slope (water-flow) + physical tile sizing.
  setSlopeAlignedTileUvs(geo, tileOpts);
  return geo;
}
