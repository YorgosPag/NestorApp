import { useState, useCallback, useRef } from 'react';
import type { Point2D } from '../rendering/types/Types';

type ZoomRect = { x: number; y: number; width: number; height: number };

export interface ZoomWindowState {
  isActive: boolean;
  isDragging: boolean;
  startPoint: Point2D | null;
  currentPoint: Point2D | null;
  previewRect: DOMRect | null;
}

interface UseZoomWindowResult {
  state: ZoomWindowState;
  startZoomWindow: (point: Point2D) => void;
  updateZoomWindow: (point: Point2D) => void;
  finishZoomWindow: () => ZoomRect | null;
  cancelZoomWindow: () => void;
  setActive: (active: boolean) => void;
}

export function useZoomWindow(): UseZoomWindowResult {
  const [state, setState] = useState<ZoomWindowState>({
    isActive: false,
    isDragging: false,
    startPoint: null,
    currentPoint: null,
    previewRect: null
  });

  // 🔧 FIX: Stable reference to avoid infinite loops
  const stateRef = useRef(state);
  stateRef.current = state;

  const setActive = useCallback((active: boolean) => {
    setState(prev => {
      if (prev.isActive === active) return prev; // 🔧 Prevent unnecessary updates
      
      return {
        ...prev,
        isActive: active,
        isDragging: false,
        startPoint: null,
        currentPoint: null,
        previewRect: null
      };
    });
  }, []);

  const startZoomWindow = useCallback((point: Point2D) => {
    setState(prev => {
      if (prev.isDragging) return prev; // 🔧 Prevent double start
      
      return {
        ...prev,
        isDragging: true,
        startPoint: { ...point },
        currentPoint: { ...point },
        previewRect: null
      };
    });
  }, []);

  const updateZoomWindow = useCallback((point: Point2D) => {
    setState(prev => {
      if (!prev.isDragging || !prev.startPoint) return prev;

      // 🔧 Check if point actually changed
      if (prev.currentPoint && 
          Math.abs(prev.currentPoint.x - point.x) < 1 && 
          Math.abs(prev.currentPoint.y - point.y) < 1) {
        return prev;
      }

      // Calculate rectangle bounds
      const x = Math.min(prev.startPoint.x, point.x);
      const y = Math.min(prev.startPoint.y, point.y);
      const width = Math.abs(point.x - prev.startPoint.x);
      const height = Math.abs(point.y - prev.startPoint.y);

      const rect = new DOMRect(x, y, width, height);

      return {
        ...prev,
        currentPoint: { ...point },
        previewRect: rect
      };
    });
  }, []);

  const finishZoomWindow = useCallback(() => {
    const currentState = stateRef.current;
    
    if (!currentState.isDragging || !currentState.startPoint || !currentState.currentPoint) {
      setState(prev => ({ 
        ...prev, 
        isDragging: false, 
        startPoint: null, 
        currentPoint: null, 
        previewRect: null 
      }));
      return null;
    }

    const x = Math.min(currentState.startPoint.x, currentState.currentPoint.x);
    const y = Math.min(currentState.startPoint.y, currentState.currentPoint.y);
    const width = Math.abs(currentState.currentPoint.x - currentState.startPoint.x);
    const height = Math.abs(currentState.currentPoint.y - currentState.startPoint.y);

    // Minimum rectangle size check
    if (width < 10 || height < 10) {
      setState(prev => ({ 
        ...prev, 
        isDragging: false, 
        startPoint: null, 
        currentPoint: null, 
        previewRect: null 
      }));
      return null;
    }
    
    setState(prev => ({
      ...prev,
      isDragging: false,
      startPoint: null,
      currentPoint: null,
      previewRect: null
    }));

    return { x, y, width, height };
  }, []);

  const cancelZoomWindow = useCallback(() => {
    setState(prev => ({
      ...prev,
      isDragging: false,
      startPoint: null,
      currentPoint: null,
      previewRect: null
    }));
  }, []);

  // 🔧 FIX: Memoized return object to prevent re-renders
  const result = useRef<UseZoomWindowResult>({
    state,
    startZoomWindow,
    updateZoomWindow,
    finishZoomWindow,
    cancelZoomWindow,
    setActive
  });

  // Update only the state, keep callbacks stable
  result.current.state = state;

  return result.current;
}
