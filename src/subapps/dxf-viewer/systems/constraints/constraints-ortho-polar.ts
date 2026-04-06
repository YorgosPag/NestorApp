/**
 * CONSTRAINTS SYSTEM — ORTHO & POLAR ENGINES
 *
 * Extracted from utils.ts (ADR-065 Phase 5)
 * Ortho (orthogonal) and Polar constraint application and feedback
 */

import type {
  ConstraintFeedback,
  OrthoConstraintSettings,
  PolarConstraintSettings,
} from './config';
import { CONSTRAINTS_CONFIG } from './config';
import type { Point2D } from '../../rendering/types/Types';
import { AngleUtils, DistanceUtils, CoordinateUtils } from './constraints-geometry';

// ===== HELPERS =====

/** Create default visual constraint feedback object */
function createVisualConstraintFeedback(): ConstraintFeedback {
  return {
    type: 'visual',
    visual: {
      lines: [],
      circles: [],
      arcs: [],
      text: [],
      markers: []
    }
  };
}

// ===== ORTHO CONSTRAINT UTILITIES =====

export const OrthoUtils = {
  /** Applies orthogonal constraint to a point */
  applyOrthoConstraint: (
    point: Point2D,
    referencePoint: Point2D,
    settings: OrthoConstraintSettings
  ): Point2D => {
    if (!settings.enabled) return point;

    const angle = AngleUtils.angleBetweenPoints(referencePoint, point);
    let constrainedAngle: number | null = null;

    // Check cardinal directions if enabled
    if (settings.lockAxes.horizontal || settings.lockAxes.vertical) {
      const cardinalAngles = [];
      if (settings.lockAxes.horizontal) cardinalAngles.push(0, 180);
      if (settings.lockAxes.vertical) cardinalAngles.push(90, 270);

      for (const cardinalAngle of cardinalAngles) {
        if (AngleUtils.isAngleWithinTolerance(angle, cardinalAngle, settings.tolerance)) {
          constrainedAngle = cardinalAngle;
          break;
        }
      }
    }

    // Check diagonal directions if enabled
    if (constrainedAngle === null && settings.lockAxes.diagonal) {
      for (const diagonalAngle of CONSTRAINTS_CONFIG.DIAGONAL_ANGLES) {
        if (AngleUtils.isAngleWithinTolerance(angle, diagonalAngle, settings.tolerance)) {
          constrainedAngle = diagonalAngle;
          break;
        }
      }
    }

    // Check angle step snapping
    if (constrainedAngle === null) {
      constrainedAngle = AngleUtils.snapAngleToStep(angle, settings.angleStep, settings.tolerance);
    }

    if (constrainedAngle !== null) {
      const distance = DistanceUtils.distance(referencePoint, point);
      return CoordinateUtils.polarToCartesian(
        { distance, angle: constrainedAngle, angleUnit: 'degrees' },
        referencePoint
      );
    }

    return point;
  },

  /** Gets ortho constraint feedback */
  getOrthoFeedback: (
    point: Point2D,
    referencePoint: Point2D,
    settings: OrthoConstraintSettings
  ): ConstraintFeedback => {
    if (!settings.enabled || !settings.visualFeedback.showConstraintLines) {
      return { type: 'visual' };
    }

    const feedback = createVisualConstraintFeedback();

    const distance = DistanceUtils.distance(referencePoint, point);

    const constraintAngles = [];
    if (settings.lockAxes.horizontal) constraintAngles.push(0, 180);
    if (settings.lockAxes.vertical) constraintAngles.push(90, 270);
    if (settings.lockAxes.diagonal) constraintAngles.push(...CONSTRAINTS_CONFIG.DIAGONAL_ANGLES);

    for (const constraintAngle of constraintAngles) {
      const endPoint = CoordinateUtils.polarToCartesian(
        { distance: Math.max(distance, 50), angle: constraintAngle, angleUnit: 'degrees' },
        referencePoint
      );

      feedback.visual!.lines!.push({
        start: referencePoint,
        end: endPoint,
        color: settings.visualFeedback.lineColor,
        width: settings.visualFeedback.lineWidth,
        style: settings.visualFeedback.lineStyle
      });
    }

    return feedback;
  }
};

// ===== POLAR CONSTRAINT UTILITIES =====

export const PolarUtils = {
  /** Applies polar constraint to a point */
  applyPolarConstraint: (
    point: Point2D,
    settings: PolarConstraintSettings
  ): Point2D => {
    if (!settings.enabled) return point;

    const polar = CoordinateUtils.cartesianToPolar(point, settings.basePoint, settings.baseAngle);
    let constrainedAngle = polar.angle;
    let constrainedDistance = polar.distance;

    const snappedAngle = AngleUtils.snapAngleToStep(
      polar.angle,
      settings.angleStep,
      settings.angleTolerance
    );
    if (snappedAngle !== null) {
      constrainedAngle = snappedAngle;
    }

    if (settings.behavior.lockDistance) {
      const snappedDistance = DistanceUtils.snapDistanceToStep(
        polar.distance,
        settings.distanceStep,
        settings.distanceTolerance
      );
      if (snappedDistance !== null) {
        constrainedDistance = snappedDistance;
      }
    }

    return CoordinateUtils.polarToCartesian(
      { distance: constrainedDistance, angle: constrainedAngle, angleUnit: 'degrees' },
      settings.basePoint,
      settings.baseAngle
    );
  },

  /** Gets polar constraint feedback */
  getPolarFeedback: (
    point: Point2D,
    settings: PolarConstraintSettings
  ): ConstraintFeedback => {
    if (!settings.enabled) {
      return { type: 'visual' };
    }

    const feedback = createVisualConstraintFeedback();
    const polar = CoordinateUtils.cartesianToPolar(point, settings.basePoint, settings.baseAngle);

    if (settings.visualFeedback.showPolarRay) {
      const rayEnd = CoordinateUtils.polarToCartesian(
        { distance: settings.visualFeedback.rayLength, angle: polar.angle, angleUnit: 'degrees' },
        settings.basePoint,
        settings.baseAngle
      );

      feedback.visual!.lines!.push({
        start: settings.basePoint,
        end: rayEnd,
        color: settings.visualFeedback.rayColor,
        width: settings.visualFeedback.rayWidth,
        style: 'solid'
      });
    }

    if (settings.visualFeedback.showAngleArc) {
      feedback.visual!.arcs!.push({
        center: settings.basePoint,
        radius: settings.visualFeedback.arcRadius,
        startAngle: settings.baseAngle,
        endAngle: settings.baseAngle + polar.angle,
        color: settings.visualFeedback.arcColor,
        width: 1
      });
    }

    if (settings.visualFeedback.showDistanceMarker) {
      feedback.visual!.markers!.push({
        position: point,
        type: 'circle',
        color: settings.visualFeedback.markerColor,
        size: settings.visualFeedback.markerSize
      });
    }

    return feedback;
  },

  /** Gets tracking angles for polar constraint */
  getTrackingAngles: (settings: PolarConstraintSettings): number[] => {
    const angles: number[] = [];
    const baseAngle = settings.baseAngle;

    for (let angle = 0; angle < 360; angle += settings.angleStep) {
      angles.push(AngleUtils.normalizeAngle(baseAngle + angle));
    }

    return angles;
  }
};
