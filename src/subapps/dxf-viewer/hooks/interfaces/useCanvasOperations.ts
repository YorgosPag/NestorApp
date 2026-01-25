/**
 * 🏢 ENTERPRISE: Canvas Operations Hook
 *
 * Provides imperative operations for canvas manipulation.
 * Uses DxfCanvasRef (V2 API) from canvas-v2/ module.
 *
 * @version 2.0.0 - Migrated from legacy DxfCanvasImperativeAPI to DxfCanvasRef
 * @since 2025-01-25
 *
 * MIGRATION NOTES:
 * - DxfCanvasRef (V2) has: getCanvas, getTransform, fitToView, zoomAtScreenPoint
 * - Legacy methods (zoomIn, zoomOut, resetToOrigin) now implemented via zoomAtScreenPoint
 * - setTransform handled via context
 */

import { useCallback } from 'react';
// ✅ ENTERPRISE FIX: Import from centralized types
import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import { useCanvasContext } from '../../contexts/CanvasContext';
// ✅ ENTERPRISE: Import zoom constants for consistent zoom factors
import { ZOOM_FACTORS } from '../../config/transform-config';

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

  // ✅ ENTERPRISE: Helper to get canvas center point
  const getCanvasCenter = useCallback((): Point2D => {
    const canvas = getCanvas();
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      return { x: rect.width / 2, y: rect.height / 2 };
    }
    return { x: 400, y: 300 }; // Fallback center
  }, [getCanvas]);

  /**
   * 🏢 ENTERPRISE: Zoom In
   * Uses zoomAtScreenPoint with BUTTON_IN factor (20% increase)
   * Zooms towards canvas center
   */
  const zoomIn = useCallback(() => {
    const center = getCanvasCenter();
    if (dxfRef?.current?.zoomAtScreenPoint) {
      dxfRef.current.zoomAtScreenPoint(ZOOM_FACTORS.BUTTON_IN, center);
    } else if (context?.setTransform && context?.transform) {
      // Fallback: update transform directly via context
      const newScale = context.transform.scale * ZOOM_FACTORS.BUTTON_IN;
      context.setTransform({ ...context.transform, scale: newScale });
    }
  }, [dxfRef, context, getCanvasCenter]);

  /**
   * 🏢 ENTERPRISE: Zoom Out
   * Uses zoomAtScreenPoint with BUTTON_OUT factor (20% decrease)
   * Zooms towards canvas center
   */
  const zoomOut = useCallback(() => {
    const center = getCanvasCenter();
    if (dxfRef?.current?.zoomAtScreenPoint) {
      dxfRef.current.zoomAtScreenPoint(ZOOM_FACTORS.BUTTON_OUT, center);
    } else if (context?.setTransform && context?.transform) {
      // Fallback: update transform directly via context
      const newScale = context.transform.scale * ZOOM_FACTORS.BUTTON_OUT;
      context.setTransform({ ...context.transform, scale: newScale });
    }
  }, [dxfRef, context, getCanvasCenter]);

  /**
   * 🏢 ENTERPRISE: Zoom At Screen Point
   * Uses DxfCanvasRef.zoomAtScreenPoint directly
   */
  const zoomAtScreenPoint = useCallback((factor: number, screenPt: Point2D) => {
    if (dxfRef?.current?.zoomAtScreenPoint) {
      dxfRef.current.zoomAtScreenPoint(factor, screenPt);
    } else if (context?.setTransform && context?.transform) {
      // Fallback: simple scale update (without point preservation)
      const newScale = context.transform.scale * factor;
      context.setTransform({ ...context.transform, scale: newScale });
    }
  }, [dxfRef, context]);

  /**
   * 🏢 ENTERPRISE: Reset To Origin
   * Sets transform to identity (scale: 1, offset: 0,0)
   */
  const resetToOrigin = useCallback(() => {
    if (context?.setTransform) {
      context.setTransform({
        x: 0,
        y: 0,
        scale: 1,
        rotation: 0,
        offsetX: 0,
        offsetY: 0
      });
    }
  }, [context]);

  /**
   * 🏢 ENTERPRISE: Fit To View
   * Uses DxfCanvasRef.fitToView directly
   */
  const fitToView = useCallback(() => {
    if (dxfRef?.current?.fitToView) {
      dxfRef.current.fitToView();
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