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
    updateContext({ tool });
  }, [updateContext]);

  const setInputMode = useCallback((mode: 'point' | 'distance' | 'angle') => {
    updateContext({ inputMode: mode });
  }, [updateContext]);

  const setLastPoint = useCallback((point: Point2D | null) => {
    updateContext({ lastPoint: point, isFirstPoint: point === null });
  }, [updateContext]);

  return {
    updateContext,
    setCurrentTool,
    setInputMode,
    setLastPoint
  };
}