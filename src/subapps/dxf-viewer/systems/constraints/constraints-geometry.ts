/**
 * CONSTRAINTS SYSTEM — GEOMETRY UTILITIES
 *
 * Extracted from utils.ts (ADR-065 Phase 5)
 * Pure geometric calculation utilities: angle, distance, coordinate conversion
 */

import type { PolarCoordinates, CartesianCoordinates } from './config';
import { CONSTRAINTS_CONFIG } from './config';
import type { Point2D } from '../../rendering/types/Types';
import { calculateDistance, vectorMagnitude, calculateAngle, vectorAngle, getUnitVector } from '../../rendering/entities/shared/geometry-rendering-utils';
import { degToRad, radToDeg, normalizeAngleDeg } from '../../rendering/entities/shared/geometry-utils';

// ===== ANGLE UTILITIES =====

export const AngleUtils = {
  /** Normalizes angle to 0-360 degree range (ADR-068) */
  normalizeAngle: normalizeAngleDeg,

  /** Converts degrees to radians (ADR-067) */
  degreesToRadians: degToRad,

  /** Converts radians to degrees (ADR-067) */
  radiansToDegrees: radToDeg,

  /** Calculates angle between two points in degrees, normalized 0-360 (ADR-076) */
  angleBetweenPoints: (point1: Point2D, point2: Point2D): number => {
    return AngleUtils.normalizeAngle(AngleUtils.radiansToDegrees(calculateAngle(point1, point2)));
  },

  /** Snaps angle to nearest step increment within tolerance */
  snapAngleToStep: (angle: number, step: number, tolerance: number): number | null => {
    const normalizedAngle = AngleUtils.normalizeAngle(angle);
    const nearestStep = Math.round(normalizedAngle / step) * step;
    const difference = Math.abs(normalizedAngle - nearestStep);

    if (difference <= tolerance || difference >= (360 - tolerance)) {
      return AngleUtils.normalizeAngle(nearestStep);
    }

    return null;
  },

  /** Checks if angle is within tolerance of target angle */
  isAngleWithinTolerance: (angle: number, targetAngle: number, tolerance: number): boolean => {
    const normalizedAngle = AngleUtils.normalizeAngle(angle);
    const normalizedTarget = AngleUtils.normalizeAngle(targetAngle);

    const difference = Math.abs(normalizedAngle - normalizedTarget);
    return difference <= tolerance || difference >= (360 - tolerance);
  },

  /** Gets the closest cardinal direction angle (0, 90, 180, 270) */
  getClosestCardinalAngle: (angle: number): number => {
    const normalizedAngle = AngleUtils.normalizeAngle(angle);
    const cardinalAngles = CONSTRAINTS_CONFIG.CARDINAL_ANGLES;

    return cardinalAngles.reduce((closest, cardinal) => {
      const diffCurrent = Math.abs(normalizedAngle - cardinal);
      const diffClosest = Math.abs(normalizedAngle - closest);
      return diffCurrent < diffClosest ? cardinal : closest;
    }, cardinalAngles[0]);
  },

  /** Gets the closest diagonal angle (45, 135, 225, 315) */
  getClosestDiagonalAngle: (angle: number): number => {
    const normalizedAngle = AngleUtils.normalizeAngle(angle);
    const diagonalAngles = CONSTRAINTS_CONFIG.DIAGONAL_ANGLES;

    return diagonalAngles.reduce((closest, diagonal) => {
      const diffCurrent = Math.abs(normalizedAngle - diagonal);
      const diffClosest = Math.abs(normalizedAngle - closest);
      return diffCurrent < diffClosest ? diagonal : closest;
    }, diagonalAngles[0]);
  }
};

// ===== DISTANCE UTILITIES =====

export const DistanceUtils = {
  /** Calculates distance between two points (ADR-065) */
  distance: calculateDistance,

  /** Snaps distance to nearest step increment within tolerance */
  snapDistanceToStep: (distance: number, step: number, tolerance: number): number | null => {
    const nearestStep = Math.round(distance / step) * step;
    const difference = Math.abs(distance - nearestStep);

    return difference <= tolerance ? nearestStep : null;
  },

  /** Checks if distance is within tolerance of target distance */
  isDistanceWithinTolerance: (distance: number, targetDistance: number, tolerance: number): boolean => {
    return Math.abs(distance - targetDistance) <= tolerance;
  }
};

// ===== COORDINATE CONVERSION UTILITIES =====

export const CoordinateUtils = {
  /** Converts cartesian coordinates to polar */
  cartesianToPolar: (
    point: Point2D,
    basePoint: Point2D = { x: 0, y: 0 },
    baseAngle: number = 0
  ): PolarCoordinates => {
    const relativePoint = {
      x: point.x - basePoint.x,
      y: point.y - basePoint.y
    };

    const distance = vectorMagnitude(relativePoint);
    const angle = AngleUtils.normalizeAngle(
      AngleUtils.radiansToDegrees(vectorAngle(relativePoint)) - baseAngle
    );

    return { distance, angle, angleUnit: 'degrees' };
  },

  /** Converts polar coordinates to cartesian */
  polarToCartesian: (
    polar: PolarCoordinates,
    basePoint: Point2D = { x: 0, y: 0 },
    baseAngle: number = 0
  ): CartesianCoordinates => {
    const totalAngle = polar.angle + baseAngle;
    const radians = AngleUtils.degreesToRadians(totalAngle);

    return {
      x: basePoint.x + polar.distance * Math.cos(radians),
      y: basePoint.y + polar.distance * Math.sin(radians)
    };
  },

  /** Projects point onto line defined by two points */
  projectPointOnLine: (point: Point2D, lineStart: Point2D, lineEnd: Point2D): Point2D => {
    const length = calculateDistance(lineStart, lineEnd);
    if (length === 0) return lineStart;

    const unit = getUnitVector(lineStart, lineEnd);
    const dotProduct = (point.x - lineStart.x) * unit.x + (point.y - lineStart.y) * unit.y;

    return {
      x: lineStart.x + dotProduct * unit.x,
      y: lineStart.y + dotProduct * unit.y
    };
  },

  /** Gets perpendicular point from a point to a line */
  getPerpendicularPoint: (point: Point2D, lineStart: Point2D, lineEnd: Point2D): Point2D => {
    return CoordinateUtils.projectPointOnLine(point, lineStart, lineEnd);
  }
};

// Backward compatibility alias
export const CoordinateConverter = CoordinateUtils;
