/**
 * ADR-650 M10d / M8β/Γ — «this survey polyline, as three-world line segments», once.
 *
 * The packing half of every topographic line converter: project each WORLD-mm vertex through the
 * geo-reference projector, drop it by the vertical datum, swap to the three axis convention, and
 * emit consecutive XYZ pairs for a `THREE.LineSegments`. What the CALLERS keep is only what
 * genuinely differs — where a vertex's elevation comes from:
 *
 *   - `contour-to-three` — one constant elevation per line (a contour IS the surface's
 *     intersection with a horizontal plane, so the drape is implicit in `level`).
 *   - `auto-breakline-to-three` — a real surveyed Z **per vertex** (a chain of TIN edges climbs).
 *
 * Extracted when the auto-breakline candidates became the second producer: written as a mirror of
 * the contour converter they reproduced `projectVertex` / `appendContourSegments` / `toGeometry`
 * almost verbatim, which is precisely the twin `jscpd --diff` exists to catch (N.18). Two copies
 * of a sign convention is how one of them silently ends up mirrored across the site.
 *
 * Pure: no store, no scene. The impure scene layers resolve the projector + datum from the SAME
 * SSoTs the terrain mesh reads and pass them in, so nothing drawn through here can seat
 * differently from the hill it belongs to.
 *
 * @module bim-3d/converters/topo-polyline-to-three
 */

import * as THREE from 'three';
import type { Point2D } from '../../rendering/types/Types';
import type { WorldToDisplayProjector } from '../../systems/geo-referencing/geo-transform';
import { writeDxfPlanToWorld } from '../viewport/coordinate-transforms';

/** Scratch vertex buffer — reused across every vertex so the hot loop allocates nothing. */
const SCRATCH = new Float32Array(3);

/**
 * The projector to actually apply, or `null` for the fast path. An identity projector is a
 * no-op that still costs a call and an object per vertex, and there is one whenever the project
 * is not geo-referenced — i.e. the common case.
 */
export function activeProjector(
  projector?: WorldToDisplayProjector | null,
): WorldToDisplayProjector | null {
  return projector && !projector.isIdentity ? projector : null;
}

/**
 * Project ONE world-mm vertex into three-world metres, written into {@link SCRATCH}.
 * Returns false when any coordinate is non-finite (the segment is then dropped by the caller —
 * a single NaN would poison the geometry's `Box3` and blank the whole 3D scene, ADR-537).
 */
function projectVertex(
  v: Point2D,
  elevMm: number,
  project: WorldToDisplayProjector | null,
): boolean {
  const plan = project ? project.project(v.x, v.y) : null;
  const planX = plan ? plan.x : v.x;
  const planY = plan ? plan.y : v.y;
  if (!Number.isFinite(planX) || !Number.isFinite(planY) || !Number.isFinite(elevMm)) return false;
  writeDxfPlanToWorld(SCRATCH, 0, planX, planY, elevMm);
  return true;
}

/** True when vertex `index` of a flat XYZ buffer is fully finite (see {@link projectTopoPolylineVertices}). */
function isFiniteAt(points: Float32Array, index: number): boolean {
  const o = index * 3;
  return Number.isFinite(points[o]) && Number.isFinite(points[o + 1]) && Number.isFinite(points[o + 2]);
}

/**
 * Project a polyline's vertices ONCE into a flat `[x,y,z, …]` buffer — one entry per vertex, in
 * path order, with `NaN` written where the projection failed.
 *
 * The NaN is deliberate and it is why this is the primitive rather than an internal step: dropping
 * a bad vertex here would shift every following index, and the two consumers (segments, corner
 * markers) BOTH address vertices by index. Marking the hole keeps the addressing honest, and each
 * consumer decides for itself what a hole means — a dropped segment, or a marker not drawn.
 *
 * `elevationMmAt(index)` supplies the DATUM-RELATIVE elevation of vertex `index`; the caller has
 * already subtracted the project datum, because only it knows whether the elevation is per-line
 * (contours) or per-vertex (feature lines).
 */
export function projectTopoPolylineVertices(
  vertices: readonly Point2D[],
  elevationMmAt: (index: number) => number,
  project: WorldToDisplayProjector | null,
): Float32Array {
  const points = new Float32Array(vertices.length * 3);
  for (let i = 0; i < vertices.length; i++) {
    const o = i * 3;
    if (projectVertex(vertices[i]!, elevationMmAt(i), project)) {
      points[o] = SCRATCH[0]!;
      points[o + 1] = SCRATCH[1]!;
      points[o + 2] = SCRATCH[2]!;
    } else {
      points[o] = Number.NaN;
      points[o + 1] = Number.NaN;
      points[o + 2] = Number.NaN;
    }
  }
  return points;
}

/**
 * Append the segments of an ALREADY-projected polyline (as consecutive XYZ pairs) into `buf`.
 * `closed` adds the last→first segment.
 *
 * A segment whose either end is non-finite is skipped, not zeroed: a zeroed vertex would draw a
 * line to the origin across the whole site, which reads as real geometry.
 */
export function appendProjectedPolylineSegments(
  buf: number[],
  points: Float32Array,
  closed: boolean,
): void {
  const total = Math.floor(points.length / 3);
  if (total < 2) return;
  const count = closed ? total : total - 1;
  for (let i = 0; i < count; i++) {
    const next = (i + 1) % total;
    if (!isFiniteAt(points, i) || !isFiniteAt(points, next)) continue;
    const a = i * 3, b = next * 3;
    buf.push(points[a]!, points[a + 1]!, points[a + 2]!, points[b]!, points[b + 1]!, points[b + 2]!);
  }
}

/**
 * Project one polyline and append its segments — the one-call path for callers that need nothing
 * but the line (the contours). Callers that ALSO address vertices (the focused breakline's corner
 * markers) project once with {@link projectTopoPolylineVertices} and append from that buffer, so
 * no vertex is transformed twice.
 */
export function appendTopoPolylineSegments(
  buf: number[],
  vertices: readonly Point2D[],
  elevationMmAt: (index: number) => number,
  closed: boolean,
  project: WorldToDisplayProjector | null,
): void {
  if (vertices.length < 2) return;
  appendProjectedPolylineSegments(buf, projectTopoPolylineVertices(vertices, elevationMmAt, project), closed);
}

/** Build a LineSegments geometry from a flat XYZ-pair buffer, or `null` when empty. */
export function toTopoLineGeometry(buf: readonly number[]): THREE.BufferGeometry | null {
  if (buf.length === 0) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(buf), 3));
  // Static line bounds → compute the bounding sphere once so three's native frustum culling can
  // skip an off-screen line set deterministically (same reasoning as the DXF wireframe buckets).
  geo.computeBoundingSphere();
  return geo;
}
