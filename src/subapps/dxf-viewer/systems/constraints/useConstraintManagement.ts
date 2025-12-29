import { useCallback } from 'react';
import type { ConstraintDefinition, ConstraintOperationResult, ConstraintManagementInterface } from './config';

export interface ConstraintManagementHook extends ConstraintManagementInterface {}

export function useConstraintManagement(
  constraints: Record<string, ConstraintDefinition>,
  setConstraints: React.Dispatch<React.SetStateAction<Record<string, ConstraintDefinition>>>,
  activeConstraints: string[]
): ConstraintManagementHook {
  const addConstraint = useCallback(async (constraint: ConstraintDefinition): Promise<ConstraintOperationResult> => {
    try {
      setConstraints(prev => ({
        ...prev,
        [constraint.id]: constraint
      }));
      
      return {
        success: true,
        operation: { type: 'add-constraint' },
        constraintId: constraint.id
      };
    } catch (error) {
      return {
        success: false,
        operation: { type: 'add-constraint' },
        constraintId: constraint.id,
        error: error instanceof Error ? error.message : 'Failed to add constraint'
      };
    }
  }, [setConstraints]);

  const removeConstraint = useCallback(async (constraintId: string): Promise<ConstraintOperationResult> => {
    try {
      setConstraints(prev => {
        const { [constraintId]: removed, ...rest } = prev;
        return rest;
      });
      
      return {
        success: true,
        operation: { type: 'remove-constraint' },
        constraintId
      };
    } catch (error) {
      return {
        success: false,
        operation: { type: 'remove-constraint' },
        constraintId,
        error: error instanceof Error ? error.message : 'Failed to remove constraint'
      };
    }
  }, [setConstraints]);

  const enableConstraint = useCallback((constraintId: string) => {
    setConstraints(prev => {
      const constraint = prev[constraintId];
      if (!constraint) return prev;
      return {
        ...prev,
        [constraintId]: { ...constraint, enabled: true }
      };
    });
  }, [setConstraints]);

  const disableConstraint = useCallback((constraintId: string) => {
    setConstraints(prev => {
      const constraint = prev[constraintId];
      if (!constraint) return prev;
      return {
        ...prev,
        [constraintId]: { ...constraint, enabled: false }
      };
    });
  }, [setConstraints]);

  const toggleConstraint = useCallback((constraintId: string) => {
    setConstraints(prev => {
      const constraint = prev[constraintId];
      if (!constraint) return prev;
      return {
        ...prev,
        [constraintId]: { ...constraint, enabled: !constraint.enabled }
      };
    });
  }, [setConstraints]);

  const getConstraint = useCallback((constraintId: string): ConstraintDefinition | undefined => {
    return constraints[constraintId];
  }, [constraints]);

  const getConstraints = useCallback(() => constraints, [constraints]);

  const getActiveConstraints = useCallback((): ConstraintDefinition[] => {
    return activeConstraints.map(id => constraints[id]).filter(Boolean);
  }, [activeConstraints, constraints]);

  const clearConstraints = useCallback(() => {
    setConstraints({});
  }, [setConstraints]);

  return {
    addConstraint,
    removeConstraint,
    enableConstraint,
    disableConstraint,
    toggleConstraint,
    getConstraint,
    getConstraints,
    getActiveConstraints,
    clearConstraints
  };
}