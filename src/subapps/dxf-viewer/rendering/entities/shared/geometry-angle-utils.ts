/**
 * GEOMETRY ANGLE UTILITIES
 * ADR-065: Extracted from geometry-utils.ts — Angle conversion, normalization, constants, text rotation
 */

import type { Point2D } from '../../types/Types';
// 🏢 ADR-065: Centralized Distance Calculation & Angle Calculation
// 🏢 ADR-070: Centralized Vector Magnitude
// 🏢 ADR-072: Centralized Dot Product
// 🏢 ADR-090: Centralized Point Vector Operations
import { calculateAngle, subtractPoints, dotProduct, vectorMagnitude } from './geometry-rendering-utils';
// 🏢 ADR-077: Centralized TAU Constant
import { TAU } from '../../primitives/canvasPaths';

// ===== BISECTOR ANGLE =====
// 🏢 ADR-073: Centralized Midpoint/Bisector Calculations (2026-01-31)

/**
 * Calculate the bisector angle between two angles
 * ✅ CENTRALIZED: Single source of truth για angle bisector
 *
 * Used for: angle measurement labels, polyline corner arcs, preview arc text
 *
 * @param angle1 - First angle in radians
 * @param angle2 - Second angle in radians
 * @returns The bisector angle (average of the two angles)
 *
 * @example
 * const bisector = bisectorAngle(angle1, angle2);
 * const labelX = vertex.x + Math.cos(bisector) * distance;
 */
export function bisectorAngle(angle1: number, angle2: number): number {
  return (angle1 + angle2) / 2;
}

// ===== ANGLE CALCULATIONS =====

/**
 * Calculate angle between two vectors from a common point
 */
export function angleBetweenPoints(vertex: Point2D, point1: Point2D, point2: Point2D): number {
  // 🏢 ADR-090: Use centralized point subtraction
  const v1 = subtractPoints(point1, vertex);
  const v2 = subtractPoints(point2, vertex);

  // 🏢 ADR-072: Use centralized dot product
  const dot = dotProduct(v1, v2);
  // 🏢 ADR-070: Use centralized vector magnitude
  const mag1 = vectorMagnitude(v1);
  const mag2 = vectorMagnitude(v2);

  if (mag1 === 0 || mag2 === 0) return 0;

  const cosAngle = dot / (mag1 * mag2);
  const clampedCos = Math.max(-1, Math.min(1, cosAngle));

  return Math.acos(clampedCos);
}

/**
 * Calculate angle from horizontal (0 to 2π)
 */
export function angleFromHorizontal(start: Point2D, end: Point2D): number {
  // 🏢 ADR-065: Use centralized calculateAngle
  let angle = calculateAngle(start, end);
  if (angle < 0) angle += TAU;
  return angle;
}

// ===== ANGLE CONVERSION CONSTANTS & FUNCTIONS =====
// 🏢 ADR-067: Centralized Radians/Degrees Conversion (2026-01-31)

/**
 * Conversion constant: degrees to radians
 * Usage: angleRadians = angleDegrees * DEGREES_TO_RADIANS
 */
export const DEGREES_TO_RADIANS = Math.PI / 180;

/**
 * Conversion constant: radians to degrees
 * Usage: angleDegrees = angleRadians * RADIANS_TO_DEGREES
 */
export const RADIANS_TO_DEGREES = 180 / Math.PI;

// ===== ANGULAR CONSTANTS =====
// 🏢 ADR-103: Centralized Angular Constants (2026-01-31)

/**
 * Right angle constant: 90° in radians (π/2)
 * Usage: Text rotation flip checks, vertical text rotation
 * @see text-labeling-utils.ts, BaseEntityRenderer.ts, RulerRenderer.ts, LayerRenderer.ts
 */
export const RIGHT_ANGLE = Math.PI / 2;  // ≈ 1.5708 rad (90°)

/**
 * Arrow angle constant: 30° in radians (π/6)
 * Usage: Arrow head rendering angles
 * @see ghost-entity-renderer.ts
 */
export const ARROW_ANGLE = Math.PI / 6;  // ≈ 0.5236 rad (30°)

/**
 * Convert degrees to radians
 * 🏢 ADR-067: Canonical source for deg→rad conversion
 */
export function degToRad(degrees: number): number {
  return degrees * DEGREES_TO_RADIANS;
}

/**
 * Convert radians to degrees
 * 🏢 ADR-067: Canonical source for rad→deg conversion
 */
export function radToDeg(radians: number): number {
  return radians * RADIANS_TO_DEGREES;
}

// ===== ANGLE NORMALIZATION =====
// 🏢 ADR-068: Centralized Angle Normalization (2026-01-31)
// 🏢 ADR-077: TAU imported from canvasPaths.ts (see imports at top)
// 🏢 ADR-134: Centralized Angle Difference Normalization (2026-02-01)

/**
 * 🏢 ADR-134: Normalize angle difference to (-π, π] range
 * Finds the "short" angular direction between two angles
 *
 * Mathematical range: (-π, π]
 * - Result > 0: counterclockwise direction
 * - Result < 0: clockwise direction
 *
 * Used by: arc direction detection, angle measurement, arc drawing tools
 *
 * @param angleDiff - Raw angle difference in radians (angle2 - angle1)
 * @returns Normalized angle in range (-π, π]
 *
 * @example
 * normalizeAngleDiff(3 * Math.PI)   // → π (wraps around)
 * normalizeAngleDiff(-3 * Math.PI)  // → -π (wraps around)
 * normalizeAngleDiff(Math.PI / 2)   // → π/2 (unchanged, already in range)
 * normalizeAngleDiff(-Math.PI)      // → π (boundary case: -π maps to π)
 */
export function normalizeAngleDiff(angleDiff: number): number {
  let diff = angleDiff;
  while (diff > Math.PI) diff -= TAU;
  while (diff <= -Math.PI) diff += TAU;
  return diff;
}

/**
 * Normalize angle in RADIANS to [0, 2π) range
 * Handles any input value (including multiple wraps and extreme values)
 *
 * @param radians - Angle in radians (any value)
 * @returns Normalized angle in [0, 2π) range
 *
 * @example
 * normalizeAngleRad(-Math.PI / 2)  // → 3π/2 (≈4.712)
 * normalizeAngleRad(3 * Math.PI)   // → π (≈3.142)
 * normalizeAngleRad(0)             // → 0
 */
export function normalizeAngleRad(radians: number): number {
  let normalized = radians % TAU;
  if (normalized < 0) normalized += TAU;
  return normalized;
}

/**
 * Normalize angle in DEGREES to [0, 360) range
 * Handles any input value (including multiple wraps and extreme values)
 *
 * @param degrees - Angle in degrees (any value)
 * @returns Normalized angle in [0, 360) range
 *
 * @example
 * normalizeAngleDeg(-90)   // → 270
 * normalizeAngleDeg(450)   // → 90
 * normalizeAngleDeg(360)   // → 0
 */
export function normalizeAngleDeg(degrees: number): number {
  let normalized = degrees % 360;
  if (normalized < 0) normalized += 360;
  return normalized;
}

// ===== TEXT ROTATION UTILITIES =====
// 🏢 ADR-112: Centralized Text Rotation Pattern (2026-02-01)

/**
 * 🏢 ENTERPRISE: Normalize angle to keep text readable (never upside-down)
 *
 * CAD Standard: AutoCAD/Revit/MicroStation pattern for text rendering.
 * If angle exceeds 90° (π/2), flips by adding π (180°) to keep text readable.
 *
 * @param angle - Original angle in radians
 * @returns Normalized angle for readable text
 *
 * @example
 * normalizeTextAngle(0)           // → 0 (horizontal, readable)
 * normalizeTextAngle(Math.PI/4)   // → π/4 (45°, readable)
 * normalizeTextAngle(Math.PI)     // → 0 (was 180°, flipped to 0°)
 * normalizeTextAngle(-Math.PI/2)  // → π/2 (was -90°, flipped)
 *
 * @see ADR-112: Text Rotation Pattern Centralization
 */
export function normalizeTextAngle(angle: number): number {
  if (Math.abs(angle) > RIGHT_ANGLE) {
    return angle + Math.PI;
  }
  return angle;
}

/**
 * 🏢 ENTERPRISE: Execute render function within rotated text context
 *
 * Handles the complete pattern: save → translate → normalize angle → rotate → render → restore
 * Eliminates duplicate code across text rendering functions.
 *
 * @param ctx - Canvas 2D rendering context
 * @param position - Text position with angle { x, y, angle }
 * @param renderFn - Function to execute (renders text at origin after transformation)
 *
 * @example
 * withTextRotation(ctx, { x: 100, y: 50, angle: Math.PI / 3 }, () => {
 *   ctx.fillText('Distance: 5.00', 0, 0);
 * });
 *
 * @see ADR-112: Text Rotation Pattern Centralization
 */
export function withTextRotation(
  ctx: CanvasRenderingContext2D,
  position: { x: number; y: number; angle: number },
  renderFn: () => void
): void {
  ctx.save();
  ctx.translate(position.x, position.y);
  ctx.rotate(normalizeTextAngle(position.angle));
  renderFn();
  ctx.restore();
}

/**
 * 🏢 ENTERPRISE: Execute render function with optional text rotation
 *
 * Useful when rotation is conditionally enabled (e.g., rotateWithLine option).
 * If angle is undefined, no rotation is applied.
 *
 * @param ctx - Canvas 2D rendering context
 * @param position - Text position { x, y }
 * @param angle - Optional angle in radians (if undefined, no rotation)
 * @param renderFn - Function to execute
 *
 * @example
 * // With rotation
 * withOptionalTextRotation(ctx, { x: 100, y: 50 }, Math.PI / 4, () => {
 *   ctx.fillText('Label', 0, 0);
 * });
 *
 * // Without rotation (angle undefined)
 * withOptionalTextRotation(ctx, { x: 100, y: 50 }, undefined, () => {
 *   ctx.fillText('Label', 0, 0);
 * });
 *
 * @see ADR-112: Text Rotation Pattern Centralization
 */
export function withOptionalTextRotation(
  ctx: CanvasRenderingContext2D,
  position: { x: number; y: number },
  angle: number | undefined,
  renderFn: () => void
): void {
  ctx.save();
  ctx.translate(position.x, position.y);
  if (angle !== undefined) {
    ctx.rotate(normalizeTextAngle(angle));
  }
  renderFn();
  ctx.restore();
}
