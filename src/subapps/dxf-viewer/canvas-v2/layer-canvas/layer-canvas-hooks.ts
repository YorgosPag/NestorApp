/**
 * LAYER CANVAS HOOKS
 * Extracted from LayerCanvas.tsx for SRP (ADR-065)
 *
 * Contains:
 * - useLayerHitTest: Layer hit testing + selection handler
 * - useLayerCanvasRenderer: Rendering callback + dirty flag + frame scheduler
 */

import { useRef, useCallback, useEffect } from 'react';
import type { SelectionState } from '../../systems/cursor/SelectionStore';
import type { LayerRenderer } from './LayerRenderer';
import { registerRenderCallback, RENDER_PRIORITIES } from '../../rendering';
import type { ViewTransform, Viewport, Point2D } from '../../rendering/types/Types';
import type { DxfScene } from '../dxf-canvas/dxf-types';
import { ImmediatePositionStore } from '../../systems/cursor/ImmediatePositionStore';
import { getImmediateTransform } from '../../systems/cursor/ImmediateTransformStore';
import type {
  ColorLayer,
  LayerRenderOptions,
  SnapSettings,
  GridSettings,
  RulerSettings,
  SelectionSettings
} from './layer-types';
import type { CrosshairSettings } from '../../rendering/ui/crosshair/CrosshairTypes';
import type { CursorSettings } from '../../systems/cursor/config';
import { gripStyleStore } from '../../stores/GripStyleStore';

// ── Types ────────────────────────────────────────────────────────────

interface SnapResult {
  point: Point2D;
  type: string;
  entityId?: string;
}

interface CursorState {
  position: Point2D | null;
  // isSelecting/selectionStart/selectionCurrent moved to selectionRef param
  // (imperative subscription — zero React re-renders on selection drag)
}

interface LayerHitTestParams {
  layers: ColorLayer[];
  activeTool?: string;
  rendererRef: React.MutableRefObject<LayerRenderer | null>;
  onLayerClick?: (layerId: string, point: Point2D) => void;
}

interface LayerCanvasRendererParams {
  layers: ColorLayer[];
  rendererRef: React.MutableRefObject<LayerRenderer | null>;
  transformRef: React.MutableRefObject<ViewTransform>;
  resolvedViewportRef: React.MutableRefObject<Viewport>;
  viewport: Viewport;
  activeTool?: string;
  layersVisible: boolean;
  draggingOverlay: { overlayId: string; delta: Point2D } | null;
  cursor: CursorState;
  selectionRef: React.MutableRefObject<SelectionState>;
  snapResults: SnapResult[];
  crosshairSettings: CrosshairSettings;
  cursorSettings: CursorSettings;
  snapSettings: SnapSettings;
  gridSettings: GridSettings;
  rulerSettings: RulerSettings;
  selectionSettings: SelectionSettings;
  renderOptions: LayerRenderOptions;
  useUnifiedUIRendering: boolean;
  transform: ViewTransform;
}

// ── useLayerHitTest ──────────────────────────────────────────────────

/**
 * Layer hit testing callback + selection handler.
 * Uses LayerRenderer.hitTest() for layer polygons (NOT HitTestingService).
 */
export function useLayerHitTest({
  layers,
  activeTool,
  rendererRef,
  onLayerClick,
}: LayerHitTestParams) {
  const layerHitTestCallback = useCallback(
    (_scene: DxfScene | null, screenPos: Point2D, transform: ViewTransform, viewport: Viewport): string | null => {
      if (!layers || layers.length === 0) return null;

      try {
        const result = rendererRef.current?.hitTest(layers, screenPos, transform, viewport, 5);
        return result ?? null;
      } catch (error) {
        console.error('LayerCanvas LayerRenderer hitTest failed:', error);
        return null;
      }
    },
    [layers, activeTool, rendererRef],
  );

  const handleLayerSelection = useCallback(
    (layerId: string | null) => {
      if (
        layerId &&
        onLayerClick &&
        (activeTool === 'select' || activeTool === 'layering' || activeTool === 'move')
      ) {
        const pos = ImmediatePositionStore.getPosition();
        if (pos) {
          onLayerClick(layerId, pos);
        }
      }
    },
    [onLayerClick, activeTool],
  );

  return { layerHitTestCallback, handleLayerSelection };
}

// ── useLayerCanvasRenderer ───────────────────────────────────────────

/**
 * Rendering callback + dirty-flag management + UnifiedFrameScheduler subscription.
 * Replaces scattered requestAnimationFrame calls with a single coordinated loop (ADR-119).
 */
export function useLayerCanvasRenderer(params: LayerCanvasRendererParams) {
  const {
    rendererRef,
    transformRef,
    resolvedViewportRef,
    viewport,
    selectionRef,
  } = params;

  const isDirtyRef = useRef(true);

  // 🚀 PERF (ADR-040, 2026-05-11): all volatile params held in a single ref
  // synced render-by-render. This breaks the unsubscribe/re-register storm
  // observed in profiler (13% unsubscribe + 13% renderScene at 60Hz on hover/snap/drag).
  // Stable `renderLayers` identity → registerRenderCallback effect runs ONCE per mount.
  const paramsRef = useRef(params);
  paramsRef.current = params;

  // Event listeners that mark dirty
  useEffect(() => {
    const handleToggle = () => {
      isDirtyRef.current = true;
    };

    window.addEventListener('origin-markers-toggle', handleToggle as EventListener);
    window.addEventListener('ruler-debug-toggle', handleToggle as EventListener);

    return () => {
      window.removeEventListener('origin-markers-toggle', handleToggle as EventListener);
      window.removeEventListener('ruler-debug-toggle', handleToggle as EventListener);
    };
  }, []);

  // Core render callback — STABLE identity (deps = [refs only])
  const renderLayers = useCallback(() => {
    const renderer = rendererRef.current;
    const current = paramsRef.current;
    if (!renderer || !current.viewport.width || !current.viewport.height) return;

    try {
      const sel = selectionRef.current;
      const currentSelectionBox =
        sel.isSelecting && sel.selectionStart && sel.selectionCurrent
          ? ({
              startPoint: sel.selectionStart,
              endPoint: sel.selectionCurrent,
              type: sel.selectionCurrent.x > sel.selectionStart.x ? 'window' : 'crossing',
            } as const)
          : null;

      const centralizedPosition = ImmediatePositionStore.getPosition();
      const isPanToolActive = current.activeTool === 'pan';

      let filteredLayers = current.layersVisible
        ? current.layers
        : current.layers.filter((l) => l.isDraft);

      if (current.draggingOverlay?.delta) {
        const drag = current.draggingOverlay;
        filteredLayers = filteredLayers.map((layer) => {
          if (layer.id === drag.overlayId) {
            return {
              ...layer,
              polygons: layer.polygons.map((poly) => ({
                ...poly,
                vertices: poly.vertices.map((vertex: Point2D) => ({
                  x: vertex.x + drag.delta.x,
                  y: vertex.y + drag.delta.y,
                })),
              })),
            };
          }
          return layer;
        });
      }

      const layerSnapResults: LayerRenderOptions['snapResults'] = current.snapResults.map((snap) => ({
        point: snap.point,
        type: snap.type as LayerRenderOptions['snapResults'][number]['type'],
        entityId: snap.entityId ?? undefined,
      }));

      const finalRenderOptions = {
        ...current.renderOptions,
        showCrosshair: current.renderOptions.showCrosshair && !isPanToolActive,
        showCursor: current.renderOptions.showCursor && !isPanToolActive,
        crosshairPosition: isPanToolActive ? null : centralizedPosition,
        cursorPosition: isPanToolActive ? null : centralizedPosition,
        showSelectionBox: !isPanToolActive && sel.isSelecting && currentSelectionBox !== null,
        selectionBox: isPanToolActive ? null : currentSelectionBox,
        snapResults: layerSnapResults,
        gripSettings: gripStyleStore.get(),
      };

      renderer.render(
        filteredLayers,
        getImmediateTransform(),
        resolvedViewportRef.current,
        current.crosshairSettings,
        current.cursorSettings,
        current.snapSettings,
        current.gridSettings,
        current.rulerSettings,
        current.selectionSettings,
        finalRenderOptions,
      );
    } catch (error) {
      console.error('Failed to render Layer canvas:', error);
    }
  }, [rendererRef, resolvedViewportRef, selectionRef]);

  // Register with UnifiedFrameScheduler (ADR-119) — runs ONCE per mount
  useEffect(() => {
    if (viewport.width > 0 && viewport.height > 0 && rendererRef.current) {
      const unsubscribe = registerRenderCallback(
        'layer-canvas',
        'Layer Canvas Renderer',
        RENDER_PRIORITIES.NORMAL,
        () => {
          renderLayers();
          isDirtyRef.current = false;
        },
        () => isDirtyRef.current,
      );
      return unsubscribe;
    }
  }, [renderLayers, viewport.width, viewport.height, rendererRef]);

  // Mark dirty when dependencies change
  // 🏢 ADR-030: settings deps included so panel changes (crosshair / cursor
  // pickbox / selection box / grid / ruler) flag the canvas dirty without
  // requiring a mouse move. Pairs with `markAllCanvasDirty()` in
  // CursorConfiguration.notifyListeners (singleton-side belt-and-suspenders).
  useEffect(() => {
    isDirtyRef.current = true;
  }, [
    params.layers,
    params.transform,
    params.viewport,
    params.snapResults,
    params.layersVisible,
    params.activeTool,
    params.draggingOverlay,
    params.crosshairSettings,
    params.cursorSettings,
    params.selectionSettings,
    params.gridSettings,
    params.rulerSettings,
  ]);

  // Mark dirty when grip style settings change (size, colors, etc.)
  // Without this subscription, grip panel changes have no effect until the
  // next unrelated re-render that happens to set isDirtyRef = true.
  useEffect(() => {
    const unsub = gripStyleStore.subscribe(() => {
      isDirtyRef.current = true;
    });
    return () => { unsub(); };
  }, []);

  return { isDirtyRef };
}
