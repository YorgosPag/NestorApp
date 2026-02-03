/**
 * ZOOM SYSTEM - REACT HOOK
 * React hook για εύκολη χρήση του zoom system
 */

import { useRef, useCallback, useMemo } from 'react';
import type { ViewTransform, Viewport } from '../../../rendering/types/Types';
import type { ZoomConfig, ZoomResult, ZoomConstraints } from '../zoom-types';
import { ZoomManager } from '../ZoomManager';
// ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Import κεντρικής υπηρεσίας για fit to view operations
import { FitToViewService } from '../../../services/FitToViewService';
import type { DxfScene } from '../../../canvas-v2/dxf-canvas/dxf-types';
import type { ColorLayer } from '../../../canvas-v2/layer-canvas/layer-types';

interface UseZoomProps {
  initialTransform: ViewTransform;
  config?: Partial<ZoomConfig>;
  onTransformChange?: (transform: ViewTransform) => void;
  // 🏢 ENTERPRISE: Viewport injection για accurate zoom-to-cursor
  viewport?: Viewport;
}

interface UseZoomReturn {
  // Core zoom functions
  zoomIn: (center?: { x: number; y: number }, constraints?: ZoomConstraints) => void;
  zoomOut: (center?: { x: number; y: number }, constraints?: ZoomConstraints) => void;
  zoomToFit: (bounds: { min: { x: number; y: number }; max: { x: number; y: number } }, viewport: { width: number; height: number }, alignToOrigin?: boolean) => ZoomResult;
  // ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Προσθήκη unified fit-to-view για DXF scenes με color layers
  zoomToFitUnified: (scene: DxfScene | null, colorLayers: ColorLayer[], viewport: Viewport) => boolean;
  zoomToScale: (scale: number, center?: { x: number; y: number }) => void;
  zoomTo100: (center?: { x: number; y: number }) => ZoomResult;
  zoomToWindow: (start: { x: number; y: number }, end: { x: number; y: number }, viewport: { width: number; height: number }) => void;

  // Wheel zoom
  handleWheelZoom: (
    wheelDelta: number,
    center: { x: number; y: number },
    constraints?: ZoomConstraints,
    modifiers?: { ctrlKey?: boolean; shiftKey?: boolean }
  ) => void;

  // History
  zoomPrevious: () => void;
  zoomNext: () => void;
  clearHistory: () => void;

  // Keyboard handlers
  handleKeyboardZoom: (key: string, cursorPosition?: { x: number; y: number }, viewport?: { width: number; height: number }) => void;

  // State
  getCurrentTransform: () => ViewTransform;
  setTransform: (transform: ViewTransform) => void;

  // Manager access (για προχωρημένες χρήσεις)
  zoomManager: ZoomManager;
}

/**
 * Custom hook για zoom functionality
 */
export const useZoom = ({
  initialTransform,
  config,
  onTransformChange,
  viewport
}: UseZoomProps): UseZoomReturn => {

  // Create zoom manager instance
  const zoomManagerRef = useRef<ZoomManager>();

  if (!zoomManagerRef.current) {
    // 🏢 ENTERPRISE: Inject viewport during initialization
    zoomManagerRef.current = new ZoomManager(initialTransform, config, viewport);
  }

  const zoomManager = zoomManagerRef.current;

  // 🏢 ENTERPRISE: Update viewport when it changes (e.g., canvas resize)
  if (viewport) {
    zoomManager.setViewport(viewport);
  }

  const applyTransform = useCallback((transform: ViewTransform) => {
    onTransformChange?.(transform);
  }, [onTransformChange]);

  // Helper function to handle zoom result
  const handleZoomResult = useCallback((result: ZoomResult) => {
    applyTransform(result.transform);
  }, [applyTransform]);

  // === CORE ZOOM FUNCTIONS ===

  const zoomIn = useCallback((center?: { x: number; y: number }, constraints?: ZoomConstraints) => {
    const result = zoomManager.zoomIn(center, constraints);
    handleZoomResult(result);
  }, [zoomManager, handleZoomResult]);

  const zoomOut = useCallback((center?: { x: number; y: number }, constraints?: ZoomConstraints) => {
    const result = zoomManager.zoomOut(center, constraints);
    handleZoomResult(result);
  }, [zoomManager, handleZoomResult]);

  const zoomToFit = useCallback((
    bounds: { min: { x: number; y: number }; max: { x: number; y: number } },
    viewport: { width: number; height: number },
    alignToOrigin?: boolean
  ): ZoomResult => {
    const result = zoomManager.zoomToFit(bounds, viewport, alignToOrigin);
    handleZoomResult(result);
    return result; // 🔥 Return the ZoomResult
  }, [zoomManager, handleZoomResult]);

  const zoomToScale = useCallback((scale: number, center?: { x: number; y: number }) => {
    const result = zoomManager.zoomToScale(scale, center);
    handleZoomResult(result);
  }, [zoomManager, handleZoomResult]);

  const zoomTo100 = useCallback((center?: { x: number; y: number }): ZoomResult => {
    const result = zoomManager.zoomTo100(center);
    handleZoomResult(result);
    return result; // 🔥 Return the ZoomResult
  }, [zoomManager, handleZoomResult]);

  const zoomToWindow = useCallback((
    start: { x: number; y: number },
    end: { x: number; y: number },
    viewport: { width: number; height: number }
  ) => {
    const result = zoomManager.zoomToWindow(start, end, viewport);
    handleZoomResult(result);
  }, [zoomManager, handleZoomResult]);

  // ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Unified fit-to-view για DXF scenes με color layers
  const zoomToFitUnified = useCallback((
    scene: DxfScene | null,
    colorLayers: ColorLayer[],
    viewport: Viewport
  ): boolean => {
    const result = FitToViewService.calculateFitToViewTransform(scene, colorLayers, viewport);

    if (result.success && result.transform) {
      applyTransform(result.transform);
      return true;
    }

    return false;
  }, [handleZoomResult]);

  // === WHEEL ZOOM ===

  const handleWheelZoom = useCallback((
    wheelDelta: number,
    center: { x: number; y: number },
    constraints?: ZoomConstraints,
    modifiers?: { ctrlKey?: boolean; shiftKey?: boolean }
  ) => {
    const result = zoomManager.wheelZoom(wheelDelta, center, constraints, modifiers);
    handleZoomResult(result);
  }, [zoomManager, handleZoomResult]);

  // === HISTORY ===

  const zoomPrevious = useCallback(() => {
    const result = zoomManager.zoomPrevious();
    if (result) {
      handleZoomResult(result);
    }
  }, [zoomManager, handleZoomResult]);

  const zoomNext = useCallback(() => {
    const result = zoomManager.zoomNext();
    if (result) {
      handleZoomResult(result);
    }
  }, [zoomManager, handleZoomResult]);

  const clearHistory = useCallback(() => {
    zoomManager.clearHistory();
  }, [zoomManager]);

  // === KEYBOARD ZOOM ===

  /**
   * 🎯 UNIFIED KEYBOARD ZOOM
   * Handles keyboard zoom with cursor-centered behavior (same as mouse wheel)
   *
   * @param key - The keyboard key pressed (+, -, 0, p)
   * @param cursorPosition - Optional cursor position for zoom center (if not provided, uses viewport center)
   * @param viewport - Optional viewport dimensions (fallback if cursor position not available)
   */
  const handleKeyboardZoom = useCallback((
    key: string,
    cursorPosition?: { x: number; y: number },
    viewport?: { width: number; height: number }
  ) => {
    // 🎯 PRIORITY: cursor position > viewport center
    const center = cursorPosition || (viewport ? {
      x: viewport.width / 2,
      y: viewport.height / 2
    } : undefined);

    switch (key) {
      case '+':
      case '=':
        zoomIn(center);
        break;
      case '-':
        zoomOut(center);
        break;
      case '0':
        // Fit to view - χρειάζεται bounds από parent component
        break;
      case 'p':
        zoomPrevious();
        break;
      default:
        break;
    }
  }, [zoomIn, zoomOut, zoomPrevious]);

  // === STATE MANAGEMENT ===

  const getCurrentTransform = useCallback(() => {
    return zoomManager.getCurrentTransform();
  }, [zoomManager]);

  const setTransform = useCallback((transform: ViewTransform) => {
    zoomManager.setTransform(transform);
    onTransformChange?.(transform);
  }, [zoomManager, onTransformChange]);

  // === RETURN OBJECT ===

  return useMemo(() => ({
    // Core functions
    zoomIn,
    zoomOut,
    zoomToFit,
    zoomToFitUnified, // ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Unified fit for DXF + layers
    zoomToScale,
    zoomTo100, // 🎯 ENTERPRISE: Zoom to 100% (1:1 DPI-aware)
    zoomToWindow,

    // Wheel zoom
    handleWheelZoom,

    // History
    zoomPrevious,
    zoomNext,
    clearHistory,

    // Keyboard
    handleKeyboardZoom,

    // State
    getCurrentTransform,
    setTransform,

    // Manager reference
    zoomManager
  }), [
    zoomIn,
    zoomOut,
    zoomToFit,
    zoomToFitUnified, // ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Add to dependencies
    zoomToScale,
    zoomTo100, // 🎯 ENTERPRISE: Add to dependencies
    zoomToWindow,
    handleWheelZoom,
    zoomPrevious,
    zoomNext,
    clearHistory,
    handleKeyboardZoom,
    getCurrentTransform,
    setTransform,
    zoomManager
  ]);
};
