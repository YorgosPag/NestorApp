/**
 * Opening geometry computation (ADR-363 Phase 2).
 *
 * Pure SSoT function: derives `OpeningGeometry` cache από `OpeningParams +
 * hostWall`. Idempotent + side-effect free.
 *
 * Algorithm (host-relative, plan view):
 *   1. host axis unit vector + perpendicular (from wall.start → wall.end)
 *   2. center = wall.start + axisDir × (offsetFromStart + width/2)
 *   3. outline = 4 corner rectangle on wall axis, depth = wall.thickness
 *   4. bbox folds the 4 vertices (z=0 plan view)
 *   5. area (m²) = width × height / 1e6
 *   6. perimeter (m) = 2 × (width + height) / 1000
 *   7. hingeArc (door / french-door) = quarter arc radius = width
 *
 * Phase 2 limitation: curved + polyline host walls fall back to the straight
 * `start → end` axis approximation (the cutout is computed relative to the
 * chord, not the arc). Per-segment positioning for polyline lands Phase 2.5.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.4
 */

import type { Point3D, Polyline3D, Polygon3D, BoundingBox3D } from '../types/bim-base';
import type { OpeningParams, OpeningGeometry, OpeningKind } from '../types/opening-types';
import { isHingedKind } from '../types/opening-types';
import type { WallEntity } from '../types/wall-types';

const MM_TO_M = 1 / 1000;
const HINGE_ARC_SUBDIVISIONS = 12;
const HALF_PI = Math.PI / 2;

/**
 * Compute `OpeningGeometry` from `OpeningParams + hostWall`. SSoT για
 * όλη την opening-derived γεωμετρία. Caller MUST ensure `hostWall.id === params.wallId`.
 *
 * Throws nothing: invalid params (e.g. width = 0, offset out of bounds) still
 * produce a geometry — validation σε `validateOpeningParams()`.
 */
export function computeOpeningGeometry(
  params: OpeningParams,
  hostWall: WallEntity,
): OpeningGeometry {
  const start = hostWall.params.start;
  const end = hostWall.params.end;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const axisLen = Math.hypot(dx, dy) || 1;
  const ux = dx / axisLen;
  const uy = dy / axisLen;
  // Perpendicular (CCW 90°): (-uy, ux).
  const px = -uy;
  const py = ux;
  const rotation = Math.atan2(dy, dx);

  const centerOffset = params.offsetFromStart + params.width / 2;
  const center: Point3D = {
    x: start.x + ux * centerOffset,
    y: start.y + uy * centerOffset,
    z: 0,
  };

  const outline = buildOutline(center, ux, uy, px, py, params.width, hostWall.params.thickness);
  const bbox = computeBbox(outline.vertices);
  const hingeArc = isHingedKind(params.kind)
    ? buildHingeArc(params.kind, center, ux, uy, px, py, params)
    : undefined;

  return {
    position: center,
    rotation,
    outline,
    hingeArc,
    bbox,
    area: (params.width * params.height) * (MM_TO_M * MM_TO_M),
    perimeter: 2 * (params.width + params.height) * MM_TO_M,
  };
}

// ─── Internal helpers ────────────────────────────────────────────────────────

/**
 * Build the cutout rectangle (4 vertices, world coords). Vertices are ordered
 * CCW starting from the "start-outer" corner so the renderer can stroke /
 * fill consistently with the wall outer / inner edges.
 */
function buildOutline(
  center: Point3D,
  ux: number,
  uy: number,
  px: number,
  py: number,
  width: number,
  thickness: number,
): Polygon3D {
  const halfW = width / 2;
  const halfT = thickness / 2;
  const corners: readonly Point3D[] = [
    {
      x: center.x - ux * halfW - px * halfT,
      y: center.y - uy * halfW - py * halfT,
      z: 0,
    },
    {
      x: center.x + ux * halfW - px * halfT,
      y: center.y + uy * halfW - py * halfT,
      z: 0,
    },
    {
      x: center.x + ux * halfW + px * halfT,
      y: center.y + uy * halfW + py * halfT,
      z: 0,
    },
    {
      x: center.x - ux * halfW + px * halfT,
      y: center.y - uy * halfW + py * halfT,
      z: 0,
    },
  ];
  return { vertices: corners };
}

function computeBbox(vertices: readonly Point3D[]): BoundingBox3D {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const v of vertices) {
    if (v.x < minX) minX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.x > maxX) maxX = v.x;
    if (v.y > maxY) maxY = v.y;
  }
  return {
    min: { x: minX, y: minY, z: 0 },
    max: { x: maxX, y: maxY, z: 0 },
  };
}

/**
 * Quarter-arc swing indicator για door / french-door. Hinge anchor:
 *   - handing='left' (default) → hinge στο start side του opening
 *   - handing='right' → hinge στο end side
 *
 * Arc radius = opening width. Sweep 0..π/2 σε επίπεδο πλάκας (plan view).
 * `openDirection` ('inward' / 'outward') flips the perpendicular sign so
 * the arc rotates toward the correct face.
 */
function buildHingeArc(
  kind: OpeningKind,
  center: Point3D,
  ux: number,
  uy: number,
  px: number,
  py: number,
  params: OpeningParams,
): Polyline3D {
  const halfW = params.width / 2;
  const handingSign = params.handing === 'right' ? 1 : -1;
  const swingSign = params.openDirection === 'outward' ? -1 : 1;

  // Hinge point sits on the wall axis at the start/end of the opening.
  const hinge: Point3D = {
    x: center.x + ux * (handingSign * halfW),
    y: center.y + uy * (handingSign * halfW),
    z: 0,
  };

  // Starting radial vector: along axis toward the other jamb.
  const startVecX = -handingSign * ux;
  const startVecY = -handingSign * uy;
  // Perpendicular component aligned with swing direction.
  const perpX = swingSign * px;
  const perpY = swingSign * py;

  const points: Point3D[] = [];
  for (let i = 0; i <= HINGE_ARC_SUBDIVISIONS; i++) {
    const t = (i / HINGE_ARC_SUBDIVISIONS) * HALF_PI;
    const cos = Math.cos(t);
    const sin = Math.sin(t);
    points.push({
      x: hinge.x + params.width * (cos * startVecX + sin * perpX),
      y: hinge.y + params.width * (cos * startVecY + sin * perpY),
      z: 0,
    });
  }

  // french-door = mirror arc on the opposite jamb (two leaves).
  if (kind === 'french-door') {
    const hinge2: Point3D = {
      x: center.x + ux * (-handingSign * halfW),
      y: center.y + uy * (-handingSign * halfW),
      z: 0,
    };
    const startVec2X = handingSign * ux;
    const startVec2Y = handingSign * uy;
    for (let i = HINGE_ARC_SUBDIVISIONS; i >= 0; i--) {
      const t = (i / HINGE_ARC_SUBDIVISIONS) * HALF_PI;
      const cos = Math.cos(t);
      const sin = Math.sin(t);
      points.push({
        x: hinge2.x + params.width * (cos * startVec2X + sin * perpX),
        y: hinge2.y + params.width * (cos * startVec2Y + sin * perpY),
        z: 0,
      });
    }
  }

  return { points, closed: false };
}

/**
 * Project an arbitrary point onto the host wall axis, returning the
 * `offsetFromStart` (mm) clamped to `[0, wallLength]`. Used by the opening
 * tool to convert a canvas click into a host-relative offset (snap-to-host).
 */
export function projectPointToWallOffset(
  point: { readonly x: number; readonly y: number },
  hostWall: WallEntity,
): number {
  const start = hostWall.params.start;
  const end = hostWall.params.end;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const axisLen = Math.hypot(dx, dy);
  if (axisLen <= 0) return 0;
  const ux = dx / axisLen;
  const uy = dy / axisLen;
  const vx = point.x - start.x;
  const vy = point.y - start.y;
  const projected = vx * ux + vy * uy;
  if (projected < 0) return 0;
  if (projected > axisLen) return axisLen;
  return projected;
}
