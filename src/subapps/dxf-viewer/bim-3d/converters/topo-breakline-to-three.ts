/**
 * ADR-920 Β4.8 Β2.3 — «these committed breaklines, as three-world fat-line segments», once.
 *
 * Pure: breaklines (WORLD mm, real z) + the SAME projector / datum / crop ring the terrain mesh is built
 * from → segment-pair buffers GROUPED BY LINE PATTERN (one fat-line mesh per pattern, ≤ 3) + the vertex
 * positions for the discs. The impure layer resolves the inputs and owns the level cut.
 *
 * ### Why the real z, not the ground's
 * A breakline is a CONSTRAINT on the TIN, so on a sound survey it lies exactly on a triangle edge and the
 * two are the same height. Where two breaklines cross at different z (`breaklineConflicts`), the TIN had
 * to pick one — and drawing each at its OWN z is what makes that contradiction visible in 3D instead of
 * draping it away. Civil 3D draws the source 3D polyline the same way.
 *
 * ### Crop
 * `getTopoSurface()` clips the TIN to the active crop ring, so a breakline running past it would hang
 * over nothing. Each segment keeps only the stretches INSIDE the ring (`coveredIntervals`, the repo's one
 * segment-vs-polygon coverage), its z interpolated linearly along the stretch — the constraint edge IS a
 * straight 3D segment. A vertex disc is kept only when its vertex is inside.
 *
 * Every SEGMENT is emitted on its own (no runs): the screen-px dash restarts per segment anyway
 * (`scene-fat-line-screen-dash`), so a polyline has nothing to gain from staying joined.
 *
 * @module bim-3d/converters/topo-breakline-to-three
 */

import type { Breakline, TopoPoint3D } from '../../systems/topography/topo-types';
import type { Point2D } from '../../rendering/types/Types';
import type { WorldToDisplayProjector } from '../../systems/geo-referencing/geo-transform';
import {
  breaklineDashPattern,
  breaklinePatternKey,
  type BreaklineDashPattern,
} from '../../systems/topography/topo-breakline-style';
import { coveredIntervals } from '../../bim/geometry/shared/segment-polygon-coverage';
import { pointInPolygon } from '../../bim/geometry/shared/polygon-utils';
import {
  activeProjector,
  appendProjectedPolylineSegments,
  projectTopoPolylineVertices,
} from './topo-polyline-to-three';

export interface TopoBreaklineConvertOptions {
  /** Active WORLD (ΕΓΣΑ) → building-DISPLAY projector — the terrain mesh's (§M10f). Omitted/identity → world. */
  readonly projector?: WorldToDisplayProjector | null;
  /** Project vertical datum (WORLD mm), subtracted from every elevation — the terrain mesh's. */
  readonly datumMm?: number;
  /** The active crop ring (WORLD mm), or `null` when the surface is not cropped. */
  readonly cropRing?: readonly Point2D[] | null;
}

/** One fat-line mesh worth of segments: every breakline that shares a pattern. */
export interface TopoBreaklinePatternGroup {
  /** `null` = solid. */
  readonly pattern: BreaklineDashPattern | null;
  /** Flat `[x,y,z, x,y,z, …]` segment pairs, three-world metres. */
  readonly positions: Float32Array;
}

export interface TopoBreaklineGeometries {
  readonly groups: readonly TopoBreaklinePatternGroup[];
  /** One XYZ per kept vertex, for the discs; `null` when none survive. */
  readonly vertices: Float32Array | null;
}

/** A segment of the polyline, as its two 3D ends. `closed` adds last → first. */
function polylineSegments(vertices: readonly TopoPoint3D[], closed: boolean): [TopoPoint3D, TopoPoint3D][] {
  const count = closed && vertices.length > 2 ? vertices.length : vertices.length - 1;
  const out: [TopoPoint3D, TopoPoint3D][] = [];
  for (let i = 0; i < count; i++) out.push([vertices[i]!, vertices[(i + 1) % vertices.length]!]);
  return out;
}

const lerp3 = (a: TopoPoint3D, b: TopoPoint3D, t: number): TopoPoint3D => ({
  x: a.x + t * (b.x - a.x),
  y: a.y + t * (b.y - a.y),
  z: a.z + t * (b.z - a.z),
});

/** The stretches of `a→b` inside the ring (z interpolated), or the whole segment when uncropped. */
function keptStretches(a: TopoPoint3D, b: TopoPoint3D, ring: readonly Point2D[] | null): [TopoPoint3D, TopoPoint3D][] {
  if (!ring) return [[a, b]];
  return coveredIntervals(a, b, ring).map(([t0, t1]) => [lerp3(a, b, t0), lerp3(a, b, t1)]);
}

/** Project segment ends (pairs) once and append the finite ones to `buf`. */
function appendSegmentPairs(
  buf: number[],
  pairs: readonly [TopoPoint3D, TopoPoint3D][],
  datumMm: number,
  project: WorldToDisplayProjector | null,
): void {
  const ends = pairs.flat();
  const points = projectTopoPolylineVertices(ends, (i) => ends[i]!.z - datumMm, project);
  for (let k = 0; k < pairs.length; k++) {
    // An open two-vertex polyline = exactly this segment; a non-finite end drops it (ADR-537).
    appendProjectedPolylineSegments(buf, points.subarray(k * 6, k * 6 + 6), false);
  }
}

/** Vertex disc positions — only vertices inside the crop ring, only finite projections. */
function collectVertices(
  breaklines: readonly Breakline[],
  ring: readonly Point2D[] | null,
  datumMm: number,
  project: WorldToDisplayProjector | null,
): Float32Array | null {
  const kept = breaklines.flatMap((b) => b.vertices).filter((v) => !ring || pointInPolygon(v, ring));
  const points = projectTopoPolylineVertices(kept, (i) => kept[i]!.z - datumMm, project);
  const finite = Array.from({ length: kept.length }, (_, i) => i)
    .filter((i) => Number.isFinite(points[i * 3]) && Number.isFinite(points[i * 3 + 1]) && Number.isFinite(points[i * 3 + 2]));
  if (finite.length === 0) return null;
  const out = new Float32Array(finite.length * 3);
  finite.forEach((i, slot) => out.set(points.subarray(i * 3, i * 3 + 3), slot * 3));
  return out;
}

export function topoBreaklinesToGeometries(
  breaklines: readonly Breakline[],
  options?: TopoBreaklineConvertOptions,
): TopoBreaklineGeometries {
  const datumMm = options?.datumMm ?? 0;
  const ring = options?.cropRing && options.cropRing.length >= 3 ? options.cropRing : null;
  const project = activeProjector(options?.projector);

  const byPattern = new Map<string, { pattern: BreaklineDashPattern | null; buf: number[] }>();
  for (const breakline of breaklines) {
    const pattern = breaklineDashPattern(breakline.elevationSource);
    const key = breaklinePatternKey(pattern);
    const group = byPattern.get(key) ?? { pattern, buf: [] };
    byPattern.set(key, group);
    const pairs = polylineSegments(breakline.vertices, breakline.closed ?? false)
      .flatMap(([a, b]) => keptStretches(a, b, ring));
    appendSegmentPairs(group.buf, pairs, datumMm, project);
  }

  return {
    groups: [...byPattern.values()]
      .filter((g) => g.buf.length > 0)
      .map((g) => ({ pattern: g.pattern, positions: new Float32Array(g.buf) })),
    vertices: collectVertices(breaklines, ring, datumMm, project),
  };
}
