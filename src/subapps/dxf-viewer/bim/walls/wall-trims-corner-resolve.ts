/**
 * ADR-363 Phase 1D-C / 1L — Wall corner-junction resolution (pass 2).
 *
 * Split out of `wall-trims.ts` (N.7.1 file-size limit) — owns the pass-2
 * "cluster coincident corner endpoints and resolve each junction once" logic
 * plus the endpoint / accumulator primitives shared with the pass-1 classifier:
 *   - 2-way corner  → geometric miter, or square-off when the two endpoints
 *     merely butt face-to-face (ADR-363 Phase 1L «Disallow Join»).
 *   - 3+-way corner → Revit multi-wall join: the thickest (tie-broken by
 *     collinearity) pair joins; every other wall butts against the through line.
 *
 * Pure functions — no React, no I/O. The single mutable surface is the
 * `acc: Map<string, MutablePatch>` accumulator threaded through every helper.
 * Behaviour is byte-for-byte the pre-split `wall-trims.ts`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §6 Phase 1D-C
 */

import {
  sinAngleBetween,
  cornerMiter,
  cornerMiterRatio,
  lineLineIntersect,
  MAX_BEVEL_FRACTION,
  MITER_LIMIT_RATIO,
  type MiterPt,
} from './wall-trims-geometry';
import type { WallJoinMode } from '../types/wall-types';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Angle below which axes are treated as parallel → no trim. */
export const MIN_ANGLE_RAD = Math.PI / 12; // 15°

/**
 * ADR-363 Phase 1L — «Disallow Join» (auto square-off). A corner is a GENUINE
 * join only when the two walls' corner endpoints COINCIDE. Region-fill walls that
 * merely butt face-to-face (one wall's endpoint sits on the neighbour's FACE, not
 * its centreline) sit ~one half-thickness apart — that gap is reserved for a
 * column, so they must stay rectangular (no miter). `extendFillingWallToNeighbors`
 * (Phase 1K) already snaps the walls that SHOULD join to coincident centrelines,
 * so this guard simply respects that decision instead of forcing a miter on every
 * pair that merely lands within `JOIN_THRESHOLD_MM` of the axis intersection.
 *
 * Threshold = fraction of the SMALLER half-thickness:
 *   - coincident corner ⇒ endpoint gap ≈ 0 ≪ threshold → miter (unchanged)
 *   - face-to-face butt  ⇒ gap ≈ hypot(halfA, halfB) ≫ threshold → square-off
 */
const JOIN_COINCIDENCE_FRACTION = 0.5;

/**
 * ADR-363 Phase 1N — a corner is the region-fill «column-gap» butt when BOTH walls
 * stop SHORT of the axis-junction J by more than this fraction of their half (each
 * ends at the neighbour's FACE ≈ 1·half short). Free-end L-corners instead CROSS at
 * J (one over, one short) — see `cornerShouldMiter`.
 */
const COLUMN_GAP_SHORT_FRACTION = 0.5;

/**
 * ADR-363 Phase 1N — tolerance (fraction of half) for "an endpoint lies ON the
 * other wall's AXIS" and "the junction runs THROUGH a wall's body". Used only to
 * detect a T-junction (a stem ending on a continuing wall's centreline) that the
 * corner classifier grouped as a corner. Region-fill auto-join lands exactly on the
 * centreline (perp ≈ 0), so a small tolerance separates it from a real free-end L.
 */
const MITER_NEAR_FRACTION = 0.2;

// ─── Shared types ─────────────────────────────────────────────────────────────

/** Mutable accumulator entry (scoped to a single `computeWallTrims` call). */
export type MutablePatch = {
  startMiter?: MiterPt;
  endMiter?: MiterPt;
  startBevel?: number;
  endBevel?: number;
};

/**
 * One wall endpoint participating in a corner junction (canvas world units).
 * `ux/uy` is the axis unit vector (start→end) regardless of which end this is;
 * `which` says whether the junction sits at the wall's start or end.
 */
export interface EndpointRec {
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
  /** ADR-363 Phase 1L-J — explicit join override at THIS endpoint (`'auto'` default). */
  readonly joinMode: WallJoinMode;
}

// ─── Join-override resolution (ADR-363 Phase 1L-J) ─────────────────────────────

/**
 * Combine the two endpoints' explicit join modes into one junction decision.
 * Most-restrictive wins: `disallow` > `miter` > `butt`/`square` > `auto`.
 * `square` collapses to `butt` (same square-off engine; the ⟂-cap refinement is
 * deferred). A junction is `auto` only when BOTH endpoints are `auto`.
 */
export function combineJoinModes(a: WallJoinMode, b: WallJoinMode): WallJoinMode {
  if (a === 'disallow' || b === 'disallow') return 'disallow';
  if (a === 'miter' || b === 'miter') return 'miter';
  if (a === 'butt' || b === 'butt' || a === 'square' || b === 'square') return 'butt';
  return 'auto';
}

// ─── Accumulator helpers ──────────────────────────────────────────────────────

function setPatchField(acc: Map<string, MutablePatch>, id: string, field: keyof MutablePatch, value: number | MiterPt): void {
  const prev = acc.get(id) ?? {};
  acc.set(id, { ...prev, [field]: value });
}

export function endpointKey(wallId: string, which: 'start' | 'end'): string {
  return `${wallId}:${which}`;
}

/** Accumulate a bevel patch for one wall endpoint (max with any existing). */
export function accumBevel(
  acc: Map<string, MutablePatch>,
  wallId: string,
  which: 'start' | 'end',
  value: number,
): void {
  const prev = acc.get(wallId) ?? {};
  const field = which === 'start' ? 'startBevel' : 'endBevel';
  acc.set(wallId, { ...prev, [field]: Math.max(prev[field] ?? 0, value) });
}

// ─── Geometry helpers ─────────────────────────────────────────────────────────

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
 * Perpendicular distance from point (px,py) to the infinite axis line through
 * (qx,qy) with unit direction (ux,uy). |(P−Q) × û|.
 */
function perpDistanceToAxis(px: number, py: number, qx: number, qy: number, ux: number, uy: number): number {
  return Math.abs((px - qx) * uy - (py - qy) * ux);
}

/**
 * ADR-363 Phase 1L — SSoT for "trim a stem ending at (ex,ey) back to the near
 * FACE of a continuing wall (axis through (qx,qy) dir (ux,uy), half-thickness
 * `half`), by ONLY how far the stem currently penetrates past that face":
 *   penetration⊥ = half − ⊥dist(endpoint → axis);  bevel = penetration⊥ / sin(angle)
 * Returns 0 when the stem ends at/short of the face (penetration ≤ 0) → no gap is
 * ever introduced. Clamped to MAX_BEVEL_FRACTION·stemLen. Shared by the T-junction
 * branches and `squareOffCorner` so face-alignment is identical for both.
 */
export function penetrationBevel(
  ex: number, ey: number,
  qx: number, qy: number, ux: number, uy: number,
  half: number, sinAngle: number, stemLen: number,
): number {
  const pen = half - perpDistanceToAxis(ex, ey, qx, qy, ux, uy);
  if (pen <= 1e-6) return 0;
  return Math.min(pen / sinAngle, MAX_BEVEL_FRACTION * stemLen);
}

/**
 * ADR-363 Phase 1L — two corner endpoints COINCIDE (genuine join) vs butt
 * face-to-face (the corner gap reserved for a column). Coincident ⇒ miter /
 * through-wall continuation; separated ⇒ each wall squares off at the other's
 * face. SSoT for both the 2-way miter guard and the multi-way through-wall test.
 */
function cornerEndpointsCoincide(a: EndpointRec, b: EndpointRec): boolean {
  return Math.hypot(a.px - b.px, a.py - b.py) <= JOIN_COINCIDENCE_FRACTION * Math.min(a.half, b.half);
}

/**
 * ADR-363 Phase 1N — the point where the two walls' axes cross (their would-be
 * corner J). Null only if parallel — never here, `sinA` already cleared MIN_ANGLE.
 */
function axisJunction(a: EndpointRec, b: EndpointRec): { x: number; y: number } | null {
  const isect = lineLineIntersect(a.px, a.py, a.px + a.ux, a.py + a.uy, b.px, b.py, b.px + b.ux, b.py + b.uy);
  return isect ? { x: a.px + isect.t * a.ux, y: a.py + isect.t * a.uy } : null;
}

/** Signed depth of the junction J into a wall's body: (J − endpoint)·outward.
 *  >0 ⇒ the wall passes THROUGH J; <0 ⇒ it stops SHORT of J; ≈0 ⇒ ends at J. */
function junctionDepth(e: EndpointRec, jx: number, jy: number): number {
  const out = outwardDir(e);
  return (jx - e.px) * out.x + (jy - e.py) * out.y;
}

/**
 * ADR-363 Phase 1N (rev 2) — decide miter vs square-off for an `auto` corner from
 * HOW the two free ends meet their axis-junction J (DB-verified on real hand-drawn
 * walls). Signed depth d = (J − endpoint)·outward tells where J sits per wall:
 *   d < 0 → the wall stops SHORT of J;  d > 0 → its body runs THROUGH J.
 *
 *   • BOTH short (each by > 0.5·half) → region-fill column-gap butt → SQUARE OFF
 *     (leave the corner open for a column).
 *   • One wall's END lies on the other's AXIS (⊥ ≈ 0) while that other runs THROUGH
 *     → T-junction (a stem into a continuing wall) → SQUARE OFF / bevel.
 *   • Otherwise the free ends CROSS at J (one over + one short, or both overshoot)
 *     → free-end L-corner → MITER (Revit/ArchiCAD «Allow Join»). Coincident ends are
 *     the exact d≈0 case of this → miter, as before.
 *
 * Replaces the earlier ⊥-to-face band, which mis-squared oblique hand-drawn corners
 * whose ⊥ landed near 0.5·half (screenshot 115754). Reuses `perpDistanceToAxis`.
 */
function cornerShouldMiter(a: EndpointRec, b: EndpointRec): boolean {
  const j = axisJunction(a, b);
  if (!j) return true; // non-parallel guaranteed by sinA; be permissive if degenerate

  const depthA = junctionDepth(a, j.x, j.y);
  const depthB = junctionDepth(b, j.x, j.y);

  // Region-fill column gap: both walls fall well short of the corner.
  const shortA = COLUMN_GAP_SHORT_FRACTION * a.half;
  const shortB = COLUMN_GAP_SHORT_FRACTION * b.half;
  if (depthA < -shortA && depthB < -shortB) return false;

  // T-junction masquerading as a corner: one stem ends ON the other's centreline
  // while that other continues through J.
  const nearA = MITER_NEAR_FRACTION * a.half;
  const nearB = MITER_NEAR_FRACTION * b.half;
  const aOnBAxis = perpDistanceToAxis(a.px, a.py, b.px, b.py, b.ux, b.uy) < nearB;
  const bOnAAxis = perpDistanceToAxis(b.px, b.py, a.px, a.py, a.ux, a.uy) < nearA;
  if ((aOnBAxis && depthB > nearB) || (bOnAAxis && depthA > nearA)) return false;

  return true; // free ends cross at J → miter
}

// ─── Pass 2: corner cluster resolution ────────────────────────────────────────

/**
 * Pass 2 — group coincident corner endpoints into junctions and resolve each
 * once. 2-end junctions are a plain corner (geometric miter, unchanged). 3+-end
 * junctions are Revit-style: the two "primary" walls (thickest, tie-broken by
 * collinearity) join each other; every other wall BUTTS (bevels) against them —
 * so a thin partition can no longer overwrite a thick wall's miter.
 */
export function resolveCornerClusters(
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

  // ADR-363 Phase 1L-J — explicit join override steers WHICH cleanup runs; the
  // geometry below is unchanged. `disallow` → no trim (walls stay rectangular).
  // `miter` → force the geometric miter even when the endpoints do NOT coincide
  // (this is the whole point of the override: a wall closed onto a neighbour's
  // FACE still mitres on demand). `butt`/`square` → square off. `auto` → the
  // original Phase 1L rule: mitre only when the corner endpoints COINCIDE,
  // otherwise square off (the region-fill / column-gap case).
  const joinMode = combineJoinModes(a.joinMode, b.joinMode);
  if (joinMode === 'disallow') return;

  // ADR-363 Phase 1N — big-player «Allow Join»: two FREE wall ends meeting at a
  // corner miter (extend edges to the intersection → the corner closes), EXCEPT a
  // region-fill column-gap (both ends short of the corner) or a T-junction (a stem
  // ending on a continuing wall's centreline). `cornerShouldMiter` decides.
  const shouldMiter =
    joinMode === 'miter' ||
    (joinMode === 'auto' && cornerShouldMiter(a, b));
  if (!shouldMiter) {
    squareOffCorner(a, b, sinA, acc);
    return;
  }

  // ADR-363 Phase 1M — big-player miter-limit (SVG/Figma/Cinema4D; Revit auto
  // Butt/Square at sharp joins). A corner sharper than MITER_LIMIT_RATIO would
  // mitre into an unbounded acute spike, so clamp it to a square-off (bevel) —
  // exactly as every major tool does. Applies ONLY to `auto`: an explicit `miter`
  // override is a deliberate user choice (Revit forced Miter) and is honoured even
  // when sharp. `α` is the interior corner angle, read from the OUTWARD directions.
  if (joinMode === 'auto') {
    const oa = outwardDir(a), ob = outwardDir(b);
    if (cornerMiterRatio(oa.x, oa.y, ob.x, ob.y) > MITER_LIMIT_RATIO) {
      squareOffCorner(a, b, sinA, acc);
      return;
    }
  }

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
 * ADR-363 Phase 1L — square off an edge-only corner (no miter). Each wall is
 * trimmed back to the OTHER's near face only by the amount it currently
 * PENETRATES past it (`penetrationBevel`). A wall already at/short of the face
 * gets no bevel, so a face-aligned region-fill butt is left exactly square (no
 * gap), while a wall whose endpoint was auto-joined to the neighbour's centreline
 * (Phase 1K) is pulled back precisely to the face.
 */
function squareOffCorner(a: EndpointRec, b: EndpointRec, sinA: number, acc: Map<string, MutablePatch>): void {
  const bevA = penetrationBevel(a.px, a.py, b.px, b.py, b.ux, b.uy, b.half, sinA, a.len);
  const bevB = penetrationBevel(b.px, b.py, a.px, a.py, a.ux, a.uy, a.half, sinA, b.len);
  if (bevA > 0) accumBevel(acc, a.wallId, a.which, bevA);
  if (bevB > 0) accumBevel(acc, b.wallId, b.which, bevB);
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

  // ADR-363 Phase 1L — a collinear primary pair is a genuine through-wall ONLY when
  // its two endpoints coincide. When they are SEPARATED (two stems straddling a
  // crossing wall — e.g. region-fill legs at the head of a "U") the through-line
  // abstraction is invalid: leaving the pair untrimmed lets the penetrating stem
  // overshoot to the crossing wall's centreline (the order-dependent region-fill
  // bug). Resolve the WHOLE cluster by penetration so each non-through stem squares
  // off at the crossing wall's near face — order-independent, Revit «Disallow Join».
  const primaryCollinear = sinAngleBetween(p.ux, p.uy, q.ux, q.uy) < Math.sin(MIN_ANGLE_RAD);
  if (primaryCollinear && !cornerEndpointsCoincide(p, q)) {
    for (let i = 0; i < group.length; i++) {
      if (group[i]!.joinMode === 'disallow') continue; // ADR-363 Phase 1L-J — no cleanup
      if (!clusterStemIsThrough(group, i)) bevelStemByPenetration(group, i, acc);
    }
    return;
  }

  // Primary pair join each other exactly like a 2-way corner (miter or straight).
  resolveTwoWayCorner(p, q, acc);

  // Every OTHER wall butts into the junction by PENETRATION — back to the near face
  // of whichever neighbour it protrudes past. NOT a fixed `throughHalf/sin`: that
  // over-cut a stem whose end already sat ON the face, pulling it ~half-thickness
  // BEHIND the face → a visible gap (the thin-leg-stops-short bug). A genuine
  // through-wall (coincident collinear partner) stays straight.
  for (let i = 0; i < group.length; i++) {
    if (i === pi || i === pj) continue;
    if (group[i]!.joinMode === 'disallow') continue; // ADR-363 Phase 1L-J — no cleanup
    if (clusterStemIsThrough(group, i)) continue;
    bevelStemByPenetration(group, i, acc);
  }
}

/**
 * A cluster wall genuinely continues straight — it has a COINCIDENT collinear
 * partner in the cluster (a real through-wall). Such a wall is never trimmed.
 */
function clusterStemIsThrough(group: readonly EndpointRec[], i: number): boolean {
  const minSin = Math.sin(MIN_ANGLE_RAD);
  const r = group[i]!;
  return group.some((s, k) =>
    k !== i &&
    sinAngleBetween(r.ux, r.uy, s.ux, s.uy) < minSin &&
    cornerEndpointsCoincide(r, s));
}

/**
 * ADR-363 Phase 1L — square off one cluster stem against every NON-collinear
 * neighbour whose body it currently protrudes past (`penetrationBevel`). A stem
 * already at/short of a neighbour's face gets 0 from that neighbour → never a gap;
 * a stem auto-joined to a neighbour's centreline is pulled back exactly to the
 * face. `accumBevel` keeps the largest cut across neighbours. Order-independent.
 */
function bevelStemByPenetration(group: readonly EndpointRec[], i: number, acc: Map<string, MutablePatch>): void {
  const minSin = Math.sin(MIN_ANGLE_RAD);
  const r = group[i]!;
  for (let k = 0; k < group.length; k++) {
    if (k === i) continue;
    const s = group[k]!;
    const sinRS = sinAngleBetween(r.ux, r.uy, s.ux, s.uy);
    if (sinRS < minSin) continue; // collinear neighbours never cut each other
    const bevel = penetrationBevel(r.px, r.py, s.px, s.py, s.ux, s.uy, s.half, sinRS, r.len);
    if (bevel > 0) accumBevel(acc, r.wallId, r.which, bevel);
  }
}
