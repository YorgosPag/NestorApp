'use client';

import { useCallback } from 'react';
import type { DxfCanvasRef } from '../../../../DxfCanvas';
import type { SceneModel } from '../../../../types/scene';
import { createCanvasZoomActions } from '../../../../utils/geometry-utils';

interface ZoomIntegrationOptions {
  dxfCanvasRef: React.RefObject<DxfCanvasRef>;
  currentScene: SceneModel | null;
  currentZoom: number;
  setCurrentZoom: (zoom: number) => void;
}

export function useZoomIntegration({
  dxfCanvasRef,
  currentScene,
  currentZoom,
  setCurrentZoom
}: ZoomIntegrationOptions) {
  
  // ============================================================================
  // ZOOM HELPER FUNCTIONS
  // ============================================================================
  const updateCurrentZoomFromCanvas = useCallback(() => {
    setTimeout(() => {
      const canvas = dxfCanvasRef.current;
      if (canvas) {
        const transform = canvas.getTransform();
        if (transform?.scale) {
          setCurrentZoom(transform.scale);
        }
      }
    }, 50);
  }, [dxfCanvasRef, setCurrentZoom]);

  // ============================================================================
  // ZOOM ACTIONS
  // ============================================================================
  // Use shared zoom actions utility to eliminate duplicate code
  const baseZoomActions = createCanvasZoomActions(dxfCanvasRef, updateCurrentZoomFromCanvas);
  
  // Extend fitToView with timeout for this specific use case
  const fitToView = useCallback(() => {
    dxfCanvasRef.current?.fitToView();
    setTimeout(() => updateCurrentZoomFromCanvas(), 100);
  }, [dxfCanvasRef, updateCurrentZoomFromCanvas]);

  const { zoomIn, zoomOut } = baseZoomActions;

  const setZoom = useCallback((zoom: number) => {
    const canvas = dxfCanvasRef.current;
    if (canvas && currentScene) {
      try {
        const coordinateManager = (canvas as any).getCoordinateManager?.();
        if (coordinateManager) {
          const currentTransform = canvas.getTransform();
          coordinateManager.setTransform({
            ...currentTransform,
            scale: zoom
          });
          canvas.renderScene(currentScene);
          setCurrentZoom(zoom);
        }
      } catch (error) {
        console.error('❌ Error in set-zoom:', error);
      }
    }
  }, [dxfCanvasRef, currentScene, setCurrentZoom]);

  // ============================================================================
  // ZOOM WINDOW INTEGRATION
  // ============================================================================
  const activateZoomWindow = useCallback(() => {
    dxfCanvasRef.current?.activateZoomWindow();
  }, [dxfCanvasRef]);

  const deactivateZoomWindow = useCallback(() => {
    dxfCanvasRef.current?.deactivateZoomWindow();
  }, [dxfCanvasRef]);

  return {
    // State
    currentZoom,
    
    // Actions
    zoomIn,
    zoomOut,
    fitToView,
    setZoom,
    activateZoomWindow,
    deactivateZoomWindow,
    updateCurrentZoomFromCanvas,
  };
}