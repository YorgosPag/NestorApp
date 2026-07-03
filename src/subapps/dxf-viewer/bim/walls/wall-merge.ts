/**
 * Wall Merge — pure geometry functions for ADR-566 (Merge/Join Walls tool).
 *
 * The INVERSE of `wall-split.ts`: takes two collinear straight walls and
 * produces a SINGLE wall spanning both, redistributing every hosted opening of
 * both originals onto the merged wall. Modeled after AutoCAD `JOIN` for walls
 * (Revit has no direct "merge walls" — it auto-joins at coincident endpoints).
 *
 * Merge policy (ADR-566 §edge-cases, AutoCAD-JOIN semantics):
 *   - Straight-only (`kind === 'straight'`) — curved/polyline deferred (mirror split).
 *   - Collinear axes required (parallel + perpendicular distance ≈ 0).
 *   - Same thickness required — different thickness BLOCKS (Revit-style message).
 *     Category may differ → the PRIMARY (first-picked) wall's params win.
 *   - Gap along the axis is BRIDGED — merged spans outer-to-outer of both axes
 *     (covers touch + overlap + gap alike).
 *
 * All measurements follow the wall convention (axis distance ≡ mm for mm-scene
 * walls, consistent with `wall-split.ts` / opening `offsetFromStart`).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-566-merge-join-walls.md
 * @see bim/walls/wall-split.ts — the mirrored inverse operation
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Point3D } from '../types/bim-base';
import type { WallEntity, WallParams } from '../types/wall-types';
import type { OpeningEntity } from '../types/opening-types';
import type { OpeningUpdate } from './wall-split';
import { lineIntersection } from '../../utils/angle-entity-math';

// ── Tolerances (AutoCAD-JOIN-grade, forgiving) ──────────────────────────────

/**
 * Max |sin(angle)| between the two axes to be considered parallel (~5°). Generous
 * on purpose: the user explicitly picks the two walls, and the merge STRAIGHTENS
 * both endpoints onto the primary axis anyway — so a small drift still yields a
 * clean straight wall (mirrors AutoCAD JOIN's tolerance).
 */
const COLLINEAR_SIN_TOL = 0.087;
/**
 * Absolute floor for the perpendicular-offset tolerance (scene units / mm). The
 * effective tolerance is `max(this, PERP_TOL_THICKNESS_FRAC × thickness)` so that
 * "visually collinear" walls (a few mm of hand-drawn drift) still merge, while
 * parallel-ADJACENT walls (offset ≈ a full thickness) are still rejected.
 */
const COLLINEAR_PERP_TOL_ABS = 5;
/** Perpendicular tolerance as a fraction of wall thickness (half → rejects adjacent). */
const PERP_TOL_THICKNESS_FRAC = 0.5;
/** Max thickness difference (mm) treated as "same thickness". */
const THICKNESS_TOL = 1;

// ── Public types ──────────────────────────────────────────────────────────────

/** Why two walls cannot be joined — maps 1:1 to an i18n reason key. */
export type WallMergeBlockReason =
  | 'not-straight'
  | 'not-collinear'
  | 'different-thickness'
  | 'parallel-offset'
  | 'degenerate';

export type CanMergeResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: WallMergeBlockReason };

/**
 * The join the tool will perform for a pair of walls (ADR-566 §corner-join):
 *   - `collinear` → the two walls become ONE wall (`buildMergedWallParams`).
 *   - `corner`    → the two walls are extended/trimmed so their axes meet at
 *     `joinPoint`, forming an L — they stay TWO walls (`computeWallCornerJoin`).
 *   - `blocked`   → cannot join (typed reason for the UI).
 */
export type WallJoinPlan =
  | { readonly kind: 'collinear' }
  | { readonly kind: 'corner'; readonly joinPoint: Point2D }
  | { readonly kind: 'blocked'; readonly reason: WallMergeBlockReason };

// ── Internal geometry helpers ─────────────────────────────────────────────────

interface Axis {
  readonly origin: Point2D;
  readonly u: Point2D;
  readonly length: number;
}

function wallAxis(wall: WallEntity): Axis | null {
  const { start, end } = wall.params;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length <= 1e-9) return null;
  return { origin: { x: start.x, y: start.y }, u: { x: dx / length, y: dy / length }, length };
}

/** Signed distance of `p` along `axis.u` from `axis.origin`. */
function scalarAlong(axis: Axis, p: Point2D): number {
  return (p.x - axis.origin.x) * axis.u.x + (p.y - axis.origin.y) * axis.u.y;
}

/** Perpendicular distance of `p` from the infinite line of `axis`. */
function perpDistance(axis: Axis, p: Point2D): number {
  return Math.abs((p.x - axis.origin.x) * -axis.u.y + (p.y - axis.origin.y) * axis.u.x);
}

// ── Merge validation ──────────────────────────────────────────────────────────

/**
 * Gate for merging wall `a` (primary) with wall `b`. Straight-only, collinear
 * axes, same thickness. Returns a typed block reason for the UI when invalid.
 */
export function canMergeWalls(a: WallEntity, b: WallEntity): CanMergeResult {
  if (a.kind !== 'straight' || b.kind !== 'straight') {
    return { ok: false, reason: 'not-straight' };
  }
  const axisA = wallAxis(a);
  const axisB = wallAxis(b);
  if (!axisA || !axisB) return { ok: false, reason: 'degenerate' };

  // Parallel axes (|cross of unit vectors| ≈ 0) …
  const sin = Math.abs(axisA.u.x * axisB.u.y - axisA.u.y * axisB.u.x);
  if (sin > COLLINEAR_SIN_TOL) return { ok: false, reason: 'not-collinear' };
  // … and B's endpoints lie on A's infinite line (same axis, not just parallel).
  // Thickness-relative band: a few mm of drift merges; a full-thickness offset
  // (parallel-adjacent walls) is rejected.
  const perpTol = Math.max(
    COLLINEAR_PERP_TOL_ABS,
    PERP_TOL_THICKNESS_FRAC * Math.min(a.params.thickness, b.params.thickness),
  );
  if (
    perpDistance(axisA, { x: b.params.start.x, y: b.params.start.y }) > perpTol ||
    perpDistance(axisA, { x: b.params.end.x, y: b.params.end.y }) > perpTol
  ) {
    return { ok: false, reason: 'not-collinear' };
  }

  if (Math.abs(a.params.thickness - b.params.thickness) > THICKNESS_TOL) {
    return { ok: false, reason: 'different-thickness' };
  }
  return { ok: true };
}

// ── Join classification (collinear merge vs corner join) ──────────────────────

/**
 * Decides HOW to join wall `a` (primary) with wall `b`:
 *   - Parallel + collinear (same axis)   → `collinear` (single merged wall). Same
 *     thickness required (mirror `canMergeWalls`).
 *   - Parallel but offset (adjacent)     → `blocked: 'parallel-offset'` (no corner
 *     exists — the axes never meet).
 *   - Non-parallel (crossing/L)          → `corner` at the infinite-line axis
 *     intersection. Different thickness is ALLOWED (they stay two walls).
 *
 * Straight-only; degenerate axes are blocked. This is the superset gate the
 * knife-style merge tool uses; `canMergeWalls` remains the collinear-only gate.
 */
export function classifyWallJoin(a: WallEntity, b: WallEntity): WallJoinPlan {
  if (a.kind !== 'straight' || b.kind !== 'straight') {
    return { kind: 'blocked', reason: 'not-straight' };
  }
  const axisA = wallAxis(a);
  const axisB = wallAxis(b);
  if (!axisA || !axisB) return { kind: 'blocked', reason: 'degenerate' };

  const sin = Math.abs(axisA.u.x * axisB.u.y - axisA.u.y * axisB.u.x);
  if (sin <= COLLINEAR_SIN_TOL) {
    // Parallel — collinear (merge) or offset (no corner).
    const perpTol = Math.max(
      COLLINEAR_PERP_TOL_ABS,
      PERP_TOL_THICKNESS_FRAC * Math.min(a.params.thickness, b.params.thickness),
    );
    const collinear =
      perpDistance(axisA, { x: b.params.start.x, y: b.params.start.y }) <= perpTol &&
      perpDistance(axisA, { x: b.params.end.x, y: b.params.end.y }) <= perpTol;
    if (!collinear) return { kind: 'blocked', reason: 'parallel-offset' };
    if (Math.abs(a.params.thickness - b.params.thickness) > THICKNESS_TOL) {
      return { kind: 'blocked', reason: 'different-thickness' };
    }
    return { kind: 'collinear' };
  }

  // Crossing axes → corner join at the infinite-line intersection (extends both).
  const joinPoint = lineIntersection(a.params.start, a.params.end, b.params.start, b.params.end);
  if (!joinPoint) return { kind: 'blocked', reason: 'degenerate' };
  return { kind: 'corner', joinPoint };
}

// ── Corner join (extend/trim both axes to their intersection) ──────────────────

export interface WallCornerJoinResult {
  /** The shared L-corner point (infinite-axis intersection). */
  readonly joinPoint: Point2D;
  /** Primary wall params with its nearest endpoint moved onto `joinPoint`. */
  readonly wallAParams: WallParams;
  /** Secondary wall params with its nearest endpoint moved onto `joinPoint`. */
  readonly wallBParams: WallParams;
}

/**
 * Moves the endpoint of each wall that is NEAREST to the axis intersection onto
 * that intersection, so the two walls meet at a clean L-corner (Revit "Wall Join"
 * / AutoCAD trim-extend to corner — Fillet radius 0). Works for extension (corner
 * beyond both walls) and trim (corner between them) alike. The far endpoint of
 * each wall is untouched. `startMiter`/`endMiter`/`measurementLength` are cleared
 * (geometry changed — the wall corner framing re-derives the miter). Openings are
 * re-flowed by the caller's `UpdateWallParamsCommand` cascade (fixed offsets).
 *
 * Returns `null` when the axes are parallel (no intersection).
 */
export function computeWallCornerJoin(a: WallEntity, b: WallEntity): WallCornerJoinResult | null {
  const joinPoint = lineIntersection(a.params.start, a.params.end, b.params.start, b.params.end);
  if (!joinPoint) return null;
  return {
    joinPoint,
    wallAParams: extendWallEndpointTo(a.params, joinPoint),
    wallBParams: extendWallEndpointTo(b.params, joinPoint),
  };
}

/** Returns `params` with whichever of start/end is nearest `target` moved onto it. */
function extendWallEndpointTo(params: WallParams, target: Point2D): WallParams {
  const dStart = Math.hypot(params.start.x - target.x, params.start.y - target.y);
  const dEnd = Math.hypot(params.end.x - target.x, params.end.y - target.y);
  const {
    startMiter: _sm, endMiter: _em, measurementLength: _ml, ...rest
  } = params;
  const tgt: Point3D = { x: target.x, y: target.y, z: 0 };
  return dStart <= dEnd ? { ...rest, start: tgt } : { ...rest, end: tgt };
}

// ── Merged axis span ──────────────────────────────────────────────────────────

interface Endpoint {
  readonly pt: Point2D;
  readonly scalar: number;
  readonly bevel?: number;
}

/** The four wall endpoints projected on the primary axis, with owning bevel. */
function collectEndpoints(a: WallEntity, b: WallEntity, axis: Axis): Endpoint[] {
  const mk = (p: Point3D, bevel?: number): Endpoint => {
    const pt = { x: p.x, y: p.y };
    return { pt, scalar: scalarAlong(axis, pt), bevel };
  };
  return [
    mk(a.params.start, a.params.startBevel),
    mk(a.params.end, a.params.endBevel),
    mk(b.params.start, b.params.startBevel),
    mk(b.params.end, b.params.endBevel),
  ];
}

/**
 * World-space endpoints of the merged wall axis: the two extreme projections of
 * both walls' endpoints on the primary axis (outer-to-outer, gap bridged).
 */
export function computeMergedGhostAxis(a: WallEntity, b: WallEntity): readonly [Point2D, Point2D] | null {
  const axis = wallAxis(a);
  if (!axis) return null;
  const eps = collectEndpoints(a, b, axis);
  let lo = eps[0];
  let hi = eps[0];
  for (const e of eps) {
    if (e.scalar < lo.scalar) lo = e;
    if (e.scalar > hi.scalar) hi = e;
  }
  const at = (s: number): Point2D => ({ x: axis.origin.x + axis.u.x * s, y: axis.origin.y + axis.u.y * s });
  return [at(lo.scalar), at(hi.scalar)];
}

// ── Gap between two collinear walls (ADR-568 auto-opening) ────────────────────

/**
 * Passage-width floor (mm). A gap ≥ this bridges INTO an auto-opening; a smaller
 * gap (or touch/overlap) bridges plain (single wall, no opening). Well above the
 * hard opening floor `MIN_OPENING_WIDTH_MM` (200).
 */
export const MIN_GAP_FOR_OPENING_MM = 400;

export interface WallGap {
  /** Empty span (mm) between the two walls' facing endpoints along the shared axis. */
  readonly gapMm: number;
  /**
   * Offset (mm) of the gap's near edge from the MERGED wall's start
   * (`buildMergedWallParams` starts at the outer-most projection), i.e. the
   * `offsetFromStart` an opening filling the gap must have on the merged wall.
   */
  readonly openingOffsetFromMergedStart: number;
}

/**
 * The empty interval between two COLLINEAR walls along their shared axis. Projects
 * both walls onto the primary (`a`) axis as intervals `[aLo,aHi]` / `[bLo,bHi]`; a
 * gap exists ONLY when the intervals are disjoint — touch / overlap / containment
 * all return `null` (no empty span to fill). The caller MUST have already gated
 * collinearity via `canMergeWalls` (this treats `b` as if it lay on `a`'s axis).
 *
 * The merged wall (`buildMergedWallParams`) starts at `min(aLo,bLo)`, so the
 * opening's `offsetFromStart` on the merged wall = gap near-edge − that origin.
 */
export function computeWallGap(a: WallEntity, b: WallEntity): WallGap | null {
  const axis = wallAxis(a);
  if (!axis) return null;
  const aLo = Math.min(scalarAlong(axis, a.params.start), scalarAlong(axis, a.params.end));
  const aHi = Math.max(scalarAlong(axis, a.params.start), scalarAlong(axis, a.params.end));
  const bLo = Math.min(scalarAlong(axis, b.params.start), scalarAlong(axis, b.params.end));
  const bHi = Math.max(scalarAlong(axis, b.params.start), scalarAlong(axis, b.params.end));

  let gapLo: number;
  let gapHi: number;
  if (aHi <= bLo) {
    gapLo = aHi; // B lies after A
    gapHi = bLo;
  } else if (bHi <= aLo) {
    gapLo = bHi; // A lies after B
    gapHi = aLo;
  } else {
    return null; // overlap / touch / containment — no empty span
  }

  const gapMm = gapHi - gapLo;
  if (gapMm <= 1e-6) return null;

  const mergedStart = Math.min(aLo, bLo);
  return { gapMm, openingOffsetFromMergedStart: gapLo - mergedStart };
}

// ── Merged params ──────────────────────────────────────────────────────────────

/**
 * Builds `WallParams` for the merged wall. Clones the PRIMARY wall's params
 * (thickness/height/category/flip/dna/finish/bindings/tilt/…) and overrides the
 * axis to span outer-to-outer. Bevels are inherited from the walls owning the
 * outer endpoints (join cleanup); miters + measurementLength are cleared (the
 * geometry changed, so exact miter points no longer apply — mirror split).
 */
export function buildMergedWallParams(a: WallEntity, b: WallEntity): WallParams {
  const axis = wallAxis(a);
  if (!axis) return a.params;
  const eps = collectEndpoints(a, b, axis);
  let lo = eps[0];
  let hi = eps[0];
  for (const e of eps) {
    if (e.scalar < lo.scalar) lo = e;
    if (e.scalar > hi.scalar) hi = e;
  }
  const at = (s: number): Point3D => ({
    x: axis.origin.x + axis.u.x * s,
    y: axis.origin.y + axis.u.y * s,
    z: 0,
  });

  const {
    startBevel: _sb, endBevel: _eb, startMiter: _sm, endMiter: _em,
    measurementLength: _ml, ...rest
  } = a.params;

  const next: WallParams = {
    ...rest,
    start: at(lo.scalar),
    end: at(hi.scalar),
    ...(lo.bevel !== undefined && { startBevel: lo.bevel }),
    ...(hi.bevel !== undefined && { endBevel: hi.bevel }),
  };
  return next;
}

// ── Opening redistribution ──────────────────────────────────────────────────

/**
 * Re-hosts every opening of BOTH walls onto the merged wall. For each opening,
 * its world position along its own host axis (`host.start + host_u · offset`) is
 * projected onto the merged axis to yield the new `offsetFromStart` from the
 * merged wall's start. All openings receive `wallId = mergedWallId`.
 *
 * The inverse of `redistributeOpenings` (wall-split): split partitions one
 * wall's openings into two; merge unions two walls' openings into one.
 *
 * @param openingsByIdFn - scene lookup for each opening (returns null if missing)
 */
export function collectMergedOpenings(
  a: WallEntity,
  b: WallEntity,
  openingsByIdFn: (id: string) => OpeningEntity | null,
  mergedWallId: string,
): OpeningUpdate[] {
  const merged = wallAxis({ ...a, params: buildMergedWallParams(a, b) } as WallEntity);
  const updates: OpeningUpdate[] = [];
  if (!merged) return updates;

  for (const wall of [a, b]) {
    const host = wallAxis(wall);
    if (!host) continue;
    for (const oid of wall.hostedOpeningIds ?? []) {
      const opening = openingsByIdFn(oid);
      if (!opening) continue;
      const prev = opening.params;
      const worldStart: Point2D = {
        x: host.origin.x + host.u.x * prev.offsetFromStart,
        y: host.origin.y + host.u.y * prev.offsetFromStart,
      };
      const newOffset = Math.max(0, scalarAlong(merged, worldStart));
      updates.push({
        openingId: oid,
        previousParams: prev,
        nextParams: { ...prev, wallId: mergedWallId, offsetFromStart: newOffset },
      });
    }
  }
  return updates;
}
