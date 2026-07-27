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
 * The three transforms that MUST happen exactly once, and happen in the shared packer
 * {@link appendTopoPolylineSegments} (mirror of `tin-to-three`):
 *   1. WORLD → building-DISPLAY  — `ContourLine.vertices` are already WORLD mm (unlike the TIN's
 *      LOCAL positions), so the projector applies directly.
 *   2. real WORLD Z − datum      — `z = level − datumMm`, the vertical mirror of the planar project.
 *   3. plan-mm → three world (m, Y-up) — via `writeDxfPlanToWorld`, the SAME convention the grips /
 *      ghosts / snap markers / terrain mesh use. Never re-inlined here.
 *
 * What is left in THIS module is the one thing a contour does differently from every other topo
 * polyline: its elevation is CONSTANT along the line (`level`), because a contour is by definition
 * the surface's intersection with a horizontal plane — the drape needs no per-vertex TIN sampling.
 *
 * @module bim-3d/converters/contour-to-three
 */

import type * as THREE from 'three';
import type { ContourLine } from '../../systems/topography/topo-types';
import type { WorldToDisplayProjector } from '../../systems/geo-referencing/geo-transform';
import {
  activeProjector,
  appendTopoPolylineSegments,
  toTopoLineGeometry,
} from './topo-polyline-to-three';

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

/** Append one contour line's segments (as consecutive XYZ pairs) into `buf`. */
function appendContourSegments(
  buf: number[],
  line: ContourLine,
  datumMm: number,
  project: WorldToDisplayProjector | null,
): void {
  const elevMm = line.level - datumMm; // constant along the whole line — that IS what a contour is
  appendTopoPolylineSegments(buf, line.vertices, () => elevMm, line.closed, project);
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
  const project = activeProjector(options?.projector);

  const major: number[] = [];
  const minor: number[] = [];
  for (const line of lines) {
    appendContourSegments(line.isMajor ? major : minor, line, datumMm, project);
  }
  return { major: toTopoLineGeometry(major), minor: toTopoLineGeometry(minor) };
}
