
'use client';

import { useState } from 'react';
import type { ZoomWindowState } from './useZoomWindow';
// ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Χρήση κεντρικής υπηρεσίας αντί για διάσπαρτη fit logic
import { FitToViewService } from '../services/FitToViewService';
import type { ViewTransform, Viewport } from '../rendering/types/Types';
// 🏢 ADR-118: Centralized Zero Point Pattern
import { createZeroPoint } from '../config/geometry-constants';

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
  // 🏢 ADR-118: Use createZeroPoint() for mutable state initialization
  const [viewState, setViewState] = useState<ViewState>({
    zoom: 1,
    panX: 0,
    panY: 0,
    isPanning: false,
    panStart: createZeroPoint(),
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

  const resetView = (bounds?: { min: { x: number; y: number }; max: { x: number; y: number } } | null, viewport?: { width: number; height: number }) => {
    if (bounds && viewport && viewport.width > 0 && viewport.height > 0) {
      // ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Χρήση FitToViewService αντί για διάσπαρτη logic
      const result = FitToViewService.calculateFitToViewFromBounds(
        bounds,
        viewport as Viewport,
        { padding: 0.1, maxScale: 20 }
      );

      if (result.success && result.transform) {
        setViewState(prev => ({
          ...prev,
          zoom: result.transform!.scale,
          panX: result.transform!.offsetX,
          panY: result.transform!.offsetY,
          autoCrop: false
        }));
        return;
      }
    }

    // 🔄 FALLBACK: Default reset if no bounds provided
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
