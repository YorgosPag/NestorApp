/**
 * @module hooks/state/useConstructionPointState
 * @description React hook bridging ConstructionPointStore to the component tree.
 *
 * Uses `useSyncExternalStore` for tear-free subscription to the store singleton.
 * Mutations are wrapped in Commands (undo/redo).
 *
 * @see ADR-189 §3.7, §3.8, §3.9, §3.10, §3.11, §3.12, §3.15, §3.16
 * @see useGuideState.ts (template pattern)
 * @since 2026-02-20
 */

import { useSyncExternalStore, useCallback } from 'react';
import { getGlobalConstructionPointStore } from '../../systems/guides/construction-point-store';
import {
  AddConstructionPointCommand,
  AddConstructionPointBatchCommand,
  DeleteConstructionPointCommand,
} from '../../systems/guides/construction-point-commands';
import type { ConstructionPoint } from '../../systems/guides/guide-types';
import { CONSTRUCTION_POINT_LIMITS } from '../../systems/guides/guide-types';
import type { Point2D } from '../../rendering/types/Types';

// ============================================================================
// MATH UTILITIES
// ============================================================================

/**
 * Compute equally-spaced points between start and end.
 * segmentCount = N → creates N+1 points (including start and end).
 */
function computeSegmentPoints(
  start: Point2D,
  end: Point2D,
  segmentCount: number,
): Array<{ point: Point2D }> {
  const results: Array<{ point: Point2D }> = [];
  for (let i = 0; i <= segmentCount; i++) {
    const t = i / segmentCount;
    results.push({
      point: {
        x: start.x + t * (end.x - start.x),
        y: start.y + t * (end.y - start.y),
      },
    });
  }
  return results;
}

/**
 * Compute points at fixed distance intervals between start and end.
 * Always includes start and end points.
 * Last interval may be shorter if total distance isn't evenly divisible.
 */
function computeDistancePoints(
  start: Point2D,
  end: Point2D,
  distance: number,
): Array<{ point: Point2D }> {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const totalLen = Math.sqrt(dx * dx + dy * dy);

  if (totalLen < CONSTRUCTION_POINT_LIMITS.MIN_DISTANCE || distance <= 0) {
    return [{ point: { x: start.x, y: start.y } }];
  }

  const ux = dx / totalLen;
  const uy = dy / totalLen;

  const results: Array<{ point: Point2D }> = [{ point: { x: start.x, y: start.y } }];
  let d = distance;
  while (d < totalLen - CONSTRUCTION_POINT_LIMITS.MIN_DISTANCE) {
    results.push({ point: { x: start.x + ux * d, y: start.y + uy * d } });
    d += distance;
  }
  // Always include end point
  results.push({ point: { x: end.x, y: end.y } });
  return results;
}

// ============================================================================
// ARC GEOMETRY UTILITIES (§3.9, §3.10, §3.12)
// ============================================================================

/** Degrees → radians */
function degToRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/** Point on circle at given angle (radians) */
function pointOnCircle(center: Point2D, radius: number, angleRad: number): Point2D {
  return { x: center.x + radius * Math.cos(angleRad), y: center.y + radius * Math.sin(angleRad) };
}

/**
 * Normalize angle to [0, 360) range.
 */
function normalizeAngleDeg(deg: number): number {
  let a = deg % 360;
  if (a < 0) a += 360;
  return a;
}

/**
 * Compute the sweep angle from startAngle to endAngle (counterclockwise).
 * DXF convention: arcs go counterclockwise from start to end.
 * Returns value in (0, 360].
 */
function arcSweepDeg(startDeg: number, endDeg: number): number {
  const s = normalizeAngleDeg(startDeg);
  const e = normalizeAngleDeg(endDeg);
  let sweep = e - s;
  if (sweep <= 0) sweep += 360;
  return sweep;
}

/**
 * §3.9: Equally-spaced points along an arc/circle.
 * - Circle (isFullCircle): N points, evenly distributed (no duplicate start/end).
 * - Arc: N+1 points from startAngle to endAngle (includes both endpoints).
 */
function computeArcSegmentPoints(
  center: Point2D,
  radius: number,
  startAngleDeg: number,
  endAngleDeg: number,
  count: number,
  isFullCircle: boolean,
): Array<{ point: Point2D }> {
  if (count < 2) return [];

  if (isFullCircle) {
    // Full circle: N equally-spaced points (no duplicate start=end)
    const results: Array<{ point: Point2D }> = [];
    const step = (2 * Math.PI) / count;
    const startRad = degToRad(startAngleDeg);
    for (let i = 0; i < count; i++) {
      results.push({ point: pointOnCircle(center, radius, startRad + i * step) });
    }
    return results;
  }

  // Arc: N+1 points (count segments → count+1 points including endpoints)
  const sweepDeg = arcSweepDeg(startAngleDeg, endAngleDeg);
  const sweepRad = degToRad(sweepDeg);
  const startRad = degToRad(startAngleDeg);
  const results: Array<{ point: Point2D }> = [];
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    results.push({ point: pointOnCircle(center, radius, startRad + t * sweepRad) });
  }
  return results;
}

/**
 * §3.10: Points at fixed arc-length distance along an arc/circle.
 * - Angle increment per step = distance / radius (radians).
 * - Circle: wraps around until exceeding circumference.
 * - Arc: stops at end angle; always includes end point for arcs.
 */
function computeArcDistancePoints(
  center: Point2D,
  radius: number,
  startAngleDeg: number,
  endAngleDeg: number,
  distance: number,
  isFullCircle: boolean,
): Array<{ point: Point2D }> {
  if (distance <= 0 || radius <= 0) return [];

  const angleStepRad = distance / radius;
  const startRad = degToRad(startAngleDeg);

  if (isFullCircle) {
    const totalRad = 2 * Math.PI;
    const results: Array<{ point: Point2D }> = [];
    let angle = 0;
    while (angle < totalRad - angleStepRad * 0.01) {
      results.push({ point: pointOnCircle(center, radius, startRad + angle) });
      angle += angleStepRad;
    }
    return results;
  }

  // Arc path
  const sweepRad = degToRad(arcSweepDeg(startAngleDeg, endAngleDeg));
  const results: Array<{ point: Point2D }> = [];
  let angle = 0;
  while (angle < sweepRad - angleStepRad * 0.01) {
    results.push({ point: pointOnCircle(center, radius, startRad + angle) });
    angle += angleStepRad;
  }
  // Always include arc endpoint
  results.push({ point: pointOnCircle(center, radius, startRad + sweepRad) });
  return results;
}

/**
 * §3.12: Intersection of a line segment with an arc/circle.
 * Returns 0, 1, or 2 intersection points.
 *
 * Algorithm:
 * 1. Parametric line: P(t) = lineStart + t*(lineEnd - lineStart), t ∈ [0,1]
 * 2. Substitute into circle equation: |P(t) - center|² = r²
 * 3. Solve quadratic: at² + bt + c = 0
 * 4. Filter solutions: t ∈ [0,1] AND angle within arc range (or full circle)
 */
function computeLineArcIntersection(
  lineStart: Point2D,
  lineEnd: Point2D,
  center: Point2D,
  radius: number,
  startAngleDeg: number,
  endAngleDeg: number,
  isFullCircle: boolean,
): Array<{ point: Point2D }> {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const fx = lineStart.x - center.x;
  const fy = lineStart.y - center.y;

  const a = dx * dx + dy * dy;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - radius * radius;

  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0 || a === 0) return [];

  const sqrtD = Math.sqrt(discriminant);
  const tValues: number[] = [];

  const t1 = (-b - sqrtD) / (2 * a);
  const t2 = (-b + sqrtD) / (2 * a);

  // Allow small tolerance for endpoints
  const EPS = 1e-9;
  if (t1 >= -EPS && t1 <= 1 + EPS) tValues.push(Math.max(0, Math.min(1, t1)));
  if (t2 >= -EPS && t2 <= 1 + EPS && Math.abs(t2 - t1) > EPS) {
    tValues.push(Math.max(0, Math.min(1, t2)));
  }

  const results: Array<{ point: Point2D }> = [];
  for (const t of tValues) {
    const px = lineStart.x + t * dx;
    const py = lineStart.y + t * dy;

    if (isFullCircle) {
      results.push({ point: { x: px, y: py } });
      continue;
    }

    // Check if point is within arc angular range
    let angleDeg = Math.atan2(py - center.y, px - center.x) * (180 / Math.PI);
    if (angleDeg < 0) angleDeg += 360;

    const s = normalizeAngleDeg(startAngleDeg);
    const e = normalizeAngleDeg(endAngleDeg);

    let inRange: boolean;
    if (s <= e) {
      inRange = angleDeg >= s - 0.01 && angleDeg <= e + 0.01;
    } else {
      // Arc wraps around 0°
      inRange = angleDeg >= s - 0.01 || angleDeg <= e + 0.01;
    }

    if (inRange) {
      results.push({ point: { x: px, y: py } });
    }
  }

  return results;
}

/**
 * §3.11: Intersection of two arcs/circles.
 * Returns 0, 1, or 2 intersection points.
 *
 * Algorithm:
 * 1. d = distance between centers
 * 2. No intersection if d > r1+r2 (too far) or d < |r1-r2| (one inside other) or d ≈ 0 and r1 ≈ r2 (coincident)
 * 3. a = (r1² - r2² + d²) / (2d)   — distance from center1 to the radical line
 * 4. h = sqrt(r1² - a²)             — half-distance between intersection points
 * 5. P = center1 + a*(center2-center1)/d  — midpoint on the radical line
 * 6. Offsets perpendicular to the line between centers give the two points
 * 7. Filter: each point must be within the angular range of its respective arc (or full circle)
 */
function computeCircleCircleIntersection(
  center1: Point2D, radius1: number, startAngle1Deg: number, endAngle1Deg: number, isFullCircle1: boolean,
  center2: Point2D, radius2: number, startAngle2Deg: number, endAngle2Deg: number, isFullCircle2: boolean,
): Array<{ point: Point2D }> {
  const dxC = center2.x - center1.x;
  const dyC = center2.y - center1.y;
  const d = Math.sqrt(dxC * dxC + dyC * dyC);

  // Degenerate: coincident centers with same radius → infinite intersections (skip)
  if (d < 1e-9) return [];

  // No intersection: too far apart or one inside the other
  if (d > radius1 + radius2 + 1e-9) return [];
  if (d < Math.abs(radius1 - radius2) - 1e-9) return [];

  const a = (radius1 * radius1 - radius2 * radius2 + d * d) / (2 * d);
  const hSq = radius1 * radius1 - a * a;
  // Tangent case: h ≈ 0 → single intersection point
  const h = hSq > 0 ? Math.sqrt(hSq) : 0;

  // Unit vector from center1 to center2
  const ux = dxC / d;
  const uy = dyC / d;

  // Point on the radical line
  const px = center1.x + a * ux;
  const py = center1.y + a * uy;

  const candidates: Point2D[] = [];

  if (h < 1e-9) {
    // Single tangent point
    candidates.push({ x: px, y: py });
  } else {
    // Two intersection points (perpendicular offset)
    candidates.push({ x: px + h * uy, y: py - h * ux });
    candidates.push({ x: px - h * uy, y: py + h * ux });
  }

  // Filter: check each candidate against angular range of BOTH arcs
  const results: Array<{ point: Point2D }> = [];
  for (const pt of candidates) {
    const inArc1 = isPointInArcRange(pt, center1, startAngle1Deg, endAngle1Deg, isFullCircle1);
    const inArc2 = isPointInArcRange(pt, center2, startAngle2Deg, endAngle2Deg, isFullCircle2);
    if (inArc1 && inArc2) {
      results.push({ point: pt });
    }
  }
  return results;
}

/** Check if a point on a circle is within the arc's angular range */
function isPointInArcRange(
  pt: Point2D, center: Point2D,
  startAngleDeg: number, endAngleDeg: number,
  isFullCircle: boolean,
): boolean {
  if (isFullCircle) return true;

  let angleDeg = Math.atan2(pt.y - center.y, pt.x - center.x) * (180 / Math.PI);
  if (angleDeg < 0) angleDeg += 360;

  const s = normalizeAngleDeg(startAngleDeg);
  const e = normalizeAngleDeg(endAngleDeg);

  if (s <= e) {
    return angleDeg >= s - 0.01 && angleDeg <= e + 0.01;
  }
  // Arc wraps around 0°
  return angleDeg >= s - 0.01 || angleDeg <= e + 0.01;
}

// ============================================================================
// HOOK
// ============================================================================

export interface UseConstructionPointStateReturn {
  /** All current construction points (readonly snapshot) */
  points: readonly ConstructionPoint[];
  /** Total point count */
  pointCount: number;

  /** Add a single point. Returns the command for undo. */
  addPoint: (point: Point2D, label?: string | null) => AddConstructionPointCommand;
  /** Add equally-spaced points between start and end. Returns the command. */
  addSegmentPoints: (start: Point2D, end: Point2D, segmentCount: number) => AddConstructionPointBatchCommand;
  /** Add points at fixed distance intervals between start and end. Returns the command. */
  addDistancePoints: (start: Point2D, end: Point2D, distance: number) => AddConstructionPointBatchCommand;
  /** §3.9: Add equally-spaced points along an arc/circle. Returns the command. */
  addArcSegmentPoints: (
    center: Point2D, radius: number, startAngleDeg: number, endAngleDeg: number,
    count: number, isFullCircle: boolean,
  ) => AddConstructionPointBatchCommand;
  /** §3.10: Add points at fixed arc-length distance along an arc/circle. Returns the command. */
  addArcDistancePoints: (
    center: Point2D, radius: number, startAngleDeg: number, endAngleDeg: number,
    distance: number, isFullCircle: boolean,
  ) => AddConstructionPointBatchCommand;
  /** §3.12: Add intersection points of a line segment with an arc/circle. Returns the command. */
  addLineArcIntersectionPoints: (
    lineStart: Point2D, lineEnd: Point2D,
    center: Point2D, radius: number, startAngleDeg: number, endAngleDeg: number,
    isFullCircle: boolean,
  ) => AddConstructionPointBatchCommand;
  /** §3.11: Add intersection points of two arcs/circles. Returns the command. */
  addCircleCircleIntersectionPoints: (
    center1: Point2D, radius1: number, startAngle1Deg: number, endAngle1Deg: number, isFullCircle1: boolean,
    center2: Point2D, radius2: number, startAngle2Deg: number, endAngle2Deg: number, isFullCircle2: boolean,
  ) => AddConstructionPointBatchCommand;
  /** Delete a point by ID. Returns the command. */
  deletePoint: (pointId: string) => DeleteConstructionPointCommand;
  /** Find the nearest visible point to a world position */
  findNearest: (worldPoint: Point2D, maxDistance: number) => ConstructionPoint | null;
  /** Clear all points (not undoable) */
  clearAll: () => void;
  /** Direct access to the store singleton */
  getStore: () => ReturnType<typeof getGlobalConstructionPointStore>;
}

/**
 * React hook for the Construction Snap Points system.
 *
 * Usage:
 * ```tsx
 * const { points, addPoint, addSegmentPoints, deletePoint } = useConstructionPointState();
 * ```
 */
export function useConstructionPointState(): UseConstructionPointStateReturn {
  const store = getGlobalConstructionPointStore();

  // Subscribe to store changes via useSyncExternalStore
  const points = useSyncExternalStore(
    (callback) => store.subscribe(callback),
    () => store.getPoints(),
    () => store.getPoints(),
  );

  const pointCount = useSyncExternalStore(
    (callback) => store.subscribe(callback),
    () => store.count,
    () => store.count,
  );

  // ── Mutations ──

  const addPoint = useCallback((point: Point2D, label: string | null = null): AddConstructionPointCommand => {
    const cmd = new AddConstructionPointCommand(store, point, label);
    cmd.execute();
    return cmd;
  }, [store]);

  const addSegmentPoints = useCallback((start: Point2D, end: Point2D, segmentCount: number): AddConstructionPointBatchCommand => {
    const pointDefs = computeSegmentPoints(start, end, segmentCount);
    const cmd = new AddConstructionPointBatchCommand(store, pointDefs);
    cmd.execute();
    return cmd;
  }, [store]);

  const addDistancePoints = useCallback((start: Point2D, end: Point2D, distance: number): AddConstructionPointBatchCommand => {
    const pointDefs = computeDistancePoints(start, end, distance);
    const cmd = new AddConstructionPointBatchCommand(store, pointDefs);
    cmd.execute();
    return cmd;
  }, [store]);

  // §3.9: Arc segment points
  const addArcSegmentPoints = useCallback((
    center: Point2D, radius: number, startAngleDeg: number, endAngleDeg: number,
    count: number, isFullCircle: boolean,
  ): AddConstructionPointBatchCommand => {
    const pointDefs = computeArcSegmentPoints(center, radius, startAngleDeg, endAngleDeg, count, isFullCircle);
    const cmd = new AddConstructionPointBatchCommand(store, pointDefs);
    cmd.execute();
    return cmd;
  }, [store]);

  // §3.10: Arc distance points
  const addArcDistancePoints = useCallback((
    center: Point2D, radius: number, startAngleDeg: number, endAngleDeg: number,
    distance: number, isFullCircle: boolean,
  ): AddConstructionPointBatchCommand => {
    const pointDefs = computeArcDistancePoints(center, radius, startAngleDeg, endAngleDeg, distance, isFullCircle);
    const cmd = new AddConstructionPointBatchCommand(store, pointDefs);
    cmd.execute();
    return cmd;
  }, [store]);

  // §3.12: Line-arc intersection points
  const addLineArcIntersectionPoints = useCallback((
    lineStart: Point2D, lineEnd: Point2D,
    center: Point2D, radius: number, startAngleDeg: number, endAngleDeg: number,
    isFullCircle: boolean,
  ): AddConstructionPointBatchCommand => {
    const pointDefs = computeLineArcIntersection(lineStart, lineEnd, center, radius, startAngleDeg, endAngleDeg, isFullCircle);
    const cmd = new AddConstructionPointBatchCommand(store, pointDefs);
    cmd.execute();
    return cmd;
  }, [store]);

  // §3.11: Circle-circle intersection points
  const addCircleCircleIntersectionPoints = useCallback((
    center1: Point2D, radius1: number, startAngle1Deg: number, endAngle1Deg: number, isFullCircle1: boolean,
    center2: Point2D, radius2: number, startAngle2Deg: number, endAngle2Deg: number, isFullCircle2: boolean,
  ): AddConstructionPointBatchCommand => {
    const pointDefs = computeCircleCircleIntersection(
      center1, radius1, startAngle1Deg, endAngle1Deg, isFullCircle1,
      center2, radius2, startAngle2Deg, endAngle2Deg, isFullCircle2,
    );
    const cmd = new AddConstructionPointBatchCommand(store, pointDefs);
    cmd.execute();
    return cmd;
  }, [store]);

  const deletePoint = useCallback((pointId: string): DeleteConstructionPointCommand => {
    const cmd = new DeleteConstructionPointCommand(store, pointId);
    cmd.execute();
    return cmd;
  }, [store]);

  const findNearest = useCallback((worldPoint: Point2D, maxDistance: number): ConstructionPoint | null => {
    return store.findNearestPoint(worldPoint, maxDistance);
  }, [store]);

  const clearAll = useCallback(() => {
    store.clearAll();
  }, [store]);

  const getStore = useCallback(() => store, [store]);

  return {
    points,
    pointCount,
    addPoint,
    addSegmentPoints,
    addDistancePoints,
    addArcSegmentPoints,
    addArcDistancePoints,
    addLineArcIntersectionPoints,
    addCircleCircleIntersectionPoints,
    deletePoint,
    findNearest,
    clearAll,
    getStore,
  };
}
