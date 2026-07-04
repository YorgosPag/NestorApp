/**
 * TRACKING RESOLVER — ADR-357 §4 G4 / §5.1 Object Snap Tracking
 *
 * Pure function `resolveTrackingSnap`: given the cursor world position, the
 * current acquired-point set, and the polar tracking configuration, returns
 * the best alignment-path snap candidate or `null` if no path is within the
 * screen-space tolerance.
 *
 * Priority (ADR-357 §5.1):
 *   1a. Clean corner — the current segment's base rays × an anchor path (OTRACK;
 *       always evaluated, exempt from the flood cap). (2026-07-04)
 *   1b. Intersection of two anchor alignment paths (flood-capped).
 *   2.  Intersection of one path with an existing snap candidate (Phase 5+).
 *   3.  Pure alignment path projection.
 *
 * Geometry: alignment paths emanate from each acquired point along
 *   • horizontal (0° / 180°)
 *   • vertical (90° / 270°)
 *   • polar increments + additional angles (when polar is enabled).
 *
 * All math in world coordinates; the caller converts the supplied screen
 * tolerance through the active transform.
 */

import type { Point2D } from '../../rendering/types/Types';
import type { AcquiredTrackingPoint } from './TrackingPointStore';
import { degToRad } from '../../rendering/entities/shared/geometry-utils';

export interface TrackingPolarConfig {
  /** Increment angle in degrees (0 = increment disabled). */
  readonly incrementAngle: number;
  /** Additional explicit angles in degrees (always considered). */
  readonly additionalAngles: readonly number[];
  /** Polar enabled flag — when false, only H/V paths participate. */
  readonly polarEnabled: boolean;
}

export interface TrackingAlignmentPath {
  /** Acquired point the path emanates from. */
  readonly origin: Point2D;
  /** Direction unit vector (world space, Y-up). */
  readonly dx: number;
  readonly dy: number;
  /** Angle in degrees (normalized 0–360). */
  readonly angleDeg: number;
}

export interface TrackingSnapResult {
  /** Snapped cursor position (projection / intersection). */
  readonly point: Point2D;
  /**
   * Every alignment path built this frame (acquired × angles).
   * @deprecated For rendering use `activePaths` instead — drawing every path
   * floods the canvas once ambient sources add dozens of paths. Retained for
   * back-compat / debug only. (ADR-357 ambient-alignment extension, 2026-06-21)
   */
  readonly alignmentPaths: readonly TrackingAlignmentPath[];
  /**
   * The 1–2 paths that actually produced this snap — the ONLY paths the
   * renderer should draw (1 for projection, 2 for an intersection). Mirrors
   * Revit/AutoCAD: only the line(s) the cursor is currently aligned to show.
   */
  readonly activePaths: readonly TrackingAlignmentPath[];
  /** Path intersections discovered (priority 1 snap candidates). */
  readonly intersections: readonly Point2D[];
  /** Acquired point closest to the resolved snap (for labeling). */
  readonly anchorPoint: AcquiredTrackingPoint;
  /** Resolution kind — affects rendering emphasis. */
  readonly kind: 'intersection' | 'projection';
  /** Snapped angle (deg) for the projection path — `null` for intersections. */
  readonly snappedAngle: number | null;
}

const HV_ANGLES = [0, 90, 180, 270];
const EPSILON = 1e-6;
/**
 * Cap above which the O(n²) intersection scan is skipped (projection still
 * runs). Ambient sources can push the path count high; intersections are
 * mainly useful for intentional/acquired points, so this keeps the synchronous
 * hover path within the ADR-040 frame budget. (ADR-357 ambient extension)
 */
const MAX_INTERSECTION_PATHS = 16;

/**
 * Resolve the active tracking snap for the given cursor, or `null` when no
 * alignment path is within `worldTolerance` of the cursor.
 *
 * @param cursor — raw cursor position in world coordinates
 * @param acquired — current acquired point set (FIFO order)
 * @param polar — polar tracking configuration
 * @param worldTolerance — match tolerance in world units (caller derives
 *        from screen pixels via the active transform; typical: 3px / scale)
 */
export function resolveTrackingSnap(
  cursor: Point2D,
  acquired: readonly AcquiredTrackingPoint[],
  polar: TrackingPolarConfig,
  worldTolerance: number,
  segmentBase?: Point2D | null,
): TrackingSnapResult | null {
  if (acquired.length === 0) return null;

  const paths = buildAlignmentPaths(acquired, polar);
  if (paths.length === 0) return null;

  // 1a — CLEAN CORNER: the current segment's start (rubber-band base) is ALWAYS a
  // tracking origin (AutoCAD/Revit OTRACK). Base-rays × anchor-paths is O(n) and
  // EXEMPT from the flood cap, so the corner forms even when POLAR inflates the
  // path count past MAX_INTERSECTION_PATHS. (2026-07-04)
  const baseIntersection = segmentBase
    ? findClosestBaseIntersection(buildBasePaths(segmentBase, polar), paths, cursor, worldTolerance)
    : null;
  // 1b — anchor × anchor crossings (acquired-point intersections). O(n²); gated by
  // the flood cap so ambient-heavy frames stay within the ADR-040 budget.
  const anchorIntersection = paths.length <= MAX_INTERSECTION_PATHS
    ? findClosestIntersection(paths, cursor, worldTolerance)
    : null;
  const intersection = closerIntersection(baseIntersection, anchorIntersection);
  if (intersection) return intersectionResult(intersection, paths);

  const projection = findClosestProjection(paths, cursor, worldTolerance, acquired);
  if (projection) return projectionResult(projection, paths);
  return null;
}

/** Build the `TrackingSnapResult` for a resolved path intersection (clean corner / crossing). */
function intersectionResult(
  m: IntersectionMatch,
  paths: readonly TrackingAlignmentPath[],
): TrackingSnapResult {
  return {
    point: m.point,
    alignmentPaths: paths,
    activePaths: [m.pathA, m.pathB],
    intersections: [m.point],
    anchorPoint: m.anchor,
    kind: 'intersection',
    snappedAngle: null,
  };
}

/** Build the `TrackingSnapResult` for a resolved single-path projection. */
function projectionResult(
  m: ProjectionMatch,
  paths: readonly TrackingAlignmentPath[],
): TrackingSnapResult {
  return {
    point: m.point,
    alignmentPaths: paths,
    activePaths: [m.path],
    intersections: [],
    anchorPoint: m.anchor,
    kind: 'projection',
    snappedAngle: m.path.angleDeg,
  };
}

function buildAlignmentPaths(
  acquired: readonly AcquiredTrackingPoint[],
  polar: TrackingPolarConfig,
): TrackingAlignmentPath[] {
  const angles = collectAngles(polar);
  const paths: TrackingAlignmentPath[] = [];
  for (const ap of acquired) {
    for (const angleDeg of angles) {
      const rad = degToRad(angleDeg);
      paths.push({
        origin: { x: ap.x, y: ap.y },
        dx: Math.cos(rad),
        dy: Math.sin(rad),
        angleDeg,
      });
    }
  }
  return paths;
}

/**
 * Alignment rays emanating from the current segment's base (rubber-band start).
 * Reuses `buildAlignmentPaths` — same angle set as any anchor — so the base is a
 * first-class tracking origin with zero duplicated geometry.
 */
function buildBasePaths(base: Point2D, polar: TrackingPolarConfig): TrackingAlignmentPath[] {
  return buildAlignmentPaths(
    [{ x: base.x, y: base.y, acquiredAt: 0, sourceSnapType: 'segment-base' }],
    polar,
  );
}

function collectAngles(polar: TrackingPolarConfig): number[] {
  const set = new Set<number>(HV_ANGLES);
  if (polar.polarEnabled) {
    if (polar.incrementAngle > 0) {
      for (let a = polar.incrementAngle; a < 360; a += polar.incrementAngle) {
        set.add(normalizeAngle(a));
      }
    }
    for (const extra of polar.additionalAngles) {
      set.add(normalizeAngle(extra));
    }
  }
  return Array.from(set);
}

function normalizeAngle(deg: number): number {
  const n = deg % 360;
  return n < 0 ? n + 360 : n;
}

interface IntersectionMatch {
  readonly point: Point2D;
  readonly anchor: AcquiredTrackingPoint;
  readonly distance: number;
  /** The two crossing paths — rendered as the active alignment lines. */
  readonly pathA: TrackingAlignmentPath;
  readonly pathB: TrackingAlignmentPath;
}

function findClosestIntersection(
  paths: readonly TrackingAlignmentPath[],
  cursor: Point2D,
  worldTolerance: number,
): IntersectionMatch | null {
  let best: IntersectionMatch | null = null;
  for (let i = 0; i < paths.length; i++) {
    for (let j = i + 1; j < paths.length; j++) {
      const a = paths[i];
      const b = paths[j];
      if (a.origin.x === b.origin.x && a.origin.y === b.origin.y) continue;
      const inter = intersectRays(a, b);
      if (!inter) continue;
      const distance = Math.hypot(inter.x - cursor.x, inter.y - cursor.y);
      if (distance > worldTolerance) continue;
      if (!best || distance < best.distance) {
        best = {
          point: inter,
          anchor: acquiredFromPath(a),
          distance,
          pathA: a,
          pathB: b,
        };
      }
    }
  }
  return best;
}

/**
 * Closest intersection of a base ray with an ANCHOR path — the OTRACK clean-corner
 * case (e.g. horizontal-from-base ∩ vertical-from-A → the rectangle corner). Labels
 * from the anchor path's origin (the alignment reference) and renders the anchor path
 * + base ray as the two active alignment lines. O(baseRays × paths), no flood cap.
 */
function findClosestBaseIntersection(
  baseParts: readonly TrackingAlignmentPath[],
  paths: readonly TrackingAlignmentPath[],
  cursor: Point2D,
  worldTolerance: number,
): IntersectionMatch | null {
  let best: IntersectionMatch | null = null;
  for (const base of baseParts) {
    for (const p of paths) {
      if (p.origin.x === base.origin.x && p.origin.y === base.origin.y) continue;
      const inter = intersectRays(base, p);
      if (!inter) continue;
      const distance = Math.hypot(inter.x - cursor.x, inter.y - cursor.y);
      if (distance > worldTolerance) continue;
      if (!best || distance < best.distance) {
        best = { point: inter, anchor: acquiredFromPath(p), distance, pathA: p, pathB: base };
      }
    }
  }
  return best;
}

/** The nearer of two intersection candidates (either may be null). */
function closerIntersection(
  a: IntersectionMatch | null,
  b: IntersectionMatch | null,
): IntersectionMatch | null {
  if (!a) return b;
  if (!b) return a;
  return a.distance <= b.distance ? a : b;
}

interface ProjectionMatch {
  readonly point: Point2D;
  readonly path: TrackingAlignmentPath;
  readonly anchor: AcquiredTrackingPoint;
  readonly distance: number;
}

function findClosestProjection(
  paths: readonly TrackingAlignmentPath[],
  cursor: Point2D,
  worldTolerance: number,
  acquired: readonly AcquiredTrackingPoint[],
): ProjectionMatch | null {
  let best: ProjectionMatch | null = null;
  for (const path of paths) {
    const proj = projectOntoRay(path, cursor);
    const distance = Math.hypot(proj.x - cursor.x, proj.y - cursor.y);
    if (distance > worldTolerance) continue;
    if (!best || distance < best.distance) {
      const anchor = acquired.find(a => a.x === path.origin.x && a.y === path.origin.y);
      if (!anchor) continue;
      best = { point: proj, path, anchor, distance };
    }
  }
  return best;
}

function intersectRays(a: TrackingAlignmentPath, b: TrackingAlignmentPath): Point2D | null {
  const denom = a.dx * b.dy - a.dy * b.dx;
  if (Math.abs(denom) < EPSILON) return null;
  const rx = b.origin.x - a.origin.x;
  const ry = b.origin.y - a.origin.y;
  const t = (rx * b.dy - ry * b.dx) / denom;
  return {
    x: a.origin.x + a.dx * t,
    y: a.origin.y + a.dy * t,
  };
}

function projectOntoRay(path: TrackingAlignmentPath, cursor: Point2D): Point2D {
  const vx = cursor.x - path.origin.x;
  const vy = cursor.y - path.origin.y;
  const t = vx * path.dx + vy * path.dy;
  return {
    x: path.origin.x + path.dx * t,
    y: path.origin.y + path.dy * t,
  };
}

function acquiredFromPath(path: TrackingAlignmentPath): AcquiredTrackingPoint {
  return {
    x: path.origin.x,
    y: path.origin.y,
    acquiredAt: 0,
    sourceSnapType: 'tracking',
  };
}
