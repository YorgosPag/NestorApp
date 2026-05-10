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
// ADR-040 Phase VII: use stable refs context — never re-renders on zoom
import { useCanvasRefs } from '../../contexts/CanvasContext';
// ✅ ENTERPRISE: Import zoom constants for consistent zoom factors
import { ZOOM_FACTORS } from '../../config/transform-config';
// 🏢 ADR-151: Centralized Simple Coordinate Transforms
import { worldToScreenSimple, screenToWorldSimple } from '../../rendering/core/CoordinateTransforms';
// 🏢 ENTERPRISE: Unified EventBus for type-safe event dispatch
import { EventBus } from '../../systems/events';

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
  // ADR-040 Phase VII: useCanvasRefs() is stable (never re-renders on zoom)
  const context = useCanvasRefs();

  // 🏢 ENTERPRISE FIX (2026-01-27): Don't store refs in variables - causes stale closures!
  // Always read from context to get the LATEST ref value inside callbacks
  // This ensures we always get the current ref after DxfCanvas mounts
  // const dxfRef = context?.dxfRef || null; // ❌ STALE CLOSURE
  // const overlayRef = context?.overlayRef || null; // ❌ STALE CLOSURE

  const getCanvas = useCallback((): HTMLCanvasElement | null => {
    // 🏢 ENTERPRISE FIX: Read from context to avoid stale closure
    const dxfRef = context?.dxfRef;
    if (dxfRef?.current) {
      return dxfRef.current.getCanvas();
    }
    // Fallback: find canvas directly from DOM
    return document.querySelector('canvas[data-canvas-type="dxf-main"]') as HTMLCanvasElement || null;
  }, [context]);

  const getTransform = useCallback((): ViewTransform => {
    // ADR-040 Phase VII: primary path via imperative ref (no React state dependency)
    const dxfRef = context?.dxfRef;
    if (dxfRef?.current?.getTransform) {
      return dxfRef.current.getTransform();
    }
    return { scale: 1, offsetX: 0, offsetY: 0 };
  }, [context]);

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

    // 🏢 ENTERPRISE FIX: Read from context to avoid stale closure
    const dxfRef = context?.dxfRef;
    const overlayRef = context?.overlayRef;

    // ✅ ENTERPRISE FIX: Use getTransform instead of non-existent setTransform
    // Apply to both DXF and Overlay canvases using proper API
    if (dxfRef?.current?.getTransform) {
      // Use imperative API for transform updates
      // Note: DxfCanvasImperativeAPI doesn't expose setTransform - transforms handled by context
    }
    if (overlayRef?.current) {
      // Overlay canvas transforms handled by context
    }

    // 🏢 ENTERPRISE: Unified EventBus — reaches both EventBus.on AND window CustomEvent listeners
    EventBus.emit('dxf-zoom-changed', { transform });
  }, [context]);

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
   *
   * ADR: Imperative API = Source of Truth
   */
  const zoomIn = useCallback(() => {
    const center = getCanvasCenter();
    const dxfRef = context?.dxfRef;

    if (!dxfRef?.current?.zoomAtScreenPoint) {
      console.error('🚨 [zoomIn] CRITICAL: dxfRef.current not available! Zoom disabled. Check if DxfCanvas is mounted and visible.');
      return;
    }

    dxfRef.current.zoomAtScreenPoint(ZOOM_FACTORS.BUTTON_IN, center);
  }, [context, getCanvasCenter]);

  /**
   * 🏢 ENTERPRISE: Zoom Out
   * Uses zoomAtScreenPoint with BUTTON_OUT factor (20% decrease)
   * Zooms towards canvas center
   *
   * ADR: Imperative API = Source of Truth
   */
  const zoomOut = useCallback(() => {
    const center = getCanvasCenter();
    const dxfRef = context?.dxfRef;

    if (!dxfRef?.current?.zoomAtScreenPoint) {
      console.error('🚨 [zoomOut] CRITICAL: dxfRef.current not available! Zoom disabled.');
      return;
    }

    dxfRef.current.zoomAtScreenPoint(ZOOM_FACTORS.BUTTON_OUT, center);
  }, [context, getCanvasCenter]);

  /**
   * 🏢 ENTERPRISE: Zoom At Screen Point
   * Uses DxfCanvasRef.zoomAtScreenPoint directly
   */
  const zoomAtScreenPoint = useCallback((factor: number, screenPt: Point2D) => {
    // 🏢 ENTERPRISE FIX: Read from context to avoid stale closure
    const dxfRef = context?.dxfRef;
    if (dxfRef?.current?.zoomAtScreenPoint) {
      dxfRef.current.zoomAtScreenPoint(factor, screenPt);
    } else if (context?.setTransform) {
      // Fallback: simple scale update via EventBus (transform read imperatively)
      const current = dxfRef?.current?.getTransform?.() ?? { scale: 1, offsetX: 0, offsetY: 0 };
      context.setTransform({ ...current, scale: current.scale * factor });
    }
  }, [context]);

  /**
   * 🏢 ENTERPRISE: Reset To Origin
   * Sets transform to identity (scale: 1, offset: 0,0)
   */
  const resetToOrigin = useCallback(() => {
    if (context?.setTransform) {
      context.setTransform({
        scale: 1,
        offsetX: 0,
        offsetY: 0
      });
    }
  }, [context]);

  /**
   * 🏢 ENTERPRISE: Fit To View
   * Uses DxfCanvasRef.fitToView directly
   *
   * ADR: Imperative API = Source of Truth
   */
  const fitToView = useCallback(() => {
    const dxfRef = context?.dxfRef;

    if (!dxfRef?.current?.fitToView) {
      console.error('🚨 [fitToView] CRITICAL: dxfRef.current not available! Fit disabled.');
      return;
    }

    dxfRef.current.fitToView();
  }, [context]);

  // ✅ ENTERPRISE FIX: Transform utilities for drawing operations
  // 🏢 ADR-151: Use centralized worldToScreenSimple/screenToWorldSimple
  const getTransformUtils = useCallback(() => {
    const transform = getTransform();

    // 🏢 ADR-151: Delegates to centralized simple transform functions
    const worldToScreen = (point: Point2D): Point2D => worldToScreenSimple(point, transform);
    const screenToWorld = (point: Point2D): Point2D => screenToWorldSimple(point, transform);

    return { worldToScreen, screenToWorld };
  }, [getTransform]);

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
