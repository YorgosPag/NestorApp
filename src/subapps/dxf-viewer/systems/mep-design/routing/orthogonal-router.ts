/**
 * ADR-423 — shared Stage 3 Routing: deterministic orthogonal (Manhattan) trunk-branch router.
 *
 * The single router every MEP discipline reuses (ADR-426 water pilot proved it; ADR-427
 * drainage is the 2nd consumer). v1 (ADR-423 §8 "deterministic orthogonal router first"):
 * one distribution plane, a single **spine** from the root along the dominant-spread axis,
 * with each target **tapping off** the spine via an orthogonal drop. Bidirectional arms
 * (targets on both sides of the root). Each trunk run carries the cumulative loading of all
 * targets fed *through* it (→ monotonic diameters when sized); each branch carries one
 * target's loading. NOT yet wall-obstacle-aware — architected to grow into A* (a later
 * slice swaps this function, the orchestrator/contract unchanged).
 *
 * Discipline-agnostic. Water reads `cumulativeLU` (→ diminishing Ø toward fixtures);
 * drainage reads the same number as cumulative Discharge Units (→ growing Ø toward the
 * collector, the root). The optional `minBranchDiameterMm` lets a discipline pin a per-
 * target minimum (drainage: a WC branch is always ≥ DN100); the router propagates it as a
 * suffix-max so a trunk is never sized below the largest pipe it carries. Water passes none
 * → `cumulativeMinDiameterMm` is 0 → zero behavioural change.
 *
 * Pure + deterministic (stable ordering, no Date/random).
 *
 * @see ../water/design-water-supply.ts · ../drainage/gravity-router.ts (consumers)
 */

import type { Point2D } from '../../../rendering/types/Types';

/** A routing target: a terminal point + its loading + an optional minimum branch Ø. */
export interface RouteTarget {
  readonly point: Point2D;
  /** Loading units (water LU / drainage DU) — the cumulative-sum driver. */
  readonly loadingUnits: number;
  /**
   * Minimum nominal diameter (mm) the branch to this target must not go below, and
   * which propagates up the spine (suffix-max). Drainage pins WC = DN100 here; water
   * omits it (⇒ 0, no effect). Discipline-agnostic: just "this leaf needs ≥ X mm".
   */
  readonly minBranchDiameterMm?: number;
}

/** A routed run (geometry + cumulative loading + min-Ø constraint); the orchestrator sizes it. */
export interface RoutedSegment {
  readonly start: Point2D;
  readonly end: Point2D;
  readonly role: 'trunk' | 'branch';
  readonly cumulativeLU: number;
  /**
   * The largest `minBranchDiameterMm` among the targets this run carries (a branch =
   * its single target; a trunk = suffix-max of everything downstream). 0 when no target
   * pins a minimum. The orchestrator sizes each run as `max(table(cumulativeLU), this)`.
   */
  readonly cumulativeMinDiameterMm: number;
}

const EPS = 1e-6;

function coincident(a: Point2D, b: Point2D): boolean {
  return Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS;
}

/** Horizontal spine (constant y) when the x-spread dominates, else vertical. */
function spineIsHorizontal(targets: readonly RouteTarget[]): boolean {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const t of targets) {
    minX = Math.min(minX, t.point.x);
    maxX = Math.max(maxX, t.point.x);
    minY = Math.min(minY, t.point.y);
    maxY = Math.max(maxY, t.point.y);
  }
  return maxX - minX >= maxY - minY;
}

/** Build one spine arm (taps ordered outward from the root) into `out`. */
function buildArm(
  root: Point2D,
  ordered: readonly RouteTarget[],
  tapPoint: (t: RouteTarget) => Point2D,
  out: RoutedSegment[],
): void {
  // Suffix sums: cumulative loading + min-Ø fed through each trunk segment (this tap outward).
  const suffixLU: number[] = new Array(ordered.length).fill(0);
  const suffixMinDia: number[] = new Array(ordered.length).fill(0);
  let runLU = 0;
  let runMinDia = 0;
  for (let i = ordered.length - 1; i >= 0; i--) {
    runLU += ordered[i].loadingUnits;
    runMinDia = Math.max(runMinDia, ordered[i].minBranchDiameterMm ?? 0);
    suffixLU[i] = runLU;
    suffixMinDia[i] = runMinDia;
  }
  let prev = root;
  for (let i = 0; i < ordered.length; i++) {
    const t = ordered[i];
    const tap = tapPoint(t);
    if (!coincident(prev, tap)) {
      out.push({
        start: prev,
        end: tap,
        role: 'trunk',
        cumulativeLU: suffixLU[i],
        cumulativeMinDiameterMm: suffixMinDia[i],
      });
    }
    if (!coincident(tap, t.point)) {
      out.push({
        start: tap,
        end: t.point,
        role: 'branch',
        cumulativeLU: t.loadingUnits,
        cumulativeMinDiameterMm: t.minBranchDiameterMm ?? 0,
      });
    }
    prev = tap;
  }
}

/**
 * Route root → all targets as an orthogonal trunk-branch tree. Returns the runs
 * with cumulative loading (unsized); empty for no targets. The runs are emitted
 * root-outward (every run's `start` is closer to the root than its `end`) — relied
 * on by gravity slope-assignment to walk elevations from the root.
 */
export function routeOrthogonalTrunkBranch(
  root: Point2D,
  targets: readonly RouteTarget[],
): readonly RoutedSegment[] {
  if (targets.length === 0) return [];
  const horizontal = spineIsHorizontal(targets);
  const along = (p: Point2D): number => (horizontal ? p.x : p.y);
  const tapPoint = (t: RouteTarget): Point2D =>
    horizontal ? { x: t.point.x, y: root.y } : { x: root.x, y: t.point.y };
  const s0 = along(root);
  const right = targets
    .filter((t) => along(t.point) >= s0)
    .sort((a, b) => along(a.point) - along(b.point));
  const left = targets
    .filter((t) => along(t.point) < s0)
    .sort((a, b) => along(b.point) - along(a.point));
  const out: RoutedSegment[] = [];
  buildArm(root, right, tapPoint, out);
  buildArm(root, left, tapPoint, out);
  return out;
}
