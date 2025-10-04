import { useCallback } from 'react';
import type { Point2D } from './config';
import type { 
  RulerSettings, 
  GridSettings, 
  RulersGridState, 
  SnapResult, 
  ViewTransform 
} from './config';
import { RULERS_GRID_CONFIG } from './config';
import { RulersGridSnapping } from './utils';

export interface SnapManagementHook {
  toggleRulerSnap: () => void;
  toggleGridSnap: () => void;
  setSnapTolerance: (tolerance: number) => void;
  findSnapPoint: (point: Point2D) => SnapResult | null;
}

export function useSnapManagement(
  rulers: RulerSettings,
  setRulers: React.Dispatch<React.SetStateAction<RulerSettings>>,
  grid: GridSettings,
  setGrid: React.Dispatch<React.SetStateAction<GridSettings>>,
  state: RulersGridState,
  viewTransform?: ViewTransform,
  onSnapResult?: (result: SnapResult | null) => void
): SnapManagementHook {
  const toggleRulerSnap = useCallback(() => {
    setRulers(prev => ({
      ...prev,
      snap: { ...prev.snap, enabled: !prev.snap.enabled }
    }));
  }, [setRulers]);

  const toggleGridSnap = useCallback(() => {
    setGrid(prev => ({
      ...prev,
      snap: { ...prev.snap, enabled: !prev.snap.enabled }
    }));
  }, [setGrid]);

  const setSnapTolerance = useCallback((tolerance: number) => {
    const clampedTolerance = Math.max(
      RULERS_GRID_CONFIG.MIN_SNAP_TOLERANCE,
      Math.min(RULERS_GRID_CONFIG.MAX_SNAP_TOLERANCE, tolerance)
    );
    
    setRulers(prev => ({
      ...prev,
      snap: { ...prev.snap, tolerance: clampedTolerance }
    }));
    setGrid(prev => ({
      ...prev,
      snap: { ...prev.snap, tolerance: clampedTolerance }
    }));
  }, [setRulers, setGrid]);

  const findSnapPoint = useCallback((point: Point2D): SnapResult | null => {
    if (!viewTransform) return null;
    
    return RulersGridSnapping.findSnapPoint(
      point,
      state,
      viewTransform,
      onSnapResult
    );
  }, [state, viewTransform, onSnapResult]);

  return {
    toggleRulerSnap,
    toggleGridSnap,
    setSnapTolerance,
    findSnapPoint
  };
}