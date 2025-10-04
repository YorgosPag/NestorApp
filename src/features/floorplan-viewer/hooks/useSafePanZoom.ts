import { useState, useCallback, useRef } from 'react';

interface Position {
  x: number;
  y: number;
}

interface PanZoomState {
  scale: number;
  position: Position;
  isDragging: boolean;
  lastMousePosition: Position | null;
}

export function useSafePanZoom() {
  const [state, setState] = useState<PanZoomState>({
    scale: 1,
    position: { x: 0, y: 0 },
    isDragging: false,
    lastMousePosition: null
  });

  const stateRef = useRef(state);
  stateRef.current = state;

  // Zoom constraints
  const MIN_SCALE = 0.1;
  const MAX_SCALE = 5;
  const ZOOM_STEP = 0.1;

  const updateState = useCallback((updates: Partial<PanZoomState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const handleWheel = useCallback((event: React.WheelEvent) => {
    event.preventDefault();
    
    const rect = event.currentTarget.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    const currentState = stateRef.current;
    const delta = event.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, currentState.scale + delta));
    
    if (newScale !== currentState.scale) {
      // Zoom towards mouse position
      const scaleFactor = newScale / currentState.scale;
      const newX = mouseX - (mouseX - currentState.position.x) * scaleFactor;
      const newY = mouseY - (mouseY - currentState.position.y) * scaleFactor;
      
      updateState({
        scale: newScale,
        position: { x: newX, y: newY }
      });
    }
  }, [updateState]);

  const handlePanStart = useCallback((event: React.MouseEvent) => {
    if (event.button === 0) { // Left mouse button
      updateState({
        isDragging: true,
        lastMousePosition: { x: event.clientX, y: event.clientY }
      });
    }
  }, [updateState]);

  const handlePanMove = useCallback((event: React.MouseEvent) => {
    const currentState = stateRef.current;
    
    if (currentState.isDragging && currentState.lastMousePosition) {
      const deltaX = event.clientX - currentState.lastMousePosition.x;
      const deltaY = event.clientY - currentState.lastMousePosition.y;
      
      updateState({
        position: {
          x: currentState.position.x + deltaX,
          y: currentState.position.y + deltaY
        },
        lastMousePosition: { x: event.clientX, y: event.clientY }
      });
    }
  }, [updateState]);

  const handlePanEnd = useCallback(() => {
    updateState({
      isDragging: false,
      lastMousePosition: null
    });
  }, [updateState]);

  const zoomIn = useCallback(() => {
    const currentState = stateRef.current;
    const newScale = Math.min(MAX_SCALE, currentState.scale + ZOOM_STEP);
    updateState({ scale: newScale });
  }, [updateState]);

  const zoomOut = useCallback(() => {
    const currentState = stateRef.current;
    const newScale = Math.max(MIN_SCALE, currentState.scale - ZOOM_STEP);
    updateState({ scale: newScale });
  }, [updateState]);

  const resetView = useCallback(() => {
    updateState({
      scale: 1,
      position: { x: 0, y: 0 },
      isDragging: false,
      lastMousePosition: null
    });
  }, [updateState]);

  return {
    scale: state.scale,
    position: state.position,
    isDragging: state.isDragging,
    handleWheel,
    handlePanStart,
    handlePanMove,
    handlePanEnd,
    zoomIn,
    zoomOut,
    resetView
  };
}
