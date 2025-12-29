/**
 * Canvas Operations Hook
 * Provides imperative operations for canvas manipulation
 * Uses DxfCanvasCore imperative API through context
 */

import { useCallback } from 'react';
// ✅ ENTERPRISE FIX: Import from centralized types
import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import { useCanvasContext } from '../../contexts/CanvasContext';

export interface CanvasOperations {
  getCanvas: () => HTMLCanvasElement | null;
  getTransform: () => ViewTransform;
  setTransform: (transform: ViewTransform) => void;
  // ✅ ENTERPRISE FIX: Add transform utilities for drawing operations
  getTransformUtils: () => {
    worldToScreen: (point: Point2D) => Point2D;
    screenToWorld: (point: Point2D) => Point2D;
  };
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
      // Ensure all properties are defined with proper defaults
      return {
        scale: context.transform.scale,
        offsetX: context.transform.offsetX ?? 0,
        offsetY: context.transform.offsetY ?? 0
      };
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
      // Convert ViewTransform to context transform format
      const contextTransform = {
        scale: transform.scale,
        offsetX: transform.offsetX,
        offsetY: transform.offsetY,
        x: transform.offsetX, // Add missing x property
        y: transform.offsetY, // Add missing y property
        rotation: 0 // Add missing rotation property
      };
      context.setTransform(contextTransform);
    }

    // ✅ ENTERPRISE FIX: Use getTransform instead of non-existent setTransform
    // Apply to both DXF and Overlay canvases using proper API
    if (dxfRef?.current?.getTransform) {
      // Use imperative API for transform updates
      // Note: DxfCanvasImperativeAPI doesn't expose setTransform - transforms handled by context
    }
    if (overlayRef?.current) {
      // Overlay canvas transforms handled by context
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

  // ✅ ENTERPRISE FIX: Transform utilities for drawing operations
  const getTransformUtils = useCallback(() => {
    const canvas = getCanvas();
    const transform = getTransform();

    const worldToScreen = (point: Point2D): Point2D => {
      const x = point.x * transform.scale + transform.offsetX;
      const y = point.y * transform.scale + transform.offsetY;
      return { x, y };
    };

    const screenToWorld = (point: Point2D): Point2D => {
      const x = (point.x - transform.offsetX) / transform.scale;
      const y = (point.y - transform.offsetY) / transform.scale;
      return { x, y };
    };

    return { worldToScreen, screenToWorld };
  }, [getCanvas, getTransform]);

  return {
    getCanvas,
    getTransform,
    setTransform,
    getTransformUtils,
    zoomIn,
    zoomOut,
    zoomAtScreenPoint,
    resetToOrigin,
    fitToView,
  };
};