/**
 * Beam geometry computation (ADR-363 Phase 5).
 *
 * Pure SSoT function: derives `BeamGeometry` cache από `BeamParams`.
 * Idempotent + side-effect free. Mirror του wall-geometry pattern για το axis
 * + perpendicular offset → outline, αλλά απλοποιημένο γιατί το beam plan view
 * γίνεται render σε ένα single closed rectangle (width × length).
 *
 * Algorithm:
 *   1. axisPolyline vertices:
 *        - straight / cantilever → [startPoint, endPoint]
 *        - curved → 17-vertex quadratic Bezier subdivision
 *   2. perpendicular offset σε ±width/2 → outline (closed CCW polygon)
 *   3. length (m)   = sum-of-edges στο axis (mm → m)
 *   4. area (m²)    = length × (width / 1000)
 *   5. volume (m³)  = length × width × depth / 1e9
 *   6. bbox folds outline + axis + extrudes σε topElevation (z range [0, topElevation])
 *
 * Σύμβαση μονάδων: input/output γεωμετρικά σημεία σε mm.
 * Numeric scalars (length/area/volume) σε m / m² / m³ για άμεση BOQ feed.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.7
 */

import type { Point3D, Polyline3D, Polygon3D, BoundingBox3D } from '../types/bim-base';
import type { BeamGeometry, BeamParams } from '../types/beam-types';
import { CURVED_BEAM_SUBDIVISIONS } from '../types/beam-types';
import { mmToSceneUnits } from '../../utils/scene-units';

const MM_TO_M = 1 / 1000;
const DEGENERATE_LENGTH_EPS_MM = 0.001;

/**
 * Compute `BeamGeometry` από `BeamParams`. Pure SSoT για beam-derived
 * geometry. Caller MUST ensure width/depth > 0 (validator guard upstream).
 */
export function computeBeamGeometry(params: BeamParams): BeamGeometry {
  // s: canvas units per 1 mm. Used to convert mm scalars → canvas-unit offsets
  // for the 2D plan-view outline. Axis vertices are always in canvas units.
  const s = mmToSceneUnits(params.sceneUnits ?? 'mm');
  const axisVertices = pickAxisVertices(params);
  const axisPolyline: Polyline3D = { points: axisVertices, closed: false };

  const outlineVertices = buildOutlineRect(axisVertices, params.width, s);
  const outline: Polygon3D = { vertices: outlineVertices };

  // BOQ: axis length is in canvas units → convert to m via (1/s) * MM_TO_M.
  // width/depth are always mm → convert directly with MM_TO_M.
  const lengthCanvas = computePolylineLengthMm(axisVertices);
  const lengthM = lengthCanvas * (1 / s) * MM_TO_M;
  const widthM = params.width * MM_TO_M;
  const depthM = params.depth * MM_TO_M;
  const area = lengthM * widthM;
  const volume = area * depthM;

  const bbox = computeBbox(axisVertices, outlineVertices, params.topElevation, params.zOffset ?? 0, params.depth);

  return {
    axisPolyline,
    outline,
    bbox,
    length: lengthM,
    area,
    volume,
    maxFreeSpanM: lengthM,
  };
}

/**
 * Convenience: span/depth ratio = length_m / (depth_mm / 1000). Used από
 * validator για `MAX_SPAN_DEPTH_RATIO` check. Returns Infinity για
 * degenerate depth.
 */
export function getBeamSpanDepthRatio(params: BeamParams): number {
  if (params.depth <= 0) return Number.POSITIVE_INFINITY;
  const s = mmToSceneUnits(params.sceneUnits ?? 'mm');
  const verts = pickAxisVertices(params);
  const lengthM = computePolylineLengthMm(verts) * (1 / s) * MM_TO_M;
  const depthM = params.depth * MM_TO_M;
  return lengthM / depthM;
}

// ─── Internal helpers ────────────────────────────────────────────────────────

/**
 * Pick the axis vertices based on beam kind:
 *   - `curved` + `curveControl` → 17-vertex quadratic Bezier subdivision
 *   - else (straight / cantilever) → [startPoint, endPoint]
 */
function pickAxisVertices(params: BeamParams): readonly Point3D[] {
  if (params.kind === 'curved' && params.curveControl) {
    return subdivideQuadraticBezier(
      params.startPoint,
      params.curveControl,
      params.endPoint,
      CURVED_BEAM_SUBDIVISIONS,
    );
  }
  return [params.startPoint, params.endPoint];
}

/**
 * Quadratic Bezier subdivision: `P(t) = (1-t)² P0 + 2(1-t)t P1 + t² P2`.
 * Returns N+1 vertices including endpoints. Z is interpolated linearly
 * between start/end (control point Z ignored — beams are 2D-extruded in
 * Phase 5).
 */
function subdivideQuadraticBezier(
  start: Point3D,
  control: Point3D,
  end: Point3D,
  segments: number,
): Point3D[] {
  const pts: Point3D[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const oneMinusT = 1 - t;
    const w0 = oneMinusT * oneMinusT;
    const w1 = 2 * oneMinusT * t;
    const w2 = t * t;
    pts.push({
      x: w0 * start.x + w1 * control.x + w2 * end.x,
      y: w0 * start.y + w1 * control.y + w2 * end.y,
      z: oneMinusT * (start.z ?? 0) + t * (end.z ?? 0),
    });
  }
  return pts;
}

/**
 * Build a closed outline polygon by offsetting the axis σε ±width/2 along
 * the local perpendicular normal. For straight beams (2 vertices) the result
 * is a 4-vertex rectangle. For curved beams the result is a 2(N+1)-vertex
 * polygon, CCW οriented:
 *
 *   [+offset 0..N, -offset N..0]
 *
 * Per-vertex normal averages adjacent segment normals (mirrors wall-geometry
 * vertex-normal pattern). Degenerate segments (length < 1µm) are skipped from
 * the normal average.
 */
function buildOutlineRect(axis: readonly Point3D[], widthMm: number, s: number): Point3D[] {
  const n = axis.length;
  if (n < 2 || widthMm <= 0) {
    return [...axis];
  }
  // Convert mm scalar → canvas units for correct 2D offset.
  const half = (widthMm * s) / 2;
  const plus: Point3D[] = [];
  const minus: Point3D[] = [];
  for (let i = 0; i < n; i++) {
    const nx = vertexNormalX(axis, i);
    const ny = vertexNormalY(axis, i);
    const v = axis[i];
    plus.push({ x: v.x + half * nx, y: v.y + half * ny, z: v.z ?? 0 });
    minus.push({ x: v.x - half * nx, y: v.y - half * ny, z: v.z ?? 0 });
  }
  // CCW: +offset start→end, then -offset end→start
  const polygon: Point3D[] = [];
  for (const p of plus) polygon.push(p);
  for (let i = minus.length - 1; i >= 0; i--) polygon.push(minus[i]);
  return polygon;
}

function vertexNormalX(vertices: readonly Point3D[], i: number): number {
  const n = vertices.length;
  let acc = 0;
  let count = 0;
  if (i > 0) {
    const seg = segmentNormalX(vertices[i - 1], vertices[i]);
    if (seg !== null) { acc += seg; count += 1; }
  }
  if (i < n - 1) {
    const seg = segmentNormalX(vertices[i], vertices[i + 1]);
    if (seg !== null) { acc += seg; count += 1; }
  }
  return count > 0 ? acc / count : 0;
}

function vertexNormalY(vertices: readonly Point3D[], i: number): number {
  const n = vertices.length;
  let acc = 0;
  let count = 0;
  if (i > 0) {
    const seg = segmentNormalY(vertices[i - 1], vertices[i]);
    if (seg !== null) { acc += seg; count += 1; }
  }
  if (i < n - 1) {
    const seg = segmentNormalY(vertices[i], vertices[i + 1]);
    if (seg !== null) { acc += seg; count += 1; }
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

/**
 * Axis-aligned 3D bounding box. Phase B: z in metres (ADR-369 §2.2 Phase B).
 * top = (topElevation + zOffset) / 1000 m, bottom = top − depth / 1000 m.
 */
function computeBbox(
  axis: readonly Point3D[],
  outline: readonly Point3D[],
  topElevationMm: number,
  zOffsetMm: number,
  depthMm: number,
): BoundingBox3D {
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;
  const fold = (p: Point3D): void => {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  };
  for (const p of axis) fold(p);
  for (const p of outline) fold(p);
  const topFaceM = (topElevationMm + zOffsetMm) / 1000;
  const botFaceM = topFaceM - depthMm / 1000;
  return {
    min: { x: minX, y: minY, z: botFaceM },
    max: { x: maxX, y: maxY, z: topFaceM },
  };
}
