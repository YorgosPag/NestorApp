/**
 * ANGLE ENTITY MATH — Utilities for entity-based angle measurements
 *
 * Provides mathematical operations for calculating angles between:
 * - Two lines (constraint): intersection point + angle between directions
 * - Line and arc (line-arc): tangent at nearest arc point + line direction
 * - Two arcs (two-arcs): tangent directions at click points
 *
 * @module utils/angle-entity-math
 * @see ADR-078: Centralized Angle Between Vectors
 */

import type { Point2D } from '../rendering/types/Types';
import type { LineEntity, ArcEntity } from '../types/entities';
import { angleBetweenVectors } from '../rendering/entities/shared/geometry-rendering-utils';
import { degToRad, radToDeg } from '../rendering/entities/shared/geometry-utils';

// ============================================================================
// LINE INTERSECTION
// ============================================================================

/**
 * Find the intersection point of two infinite lines (extended beyond endpoints).
 * Returns null if lines are parallel (or nearly parallel).
 */
export function lineIntersection(
  line1Start: Point2D, line1End: Point2D,
  line2Start: Point2D, line2End: Point2D
): Point2D | null {
  const dx1 = line1End.x - line1Start.x;
  const dy1 = line1End.y - line1Start.y;
  const dx2 = line2End.x - line2Start.x;
  const dy2 = line2End.y - line2Start.y;

  const denom = dx1 * dy2 - dy1 * dx2;

  // Parallel lines (determinant ≈ 0)
  if (Math.abs(denom) < 1e-10) return null;

  const t = ((line2Start.x - line1Start.x) * dy2 - (line2Start.y - line1Start.y) * dx2) / denom;

  return {
    x: line1Start.x + t * dx1,
    y: line1Start.y + t * dy1,
  };
}

// ============================================================================
// ARC TANGENT
// ============================================================================

/**
 * Calculate the tangent direction vector at a point on an arc.
 * The tangent is perpendicular to the radius at that point.
 * Returns a unit vector in the arc's direction of travel (CCW positive).
 */
export function arcTangentAt(center: Point2D, point: Point2D, counterclockwise?: boolean): Point2D {
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  const len = Math.sqrt(dx * dx + dy * dy);

  if (len < 1e-10) return { x: 1, y: 0 }; // degenerate

  // Perpendicular to radius (CCW rotation of normalized radius)
  // CCW tangent: (-dy/len, dx/len)
  // CW tangent: (dy/len, -dx/len)
  if (counterclockwise === false) {
    return { x: dy / len, y: -dx / len };
  }
  return { x: -dy / len, y: dx / len };
}

// ============================================================================
// POINT-TO-ARC DISTANCE (HIT TESTING)
// ============================================================================

/**
 * Calculate the minimum distance from a point to an arc.
 * Checks if the point's angle is within the arc's angular range;
 * if not, returns distance to the nearest arc endpoint.
 */
export function pointToArcDistance(
  point: Point2D,
  arc: { center: Point2D; radius: number; startAngle: number; endAngle: number }
): number {
  const dx = point.x - arc.center.x;
  const dy = point.y - arc.center.y;
  const distToCenter = Math.sqrt(dx * dx + dy * dy);

  // Point angle in degrees (0-360 range)
  let pointAngleDeg = radToDeg(Math.atan2(dy, dx));
  if (pointAngleDeg < 0) pointAngleDeg += 360;

  // Check if point angle is within the arc's range
  if (isAngleInArcRange(pointAngleDeg, arc.startAngle, arc.endAngle)) {
    // Point is within arc angular range — distance = |dist_to_center - radius|
    return Math.abs(distToCenter - arc.radius);
  }

  // Point is outside angular range — distance to nearest endpoint
  const startPoint = arcEndpoint(arc.center, arc.radius, arc.startAngle);
  const endPoint = arcEndpoint(arc.center, arc.radius, arc.endAngle);

  const distToStart = Math.sqrt(
    (point.x - startPoint.x) ** 2 + (point.y - startPoint.y) ** 2
  );
  const distToEnd = Math.sqrt(
    (point.x - endPoint.x) ** 2 + (point.y - endPoint.y) ** 2
  );

  return Math.min(distToStart, distToEnd);
}

/**
 * Get the endpoint of an arc at a given angle (degrees).
 */
function arcEndpoint(center: Point2D, radius: number, angleDeg: number): Point2D {
  const rad = degToRad(angleDeg);
  return {
    x: center.x + radius * Math.cos(rad),
    y: center.y + radius * Math.sin(rad),
  };
}

/**
 * Check if an angle (degrees) is within an arc's angular range.
 * Handles wrap-around (e.g., start=350°, end=10° → covers 350→360→0→10).
 */
function isAngleInArcRange(angleDeg: number, startDeg: number, endDeg: number): boolean {
  // Normalize all to 0-360
  const a = ((angleDeg % 360) + 360) % 360;
  const s = ((startDeg % 360) + 360) % 360;
  const e = ((endDeg % 360) + 360) % 360;

  if (s <= e) {
    return a >= s && a <= e;
  }
  // Wrap-around: e.g. start=350, end=10
  return a >= s || a <= e;
}

/**
 * Project a click point onto an arc (find nearest point on the arc curve).
 */
export function projectPointOntoArc(
  point: Point2D,
  arc: { center: Point2D; radius: number; startAngle: number; endAngle: number }
): Point2D {
  const dx = point.x - arc.center.x;
  const dy = point.y - arc.center.y;
  let angleDeg = radToDeg(Math.atan2(dy, dx));
  if (angleDeg < 0) angleDeg += 360;

  // Clamp angle to arc range if outside
  if (!isAngleInArcRange(angleDeg, arc.startAngle, arc.endAngle)) {
    // Find which endpoint is closer
    const startPoint = arcEndpoint(arc.center, arc.radius, arc.startAngle);
    const endPoint = arcEndpoint(arc.center, arc.radius, arc.endAngle);
    const distToStart = (point.x - startPoint.x) ** 2 + (point.y - startPoint.y) ** 2;
    const distToEnd = (point.x - endPoint.x) ** 2 + (point.y - endPoint.y) ** 2;
    return distToStart < distToEnd ? startPoint : endPoint;
  }

  // Project: same angle, at arc radius
  const rad = degToRad(angleDeg);
  return {
    x: arc.center.x + arc.radius * Math.cos(rad),
    y: arc.center.y + arc.radius * Math.sin(rad),
  };
}

// ============================================================================
// ANGLE CALCULATIONS — 3 VARIANTS
// ============================================================================

/** Result of an angle measurement between two entities */
export interface AngleMeasurementResult {
  vertex: Point2D;
  point1: Point2D;
  point2: Point2D;
  angleDeg: number;
}

/**
 * Calculate angle between two lines (constraint variant).
 *
 * Finds the intersection of the two lines (extended as infinite lines),
 * then calculates the angle between their direction vectors.
 */
export function angleBetweenLines(
  line1: Pick<LineEntity, 'start' | 'end'>,
  line2: Pick<LineEntity, 'start' | 'end'>
): AngleMeasurementResult | null {
  // Find intersection point (vertex)
  const vertex = lineIntersection(line1.start, line1.end, line2.start, line2.end);
  if (!vertex) return null; // parallel lines

  // Direction vectors from vertex toward each line
  const dir1 = lineDirectionFromVertex(line1, vertex);
  const dir2 = lineDirectionFromVertex(line2, vertex);

  // Angle
  const angleRad = angleBetweenVectors(dir1, dir2);
  let angleDeg = Math.abs(radToDeg(angleRad));
  // Always report acute/obtuse angle (0-180)
  if (angleDeg > 180) angleDeg = 360 - angleDeg;

  // Arm endpoints: points on each line at a reasonable distance from vertex
  const armLen1 = lineArmLength(line1, vertex);
  const armLen2 = lineArmLength(line2, vertex);

  const point1 = {
    x: vertex.x + dir1.x * armLen1,
    y: vertex.y + dir1.y * armLen1,
  };
  const point2 = {
    x: vertex.x + dir2.x * armLen2,
    y: vertex.y + dir2.y * armLen2,
  };

  return { vertex, point1, point2, angleDeg };
}

/**
 * Calculate angle between a line and an arc (line-arc variant).
 *
 * Projects the click point onto the arc, calculates the arc's tangent at that point,
 * then measures the angle between the line direction and the tangent.
 */
export function angleBetweenLineAndArc(
  line: Pick<LineEntity, 'start' | 'end'>,
  arc: Pick<ArcEntity, 'center' | 'radius' | 'startAngle' | 'endAngle' | 'counterclockwise'>,
  arcClickPoint: Point2D
): AngleMeasurementResult | null {
  // Project click point onto arc
  const arcPoint = projectPointOntoArc(arcClickPoint, arc);

  // Arc tangent at that point
  const tangent = arcTangentAt(arc.center, arcPoint, arc.counterclockwise);

  // Line direction
  const lineDir = normalizeVec(
    { x: line.end.x - line.start.x, y: line.end.y - line.start.y }
  );

  // Vertex = the point on the arc
  const vertex = arcPoint;

  // Angle between line direction and tangent
  const angleRad = angleBetweenVectors(lineDir, tangent);
  let angleDeg = Math.abs(radToDeg(angleRad));
  if (angleDeg > 180) angleDeg = 360 - angleDeg;

  // Arm endpoints
  const armLen = Math.max(20, arc.radius * 0.5);
  const point1 = { x: vertex.x + lineDir.x * armLen, y: vertex.y + lineDir.y * armLen };
  const point2 = { x: vertex.x + tangent.x * armLen, y: vertex.y + tangent.y * armLen };

  return { vertex, point1, point2, angleDeg };
}

/**
 * Calculate angle between two arcs (two-arcs variant).
 *
 * For each arc, projects the click point and gets the tangent direction.
 * The vertex is the midpoint of the two arc points.
 */
export function angleBetweenTwoArcs(
  arc1: Pick<ArcEntity, 'center' | 'radius' | 'startAngle' | 'endAngle' | 'counterclockwise'>,
  arc1ClickPoint: Point2D,
  arc2: Pick<ArcEntity, 'center' | 'radius' | 'startAngle' | 'endAngle' | 'counterclockwise'>,
  arc2ClickPoint: Point2D
): AngleMeasurementResult | null {
  // Project click points onto arcs
  const arcPoint1 = projectPointOntoArc(arc1ClickPoint, arc1);
  const arcPoint2 = projectPointOntoArc(arc2ClickPoint, arc2);

  // Tangent directions
  const tangent1 = arcTangentAt(arc1.center, arcPoint1, arc1.counterclockwise);
  const tangent2 = arcTangentAt(arc2.center, arcPoint2, arc2.counterclockwise);

  // Vertex = midpoint of the two arc points
  const vertex = {
    x: (arcPoint1.x + arcPoint2.x) / 2,
    y: (arcPoint1.y + arcPoint2.y) / 2,
  };

  // Angle between tangents
  const angleRad = angleBetweenVectors(tangent1, tangent2);
  let angleDeg = Math.abs(radToDeg(angleRad));
  if (angleDeg > 180) angleDeg = 360 - angleDeg;

  // Arm endpoints from vertex along tangent directions
  const armLen = Math.max(20,
    Math.max(arc1.radius, arc2.radius) * 0.5
  );
  const point1 = { x: vertex.x + tangent1.x * armLen, y: vertex.y + tangent1.y * armLen };
  const point2 = { x: vertex.x + tangent2.x * armLen, y: vertex.y + tangent2.y * armLen };

  return { vertex, point1, point2, angleDeg };
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/** Get direction vector from vertex toward the FARTHER endpoint of the line */
function lineDirectionFromVertex(
  line: Pick<LineEntity, 'start' | 'end'>,
  vertex: Point2D
): Point2D {
  const distToStart = Math.sqrt(
    (line.start.x - vertex.x) ** 2 + (line.start.y - vertex.y) ** 2
  );
  const distToEnd = Math.sqrt(
    (line.end.x - vertex.x) ** 2 + (line.end.y - vertex.y) ** 2
  );

  // Use the farther endpoint to define arm direction
  const target = distToEnd >= distToStart ? line.end : line.start;
  return normalizeVec({ x: target.x - vertex.x, y: target.y - vertex.y });
}

/** Get arm length = distance from vertex to farther endpoint */
function lineArmLength(
  line: Pick<LineEntity, 'start' | 'end'>,
  vertex: Point2D
): number {
  const distToStart = Math.sqrt(
    (line.start.x - vertex.x) ** 2 + (line.start.y - vertex.y) ** 2
  );
  const distToEnd = Math.sqrt(
    (line.end.x - vertex.x) ** 2 + (line.end.y - vertex.y) ** 2
  );
  return Math.max(distToStart, distToEnd, 20);
}

/** Normalize a vector to unit length */
function normalizeVec(v: Point2D): Point2D {
  const len = Math.sqrt(v.x * v.x + v.y * v.y);
  if (len < 1e-10) return { x: 1, y: 0 };
  return { x: v.x / len, y: v.y / len };
}
