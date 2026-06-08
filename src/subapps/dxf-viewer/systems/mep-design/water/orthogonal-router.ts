/**
 * ADR-426 — Stage 3 Routing: deterministic orthogonal (Manhattan) trunk-branch router.
 *
 * v1 (ADR-423 §8 "deterministic orthogonal router first"): one distribution plane,
 * a single **spine** from the source along the dominant-spread axis, with each fixture
 * **tapping off** the spine via an orthogonal drop. Bidirectional arms (fixtures on
 * both sides of the source). Each trunk run carries the cumulative LU of all fixtures
 * fed *through* it (→ diminishing diameters when sized); each branch carries one
 * fixture's LU. NOT yet wall-obstacle-aware — architected to grow into A* (a later
 * slice swaps this function, the orchestrator/contract unchanged).
 *
 * Pure + deterministic (stable ordering, no Date/random).
 */

import type { Point2D } from '../../../rendering/types/Types';

/** A routing target: a fixture supply point + its loading units. */
export interface RouteTarget {
  readonly point: Point2D;
  readonly loadingUnits: number;
}

/** A routed run (geometry + cumulative LU); the orchestrator adds service/Ø. */
export interface RoutedSegment {
  readonly start: Point2D;
  readonly end: Point2D;
  readonly role: 'trunk' | 'branch';
  readonly cumulativeLU: number;
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

/** Build one spine arm (taps ordered outward from the source) into `out`. */
function buildArm(
  source: Point2D,
  ordered: readonly RouteTarget[],
  tapPoint: (t: RouteTarget) => Point2D,
  out: RoutedSegment[],
): void {
  // Suffix sums: cumulative LU fed through each trunk segment (this tap outward).
  const suffix: number[] = new Array(ordered.length).fill(0);
  let run = 0;
  for (let i = ordered.length - 1; i >= 0; i--) {
    run += ordered[i].loadingUnits;
    suffix[i] = run;
  }
  let prev = source;
  for (let i = 0; i < ordered.length; i++) {
    const t = ordered[i];
    const tap = tapPoint(t);
    if (!coincident(prev, tap)) {
      out.push({ start: prev, end: tap, role: 'trunk', cumulativeLU: suffix[i] });
    }
    if (!coincident(tap, t.point)) {
      out.push({ start: tap, end: t.point, role: 'branch', cumulativeLU: t.loadingUnits });
    }
    prev = tap;
  }
}

/**
 * Route source → all targets as an orthogonal trunk-branch tree. Returns the runs
 * with cumulative LU (unsized); empty for no targets.
 */
export function routeOrthogonalTrunkBranch(
  source: Point2D,
  targets: readonly RouteTarget[],
): readonly RoutedSegment[] {
  if (targets.length === 0) return [];
  const horizontal = spineIsHorizontal(targets);
  const along = (p: Point2D): number => (horizontal ? p.x : p.y);
  const tapPoint = (t: RouteTarget): Point2D =>
    horizontal ? { x: t.point.x, y: source.y } : { x: source.x, y: t.point.y };
  const s0 = along(source);
  const right = targets
    .filter((t) => along(t.point) >= s0)
    .sort((a, b) => along(a.point) - along(b.point));
  const left = targets
    .filter((t) => along(t.point) < s0)
    .sort((a, b) => along(b.point) - along(a.point));
  const out: RoutedSegment[] = [];
  buildArm(source, right, tapPoint, out);
  buildArm(source, left, tapPoint, out);
  return out;
}
