/**
 * ADR-650 Milestone 1 — TIN builder (Constrained Delaunay Triangulation).
 *
 * Big-player pattern (Civil 3D / CASS): the surface is a Constrained Delaunay TIN,
 * NOT plain Delaunay — a breakline segment is only guaranteed to survive as a triangle
 * edge under CDT (ADR-650 §5). The engine is Delaunator + Constrainautor (`tin-triangulate`,
 * ADR-920 Β4.8 Τ — it replaced `cdt2d`, ~×80 faster, same triangles wherever Delaunay is unique); the marching
 * step (contour-generator) runs over the triangles it returns.
 *
 * Flow: survey points + breakline vertices → dedup → LOCAL positions + parallel Z →
 * breaklines resolved into edges the triangulator can always honour (crossings get a node,
 * vertices on a breakline split it — `tin-breakline-resolve`) → triangulate → {@link TinSurface}.
 *
 * "False-flat" triangles (all three vertices at one Z) yield no contour crossing and are
 * counted for QA (the digitized-contour terrace trap, ADR-650 §5); with spot-point input
 * they are rare, and the contour generator additionally nudges levels off exact vertex Z.
 */

import type {
  TopoPoint,
  TopoPoint3D,
  Breakline,
  LocalOrigin,
  TinBuildReport,
  TinPosition,
  TinSurface,
  TinTriangle,
  TopoBounds,
} from './terrain-types';
import { computeLocalOrigin, ZERO_ORIGIN } from './topo-local-origin';
import { surfacePointsOf } from './topo-point-elevation';
import { createVertexAccumulator, planarBoundsOf, pushVertex, type CollectedVertices } from './tin-vertex-accumulator';
import { resolveBreaklines } from './tin-breakline-resolve';
import { triangulateConstrained } from './tin-triangulate';

export {
  localVertexKey,
  createVertexAccumulator,
  pushVertex,
  type CollectedVertices,
} from './tin-vertex-accumulator';

/**
 * Collect survey points + breakline vertices into deduped LOCAL positions + Z.
 *
 * Takes {@link TopoPoint3D}, not `TopoPoint`: by the time a vertex reaches the accumulator the
 * question «was this elevation measured?» must already be settled (ADR-720). `buildTin` settles
 * it, once, at the door.
 */
function collectVertices(
  points: readonly TopoPoint3D[],
  breaklines: readonly Breakline[],
  origin: LocalOrigin,
): { readonly acc: CollectedVertices; readonly surveyVertexCount: number } {
  const acc = createVertexAccumulator();
  for (const p of points) pushVertex(acc, p.x - origin.x, p.y - origin.y, p.z);
  // ADR-920 Β3.2 — survey first, so every index below this is a MEASURED Z (the resolver names no breakline for it).
  const surveyVertexCount = acc.positions.length;
  for (const bl of breaklines) {
    for (const v of bl.vertices) pushVertex(acc, v.x - origin.x, v.y - origin.y, v.z);
  }
  return { acc, surveyVertexCount };
}

/**
 * Local-frame planimetric bounds + world-frame vertical bounds. Exported for ADR-718: a cropped
 * surface has DIFFERENT bounds from the surveyed one, and stale bounds are not a cosmetic bug —
 * they drive camera fit and the ADR-635 culling window (ADR-537: one bad number blanks the 3D).
 */
export function computeBounds(positions: readonly TinPosition[], elevations: readonly number[]): TopoBounds {
  let minZ = Infinity, maxZ = -Infinity;
  for (const z of elevations) { if (z < minZ) minZ = z; if (z > maxZ) maxZ = z; }
  return { ...planarBoundsOf(positions), minZ, maxZ };
}

/** Count triangles whose three vertices share one elevation (false flats, §5). */
export function countFlatTriangles(
  triangles: ReadonlyArray<TinTriangle>,
  elevations: readonly number[],
): number {
  let count = 0;
  for (const [i, j, k] of triangles) {
    if (elevations[i] === elevations[j] && elevations[j] === elevations[k]) count++;
  }
  return count;
}

function surfaceOf(acc: CollectedVertices, triangles: TinTriangle[], origin: LocalOrigin): TinSurface {
  return {
    positions: acc.positions,
    elevations: acc.elevations,
    triangles,
    origin,
    bounds: computeBounds(acc.positions, acc.elevations),
    flatTriangleCount: countFlatTriangles(triangles, acc.elevations),
  };
}

/**
 * {@link buildTin} plus what it decided that the surface cannot show: the breakline elevation conflicts it resolved
 * and the constraint segments still refused (expected 0). QA and the owner's preview read this; everything else
 * calls `buildTin`. ONE implementation — `buildTin` is this, minus the report.
 */
export function buildTinWithReport(
  points: readonly TopoPoint[],
  breaklines: readonly Breakline[] = [],
  originArg?: LocalOrigin,
): TinBuildReport {
  const surfacePoints = surfacePointsOf(points);
  const origin = originArg ?? computeLocalOrigin(surfacePoints, breaklines);
  const { acc, surveyVertexCount } = collectVertices(surfacePoints, breaklines, origin);

  if (acc.positions.length < 3) {
    const surface = surfaceOf(acc, [], acc.positions.length ? origin : ZERO_ORIGIN);
    return { surface, breaklineConflicts: [], refusedSegmentCount: 0 };
  }

  const resolved = resolveBreaklines(breaklines, acc, origin, surveyVertexCount);
  const { triangles, refusedEdges } = triangulateConstrained(acc.positions, resolved.edges);
  return {
    surface: surfaceOf(acc, triangles, origin),
    breaklineConflicts: resolved.conflicts,
    refusedSegmentCount: refusedEdges.length,
  };
}

/**
 * Build a Constrained Delaunay {@link TinSurface} from survey points + breaklines.
 * Returns an empty surface (no triangles) when there are fewer than 3 distinct points.
 *
 * 🔴 **ADR-720 — this is THE elevation filter, and the only one.** Survey points without a
 * measured Ζ are dropped here, at the single door into the triangulation, so every derived
 * product — contours, 3D terrain, cut/fill volumes, the plan footprint, the cut cap, the
 * deliverable tables — excludes them **without a line changing in any of those eight consumers**.
 * That is the same reason the ADR-718 crop lives in `topo-surface` and not in its consumers.
 *
 * This is Carlson's «Non-Surface» point and Civil 3D's elevation-less COGO point, with one
 * difference in our favour: they need the shot to be tagged by hand or discovered at rebuild
 * time, whereas the absence of Ζ **is** the tag, so nothing can be forgotten.
 *
 * The origin is computed from the FILTERED set for the same reason the rest of the geometry is:
 * it exists to shrink the magnitudes actually being triangulated (ADR-635), and a planimetric
 * point that contributes no vertex should not move the frame the vertices live in.
 */
export function buildTin(
  points: readonly TopoPoint[],
  breaklines: readonly Breakline[] = [],
  originArg?: LocalOrigin,
): TinSurface {
  return buildTinWithReport(points, breaklines, originArg).surface;
}
