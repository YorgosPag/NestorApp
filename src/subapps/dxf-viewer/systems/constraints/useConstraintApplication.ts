import { useCallback } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type {
  ConstraintContext,
  ConstraintContextData,
  ConstraintResult,
  ConstraintDefinition,
  OrthoConstraintSettings,
  PolarConstraintSettings
} from './config';
import {
  ConstraintCalculations,
  OrthoConstraintEngine,
  PolarConstraintEngine
} from './utils';

export interface ConstraintApplicationHook {
  applyConstraints: (point: Point2D, context?: Partial<ConstraintContextData>) => ConstraintResult;
  validatePoint: (point: Point2D, context?: Partial<ConstraintContextData>) => boolean;
}

export function useConstraintApplication(
  constraintContext: ConstraintContextData,
  setConstraintContext: React.Dispatch<React.SetStateAction<ConstraintContextData>>,
  orthoSettings: OrthoConstraintSettings,
  polarSettings: PolarConstraintSettings,
  getActiveConstraints: () => ConstraintDefinition[],
  setLastAppliedResult: React.Dispatch<React.SetStateAction<ConstraintResult | null>>,
  onConstraintResult?: (result: ConstraintResult) => void
): ConstraintApplicationHook {
  const applyConstraints = useCallback((point: Point2D, context?: Partial<ConstraintContextData>): ConstraintResult => {
    const fullContext = { ...constraintContext, ...context, currentPoint: point };
    setConstraintContext(fullContext);

    let result: ConstraintResult = {
      constrainedPoint: point,
      appliedConstraints: [],
      feedback: [],
      metadata: {
        accuracy: 100
      }
    };

    // Apply ortho constraints
    if (orthoSettings.enabled) {
      if (fullContext.referencePoint) {
        const orthoPoint = OrthoConstraintEngine.applyOrthoConstraint(
          result.constrainedPoint,
          fullContext.referencePoint,
          orthoSettings
        );
        result.constrainedPoint = orthoPoint;
      }
    }

    // Apply polar constraints
    if (polarSettings.enabled) {
      const polarPoint = PolarConstraintEngine.applyPolarConstraint(
        result.constrainedPoint,
        polarSettings
      );
      result.constrainedPoint = polarPoint; // ✅ ENTERPRISE: Point2D → constrainedPoint assignment
    }

    // Apply custom constraints
    const activeConstraintDefs = getActiveConstraints();
    result = ConstraintCalculations.applyConstraints(result.constrainedPoint, activeConstraintDefs, fullContext as ConstraintContext);

    setLastAppliedResult(result);
    onConstraintResult?.(result);

    return result;
  }, [constraintContext, setConstraintContext, orthoSettings, polarSettings, getActiveConstraints, setLastAppliedResult, onConstraintResult]);

  const validatePoint = useCallback((point: Point2D, context?: Partial<ConstraintContextData>): boolean => {
    const result = applyConstraints(point, context);
    const tolerance = Math.min(
      orthoSettings.tolerance || 5,
      polarSettings.angleTolerance || 5
    );
    
    const distance = Math.sqrt(
      Math.pow(result.constrainedPoint.x - point.x, 2) +
      Math.pow(result.constrainedPoint.y - point.y, 2)
    );
    
    return distance <= tolerance;
  }, [applyConstraints, orthoSettings.tolerance, polarSettings.angleTolerance]);

  return {
    applyConstraints,
    validatePoint
  };
}