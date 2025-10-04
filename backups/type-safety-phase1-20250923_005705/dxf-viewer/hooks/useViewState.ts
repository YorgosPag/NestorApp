
'use client';

import { useState } from 'react';
import type { ZoomWindowState } from './useZoomWindow';

export interface ViewState {
  zoom: number;
  panX: number;
  panY: number;
  isPanning: boolean;
  panStart: { x: number, y: number };
  autoCrop: boolean;
  zoomWindow: ZoomWindowState;
}

export const useViewState = () => {
  const [viewState, setViewState] = useState<ViewState>({
    zoom: 1,
    panX: 0,
    panY: 0,
    isPanning: false,
    panStart: { x: 0, y: 0 },
    autoCrop: true,
    zoomWindow: {
      isActive: false,
      isDragging: false,
      startPoint: null,
      currentPoint: null,
      previewRect: null
    }
  });

  const updateViewState = (updates: Partial<ViewState>) => {
    setViewState(prev => ({ ...prev, ...updates }));
  };

  const resetView = () => {
    setViewState(prev => ({
      ...prev,
      zoom: 1,
      panX: 0,
      panY: 0,
      autoCrop: true
    }));
  };

  const setZoom = (zoom: number) => {
    updateViewState({ zoom, autoCrop: false });
  };

  const zoomIn = () => {
    updateViewState({
      zoom: Math.min(viewState.zoom * 1.2, 20), // Increased max zoom
      autoCrop: false
    });
  };

  const zoomOut = () => {
    updateViewState({
      zoom: Math.max(viewState.zoom / 1.2, 0.05), // Decreased min zoom
      autoCrop: false
    });
  };

  return {
    viewState,
    updateViewState,
    resetView,
    setZoom,
    zoomIn,
    zoomOut
  };
};
