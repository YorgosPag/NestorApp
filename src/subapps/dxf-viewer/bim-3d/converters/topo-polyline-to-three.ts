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

/**
 * Append one polyline's segments (as consecutive XYZ pairs) into `buf`.
 *
 * `elevationMmAt(index)` supplies the DATUM-RELATIVE elevation of vertex `index` — the caller has
 * already subtracted the project datum, because only it knows whether the elevation is per-line
 * (contours) or per-vertex (feature lines). `closed` adds the last→first segment.
 *
 * A segment whose either end is non-finite is skipped, not zeroed: a zeroed vertex would draw a
 * line to the origin across the whole site, which reads as real geometry.
 */
export function appendTopoPolylineSegments(
  buf: number[],
  vertices: readonly Point2D[],
  elevationMmAt: (index: number) => number,
  closed: boolean,
  project: WorldToDisplayProjector | null,
): void {
  if (vertices.length < 2) return;
  const count = closed ? vertices.length : vertices.length - 1;
  for (let i = 0; i < count; i++) {
    if (!projectVertex(vertices[i]!, elevationMmAt(i), project)) continue;
    const ax = SCRATCH[0]!, ay = SCRATCH[1]!, az = SCRATCH[2]!;
    const next = (i + 1) % vertices.length;
    if (!projectVertex(vertices[next]!, elevationMmAt(next), project)) continue;
    buf.push(ax, ay, az, SCRATCH[0]!, SCRATCH[1]!, SCRATCH[2]!);
  }
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
