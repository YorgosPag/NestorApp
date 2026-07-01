/**
 * ADR-363 Phase 1D-B/C — Wall↔wall junction cleanup.
 *
 * Phase 1D-B (axis-bevel, T-junctions):
 *   Computes `startBevel`/`endBevel` patches so axis endpoints are shortened
 *   enough to eliminate rectangular overlaps at T-junctions and 90° corners.
 *
 * Phase 1D-C (geometric miter, corner junctions):
 *   For corner junctions (both endpoints meet) computes the exact outer/inner
 *   miter points by intersecting the two walls' edge lines. The miter points
 *   replace the end-cap vertices of each wall's outerEdge/innerEdge, eliminating
 *   the triangular gap that the axis-bevel approach leaves at oblique angles.
 *
 *   Revit/AutoCAD Architecture parity: "Miter" join type — exterior faces and
 *   interior faces converge at their geometric intersection, zero gap.
 *
 * Algorithm (per pair):
 *   1. Parametric axis-axis infinite-line intersection (t, u).
 *   2. Classify: corner (both endpoints near) → miter; T-junction (one interior)
 *      → bevel stem; cross (both interior) → skip.
 *   3. Corner miter: intersect outer edge lines → outer miter pt; intersect inner
 *      edge lines → inner miter pt. Fall back to bevel if either extension exceeds
 *      MAX_BEVEL_FRACTION (wall too short/thick for clean miter).
 *   4. Accumulate: corners → recorded for holistic pass-2 cluster resolution
 *      (`resolveCornerClusters`); T-junctions → max bevel per endpoint.
 *
 * The pass-2 corner-cluster resolution (2-way miter / square-off, 3+-way Revit
 * multi-wall join) and the endpoint/accumulator primitives live in the companion
 * `wall-trims-corner-resolve.ts` module (N.7.1 file-size split).
 *
 * Only `kind === 'straight'` walls processed; curved/polyline land later.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §6 Phase 1D-C
 */

import type { WallEntity, WallParams } from '../types/wall-types';
import type { AnySceneEntity } from '../../types/entities';
import { computeWallGeometry } from '../geometry/wall-geometry';
import { mmToSceneUnits } from '../../utils/scene-units';
import {
  lineLineIntersect,
  sinAngleBetween,
  type MiterPt,
} from './wall-trims-geometry';
import {
  MIN_CORNER_MITER_ANGLE_RAD,
  accumBevel,
  endpointKey,
  penetrationBevel,
  resolveCornerClusters,
  type EndpointRec,
  type MutablePatch,
} from './wall-trims-corner-resolve';

// `MiterPt` lives in the geometry module (N.7.1 split) — re-exported so existing
// `WallTrimPatch` consumers keep a single import surface.
export type { MiterPt } from './wall-trims-geometry';

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Physical distance (mm) within which an axis endpoint is "touching" the intersection.
 * Exported as the SSoT junction-detection tolerance (reused by `opening-junction-refs`
 * to find the transverse wall at an opening's host-wall end — ADR-363 Φ1G.5 Slice 2f).
 */
export const JOIN_THRESHOLD_MM = 200;

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Per-wall trim patch returned by `computeWallTrims`.
 *
 * `startMiter`/`endMiter` (Phase 1D-C) — corner junctions.
 *   When present, `computeWallGeometry` replaces the first/last edge points of
 *   outerEdge/innerEdge with the exact miter intersection points. Supersedes the
 *   bevel approach for corners.
 *
 * `startBevel`/`endBevel` (Phase 1D-B) — T-junction stem endpoints only.
 *   Canvas world units (same space as params.start/end).
 */
export interface WallTrimPatch {
  readonly startMiter?: MiterPt;
  readonly endMiter?: MiterPt;
  readonly startBevel?: number;
  readonly endBevel?: number;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Compute junction cleanup patches for all wall pairs in `walls`.
 *
 * Idempotent: calling with the same input always returns the same patches.
 * Returns a Map keyed by wallId; walls with no trim are NOT included.
 */
export function computeWallTrims(walls: readonly WallEntity[]): Map<string, WallTrimPatch> {
  const acc = new Map<string, MutablePatch>();

  // Pass 1 (pairwise): T-junctions resolve immediately (bevel the stem); corner
  // pairs are NOT mitred yet — they are recorded so a multi-wall junction (3+ ends
  // at one point) can be resolved holistically in pass 2. Resolving corners
  // pairwise with "last wins" was the bug: a thin partition joining a clean 2-wall
  // corner overwrote the good miter, producing triangular caps + penetration.
  const endpointRecs = new Map<string, EndpointRec>();
  const cornerRels: Array<{ aKey: string; bKey: string }> = [];
  for (let i = 0; i < walls.length; i++) {
    for (let j = i + 1; j < walls.length; j++) {
      classifyPair(walls[i], walls[j], acc, endpointRecs, cornerRels);
    }
  }

  // Pass 2: cluster coincident corner endpoints and resolve each junction once.
  resolveCornerClusters(endpointRecs, cornerRels, acc);

  const result = new Map<string, WallTrimPatch>();
  for (const [id, patch] of acc) {
    if (
      patch.startMiter !== undefined || patch.endMiter !== undefined ||
      patch.startBevel !== undefined || patch.endBevel !== undefined
    ) {
      result.set(id, patch);
    }
  }
  return result;
}

/**
 * Apply trim patches to an entity array: returns a new array with patched wall
 * `params` and recomputed `geometry`. Non-wall entities pass through unchanged.
 * Idempotent — applying twice yields the same result.
 */
export function applyTrimPatches(
  entities: readonly AnySceneEntity[],
  trims: Map<string, WallTrimPatch>,
): AnySceneEntity[] {
  if (trims.size === 0) return [...entities];

  return entities.map((entity): AnySceneEntity => {
    if (entity.type !== 'wall') return entity;
    const patch = trims.get(entity.id);
    if (!patch) return entity;

    const wall = entity as WallEntity;
    const newParams: WallParams = {
      ...wall.params,
      ...(patch.startMiter !== undefined ? { startMiter: patch.startMiter } : {}),
      ...(patch.endMiter   !== undefined ? { endMiter:   patch.endMiter   } : {}),
      ...(patch.startBevel !== undefined ? { startBevel: patch.startBevel } : {}),
      ...(patch.endBevel   !== undefined ? { endBevel:   patch.endBevel   } : {}),
    };

    return {
      ...wall,
      params: newParams,
      geometry: computeWallGeometry(newParams, wall.kind),
    } as WallEntity;
  });
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Classify one wall pair (A, B). T-junctions (one endpoint hits the other's
 * interior) bevel the stem immediately. Corner junctions (both endpoints meet)
 * are NOT mitred here — they are recorded so `resolveCornerClusters` can resolve
 * the whole junction (which may involve 3+ walls) consistently.
 * Only `kind === 'straight'` walls are processed.
 */
function classifyPair(
  a: WallEntity,
  b: WallEntity,
  acc: Map<string, MutablePatch>,
  endpointRecs: Map<string, EndpointRec>,
  cornerRels: Array<{ aKey: string; bKey: string }>,
): void {
  if (a.kind !== 'straight' || b.kind !== 'straight') return;

  const a1x = a.params.start.x, a1y = a.params.start.y;
  const a2x = a.params.end.x,   a2y = a.params.end.y;
  const b1x = b.params.start.x, b1y = b.params.start.y;
  const b2x = b.params.end.x,   b2y = b.params.end.y;

  const lenA = Math.hypot(a2x - a1x, a2y - a1y);
  const lenB = Math.hypot(b2x - b1x, b2y - b1y);
  // Canvas world unit scalars (mm → scene units). Computed up-front because the
  // degenerate-wall guard below must use a 1mm minimum EXPRESSED IN SCENE UNITS,
  // not a hardcoded "1". In a metres-scene drawing "1" means 1 METRE, which wrongly
  // skipped every sub-metre wall → those walls never got junction-trimmed and
  // overshot into their neighbours (the region-fill overshoot bug). ADR-363 Phase 1L.
  const sA = mmToSceneUnits(a.params.sceneUnits ?? 'mm');
  const sB = mmToSceneUnits(b.params.sceneUnits ?? 'mm');
  if (lenA < sA || lenB < sB) return;

  const isect = lineLineIntersect(a1x, a1y, a2x, a2y, b1x, b1y, b2x, b2y);
  if (!isect) return;

  const { t, u } = isect;

  const dax = a2x - a1x, day = a2y - a1y;
  const dbx = b2x - b1x, dby = b2y - b1y;
  const sinA = sinAngleBetween(dax, day, dbx, dby);
  // ADR-363 §wall-acute-miter (Step 1) — classify down to a truly-parallel sliver so
  // acute corners (5–14°) are recorded & mitred instead of skipped as raw overlap.
  if (sinA < Math.sin(MIN_CORNER_MITER_ANGLE_RAD)) return;

  const halfA = (a.params.thickness / 2) * sA;
  const halfB = (b.params.thickness / 2) * sB;
  const joinThreshold = JOIN_THRESHOLD_MM * sA; // uniform scale assumed
  const epsA = joinThreshold / lenA;
  const epsB = joinThreshold / lenB;

  const tNearStart = t >= -epsA && t <= epsA;
  const tNearEnd   = t >= 1 - epsA && t <= 1 + epsA;
  const tInterior  = t > epsA && t < 1 - epsA;

  const uNearStart = u >= -epsB && u <= epsB;
  const uNearEnd   = u >= 1 - epsB && u <= 1 + epsB;
  const uInterior  = u > epsB && u < 1 - epsB;

  if ((tNearStart || tNearEnd) && (uNearStart || uNearEnd)) {
    // ── Corner junction: record both endpoints; resolve in pass 2 ─────────────
    const aWhich: 'start' | 'end' = tNearStart ? 'start' : 'end';
    const bWhich: 'start' | 'end' = uNearStart ? 'start' : 'end';
    const aKey = endpointKey(a.id, aWhich);
    const bKey = endpointKey(b.id, bWhich);
    if (!endpointRecs.has(aKey)) {
      endpointRecs.set(aKey, {
        wallId: a.id, which: aWhich,
        px: tNearStart ? a1x : a2x, py: tNearStart ? a1y : a2y,
        ux: dax / lenA, uy: day / lenA,
        halfSigned: (a.params.flip ? -1 : 1) * halfA, half: halfA, len: lenA,
        flip: !!a.params.flip,
        joinMode: (aWhich === 'start' ? a.params.startJoin : a.params.endJoin) ?? 'auto',
      });
    }
    if (!endpointRecs.has(bKey)) {
      endpointRecs.set(bKey, {
        wallId: b.id, which: bWhich,
        px: uNearStart ? b1x : b2x, py: uNearStart ? b1y : b2y,
        ux: dbx / lenB, uy: dby / lenB,
        halfSigned: (b.params.flip ? -1 : 1) * halfB, half: halfB, len: lenB,
        flip: !!b.params.flip,
        joinMode: (bWhich === 'start' ? b.params.startJoin : b.params.endJoin) ?? 'auto',
      });
    }
    cornerRels.push({ aKey, bKey });
  } else if (tInterior && (uNearStart || uNearEnd)) {
    // ── T-junction: A continues; trim only B's stem endpoint ─────────────────
    // Phase 1L: trim B back to A's near FACE by the amount it PENETRATES past it
    // (region-fill stem already on the face → 0; auto-joined to A's centreline →
    // halfA). Generalises the old fixed `halfA/sinA` (which assumed the centreline).
    // ADR-363 Phase 1L-J — `disallow` on the stem endpoint → no cleanup (stays rectangular).
    const bJoin = (uNearStart ? b.params.startJoin : b.params.endJoin) ?? 'auto';
    if (bJoin === 'disallow') return;
    const bEndX = uNearStart ? b1x : b2x, bEndY = uNearStart ? b1y : b2y;
    const bevelB = penetrationBevel(bEndX, bEndY, a1x, a1y, dax / lenA, day / lenA, halfA, sinA, lenB);
    if (bevelB > 0) accumBevel(acc, b.id, uNearStart ? 'start' : 'end', bevelB);
  } else if (uInterior && (tNearStart || tNearEnd)) {
    // ── T-junction: B continues; trim only A's stem endpoint ─────────────────
    // ADR-363 Phase 1L-J — `disallow` on the stem endpoint → no cleanup (stays rectangular).
    const aJoin = (tNearStart ? a.params.startJoin : a.params.endJoin) ?? 'auto';
    if (aJoin === 'disallow') return;
    const aEndX = tNearStart ? a1x : a2x, aEndY = tNearStart ? a1y : a2y;
    const bevelA = penetrationBevel(aEndX, aEndY, b1x, b1y, dbx / lenB, dby / lenB, halfB, sinA, lenA);
    if (bevelA > 0) accumBevel(acc, a.id, tNearStart ? 'start' : 'end', bevelA);
  }
  // Cross (both interior): skip Phase 1D-B/C.
}
