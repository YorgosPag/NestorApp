/**
 * Canvas Operations Hook
 * Provides imperative operations for canvas manipulation
 * Uses DxfCanvasCore imperative API through context
 */

import { useCallback } from 'react';
import type { Point2D, ViewTransform } from '../../types/scene';
import { useCanvasContext } from '../../contexts/CanvasContext';

export interface CanvasOperations {
  getCanvas: () => HTMLCanvasElement | null;
  getTransform: () => ViewTransform;
  setTransform: (transform: ViewTransform) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomAtScreenPoint: (factor: number, screenPt: Point2D) => void;
  resetToOrigin: () => void;
  fitToView: () => void;
}

/**
 * Hook that provides canvas operations using DxfCanvasCore imperative API
 * Falls back to event-based approach if context not available
 */
export const useCanvasOperations = (): CanvasOperations => {
  // 🎯 PHASE 1: Ενοποιημένο API με κοινό transform για DXF+Overlays
  const context = useCanvasContext();
  const dxfRef = context?.dxfRef || null;
  const overlayRef = context?.overlayRef || null;

  const getCanvas = useCallback((): HTMLCanvasElement | null => {
    if (dxfRef?.current) {
      return dxfRef.current.getCanvas();
    }
    // Fallback: find canvas directly from DOM
    return document.querySelector('canvas[data-canvas-type="dxf-main"]') as HTMLCanvasElement || null;
  }, [dxfRef]);

  const getTransform = useCallback((): ViewTransform => {
    if (context?.transform) {
      return context.transform;
    }
    // Fallback: get from DxfCanvasCore
    if (dxfRef?.current?.getTransform) {
      return dxfRef.current.getTransform();
    }
    return { scale: 1, offsetX: 0, offsetY: 0 };
  }, [context, dxfRef]);

  const setTransform = useCallback((transform: ViewTransform) => {
    // Update shared context state first
    if (context?.setTransform) {
      context.setTransform(transform);
    }

    // Apply to both DXF and Overlay canvases
    if (dxfRef?.current?.setTransform) {
      dxfRef.current.setTransform(transform);
    }
    if (overlayRef?.current?.setTransform) {
      overlayRef.current.setTransform(transform);
    }

    // Emit zoom event for HUD synchronization
    const zoomEvent = new CustomEvent('dxf-zoom-changed', {
      detail: { scale: transform.scale, transform }
    });
    document.dispatchEvent(zoomEvent);
  }, [context, dxfRef, overlayRef]);

  const zoomIn = useCallback(() => {
    if (dxfRef?.current) {
      dxfRef.current.zoomIn();
    } else {
      // Fallback: trigger event
      const event = new CustomEvent('dxf-zoom', { detail: { action: 'in' } });
      document.dispatchEvent(event);
    }
  }, [dxfRef]);

  const zoomOut = useCallback(() => {
    if (dxfRef?.current) {
      dxfRef.current.zoomOut();
    } else {
      // Fallback: trigger event
      const event = new CustomEvent('dxf-zoom', { detail: { action: 'out' } });
      document.dispatchEvent(event);
    }
  }, [dxfRef]);

  const zoomAtScreenPoint = useCallback((factor: number, screenPt: Point2D) => {
    if (dxfRef?.current) {
      dxfRef.current.zoomAtScreenPoint(factor, screenPt);
    } else {
      // Fallback: trigger event
      const event = new CustomEvent('dxf-zoom', {
        detail: { action: 'at-point', factor, point: screenPt }
      });
      document.dispatchEvent(event);
    }
  }, [dxfRef]);

  const resetToOrigin = useCallback(() => {
    if (dxfRef?.current) {
      dxfRef.current.resetToOrigin();
    } else {
      // Fallback: trigger event
      const event = new CustomEvent('dxf-zoom', { detail: { action: 'reset' } });
      document.dispatchEvent(event);
    }
  }, [dxfRef]);

  const fitToView = useCallback(() => {
    if (dxfRef?.current) {
      dxfRef.current.fitToView();
    } else {
      // Fallback: trigger event
      const event = new CustomEvent('dxf-zoom', { detail: { action: 'fit' } });
      document.dispatchEvent(event);
    }
  }, [dxfRef]);

  return {
    getCanvas,
    getTransform,
    setTransform,
    zoomIn,
    zoomOut,
    zoomAtScreenPoint,
    resetToOrigin,
    fitToView,
  };
};