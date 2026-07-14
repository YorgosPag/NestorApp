/**
 * ADR-650 — steep UNCONSTRAINED TIN edges. The SSoT «where does the surface fold?».
 *
 * Extracted from the M5α QA check (`qa/check-missing-breaklines.ts`), which was its first and
 * only consumer; M8β/Γ needs the exact same measurement to build feature lines out of, and a
 * second dihedral-fold implementation is precisely the duplicate the ratchet exists to stop
 * (N.18). One measurement, two readers:
 *   - the QA check turns each edge into an advisory flag («should there be a breakline here?»),
 *   - the auto-breakline extractor chains them into candidate polylines.
 *
 * The fold is the dihedral angle between the normals of the two triangles sharing an edge
 * (0° = coplanar). Above the caller's threshold the surface breaks sharply — a road edge, a
 * ditch, a retaining wall — and if no breakline pins that edge, Delaunay is free to swing the
 * triangulation across the break and round off the very feature that matters (ADR-650 §5).
 * Edges already pinned by a breakline are dropped: they are EXPECTED, not findings.
 *
 * Headless 3D by design: normals come from LOCAL positions + world elevations, so the
 * topography subsystem stays THREE-free. `radToDeg` is the shared angle SSoT.
 */

import type { TinSurface, Breakline, LocalOrigin } from '../topo-types';
import { buildEdgeFaces, buildBreaklineEdgeKeys, edgeKey, type EdgeFaces } from '../qa/topo-qa-topology';
import { radToDeg } from '../../../rendering/entities/shared/geometry-angle-utils';

type Vec3 = readonly [number, number, number];

/** One interior TIN edge that folds sharply and carries no breakline constraint. */
export interface SteepEdge {
  /** TIN vertex index (the lower of the pair — `edgeKey` order). */
  readonly a: number;
  /** TIN vertex index (the higher of the pair). */
  readonly b: number;
  /** Dihedral fold across the edge, in degrees (0 = coplanar). */
  readonly foldDeg: number;
}

/** Unit normal of triangle `tri` from LOCAL x,y + world Z (zero vector for a degenerate face). */
function triangleNormal(surface: TinSurface, tri: number): Vec3 {
  const [i, j, k] = surface.triangles[tri]!;
  const a: Vec3 = [surface.positions[i]![0], surface.positions[i]![1], surface.elevations[i]!];
  const b: Vec3 = [surface.positions[j]![0], surface.positions[j]![1], surface.elevations[j]!];
  const c: Vec3 = [surface.positions[k]![0], surface.positions[k]![1], surface.elevations[k]!];
  const u: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const v: Vec3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n: Vec3 = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const mag = Math.hypot(n[0], n[1], n[2]);
  return mag === 0 ? [0, 0, 0] : [n[0] / mag, n[1] / mag, n[2] / mag];
}

/** Dihedral fold across an edge in degrees (0 = coplanar), from its two face normals. */
function foldDeg(surface: TinSurface, edge: EdgeFaces): number {
  const n1 = triangleNormal(surface, edge.faces[0]);
  const n2 = triangleNormal(surface, edge.faces[1]);
  const dot = Math.max(-1, Math.min(1, n1[0] * n2[0] + n1[1] * n2[1] + n1[2] * n2[2]));
  return radToDeg(Math.acos(dot));
}

/**
 * Every interior edge folding at least `minFoldDeg` that NO breakline already constrains,
 * steepest first. Empty for a surface with no triangles.
 */
export function findSteepUnconstrainedEdges(
  surface: TinSurface,
  breaklines: readonly Breakline[],
  origin: LocalOrigin,
  minFoldDeg: number,
): readonly SteepEdge[] {
  if (surface.triangles.length === 0) return [];
  const constrained = buildBreaklineEdgeKeys(surface, breaklines, origin);

  return buildEdgeFaces(surface)
    .filter((e) => !constrained.has(edgeKey(e.a, e.b)))
    .map((e) => ({ a: e.a, b: e.b, foldDeg: foldDeg(surface, e) }))
    .filter((e) => e.foldDeg >= minFoldDeg)
    .sort((x, y) => y.foldDeg - x.foldDeg);
}
