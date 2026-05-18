/**
 * Wall geometry computation (ADR-363 Phase 1).
 *
 * Pure SSoT function: derives `WallGeometry` cache από `WallParams`. Re-derive
 * on corruption (Phase 8 stair pattern). Idempotent + side-effect free.
 *
 * Port από `C:/genarc/src/engines/bom/wallGeometry.ts` με:
 *   - μονάδες mm (internal) → m (length/area/volume output, BOQ-ready)
 *   - απλοποίηση: Phase 1 υποστηρίζει μόνο `straight` kind. Curved/polyline
 *     land Phase 1.5 — οι signature θέσεις διατηρούνται για μέλλον.
 *   - 3D-readiness: `Point3D` με optional z (G11). Phase 1 z παραμένει 0.
 *   - openings subtraction → Phase 2 (όταν existe opening entity).
 *
 * Σύμβαση μονάδων: όλα τα input/output γεωμετρικά σημεία σε mm. Μόνο τα
 * αριθμητικά scalars (`length`, `area`, `volume`) εκφράζονται σε m / m² / m³
 * για άμεση κατανάλωση από το BOQ pipeline (ADR-175).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.3
 */

import type { Point3D, Polyline3D, BoundingBox3D } from '../types/bim-base';
import type { WallParams, WallGeometry, WallKind } from '../types/wall-types';

const MM_TO_M = 1 / 1000;
/** Minimum axis length (mm) below which geometry degenerates. */
const DEGENERATE_LENGTH_EPS_MM = 0.001;

/**
 * Compute `WallGeometry` from `WallParams`. SSoT for all wall-derived geometry.
 *
 * Algorithm (straight kind):
 *   1. axisPolyline = [start, end] (centerline)
 *   2. unit perpendicular = rotate axis 90° CCW (or CW when `flip`)
 *   3. half-thickness offset along perpendicular → outerEdge / innerEdge
 *   4. bbox folds all 4 corner vertices + start.z/end.z
 *   5. length = ‖end − start‖ in mm → m
 *   6. area = length × height (m × m → m²; height converted from mm)
 *   7. volume = area × thickness (m² × m → m³)
 *
 * `params.kind` is honoured for polyline (when `polylineVertices` present);
 * curved kind falls back to straight axis until Phase 1.5 — the function is
 * `kind`-agnostic except for vertex selection.
 */
export function computeWallGeometry(
  params: WallParams,
  kind: WallKind = 'straight',
): WallGeometry {
  const vertices = pickAxisVertices(params, kind);
  const axisPolyline: Polyline3D = { points: vertices, closed: false };

  const halfThicknessMm = params.thickness / 2;
  const sign = params.flip ? -1 : 1;

  const { outerEdge, innerEdge } = offsetAxisToEdges(vertices, halfThicknessMm, sign);

  const bbox = computeBbox(vertices, outerEdge.points, innerEdge.points, params.height);

  const lengthMm = computePolylineLengthMm(vertices);
  const lengthM = lengthMm * MM_TO_M;
  const heightM = params.height * MM_TO_M;
  const thicknessM = params.thickness * MM_TO_M;

  // Phase 1: area = length × height. Openings subtraction lands Phase 2.
  const area = lengthM * heightM;
  const volume = area * thicknessM;

  return {
    axisPolyline,
    outerEdge,
    innerEdge,
    bbox,
    length: lengthM,
    area,
    volume,
  };
}

// ─── Internal helpers ────────────────────────────────────────────────────────

/**
 * Pick the axis vertices based on wall kind:
 *   - `polyline` + `polylineVertices` present → use them
 *   - else → [start, end] (covers straight + curved fallback)
 */
function pickAxisVertices(params: WallParams, kind: WallKind): readonly Point3D[] {
  if (kind === 'polyline' && params.polylineVertices && params.polylineVertices.length >= 2) {
    return params.polylineVertices;
  }
  return [params.start, params.end];
}

/**
 * Offset the axis polyline by ±halfThickness along the local perpendicular.
 * `sign` flips the offset orientation (carries `params.flip`).
 *
 * For a multi-vertex polyline each segment is offset independently and the
 * vertex point uses the average of the two adjacent segment normals (industry
 * approximation; mitred joins land Phase 1.5).
 *
 * Straight wall (2 vertices) is the common path — runs in 2 cross products.
 */
function offsetAxisToEdges(
  vertices: readonly Point3D[],
  halfThicknessMm: number,
  sign: number,
): { outerEdge: Polyline3D; innerEdge: Polyline3D } {
  const n = vertices.length;
  if (n < 2) {
    return {
      outerEdge: { points: vertices, closed: false },
      innerEdge: { points: vertices, closed: false },
    };
  }

  const outer: Point3D[] = [];
  const inner: Point3D[] = [];

  for (let i = 0; i < n; i++) {
    const nx = vertexNormalX(vertices, i);
    const ny = vertexNormalY(vertices, i);
    const v = vertices[i];
    const dx = sign * halfThicknessMm * nx;
    const dy = sign * halfThicknessMm * ny;
    outer.push({ x: v.x + dx, y: v.y + dy, z: v.z });
    inner.push({ x: v.x - dx, y: v.y - dy, z: v.z });
  }

  return {
    outerEdge: { points: outer, closed: false },
    innerEdge: { points: inner, closed: false },
  };
}

/**
 * Vertex normal X component — averages adjacent segment normals (CCW 90°
 * rotation of segment tangent). Endpoint vertices use their adjacent segment.
 */
function vertexNormalX(vertices: readonly Point3D[], i: number): number {
  const n = vertices.length;
  let acc = 0;
  let count = 0;
  if (i > 0) {
    const seg = segmentNormalX(vertices[i - 1], vertices[i]);
    if (seg !== null) {
      acc += seg;
      count += 1;
    }
  }
  if (i < n - 1) {
    const seg = segmentNormalX(vertices[i], vertices[i + 1]);
    if (seg !== null) {
      acc += seg;
      count += 1;
    }
  }
  return count > 0 ? acc / count : 0;
}

function vertexNormalY(vertices: readonly Point3D[], i: number): number {
  const n = vertices.length;
  let acc = 0;
  let count = 0;
  if (i > 0) {
    const seg = segmentNormalY(vertices[i - 1], vertices[i]);
    if (seg !== null) {
      acc += seg;
      count += 1;
    }
  }
  if (i < n - 1) {
    const seg = segmentNormalY(vertices[i], vertices[i + 1]);
    if (seg !== null) {
      acc += seg;
      count += 1;
    }
  }
  return count > 0 ? acc / count : 0;
}

function segmentNormalX(a: Point3D, b: Point3D): number | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < DEGENERATE_LENGTH_EPS_MM) return null;
  // CCW 90° rotation of (dx, dy) → (-dy, dx). Normalised.
  return -dy / len;
}

function segmentNormalY(a: Point3D, b: Point3D): number | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < DEGENERATE_LENGTH_EPS_MM) return null;
  return dx / len;
}

/**
 * Compute axis-aligned 3D bounding box. z range = [min(z over axis), height].
 * Phase 1: z always 0 → bbox z = [0, height].
 */
function computeBbox(
  axis: readonly Point3D[],
  outer: readonly Point3D[],
  inner: readonly Point3D[],
  heightMm: number,
): BoundingBox3D {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  const fold = (p: Point3D): void => {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
    const z = p.z ?? 0;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  };
  for (const p of axis) fold(p);
  for (const p of outer) fold(p);
  for (const p of inner) fold(p);
  // Extrude bbox to wall height along z.
  if (minZ === Infinity) {
    minZ = 0;
    maxZ = 0;
  }
  return {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ + heightMm },
  };
}

/** Polyline length in mm (sum of segment lengths). */
function computePolylineLengthMm(vertices: readonly Point3D[]): number {
  let len = 0;
  for (let i = 1; i < vertices.length; i++) {
    const a = vertices[i - 1];
    const b = vertices[i];
    len += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return len;
}
