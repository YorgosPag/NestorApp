/**
 * ADR-650 M6 — the geometry the prism method rests on. Pure, store-free, no TIN knowledge.
 *
 * ── The trap this module exists to defuse ────────────────────────────────────────────────
 * A triangle whose Δz is positive at one vertex and negative at another CROSSES the reference:
 * part of it is excavation, part of it is embankment. Summing one prism over the whole
 * triangle lets the two cancel — and the report comes out wrong SILENTLY (net looks right,
 * cut and fill are both understated, and the earthworks bid is nonsense). Civil 3D subdivides
 * such a triangle along the zero-Δz line («daylight line»); so do we, in `splitByZeroDz`.
 *
 * ── Why area × Δz(area-centroid) is EXACT, not an average ────────────────────────────────
 * Δz over a triangle is a LINEAR field (both surfaces are planar there). The integral of a
 * linear field over any polygon equals `Area × value at the polygon's AREA centroid` — so one
 * area and one plane evaluation give the exact prism volume, for a triangle and for any piece
 * a boundary/daylight cut leaves behind. That is why the pieces need no re-triangulation.
 *
 * Reuse (N.18 — nothing re-derived): `shoelaceArea`/`polygonArea`/`polygonAreaCentroid` from the
 * polygon SSoT, and `crossEdge` from `marching-triangles` for the zero crossing (the same
 * linear-interpolation question the contour extractor asks, on a Δz field instead of a Z one).
 */

import type { Point2D } from '../../rendering/types/Types';
import { polygonArea, polygonAreaCentroid } from '../../bim/geometry/shared/polygon-utils';
import { crossEdge } from './marching-triangles';

/** A polygon vertex carrying the Δz (surface − reference) of the surface at that point. */
export interface DzVertex {
  readonly x: number;
  readonly y: number;
  /** Canonical mm. > 0 → ground above the reference (cut). < 0 → below it (fill). */
  readonly dz: number;
}

/** The plane `Δz = a·x + b·y + c` fitted through a triangle's three Δz samples. */
export interface DzPlane {
  readonly a: number;
  readonly b: number;
  readonly c: number;
}

/** Degenerate-area guard, in mm² — a sliver below this contributes no volume anyway. */
const MIN_AREA_MM2 = 1e-6;

/**
 * The Δz plane through three vertices, or `null` when they are collinear (a zero-area
 * triangle — no plane, and no volume to lose by skipping it).
 */
export function fitDzPlane(v0: DzVertex, v1: DzVertex, v2: DzVertex): DzPlane | null {
  const det =
    (v1.x - v0.x) * (v2.y - v0.y) - (v2.x - v0.x) * (v1.y - v0.y);
  if (!Number.isFinite(det) || Math.abs(det) < MIN_AREA_MM2) return null;

  const a =
    ((v1.dz - v0.dz) * (v2.y - v0.y) - (v2.dz - v0.dz) * (v1.y - v0.y)) / det;
  const b =
    ((v2.dz - v0.dz) * (v1.x - v0.x) - (v1.dz - v0.dz) * (v2.x - v0.x)) / det;
  const c = v0.dz - a * v0.x - b * v0.y;
  return Number.isFinite(a) && Number.isFinite(b) && Number.isFinite(c) ? { a, b, c } : null;
}

/** Δz of the plane at a planimetric point — the SSoT way to re-attach Δz to a cut vertex. */
export function dzAt(plane: DzPlane, p: Point2D): number {
  return plane.a * p.x + plane.b * p.y + plane.c;
}

/** Lift a planimetric polygon onto the plane, so every vertex carries its own Δz. */
export function attachDz(vertices: readonly Point2D[], plane: DzPlane): DzVertex[] {
  return vertices.map((p) => ({ x: p.x, y: p.y, dz: dzAt(plane, p) }));
}

/**
 * Split a polygon on the ZERO line of its Δz field — the daylight line.
 *
 * Half-plane clipping (Sutherland-Hodgman's inner step, but on the SCALAR field rather than
 * on a clip edge — a clip polygon cannot express «where Δz changes sign»). Vertices exactly
 * on the line join BOTH halves, which is what keeps the two pieces watertight: their areas
 * sum back to the original.
 *
 * A polygon entirely on one side comes back whole on that side and empty on the other — the
 * common case, and it costs one sign test.
 */
export function splitByZeroDz(polygon: readonly DzVertex[]): {
  readonly cut: DzVertex[];
  readonly fill: DzVertex[];
} {
  if (polygon.length < 3) return { cut: [], fill: [] };
  return {
    cut: clipToSign(polygon, 1),
    fill: clipToSign(polygon, -1),
  };
}

/**
 * The prism volume of ONE piece whose Δz has a single sign, in canonical mm³ (always ≥ 0),
 * together with its PLAN area in mm². `V = A · Δz(area-centroid)` — exact for the linear
 * field (see the header). Pieces below the sliver threshold contribute nothing.
 */
export function pieceVolumeMm3(piece: readonly DzVertex[], plane: DzPlane): {
  readonly areaMm2: number;
  readonly volumeMm3: number;
} {
  if (piece.length < 3) return { areaMm2: 0, volumeMm3: 0 };

  const lifted = piece.map((p) => ({ x: p.x, y: p.y, z: 0 }));
  const areaMm2 = polygonArea(lifted);
  if (!(areaMm2 > MIN_AREA_MM2)) return { areaMm2: 0, volumeMm3: 0 };

  const centroid = polygonAreaCentroid(lifted);
  const volumeMm3 = Math.abs(areaMm2 * dzAt(plane, centroid));
  return { areaMm2, volumeMm3: Number.isFinite(volumeMm3) ? volumeMm3 : 0 };
}

// ─── internals ─────────────────────────────────────────────────────────────────

/** Keep the part of the polygon where `sign · Δz ≥ 0`, interpolating new vertices on Δz = 0. */
function clipToSign(polygon: readonly DzVertex[], sign: 1 | -1): DzVertex[] {
  const out: DzVertex[] = [];
  const n = polygon.length;

  for (let i = 0; i < n; i++) {
    const current = polygon[i]!;
    const previous = polygon[(i + n - 1) % n]!;
    const currentInside = sign * current.dz >= 0;
    const previousInside = sign * previous.dz >= 0;

    if (currentInside !== previousInside) out.push(zeroCrossing(previous, current));
    if (currentInside) out.push(current);
  }
  return out.length >= 3 ? out : [];
}

/** The point on edge a→b where Δz = 0 — via the contour extractor's linear crossing (SSoT). */
function zeroCrossing(a: DzVertex, b: DzVertex): DzVertex {
  const p = crossEdge({ x: a.x, y: a.y }, a.dz, { x: b.x, y: b.y }, b.dz, 0);
  return { x: p.x, y: p.y, dz: 0 };
}
