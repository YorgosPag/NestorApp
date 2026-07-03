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

// ── Tolerances ──────────────────────────────────────────────────────────────

/** Max |sin(angle)| between the two axes to be considered parallel (~0.5°). */
const COLLINEAR_SIN_TOL = 0.01;
/** Max perpendicular distance (scene units / mm) between the two axes. */
const COLLINEAR_PERP_TOL = 1;
/** Max thickness difference (mm) treated as "same thickness". */
const THICKNESS_TOL = 1;

// ── Public types ──────────────────────────────────────────────────────────────

/** Why two walls cannot be merged — maps 1:1 to an i18n reason key. */
export type WallMergeBlockReason =
  | 'not-straight'
  | 'not-collinear'
  | 'different-thickness'
  | 'degenerate';

export type CanMergeResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: WallMergeBlockReason };

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
  if (
    perpDistance(axisA, { x: b.params.start.x, y: b.params.start.y }) > COLLINEAR_PERP_TOL ||
    perpDistance(axisA, { x: b.params.end.x, y: b.params.end.y }) > COLLINEAR_PERP_TOL
  ) {
    return { ok: false, reason: 'not-collinear' };
  }

  if (Math.abs(a.params.thickness - b.params.thickness) > THICKNESS_TOL) {
    return { ok: false, reason: 'different-thickness' };
  }
  return { ok: true };
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
