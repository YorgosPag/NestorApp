/**
 * Shared pure helpers for StairGeometryService (ADR-358 §5.1).
 *
 * Imported by both the entry module and stair-geometry-lshape.ts to avoid
 * circular dependencies while keeping the entry module under 500 lines.
 */

import type { Point3D } from '../../../rendering/types/Types';
import { offsetPolyline } from '../../../rendering/entities/shared/geometry-offset-utils';
import type {
  BoundingBox3D,
  Polygon3D,
  Polyline3D,
  Segment3D,
  StairArrowSymbol,
  StairHandrailGeometry,
  StairHandrails,
  StairUpDirection,
} from '../../../bim/types/stair-types';

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

/**
 * Plan-frame offset: `base + dir·scale`. SSoT for the "step off a point along a
 * direction" idiom every turning kind (L/U/Γ) uses to place turn corners /
 * edge-origin flights (N.18 — no per-kind twin of the `{x:…,y:…}` literal).
 */
export function offsetAlong(base: Vec2, dir: Vec2, scale: number): Vec2 {
  return { x: base.x + dir.x * scale, y: base.y + dir.y * scale };
}

/** Rotate a 2-D vector by `angleRad` (CCW positive). SSoT for the winder fan. */
export function rotateVec(v: Vec2, angleRad: number): Vec2 {
  const c = Math.cos(angleRad);
  const s = Math.sin(angleRad);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
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

// ─── Transition risers (level boundaries around landings) ─────────────────────

/**
 * The two width-edge endpoints of a stair surface (tread/landing) at a plan
 * point, in the SAME `[startSide, endSide]` order the flight generators use for
 * their diagonal risers (`buildRectilinearFlight` = `−v..+v`; `buildFlightFromEdge`
 * = `origin..+vWidth`).
 */
export type WidthEdges = readonly [Vec2, Vec2];

/** Width edges of a CENTRELINE surface at `centre`: `centre ± perp(u)·(width/2)`. */
export function centrelineWidthEdges(centre: Vec2, u: Vec2, width: number): WidthEdges {
  const v = perp(u);
  const halfW = width * 0.5;
  return [offsetAlong(centre, v, -halfW), offsetAlong(centre, v, halfW)];
}

/** Width edges of an EDGE-ORIGIN surface at `origin`: `origin` → `origin + vWidth·width`. */
export function edgeWidthEdges(origin: Vec2, vWidth: Vec2, width: number): WidthEdges {
  return [origin, offsetAlong(origin, vWidth, width)];
}

/**
 * A transition riser across a level boundary between two adjacent stair surfaces
 * (tread↔landing / landing↔tread / landing↔landing), in the ADR-370 Phase 5.3
 * diagonal `Segment3D` encoding the in-flight risers use (`start` at the low
 * elevation, `end` at the high). SSoT for the risers the flight generators can
 * NEVER emit — each generator only produces `count−1` INTERNAL risers, so every
 * landing boundary (both sides) had no riser (the ADR-637 "riser count invariant"
 * claim was false in code). `edges` are the shared boundary's two width endpoints
 * (`centrelineWidthEdges` / `edgeWidthEdges`).
 */
export function buildTransitionRiser(edges: WidthEdges, zLow: number, zHigh: number): Segment3D {
  return {
    start: point(edges[0].x, edges[0].y, zLow),
    end: point(edges[1].x, edges[1].y, zHigh),
  };
}

/**
 * The TWO transition risers around one landing at `zLanding`: the incoming
 * flight's top tread (`zLanding − rise`) → landing, and the landing →
 * outgoing flight's first tread (`zLanding + rise`). `inEdges`/`outEdges` are the
 * incoming/outgoing surfaces' width edges in their own origin convention
 * (centreline or edge), so one call serves L/U/Γ turn landings and multi-flight
 * corners alike (N.18 — no per-kind twin).
 */
export function landingTransitionRisers(
  inEdges: WidthEdges,
  outEdges: WidthEdges,
  zLanding: number,
  rise: number,
): Segment3D[] {
  return [
    buildTransitionRiser(inEdges, zLanding - rise, zLanding),
    buildTransitionRiser(outEdges, zLanding, zLanding + rise),
  ];
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

/**
 * Handrails follow the inner and outer flight edges — same xy path as the
 * stringers, distinguished only by elevation (`handrails.height`, applied
 * downstream by renderers). Only the sides toggled on in `params.handrails`
 * are populated; the returned object stays empty when both `inner` and
 * `outer` are disabled (matches the legacy `handrails: {}` empty default).
 *
 * ADR-370 Phase 5.2 (2026-05-25) — closes the 2D-engine gap that left
 * `StairGeometry.handrails` empty for every kind, preventing the 3D viewer
 * (StairToThreeConverter) from rendering the handrail tubes even when the
 * user had enabled them via the Stair Properties panel.
 */
export function buildHandrailsFromParams(
  walkline: Polyline3D,
  width: number,
  handrails: StairHandrails,
): StairHandrailGeometry {
  if (!handrails.inner && !handrails.outer) return {};
  const halfW = width * 0.5;
  const result: { -readonly [K in keyof StairHandrailGeometry]: StairHandrailGeometry[K] } = {};
  if (handrails.inner) result.inner = offsetPolyline(walkline, -halfW);
  if (handrails.outer) result.outer = offsetPolyline(walkline, halfW);
  return result;
}
