'use client';

/**
 * 🏢 ENTERPRISE PREVIEW CANVAS
 *
 * React wrapper for PreviewRenderer with UnifiedFrameScheduler integration.
 * Pattern: Autodesk AutoCAD / Adobe Illustrator - Direct canvas for previews
 *
 * @module PreviewCanvas
 * @version 1.0.0 - ADR-040: Dedicated Preview Canvas
 * @since 2026-01-26
 *
 * 🎯 PURPOSE:
 * - Dedicated canvas layer for drawing previews
 * - Uses UnifiedFrameScheduler for coordinated rendering
 * - Exposes direct rendering API via useImperativeHandle (NO REACT STATE!)
 *
 * 🏆 ENTERPRISE FEATURES:
 * - useImperativeHandle exposes drawPreview() for direct access
 * - Integrates with UnifiedFrameScheduler (ADR-030)
 * - ResizeObserver for canvas sizing
 * - High-DPI support
 * - Dirty-flag optimization
 * - Full TypeScript (ZERO any)
 */

import React, { useRef, useEffect, useImperativeHandle, forwardRef, useCallback } from 'react';
import { PreviewRenderer, type PreviewRenderOptions } from './PreviewRenderer';
import { registerRenderCallback, RENDER_PRIORITIES } from '../../rendering';
import type { ViewTransform, Point2D } from '../../rendering/types/Types';
import type { ExtendedSceneEntity } from '../../hooks/drawing/useUnifiedDrawing';
import type { SceneUnits } from '../../utils/scene-units';
// ADR-357 Phase 4: Object Snap Tracking handle types.
import type { AcquiredTrackingPoint } from '../../systems/tracking/TrackingPointStore';
import type { TrackingAlignmentPath } from '../../systems/tracking/tracking-resolver';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
// 🏢 ENTERPRISE (2026-01-27): Event Bus for drawing completion notification - ADR-040
import { EventBus } from '../../systems/events';
// 🏢 ADR-146: Canvas Size Observer Centralization
import { useCanvasSizeObserver } from '../../hooks/canvas';
// 🏢 ADR-040 / ADR-398 §4: live transform SSoT — drives the world-locked ghost
// re-paint on mouse-wheel zoom/pan that fires no mousemove (Revit/AutoCAD).
import { subscribeTransform, getImmediateTransform } from '../../systems/cursor/ImmediateTransformStore';

// ============================================================================
// TYPES - Enterprise TypeScript Standards (ZERO any)
// ============================================================================

export interface PreviewCanvasProps {
  /** CSS class name */
  className?: string;
  /** Custom styles */
  style?: React.CSSProperties;
  /** Is preview rendering active? */
  isActive?: boolean;
  /** Current view transform (for coordinate conversion) */
  transform: ViewTransform;
  /** Viewport dimensions */
  viewport: { width: number; height: number };
  /** Default preview render options */
  defaultOptions?: PreviewRenderOptions;
  /** ADR-362 R9 — active scene units for dim preview text sizing. Default 'mm'. */
  sceneUnits?: SceneUnits;
}

/**
 * 🏢 ENTERPRISE: Imperative handle for direct preview rendering
 *
 * This is exposed via ref to allow direct canvas rendering WITHOUT React re-renders.
 * Pattern: Autodesk/Adobe - Direct API for performance-critical operations
 */
export interface PreviewCanvasHandle {
  /**
   * Draw preview entity directly to canvas
   * @param entity - Entity to preview (or null to clear)
   * @param options - Optional render options
   */
  drawPreview: (entity: ExtendedSceneEntity | null, options?: PreviewRenderOptions) => void;

  /**
   * Clear the preview canvas
   */
  clear: () => void;

  /**
   * Get the underlying canvas element
   */
  getCanvas: () => HTMLCanvasElement | null;

  /**
   * Draw polar tracking alignment path + tooltip (ADR-357 Phase 1).
   * Call AFTER drawPreview — overlays on top without clearing.
   */
  drawPolarTrackingLine: (
    ref: Point2D,
    snappedAngle: number,
    label: string,
    cursorWorld: Point2D,
  ) => void;

  /**
   * Update acquired Object Snap Tracking markers (ADR-357 Phase 4). Markers
   * persist across `drawPreview` cycles — pass `[]` to clear.
   */
  setTrackingMarkers: (markers: readonly AcquiredTrackingPoint[]) => void;

  /**
   * Draw the Object Snap Tracking alignment overlay (ADR-357 Phase 4).
   * Call AFTER `drawPreview` — overlays alignment paths + intersection halo
   * + snapped-distance tooltip. Wiped on the next `drawPreview`/`clear`.
   */
  drawTrackingAlignment: (
    paths: readonly TrackingAlignmentPath[],
    intersections: readonly Point2D[],
    snappedPoint: Point2D,
    label: string | null,
  ) => void;
}

// ============================================================================
// PREVIEW CANVAS COMPONENT
// ============================================================================

/**
 * 🏢 ENTERPRISE: Preview Canvas Component
 *
 * Dedicated canvas layer for drawing previews with direct rendering API.
 * Uses UnifiedFrameScheduler for coordinated rendering with other canvas systems.
 *
 * @example
 * ```tsx
 * const previewRef = useRef<PreviewCanvasHandle>(null);
 *
 * // In mouse handler (NO REACT STATE NEEDED!)
 * previewRef.current?.drawPreview(previewEntity);
 *
 * <PreviewCanvas
 *   ref={previewRef}
 *   transform={transform}
 *   viewport={viewport}
 * />
 * ```
 */
export const PreviewCanvas = forwardRef<PreviewCanvasHandle, PreviewCanvasProps>(
  function PreviewCanvas(
    {
      className = '',
      style,
      isActive = true,
      transform,
      viewport,
      defaultOptions,
      sceneUnits,
    },
    ref
  ) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rendererRef = useRef<PreviewRenderer | null>(null);

    // Store current transform/viewport/options in refs for scheduler callback
    const transformRef = useRef<ViewTransform>(transform);
    const viewportRef = useRef<{ width: number; height: number }>(viewport);  // 🏢 ADR-040: Required for Y-axis inversion
    const optionsRef = useRef<PreviewRenderOptions | undefined>(defaultOptions);

    // Keep refs in sync
    transformRef.current = transform;
    viewportRef.current = viewport;  // 🏢 ADR-040: Keep viewport in sync
    optionsRef.current = defaultOptions;

    // ============================================================================
    // RENDERER INITIALIZATION
    // ============================================================================

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Create renderer
      const renderer = new PreviewRenderer();
      renderer.initialize(canvas);
      rendererRef.current = renderer;

      // Initial size update
      const rect = canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        renderer.updateSize(rect.width, rect.height);
      }

      return () => {
        renderer.dispose();
        rendererRef.current = null;
      };
    }, []);

    // ADR-362 R9 — forward scene units to renderer whenever the prop changes.
    useEffect(() => {
      rendererRef.current?.setSceneUnits(sceneUnits ?? 'mm');
    }, [sceneUnits]);

    // ============================================================================
    // 🏢 ADR-146: Centralized Canvas Size Observer
    // ============================================================================

    // 🔧 FIX (2026-02-13): Memoize callback to prevent useCanvasSizeObserver effect re-running
    // on every React re-render. Without useCallback, the inline function creates a new reference
    // each render → effect re-runs → updateSize() sets canvas.width → CLEARS THE CANVAS!
    // This was the root cause of "preview disappears during mouse movement" bug.
    const handleSizeChange = useCallback((canvas: HTMLCanvasElement) => {
      const rect = canvas.getBoundingClientRect();
      rendererRef.current?.updateSize(rect.width, rect.height);
    }, []);

    useCanvasSizeObserver({
      canvasRef,
      onSizeChange: handleSizeChange,
    });

    // ============================================================================
    // UNIFIED FRAME SCHEDULER INTEGRATION (ADR-030)
    // ============================================================================

    useEffect(() => {
      const renderer = rendererRef.current;
      if (!renderer) return;

      /**
       * 🏢 ENTERPRISE: Dirty check function
       * Returns true only if preview needs to be redrawn
       */
      const isDirty = (): boolean => {
        return renderer.checkDirty();
      };

      /**
       * 🏢 ENTERPRISE: Render callback
       * Called by UnifiedFrameScheduler on each frame (if dirty)
       */
      const onRender = (): void => {
        renderer.render();
      };

      // Register with HIGH priority (previews are important UI feedback)
      const unsubscribe = registerRenderCallback(
        'preview-canvas',
        'Preview Canvas',
        RENDER_PRIORITIES.HIGH,
        onRender,
        isDirty
      );

      return () => {
        unsubscribe();
      };
    }, []);

    // ============================================================================
    // 🏢 WORLD-LOCKED GHOST ON ZOOM/PAN (ADR-040 / ADR-398 §4)
    // ============================================================================

    // Revit/AutoCAD behavior: when the user zooms with the mouse wheel WITHOUT
    // moving the cursor, the transform changes but `drawPreview()` is never
    // re-called (it only fires on mousemove). The cached ghost would freeze at
    // its old scale until the next mousemove. We subscribe to the SAME live
    // transform SSoT as the main canvas (zero-lag) and re-paint the cached
    // world-coord entity with the new transform — locked to its world point,
    // correctly rescaled, no re-snap. Covers EVERY tool routed through this
    // shared canvas (column/wall/beam/line/circle/dimension/…).
    useEffect(() => {
      return subscribeTransform(() => {
        rendererRef.current?.refreshTransform(getImmediateTransform(), viewportRef.current);
      });
    }, []);

    // ============================================================================
    // EVENT BUS INTEGRATION - Drawing Completion Listener (ADR-040)
    // ============================================================================

    useEffect(() => {
      /**
       * 🏢 ENTERPRISE (2026-01-27): Listen for drawing completion events
       * Pattern: Autodesk AutoCAD - Command completion notification
       *
       * When a drawing operation completes (e.g., 2nd click on line/measure-distance),
       * the useUnifiedDrawing hook emits 'drawing:complete'. We listen here and
       * immediately clear the preview canvas to prevent the "two numbers" bug.
       *
       * This is the CORRECT enterprise pattern:
       * - Decoupled: PreviewCanvas doesn't need to know about addPoint() internals
       * - Synchronous: Clear happens in the same event loop as completion
       * - Type-safe: Event Bus provides TypeScript type checking
       */
      const unsubscribe = EventBus.on('drawing:complete', () => {
        const renderer = rendererRef.current;
        if (renderer) {
          renderer.clear();
        }
      });

      return () => {
        unsubscribe();
      };
    }, []);

    // ============================================================================
    // IMPERATIVE HANDLE - Direct API for mouse handlers
    // ============================================================================

    useImperativeHandle(
      ref,
      () => ({
        /**
         * 🏢 ENTERPRISE: Draw preview directly
         * NO REACT RE-RENDER - direct canvas call!
         */
        drawPreview: (entity: ExtendedSceneEntity | null, options?: PreviewRenderOptions) => {
          const renderer = rendererRef.current;
          if (!renderer) return;

          // Merge default options with provided options
          const mergedOptions = {
            ...optionsRef.current,
            ...options,
          };

          // 🏢 ADR-040: Pass viewport for Y-axis inversion
          renderer.drawPreview(entity, transformRef.current, viewportRef.current, mergedOptions);
        },

        /**
         * 🏢 ENTERPRISE: Clear preview
         */
        clear: () => {
          rendererRef.current?.clear();
        },

        /**
         * 🏢 ENTERPRISE: Get canvas element
         */
        getCanvas: () => canvasRef.current,

        /** ADR-357 Phase 1: Polar tracking alignment path overlay */
        drawPolarTrackingLine: (
          ref: Point2D,
          snappedAngle: number,
          label: string,
          cursorWorld: Point2D,
        ) => {
          const renderer = rendererRef.current;
          if (!renderer) return;
          renderer.drawPolarTrackingLine(
            ref,
            snappedAngle,
            label,
            cursorWorld,
            transformRef.current,
            viewportRef.current,
          );
        },

        /** ADR-357 Phase 4: Object Snap Tracking persistent markers */
        setTrackingMarkers: (markers: readonly AcquiredTrackingPoint[]) => {
          rendererRef.current?.setTrackingMarkers(markers);
        },

        /** ADR-357 Phase 4: Object Snap Tracking alignment + intersection overlay */
        drawTrackingAlignment: (
          paths: readonly TrackingAlignmentPath[],
          intersections: readonly Point2D[],
          snappedPoint: Point2D,
          label: string | null,
        ) => {
          const renderer = rendererRef.current;
          if (!renderer) return;
          renderer.drawTrackingAlignment(
            paths,
            intersections,
            snappedPoint,
            label,
            transformRef.current,
            viewportRef.current,
          );
        },
      }),
      []
    );

    // ============================================================================
    // RENDER
    // ============================================================================

    return (
      <canvas
        ref={canvasRef}
        className={`${className} ${PANEL_LAYOUT.POINTER_EVENTS.NONE} absolute inset-0 w-full h-full z-[15]`}
        style={style}
        data-testid="preview-canvas"
      />
    );
  }
);

/**
 * 🏢 ENTERPRISE COMPLIANCE CHECKLIST:
 *
 * ✅ useImperativeHandle for direct API (ZERO React re-renders)
 * ✅ UnifiedFrameScheduler integration (ADR-030)
 * ✅ HIGH priority rendering (important UI feedback)
 * ✅ Dirty-flag optimization (skips render if not dirty)
 * ✅ ResizeObserver for canvas sizing
 * ✅ forwardRef pattern for ref access
 * ✅ Proper cleanup with dispose()
 * ✅ Full TypeScript (ZERO any)
 * ✅ Transparent background (preview layer only)
 * ✅ pointer-events: none (mouse events pass through)
 */
