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

import React, { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { PreviewRenderer, type PreviewRenderOptions } from './PreviewRenderer';
import { registerRenderCallback, RENDER_PRIORITIES } from '../../rendering';
import type { ViewTransform, Point2D } from '../../rendering/types/Types';
import type { ExtendedSceneEntity } from '../../hooks/drawing/useUnifiedDrawing';
import type { SceneUnits } from '../../utils/scene-units';
// ADR-357 Phase 4: Object Snap Tracking handle types.
import type { AcquiredTrackingPoint } from '../../systems/tracking/TrackingPointStore';
import type { TrackingAlignmentPath } from '../../systems/tracking/tracking-resolver';
import type { GhostFaceDimensionsMeta } from '../../bim/framing/ghost-face-dim-references';
import type { WallHudMeta } from './wall-hud-paint';
import type { ColumnParams } from '../../bim/types/column-types';
import type { FootprintHudDescriptor } from './column-hud-paint';
import type { PolarDiskGrid } from '../../bim/columns/polar-disk-snap';
import type { RectGrid } from '../../bim/columns/rect-cartesian-snap';
import type { PlacementAlignmentGuide } from '../../bim/columns/column-tangent-snap';
// SRP split (ADR-040) — the imperative-handle factory (API→renderer mapping) lives in a
// sibling module; this component keeps only the lifecycle wiring.
import { createPreviewCanvasHandle } from './preview-canvas-handle';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
// 🏢 ENTERPRISE (2026-01-27): Event Bus for drawing completion notification - ADR-040
import { EventBus } from '../../systems/events';
// 🏢 ADR-549 Phase 7 — re-rasterize on a devicePixelRatio change (no ResizeObserver fires then).
import { subscribeDevicePixelRatio } from '../../systems/cursor/device-pixel-ratio';

// ============================================================================
// TYPES - Enterprise TypeScript Standards (ZERO any)
// ============================================================================

export interface PreviewCanvasProps {
  /** CSS class name */
  className?: string;
  /** Custom styles */
  style?: React.CSSProperties;
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

  /**
   * Draw the wall-ghost listening dimensions (ADR-508 §dim). Call AFTER `drawPreview` —
   * overlays the along-face distance dims (gap-left / gap-right / centre-to-centre).
   * Wiped on the next `drawPreview`/`clear`.
   */
  drawGhostFaceDimensions: (meta: GhostFaceDimensionsMeta) => void;
  /**
   * ADR-508 §wall-hud — draw the live wall identity HUD (aligned length dim + angle + spec label).
   * Call AFTER `drawPreview`; wiped on the next `drawPreview`/`clear`.
   */
  drawWallHud: (meta: WallHudMeta, specLabel: string) => void;
  /** ADR-564 §footprint-hud: live column/pad footprint identity HUD (per-face dims + angle + height) */
  drawColumnHud: (footprint: readonly Point2D[], params: ColumnParams, heightSpecLabel: string) => void;
  /** ADR-564 §foundation-hud: entity-agnostic footprint HUD (pad) via minimal descriptor (no ColumnParams) */
  drawFootprintHud: (footprint: readonly Point2D[], descriptor: FootprintHudDescriptor, heightSpecLabel: string) => void;
  /**
   * ADR-397 §15 (wall) — draw the colored angle direction arc (🟢 above / 🔴 below the
   * x-axis) + arrowhead + dashed 0° baseline + colored signed degrees. Shared SSoT painter with the
   * rotation arc (ADR-397 §15). Call AFTER `drawPreview`; wiped on the next `drawPreview`/`clear`.
   */
  drawDirectionArc: (pivotW: Point2D, anchorW: Point2D, cursorW: Point2D, sweepDeg: number) => void;
  /**
   * ADR-508 §opening-conflict — draw the 🔴 tooltip explaining the height-band opening cut.
   * Call AFTER `drawPreview`; wiped on the next `drawPreview`/`clear`.
   */
  drawGhostConflictTooltip: (label: string, anchorWorld: Point2D) => void;
  /**
   * ADR-398 §3.13 — draw the Polar Magnet grid (center / concentric rings / radial spokes).
   * Call AFTER `drawPreview`; wiped on the next `drawPreview`/`clear`.
   */
  drawPolarDisk: (grid: PolarDiskGrid) => void;
  /**
   * ADR-398 §3.15 — draw the Cartesian Magnet grid (u/v grid lines + center) inside a rectangle.
   * Call AFTER `drawPreview`; wiped on the next `drawPreview`/`clear`.
   */
  drawRectGrid: (grid: RectGrid) => void;
  /**
   * ADR-398 §3.20/§3.20d — draw the alignment guide(s) (dashed end/center line, or up to 2 rectangle
   * sides at a corner). Call AFTER `drawPreview`; wiped on the next `drawPreview`/`clear`.
   */
  drawAlignmentGuide: (guide: PlacementAlignmentGuide | readonly PlacementAlignmentGuide[]) => void;
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

      // Initial size — from the authoritative viewport prop (SSoT), NOT getBoundingClientRect().
      const vp = viewportRef.current;
      if (vp.width > 0 && vp.height > 0) {
        renderer.updateSize(vp.width, vp.height);
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
    // 🏢 SSoT CANVAS SIZING (ADR-040) — size the backing store from the authoritative `viewport`
    // prop (container SSoT via useViewportManager), NEVER from this canvas's own
    // getBoundingClientRect(). Per-canvas measurement at a different lifecycle moment was the
    // preview-layer half of the size desync (stale buffer + inline px CSS → clipped column ghost
    // on the right). `updateSize` self-guards against no-op re-sizes (won't clear the canvas).
    // ============================================================================

    useEffect(() => {
      if (viewport.width > 0 && viewport.height > 0) {
        rendererRef.current?.updateSize(viewport.width, viewport.height);
      }
    }, [viewport.width, viewport.height]);

    // A devicePixelRatio change fires no ResizeObserver (CSS size unchanged) — re-size so the
    // backing store re-rasterizes at the new dpr (monitor/scaling switch → no stale region).
    useEffect(
      () =>
        subscribeDevicePixelRatio(() => {
          const vp = viewportRef.current;
          if (vp.width > 0 && vp.height > 0) rendererRef.current?.updateSize(vp.width, vp.height);
        }),
      [],
    );

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

    // Imperative handle (API→renderer mapping) built by the SRP-extracted factory. Refs are stable
    // object identities, so the handle stays valid for the component lifetime (empty dep array).
    useImperativeHandle(
      ref,
      () =>
        createPreviewCanvasHandle({
          canvasRef,
          rendererRef,
          transformRef,
          viewportRef,
          optionsRef,
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
