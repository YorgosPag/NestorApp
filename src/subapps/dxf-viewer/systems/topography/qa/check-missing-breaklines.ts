/**
 * ADR-650 M5α — suspected missing breaklines (unconstrained steep TIN edges).
 *
 * Where the surface folds sharply — a road edge, a ditch, a retaining wall — the TIN should
 * be pinned by a breakline, or Delaunay will swing the triangulation across the break and
 * round off the very feature that matters (ADR-650 §5). This check measures the dihedral
 * fold across every interior edge (angle between its two triangle normals) and flags the
 * steep ones that carry NO breakline constraint — the surveyor's cue «should there be a
 * breakline here?». Advisory by nature (a hint, not an error), so it tops out at `medium`.
 *
 * Headless 3D: a triangle normal from LOCAL positions + elevations (the topography subsystem
 * stays THREE-free); `radToDeg` is the shared angle SSoT.
 */

import type { TinSurface, Breakline, LocalOrigin } from '../topo-types';
import type { TopoQaFlag, TopoQaSeverity } from './topo-qa-types';
import { TOPO_QA_CONFIG } from './topo-qa-config';
import { buildEdgeFaces, buildBreaklineEdgeKeys, edgeKey, type EdgeFaces } from './topo-qa-topology';
import { radToDeg } from '../../../rendering/entities/shared/geometry-angle-utils';

type Vec3 = readonly [number, number, number];

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

/** WORLD midpoint of an edge (marker + zoom-to). */
function edgeMidWorld(surface: TinSurface, edge: EdgeFaces): { x: number; y: number } {
  const pa = surface.positions[edge.a]!; const pb = surface.positions[edge.b]!;
  return { x: (pa[0] + pb[0]) / 2 + surface.origin.x, y: (pa[1] + pb[1]) / 2 + surface.origin.y };
}

/** Steep UNCONSTRAINED edges as flags, steepest first (per-kind cap applied by the orchestrator). */
export function checkMissingBreaklines(
  surface: TinSurface,
  breaklines: readonly Breakline[],
  origin: LocalOrigin,
): TopoQaFlag[] {
  if (surface.triangles.length === 0) return [];
  const constrained = buildBreaklineEdgeKeys(surface, breaklines, origin);
  const { MISSING_BREAKLINE_ANGLE_DEG, MISSING_BREAKLINE_HIGH_ANGLE_DEG } = TOPO_QA_CONFIG;

  return buildEdgeFaces(surface)
    .filter((e) => !constrained.has(edgeKey(e.a, e.b)))
    .map((e) => ({ edge: e, angle: foldDeg(surface, e) }))
    .filter((x) => x.angle >= MISSING_BREAKLINE_ANGLE_DEG)
    .sort((a, b) => b.angle - a.angle)
    .map(({ edge, angle }) => {
      const severity: TopoQaSeverity = angle >= MISSING_BREAKLINE_HIGH_ANGLE_DEG ? 'medium' : 'low';
      return {
        id: `missing-breakline:${edgeKey(edge.a, edge.b)}`,
        kind: 'missing-breakline' as const,
        severity,
        at: edgeMidWorld(surface, edge),
        messageKey: 'topography.qa.flag.missingBreakline',
        messageParams: { angle: angle.toFixed(0) },
      };
    });
}
