import { useCallback } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { ConstraintContext } from './config';

export interface ConstraintContextHook {
  updateContext: (updates: Partial<ConstraintContext>) => void;
  setCurrentTool: (tool: string) => void;
  setInputMode: (mode: 'point' | 'distance' | 'angle') => void;
  setLastPoint: (point: Point2D | null) => void;
}

export function useConstraintContext(
  setConstraintContext: React.Dispatch<React.SetStateAction<ConstraintContext>>
): ConstraintContextHook {
  const updateContext = useCallback((updates: Partial<ConstraintContext>) => {
    setConstraintContext(prev => ({ ...prev, ...updates }));
  }, [setConstraintContext]);

  const setCurrentTool = useCallback((tool: string) => {
    // Update context through setConstraintContext with method call
    setConstraintContext(prev => {
      prev.setCurrentTool(tool);
      return prev;
    });
  }, [setConstraintContext]);

  const setInputMode = useCallback((mode: 'point' | 'distance' | 'angle') => {
    // Update context through setConstraintContext with method call
    setConstraintContext(prev => {
      prev.setInputMode(mode);
      return prev;
    });
  }, [setConstraintContext]);

  const setLastPoint = useCallback((point: Point2D | null) => {
    // Update context through setConstraintContext with method call
    setConstraintContext(prev => {
      prev.setLastPoint(point);
      return prev;
    });
  }, [setConstraintContext]);

  return {
    updateContext,
    setCurrentTool,
    setInputMode,
    setLastPoint
  };
}