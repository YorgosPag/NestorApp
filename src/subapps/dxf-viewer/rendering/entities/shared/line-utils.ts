/**
 * Shared utilities for line-based renderers (LineRenderer, PolylineRenderer)
 * Eliminates duplication in line/edge rendering logic
 */

import type { Point2D } from '../../types/Types';
import type { GripInfo } from '../../types/Types';
// 🏢 ADR-067: Import radToDeg for centralized angle conversion
// 🏢 ADR-068: Import normalizeAngleDeg for centralized angle normalization
// 🏢 ADR-073: Import calculateMidpoint for centralized midpoint calculation
import { pointToLineDistance, radToDeg, normalizeAngleDeg, calculateMidpoint } from './geometry-utils';
// 🏢 ADR-065: Centralized Distance & Vector Operations
// 🏢 ADR-090: Centralized Point Vector Operations
import { calculateDistance, getUnitVector, offsetPoint } from './geometry-rendering-utils';
// 🏢 ADR-118: Centralized Zero Point Pattern
import { ZERO_VECTOR } from '../../../config/geometry-constants';

/**
 * Creates edge midpoint grips for line-based entities
 */
export function createEdgeGrips(
  entityId: string,
  vertices: Point2D[],
  closed: boolean = false,
  baseIndex: number = 0
): GripInfo[] {
  const grips: GripInfo[] = [];
  
  // Edge midpoint grips for regular segments
  for (let i = 0; i < vertices.length - 1; i++) {
    // 🏢 ADR-073: Use centralized midpoint calculation
    const midpoint = calculateMidpoint(vertices[i], vertices[i + 1]);
    
    grips.push({
      id: `${entityId}-edge-${baseIndex + i}`,
      entityId,
      type: 'edge',
      gripIndex: baseIndex + i,
      position: midpoint,
      isVisible: true
    });
  }
  
  // Add closing edge grip for closed polylines
  if (closed && vertices.length > 2) {
    // 🏢 ADR-073: Use centralized midpoint calculation
    const midpoint = calculateMidpoint(vertices[vertices.length - 1], vertices[0]);
    
    grips.push({
      id: `${entityId}-edge-${baseIndex + vertices.length - 1}`,
      entityId,
      type: 'edge',
      gripIndex: baseIndex + vertices.length - 1,
      position: midpoint,
      isVisible: true
    });
  }
  
  return grips;
}

/**
 * 🔺 ΚΕΝΤΡΙΚΟΠΟΙΗΜΈΝΟ HIT TEST ΓΙΑ CIRCULAR ENTITIES
 * Μείωση διπλότυπου hit test pattern στους ArcRenderer, CircleRenderer, EllipseRenderer
 */
export function hitTestCircularEntity(
  point: Point2D,
  center: Point2D,
  radius: number,
  tolerance: number,
  transform: { scale: number }
): boolean {
  // 🏢 ADR-065: Use centralized distance calculation
  const distance = calculateDistance(point, center);

  // Check if point is near the circle's radius
  const worldTolerance = tolerance / transform.scale;
  return Math.abs(distance - radius) <= worldTolerance;
}

/**
 * 🔺 ΚΕΝΤΡΙΚΟΠΟΙΗΜΈΝΟ HIT TEST ΓΙΑ ARC ENTITIES
 * Έλεγχος αν ένα σημείο είναι κοντά στο τόξο (συμπεριλαμβάνει angle range check)
 */
export function hitTestArcEntity(
  point: Point2D,
  center: Point2D,
  radius: number,
  startAngle: number, // σε μοίρες
  endAngle: number,   // σε μοίρες
  tolerance: number,
  transform: { scale: number }
): boolean {
  // First check distance
  if (!hitTestCircularEntity(point, center, radius, tolerance, transform)) {
    return false;
  }
  
  // 🏢 ADR-067: Use centralized angle conversion
  // 🏢 ADR-068: Use centralized angle normalization
  const angle = normalizeAngleDeg(radToDeg(Math.atan2(point.y - center.y, point.x - center.x)));

  // Normalize angles
  const start = normalizeAngleDeg(startAngle);
  const end = normalizeAngleDeg(endAngle);
  
  // Check if angle is within arc range
  if (start <= end) {
    return angle >= start && angle <= end;
  } else {
    // Arc crosses 0 degrees
    return angle >= start || angle <= end;
  }
}

/**
 * Hit test for line segments - works for both single lines and polylines
 */
export function hitTestLineSegments(
  testPoint: Point2D,
  vertices: Point2D[],
  tolerance: number,
  closed: boolean = false,
  worldToScreen: (point: Point2D) => Point2D
): boolean {
  const screenPoint = worldToScreen(testPoint);
  const screenVertices = vertices.map(v => worldToScreen(v));
  
  // Check each segment
  for (let i = 0; i < screenVertices.length - 1; i++) {
    const distance = pointToLineDistance(
      screenPoint,
      screenVertices[i],
      screenVertices[i + 1]
    );
    
    if (distance <= tolerance) return true;
  }
  
  // Check closing segment if closed
  if (closed && screenVertices.length > 2) {
    const distance = pointToLineDistance(
      screenPoint,
      screenVertices[screenVertices.length - 1],
      screenVertices[0]
    );
    
    if (distance <= tolerance) return true;
  }
  
  return false;
}

/**
 * Calculate perimeter for polylines and closed shapes
 */
export function calculatePerimeter(vertices: Point2D[], closed: boolean = false): number {
  let perimeter = 0;
  
  for (let i = 0; i < vertices.length - 1; i++) {
    perimeter += calculateDistance(vertices[i], vertices[i + 1]);
  }
  
  if (closed && vertices.length > 2) {
    perimeter += calculateDistance(vertices[vertices.length - 1], vertices[0]);
  }
  
  return perimeter;
}

/**
 * Calculate split line gap points for text positioning
 */
export function calculateSplitLineGap(
  screenStart: Point2D,
  screenEnd: Point2D,
  gapSize: number = 30
): { gapStart: Point2D; gapEnd: Point2D; midpoint: Point2D; unitVector: Point2D } {
  const dx = screenEnd.x - screenStart.x;
  const dy = screenEnd.y - screenStart.y;
  // 🏢 ADR-065: Use centralized distance calculation
  const length = calculateDistance(screenStart, screenEnd);

  if (length === 0) {
    return {
      gapStart: screenStart,
      gapEnd: screenEnd,
      midpoint: screenStart,
      // 🏢 ADR-118: Use centralized ZERO_VECTOR for zero-length line
      unitVector: ZERO_VECTOR
    };
  }

  // 🏢 ADR-065: Use centralized unit vector calculation
  const unit = getUnitVector(screenStart, screenEnd);

  // 🏢 ADR-073: Use centralized midpoint calculation
  const mid = calculateMidpoint(screenStart, screenEnd);

  // Calculate gap points (half gap on each side of center)
  // 🏢 ADR-090: Use centralized offsetPoint for gap calculations
  const gapHalf = gapSize / 2;
  const gapStart = offsetPoint(mid, unit, -gapHalf);
  const gapEnd = offsetPoint(mid, unit, gapHalf);

  return {
    gapStart,
    gapEnd,
    midpoint: mid,
    unitVector: unit
  };
}

/**
 * Render split line with gap (used by both LineRenderer and PolylineRenderer)
 */
export function renderSplitLine(
  ctx: CanvasRenderingContext2D,
  screenStart: Point2D,
  screenEnd: Point2D,
  gapSize: number = 30
): { midpoint: Point2D } {
  const { gapStart, gapEnd, midpoint } = calculateSplitLineGap(screenStart, screenEnd, gapSize);

  // Draw first segment
  ctx.beginPath();
  ctx.moveTo(screenStart.x, screenStart.y);
  ctx.lineTo(gapStart.x, gapStart.y);
  ctx.stroke();

  // Draw second segment
  ctx.beginPath();
  ctx.moveTo(gapEnd.x, gapEnd.y);
  ctx.lineTo(screenEnd.x, screenEnd.y);
  ctx.stroke();

  return { midpoint };
}

// 🏢 ADR-085: Re-export from line-rendering-utils.ts (CANONICAL SOURCE)
// These functions are maintained in line-rendering-utils.ts for single source of truth.
// Re-exported here for backward compatibility with existing imports.
export {
  renderLineWithTextCheck,
  renderContinuousLine,
  renderSplitLineWithGap
} from './line-rendering-utils';