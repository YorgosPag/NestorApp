/**
 * polyline-corner-vertices — «which vertices of this chain is a human actually asking about?»
 *
 * A vertex marker is only information while there are few enough of them to count. A breakline
 * candidate extracted from a TIN is a chain of TRIANGLE EDGES, so its vertex count is set by the
 * triangulation, not by the shape: a 12 m synthetic ridge carries 9 vertices, and a surveyed road
 * boundary carries 50–200. Drawing a dot on every one of them turns the marker into a solid band —
 * the emphasis stops reading as «this line» and starts reading as «this stipple», which is worse
 * than no markers at all. (The complaint is not hypothetical; it is the standing Civil 3D feature
 * line grievance — a dense 3D polyline shows a grip per vertex and the selection becomes unusable.)
 *
 * ### The rule, and why this one
 * A vertex is kept when the chain actually TURNS there — the angle between the incoming and the
 * outgoing direction exceeds a threshold — plus, for an open chain, both ENDS (they answer «how far
 * does this candidate reach?», which is the first question the reviewer has and the one no interior
 * marker can answer). Everything else is tessellation: three near-collinear TIN edges are one run of
 * the same feature, and marking their joints tells the engineer something about the mesh, not about
 * the ground.
 *
 * The turn is measured in **3D**, not in plan. A feature line climbs; a vertex where the grade
 * breaks while the plan direction holds straight is a real break — it is what Civil 3D calls an
 * elevation point, and its weeding command likewise weighs angle AND grade. Measuring in plan would
 * silently drop exactly the vertices a topographic review exists to look at.
 *
 * Camera-INDEPENDENT on purpose. Screen-space spacing («no two dots closer than N px») is the other
 * obvious rule and it is a better fit for a fixed 2D view — but it has to be recomputed per frame
 * from the camera, and this layer is deliberately click-driven (ADR-040: nothing here runs per
 * frame). A rule that reads the geometry answers the same question once, at build time, and cannot
 * make the scene expensive.
 *
 * Pure: numbers in, indices out. No THREE, no store, no scene.
 *
 * @module bim-3d/converters/polyline-corner-vertices
 * @enterprise ADR-650 — Topography · ADR-040 — canvas performance
 */

/**
 * Minimum turn (degrees) for an interior vertex to count as a corner.
 *
 * 25° is the point at which a direction change stops reading as «the same run, slightly curved» at
 * ordinary framing. Lower and a mildly meandering TIN chain lights up end to end (the noise this
 * module exists to remove); higher and a genuine dog-leg in a road edge goes unmarked.
 */
export const POLYLINE_CORNER_THRESHOLD_DEG = 25;

/**
 * Hard ceiling on INTERIOR corner markers, independent of the threshold.
 *
 * The angle rule is self-limiting on real survey data, but a genuinely jagged chain (a rocky
 * outcrop, a badly noised import) can be sharp at every vertex — and then the threshold, correctly
 * applied, still yields the stipple. Beyond a couple of dozen markers a reviewer no longer reads
 * individual vertices anyway, so past that point the honest thing is to show the MOST significant
 * ones (the sharpest turns) rather than all of them. The ends are never subject to this cap.
 */
export const POLYLINE_CORNER_LIMIT = 24;

export interface PolylineCornerOptions {
  /** Override {@link POLYLINE_CORNER_THRESHOLD_DEG} (degrees). */
  readonly thresholdDeg?: number;
  /** Override {@link POLYLINE_CORNER_LIMIT} (interior markers). */
  readonly limit?: number;
}

const RAD2DEG = 180 / Math.PI;

/** True when vertex `i` of the flat XYZ buffer is fully finite (a NaN dot would blank the scene). */
function isFiniteVertex(points: Float32Array, i: number): boolean {
  const o = i * 3;
  return Number.isFinite(points[o]) && Number.isFinite(points[o + 1]) && Number.isFinite(points[o + 2]);
}

/**
 * Turn angle at vertex `i` in degrees, or `null` when it cannot be measured (a non-finite
 * neighbour, or a zero-length step — a duplicated vertex has no direction, so it has no corner).
 */
function turnAngleDegAt(points: Float32Array, i: number, prev: number, next: number): number | null {
  if (!isFiniteVertex(points, prev) || !isFiniteVertex(points, i) || !isFiniteVertex(points, next)) {
    return null;
  }
  const o = i * 3, p = prev * 3, q = next * 3;
  const ax = points[o]! - points[p]!, ay = points[o + 1]! - points[p + 1]!, az = points[o + 2]! - points[p + 2]!;
  const bx = points[q]! - points[o]!, by = points[q + 1]! - points[o + 1]!, bz = points[q + 2]! - points[o + 2]!;
  const la = Math.hypot(ax, ay, az);
  const lb = Math.hypot(bx, by, bz);
  if (la === 0 || lb === 0) return null;
  const cos = (ax * bx + ay * by + az * bz) / (la * lb);
  return Math.acos(Math.min(1, Math.max(-1, cos))) * RAD2DEG;
}

/** The ends of an OPEN chain — always marked, never capped. Closed rings have none. */
function endpointIndices(count: number, closed: boolean, points: Float32Array): number[] {
  if (closed || count === 0) return [];
  const ends = count === 1 ? [0] : [0, count - 1];
  return ends.filter((i) => isFiniteVertex(points, i));
}

/**
 * Select the vertices of a polyline worth marking: both ends (open chains) plus every interior
 * vertex whose turn reaches the threshold, capped to the sharpest {@link POLYLINE_CORNER_LIMIT}.
 *
 * @param points flat `[x,y,z, …]`, ONE entry per vertex (NOT the segment-pair line layout)
 * @param closed the chain's last vertex joins its first (a pond rim, a plot boundary)
 * @returns vertex indices in PATH order — deterministic for identical input
 */
export function selectPolylineCornerIndices(
  points: Float32Array,
  closed: boolean,
  options?: PolylineCornerOptions,
): number[] {
  const count = Math.floor(points.length / 3);
  if (count === 0) return [];

  const thresholdDeg = options?.thresholdDeg ?? POLYLINE_CORNER_THRESHOLD_DEG;
  const limit = options?.limit ?? POLYLINE_CORNER_LIMIT;

  // An open chain's interior is [1, count-1); a ring has no ends, so every vertex is interior.
  const first = closed ? 0 : 1;
  const last = closed ? count : count - 1;
  const corners: { index: number; angle: number }[] = [];
  for (let i = first; i < last; i++) {
    const angle = turnAngleDegAt(points, i, (i - 1 + count) % count, (i + 1) % count);
    if (angle !== null && angle >= thresholdDeg) corners.push({ index: i, angle });
  }

  // Over the ceiling → keep the SHARPEST, tie-broken by index so the same input always yields the
  // same markers (a set that reshuffled between rebuilds would flicker as the engineer edits).
  const kept = corners.length <= limit
    ? corners
    : [...corners].sort((a, b) => b.angle - a.angle || a.index - b.index).slice(0, limit);

  return [...endpointIndices(count, closed, points), ...kept.map((c) => c.index)]
    .sort((a, b) => a - b);
}
