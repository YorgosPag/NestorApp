/**
 * Railing 2Δ plan symbol SSoT (ADR-407).
 *
 * Single source of truth for the *vector* plan symbol of a railing, shared by the
 * 2Δ renderer and the placement ghost. Pure + geometry-driven: it reads the
 * already-computed `RailingGeometry` (so it is rotation/host aware for free) and
 * emits the path centreline plus the plan footprints of posts (rotated squares /
 * circles) and balusters (small dots) — the architectural convention for a railing
 * in plan.
 *
 * All coordinates are world canvas units (same space as the path), so the renderer
 * just strokes them after applying its transform.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-407-bim-railings.md
 */

import type { Point3D } from '../types/bim-base';
import type {
  RailingGeometry,
  RailingParams,
  RailMemberSolid,
  RailProfile,
} from '../types/railing-types';
import { mmToSceneUnits } from '../../utils/scene-units';

const DEG_TO_RAD = Math.PI / 180;
const CIRCLE_MARK_SEGMENTS = 12;

export interface RailingSymbolGeometry {
  /** The path centreline polyline (canvas units). */
  readonly pathStroke: readonly Point3D[];
  /** Closed plan outlines of the posts (rotated squares / circles). */
  readonly postMarks: readonly (readonly Point3D[])[];
  /** Plan centres of the balusters (rendered as dots). */
  readonly balusterMarks: readonly Point3D[];
}

/** Plan outline of a single member footprint at its base point (canvas units). */
function memberOutline(member: RailMemberSolid, s: number): readonly Point3D[] {
  const { basePoint: c, profile } = member;
  const z = c.z ?? 0;
  if (profile.shape === 'round') {
    const r = (profile.widthMm * s) / 2;
    const out: Point3D[] = [];
    for (let i = 0; i < CIRCLE_MARK_SEGMENTS; i++) {
      const a = (i / CIRCLE_MARK_SEGMENTS) * 2 * Math.PI;
      out.push({ x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a), z });
    }
    return out;
  }
  const hw = (profile.widthMm * s) / 2;
  const hl = (profile.heightMm * s) / 2;
  const cos = Math.cos(member.rotationDeg * DEG_TO_RAD);
  const sin = Math.sin(member.rotationDeg * DEG_TO_RAD);
  const corners: ReadonlyArray<readonly [number, number]> = [
    [-hl, -hw], [hl, -hw], [hl, hw], [-hl, hw],
  ];
  return corners.map(([lx, ly]) => ({
    x: c.x + lx * cos - ly * sin,
    y: c.y + lx * sin + ly * cos,
    z,
  }));
}

/**
 * Build the railing plan symbol from params + computed geometry.
 *   - `pathStroke` → the railing centreline.
 *   - `postMarks` → one closed outline per post (square or circle in plan).
 *   - `balusterMarks` → one dot per baluster.
 */
export function buildRailingSymbol(
  params: RailingParams,
  geometry: RailingGeometry,
): RailingSymbolGeometry {
  const s = mmToSceneUnits(params.sceneUnits ?? 'mm');
  return {
    pathStroke: geometry.resolvedPath,
    postMarks: geometry.posts.map((p) => memberOutline(p, s)),
    balusterMarks: geometry.balusters.map((b) => ({ ...b.basePoint })),
  };
}

/** Profile used by the renderer to size baluster dots (mm → caller scales). */
export function balusterDotRadiusMm(profile: RailProfile): number {
  return Math.max(1, profile.widthMm / 2);
}
