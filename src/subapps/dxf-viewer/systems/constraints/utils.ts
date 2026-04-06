/**
 * CONSTRAINTS SYSTEM UTILITIES
 *
 * Split (ADR-065 Phase 5):
 * - constraints-geometry.ts     → AngleUtils, DistanceUtils, CoordinateUtils
 * - constraints-ortho-polar.ts  → OrthoUtils, PolarUtils
 * - utils.ts (this)             → Application, Validation, Combined exports
 */

import type {
  ConstraintDefinition,
  ConstraintContextData,
  ConstraintResult,
  ConstraintFeedback,
  OrthoConstraintSettings,
  PolarConstraintSettings,
  ConstraintsSettings,
} from './config';
import type { Point2D } from '../../rendering/types/Types';
import { clamp } from '../../rendering/entities/shared/geometry-utils';

// Re-export geometry and ortho-polar for backward compatibility
export { AngleUtils, DistanceUtils, CoordinateUtils, CoordinateConverter } from './constraints-geometry';
export { OrthoUtils, PolarUtils } from './constraints-ortho-polar';

import { AngleUtils, DistanceUtils } from './constraints-geometry';
import { OrthoUtils, PolarUtils } from './constraints-ortho-polar';
import { CoordinateUtils } from './constraints-geometry';

// ===== HELPER FUNCTIONS =====

/** Validates angle step setting (shared validation logic) */
function validateAngleStep(angleStep: number, errors: string[]): void {
  if (angleStep <= 0 || angleStep > 180) {
    errors.push('Angle step must be between 0 and 180 degrees');
  }
}

// ===== CONSTRAINT APPLICATION UTILITIES =====

export const ConstraintApplicationUtils = {
  /** Applies multiple constraints to a point in priority order */
  applyConstraints: (
    point: Point2D,
    constraints: ConstraintDefinition[],
    context: ConstraintContextData
  ): ConstraintResult => {
    let constrainedPoint = { ...point };
    const appliedConstraints: ConstraintDefinition[] = [];
    const feedback: ConstraintFeedback[] = [];

    const sortedConstraints = [...constraints].sort((a, b) => b.priority - a.priority);

    for (const constraint of sortedConstraints) {
      if (!constraint.enabled) continue;

      if (constraint.validation && !constraint.validation(constrainedPoint, context)) {
        continue;
      }

      if (constraint.transform) {
        const previousPoint = { ...constrainedPoint };
        constrainedPoint = constraint.transform(constrainedPoint, context);

        if (previousPoint.x !== constrainedPoint.x || previousPoint.y !== constrainedPoint.y) {
          appliedConstraints.push(constraint);

          if (constraint.feedback) {
            const constraintFeedback = constraint.feedback(constrainedPoint, context);
            feedback.push(constraintFeedback);
          }
        }
      }
    }

    const angle = context.referencePoint
      ? AngleUtils.angleBetweenPoints(context.referencePoint, constrainedPoint)
      : 0;

    const distance = context.referencePoint
      ? DistanceUtils.distance(context.referencePoint, constrainedPoint)
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

  /** Gets direction name from angle */
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

  /** Calculates accuracy of constraint application */
  calculateAccuracy: (originalPoint: Point2D, constrainedPoint: Point2D): number => {
    const distance = DistanceUtils.distance(originalPoint, constrainedPoint);
    return clamp(100 - (distance * 10), 0, 100);
  }
};

// ===== VALIDATION UTILITIES =====

export const ValidationUtils = {
  /** Validates constraint definition */
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

  /** Validates ortho settings */
  validateOrthoSettings: (settings: OrthoConstraintSettings): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    validateAngleStep(settings.angleStep, errors);

    if (settings.tolerance < 0 || settings.tolerance > 90) {
      errors.push('Tolerance must be between 0 and 90 degrees');
    }

    return { valid: errors.length === 0, errors };
  },

  /** Validates polar settings */
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

// ===== COMBINED EXPORTS =====

export const ConstraintCalculations = {
  ...AngleUtils,
  ...DistanceUtils,
  ...CoordinateUtils,
  ...ConstraintApplicationUtils,
  ...ValidationUtils,

  calculateConstraintResult: ConstraintApplicationUtils.applyConstraints,
  validateConstraintPoint: (point: Point2D, _context: ConstraintContextData): boolean => {
    return point && typeof point.x === 'number' && typeof point.y === 'number';
  }
};

export const mergeConstraintSettings = (
  base: ConstraintsSettings,
  updates: Partial<ConstraintsSettings>
): ConstraintsSettings => {
  return {
    ...base,
    ...updates,
    general: { ...base.general, ...updates.general },
    display: { ...base.display, ...updates.display },
    input: {
      ...base.input,
      ...updates.input,
      keyboardShortcuts: {
        ...base.input.keyboardShortcuts,
        ...updates.input?.keyboardShortcuts
      },
      mouseModifiers: {
        ...base.input.mouseModifiers,
        ...updates.input?.mouseModifiers
      },
      touchGestures: {
        ...base.input.touchGestures,
        ...updates.input?.touchGestures
      }
    },
    performance: { ...base.performance, ...updates.performance }
  };
};

export const OrthoConstraintEngine = {
  ...OrthoUtils,
  ...AngleUtils,
  apply: OrthoUtils.applyOrthoConstraint,
  getFeedback: OrthoUtils.getOrthoFeedback,
  validate: ValidationUtils.validateOrthoSettings
};

export const PolarConstraintEngine = {
  ...PolarUtils,
  ...CoordinateUtils,
  apply: PolarUtils.applyPolarConstraint,
  getFeedback: PolarUtils.getPolarFeedback,
  getTrackingAngles: PolarUtils.getTrackingAngles,
  validate: ValidationUtils.validatePolarSettings
};

export const ConstraintUtils = {
  ...AngleUtils,
  ...DistanceUtils,
  ...CoordinateUtils,
  ...OrthoUtils,
  ...PolarUtils,
  ...ConstraintApplicationUtils,
  ...ValidationUtils
};
