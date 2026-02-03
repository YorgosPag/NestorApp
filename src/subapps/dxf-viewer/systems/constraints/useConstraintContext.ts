import { useCallback } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { ConstraintContextData } from './config';

export interface ConstraintContextHook {
  updateContext: (updates: Partial<ConstraintContextData>) => void;
  setCurrentTool: (tool: string) => void;
  setInputMode: (mode: 'point' | 'distance' | 'angle') => void;
  setLastPoint: (point: Point2D | null) => void;
}

export function useConstraintContext(
  setConstraintContext: React.Dispatch<React.SetStateAction<ConstraintContextData>>
): ConstraintContextHook {
  const updateContext = useCallback((updates: Partial<ConstraintContextData>) => {
    setConstraintContext(prev => ({ ...prev, ...updates }));
  }, [setConstraintContext]);

  const setCurrentTool = useCallback((tool: string) => {
    setConstraintContext(prev => ({ ...prev, currentTool: tool }));
  }, [setConstraintContext]);

  const setInputMode = useCallback((mode: 'point' | 'distance' | 'angle') => {
    setConstraintContext(prev => ({ ...prev, inputMode: mode }));
  }, [setConstraintContext]);

  const setLastPoint = useCallback((point: Point2D | null) => {
    setConstraintContext(prev => ({ ...prev, lastPoint: point }));
  }, [setConstraintContext]);

  return {
    updateContext,
    setCurrentTool,
    setInputMode,
    setLastPoint
  };
}
