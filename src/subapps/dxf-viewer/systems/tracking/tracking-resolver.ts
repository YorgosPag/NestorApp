/**
 * TRACKING RESOLVER — ADR-357 §4 G4 / §5.1 Object Snap Tracking
 *
 * Pure function `resolveTrackingSnap`: given the cursor world position, the
 * current acquired-point set, and the polar tracking configuration, returns
 * the best alignment-path snap candidate or `null` if no path is within the
 * screen-space tolerance.
 *
 * Priority (ADR-357 §5.1):
 *   1. Intersection of two alignment paths (highest priority).
 *   2. Intersection of one path with an existing snap candidate (Phase 5+).
 *   3. Pure alignment path projection.
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
  /** All active alignment paths (for rendering). */
  readonly alignmentPaths: readonly TrackingAlignmentPath[];
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
): TrackingSnapResult | null {
  if (acquired.length === 0) return null;

  const paths = buildAlignmentPaths(acquired, polar);
  if (paths.length === 0) return null;

  const intersection = findClosestIntersection(paths, cursor, worldTolerance);
  if (intersection) {
    return {
      point: intersection.point,
      alignmentPaths: paths,
      intersections: [intersection.point],
      anchorPoint: intersection.anchor,
      kind: 'intersection',
      snappedAngle: null,
    };
  }

  const projection = findClosestProjection(paths, cursor, worldTolerance, acquired);
  if (projection) {
    return {
      point: projection.point,
      alignmentPaths: paths,
      intersections: [],
      anchorPoint: projection.anchor,
      kind: 'projection',
      snappedAngle: projection.path.angleDeg,
    };
  }

  return null;
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
        };
      }
    }
  }
  return best;
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
