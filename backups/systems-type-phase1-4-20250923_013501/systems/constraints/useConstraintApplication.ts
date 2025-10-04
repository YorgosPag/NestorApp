import { useCallback } from 'react';
import type { Point2D } from '../coordinates/config';
import type { 
  ConstraintContext, 
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
  applyConstraints: (point: Point2D, context?: Partial<ConstraintContext>) => ConstraintResult;
  validatePoint: (point: Point2D, context?: Partial<ConstraintContext>) => boolean;
}

export function useConstraintApplication(
  constraintContext: ConstraintContext,
  setConstraintContext: React.Dispatch<React.SetStateAction<ConstraintContext>>,
  orthoSettings: OrthoConstraintSettings,
  polarSettings: PolarConstraintSettings,
  getActiveConstraints: () => ConstraintDefinition[],
  setLastAppliedResult: React.Dispatch<React.SetStateAction<ConstraintResult | null>>,
  onConstraintResult?: (result: ConstraintResult) => void
): ConstraintApplicationHook {
  const applyConstraints = useCallback((point: Point2D, context?: Partial<ConstraintContext>): ConstraintResult => {
    const fullContext = { ...constraintContext, ...context, currentPoint: point };
    setConstraintContext(fullContext);

    let result: ConstraintResult = {
      originalPoint: point,
      constrainedPoint: point,
      appliedConstraints: [],
      isConstrained: false
    };

    // Apply ortho constraints
    if (orthoSettings.enabled) {
      result = OrthoConstraintEngine.applyOrthoConstraint(result, orthoSettings, fullContext);
    }

    // Apply polar constraints
    if (polarSettings.enabled) {
      result = PolarConstraintEngine.applyPolarConstraint(result, polarSettings, fullContext);
    }

    // Apply custom constraints
    const activeConstraintDefs = getActiveConstraints();
    result = ConstraintCalculations.applyConstraints(result, activeConstraintDefs, fullContext);

    setLastAppliedResult(result);
    onConstraintResult?.(result);

    return result;
  }, [constraintContext, setConstraintContext, orthoSettings, polarSettings, getActiveConstraints, setLastAppliedResult, onConstraintResult]);

  const validatePoint = useCallback((point: Point2D, context?: Partial<ConstraintContext>): boolean => {
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