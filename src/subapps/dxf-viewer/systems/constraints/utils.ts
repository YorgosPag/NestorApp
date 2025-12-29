/**
 * CONSTRAINTS SYSTEM UTILITIES
 * Utility functions for ortho/polar constraints and geometric calculations
 */

import type {
  ConstraintType,
  ConstraintDefinition,
  ConstraintContext,
  ConstraintResult,
  ConstraintFeedback,
  OrthoConstraintSettings,
  PolarConstraintSettings,
  PolarCoordinates,
  CartesianCoordinates
} from './config';
import { CONSTRAINTS_CONFIG } from './config';
import type { Point2D } from '../../rendering/types/Types';

// ===== HELPER FUNCTIONS =====

/**
 * Validates angle step setting (shared validation logic)
 */
function validateAngleStep(angleStep: number, errors: string[]): void {
  if (angleStep <= 0 || angleStep > 180) {
    errors.push('Angle step must be between 0 and 180 degrees');
  }
}
/**
 * Create default visual constraint feedback object - eliminates duplicate feedback creation
 */
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

// ===== ANGLE UTILITIES =====
export const AngleUtils = {
  /**
   * Normalizes angle to 0-360 degree range
   */
  normalizeAngle: (angle: number): number => {
    while (angle < 0) angle += 360;
    while (angle >= 360) angle -= 360;
    return angle;
  },

  /**
   * Converts degrees to radians
   */
  degreesToRadians: (degrees: number): number => {
    return degrees * CONSTRAINTS_CONFIG.DEGREES_TO_RADIANS;
  },

  /**
   * Converts radians to degrees
   */
  radiansToDegrees: (radians: number): number => {
    return radians * CONSTRAINTS_CONFIG.RADIANS_TO_DEGREES;
  },

  /**
   * Calculates angle between two points
   */
  angleBetweenPoints: (point1: Point2D, point2: Point2D): number => {
    const dx = point2.x - point1.x;
    const dy = point2.y - point1.y;
    return AngleUtils.normalizeAngle(AngleUtils.radiansToDegrees(Math.atan2(dy, dx)));
  },

  /**
   * Snaps angle to nearest step increment within tolerance
   */
  snapAngleToStep: (angle: number, step: number, tolerance: number): number | null => {
    const normalizedAngle = AngleUtils.normalizeAngle(angle);
    const nearestStep = Math.round(normalizedAngle / step) * step;
    const difference = Math.abs(normalizedAngle - nearestStep);
    
    if (difference <= tolerance || difference >= (360 - tolerance)) {
      return AngleUtils.normalizeAngle(nearestStep);
    }
    
    return null;
  },

  /**
   * Checks if angle is within tolerance of target angle
   */
  isAngleWithinTolerance: (angle: number, targetAngle: number, tolerance: number): boolean => {
    const normalizedAngle = AngleUtils.normalizeAngle(angle);
    const normalizedTarget = AngleUtils.normalizeAngle(targetAngle);
    
    const difference = Math.abs(normalizedAngle - normalizedTarget);
    return difference <= tolerance || difference >= (360 - tolerance);
  },

  /**
   * Gets the closest cardinal direction angle (0, 90, 180, 270)
   */
  getClosestCardinalAngle: (angle: number): number => {
    const normalizedAngle = AngleUtils.normalizeAngle(angle);
    const cardinalAngles = CONSTRAINTS_CONFIG.CARDINAL_ANGLES;
    
    return cardinalAngles.reduce((closest, cardinal) => {
      const diffCurrent = Math.abs(normalizedAngle - cardinal);
      const diffClosest = Math.abs(normalizedAngle - closest);
      return diffCurrent < diffClosest ? cardinal : closest;
    }, cardinalAngles[0]);
  },

  /**
   * Gets the closest diagonal angle (45, 135, 225, 315)
   */
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
  /**
   * Calculates distance between two points
   */
  distance: (point1: Point2D, point2: Point2D): number => {
    const dx = point2.x - point1.x;
    const dy = point2.y - point1.y;
    return Math.sqrt(dx * dx + dy * dy);
  },

  /**
   * Snaps distance to nearest step increment within tolerance
   */
  snapDistanceToStep: (distance: number, step: number, tolerance: number): number | null => {
    const nearestStep = Math.round(distance / step) * step;
    const difference = Math.abs(distance - nearestStep);
    
    return difference <= tolerance ? nearestStep : null;
  },

  /**
   * Checks if distance is within tolerance of target distance
   */
  isDistanceWithinTolerance: (distance: number, targetDistance: number, tolerance: number): boolean => {
    return Math.abs(distance - targetDistance) <= tolerance;
  }
};

// ===== COORDINATE CONVERSION UTILITIES =====
export const CoordinateUtils = {
  /**
   * Converts cartesian coordinates to polar
   */
  cartesianToPolar: (
    point: Point2D, 
    basePoint: Point2D = { x: 0, y: 0 }, 
    baseAngle: number = 0
  ): PolarCoordinates => {
    const relativePoint = {
      x: point.x - basePoint.x,
      y: point.y - basePoint.y
    };
    
    const distance = Math.sqrt(relativePoint.x * relativePoint.x + relativePoint.y * relativePoint.y);
    const angle = AngleUtils.normalizeAngle(
      AngleUtils.radiansToDegrees(Math.atan2(relativePoint.y, relativePoint.x)) - baseAngle
    );
    
    return {
      distance,
      angle,
      angleUnit: 'degrees'
    };
  },

  /**
   * Converts polar coordinates to cartesian
   */
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

  /**
   * Projects point onto line defined by two points
   */
  projectPointOnLine: (point: Point2D, lineStart: Point2D, lineEnd: Point2D): Point2D => {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    if (length === 0) return lineStart;
    
    const unitX = dx / length;
    const unitY = dy / length;
    
    const dotProduct = (point.x - lineStart.x) * unitX + (point.y - lineStart.y) * unitY;
    
    return {
      x: lineStart.x + dotProduct * unitX,
      y: lineStart.y + dotProduct * unitY
    };
  },

  /**
   * Gets perpendicular point from a point to a line
   */
  getPerpendicularPoint: (point: Point2D, lineStart: Point2D, lineEnd: Point2D): Point2D => {
    return CoordinateUtils.projectPointOnLine(point, lineStart, lineEnd);
  }
};

// ===== ORTHO CONSTRAINT UTILITIES =====
export const OrthoUtils = {
  /**
   * Applies orthogonal constraint to a point
   */
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

  /**
   * Gets ortho constraint feedback
   */
  getOrthoFeedback: (
    point: Point2D,
    referencePoint: Point2D,
    settings: OrthoConstraintSettings
  ): ConstraintFeedback => {
    if (!settings.enabled || !settings.visualFeedback.showConstraintLines) {
      return { type: 'visual' };
    }

    const feedback = createVisualConstraintFeedback();

    const angle = AngleUtils.angleBetweenPoints(referencePoint, point);
    const distance = DistanceUtils.distance(referencePoint, point);

    // Show constraint lines for active directions
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
  /**
   * Applies polar constraint to a point
   */
  applyPolarConstraint: (
    point: Point2D,
    settings: PolarConstraintSettings
  ): Point2D => {
    if (!settings.enabled) return point;

    const polar = CoordinateUtils.cartesianToPolar(point, settings.basePoint, settings.baseAngle);
    let constrainedAngle = polar.angle;
    let constrainedDistance = polar.distance;

    // Snap angle to step
    const snappedAngle = AngleUtils.snapAngleToStep(
      polar.angle, 
      settings.angleStep, 
      settings.angleTolerance
    );
    if (snappedAngle !== null) {
      constrainedAngle = snappedAngle;
    }

    // Snap distance to step if enabled
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

  /**
   * Gets polar constraint feedback
   */
  getPolarFeedback: (
    point: Point2D,
    settings: PolarConstraintSettings
  ): ConstraintFeedback => {
    if (!settings.enabled) {
      return { type: 'visual' };
    }

    const feedback = createVisualConstraintFeedback();

    const polar = CoordinateUtils.cartesianToPolar(point, settings.basePoint, settings.baseAngle);

    // Show polar ray if enabled
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

    // Show angle arc if enabled
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

    // Show distance marker if enabled
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

  /**
   * Gets tracking angles for polar constraint
   */
  getTrackingAngles: (settings: PolarConstraintSettings): number[] => {
    const angles: number[] = [];
    const baseAngle = settings.baseAngle;
    
    // Generate angles based on angle step
    for (let angle = 0; angle < 360; angle += settings.angleStep) {
      angles.push(AngleUtils.normalizeAngle(baseAngle + angle));
    }
    
    return angles;
  }
};

// ===== CONSTRAINT APPLICATION UTILITIES =====
export const ConstraintApplicationUtils = {
  /**
   * Applies multiple constraints to a point in priority order
   */
  applyConstraints: (
    point: Point2D,
    constraints: ConstraintDefinition[],
    context: ConstraintContext
  ): ConstraintResult => {
    let constrainedPoint = { ...point };
    const appliedConstraints: ConstraintDefinition[] = [];
    const feedback: ConstraintFeedback[] = [];

    // Sort constraints by priority
    const sortedConstraints = [...constraints].sort((a, b) => b.priority - a.priority);

    for (const constraint of sortedConstraints) {
      if (!constraint.enabled) continue;

      // Validate constraint if validation function exists
      if (constraint.validation && !constraint.validation(constrainedPoint, context)) {
        continue;
      }

      // Apply constraint transformation if it exists
      if (constraint.transform) {
        const previousPoint = { ...constrainedPoint };
        constrainedPoint = constraint.transform(constrainedPoint, context);
        
        // Only add to applied constraints if point actually changed
        if (previousPoint.x !== constrainedPoint.x || previousPoint.y !== constrainedPoint.y) {
          appliedConstraints.push(constraint);
          
          // Get feedback if function exists
          if (constraint.feedback) {
            const constraintFeedback = constraint.feedback(constrainedPoint, context);
            feedback.push(constraintFeedback);
          }
        }
      }
    }

    // Calculate metadata
    const contextData = context.getConstraintContext ? context.getConstraintContext() : null;
    const angle = contextData?.referencePoint
      ? AngleUtils.angleBetweenPoints(contextData.referencePoint, constrainedPoint)
      : 0;

    const distance = contextData?.referencePoint
      ? DistanceUtils.distance(contextData.referencePoint, constrainedPoint)
      : 0;

    return {
      constrainedPoint,
      appliedConstraints,
      feedback,
      metadata: {
        angle,
        distance,
        direction: ConstraintApplicationUtils.getDirectionName(angle),
        accuracy: ConstraintApplicationUtils.calculateAccuracy(point, constrainedPoint)
      }
    };
  },

  /**
   * Gets direction name from angle
   */
  getDirectionName: (angle: number): string => {
    const normalizedAngle = AngleUtils.normalizeAngle(angle);
    
    if (normalizedAngle >= 337.5 || normalizedAngle < 22.5) return 'East';
    if (normalizedAngle >= 22.5 && normalizedAngle < 67.5) return 'Northeast';
    if (normalizedAngle >= 67.5 && normalizedAngle < 112.5) return 'North';
    if (normalizedAngle >= 112.5 && normalizedAngle < 157.5) return 'Northwest';
    if (normalizedAngle >= 157.5 && normalizedAngle < 202.5) return 'West';
    if (normalizedAngle >= 202.5 && normalizedAngle < 247.5) return 'Southwest';
    if (normalizedAngle >= 247.5 && normalizedAngle < 292.5) return 'South';
    if (normalizedAngle >= 292.5 && normalizedAngle < 337.5) return 'Southeast';
    
    return 'Unknown';
  },

  /**
   * Calculates accuracy of constraint application
   */
  calculateAccuracy: (originalPoint: Point2D, constrainedPoint: Point2D): number => {
    const distance = DistanceUtils.distance(originalPoint, constrainedPoint);
    // Return accuracy as percentage (closer to original = higher accuracy)
    return Math.max(0, Math.min(100, 100 - (distance * 10)));
  }
};

// ===== VALIDATION UTILITIES =====
export const ValidationUtils = {
  /**
   * Validates constraint definition
   */
  validateConstraint: (constraint: ConstraintDefinition): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!constraint.id || typeof constraint.id !== 'string') {
      errors.push('Constraint ID is required and must be a string');
    }

    if (!constraint.name || typeof constraint.name !== 'string') {
      errors.push('Constraint name is required and must be a string');
    }

    if (!constraint.type) {
      errors.push('Constraint type is required');
    }

    if (typeof constraint.priority !== 'number' || constraint.priority < 0) {
      errors.push('Constraint priority must be a non-negative number');
    }

    return { valid: errors.length === 0, errors };
  },

  /**
   * Validates ortho settings
   */
  validateOrthoSettings: (settings: OrthoConstraintSettings): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    validateAngleStep(settings.angleStep, errors);

    if (settings.tolerance < 0 || settings.tolerance > 90) {
      errors.push('Tolerance must be between 0 and 90 degrees');
    }

    return { valid: errors.length === 0, errors };
  },

  /**
   * Validates polar settings
   */
  validatePolarSettings: (settings: PolarConstraintSettings): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    validateAngleStep(settings.angleStep, errors);

    if (settings.distanceStep <= 0) {
      errors.push('Distance step must be positive');
    }

    if (settings.angleTolerance < 0 || settings.angleTolerance > 45) {
      errors.push('Angle tolerance must be between 0 and 45 degrees');
    }

    if (settings.distanceTolerance < 0) {
      errors.push('Distance tolerance must be non-negative');
    }

    return { valid: errors.length === 0, errors };
  }
};

// ===== MISSING EXPORTS - Required by useConstraintApplication.ts =====

/**
 * ✅ ENTERPRISE: Constraint calculation engine
 * Centralized calculations για όλα τα constraint types
 */
export const ConstraintCalculations = {
  ...AngleUtils,
  ...DistanceUtils,
  ...CoordinateUtils,
  ...ConstraintApplicationUtils,
  ...ValidationUtils,

  // Combined calculation methods
  calculateConstraintResult: ConstraintApplicationUtils.applyConstraints,
  validateConstraintPoint: (point: Point2D, context: ConstraintContext): boolean => {
    return point && typeof point.x === 'number' && typeof point.y === 'number';
  }
};

/**
 * ✅ ENTERPRISE: Ortho constraint engine
 * Dedicated engine για orthogonal constraints
 */
export const OrthoConstraintEngine = {
  ...OrthoUtils,
  ...AngleUtils,
  apply: OrthoUtils.applyOrthoConstraint,
  getFeedback: OrthoUtils.getOrthoFeedback,
  validate: ValidationUtils.validateOrthoSettings
};

/**
 * ✅ ENTERPRISE: Polar constraint engine
 * Dedicated engine για polar constraints
 */
export const PolarConstraintEngine = {
  ...PolarUtils,
  ...CoordinateUtils,
  apply: PolarUtils.applyPolarConstraint,
  getFeedback: PolarUtils.getPolarFeedback,
  getTrackingAngles: PolarUtils.getTrackingAngles,
  validate: ValidationUtils.validatePolarSettings
};

// ===== COMBINED UTILITY EXPORT =====
export const ConstraintUtils = {
  ...AngleUtils,
  ...DistanceUtils,
  ...CoordinateUtils,
  ...OrthoUtils,
  ...PolarUtils,
  ...ConstraintApplicationUtils,
  ...ValidationUtils
};

// ✅ ENTERPRISE: Alias για backward compatibility με useCoordinateConversion.ts
export const CoordinateConverter = CoordinateUtils;