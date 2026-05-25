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
 * Phase 2 (resolved): curved + polyline host walls use the actual tessellated
 * axis vertices from `getWallAxisVertices()`. `offsetFromStart` is measured along
 * the arc; `projectPointToWallOffset` projects onto the polyline, not the chord.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.4
 */

import type { Point3D, Polyline3D, Polygon3D, BoundingBox3D } from '../types/bim-base';
import type { OpeningParams, OpeningGeometry, OpeningKind } from '../types/opening-types';
import { isHingedKind } from '../types/opening-types';
import type { WallEntity } from '../types/wall-types';
import { getWallAxisVertices } from './wall-geometry';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';

const MM_TO_M = 1 / 1000;
/**
 * Number of subdivisions per quarter-arc. Exported so consumers (e.g.
 * OpeningRenderer leaf-line drawing) can index into `hingeArc.points`
 * without re-deriving the array layout.
 */
export const HINGE_ARC_SUBDIVISIONS = 12;
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
  sceneUnits: SceneUnits = 'mm',
): OpeningGeometry {
  // ADR-370 — axisVertices ζουν σε scene-units. `params.offsetFromStart` και
  // `params.width` είναι σε mm (Nestor convention). Με `mmToSceneUnits()`
  // ευθυγραμμίζουμε mm→scene ώστε το walk να διασχίζει τη σωστή απόσταση και
  // το outline να συμπίπτει με το ghost preview στο canvas.
  const mmFactor = mmToSceneUnits(sceneUnits);
  const axisVertices = getWallAxisVertices(hostWall.params, hostWall.kind);
  const centerOffsetMm = Math.max(0, params.offsetFromStart + params.width / 2);
  const centerOffsetScene = centerOffsetMm * mmFactor;
  const widthScene = params.width * mmFactor;
  const thicknessScene = hostWall.params.thickness * mmFactor;
  const { point: center, ux, uy, rotation } = walkPolylineToDistance(axisVertices, centerOffsetScene);
  // Perpendicular (CCW 90°): (-uy, ux).
  const px = -uy;
  const py = ux;

  const outline = buildOutline(center, ux, uy, px, py, widthScene, thicknessScene);
  const bbox = computeBbox(outline.vertices, params.sillHeight, params.height);
  const hingeResult = isHingedKind(params.kind)
    ? buildHingeArc(params.kind, center, ux, uy, px, py, params, widthScene)
    : undefined;

  return {
    position: center,
    rotation,
    outline,
    hingeArc: hingeResult?.arc,
    hingeAnchor: hingeResult?.hingeAnchor,
    hingeAnchor2: hingeResult?.hingeAnchor2,
    bbox,
    area: (params.width * params.height) * (MM_TO_M * MM_TO_M),
    perimeter: 2 * (params.width + params.height) * MM_TO_M,
  };
}

// ─── Polyline axis helpers ────────────────────────────────────────────────────

/**
 * Walk `vertices` from the start by `distanceMm` mm and return the world
 * position + local tangent direction at that point. Clamps past the end.
 */
function walkPolylineToDistance(
  vertices: readonly Point3D[],
  distanceMm: number,
): { point: Point3D; ux: number; uy: number; rotation: number } {
  let remaining = distanceMm;
  for (let i = 0; i < vertices.length - 1; i++) {
    const a = vertices[i];
    const b = vertices[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const segLen = Math.hypot(dx, dy);
    if (segLen < 1e-6) continue;
    const ux = dx / segLen;
    const uy = dy / segLen;
    if (remaining <= segLen) {
      const t = remaining / segLen;
      return {
        point: { x: a.x + dx * t, y: a.y + dy * t, z: 0 },
        ux,
        uy,
        rotation: Math.atan2(dy, dx),
      };
    }
    remaining -= segLen;
  }
  // Past end — clamp to last vertex, use last segment tangent.
  const n = vertices.length;
  const a = vertices[n - 2];
  const b = vertices[n - 1];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const segLen = Math.hypot(dx, dy) || 1;
  return {
    point: { x: b.x, y: b.y, z: b.z ?? 0 },
    ux: dx / segLen,
    uy: dy / segLen,
    rotation: Math.atan2(dy, dx),
  };
}

/**
 * Project `point` onto the polyline `vertices`, returning the cumulative arc
 * offset (mm) of the closest foot, clamped to `[0, totalArcLength]`.
 */
function projectPointToPolylineOffset(
  point: { readonly x: number; readonly y: number },
  vertices: readonly Point3D[],
): number {
  let arcOffset = 0;
  let bestOffset = 0;
  let bestDist2 = Infinity;

  for (let i = 0; i < vertices.length - 1; i++) {
    const a = vertices[i];
    const b = vertices[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const segLen = Math.hypot(dx, dy);
    if (segLen < 1e-6) continue;
    const ux = dx / segLen;
    const uy = dy / segLen;
    const vx = point.x - a.x;
    const vy = point.y - a.y;
    const t = Math.max(0, Math.min(vx * ux + vy * uy, segLen));
    const ex = point.x - (a.x + ux * t);
    const ey = point.y - (a.y + uy * t);
    const dist2 = ex * ex + ey * ey;
    if (dist2 < bestDist2) {
      bestDist2 = dist2;
      bestOffset = arcOffset + t;
    }
    arcOffset += segLen;
  }

  return Math.max(0, Math.min(bestOffset, arcOffset));
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

/**
 * Phase B: z in metres (ADR-369 Phase B).
 * sill = sillHeight / 1000 m, head = (sillHeight + height) / 1000 m.
 */
function computeBbox(
  vertices: readonly Point3D[],
  sillHeightMm: number,
  heightMm: number,
): BoundingBox3D {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const v of vertices) {
    if (v.x < minX) minX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.x > maxX) maxX = v.x;
    if (v.y > maxY) maxY = v.y;
  }
  return {
    min: { x: minX, y: minY, z: sillHeightMm / 1000 },
    max: { x: maxX, y: maxY, z: (sillHeightMm + heightMm) / 1000 },
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
interface HingeArcResult {
  readonly arc: Polyline3D;
  readonly hingeAnchor: Point3D;
  readonly hingeAnchor2?: Point3D;
}

function buildHingeArc(
  kind: OpeningKind,
  center: Point3D,
  ux: number,
  uy: number,
  px: number,
  py: number,
  params: OpeningParams,
  widthScene: number,
): HingeArcResult {
  const halfW = widthScene / 2;
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
      x: hinge.x + widthScene * (cos * startVecX + sin * perpX),
      y: hinge.y + widthScene * (cos * startVecY + sin * perpY),
      z: 0,
    });
  }

  // french-door = mirror arc on the opposite jamb (two leaves).
  let hinge2: Point3D | undefined;
  if (kind === 'french-door') {
    hinge2 = {
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
        x: hinge2.x + widthScene * (cos * startVec2X + sin * perpX),
        y: hinge2.y + widthScene * (cos * startVec2Y + sin * perpY),
        z: 0,
      });
    }
  }

  return { arc: { points, closed: false }, hingeAnchor: hinge, hingeAnchor2: hinge2 };
}

/**
 * Project an arbitrary point onto the host wall axis, returning the
 * `offsetFromStart` (mm) clamped to `[0, arcLength]`. Supports straight,
 * curved, and polyline walls via the tessellated axis from `getWallAxisVertices`.
 *
 * Used by the opening tool to convert a canvas click into a host-relative offset.
 */
export function projectPointToWallOffset(
  point: { readonly x: number; readonly y: number },
  hostWall: WallEntity,
): number {
  const axisVertices = getWallAxisVertices(hostWall.params, hostWall.kind);
  return projectPointToPolylineOffset(point, axisVertices);
}
