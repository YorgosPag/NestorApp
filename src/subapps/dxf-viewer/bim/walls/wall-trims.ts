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
 *   4. Accumulate: corners → miter map (last wins per endpoint); T-junctions →
 *      max bevel per endpoint.
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
  cornerMiter,
  MAX_BEVEL_FRACTION,
  type MiterPt,
} from './wall-trims-geometry';

// `MiterPt` lives in the geometry module (N.7.1 split) — re-exported so existing
// `WallTrimPatch` consumers keep a single import surface.
export type { MiterPt } from './wall-trims-geometry';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Physical distance (mm) within which an axis endpoint is "touching" the intersection. */
const JOIN_THRESHOLD_MM = 200;

/** Angle below which axes are treated as parallel → no trim. */
const MIN_ANGLE_RAD = Math.PI / 12; // 15°

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

// ─── Accumulator (mutable, scoped to computeWallTrims call) ──────────────────

type MutablePatch = {
  startMiter?: MiterPt;
  endMiter?: MiterPt;
  startBevel?: number;
  endBevel?: number;
};

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

function setPatchField(acc: Map<string, MutablePatch>, id: string, field: keyof MutablePatch, value: number | MiterPt): void {
  const prev = acc.get(id) ?? {};
  acc.set(id, { ...prev, [field]: value });
}

/**
 * One wall endpoint participating in a corner junction (canvas world units).
 * `ux/uy` is the axis unit vector (start→end) regardless of which end this is;
 * `which` says whether the junction sits at the wall's start or end.
 */
interface EndpointRec {
  readonly wallId: string;
  readonly which: 'start' | 'end';
  readonly px: number;
  readonly py: number;
  readonly ux: number;
  readonly uy: number;
  /** Signed half-thickness (sign = flip ? -1 : 1), canvas units. */
  readonly halfSigned: number;
  /** Unsigned half-thickness, canvas units. */
  readonly half: number;
  readonly len: number;
  readonly flip: boolean;
}

function endpointKey(wallId: string, which: 'start' | 'end'): string {
  return `${wallId}:${which}`;
}

/** Accumulate a bevel patch for one wall endpoint (max with any existing). */
function accumBevel(
  acc: Map<string, MutablePatch>,
  wallId: string,
  which: 'start' | 'end',
  value: number,
): void {
  const prev = acc.get(wallId) ?? {};
  const field = which === 'start' ? 'startBevel' : 'endBevel';
  acc.set(wallId, { ...prev, [field]: Math.max(prev[field] ?? 0, value) });
}

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
  if (lenA < 1 || lenB < 1) return;

  const isect = lineLineIntersect(a1x, a1y, a2x, a2y, b1x, b1y, b2x, b2y);
  if (!isect) return;

  const { t, u } = isect;

  const dax = a2x - a1x, day = a2y - a1y;
  const dbx = b2x - b1x, dby = b2y - b1y;
  const sinA = sinAngleBetween(dax, day, dbx, dby);
  if (sinA < Math.sin(MIN_ANGLE_RAD)) return;

  // Canvas world unit scalars
  const sA = mmToSceneUnits(a.params.sceneUnits ?? 'mm');
  const sB = mmToSceneUnits(b.params.sceneUnits ?? 'mm');
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
      });
    }
    if (!endpointRecs.has(bKey)) {
      endpointRecs.set(bKey, {
        wallId: b.id, which: bWhich,
        px: uNearStart ? b1x : b2x, py: uNearStart ? b1y : b2y,
        ux: dbx / lenB, uy: dby / lenB,
        halfSigned: (b.params.flip ? -1 : 1) * halfB, half: halfB, len: lenB,
        flip: !!b.params.flip,
      });
    }
    cornerRels.push({ aKey, bKey });
  } else if (tInterior && (uNearStart || uNearEnd)) {
    // ── T-junction: A continues; trim only B's stem endpoint ─────────────────
    const bevelB = Math.min(halfA / sinA, MAX_BEVEL_FRACTION * lenB);
    accumBevel(acc, b.id, uNearStart ? 'start' : 'end', bevelB);
  } else if (uInterior && (tNearStart || tNearEnd)) {
    // ── T-junction: B continues; trim only A's stem endpoint ─────────────────
    const bevelA = Math.min(halfB / sinA, MAX_BEVEL_FRACTION * lenA);
    accumBevel(acc, a.id, tNearStart ? 'start' : 'end', bevelA);
  }
  // Cross (both interior): skip Phase 1D-B/C.
}

/**
 * `swap` flag for `cornerMiter` (see its doc): inconsistent corners (start+start
 * or end+end) need the outer↔inner pairing, toggled back by an odd flip count.
 */
function cornerSwap(a: EndpointRec, b: EndpointRec): boolean {
  const baseSwap = (a.which === 'start') === (b.which === 'start');
  const flipsDiffer = a.flip !== b.flip;
  return baseSwap !== flipsDiffer;
}

/** Direction the wall body extends AWAY from the junction (unit). */
function outwardDir(e: EndpointRec): { x: number; y: number } {
  return e.which === 'start' ? { x: e.ux, y: e.uy } : { x: -e.ux, y: -e.uy };
}

/**
 * Pass 2 — group coincident corner endpoints into junctions and resolve each
 * once. 2-end junctions are a plain corner (geometric miter, unchanged). 3+-end
 * junctions are Revit-style: the two "primary" walls (thickest, tie-broken by
 * collinearity) join each other; every other wall BUTTS (bevels) against them —
 * so a thin partition can no longer overwrite a thick wall's miter.
 */
function resolveCornerClusters(
  endpointRecs: Map<string, EndpointRec>,
  cornerRels: ReadonlyArray<{ aKey: string; bKey: string }>,
  acc: Map<string, MutablePatch>,
): void {
  // Union-find over endpoint keys connected by corner relations.
  const parent = new Map<string, string>();
  for (const key of endpointRecs.keys()) parent.set(key, key);
  const find = (k: string): string => {
    let root = k;
    while (parent.get(root) !== root) root = parent.get(root)!;
    while (parent.get(k) !== root) {
      const next = parent.get(k)!;
      parent.set(k, root);
      k = next;
    }
    return root;
  };
  for (const { aKey, bKey } of cornerRels) {
    const ra = find(aKey), rb = find(bKey);
    if (ra !== rb) parent.set(ra, rb);
  }

  const clusters = new Map<string, EndpointRec[]>();
  for (const [key, rec] of endpointRecs) {
    const root = find(key);
    const group = clusters.get(root);
    if (group) group.push(rec);
    else clusters.set(root, [rec]);
  }

  for (const group of clusters.values()) {
    if (group.length === 2) {
      resolveTwoWayCorner(group[0]!, group[1]!, acc);
    } else if (group.length >= 3) {
      resolveMultiWayCorner(group, acc);
    }
    // length 1: an endpoint whose only corner partner was deduped away — no trim.
  }
}

/**
 * Two walls meeting at a corner: geometric miter, falling back to mutual
 * axis-bevel when the miter overflows. Byte-for-byte the pre-refactor behaviour.
 */
function resolveTwoWayCorner(a: EndpointRec, b: EndpointRec, acc: Map<string, MutablePatch>): void {
  const sinA = sinAngleBetween(a.ux, a.uy, b.ux, b.uy);
  if (sinA < Math.sin(MIN_ANGLE_RAD)) return; // collinear continuation → no trim
  const miter = cornerMiter(
    { x: a.px, y: a.py }, a.ux, a.uy, a.halfSigned, a.len,
    { x: b.px, y: b.py }, b.ux, b.uy, b.halfSigned, b.len,
    cornerSwap(a, b),
  );
  if (miter) {
    setPatchField(acc, a.wallId, a.which === 'start' ? 'startMiter' : 'endMiter', miter.miterA);
    setPatchField(acc, b.wallId, b.which === 'start' ? 'startMiter' : 'endMiter', miter.miterB);
  } else {
    // Miter overflows wall bounds → fall back to axis-bevel (Phase 1D-B logic).
    accumBevel(acc, a.wallId, a.which, Math.min(b.half / sinA, MAX_BEVEL_FRACTION * a.len));
    accumBevel(acc, b.wallId, b.which, Math.min(a.half / sinA, MAX_BEVEL_FRACTION * b.len));
  }
}

/**
 * 3+ walls meeting at one point (Revit multi-wall join). Pick the two PRIMARY
 * walls — greatest combined thickness, tie-broken by collinearity (most
 * anti-parallel bodies = a straight through-wall) — and join them with each
 * other (miter, or nothing when they continue straight). Every other wall butts
 * against the through line (bevel by the primary half-thickness / sin angle), so
 * a thin partition never overwrites the primary walls' clean corner.
 */
function resolveMultiWayCorner(group: readonly EndpointRec[], acc: Map<string, MutablePatch>): void {
  // Select the primary pair: max (half_i + half_j), tie-break by most anti-parallel.
  let pi = 0, pj = 1, bestThick = -Infinity, bestDot = Infinity;
  for (let i = 0; i < group.length; i++) {
    for (let j = i + 1; j < group.length; j++) {
      const oi = outwardDir(group[i]!), oj = outwardDir(group[j]!);
      const dot = oi.x * oj.x + oi.y * oj.y; // −1 = perfectly opposite (through)
      const thick = group[i]!.half + group[j]!.half;
      if (thick > bestThick + 1e-9 || (Math.abs(thick - bestThick) <= 1e-9 && dot < bestDot)) {
        bestThick = thick; bestDot = dot; pi = i; pj = j;
      }
    }
  }
  const p = group[pi]!, q = group[pj]!;

  // Primary pair join each other exactly like a 2-way corner (miter or straight).
  resolveTwoWayCorner(p, q, acc);

  // The through line runs along the primary axis; every other wall butts into it.
  const throughHalf = Math.max(p.half, q.half);
  const minSin = Math.sin(MIN_ANGLE_RAD);
  for (let i = 0; i < group.length; i++) {
    if (i === pi || i === pj) continue;
    const r = group[i]!;
    const sinR = Math.max(sinAngleBetween(r.ux, r.uy, p.ux, p.uy), minSin);
    accumBevel(acc, r.wallId, r.which, Math.min(throughHalf / sinR, MAX_BEVEL_FRACTION * r.len));
  }
}
