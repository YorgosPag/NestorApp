/**
 * ADR-650 M10d — `ContourLine[]` → `THREE.BufferGeometry` line segments, draped on the surface.
 *
 * The plan-view sibling of `tin-to-three`: the SAME derived contours that the 2D plan draws as
 * `lwpolyline` entities, lifted into the 3D scene ONCE at their real elevation. A contour is by
 * definition the surface's intersection with a horizontal plane at `level`, so a flat ring at
 * `z = level − datum` sits exactly ON the terrain mesh — no per-vertex TIN sampling needed; the
 * "drape" is implicit in the contour's own constant elevation.
 *
 * Pure: no store, no scene. The impure caller (`TerrainContourLayer`) resolves the projector +
 * datum from the same SSoTs the terrain mesh uses (`getActiveWorldToDisplayProjector`,
 * `getActiveVerticalDatumMm`) and passes them IN, so the contours and the mesh can never seat
 * differently. Major/minor split into two geometries so each takes its own layer colour.
 *
 * The three transforms that MUST happen exactly once, and happen here (mirror of `tin-to-three`):
 *   1. WORLD → building-DISPLAY  — `ContourLine.vertices` are already WORLD mm (unlike the TIN's
 *      LOCAL positions), so the projector applies directly.
 *   2. real WORLD Z − datum      — `z = level − datumMm`, the vertical mirror of the planar project.
 *   3. plan-mm → three world (m, Y-up) — via `writeDxfPlanToWorld`, the SAME convention the grips /
 *      ghosts / snap markers / terrain mesh use. Never re-inlined here.
 *
 * @module bim-3d/converters/contour-to-three
 */

import * as THREE from 'three';
import type { Point2D } from '../../rendering/types/Types';
import type { ContourLine } from '../../systems/topography/topo-types';
import type { WorldToDisplayProjector } from '../../systems/geo-referencing/geo-transform';
import { writeDxfPlanToWorld } from '../viewport/coordinate-transforms';

/** The per-build display inputs, resolved by the impure caller (mirror of `TinShadingOptions`). */
export interface ContourLineOptions {
  /** ADR-650 M10b — active WORLD (ΕΓΣΑ) → building-DISPLAY projector. Omitted/identity → world. */
  readonly projector?: WorldToDisplayProjector | null;
  /** ADR-650 M10c — project vertical datum (WORLD mm) subtracted from every contour elevation. */
  readonly datumMm?: number;
}

/** The two line-segment geometries a contour set produces — one per layer colour. `null` = empty. */
export interface ContourLineGeometries {
  readonly major: THREE.BufferGeometry | null;
  readonly minor: THREE.BufferGeometry | null;
}

/** Scratch vertex buffer — reused across every vertex so the hot loop allocates nothing. */
const SCRATCH = new Float32Array(3);

/**
 * Project ONE world-mm contour vertex into three-world metres, written into {@link SCRATCH}.
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

/** Append one contour line's segments (as consecutive XYZ pairs) into `buf`. */
function appendContourSegments(
  buf: number[],
  line: ContourLine,
  datumMm: number,
  project: WorldToDisplayProjector | null,
): void {
  const verts = line.vertices;
  if (verts.length < 2) return;
  const elevMm = line.level - datumMm;
  const count = line.closed ? verts.length : verts.length - 1;
  for (let i = 0; i < count; i++) {
    if (!projectVertex(verts[i]!, elevMm, project)) continue;
    const ax = SCRATCH[0]!, ay = SCRATCH[1]!, az = SCRATCH[2]!;
    if (!projectVertex(verts[(i + 1) % verts.length]!, elevMm, project)) continue;
    buf.push(ax, ay, az, SCRATCH[0]!, SCRATCH[1]!, SCRATCH[2]!);
  }
}

/** Build a LineSegments geometry from a flat XYZ-pair buffer, or `null` when empty. */
function toGeometry(buf: number[]): THREE.BufferGeometry | null {
  if (buf.length === 0) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(buf), 3));
  // Static line bounds → compute the bounding sphere once so three's native frustum culling can
  // skip an off-screen contour set deterministically (same reasoning as the DXF wireframe buckets).
  geo.computeBoundingSphere();
  return geo;
}

/**
 * Convert derived contour lines into major + minor line-segment geometries in three-world metres.
 * Both are `null` when there is nothing to draw (no lines, or all-degenerate coordinates).
 */
export function contourLinesToGeometries(
  lines: readonly ContourLine[],
  options?: ContourLineOptions,
): ContourLineGeometries {
  const datumMm = options?.datumMm ?? 0;
  const projector = options?.projector ?? null;
  const project = projector && !projector.isIdentity ? projector : null; // fast path when unset/identity

  const major: number[] = [];
  const minor: number[] = [];
  for (const line of lines) {
    appendContourSegments(line.isMajor ? major : minor, line, datumMm, project);
  }
  return { major: toGeometry(major), minor: toGeometry(minor) };
}
