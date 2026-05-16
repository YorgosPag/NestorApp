/**
 * Shared pure helpers for StairGeometryService (ADR-358 §5.1).
 *
 * Imported by both the entry module and stair-geometry-lshape.ts to avoid
 * circular dependencies while keeping the entry module under 500 lines.
 */

import type { Point3D } from '../../rendering/types/Types';
import { offsetPolyline } from '../../rendering/entities/shared/geometry-offset-utils';
import type {
  BoundingBox3D,
  Polygon3D,
  Polyline3D,
  Segment3D,
  StairArrowSymbol,
  StairUpDirection,
} from '../../types/stair';

const DEG2RAD = Math.PI / 180;

export const DEFAULT_CUT_PLANE_HEIGHT = 1200;

// ─── Vec2 ────────────────────────────────────────────────────────────────────

export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

export function directionToUnitVector(degrees: number): Vec2 {
  const r = degrees * DEG2RAD;
  return { x: Math.cos(r), y: Math.sin(r) };
}

/** CCW perpendicular of a unit vector (math frame: +90°). */
export function perp(u: Vec2): Vec2 {
  return { x: -u.y, y: u.x };
}

export function point(x: number, y: number, z: number): Point3D {
  return { x, y, z };
}

// ─── Geometry primitives ──────────────────────────────────────────────────────

/** Rectangle CCW in xy plane: `length` along `u`, `width` along perp(u), at fixed `z`. */
export function rectangleAt(
  originXY: Vec2,
  u: Vec2,
  length: number,
  width: number,
  z: number,
): Polygon3D {
  const v = perp(u);
  return [
    point(originXY.x, originXY.y, z),
    point(originXY.x + u.x * length, originXY.y + u.y * length, z),
    point(
      originXY.x + u.x * length + v.x * width,
      originXY.y + u.y * length + v.y * width,
      z,
    ),
    point(originXY.x + v.x * width, originXY.y + v.y * width, z),
  ];
}

export function arrowSymbol(
  start: Point3D,
  end: Point3D,
  upDirection: StairUpDirection,
): StairArrowSymbol {
  return { start, end, label: upDirection === 'forward' ? 'UP' : 'DOWN' };
}

export function bboxOfPolygons(polygons: readonly Polygon3D[]): BoundingBox3D {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (const poly of polygons) {
    for (const p of poly) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.z < minZ) minZ = p.z;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
      if (p.z > maxZ) maxZ = p.z;
    }
  }
  return { min: { x: minX, y: minY, z: minZ }, max: { x: maxX, y: maxY, z: maxZ } };
}

// ─── Cut-plane + stringer ─────────────────────────────────────────────────────

/**
 * Split treads by cut plane (G14). Tread placed in `below` when its z is
 * strictly below `cutPlaneHeight`, else `above`.
 */
export function splitTreadsByCutPlane(
  treads: readonly Polygon3D[],
  cutPlaneHeight: number,
): { readonly below: readonly Polygon3D[]; readonly above: readonly Polygon3D[] } {
  const below: Polygon3D[] = [];
  const above: Polygon3D[] = [];
  for (const tread of treads) {
    const z = tread[0]?.z ?? 0;
    if (z < cutPlaneHeight) below.push(tread);
    else above.push(tread);
  }
  return { below, above };
}

/** cutLine perpendicular to `direction` at the boundary tread's centroid (Phase 3a stub). */
export function buildCutLine(
  boundaryTread: Polygon3D,
  uDir: Vec2,
  width: number,
  cutPlaneHeight: number,
): Segment3D {
  let cx = 0, cy = 0;
  for (const p of boundaryTread) { cx += p.x; cy += p.y; }
  cx /= boundaryTread.length;
  cy /= boundaryTread.length;
  const v = perp(uDir);
  const half = width * 0.5;
  return {
    start: point(cx - v.x * half, cy - v.y * half, cutPlaneHeight),
    end: point(cx + v.x * half, cy + v.y * half, cutPlaneHeight),
  };
}

/**
 * Multi-flight aware cutLine builder (Phase 3b, G14).
 *
 * Locates the FIRST tread (in flight-then-index order) whose z is at or above
 * `cutPlaneHeight` and emits a cutLine perpendicular to THAT flight's
 * direction — solves the latent bug in Phase 3a where l-shape always passed
 * `u1` even when the cut crossed inside flight 2.
 *
 * Returns `undefined` when no tread crosses the cut plane (single-band stair).
 */
export function buildCutLineForFlights(
  treads: readonly Polygon3D[],
  flightSplit: readonly number[],
  flightDirections: readonly Vec2[],
  width: number,
  cutPlaneHeight: number,
): Segment3D | undefined {
  let globalIdx = 0;
  for (let f = 0; f < flightSplit.length; f++) {
    const n = flightSplit[f];
    const uDir = flightDirections[f] ?? flightDirections[0];
    for (let i = 0; i < n; i++) {
      if (globalIdx >= treads.length) return undefined;
      const tread = treads[globalIdx];
      const z = tread[0]?.z ?? 0;
      if (z >= cutPlaneHeight) {
        return buildCutLine(tread, uDir, width, cutPlaneHeight);
      }
      globalIdx++;
    }
  }
  return undefined;
}

export function buildStringersFromWalkline(
  walkline: Polyline3D,
  width: number,
): { readonly inner: Polyline3D; readonly outer: Polyline3D } {
  const halfW = width * 0.5;
  return {
    outer: offsetPolyline(walkline, halfW),
    inner: offsetPolyline(walkline, -halfW),
  };
}
