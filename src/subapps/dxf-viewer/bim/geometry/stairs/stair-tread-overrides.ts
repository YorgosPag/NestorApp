/**
 * Per-tread override geometry (ADR-611 · ADR-358 Q19 Φ4).
 *
 * Revit "Nosing" model applied PER TREAD. A `StairPerTreadOverride` carries:
 *   • `nosing`        — a scalar forward overhang (mm), OR
 *   • `customProfile` — a full nosing SECTION profile (`Point2D` = depth×height mm,
 *                       Revit "Nosing Profile" family). Swept along the tread's
 *                       leading edge in 3D (Φ4b); its MAX depth drives the plan
 *                       footprint overhang here.
 *
 * SSoT rationale: `assembleStairGeometry` funnels EVERY one of the 12 stair kinds
 * (straight → winder), so the plan-footprint override lives here ONCE and cascades
 * to the 2D renderer, the 3D flat extrude and the BOQ simultaneously — all of which
 * read `StairGeometry.treads`. Byte-identical (same array reference) when a stair
 * has no overrides → the 155 stair-geometry tests stay green.
 *
 * Index convention: overrides are keyed by the 0-based GLOBAL build-order tread
 * index — the same key `resolveStairMaterial(treadIndex)` and the 3D
 * `stairComponentIndex` tag use (ADR-358 Q19 Φ5 reconcile). This pass therefore
 * runs on the concatenated `parts.treads` BEFORE the cut-plane split.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-611-stair-geometry-generators-ssot.md
 * @see docs/centralized-systems/reference/adrs/ADR-358-dxf-stair-tool-google-level.md §Q19
 */

import type { Point2D, Polygon3D, StairParams } from '../../../bim/types/stair-types';
import { polygonCentroid } from '../shared/polygon-utils';

const EPS = 1e-9;

// ─── Nosing resolver ──────────────────────────────────────────────────────────

export interface ResolvedTreadNosing {
  /** Effective forward overhang depth (mm) — drives the plan footprint leading edge. */
  readonly overhangDepth: number;
  /** Optional nosing section profile (depth×height mm) — consumed by the 3D sweep (Φ4b). */
  readonly section?: readonly Point2D[];
}

/**
 * Resolve the effective nosing for tread `index`. Precedence (finish-level, Revit):
 *   customProfile (overhang = max section depth) > override.nosing > params.nosing.
 * Overhang clamps to ≥0 (a negative overhang is meaningless).
 */
export function resolveTreadNosing(
  params: Readonly<StairParams>,
  index: number,
): ResolvedTreadNosing {
  const override = params.perTreadOverrides?.[index];
  if (override?.customProfile && override.customProfile.length > 0) {
    let maxDepth = 0;
    for (const p of override.customProfile) if (p.x > maxDepth) maxDepth = p.x;
    return { overhangDepth: Math.max(0, maxDepth), section: override.customProfile };
  }
  if (override?.nosing !== undefined) {
    return { overhangDepth: Math.max(0, override.nosing) };
  }
  return { overhangDepth: Math.max(0, params.nosing) };
}

// ─── Plan-footprint pass ──────────────────────────────────────────────────────

/**
 * Apply per-tread nosing overhang to the flat tread footprints (SSoT plan pass).
 * Runs on the GLOBAL build-order tread list — index `i` aligns with
 * `perTreadOverrides[i]`. Returns the SAME array reference when the stair has no
 * overrides (fast path — zero allocation, keeps geometry byte-identical).
 */
export function applyPerTreadNosing(
  treads: readonly Polygon3D[],
  params: Readonly<StairParams>,
): readonly Polygon3D[] {
  const overrides = params.perTreadOverrides;
  if (!overrides || Object.keys(overrides).length === 0) return treads;
  const base = Math.max(0, params.nosing);
  let changed = false;
  const next = treads.map((tread, i) => {
    const delta = resolveTreadNosing(params, i).overhangDepth - base;
    if (Math.abs(delta) < EPS) return tread;
    const extended = extendLeadingEdge(tread, treads, i, delta);
    if (extended !== tread) changed = true;
    return extended;
  });
  return changed ? next : treads;
}

// ─── Leading-edge extension (winding-agnostic) ────────────────────────────────

export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

/**
 * Forward (ascent) travel direction at tread `i`, derived from neighbour tread
 * centroids — works for straight AND curved flights without assuming a vertex
 * winding. Returns null for a lone tread (no neighbour to orient from).
 *
 * Exported as the SSoT travel-direction resolver so the 3D nosing sweep (Φ4b)
 * shares the exact same winding-agnostic logic instead of re-deriving it.
 */
export function treadForwardDir(treads: readonly Polygon3D[], i: number): Vec2 | null {
  const n = treads.length;
  if (n < 2) return null;
  const here = polygonCentroid(treads[i]!);
  const hasNext = i + 1 < n;
  const ref = polygonCentroid(treads[hasNext ? i + 1 : i - 1]!);
  const sign = hasNext ? 1 : -1;
  const dx = (ref.x - here.x) * sign;
  const dy = (ref.y - here.y) * sign;
  const len = Math.hypot(dx, dy);
  if (len < EPS) return null;
  return { x: dx / len, y: dy / len };
}

/**
 * Extend a tread quad's LEADING edge (the two vertices furthest along `forward`)
 * outward by `delta` mm, preserving every z. `delta` may be negative (shorter
 * nosing). No-op (returns the input tread) when the forward direction is
 * undefined (lone tread).
 */
function extendLeadingEdge(
  tread: Polygon3D,
  treads: readonly Polygon3D[],
  i: number,
  delta: number,
): Polygon3D {
  const fwd = treadForwardDir(treads, i);
  if (!fwd) return tread;
  // Project each vertex onto `fwd`; the two highest projections are the leading edge.
  const proj = tread.map((p) => p.x * fwd.x + p.y * fwd.y);
  const lead = twoMaxIndices(proj);
  return tread.map((p, idx) =>
    lead.has(idx) ? { x: p.x + fwd.x * delta, y: p.y + fwd.y * delta, z: p.z } : p,
  );
}

/** Indices of the two largest values in `values` (length ≥ 2). */
function twoMaxIndices(values: readonly number[]): ReadonlySet<number> {
  let a = 0;
  let b = 1;
  if (values[b]! > values[a]!) {
    a = 1;
    b = 0;
  }
  for (let k = 2; k < values.length; k++) {
    if (values[k]! > values[a]!) {
      b = a;
      a = k;
    } else if (values[k]! > values[b]!) {
      b = k;
    }
  }
  return new Set([a, b]);
}
